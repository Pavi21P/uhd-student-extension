import { describe, expect, it, vi } from 'vitest';
import { EnrollmentJobRepository, enrollmentJobsKey } from '../../src/storage/enrollment-repository';
import { parseExecutorRequests, type ExecutorRequestRecord } from '../../src/shared/enrollment-requests';
import { payloadForJob } from '../../src/shared/enrollment-activation';
import type { EnrollmentJob } from '../../src/shared/domain';
import type { KeyValueStorage } from '../../src/storage/repository';
import { executorReply, executorContext, executorJob, executorPolicy, executorTime as time } from '../fixtures/enrollment-executor';

class Storage implements KeyValueStorage {
  value: unknown;
  writes = 0;
  fail: 'before' | 'after' | null = null;
  gate?: () => Promise<void>;
  async get(key: string) { expect(key).toBe(enrollmentJobsKey); return structuredClone(this.value); }
  async set(key: string, value: unknown) {
    expect(key).toBe(enrollmentJobsKey); this.writes++;
    await this.gate?.();
    if (this.fail === 'before') throw new Error('Private synthetic failure');
    this.value = structuredClone(value);
    if (this.fail === 'after') throw new Error('Private synthetic acknowledgment loss');
  }
}
const fault = (code: string) => expect.objectContaining({ detail: expect.objectContaining({ code }) });
async function setup() {
  const storage = new Storage();
  const clock = vi.fn(() => time);
  const repo = new EnrollmentJobRepository(storage, clock, executorPolicy());
  const job = executorJob();
  await repo.recover();
  await repo.createForActivation('activation', payloadForJob(job), job);
  await repo.transition(job.id, 0, { type: 'begin-preflight' });
  await repo.transition(job.id, 1, { type: 'begin-execution' });
  const context = executorContext(job, 2);
  const registration = (command: 'portal.execute' | 'portal.cancel' = 'portal.execute') => {
    const { requestId, expiresAt } = executorContext(job, 2, command).pending;
    return { requestId, command, expiresAt };
  };
  const register = (command: 'portal.execute' | 'portal.cancel' = 'portal.execute') =>
    repo.registerExecutorRequest(job.id, 2, registration(command));
  const report = () => repo.acceptExecutorReply(context.sender, executorReply(context));
  return { storage, clock, repo, job, context, registration, register, report };
}
function snapshot(storage: Storage) {
  return storage.value as { schemaVersion: 3; jobs: EnrollmentJob[]; executorRequests: ExecutorRequestRecord[] };
}

