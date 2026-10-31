import type { EnrollmentJob, SectionOutcome } from './domain';
import type { LifecycleEvent } from './enrollment-lifecycle';
import type { ExecutorPending } from './enrollment-ownership';
import { parseSectionOutcome } from './enrollment-records';
import { errorCodes } from './foundation-rpc';
import type { PortalReply } from './messages';
import { ContractFault, id, integer, invalid, list, record, text, version } from './validation';

export type ExecutorReply = Exclude<PortalReply, { type: 'portal.inspected' }>;
function plainText(value: unknown, max: number, field: string): string {
  const result = text(value, max, field);
  // oxlint-disable-next-line no-control-regex -- Reject markup, controls and lone surrogates.
  if (/[<>\u0000-\u001f\u007f\ud800-\udfff]/u.test(result)) invalid(field);
  return result;
}
/** Validate and detach the entire executor reply. Inspection replies use a separate future path. */
export function parseExecutorReply(value: unknown): ExecutorReply {
  const row = record(value, ['protocolVersion', 'requestId', 'type', 'payload'], 'executorReply');
  const base = { protocolVersion: version(row.protocolVersion, 'executorReply.protocolVersion'),
    requestId: id(row.requestId, 'executorReply.requestId') };
  if (row.type === 'portal.completed') {
    const payload = record(row.payload, ['jobId', 'executionToken', 'submittedAt', 'outcomes'], 'executorReply.payload');
    const submittedAt = payload.submittedAt === null ? null
      : integer(payload.submittedAt, -8_640_000_000_000_000, 8_640_000_000_000_000, 'executorReply.submittedAt');
    const outcomes = list(payload.outcomes, 250, 'executorReply.outcomes').map(parseSectionOutcome);
    if (new Set(outcomes.map(outcome => outcome.sectionId)).size !== outcomes.length
        || (submittedAt === null && outcomes.length)) invalid('executorReply.outcomes');
    return { ...base, type: row.type, payload: { jobId: id(payload.jobId, 'executorReply.jobId'),
      executionToken: id(payload.executionToken, 'executorReply.executionToken'), submittedAt, outcomes } };
  }
  if (row.type === 'portal.cancelled') {
    const payload = record(row.payload, ['jobId', 'executionToken'], 'executorReply.payload');
    return { ...base, type: row.type, payload: { jobId: id(payload.jobId, 'executorReply.jobId'),
      executionToken: id(payload.executionToken, 'executorReply.executionToken') } };
  }
  if (row.type === 'portal.error') {
    const payload = record(row.payload, ['error', 'jobId'], 'executorReply.payload');
    const error = record(payload.error, ['code', 'message', 'field'], 'executorReply.error');
    const code = errorCodes.find(code => code === error.code);
    if (!code) invalid('executorReply.error.code');
    return { ...base, type: row.type, payload: {
      ...(Object.hasOwn(payload, 'jobId') ? { jobId: id(payload.jobId, 'executorReply.jobId') } : {}),
      error: { code, message: plainText(error.message, 300, 'executorReply.error.message'),
        ...(Object.hasOwn(error, 'field') ? { field: plainText(error.field, 100, 'executorReply.error.field') } : {}) },
    } };
  }
  return invalid('executorReply.type');
}
/** Derive from a validated reply and saved request, never a caller-authored lifecycle event. */
export function deriveExecutorReport(job: EnrollmentJob, pending: ExecutorPending, reply: ExecutorReply):
  { event: LifecycleEvent; outcomes?: SectionOutcome[] } {
  const deny = (): never => { throw new ContractFault('UNAUTHORIZED_SENDER', 'The executor reply does not match its saved request.'); };
  if (reply.requestId !== pending.requestId || (reply.payload.jobId !== undefined && reply.payload.jobId !== job.id)) deny();
  // portal.error has no executionToken in the agreed protocol; source + saved request bind it.
  if (reply.type === 'portal.error') return { event: { type: 'invalidate' } };
  if (reply.payload.executionToken !== job.executionToken) deny();
  if (reply.type === 'portal.cancelled') {
    if (pending.command !== 'portal.cancel') deny();
    return { event: { type: 'cancellation-confirmed' } };
  }
  if (pending.command !== 'portal.execute') deny();
  const { submittedAt, outcomes } = reply.payload;
  if (outcomes.length && (outcomes.length !== job.selectedSectionIds.length
      || outcomes.some(outcome => !job.selectedSectionIds.includes(outcome.sectionId)))) invalid('executorReply.outcomes');
  if (submittedAt === null) return { event: { type: 'invalidate' } };
  // Keep normalized evidence, but drop all free-text portal messages before persistence.
  // Completion of this exchange is not a verified enrollment result or final job state.
  return { event: { type: 'submission-observed', submittedAt },
    outcomes: outcomes.map(({ sectionId, status, reason }) => ({ sectionId, status, ...(reason === undefined ? {} : { reason }) })) };
}
