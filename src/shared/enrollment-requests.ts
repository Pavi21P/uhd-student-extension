import type { EnrollmentJob } from './domain';
import { parseExecutorPending, sameTarget, type ExecutorPending } from './enrollment-ownership';
import { id, integer, invalid, list, record } from './validation';

export interface ExecutorRequestRecord {
  pending: ExecutorPending;
  createdAt: number;
  state: 'pending' | 'consumed' | 'abandoned';
}
const epoch = (value: unknown, field: string) => integer(value, -8_640_000_000_000_000, 8_640_000_000_000_000, field);
export function parseExecutorRegistration(value: unknown) {
  const row = record(value, ['requestId', 'command', 'expiresAt'], 'executorRegistration');
  if (row.command !== 'portal.execute' && row.command !== 'portal.cancel') invalid('executorRegistration.command');
  return { requestId: id(row.requestId, 'executorRegistration.requestId'), command: row.command,
    expiresAt: epoch(row.expiresAt, 'executorRegistration.expiresAt') };
}
/** Historical records, validated against their retained jobs; never reissue a request. */
export function parseExecutorRequests(value: unknown, jobs: EnrollmentJob[]): ExecutorRequestRecord[] {
  const byId = new Map(jobs.map(job => [job.id, job]));
  const requests = list(value, 200, 'executorRequests').map<ExecutorRequestRecord>(value => {
    const row = record(value, ['pending', 'createdAt', 'state'], 'executorRequest');
    const pending = parseExecutorPending(row.pending);
    const createdAt = epoch(row.createdAt, 'executorRequest.createdAt');
    if (row.state !== 'pending' && row.state !== 'consumed' && row.state !== 'abandoned') invalid('executorRequest.state');
    const job = byId.get(pending.jobId);
    if (!job || pending.executionToken !== job.executionToken || !sameTarget(pending.target, job.review.target)
        || pending.expectedRevision > job.revision || createdAt < job.createdAt || createdAt < job.targetEpochMs
        || (pending.command === 'portal.execute' && createdAt >= job.expiresAt) || pending.expiresAt <= createdAt) invalid('executorRequest');
    if (row.state === 'pending' && (job.state !== 'executing' || job.submittedAt !== null
        || pending.expectedRevision !== job.revision)) invalid('executorRequest.pending');
    if (row.state === 'consumed' && pending.expectedRevision >= job.revision) invalid('executorRequest.consumed');
    return { pending, createdAt, state: row.state };
  });
  if (new Set(requests.map(entry => entry.pending.requestId)).size !== requests.length
      || new Set(requests.map(entry => JSON.stringify([entry.pending.jobId, entry.pending.command]))).size !== requests.length) invalid('executorRequests');
  if (requests.some(entry => entry.pending.command === 'portal.cancel'
      && !requests.some(other => other.pending.jobId === entry.pending.jobId && other.pending.command === 'portal.execute' && other.createdAt <= entry.createdAt))) invalid('executorRequests.cancel');
  return requests;
}
