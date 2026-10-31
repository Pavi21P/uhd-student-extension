import { describe, expect, it, vi } from 'vitest';
import { parseExecutorReply } from '../../src/shared/enrollment-replies';
import { EnrollmentJobRepository, enrollmentJobsKey } from '../../src/storage/enrollment-repository';
import { payloadForJob } from '../../src/shared/enrollment-activation';
import { errorCodes } from '../../src/shared/foundation-rpc';
import type { KeyValueStorage } from '../../src/storage/repository';
import { executorContext, executorJob, executorPolicy, executorReply, executorTime as time } from '../fixtures/enrollment-executor';

class Storage implements KeyValueStorage {
  value: unknown;
  writes = 0;
  fail = false;
  async get(key: string) { expect(key).toBe(enrollmentJobsKey); return structuredClone(this.value); }
  async set(key: string, value: unknown) {
    expect(key).toBe(enrollmentJobsKey); this.writes++; this.value = structuredClone(value);
    if (this.fail) throw new Error('Synthetic private storage failure');
  }
}
const fault = (code: string) => expect.objectContaining({ detail: expect.objectContaining({ code }) });
function completed() { return executorReply(executorContext(executorJob(), 2)); }
function errorReply(jobId: string | undefined = executorJob().id) {
  return { protocolVersion: 1, requestId: completed().requestId, type: 'portal.error',
    payload: { ...(jobId === undefined ? {} : { jobId }),
      error: { code: 'TRANSPORT_ERROR', message: 'Synthetic private detail', field: 'syntheticField' } } };
}
async function setup(command: 'portal.execute' | 'portal.cancel' = 'portal.execute') {
  const storage = new Storage();
  const clock = vi.fn(() => time);
  const repo = new EnrollmentJobRepository(storage, clock, executorPolicy());
  const job = executorJob();
  await repo.recover();
  await repo.createForActivation('activation', payloadForJob(job), job);
  await repo.transition(job.id, 0, { type: 'begin-preflight' });
  await repo.transition(job.id, 1, { type: 'begin-execution' });
  const context = executorContext(job, 2, command);
  for (const kind of command === 'portal.cancel' ? ['portal.execute', 'portal.cancel'] as const : ['portal.execute'] as const) {
    const { requestId, expiresAt } = executorContext(job, 2, kind).pending;
    await repo.registerExecutorRequest(job.id, 2, { requestId, command: kind, expiresAt });
  }
  clock.mockReturnValue(time + 100);
  return { repo, job, storage, clock, context, reply: executorReply(context) };
}

