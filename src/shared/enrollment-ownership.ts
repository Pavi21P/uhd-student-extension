import type { EnrollmentJob, PortalTarget } from './domain';
import type { LifecycleEvent } from './enrollment-lifecycle';
import { parsePortalTarget } from './enrollment-records';
import { ContractFault, id, integer, invalid, list, record, revision, text, version } from './validation';

export interface ExecutorPolicy {
  extensionId: string;
  adapters: { origin: string; adapterVersion: string }[];
}
export interface ExecutorContext {
  sender: { extensionId: string; tabId: number; frameId: number; documentId: string;
    origin: string; url: string; documentLifecycle: string };
  pending: { requestId: string; command: 'portal.execute' | 'portal.cancel'; jobId: string;
    executionToken: string; target: PortalTarget; expectedRevision: number; expiresAt: number };
  reply: { protocolVersion: 1; requestId: string; type: 'portal.completed' | 'portal.cancelled';
    jobId: string; executionToken: string };
}
export type ExecutorEvent = Extract<LifecycleEvent, { type: 'submission-observed' }>
  | { type: 'cancellation-confirmed' };
export function isExecutorEvent(event: LifecycleEvent): event is ExecutorEvent {
  return event.type === 'submission-observed' || event.type === 'cancellation-confirmed';
}
function origin(value: unknown): string {
  const result = text(value, 300, 'executor.origin');
  let url: URL;
  try { url = new URL(result); } catch { return invalid('executor.origin'); }
  if (url.protocol !== 'https:' || url.origin !== result || url.username || url.password) invalid('executor.origin');
  return result;
}
/** Trusted worker configuration only; no default live host or adapter is assumed. */
export function parseExecutorPolicy(value: unknown): ExecutorPolicy {
  const row = record(value, ['extensionId', 'adapters'], 'executorPolicy');
  const adapters = list(row.adapters, 32, 'executorPolicy.adapters').map(value => {
    const entry = record(value, ['origin', 'adapterVersion'], 'executorPolicy.adapter');
    return { origin: origin(entry.origin), adapterVersion: id(entry.adapterVersion, 'executorPolicy.adapterVersion') };
  });
  const keys = adapters.map(entry => JSON.stringify([entry.origin, entry.adapterVersion]));
  if (new Set(keys).size !== keys.length) invalid('executorPolicy.adapters');
  return { extensionId: id(row.extensionId, 'executorPolicy.extensionId'), adapters };
}

/**
 * Snapshot bridge inputs. sender MUST come from browser-supplied metadata; pending
 * MUST come from the worker's outstanding-request registry, never the reply payload.
 * reply is only a correlation projection, not validation of an entire PortalReply.
 */
export function parseExecutorContext(value: unknown): ExecutorContext {
  const row = record(value, ['sender', 'pending', 'reply'], 'executorContext');
  const sender = record(row.sender, ['extensionId', 'tabId', 'frameId', 'documentId', 'origin', 'url', 'documentLifecycle'], 'executor.sender');
  const pending = record(row.pending, ['requestId', 'command', 'jobId', 'executionToken', 'target', 'expectedRevision', 'expiresAt'], 'executor.pending');
  const reply = record(row.reply, ['protocolVersion', 'requestId', 'type', 'jobId', 'executionToken'], 'executor.reply');
  if (pending.command !== 'portal.execute' && pending.command !== 'portal.cancel') invalid('executor.pending.command');
  if (reply.type !== 'portal.completed' && reply.type !== 'portal.cancelled') invalid('executor.reply.type');
  return {
    sender: { extensionId: id(sender.extensionId, 'executor.sender.extensionId'),
      tabId: integer(sender.tabId, 0, Number.MAX_SAFE_INTEGER, 'executor.sender.tabId'),
      frameId: integer(sender.frameId, 0, Number.MAX_SAFE_INTEGER, 'executor.sender.frameId'),
      documentId: id(sender.documentId, 'executor.sender.documentId'), origin: origin(sender.origin),
      url: text(sender.url, 8_192, 'executor.sender.url'),
      documentLifecycle: text(sender.documentLifecycle, 40, 'executor.sender.documentLifecycle') },
    pending: { requestId: id(pending.requestId, 'executor.pending.requestId'), command: pending.command,
      jobId: id(pending.jobId, 'executor.pending.jobId'), executionToken: id(pending.executionToken, 'executor.pending.executionToken'),
      target: parsePortalTarget(pending.target), expectedRevision: revision(pending.expectedRevision, 'executor.pending.expectedRevision'),
      expiresAt: integer(pending.expiresAt, -8_640_000_000_000_000, 8_640_000_000_000_000, 'executor.pending.expiresAt') },
    reply: { protocolVersion: version(reply.protocolVersion, 'executor.reply.protocolVersion'),
      requestId: id(reply.requestId, 'executor.reply.requestId'), type: reply.type,
      jobId: id(reply.jobId, 'executor.reply.jobId'), executionToken: id(reply.executionToken, 'executor.reply.executionToken') },
  };
}
function deny(): never {
  throw new ContractFault('UNAUTHORIZED_SENDER', 'This executor report does not match the authorized document and outstanding request.');
}
function sameTarget(first: PortalTarget, second: PortalTarget): boolean {
  return first.tabId === second.tabId && first.frameId === second.frameId && first.documentId === second.documentId
    && first.origin === second.origin && first.adapterVersion === second.adapterVersion;
}
/** Validated internal inputs only. This check neither dispatches nor consumes a request. */
export function assertExecutorOwnership(
  job: EnrollmentJob, expectedRevision: number, event: ExecutorEvent,
  context: ExecutorContext, policy: ExecutorPolicy | undefined, nowEpochMs: number,
): void {
  if (!policy || !policy.adapters.some(entry => entry.origin === job.review.target.origin
      && entry.adapterVersion === job.review.target.adapterVersion)) {
    throw new ContractFault('PORTAL_UNSUPPORTED', 'No supported executor adapter is configured for this job.');
  }
  const { sender, pending, reply } = context;
  const target = job.review.target;
  let url: URL;
  try { url = new URL(sender.url); } catch { return deny(); }
  if (sender.extensionId !== policy.extensionId || sender.documentLifecycle !== 'active'
      || sender.tabId !== target.tabId || sender.frameId !== target.frameId || sender.documentId !== target.documentId
      || sender.origin !== target.origin || url.protocol !== 'https:' || url.origin !== target.origin
      || url.username || url.password || !sameTarget(pending.target, target)
      || pending.jobId !== job.id || reply.jobId !== job.id
      || pending.executionToken !== job.executionToken || reply.executionToken !== job.executionToken
      || pending.requestId !== reply.requestId || pending.expectedRevision !== expectedRevision
      || nowEpochMs >= pending.expiresAt) deny();
  if (event.type === 'submission-observed'
    ? pending.command !== 'portal.execute' || reply.type !== 'portal.completed'
    : pending.command !== 'portal.cancel' || reply.type !== 'portal.cancelled') deny();
  // Job revision and state are rechecked by the lifecycle function before persistence.
}
