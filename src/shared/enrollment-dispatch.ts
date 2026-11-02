import type { EnrollmentJob, PortalTarget } from './domain';
import type { ExecutorRequestRecord } from './enrollment-requests';
import type { PortalCommand } from './messages';
import { id, integer, invalid, list, record, version } from './validation';
import { parsePortalTarget } from './enrollment-records';

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

/** Strict, detached boundary for the trusted browser sender; no arbitrary commands. */
export function parseExecutorDispatch(value: unknown): ExecutorDispatch {
  const row = record(value, ['target', 'command', 'expiresAt'], 'dispatch');
  const target = parsePortalTarget(row.target);
  const expiresAt = integer(row.expiresAt, -8_640_000_000_000_000, 8_640_000_000_000_000, 'dispatch.expiresAt');
  const command = record(row.command, ['protocolVersion', 'requestId', 'type', 'payload'], 'dispatch.command');
  const base = { protocolVersion: version(command.protocolVersion, 'dispatch.protocolVersion'),
    requestId: id(command.requestId, 'dispatch.requestId') };
  const fields = ['jobId', 'executionToken'];
  if (command.type === 'portal.execute') fields.push('reviewFingerprint', 'termId', 'selectedSectionIds', 'deselectSectionIds', 'targetEpochMs', 'expiresAt');
  else if (command.type !== 'portal.cancel') invalid('dispatch.command.type');
  const payload = record(command.payload, fields, 'dispatch.payload');
  const identity = { jobId: id(payload.jobId, 'dispatch.jobId'), executionToken: id(payload.executionToken, 'dispatch.executionToken') };
  if (command.type === 'portal.cancel') return { target, expiresAt, command: { ...base, type: 'portal.cancel', payload: identity } };
  const ids = (value: unknown, field: string) => {
    const result = list(value, 250, field).map(value => id(value, field));
    if (new Set(result).size !== result.length) invalid(field);
    return result;
  };
  const selectedSectionIds = ids(payload.selectedSectionIds, 'dispatch.selectedSectionIds');
  const deselectSectionIds = ids(payload.deselectSectionIds, 'dispatch.deselectSectionIds');
  if (!selectedSectionIds.length || deselectSectionIds.some(value => selectedSectionIds.includes(value))) invalid('dispatch.selection');
  const targetEpochMs = integer(payload.targetEpochMs, -8_640_000_000_000_000, 8_640_000_000_000_000, 'dispatch.targetEpochMs');
  if (payload.expiresAt !== expiresAt || expiresAt <= targetEpochMs) invalid('dispatch.expiresAt');
  return { target, expiresAt, command: { ...base, type: 'portal.execute', payload: { ...identity,
    reviewFingerprint: id(payload.reviewFingerprint, 'dispatch.reviewFingerprint'), termId: id(payload.termId, 'dispatch.termId'),
    selectedSectionIds, deselectSectionIds, targetEpochMs, expiresAt } } };
}