describe('complete executor reply schema', () => {
  it('returns a detached complete reply', () => {
    const value = { ...completed(), payload: { ...completed().payload,
      outcomes: [{ sectionId: 'sample-section-a', status: 'enrolled' }] } };
    const parsed = parseExecutorReply(value);
    expect(parsed).toEqual(value);
    if (parsed.type !== 'portal.completed') throw new Error('Fixture');
    parsed.payload.outcomes[0]!.sectionId = 'mutated';
    expect(value.payload.outcomes[0]!.sectionId).toBe('sample-section-a');
  });
  it.each([
    null, {}, { ...completed(), extra: true }, { ...completed(), protocolVersion: 2 },
    { ...completed(), type: 'portal.inspected' }, { ...completed(), type: 'submission-observed' },
    { ...completed(), payload: { jobId: 'job', executionToken: 'token' } },
    { ...completed(), payload: { ...completed().payload, submittedAt: NaN } },
    { ...completed(), payload: { ...completed().payload, submittedAt: 1.5 } },
    { ...completed(), payload: { ...completed().payload, submittedAt: 8_640_000_000_000_001 } },
    { ...completed(), payload: { ...completed().payload, event: { type: 'cancellation-confirmed' } } },
    { ...completed(), payload: { ...completed().payload, outcomes: [{ sectionId: 'id', status: 'success' }] } },
    { ...completed(), payload: { ...completed().payload, outcomes: [{ sectionId: 'id', status: 'unknown', reason: 'made-up' }] } },
    { ...completed(), payload: { ...completed().payload, outcomes: [{ sectionId: 'id', status: 'unknown', message: '<html>' }] } },
    { ...completed(), payload: { ...completed().payload, outcomes: [{ sectionId: 'id', status: 'unknown', message: 'x'.repeat(301) }] } },
    { ...completed(), payload: { ...completed().payload, outcomes: [{ sectionId: 'id', status: 'unknown' }, { sectionId: 'id', status: 'unknown' }] } },
    { ...completed(), payload: { ...completed().payload, submittedAt: null, outcomes: [{ sectionId: 'id', status: 'rejected' }] } },
    { ...completed(), payload: { ...completed().payload, outcomes: Array.from({ length: 251 }, (_, i) => ({ sectionId: String(i), status: 'unknown' })) } },
    { protocolVersion: 1, requestId: 'id', type: 'portal.cancelled', payload: { jobId: 'id', executionToken: 'token', submittedAt: null } },
    { ...errorReply(), payload: { error: { code: 'INVENTED', message: 'Synthetic' } } },
    { ...errorReply(), payload: { error: { code: 'TRANSPORT_ERROR', message: '<script>' } } },
    { ...errorReply(), payload: { error: { code: 'TRANSPORT_ERROR', message: 'x'.repeat(301) } } },
    { ...errorReply(), payload: { error: { code: 'TRANSPORT_ERROR', message: 'Synthetic', field: 'x'.repeat(101) } } },
    { ...errorReply(), payload: { ...errorReply().payload, executionToken: 'unexpected' } },
  ])('rejects malformed or unsupported full reply %#', value => {
    expect(() => parseExecutorReply(value)).toThrow();
  });
  it('validates every agreed error code and preserves an optional job ID only when supplied', () => {
    for (const code of errorCodes) {
      const value = { ...errorReply(), payload: { error: { code, message: 'Synthetic' } } };
      expect(parseExecutorReply(value)).toEqual(value);
    }
    expect(parseExecutorReply(errorReply())).toEqual(errorReply());
  });
  it('rejects nested accessors and inherited payloads without evaluating getters', () => {
    const getter = vi.fn(() => []);
    const reply = completed();
    Object.defineProperty(reply.payload, 'outcomes', { enumerable: true, get: getter });
    expect(() => parseExecutorReply(reply)).toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(() => parseExecutorReply({ ...completed(), payload: Object.create(completed().payload) })).toThrow();
  });
});

