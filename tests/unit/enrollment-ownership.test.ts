import { describe, expect, it, vi } from 'vitest';
import { EnrollmentJobRepository, enrollmentJobsKey } from '../../src/storage/enrollment-repository';
import { parseExecutorSender, parseExecutorPolicy, type ExecutorContext } from '../../src/shared/enrollment-ownership';
import { payloadForJob } from '../../src/shared/enrollment-activation';
import type { KeyValueStorage } from '../../src/storage/repository';
import { executorReply, executorContext, executorJob, executorPolicy, executorTime as time } from '../fixtures/enrollment-executor';

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
    const { repo, storage, context } = await setup();
    const result = await repo.acceptExecutorReply(context.sender, executorReply(context));
    expect(result).toMatchObject({ changed: true, job: { state: 'unknown', revision: 3, submittedAt: time + 100 } });
    expect(storage.value).toMatchObject({ jobs: [{ revision: 3, submittedAt: time + 100 }] });
    expect(storage.writes).toBe(6);
  });
  it('accepts a correlated no-dispatch acknowledgment only for a cancellation request', async () => {
    const { repo, storage, job } = await setup();
    const context = executorContext(job, 2, 'portal.cancel');
    const result = await repo.acceptExecutorReply(context.sender, executorReply(context));
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
    ['reply job mismatch', (c: ExecutorContext) => { c.reply.jobId = 'different-job'; }],
    ['reply token mismatch', (c: ExecutorContext) => { c.reply.executionToken = 'wrong-token'; }],
    ['request mismatch', (c: ExecutorContext) => { c.reply.requestId = 'different-request'; }],
    ['wrong reply kind', (c: ExecutorContext) => { c.reply.type = 'portal.cancelled'; }],
  ] as const)('rejects %s without changing the legitimate job', async (_label, mutate) => {
    const { repo, storage, context } = await setup();
    const before = structuredClone(storage.value);
    mutate(context);
    await expect(repo.acceptExecutorReply(context.sender, executorReply(context))).rejects.toEqual(fault(_label === 'request mismatch' ? 'REQUEST_ID_REUSED' : 'UNAUTHORIZED_SENDER'));
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
    const { repo, context, clock } = await setup();
    clock.mockReturnValue(time + 9_999);
    const result = await repo.acceptExecutorReply(context.sender, executorReply(context));
    expect(result.job).toMatchObject({ state: 'unknown', submittedAt: time + 100 });
  });
  it('rejects a report exactly at its pending-request deadline using the clock inside the queue', async () => {
    const { repo, storage, context, clock } = await setup();
    const pending = repo.acceptExecutorReply(context.sender, executorReply(context));
    clock.mockReturnValue(context.pending.expiresAt);
    await expect(pending).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    expect(storage.writes).toBe(5);
  });
  it('snapshots policy and context before caller mutation', async () => {
    const policy = executorPolicy();
    const { repo, storage, context } = await setup(policy);
    policy.extensionId = 'mutated';
    policy.adapters[0]!.origin = 'https://other.example.invalid';
    const reply = executorReply(context);
    const pending = repo.acceptExecutorReply(context.sender, reply);
    context.sender.documentId = 'mutated';
    reply.payload.executionToken = 'mutated';
    expect((await pending).job.submittedAt).toBe(time + 100);
    expect(storage.writes).toBe(6);
  });
  it('rejects competing callbacks against one saved revision', async () => {
    const { repo, storage, context } = await setup();
    const results = await Promise.allSettled([
      repo.acceptExecutorReply(context.sender, executorReply(context)),
      repo.acceptExecutorReply(context.sender, executorReply(context)),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'REQUEST_ID_REUSED' } } });
    expect(storage.writes).toBe(6);
  });
  it('rechecks the persisted target rather than accepting an older matching context', async () => {
    const { repo, storage, context } = await setup();
    const saved = await repo.readAll();
    saved[0]!.review.target.documentId = 'new-document';
    storage.value = { ...(storage.value as object), jobs: saved };
    await expect(repo.acceptExecutorReply(context.sender, executorReply(context))).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(storage.writes).toBe(5);
  });
  it('cannot cancel after a racing submission, even with the same authorized document', async () => {
    const { repo, job, context } = await setup();
    await repo.acceptExecutorReply(context.sender, executorReply(context));
    const cancellation = executorContext(job, 2, 'portal.cancel');
    await expect(repo.acceptExecutorReply(cancellation.sender, executorReply(cancellation))).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(() => repo.acceptExecutorReply(cancellation.sender, { ...executorReply(cancellation), expectedRevision: 3 })).toThrow();
    await expect(repo.acceptExecutorReply(cancellation.sender, executorReply(cancellation))).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it('blocks executor reports on the generic background path and other events on the executor path', async () => {
    const { repo, job, context } = await setup();
    expect(() => repo.transition(job.id, 2, { type: 'submission-observed', submittedAt: time + 100 })).toThrow('Executor reports require');
    expect(() => repo.transition(job.id, 2, { type: 'cancellation-confirmed' })).toThrow('Executor reports require');
    expect(() => repo.acceptExecutorReply(context.sender, { type: 'begin-execution' })).toThrow();
  });
  it('requires explicit recovery after an uncertain authorized write and never re-arms the job', async () => {
    const { repo, storage, context } = await setup();
    storage.failAfterWrite = true;
    await expect(repo.acceptExecutorReply(context.sender, executorReply(context))).rejects.toEqual(fault('STORAGE_ERROR'));
    await expect(repo.acceptExecutorReply(context.sender, executorReply(context))).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.failAfterWrite = false;
    expect(await repo.recover()).toMatchObject([{ state: 'unknown', submittedAt: time + 100 }]);
    expect(storage.writes).toBe(6);
  });
  it('does not include tokens, URL or identity values in rejection errors', async () => {
    const { repo, job, context } = await setup();
    context.reply.executionToken = 'synthetic-private-mismatch';
    try {
      await repo.acceptExecutorReply(context.sender, executorReply(context));
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

describe('executor sender and policy validation', () => {
  it('detaches browser metadata and preserves explicit policy', () => {
    const sender = executorContext(executorJob(), 2).sender;
    const parsed = parseExecutorSender(sender);
    parsed.documentId = 'mutated';
    expect(sender.documentId).not.toBe('mutated');
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
  it.each([{ documentId: undefined }, { tabId: -1 }, { origin: 'null' }, { extra: true }])(
    'rejects malformed sender metadata %#', patch => {
      expect(() => parseExecutorSender({ ...executorContext(executorJob(), 2).sender, ...patch })).toThrow();
    },
  );
  it('rejects metadata accessors without invoking them', () => {
    const getter = vi.fn(() => 'synthetic');
    const sender = executorContext(executorJob(), 2).sender;
    Object.defineProperty(sender, 'documentId', { enumerable: true, get: getter });
    expect(() => parseExecutorSender(sender)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
});
