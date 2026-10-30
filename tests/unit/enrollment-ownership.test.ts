import { describe, expect, it, vi } from 'vitest';
import { EnrollmentJobRepository, enrollmentJobsKey } from '../../src/storage/enrollment-repository';
import { parseExecutorContext, parseExecutorPolicy, type ExecutorContext } from '../../src/shared/enrollment-ownership';
import { payloadForJob } from '../../src/shared/enrollment-activation';
import type { KeyValueStorage } from '../../src/storage/repository';
import { executorContext, executorJob, executorPolicy, executorTime as time } from '../fixtures/enrollment-executor';

class Storage implements KeyValueStorage {
  value: unknown;
  writes = 0;
  failAfterWrite = false;
  async get(key: string) { expect(key).toBe(enrollmentJobsKey); return structuredClone(this.value); }
  async set(key: string, value: unknown) {
    expect(key).toBe(enrollmentJobsKey); this.writes++;
    this.value = structuredClone(value);
    if (this.failAfterWrite) throw new Error('Synthetic private failure');
  }
}
const fault = (code: string) => expect.objectContaining({ detail: expect.objectContaining({ code }) });
const observed = { type: 'submission-observed', submittedAt: time + 100 };
async function setup(policy: unknown = executorPolicy()) {
  const storage = new Storage();
  const clock = vi.fn(() => time);
  const repo = new EnrollmentJobRepository(storage, clock, policy);
  await repo.recover();
  const job = executorJob();
  await repo.createForActivation('synthetic-activation', payloadForJob(job), job);
  await repo.transition(job.id, 0, { type: 'begin-preflight' });
  await repo.transition(job.id, 1, { type: 'begin-execution' });
  for (const command of ['portal.execute', 'portal.cancel'] as const) {
    const { requestId, expiresAt } = executorContext(job, 2, command).pending;
    await repo.registerExecutorRequest(job.id, 2, { requestId, command, expiresAt });
  }
  clock.mockReturnValue(time + 100);
  return { repo, storage, clock, job, context: executorContext(job, 2) };
}

