import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createEnrollmentBrowserTransport, type EnrollmentBrowserApi } from '../../src/background/enrollment-transport';
import { executorDispatch, parseExecutorDispatch } from '../../src/shared/enrollment-dispatch';
import { payloadForJob } from '../../src/shared/enrollment-activation';
import { EnrollmentJobRepository } from '../../src/storage/enrollment-repository';
import { executorContext, executorJob, executorPolicy, executorTime as time } from '../fixtures/enrollment-executor';

const fault = (code: string) => expect.objectContaining({ detail: expect.objectContaining({ code }) });
function setup() {
  const job = executorJob(); const context = executorContext(job, 2);
  const dispatch = executorDispatch(job, { pending: context.pending, createdAt: time, state: 'pending' });
  const frame: chrome.webNavigation.GetFrameResultDetails = { url: context.sender.url,
    documentId: context.sender.documentId, documentLifecycle: 'active', errorOccurred: false,
    frameType: 'sub_frame', parentFrameId: 0 };
  const getFrame = vi.fn<EnrollmentBrowserApi['webNavigation']['getFrame']>(async () => structuredClone(frame));
  const sendMessage = vi.fn<EnrollmentBrowserApi['tabs']['sendMessage']>(async () => ({ ignored: 'untrusted response' }));
  const api = { runtime: { id: context.sender.extensionId }, webNavigation: { getFrame }, tabs: { sendMessage } };
  const clock = vi.fn(() => time);
  const transport = createEnrollmentBrowserTransport(api, executorPolicy(), clock);
  const sender: chrome.runtime.MessageSender = { id: context.sender.extensionId,
    tab: { id: job.review.target.tabId } as chrome.tabs.Tab, frameId: context.sender.frameId,
    documentId: context.sender.documentId, origin: context.sender.origin, url: context.sender.url, documentLifecycle: 'active' };
  return { job, context, dispatch, frame, getFrame, sendMessage, api, clock, transport, sender };
}
afterEach(() => vi.useRealTimers());

