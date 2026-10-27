import type { EnrollmentJobView, JobState } from './domain';
import { ContractFault, id, integer, invalid, record, revision } from './validation';

/** Internal projection only: not a full stored-job schema or dashboard/RPC payload. */
export type EnrollmentLifecycle = Pick<EnrollmentJobView,
  'id' | 'revision' | 'state' | 'targetEpochMs' | 'expiresAt' | 'updatedAt' | 'submittedAt'>;
export type LifecycleEvent =
  | { type: 'begin-preflight' | 'begin-execution' | 'cancel' | 'cancellation-confirmed'
      | 'preflight-failed' | 'invalidate' | 'recover' | 'timeout' }
  | { type: 'submission-observed'; submittedAt: number };
export interface LifecycleDecision {
  job: EnrollmentLifecycle;
  changed: boolean;
  cancellation: 'none' | 'executor-confirmation-required';
}

const maxEpoch = 8_640_000_000_000_000;
const states: readonly JobState[] = ['armed', 'preflight', 'executing', 'succeeded', 'partial',
  'failed', 'unknown', 'cancelled', 'expired', 'needs-review'];
const simpleEvents = ['begin-preflight', 'begin-execution', 'cancel', 'cancellation-confirmed',
  'preflight-failed', 'invalidate', 'recover', 'timeout'] as const;
const epoch = (value: unknown, field: string) => integer(value, -maxEpoch, maxEpoch, field);
const beforeExecution = (state: JobState) => state === 'armed' || state === 'preflight';
const terminal = (state: JobState) => !beforeExecution(state) && state !== 'executing';

export function parseEnrollmentLifecycle(value: unknown): EnrollmentLifecycle {
  const row = record(value, ['id', 'revision', 'state', 'targetEpochMs', 'expiresAt', 'updatedAt', 'submittedAt'], 'job');
  if (!states.includes(row.state as JobState)) invalid('job.state');
  const job: EnrollmentLifecycle = {
    id: id(row.id, 'job.id'), revision: revision(row.revision, 'job.revision'), state: row.state as JobState,
    targetEpochMs: epoch(row.targetEpochMs, 'job.targetEpochMs'), expiresAt: epoch(row.expiresAt, 'job.expiresAt'),
    updatedAt: epoch(row.updatedAt, 'job.updatedAt'),
    submittedAt: row.submittedAt === null ? null : epoch(row.submittedAt, 'job.submittedAt'),
  };
  if (job.expiresAt <= job.targetEpochMs) invalid('job.expiresAt');
  if (job.state === 'executing' && job.updatedAt < job.targetEpochMs) invalid('job.updatedAt');
  if (job.submittedAt !== null && (job.submittedAt > job.updatedAt || beforeExecution(job.state)
      || ['cancelled', 'expired', 'needs-review'].includes(job.state))) invalid('job.submittedAt');
  if (['succeeded', 'partial'].includes(job.state) && job.submittedAt === null) invalid('job.submittedAt');
  return job;
}

function parseEvent(value: unknown): LifecycleEvent {
  const row = record(value, ['type', 'submittedAt'], 'event');
  if (row.type === 'submission-observed') {
    return { type: row.type, submittedAt: epoch(row.submittedAt, 'event.submittedAt') };
  }
  record(row, ['type'], 'event');
  if (!simpleEvents.includes(row.type as typeof simpleEvents[number])) invalid('event.type');
  return { type: row.type as typeof simpleEvents[number] };
}

/**
 * Pure decisions only. The future coordinator must authenticate events and atomically
 * persist an accepted revision before dispatch. This function cannot grant ownership,
 * confirm a portal outcome, or prove that a submission did not happen.
 */
export function transitionEnrollmentLifecycle(
  value: unknown, eventValue: unknown, expectedRevision: number, nowEpochMs: number,
): LifecycleDecision {
  const job = parseEnrollmentLifecycle(value);
  const event = parseEvent(eventValue);
  const now = epoch(nowEpochMs, 'nowEpochMs');
  if (revision(expectedRevision, 'expectedRevision') !== job.revision) {
    throw new ContractFault('REVISION_CONFLICT', 'The job changed. Read its current state before deciding again.');
  }
  const unchanged = (cancellation: LifecycleDecision['cancellation'] = 'none'): LifecycleDecision => ({ job, changed: false, cancellation });
  const change = (state: JobState, submittedAt = job.submittedAt): LifecycleDecision => {
    if (job.revision === Number.MAX_SAFE_INTEGER) {
      throw new ContractFault('REVISION_CONFLICT', 'The job revision cannot advance safely. Review the saved job.');
    }
    return { job: { ...job, state, submittedAt, revision: job.revision + 1, updatedAt: Math.max(now, job.updatedAt) }, changed: true, cancellation: 'none' };
  };
  const tooLate = (): never => { throw new ContractFault('TOO_LATE_TO_CANCEL', 'Submission happened or its outcome is uncertain. Cancellation cannot undo it.'); };

  // Stopped jobs never re-arm, even if a delayed callback arrives or the clock moves.
  if (terminal(job.state)) {
    if (event.type === 'cancel' && (job.submittedAt !== null || job.state === 'unknown')) tooLate();
    return unchanged();
  }
  // An observed backwards clock is a stop condition, not a new execution opportunity.
  if (now < job.updatedAt) return change(job.state === 'executing' ? 'unknown' : 'needs-review');
  // The dispatch window is [targetEpochMs, expiresAt); submitted jobs may finish later.
  if (beforeExecution(job.state) && now >= job.expiresAt) return change('expired');

  switch (event.type) {
    case 'recover':
    case 'invalidate':
      return change(job.state === 'executing' ? 'unknown' : 'needs-review');
    case 'timeout':
      return change(job.state === 'executing' ? 'unknown' : 'needs-review');
    case 'cancel':
      if (beforeExecution(job.state)) return change('cancelled');
      if (job.submittedAt !== null) tooLate();
      return unchanged('executor-confirmation-required');
    case 'cancellation-confirmed':
      // Only a future authenticated owner acknowledgment can supply this event.
      if (job.submittedAt !== null) tooLate();
      if (job.state !== 'executing') invalid('event.type');
      return change('cancelled');
    case 'preflight-failed':
      if (job.state !== 'preflight') invalid('event.type');
      return change('failed');
    case 'begin-preflight':
      if (job.state === 'preflight') return unchanged();
      if (job.state !== 'armed') invalid('event.type');
      return change('preflight');
    case 'begin-execution':
      if (job.state === 'executing') return unchanged();
      if (job.state !== 'preflight') invalid('event.type');
      if (now < job.targetEpochMs) throw new ContractFault('INVALID_TIME', 'The scheduled execution time has not arrived.');
      return change('executing');
    case 'submission-observed': {
      if (job.state !== 'executing' || event.submittedAt > now) invalid('event.submittedAt');
      if (job.submittedAt !== null) {
        return job.submittedAt === event.submittedAt ? unchanged() : change('unknown');
      }
      // Preserve evidence of an early/late/inconsistent dispatch, but never call it success.
      const uncertain = event.submittedAt < job.targetEpochMs || event.submittedAt >= job.expiresAt || event.submittedAt < job.updatedAt;
      return change(uncertain ? 'unknown' : 'executing', event.submittedAt);
    }
  }
}