describe('executor ownership at the repository boundary', () => {
  it('accepts a matching active document including a nonzero frame and persists observed dispatch', async () => {
    const { repo, storage, job, context } = await setup();
    const result = await repo.transitionFromExecutor(job.id, 2, observed, context);
    expect(result).toMatchObject({ changed: true, job: { state: 'executing', revision: 3, submittedAt: time + 100 } });
    expect(storage.value).toMatchObject({ jobs: [{ revision: 3, submittedAt: time + 100 }] });
    expect(storage.writes).toBe(6);
  });
  it('accepts a correlated no-dispatch acknowledgment only for a cancellation request', async () => {
    const { repo, storage, job } = await setup();
    const context = executorContext(job, 2, 'portal.cancel');
    const result = await repo.transitionFromExecutor(job.id, 2, { type: 'cancellation-confirmed' }, context);
    expect(result.job).toMatchObject({ state: 'cancelled', revision: 3, submittedAt: null });
    expect(storage.writes).toBe(6);
  });
  it.each([
    ['different extension', (c: ExecutorContext) => { c.sender.extensionId = 'different-extension'; }],
    ['different tab', (c: ExecutorContext) => { c.sender.tabId++; }],
    ['different frame', (c: ExecutorContext) => { c.sender.frameId++; }],
    ['replacement document', (c: ExecutorContext) => { c.sender.documentId = 'replacement-document'; }],
    ['different sender origin', (c: ExecutorContext) => { c.sender.origin = 'https://other.example.invalid'; }],
    ['different URL origin', (c: ExecutorContext) => { c.sender.url = 'https://other.example.invalid/cart'; }],
    ['credential-bearing URL', (c: ExecutorContext) => { c.sender.url = 'https://synthetic:synthetic@portal.example.invalid/cart'; }],
    ['non-HTTPS URL', (c: ExecutorContext) => { c.sender.url = 'http://portal.example.invalid/cart'; }],
    ['opaque URL', (c: ExecutorContext) => { c.sender.url = 'about:blank'; }],
    ['invalid URL', (c: ExecutorContext) => { c.sender.url = 'not a URL'; }],
    ['cached lifecycle', (c: ExecutorContext) => { c.sender.documentLifecycle = 'cached'; }],
    ['prerender lifecycle', (c: ExecutorContext) => { c.sender.documentLifecycle = 'prerender'; }],
    ['deleting lifecycle', (c: ExecutorContext) => { c.sender.documentLifecycle = 'pending_deletion'; }],
    ['empty lifecycle', (c: ExecutorContext) => { c.sender.documentLifecycle = ''; }],
    ['pending tab mismatch', (c: ExecutorContext) => { c.pending.target.tabId++; }],
    ['pending frame mismatch', (c: ExecutorContext) => { c.pending.target.frameId++; }],
    ['pending document mismatch', (c: ExecutorContext) => { c.pending.target.documentId = 'another-document'; }],
    ['pending origin mismatch', (c: ExecutorContext) => { c.pending.target.origin = 'https://other.example.invalid'; }],
    ['pending adapter mismatch', (c: ExecutorContext) => { c.pending.target.adapterVersion = 'different-adapter'; }],
    ['pending job mismatch', (c: ExecutorContext) => { c.pending.jobId = 'different-job'; }],
    ['reply job mismatch', (c: ExecutorContext) => { c.reply.jobId = 'different-job'; }],
    ['pending token mismatch', (c: ExecutorContext) => { c.pending.executionToken = 'wrong-token'; }],
    ['reply token mismatch', (c: ExecutorContext) => { c.reply.executionToken = 'wrong-token'; }],
    ['request mismatch', (c: ExecutorContext) => { c.reply.requestId = 'different-request'; }],
    ['pending revision mismatch', (c: ExecutorContext) => { c.pending.expectedRevision++; }],
    ['wrong command', (c: ExecutorContext) => { c.pending.command = 'portal.cancel'; }],
    ['wrong reply kind', (c: ExecutorContext) => { c.reply.type = 'portal.cancelled'; }],
  ] as const)('rejects %s without changing the legitimate job', async (_label, mutate) => {
    const { repo, storage, job, context } = await setup();
    const before = structuredClone(storage.value);
    mutate(context);
    await expect(repo.transitionFromExecutor(job.id, 2, observed, context)).rejects.toEqual(fault(_label === 'request mismatch' ? 'REQUEST_ID_REUSED' : 'UNAUTHORIZED_SENDER'));
    expect(storage.value).toEqual(before);
    expect(storage.writes).toBe(5);
  });
  it.each([undefined, { extensionId: 'synthetic-extension', adapters: [] },
    { extensionId: 'synthetic-extension', adapters: [{ origin: 'https://other.example.invalid', adapterVersion: 'fixture-only' }] },
    { extensionId: 'synthetic-extension', adapters: [{ origin: 'https://portal.example.invalid', adapterVersion: 'different-adapter' }] },
  ])('has no implicit live portal or adapter authorization %#', async policy => {
    // Build without the setup helper's default when testing undefined configuration.
    const storage = new Storage();
    const repo = new EnrollmentJobRepository(storage, () => time + 100, policy);
    await repo.recover();
    const job = executorJob();
    await repo.createForActivation('synthetic-activation', payloadForJob(job), job);
    await repo.transition(job.id, 0, { type: 'begin-preflight' });
    await repo.transition(job.id, 1, { type: 'begin-execution' });
    await expect(repo.registerExecutorRequest(job.id, 2, { requestId: 'request', command: 'portal.execute', expiresAt: time + 10_000 })).rejects.toEqual(fault('PORTAL_UNSUPPORTED'));
    expect(storage.writes).toBe(3);
  });
  it('uses the pending-request deadline, allowing a late result from an in-window dispatch', async () => {
    const { repo, job, context, clock } = await setup();
    clock.mockReturnValue(time + 9_999);
    const result = await repo.transitionFromExecutor(job.id, 2, observed, context);
    expect(result.job).toMatchObject({ state: 'executing', submittedAt: time + 100 });
  });
  it('rejects a report exactly at its pending-request deadline using the clock inside the queue', async () => {
    const { repo, storage, job, context, clock } = await setup();
    const pending = repo.transitionFromExecutor(job.id, 2, observed, context);
    clock.mockReturnValue(context.pending.expiresAt);
    await expect(pending).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    expect(storage.writes).toBe(5);
  });
  it('snapshots policy and context before caller mutation', async () => {
    const policy = executorPolicy();
    const { repo, storage, job, context } = await setup(policy);
    policy.extensionId = 'mutated';
    policy.adapters[0]!.origin = 'https://other.example.invalid';
    const pending = repo.transitionFromExecutor(job.id, 2, observed, context);
    context.sender.documentId = 'mutated';
    context.pending.target.documentId = 'mutated';
    context.reply.executionToken = 'mutated';
    expect((await pending).job.submittedAt).toBe(time + 100);
    expect(storage.writes).toBe(6);
  });
  it('rejects competing callbacks against one saved revision', async () => {
    const { repo, storage, job, context } = await setup();
    const results = await Promise.allSettled([
      repo.transitionFromExecutor(job.id, 2, observed, context),
      repo.transitionFromExecutor(job.id, 2, observed, context),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'REQUEST_ID_REUSED' } } });
    expect(storage.writes).toBe(6);
  });
  it('rechecks the persisted target rather than accepting an older matching context', async () => {
    const { repo, storage, job, context } = await setup();
    const saved = await repo.readAll();
    saved[0]!.review.target.documentId = 'new-document';
    storage.value = { ...(storage.value as object), jobs: saved };
    await expect(repo.transitionFromExecutor(job.id, 2, observed, context)).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(storage.writes).toBe(5);
  });
  it('cannot cancel after a racing submission, even with the same authorized document', async () => {
    const { repo, job, context } = await setup();
    await repo.transitionFromExecutor(job.id, 2, observed, context);
    const cancellation = executorContext(job, 2, 'portal.cancel');
    await expect(repo.transitionFromExecutor(job.id, 2, { type: 'cancellation-confirmed' }, cancellation)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    cancellation.pending.expectedRevision = 3;
    await expect(repo.transitionFromExecutor(job.id, 3, { type: 'cancellation-confirmed' }, cancellation)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it('blocks executor reports on the generic background path and other events on the executor path', async () => {
    const { repo, job, context } = await setup();
    expect(() => repo.transition(job.id, 2, observed)).toThrow('Executor reports require');
    expect(() => repo.transition(job.id, 2, { type: 'cancellation-confirmed' })).toThrow('Executor reports require');
    expect(() => repo.transitionFromExecutor(job.id, 2, { type: 'begin-execution' }, context)).toThrow();
  });
  it('requires explicit recovery after an uncertain authorized write and never re-arms the job', async () => {
    const { repo, storage, job, context } = await setup();
    storage.failAfterWrite = true;
    await expect(repo.transitionFromExecutor(job.id, 2, observed, context)).rejects.toEqual(fault('STORAGE_ERROR'));
    await expect(repo.transitionFromExecutor(job.id, 2, observed, context)).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.failAfterWrite = false;
    expect(await repo.recover()).toMatchObject([{ state: 'unknown', submittedAt: time + 100 }]);
    expect(storage.writes).toBe(7);
  });
  it('does not include tokens, URL or identity values in rejection errors', async () => {
    const { repo, job, context } = await setup();
    context.reply.executionToken = 'synthetic-private-mismatch';
    try {
      await repo.transitionFromExecutor(job.id, 2, observed, context);
      throw new Error('Expected rejection');
    } catch (error) {
      const message = String(error);
      expect(message).not.toContain(job.executionToken);
      expect(message).not.toContain(context.reply.executionToken);
      expect(message).not.toContain(context.sender.url);
      expect(message).toContain('does not match');
    }
  });
});

describe('executor boundary input validation', () => {
  it('detaches a parsed context and preserves a matching policy without inventing defaults', () => {
    const context = executorContext(executorJob(), 2);
    const parsed = parseExecutorContext(context);
    expect(parsed).toEqual(context);
    parsed.pending.target.documentId = 'changed';
    expect(context.pending.target.documentId).not.toBe('changed');
    expect(parseExecutorPolicy(executorPolicy())).toEqual(executorPolicy());
  });
  it.each([
    {}, null, { extensionId: 'synthetic-extension', adapters: [{}] },
    { ...executorPolicy(), adapters: [executorPolicy().adapters[0], executorPolicy().adapters[0]] },
    { ...executorPolicy(), adapters: [{ origin: 'http://portal.example.invalid', adapterVersion: 'fixture-only' }] },
    { ...executorPolicy(), extra: true },
  ])('rejects malformed policy %#', value => {
    expect(() => parseExecutorPolicy(value)).toThrow();
  });
  it.each([
    { sender: {} }, { pending: {} }, { reply: {} }, { extra: true },
    { sender: { ...executorContext(executorJob(), 2).sender, documentId: undefined } },
    { sender: { ...executorContext(executorJob(), 2).sender, tabId: -1 } },
    { sender: { ...executorContext(executorJob(), 2).sender, origin: 'null' } },
    { reply: { ...executorContext(executorJob(), 2).reply, protocolVersion: 2 } },
    { pending: { ...executorContext(executorJob(), 2).pending, expiresAt: NaN } },
  ])('rejects missing or malformed correlation fields %#', patch => {
    expect(() => parseExecutorContext({ ...executorContext(executorJob(), 2), ...patch })).toThrow();
  });
  it('rejects payload accessors without invoking them', () => {
    const getter = vi.fn(() => 'synthetic');
    const context = executorContext(executorJob(), 2);
    Object.defineProperty(context.reply, 'executionToken', { enumerable: true, get: getter });
    expect(() => parseExecutorContext(context)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
});
