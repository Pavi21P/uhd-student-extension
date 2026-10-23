import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMessageHandler, type SenderIdentity } from '../../src/background/handler';
import { FoundationRepository } from '../../src/storage/repository';
import { createFoundationClient } from '../../src/shared/client';
import { parseFoundationResponse } from '../../src/shared/foundation-rpc';
import { blankSchedule, activateNow } from '../fixtures/contracts.examples';
import type { RequestFor } from '../../src/shared/messages';

const sender: SenderIdentity = { id: 'own-extension', url: 'chrome-extension://own-extension/dashboard.html', origin: 'chrome-extension://own-extension', frameId: 0, documentLifecycle: 'active' };
const read: RequestFor<'schedule.read'> = { protocolVersion: 1, requestId: 'read-1', type: 'schedule.read', payload: { scheduleId: blankSchedule.id } };
const save: RequestFor<'schedule.save'> = { protocolVersion: 1, requestId: 'save-1', type: 'schedule.save', payload: { expectedRevision: null, schedule: blankSchedule } };
function setup(ready = true) {
  const values = new Map<string, unknown>();
  const storage = { get: vi.fn(async (key: string) => structuredClone(values.get(key))), set: vi.fn(async (key: string, value: unknown) => { values.set(key, structuredClone(value)); }) };
  return { storage, handle: createMessageHandler(new FoundationRepository(storage), 'own-extension', Promise.resolve(ready)) };
}
afterEach(() => vi.useRealTimers());

describe('authenticated runtime messages', () => {
  it('saves and reads through the typed client and verifies correlation', async () => {
    const { handle } = setup();
    const client = createFoundationClient(request => handle(request, sender));
    const saved = await client('schedule.save', save.payload);
    expect(saved).toMatchObject({ ok: true, type: 'schedule.save', data: blankSchedule });
    expect(await client('schedule.read', read.payload)).toMatchObject({ ok: true, data: blankSchedule });
    expect(await client('schedule.save', save.payload)).toMatchObject({ ok: false, error: { code: 'REVISION_CONFLICT' } });
  });
  it.each([
    {}, { ...sender, id: 'foreign-extension' }, { ...sender, url: 'https://portal.example.invalid/dashboard.html' },
    { ...sender, url: 'chrome-extension://own-extension/popup.html' }, { ...sender, url: sender.url + '?pretend=dashboard' },
    { ...sender, url: 'chrome-extension://own-extension/dashboard.html.evil' }, { ...sender, frameId: 3 },
    { ...sender, origin: 'https://portal.example.invalid' }, { ...sender, documentLifecycle: 'prerender' },
  ])('rejects spoofed or unsupported browser senders %#', async identity => {
    const { handle, storage } = setup();
    expect(await handle(save, identity)).toMatchObject({ requestId: save.requestId, ok: false, error: { code: 'UNAUTHORIZED_SENDER' } });
    expect(storage.get).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });
  it('allows dashboard hash navigation using browser sender metadata', async () => {
    expect(await setup().handle(save, { ...sender, url: sender.url + '#timetable' })).toMatchObject({ ok: true });
  });
  it.each([
    null, {}, { ...save, protocolVersion: 2 }, { ...save, sender },
    { ...save, payload: { ...save.payload, expectedRevision: -1 } },
    { ...read, payload: { scheduleId: blankSchedule.id, selector: '#submit' } },
    { ...read, type: 'portal.eval' }, { ...read, requestId: '' },
    { protocolVersion: 1, requestId: 'settings', type: 'settings.read', payload: { extra: true } },
  ])('rejects malformed input before touching storage %#', async input => {
    const { handle, storage } = setup();
    expect(await handle(input, sender)).toMatchObject({ protocolVersion: 1, ok: false });
    expect(storage.get).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });
  it.each(['schedule.import', 'professor.lookup', 'professor.associate', 'enrollment.review', 'enrollment.activate', 'enrollment.cancel', 'enrollment.read'])('fails closed for unimplemented %s', async type => {
    const { handle, storage } = setup();
    expect(await handle({ ...activateNow, type }, sender)).toMatchObject({ ok: false, error: { code: 'FEATURE_UNAVAILABLE' } });
    expect(storage.set).not.toHaveBeenCalled();
  });
  it('does not access storage when restricting storage access fails', async () => {
    const { handle, storage } = setup(false);
    expect(await handle(save, sender)).toMatchObject({ ok: false, error: { code: 'STORAGE_ERROR' } });
    expect(storage.get).not.toHaveBeenCalled();
  });
  it('returns null correlation only for an unusable envelope', async () => {
    expect(await setup().handle(null, sender)).toMatchObject({ requestId: null, type: null, error: { code: 'INVALID_INPUT' } });
    expect(await setup().handle({ ...read, protocolVersion: 2 }, sender)).toMatchObject({ requestId: 'read-1', type: 'schedule.read', error: { code: 'UNSUPPORTED_VERSION' } });
  });
});

describe('client reply boundary', () => {
  const response = { protocolVersion: 1, requestId: read.requestId, type: read.type, ok: true, data: blankSchedule };
  it.each([
    { ...response, requestId: 'another-operation' }, { ...response, type: 'settings.read' },
    { ...response, data: { ...blankSchedule, id: 'another-schedule' } }, { ...response, data: { ...blankSchedule, courses: null } },
    { ...response, error: { code: 'NOT_FOUND', message: '' } }, { ...response, ok: 'true' },
    { ...response, protocolVersion: 2 },
  ])('rejects mismatched or invalid responses %#', input => expect(() => parseFoundationResponse(input, read)).toThrow());
  it('times out without retrying and does not confuse timeout with failed persistence', async () => {
    vi.useFakeTimers();
    const transport = vi.fn(() => new Promise<unknown>(() => {}));
    const pending = createFoundationClient(transport)('schedule.save', save.payload);
    const assertion = expect(pending).rejects.toMatchObject({ detail: { code: 'TRANSPORT_ERROR' }, message: expect.stringContaining('may have completed') });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(transport).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('sanitizes transport failure and rejects invalid outgoing payloads before transport', async () => {
    const transport = vi.fn(async () => { throw new Error('private transport details'); });
    const client = createFoundationClient(transport);
    await expect(client('schedule.read', read.payload)).rejects.toMatchObject({ detail: { code: 'TRANSPORT_ERROR' } });
    expect(transport).toHaveBeenCalledTimes(1);
    await expect(client('schedule.read', { scheduleId: '' })).rejects.toMatchObject({ detail: { code: 'INVALID_INPUT' } });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
