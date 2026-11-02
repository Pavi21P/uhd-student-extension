import { parseExecutorDispatch, type ExecutorDispatch } from '../shared/enrollment-dispatch';
import { assertExecutorAdapter, parseExecutorPolicy, parseExecutorSender, type ExecutorContext } from '../shared/enrollment-ownership';
import { parsePortalTarget } from '../shared/enrollment-records';
import { ContractFault, id, integer } from '../shared/validation';

/** Inject only trusted browser APIs. This module installs no listeners and requests no permissions. */
export interface EnrollmentBrowserApi {
  runtime: { readonly id: string };
  webNavigation: { getFrame(details: { tabId: number; frameId: number; documentId: string }):
    Promise<chrome.webNavigation.GetFrameResultDetails | null | undefined> };
  tabs: { sendMessage(tabId: number, message: ExecutorDispatch['command'],
    options: { frameId: number; documentId: string }): Promise<unknown> };
}
const maxWaitMs = 10_000;
const transportError = () => new ContractFault('TRANSPORT_ERROR', 'Browser communication is unconfirmed. Do not resend; recovery is required.');
function deny(): never { throw new ContractFault('UNAUTHORIZED_SENDER', 'The browser document no longer matches the reviewed target.'); }
function pageOrigin(url: string): string {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return deny(); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) deny();
  return parsed.origin;
}
async function browserCall<T>(call: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(transportError()), timeoutMs);
      try { void Promise.resolve(call()).then(resolve, () => reject(transportError())); }
      catch { reject(transportError()); }
    });
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

/** Standalone adapter for future worker wiring. Durable deduplication belongs to the repository. */
export function createEnrollmentBrowserTransport(api: EnrollmentBrowserApi, policyInput: unknown, clock: () => number = Date.now) {
  const extensionId = id(api.runtime.id, 'browser.extensionId');
  const policy = parseExecutorPolicy(policyInput);
  if (policy.extensionId !== extensionId) deny();
  const now = () => integer(clock(), -8_640_000_000_000_000, 8_640_000_000_000_000, 'nowEpochMs');
  const checkSender = (value: unknown): ExecutorContext['sender'] => {
    const sender = parseExecutorSender(value);
    if (sender.extensionId !== extensionId || sender.documentLifecycle !== 'active' || pageOrigin(sender.url) !== sender.origin) deny();
    return sender;
  };
  async function observe(targetInput: unknown, timeoutMs: number): Promise<ExecutorContext['sender']> {
    const target = parsePortalTarget(targetInput);
    assertExecutorAdapter(target, policy);
    const frame = await browserCall(() => api.webNavigation.getFrame({ tabId: target.tabId,
      frameId: target.frameId, documentId: target.documentId }), timeoutMs);
    if (!frame || frame.errorOccurred !== false || frame.documentId !== target.documentId) deny();
    const sender = checkSender({ extensionId, tabId: target.tabId, frameId: target.frameId,
      documentId: frame.documentId, documentLifecycle: frame.documentLifecycle, url: frame.url, origin: pageOrigin(frame.url) });
    if (sender.origin !== target.origin) deny();
    return sender;
  }
  return {
    /** Metadata comes from getFrame, never from a page-supplied observation. */
    observeTarget(target: unknown) { return observe(target, maxWaitMs); },
    /** Pass the real runtime.onMessage sender argument separately from its untrusted payload. */
    senderFromMessage(sender: chrome.runtime.MessageSender): ExecutorContext['sender'] {
      if (sender.nativeApplication !== undefined) deny();
      return checkSender({ extensionId: sender.id, tabId: sender.tab?.id, frameId: sender.frameId,
        documentId: sender.documentId, origin: sender.origin, url: sender.url, documentLifecycle: sender.documentLifecycle });
    },
    async send(input: unknown): Promise<void> {
      const dispatch = parseExecutorDispatch(input);
      const startedAt = now();
      const budget = () => {
        const time = now();
        if (time < startedAt || time >= dispatch.expiresAt
            || (dispatch.command.type === 'portal.execute' && time < dispatch.command.payload.targetEpochMs)) {
          throw new ContractFault('INVALID_TIME', 'The browser dispatch window is no longer valid. Do not resend.');
        }
        return Math.min(maxWaitMs, dispatch.expiresAt - time);
      };
      await observe(dispatch.target, budget());
      const timeoutMs = budget();
      // Exact-document delivery prevents falling back to a new page in a reused frame.
      // A sendMessage response is untrusted data, not browser-authenticated reply metadata.
      await browserCall(() => api.tabs.sendMessage(dispatch.target.tabId, dispatch.command,
        { frameId: dispatch.target.frameId, documentId: dispatch.target.documentId }), timeoutMs);
    },
  };
}