describe('browser-derived enrollment identity', () => {
  it('matches the installed Chrome API signatures', () => {
    expectTypeOf<typeof chrome>().toMatchTypeOf<EnrollmentBrowserApi>();
  });
  it('looks up the exact tab/frame/document and derives detached metadata', async () => {
    const { transport, job, context, getFrame } = setup();
    const result = await transport.observeTarget(job.review.target);
    expect(result).toEqual(context.sender);
    expect(getFrame).toHaveBeenCalledWith({ tabId: job.review.target.tabId, frameId: 3, documentId: job.review.target.documentId });
    result.documentId = 'changed'; expect(job.review.target.documentId).not.toBe('changed');
  });
  it.each([
    undefined, null, { documentId: 'replacement' }, { documentLifecycle: 'cached' },
    { documentLifecycle: 'prerender' }, { documentLifecycle: 'pending_deletion' },
    { errorOccurred: true }, { errorOccurred: undefined }, { url: 'http://portal.invalid/cart' },
    { url: 'about:blank' }, { url: 'https://elsewhere.invalid/cart' }, { url: 'https://user:secret@portal.invalid/cart' },
  ])('rejects unavailable, navigated or unsuitable frames %#', async patch => {
    const { transport, getFrame, frame, dispatch, sendMessage } = setup();
    getFrame.mockResolvedValue(patch == null ? patch : { ...frame, ...patch } as chrome.webNavigation.GetFrameResultDetails);
    await expect(transport.send(dispatch)).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it('does not call browser APIs for an unconfigured adapter', async () => {
    const { api, dispatch, getFrame, sendMessage, clock } = setup();
    const transport = createEnrollmentBrowserTransport(api, { ...executorPolicy(), adapters: [] }, clock);
    await expect(transport.send(dispatch)).rejects.toEqual(fault('PORTAL_UNSUPPORTED'));
    expect(getFrame).not.toHaveBeenCalled(); expect(sendMessage).not.toHaveBeenCalled();
  });
  it('rejects a configuration belonging to another extension', () => {
    const { api } = setup();
    expect(() => createEnrollmentBrowserTransport(api, { ...executorPolicy(), extensionId: 'other' })).toThrow();
  });
  it('projects only the real message sender fields without substituting the top-level tab URL', () => {
    const { transport, sender, context } = setup(); sender.tab!.url = 'https://parent.invalid'; sender.tab!.title = 'Private title';
    const result = transport.senderFromMessage(sender);
    expect(result).toEqual(context.sender); expect(JSON.stringify(result)).not.toContain('Private title');
    sender.documentId = 'changed'; expect(result.documentId).toBe(context.sender.documentId);
  });
  it.each([
    { id: 'another-extension' }, { id: undefined }, { tab: undefined }, { frameId: undefined },
    { documentId: undefined }, { origin: undefined }, { origin: 'null' }, { url: 'about:blank' },
    { origin: 'https://elsewhere.invalid' }, { documentLifecycle: 'cached' }, { nativeApplication: 'native-app' },
  ])('rejects incomplete or incompatible browser message metadata %#', patch => {
    const { transport, sender } = setup();
    expect(() => transport.senderFromMessage({ ...sender, ...patch } as unknown as chrome.runtime.MessageSender)).toThrow();
  });
});

describe('bounded exact-document sends', () => {
  it('rechecks the document, sends once with both identity options and ignores the untrusted return body', async () => {
    const { transport, dispatch, getFrame, sendMessage } = setup();
    await expect(transport.send(dispatch)).resolves.toBeUndefined();
    expect(getFrame).toHaveBeenCalledTimes(1); expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(dispatch.target.tabId, dispatch.command,
      { frameId: dispatch.target.frameId, documentId: dispatch.target.documentId });
  });
  it('does not reuse an earlier successful document observation after navigation', async () => {
    const { transport, job, getFrame, frame, dispatch, sendMessage } = setup();
    await transport.observeTarget(job.review.target);
    getFrame.mockResolvedValue({ ...frame, documentId: 'new-document' });
    await expect(transport.send(dispatch)).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it.each([time - 1, time + 2_000, time + 3_000])('does not send outside its initial window %s', async now => {
    const { transport, dispatch, clock, getFrame, sendMessage } = setup(); clock.mockReturnValue(now);
    await expect(transport.send(dispatch)).rejects.toEqual(fault('INVALID_TIME'));
    expect(getFrame).not.toHaveBeenCalled(); expect(sendMessage).not.toHaveBeenCalled();
  });
  it.each([time - 1, time + 2_000])('rechecks the clock after frame lookup %s', async now => {
    const { transport, dispatch, clock, getFrame, frame, sendMessage } = setup();
    getFrame.mockImplementation(async () => { clock.mockReturnValue(now); return frame; });
    await expect(transport.send(dispatch)).rejects.toEqual(fault('INVALID_TIME'));
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it('detaches the queued dispatch from caller mutations while looking up the document', async () => {
    const { transport, dispatch, getFrame, frame, sendMessage } = setup();
    let release!: (value: typeof frame) => void;
    getFrame.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const original = structuredClone(dispatch); const pending = transport.send(dispatch);
    dispatch.target.documentId = 'changed';
    if (dispatch.command.type === 'portal.execute') dispatch.command.payload.selectedSectionIds.push('changed');
    release(frame); await pending;
    expect(sendMessage).toHaveBeenCalledWith(original.target.tabId, original.command,
      { frameId: original.target.frameId, documentId: original.target.documentId });
  });
  it.each(['lookup', 'send'] as const)('normalizes %s rejection without retry or raw error disclosure', async stage => {
    const { transport, dispatch, getFrame, sendMessage } = setup();
    (stage === 'lookup' ? getFrame : sendMessage).mockRejectedValue(new Error('Synthetic private session detail'));
    await expect(transport.send(dispatch)).rejects.toEqual(fault('TRANSPORT_ERROR'));
    expect(getFrame).toHaveBeenCalledTimes(1); expect(sendMessage).toHaveBeenCalledTimes(stage === 'send' ? 1 : 0);
  });
  it('times out lookup at the dispatch deadline and never sends after a late lookup', async () => {
    vi.useFakeTimers(); const { transport, dispatch, getFrame, frame, sendMessage } = setup();
    let release!: (value: typeof frame) => void;
    getFrame.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const result = expect(transport.send(dispatch)).rejects.toEqual(fault('TRANSPORT_ERROR'));
    await vi.advanceTimersByTimeAsync(2_000); await result;
    release(frame); await Promise.resolve(); expect(sendMessage).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds an observation without a dispatch deadline to ten seconds', async () => {
    vi.useFakeTimers(); const { transport, job, getFrame } = setup(); getFrame.mockImplementation(() => new Promise(() => undefined));
    const result = expect(transport.observeTarget(job.review.target)).rejects.toEqual(fault('TRANSPORT_ERROR'));
    await vi.advanceTimersByTimeAsync(10_000); await result; expect(vi.getTimerCount()).toBe(0);
  });
  it('times out a send without interpreting a late response or sending again', async () => {
    vi.useFakeTimers(); const { transport, dispatch, sendMessage } = setup(); let finish!: (value: unknown) => void;
    sendMessage.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const result = expect(transport.send(dispatch)).rejects.toEqual(fault('TRANSPORT_ERROR'));
    await vi.advanceTimersByTimeAsync(2_000); await result; finish({ success: true });
    await Promise.resolve(); expect(sendMessage).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it('supports cancellation until its own deadline with exact document targeting', async () => {
    const { transport, job, clock, sendMessage } = setup(); const context = executorContext(job, 2, 'portal.cancel');
    const dispatch = executorDispatch(job, { pending: context.pending, createdAt: time, state: 'pending' });
    clock.mockReturnValue(time + 3_000); await transport.send(dispatch);
    expect(sendMessage.mock.calls[0]![1].type).toBe('portal.cancel');
  });
});

describe('dispatch input boundary', () => {
  it.each([
    { type: 'portal.inspect' }, { protocolVersion: 2 }, { requestId: '' }, { arbitraryScript: 'rejected' },
  ])('rejects unsupported command envelope %#', async patch => {
    const { transport, dispatch, getFrame, sendMessage } = setup();
    await expect(transport.send({ ...dispatch, command: { ...dispatch.command, ...patch } })).rejects.toThrow();
    expect(getFrame).not.toHaveBeenCalled(); expect(sendMessage).not.toHaveBeenCalled();
  });
  it.each([
    { selectedSectionIds: [] }, { selectedSectionIds: ['same', 'same'] }, { deselectSectionIds: ['same', 'same'] },
    { executionToken: '' }, { targetEpochMs: time + 2_000 }, { expiresAt: time + 1 }, { extra: true },
  ])('rejects unsafe command payload %#', patch => {
    const { dispatch } = setup();
    expect(() => parseExecutorDispatch({ ...dispatch, command: { ...dispatch.command,
      payload: { ...dispatch.command.payload, ...patch } } })).toThrow();
  });
  it('rejects overlapping selection, excessive IDs and accessor properties without invoking them', () => {
    const { dispatch } = setup(); if (dispatch.command.type !== 'portal.execute') throw new Error('Expected execute');
    dispatch.command.payload.deselectSectionIds = [...dispatch.command.payload.selectedSectionIds];
    expect(() => parseExecutorDispatch(dispatch)).toThrow(); dispatch.command.payload.deselectSectionIds = [];
    dispatch.command.payload.selectedSectionIds = Array.from({ length: 251 }, (_, index) => String(index));
    expect(() => parseExecutorDispatch(dispatch)).toThrow();
    let called = false; Object.defineProperty(dispatch, 'target', { enumerable: true, get() { called = true; return {}; } });
    expect(() => parseExecutorDispatch(dispatch)).toThrow(); expect(called).toBe(false);
  });
});

describe('repository and transport integration with synthetic browser APIs', () => {
  it('persists one dispatch, re-observes the browser document, and does not trust a successful-looking response', async () => {
    const { job, context, transport, clock, sendMessage, getFrame } = setup(); let saved: unknown;
    const repo = new EnrollmentJobRepository({ async get() { return structuredClone(saved); }, async set(_key, value) { saved = structuredClone(value); } }, clock, executorPolicy());
    await repo.recover(); await repo.createForActivation('activation', payloadForJob(job), job);
    await repo.transition(job.id, 0, { type: 'begin-preflight' }); await repo.transition(job.id, 1, { type: 'begin-execution' });
    const { requestId, command, expiresAt } = context.pending;
    await repo.registerExecutorRequest(job.id, 2, { requestId, command, expiresAt });
    const metadata = await transport.observeTarget(job.review.target);
    await repo.dispatchExecutorRequest(requestId, 2, metadata, transport.send);
    expect(sendMessage).toHaveBeenCalledTimes(1); expect(getFrame).toHaveBeenCalledTimes(2);
    expect(await repo.readAll()).toMatchObject([{ state: 'executing', submittedAt: null }]);
    await expect(repo.dispatchExecutorRequest(requestId, 2, metadata, transport.send)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