describe('durable outstanding executor requests', () => {
  it('rejects a self-consistent caller-authored pending request that was never registered', async () => {
    const { report, storage, clock } = await setup();
    clock.mockReturnValue(time + 100);
    const before = structuredClone(storage.value);
    await expect(report()).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(storage.value).toEqual(before);
    expect(storage.writes).toBe(3);
  });
  it('derives authority fields from the saved job and awaits registration persistence', async () => {
    const { storage, register, context } = await setup();
    let release!: () => void;
    storage.gate = () => new Promise<void>(resolve => { release = resolve; });
    let acknowledged = false;
    const registration = register().then(value => { acknowledged = true; return value; });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(snapshot(storage).executorRequests).toEqual([]);
    expect(acknowledged).toBe(false);
    release();
    const pending = await registration;
    expect(pending).toEqual(context.pending);
    expect(snapshot(storage).executorRequests).toEqual([{ pending, createdAt: time, state: 'pending' }]);
    pending.target.documentId = 'mutated';
    expect(snapshot(storage).executorRequests[0]!.pending.target.documentId).toBe(context.pending.target.documentId);
  });
  it('persists consumption and the changed job together, before acknowledging a reply', async () => {
    const { storage, register, report, clock } = await setup();
    await register();
    clock.mockReturnValue(time + 100);
    let release!: () => void;
    storage.gate = () => new Promise<void>(resolve => { release = resolve; });
    let acknowledged = false;
    const reply = report().then(value => { acknowledged = true; return value; });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(snapshot(storage).jobs[0]!.submittedAt).toBeNull();
    expect(snapshot(storage).executorRequests[0]!.state).toBe('pending');
    expect(acknowledged).toBe(false);
    release();
    expect((await reply).job.submittedAt).toBe(time + 100);
    expect(snapshot(storage)).toMatchObject({ jobs: [{ revision: 3, submittedAt: time + 100 }],
      executorRequests: [{ state: 'consumed' }] });
    expect(storage.writes).toBe(5);
  });
  it('accepts only one of concurrent replies and rejects caller-authored revisions', async () => {
    const { register, report, storage, repo, context, clock } = await setup();
    await register(); clock.mockReturnValue(time + 100);
    const replies = await Promise.allSettled([report(), report()]);
    expect(replies[0].status).toBe('fulfilled');
    expect(replies[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'REQUEST_ID_REUSED' } } });
    expect(() => repo.acceptExecutorReply(context.sender, { ...executorReply(context), expectedRevision: 3 })).toThrow();
    await expect(repo.acceptExecutorReply(context.sender, executorReply(context))).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(storage.writes).toBe(5);
  });
  it.each(['same ID', 'different ID'] as const)('rejects reissuing the execute command with %s', async mode => {
    const { repo, job, registration, register, storage } = await setup();
    await register();
    const input = registration();
    if (mode === 'different ID') input.requestId = 'replacement-request';
    await expect(repo.registerExecutorRequest(job.id, 2, input)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(storage.writes).toBe(4);
  });
  it('serializes duplicate registration attempts into one saved request', async () => {
    const { register, storage } = await setup();
    const results = await Promise.allSettled([register(), register()]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(storage.writes).toBe(4);
  });
  it('snapshots registration before queued caller mutation', async () => {
    const { repo, job, registration, context } = await setup();
    const input = registration();
    const pending = repo.registerExecutorRequest(job.id, 2, input);
    input.requestId = 'mutated'; input.expiresAt = time - 1;
    expect(await pending).toEqual(context.pending);
  });
  it('requires a registered execute command before a cancellation request', async () => {
    const { register, storage } = await setup();
    await expect(register('portal.cancel')).rejects.toEqual(fault('INVALID_INPUT'));
    expect(storage.writes).toBe(3);
  });
  it('consumes cancellation and abandons the competing execute request atomically', async () => {
    const { register, repo, job, storage, report, clock } = await setup();
    await register(); await register('portal.cancel');
    const context = executorContext(job, 2, 'portal.cancel');
    await repo.acceptExecutorReply(context.sender, executorReply(context));
    expect(snapshot(storage)).toMatchObject({ jobs: [{ state: 'cancelled' }],
      executorRequests: [{ state: 'abandoned' }, { state: 'consumed' }] });
    clock.mockReturnValue(time + 100);
    await expect(report()).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(storage.writes).toBe(6);
  });
  it('invalidates outstanding requests when the background stops the owning job', async () => {
    const { register, repo, job, storage, report, clock } = await setup();
    await register(); await register('portal.cancel');
    await repo.transition(job.id, 2, { type: 'invalidate' });
    expect(snapshot(storage).executorRequests.map(entry => entry.state)).toEqual(['abandoned', 'abandoned']);
    clock.mockReturnValue(time + 100);
    await expect(report()).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it('does not consume a legitimate request on an unauthorized reply', async () => {
    const { register, report, context, storage, clock } = await setup();
    await register(); clock.mockReturnValue(time + 100);
    context.sender.documentId = 'other-document';
    const before = structuredClone(storage.value);
    await expect(report()).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    expect(storage.value).toEqual(before);
  });
  it.each(['before', 'after'] as const)('blocks after uncertain registration %s persistence; recovery never reissues', async fail => {
    const { storage, register, repo, report, clock, job, registration } = await setup();
    storage.fail = fail;
    await expect(register()).rejects.toEqual(fault('STORAGE_ERROR'));
    await expect(report()).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.fail = null; clock.mockReturnValue(time + 100);
    expect(await repo.recover()).toMatchObject([{ state: 'unknown' }]);
    expect(snapshot(storage).executorRequests.map(entry => entry.state)).toEqual(fail === 'after' ? ['abandoned'] : []);
    await expect(repo.registerExecutorRequest(job.id, 3, registration())).rejects.toEqual(fault(fail === 'after' ? 'REQUEST_ID_REUSED' : 'INVALID_INPUT'));
  });
  it.each(['before', 'after'] as const)('stops on reply write failure %s persistence without making the request reusable', async fail => {
    const { storage, register, repo, report, clock } = await setup();
    await register(); clock.mockReturnValue(time + 100); storage.fail = fail;
    await expect(report()).rejects.toEqual(fault('STORAGE_ERROR'));
    await expect(report()).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.fail = null;
    expect(await repo.recover()).toMatchObject([{ state: 'unknown', submittedAt: fail === 'after' ? time + 100 : null }]);
    expect(snapshot(storage).executorRequests[0]!.state).toBe(fail === 'after' ? 'consumed' : 'abandoned');
    await expect(report()).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it('abandons all outstanding requests on a new repository recovery and preserves tombstones', async () => {
    const { storage, register, job, registration } = await setup();
    await register(); await register('portal.cancel');
    const fresh = new EnrollmentJobRepository(storage, () => time + 100, executorPolicy());
    await expect(fresh.registerExecutorRequest(job.id, 2, registration())).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(await fresh.recover()).toMatchObject([{ state: 'unknown', revision: 3 }]);
    expect(snapshot(storage).executorRequests.map(entry => entry.state)).toEqual(['abandoned', 'abandoned']);
    const writes = storage.writes;
    await fresh.recover();
    expect(storage.writes).toBe(writes);
    await expect(fresh.registerExecutorRequest(job.id, 3, registration())).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it.each([time - 1, time + 2_000, time + 10_000])('rejects execution registration at invalid time %s', async now => {
    const { register, clock, storage } = await setup();
    clock.mockReturnValue(now);
    await expect(register()).rejects.toEqual(fault('INVALID_TIME'));
    expect(storage.writes).toBe(3);
  });
  it('rejects a registration deadline exactly at now and a backwards clock between requests', async () => {
    const { register, registration, repo, job, clock } = await setup();
    await expect(repo.registerExecutorRequest(job.id, 2, { ...registration(), expiresAt: time })).rejects.toEqual(fault('INVALID_TIME'));
    clock.mockReturnValue(time + 100); await register();
    clock.mockReturnValue(time + 50);
    await expect(register('portal.cancel')).rejects.toEqual(fault('INVALID_TIME'));
  });
  it('does not extend an expired pending request using caller-supplied metadata', async () => {
    const { repo, register, report, context, storage, clock } = await setup();
    await register(); clock.mockReturnValue(context.pending.expiresAt);
    expect(() => repo.acceptExecutorReply(context.sender, { ...executorReply(context),
      pending: { ...context.pending, expiresAt: context.pending.expiresAt + 10_000 } })).toThrow();
    await expect(report()).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    expect(storage.writes).toBe(4);
  });
  it('rejects stale job revisions and missing jobs before registration', async () => {
    const { repo, job, registration, storage } = await setup();
    await expect(repo.registerExecutorRequest(job.id, 1, registration())).rejects.toEqual(fault('REVISION_CONFLICT'));
    await expect(repo.registerExecutorRequest('missing', 2, registration())).rejects.toEqual(fault('NOT_FOUND'));
    expect(storage.writes).toBe(3);
  });
  it.each([{}, { requestId: 'id', command: 'portal.inspect', expiresAt: time + 1 },
    { requestId: 'id', command: 'portal.execute', expiresAt: NaN },
    { requestId: 'id', command: 'portal.execute', expiresAt: time + 1, executionToken: 'forged' },
  ])('rejects malformed registration input without writes %#', async value => {
    const { repo, job, storage } = await setup();
    expect(() => repo.registerExecutorRequest(job.id, 2, value)).toThrow();
    expect(storage.writes).toBe(3);
  });
});

describe('executor registry migration and record integrity', () => {
  it.each(['executing', 'cancelled'] as const)('migrates v2 %s jobs without inventing outstanding requests', async state => {
    const { storage, repo, job } = await setup();
    if (state === 'cancelled') {
      await repo.transition(job.id, 2, { type: 'invalidate' });
      const stored = snapshot(storage); stored.jobs[0]!.state = 'cancelled';
    }
    const { executorRequests: _requests, ...old } = snapshot(storage);
    storage.value = { ...old, schemaVersion: 2 };
    const before = structuredClone(storage.value);
    const fresh = new EnrollmentJobRepository(storage, () => time);
    const writes = storage.writes;
    const jobs = await fresh.recover();
    expect(jobs[0]!.state).toBe(state === 'executing' ? 'unknown' : 'cancelled');
    expect(storage.value).toMatchObject({ schemaVersion: 3, executorRequests: [],
      activations: (before as { activations: unknown }).activations });
    expect(storage.writes).toBe(writes + 1);
    await fresh.recover(); expect(storage.writes).toBe(writes + 1);
  });
  it('requires explicit recovery if v2 data appears while initialized', async () => {
    const { storage, repo } = await setup();
    const { executorRequests: _requests, ...old } = snapshot(storage);
    storage.value = { ...old, schemaVersion: 2 };
    await expect(repo.readAll()).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(storage.value).toEqual({ ...old, schemaVersion: 2 });
  });
  it.each([
    ['missing registry', (rows: ExecutorRequestRecord[]): undefined => { rows.length = 0; return undefined; }],
    ['duplicate ID', (rows: ExecutorRequestRecord[]) => [...rows, structuredClone(rows[0])]],
    ['duplicate command', (rows: ExecutorRequestRecord[]) => [...rows, { ...structuredClone(rows[0]!), pending: { ...rows[0]!.pending, requestId: 'other' } }]],
    ['orphan', (rows: ExecutorRequestRecord[]) => { rows[0]!.pending.jobId = 'missing'; return rows; }],
    ['token mismatch', (rows: ExecutorRequestRecord[]) => { rows[0]!.pending.executionToken = 'forged'; return rows; }],
    ['target mismatch', (rows: ExecutorRequestRecord[]) => { rows[0]!.pending.target.documentId = 'other'; return rows; }],
    ['future revision', (rows: ExecutorRequestRecord[]) => { rows[0]!.pending.expectedRevision++; return rows; }],
    ['stale pending revision', (rows: ExecutorRequestRecord[]) => { rows[0]!.pending.expectedRevision--; return rows; }],
    ['consumed without transition', (rows: ExecutorRequestRecord[]) => { rows[0]!.state = 'consumed'; return rows; }],
    ['invalid deadline', (rows: ExecutorRequestRecord[]) => { rows[0]!.pending.expiresAt = rows[0]!.createdAt; return rows; }],
    ['pre-target creation', (rows: ExecutorRequestRecord[]) => { rows[0]!.createdAt = time - 1; return rows; }],
    ['out-of-window creation', (rows: ExecutorRequestRecord[]) => { rows[0]!.createdAt = time + 2_000; return rows; }],
    ['cancel without execute', (rows: ExecutorRequestRecord[]) => { rows[0]!.pending.command = 'portal.cancel'; return rows; }],
  ] as const)('preserves corrupt storage: %s', async (_name, mutate) => {
    const { storage, register } = await setup(); await register();
    const original = { ...snapshot(storage), executorRequests: mutate(structuredClone(snapshot(storage).executorRequests)) };
    storage.value = original;
    const writes = storage.writes;
    await expect(new EnrollmentJobRepository(storage, () => time).recover()).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(storage.value).toEqual(original); expect(storage.writes).toBe(writes);
  });
  it('rejects pending requests for terminal jobs and malformed/accessor records', async () => {
    const { storage, register } = await setup(); await register();
    const { jobs, executorRequests } = snapshot(storage);
    expect(() => parseExecutorRequests(executorRequests, [{ ...jobs[0]!, state: 'cancelled' }])).toThrow();
    const getter = vi.fn(() => 'pending');
    Object.defineProperty(executorRequests[0], 'state', { enumerable: true, get: getter });
    expect(() => parseExecutorRequests(executorRequests, jobs)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
});