describe('reply-derived persisted job updates', () => {
  it('records submittedAt and finalizes complete normalized evidence from the same message', async () => {
    const { repo, context, reply, storage } = await setup();
    const message = { ...reply, payload: { ...reply.payload, outcomes: [
      { sectionId: 'sample-section-a', status: 'enrolled', message: 'Synthetic private text' },
    ] } };
    const result = await repo.acceptExecutorReply(context.sender, message);
    expect(result.job).toMatchObject({ state: 'succeeded', revision: 3, submittedAt: time + 100,
      outcomes: [{ sectionId: 'sample-section-a', status: 'enrolled' }] });
    expect(JSON.stringify(storage.value)).not.toContain('Synthetic private text');
    expect(storage.value).toMatchObject({ executorRequests: [{ state: 'consumed' }] });
  });
  it('stops a completed reply with no observed dispatch as unknown, never as safely cancelled', async () => {
    const { repo, context, reply, storage } = await setup();
    const result = await repo.acceptExecutorReply(context.sender, { ...reply, payload: { ...reply.payload, submittedAt: null } });
    expect(result.job).toMatchObject({ state: 'unknown', submittedAt: null, revision: 3, outcomes: [] });
    expect(storage.value).toMatchObject({ executorRequests: [{ state: 'consumed' }] });
  });
  it.each(['portal.execute', 'portal.cancel'] as const)('stops an authenticated %s error and does not store portal error text', async command => {
    const { repo, context, storage } = await setup(command);
    const reply = { ...errorReply(), requestId: context.pending.requestId };
    const result = await repo.acceptExecutorReply(context.sender, reply);
    expect(result.job).toMatchObject({ state: 'unknown', submittedAt: null });
    expect(JSON.stringify(storage.value)).not.toContain('Synthetic private detail');
    expect(JSON.stringify(storage.value)).not.toContain('syntheticField');
    await expect(repo.acceptExecutorReply(context.sender, reply)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it('binds an error without job/token fields through saved request and browser source', async () => {
    const { repo, context } = await setup();
    const reply = { ...errorReply(), payload: { error: { code: 'TRANSPORT_ERROR', message: 'Synthetic' } } };
    expect((await repo.acceptExecutorReply(context.sender, reply)).job.state).toBe('unknown');
  });
  it.each(['job', 'request', 'source'] as const)('rejects mismatched error %s without consuming the request', async mismatch => {
    const { repo, context, storage } = await setup();
    const reply = errorReply();
    if (mismatch === 'job') reply.payload.jobId = 'another-job';
    if (mismatch === 'request') reply.requestId = 'another-request';
    if (mismatch === 'source') context.sender.documentId = 'another-document';
    const before = structuredClone(storage.value);
    await expect(repo.acceptExecutorReply(context.sender, reply)).rejects.toEqual(fault(mismatch === 'request' ? 'REQUEST_ID_REUSED' : 'UNAUTHORIZED_SENDER'));
    expect(storage.value).toEqual(before);
  });
  it('cannot accept a cancellation reply against an execution request', async () => {
    const { repo, context, reply, storage } = await setup();
    const before = structuredClone(storage.value);
    const cancellation = { ...reply, type: 'portal.cancelled',
      payload: { jobId: reply.payload.jobId, executionToken: reply.payload.executionToken } };
    await expect(repo.acceptExecutorReply(context.sender, cancellation)).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    expect(storage.value).toEqual(before);
  });
  it('rejects unselected outcomes and future dispatch without mutating storage', async () => {
    const { repo, context, reply, storage } = await setup();
    const before = structuredClone(storage.value);
    for (const patch of [
      { outcomes: [{ sectionId: 'unselected-section', status: 'enrolled' }] },
      { submittedAt: time + 101 },
    ]) {
      await expect(repo.acceptExecutorReply(context.sender, { ...reply, payload: { ...reply.payload, ...patch } })).rejects.toEqual(fault('INVALID_INPUT'));
      expect(storage.value).toEqual(before);
    }
  });
  it('does not persist outcome evidence when a backwards clock prevents recording dispatch', async () => {
    const { repo, context, reply, clock } = await setup();
    clock.mockReturnValue(time - 1);
    const result = await repo.acceptExecutorReply(context.sender, { ...reply, payload: { ...reply.payload,
      outcomes: [{ sectionId: 'sample-section-a', status: 'enrolled' }] } });
    expect(result.job).toMatchObject({ state: 'unknown', submittedAt: null, outcomes: [] });
  });
  it('retains early-dispatch evidence as unknown without finalizing enrollment', async () => {
    const { repo, context, reply } = await setup();
    const result = await repo.acceptExecutorReply(context.sender, { ...reply, payload: { ...reply.payload, submittedAt: time - 1,
      outcomes: [{ sectionId: 'sample-section-a', status: 'enrolled' }] } });
    expect(result.job).toMatchObject({ state: 'unknown', submittedAt: time - 1,
      outcomes: [{ sectionId: 'sample-section-a', status: 'enrolled' }] });
  });
  it('detaches the full reply before queued mutation', async () => {
    const { repo, context, reply } = await setup();
    const pending = repo.acceptExecutorReply(context.sender, reply);
    reply.payload.submittedAt = time + 1_000_000;
    reply.payload.executionToken = 'mutated';
    expect((await pending).job.submittedAt).toBe(time + 100);
  });
  it('rejects malformed input before any read/write and never invokes its getter', async () => {
    const { repo, context, storage, reply } = await setup();
    const before = structuredClone(storage.value);
    const getter = vi.fn(() => time);
    Object.defineProperty(reply.payload, 'submittedAt', { enumerable: true, get: getter });
    expect(() => repo.acceptExecutorReply(context.sender, reply)).toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(storage.value).toEqual(before);
  });
  it('keeps uncertain persistence stopped and preserves accepted normalized evidence on recovery', async () => {
    const { repo, context, reply, storage } = await setup();
    storage.fail = true;
    const completed = { ...reply, payload: { ...reply.payload,
      outcomes: [{ sectionId: 'sample-section-a', status: 'waitlisted', reason: 'full' }] } };
    await expect(repo.acceptExecutorReply(context.sender, completed)).rejects.toEqual(fault('STORAGE_ERROR'));
    await expect(repo.acceptExecutorReply(context.sender, completed)).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.fail = false;
    expect(await repo.recover()).toMatchObject([{ state: 'partial', submittedAt: time + 100,
      outcomes: [{ sectionId: 'sample-section-a', status: 'waitlisted', reason: 'full' }] }]);
    await expect(repo.acceptExecutorReply(context.sender, completed)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
});
