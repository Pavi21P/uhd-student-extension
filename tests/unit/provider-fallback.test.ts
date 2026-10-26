import { afterEach, describe, expect, it, vi } from 'vitest';
import { rmpProvider } from '../../src/adapters/rmp/provider';
import { createMessageHandler } from '../../src/background/handler';
import { createFoundationClient } from '../../src/shared/client';
import { parseFoundationRequest, parseFoundationResponse } from '../../src/shared/foundation-rpc';
import { FoundationRepository } from '../../src/storage/repository';
import type { RequestFor } from '../../src/shared/messages';
const request: RequestFor<'professor.lookup'> = { protocolVersion: 1, requestId: 'lookup-example', type: 'professor.lookup', payload: { instructorName: 'Alex Example' } };
const sender = { id: 'own-extension', url: 'chrome-extension://own-extension/dashboard.html#professors', frameId: 0, documentLifecycle: 'active' };
const unavailable = { status: 'unavailable', reason: 'provider-unconfigured' };
function setup(ready = true) {
  const fetch = vi.fn(() => { throw Error('Unexpected network request'); }); vi.stubGlobal('fetch', fetch);
  const storage = { get: vi.fn(async () => undefined), set: vi.fn(async () => {}) };
  const handle = createMessageHandler(new FoundationRepository(storage), 'own-extension', Promise.resolve(ready));
  return { fetch, storage, handle, client: createFoundationClient(input => handle(input, sender)) };
}
afterEach(() => vi.unstubAllGlobals());
describe('10B link-only provider boundary', () => {
  it('normalizes Unicode and optional department without creating a match', async () => {
    const { client, fetch, storage } = setup();
    const payload = { instructorName: '  Jose\u0301  Anne-Marie ', department: ' Computer  Science ' };
    expect(parseFoundationRequest({ ...request, payload })).toMatchObject({ payload: { instructorName: 'Jos\u00e9 Anne-Marie', department: 'Computer Science' } });
    expect(await client('professor.lookup', payload)).toMatchObject({ ok: true, type: 'professor.lookup', data: unavailable });
    expect(fetch).not.toHaveBeenCalled(); expect(storage.get).not.toHaveBeenCalled(); expect(storage.set).not.toHaveBeenCalled();
  });
  it('omits a blank optional department and returns fresh unavailable records without caching', () => {
    const { fetch, storage } = setup();
    expect(parseFoundationRequest({ ...request, payload: { ...request.payload, department: '  ' } })).toMatchObject({ payload: request.payload });
    const first = rmpProvider.lookup(request.payload); first.reason = 'provider-unconfigured';
    expect(rmpProvider.lookup(request.payload)).not.toBe(first);
    expect(rmpProvider.mode).toBe('link-only'); expect(fetch).not.toHaveBeenCalled(); expect(storage.set).not.toHaveBeenCalled();
  });
  it.each([
    null, {}, { instructorName: '' }, { instructorName: '   ' }, { instructorName: 'Staff' }, { instructorName: 'TBA' },
    { instructorName: 42 }, { instructorName: 'x'.repeat(201) }, { instructorName: 'Name\0' },
    { ...request.payload, department: null }, { ...request.payload, department: 'x'.repeat(201) }, { ...request.payload, department: 'Dept\0' },
    { ...request.payload, profileUrl: 'https://evil.example/' }, { ...request.payload, schoolId: 'guessed' },
    { ...request.payload, selector: '#submit' }, { ...request.payload, snapshot: { overall: 5 } },
  ])('rejects malformed or overreaching lookup payload %# before any side effects', async payload => {
    const { handle, fetch, storage } = setup();
    expect(await handle({ ...request, payload }, sender)).toMatchObject({ requestId: request.requestId, ok: false, error: { code: 'INVALID_INPUT' } });
    expect(() => rmpProvider.lookup(payload)).toThrow();
    expect(fetch).not.toHaveBeenCalled(); expect(storage.get).not.toHaveBeenCalled(); expect(storage.set).not.toHaveBeenCalled();
  });
  it('rejects accessor payloads without invoking them', async () => {
    const { handle } = setup(); const getter = vi.fn(() => 'Private input');
    const payload = Object.defineProperty({}, 'instructorName', { enumerable: true, get: getter });
    expect(await handle({ ...request, payload }, sender)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(getter).not.toHaveBeenCalled();
  });
  it.each([
    { ...sender, id: 'other' }, { ...sender, url: 'chrome-extension://own-extension/popup.html' },
    { ...sender, url: 'https://portal.example.invalid/' }, { ...sender, frameId: 1 },
  ])('preserves sender authentication for lookup %#', async identity => {
    const { handle, fetch, storage } = setup();
    expect(await handle(request, identity)).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED_SENDER' } });
    expect(fetch).not.toHaveBeenCalled(); expect(storage.get).not.toHaveBeenCalled(); expect(storage.set).not.toHaveBeenCalled();
  });
  it('keeps the storage-initialization failure gate and association guard', async () => {
    expect(await setup(false).handle(request, sender)).toMatchObject({ ok: false, error: { code: 'STORAGE_ERROR' } });
    const { handle, storage } = setup();
    expect(await handle({ ...request, type: 'professor.associate', payload: { ...request.payload, profileUrl: 'https://www.ratemyprofessors.com/professor/12345' } }, sender)).toMatchObject({ ok: false, error: { code: 'FEATURE_UNAVAILABLE' } });
    expect(storage.set).not.toHaveBeenCalled();
  });
  it('rejects invalid outgoing input before transport', async () => {
    const transport = vi.fn();
    await expect(createFoundationClient(transport)('professor.lookup', { instructorName: '' })).rejects.toMatchObject({ detail: { code: 'INVALID_INPUT' } });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'available', snapshot: { overall: 5, provenance: 'synthetic-fixture' } },
    { status: 'unavailable', reason: 'provider-unconfigured', snapshot: {} },
    { status: 'unavailable', reason: 'network' }, { status: 'no-match' }, { status: 'unavailable' }, null,
  ])('rejects unexpected provider responses instead of accepting fixture/live claims %#', data => {
    expect(() => parseFoundationResponse({ protocolVersion: 1, requestId: request.requestId, type: request.type, ok: true, data }, request)).toThrow();
  });
  it('correlates lookup replies and rejects forged envelopes', () => {
    const reply = { protocolVersion: 1, requestId: request.requestId, type: request.type, ok: true, data: unavailable };
    expect(parseFoundationResponse(reply, request)).toEqual(reply);
    for (const patch of [{ requestId: 'other' }, { type: 'settings.read' }, { protocolVersion: 2 }, { error: { code: 'NOT_FOUND' } }]) expect(() => parseFoundationResponse({ ...reply, ...patch }, request)).toThrow();
  });
});