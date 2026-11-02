import type { EnrollmentJob, PortalTarget } from './domain';
import type { ExecutorRequestRecord } from './enrollment-requests';
import type { PortalCommand } from './messages';
import { id, integer, invalid, list, record } from './validation';

export interface DispatchIntent { requestId: string; claimedAt: number }
export interface ExecutorDispatch {
  target: PortalTarget;
  command: Exclude<PortalCommand, { type: 'portal.inspect' }>;
  expiresAt: number;
}
/** Durable single-use tombstones, not evidence that a command arrived or a submit occurred. */
export function parseDispatchIntents(value: unknown, jobs: EnrollmentJob[], requests: ExecutorRequestRecord[]): DispatchIntent[] {
  const byRequest = new Map(requests.map(request => [request.pending.requestId, request]));
  const byJob = new Map(jobs.map(job => [job.id, job]));
  const intents = list(value, 200, 'dispatchIntents').map(value => {
    const row = record(value, ['requestId', 'claimedAt'], 'dispatchIntent');
    const requestId = id(row.requestId, 'dispatchIntent.requestId');
    const claimedAt = integer(row.claimedAt, -8_640_000_000_000_000, 8_640_000_000_000_000, 'dispatchIntent.claimedAt');
    const request = byRequest.get(requestId);
    const job = request && byJob.get(request.pending.jobId);
    if (!request || !job || claimedAt < request.createdAt || claimedAt >= request.pending.expiresAt
        || (request.pending.command === 'portal.execute' && claimedAt >= job.expiresAt)) invalid('dispatchIntent');
    return { requestId, claimedAt };
  });
  if (new Set(intents.map(intent => intent.requestId)).size !== intents.length) invalid('dispatchIntents');
  return intents;
}

/** Caller has checked saved ownership and time; no arbitrary payload or target is accepted. */
export function executorDispatch(job: EnrollmentJob, request: ExecutorRequestRecord): ExecutorDispatch {
  const expiresAt = request.pending.command === 'portal.execute'
    ? Math.min(job.expiresAt, request.pending.expiresAt) : request.pending.expiresAt;
  const base = { protocolVersion: 1 as const, requestId: request.pending.requestId };
  const payload = { jobId: job.id, executionToken: job.executionToken };
  return { target: { ...job.review.target }, expiresAt,
    command: request.pending.command === 'portal.cancel'
      ? { ...base, type: 'portal.cancel', payload }
      : { ...base, type: 'portal.execute', payload: { ...payload, reviewFingerprint: job.review.fingerprint,
        termId: job.termId, selectedSectionIds: [...job.selectedSectionIds], deselectSectionIds: [...job.review.deselectSectionIds],
        targetEpochMs: job.targetEpochMs, expiresAt } } };
}
