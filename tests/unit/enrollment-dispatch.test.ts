import { describe, expect, it, vi } from 'vitest';
import { EnrollmentJobRepository, enrollmentJobsKey } from '../../src/storage/enrollment-repository';
import { payloadForJob } from '../../src/shared/enrollment-activation';
import type { DispatchIntent, ExecutorDispatch } from '../../src/shared/enrollment-dispatch';
import type { EnrollmentJob } from '../../src/shared/domain';
import type { ExecutorRequestRecord } from '../../src/shared/enrollment-requests';
import type { KeyValueStorage } from '../../src/storage/repository';
import { executorContext, executorJob, executorPolicy, executorReply, executorTime as time } from '../fixtures/enrollment-executor';

class Storage implements KeyValueStorage {
  value: unknown; writes = 0; fail: 'before' | 'after' | null = null;
  gate?: () => Promise<void>;
  async get(key: string) { expect(key).toBe(enrollmentJobsKey); return structuredClone(this.value); }
  async set(key: string, value: unknown) {
    expect(key).toBe(enrollmentJobsKey); this.writes++; await this.gate?.();
    if (this.fail === 'before') throw new Error('Private synthetic write failure');
    this.value = structuredClone(value);
    if (this.fail === 'after') throw new Error('Private synthetic lost acknowledgment');
  }
}
const fault = (code: string) => expect.objectContaining({ detail: expect.objectContaining({ code }) });
function snapshot(storage: Storage) {
  return storage.value as { schemaVersion: number; jobs: EnrollmentJob[];
    executorRequests: ExecutorRequestRecord[]; dispatchIntents: DispatchIntent[] };
}
async function setup() {
  const storage = new Storage(); const clock = vi.fn(() => time);
  const repo = new EnrollmentJobRepository(storage, clock, executorPolicy()); const job = executorJob();
  await repo.recover(); await repo.createForActivation('activation', payloadForJob(job), job);
  await repo.transition(job.id, 0, { type: 'begin-preflight' });
  await repo.transition(job.id, 1, { type: 'begin-execution' });
  const context = executorContext(job, 2);
  const register = async (command: 'portal.execute' | 'portal.cancel' = 'portal.execute') => {
    const pending = executorContext(job, 2, command).pending;
    await repo.registerExecutorRequest(job.id, 2, { requestId: pending.requestId, command, expiresAt: pending.expiresAt });
    return pending.requestId;
  };
  const requestId = await register();
  const send = vi.fn(async (_dispatch: ExecutorDispatch) => undefined);
  const dispatch = () => repo.dispatchExecutorRequest(requestId, 2, context.sender, send);
  return { storage, clock, repo, job, context, register, requestId, send, dispatch };
}

describe('durable one-use dispatch coordination', () => {
  it('persists intent before sending only saved selection and exact document identity', async () => {
    const { storage, job, requestId, repo, context } = await setup();
    await repo.dispatchExecutorRequest(requestId, 2, context.sender, async dispatch => {
      expect(snapshot(storage).dispatchIntents).toEqual([{ requestId, claimedAt: time }]);
      expect(dispatch).toEqual({ target: job.review.target, expiresAt: job.expiresAt,
        command: { protocolVersion: 1, requestId, type: 'portal.execute', payload: {
          jobId: job.id, executionToken: job.executionToken, reviewFingerprint: job.review.fingerprint,
          termId: job.termId, selectedSectionIds: job.selectedSectionIds, deselectSectionIds: job.review.deselectSectionIds,
          targetEpochMs: job.targetEpochMs, expiresAt: job.expiresAt,
        } } });
      dispatch.target.documentId = 'mutated';
      if (dispatch.command.type === 'portal.execute') dispatch.command.payload.selectedSectionIds.push('mutated');
    });
    expect(snapshot(storage).jobs[0]!.state).toBe('executing');
    expect(snapshot(storage).jobs[0]!.submittedAt).toBeNull();
    expect(snapshot(storage).jobs[0]!.selectedSectionIds).toEqual(job.selectedSectionIds);
    expect(snapshot(storage).jobs[0]!.review.target).toEqual(job.review.target);
    expect(storage.writes).toBe(5);
  });
  it('invokes a sender only once for concurrent calls and all later duplicates', async () => {
    const { dispatch, send, storage } = await setup();
    const results = await Promise.allSettled([dispatch(), dispatch()]);
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    await expect(dispatch()).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(send).toHaveBeenCalledTimes(1); expect(snapshot(storage).dispatchIntents).toHaveLength(1);
  });
  it('waits for persistence before handing the command to a sender', async () => {
    const { storage, dispatch, send } = await setup(); let release!: () => void;
    storage.gate = () => new Promise<void>(resolve => { release = resolve; });
    const pending = dispatch(); await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(send).not.toHaveBeenCalled(); expect(snapshot(storage).dispatchIntents).toEqual([]);
    release(); await pending; expect(send).toHaveBeenCalledTimes(1);
  });
  it.each(['before', 'after'] as const)('never sends after a failed intent write %s persistence', async fail => {
    const { storage, dispatch, send, repo } = await setup(); storage.fail = fail;
    await expect(dispatch()).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(send).not.toHaveBeenCalled();
    expect(snapshot(storage).dispatchIntents).toHaveLength(fail === 'after' ? 1 : 0);
    await expect(dispatch()).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.fail = null; expect(await repo.recover()).toMatchObject([{ state: 'unknown' }]);
    await expect(dispatch()).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it.each([time - 1, time + 2_000, time + 10_000])('stops if persistence crosses the valid clock window %s', async now => {
    const { storage, clock, dispatch, send, repo } = await setup();
    storage.gate = async () => { clock.mockReturnValue(now); };
    await expect(dispatch()).rejects.toEqual(fault('INVALID_TIME')); expect(send).not.toHaveBeenCalled();
    expect(snapshot(storage).dispatchIntents).toHaveLength(1);
    await expect(repo.readAll()).rejects.toEqual(fault('STORAGE_ERROR'));
    delete storage.gate; await repo.recover();
    await expect(dispatch()).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it.each([time - 1, time + 2_000, time + 10_000])('does not claim or send outside the initial clock window %s', async now => {
    const { storage, clock, dispatch, send } = await setup(); clock.mockReturnValue(now);
    await expect(dispatch()).rejects.toEqual(fault('INVALID_TIME'));
    expect(snapshot(storage).dispatchIntents).toEqual([]); expect(send).not.toHaveBeenCalled();
  });
  it.each(['throw', 'reject'] as const)('blocks operations after a sender %s without retrying', async mode => {
    const { repo, requestId, context, storage, dispatch, send } = await setup();
    const broken = () => { if (mode === 'throw') throw new Error('Private sender detail'); return Promise.reject(new Error('Private sender detail')); };
    await expect(repo.dispatchExecutorRequest(requestId, 2, context.sender, broken)).rejects.toEqual(fault('TRANSPORT_ERROR'));
    await expect(dispatch()).rejects.toEqual(fault('STORAGE_ERROR')); expect(send).not.toHaveBeenCalled();
    expect(snapshot(storage).dispatchIntents).toHaveLength(1);
    expect(await repo.recover()).toMatchObject([{ state: 'unknown' }]);
    await expect(dispatch()).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it('releases the queue while delivery waits so verified replies can be processed', async () => {
    const { repo, requestId, context, clock, storage } = await setup();
    await repo.dispatchExecutorRequest(requestId, 2, context.sender, async () => {
      clock.mockReturnValue(time + 100);
      expect((await repo.acceptExecutorReply(context.sender, executorReply(context))).job.state).toBe('unknown');
    });
    expect(snapshot(storage).executorRequests[0]!.state).toBe('consumed');
    expect(snapshot(storage).dispatchIntents).toHaveLength(1);
  });
  it('a stalled sender does not lock storage or allow duplicate dispatch', async () => {
    const { repo, requestId, context, dispatch } = await setup(); let finish!: () => void;
    const pending = repo.dispatchExecutorRequest(requestId, 2, context.sender,
      () => new Promise<void>(resolve => { finish = resolve; }));
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    expect(await repo.readAll()).toMatchObject([{ state: 'executing' }]);
    await expect(dispatch()).rejects.toEqual(fault('REQUEST_ID_REUSED')); finish(); await pending;
  });
  it('retains a durable tombstone across restart and refuses to resend', async () => {
    const { dispatch, storage, requestId, context, send } = await setup(); await dispatch();
    const restarted = new EnrollmentJobRepository(storage, () => time + 100, executorPolicy());
    await expect(restarted.dispatchExecutorRequest(requestId, 2, context.sender, send)).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(await restarted.recover()).toMatchObject([{ state: 'unknown' }]);
    await expect(restarted.dispatchExecutorRequest(requestId, 3, context.sender, send)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(send).toHaveBeenCalledTimes(1); expect(snapshot(storage).dispatchIntents).toHaveLength(1);
  });
  it.each([{ tabId: 999 }, { documentId: 'other-document' }, { documentLifecycle: 'cached' }, { extensionId: 'other-extension' }])(
    'rejects changed browser metadata before claiming %#', async patch => {
      const { repo, requestId, context, send, storage } = await setup();
      await expect(repo.dispatchExecutorRequest(requestId, 2, { ...context.sender, ...patch }, send)).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
      expect(snapshot(storage).dispatchIntents).toEqual([]); expect(send).not.toHaveBeenCalled();
    });
  it('rejects stale revisions, missing requests and changed origins', async () => {
    const { repo, requestId, context, send, storage } = await setup();
    await expect(repo.dispatchExecutorRequest(requestId, 1, context.sender, send)).rejects.toEqual(fault('REVISION_CONFLICT'));
    await expect(repo.dispatchExecutorRequest('missing', 2, context.sender, send)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    // Browser identity must still match the saved target.
    context.sender.origin = 'https://other.invalid'; context.sender.url = 'https://other.invalid/cart';
    await expect(repo.dispatchExecutorRequest(requestId, 2, context.sender, send)).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    expect(snapshot(storage).dispatchIntents).toEqual([]); expect(send).not.toHaveBeenCalled();
  });
  it('a registered cancellation prevents later execute dispatch and has its own single-use intent', async () => {
    const { register, dispatch, send, repo, context, storage } = await setup();
    const cancelId = await register('portal.cancel');
    await expect(dispatch()).rejects.toEqual(fault('INVALID_INPUT'));
    await repo.dispatchExecutorRequest(cancelId, 2, context.sender, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].command.type).toBe('portal.cancel');
    expect(snapshot(storage).dispatchIntents[0]!.requestId).toBe(cancelId);
    await expect(repo.dispatchExecutorRequest(cancelId, 2, context.sender, send)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it('allows cancellation after execute window closes but before its own deadline', async () => {
    const { dispatch, register, clock, repo, context, send } = await setup(); await dispatch();
    clock.mockReturnValue(time + 3_000); const cancelId = await register('portal.cancel');
    await repo.dispatchExecutorRequest(cancelId, 2, context.sender, send);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('uses the earlier request deadline and stops after that deadline', async () => {
    const { storage, requestId, context, repo, send, clock } = await setup();
    snapshot(storage).executorRequests[0]!.pending.expiresAt = time + 500;
    await repo.dispatchExecutorRequest(requestId, 2, context.sender, send);
    const sent = send.mock.calls[0]![0]; expect(sent.expiresAt).toBe(time + 500);
    if (sent.command.type !== 'portal.execute') throw new Error('Expected execute');
    expect(sent.command.payload.expiresAt).toBe(time + 500);
    const other = await setup(); snapshot(other.storage).executorRequests[0]!.pending.expiresAt = time + 500;
    other.clock.mockReturnValue(time + 500);
    await expect(other.dispatch()).rejects.toEqual(fault('INVALID_TIME'));
    expect(other.send).not.toHaveBeenCalled(); clock.mockReturnValue(time + 600);
  });
  it('allows accepted results to finish before a later delivery failure and retains them on recovery', async () => {
    const { repo, requestId, context, clock, job, storage } = await setup();
    await expect(repo.dispatchExecutorRequest(requestId, 2, context.sender, async () => {
      clock.mockReturnValue(time + 100); const reply = executorReply(context);
      await repo.acceptExecutorReply(context.sender, { ...reply, payload: { ...reply.payload,
        outcomes: [{ sectionId: job.selectedSectionIds[0], status: 'enrolled' }] } });
      throw new Error('Synthetic late transport failure');
    })).rejects.toEqual(fault('TRANSPORT_ERROR'));
    expect(await repo.recover()).toMatchObject([{ state: 'succeeded' }]);
    expect(snapshot(storage).dispatchIntents).toHaveLength(1);
  });
  it('snapshots browser metadata before waiting behind another operation', async () => {
    const { storage, context, repo, requestId, send } = await setup();
    let release!: () => void; storage.gate = () => new Promise<void>(resolve => { release = resolve; });
    const pending = repo.dispatchExecutorRequest(requestId, 2, context.sender, send);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    context.sender.documentId = 'mutated-after-call'; release(); await pending;
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].target.documentId).not.toBe('mutated-after-call');
  });
  it.each(['explicit', 'startup'] as const)('keeps pre-intent results unknown during %s reconciliation', async mode => {
    const { storage, dispatch, clock, repo, job } = await setup(); clock.mockReturnValue(time + 200); await dispatch();
    const saved = snapshot(storage); saved.executorRequests[0]!.state = 'consumed';
    Object.assign(saved.jobs[0]!, { revision: 3, updatedAt: time + 300, submittedAt: time + 100,
      outcomes: [{ sectionId: job.selectedSectionIds[0], status: 'enrolled' }] });
    clock.mockReturnValue(time + 400);
    if (mode === 'explicit') expect((await repo.reconcileExecutorResult(job.id, 3)).job.state).toBe('unknown');
    else expect(await new EnrollmentJobRepository(storage, clock, executorPolicy()).recover()).toMatchObject([{ state: 'unknown' }]);
  });
  it('does not infer successful enrollment from a result timestamp before dispatch intent', async () => {
    const { dispatch, clock, repo, context, job } = await setup(); clock.mockReturnValue(time + 200); await dispatch();
    clock.mockReturnValue(time + 300); const reply = executorReply(context);
    const result = await repo.acceptExecutorReply(context.sender, { ...reply, payload: { ...reply.payload,
      submittedAt: time + 100, outcomes: [{ sectionId: job.selectedSectionIds[0], status: 'enrolled' }] } });
    expect(result.job.state).toBe('unknown');
  });
});

describe('dispatch intent persistence and migration', () => {
  it('migrates v3 without inventing claims and abandons every old pending request', async () => {
    const { storage, requestId, context, send } = await setup();
    const { dispatchIntents: _intents, ...old } = snapshot(storage); storage.value = { ...old, schemaVersion: 3 };
    const repo = new EnrollmentJobRepository(storage, () => time, executorPolicy());
    expect(await repo.recover()).toMatchObject([{ state: 'unknown' }]);
    expect(snapshot(storage)).toMatchObject({ schemaVersion: 4, dispatchIntents: [], executorRequests: [{ state: 'abandoned' }] });
    await expect(repo.dispatchExecutorRequest(requestId, 3, context.sender, send)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(send).not.toHaveBeenCalled();
  });
  it.each([
    [{ requestId: 'missing', claimedAt: time }],
    [{ requestId: 'synthetic-outstanding-portal.execute', claimedAt: time - 1 }],
    [{ requestId: 'synthetic-outstanding-portal.execute', claimedAt: time + 2_000 }],
    [{ requestId: 'synthetic-outstanding-portal.execute', claimedAt: NaN }],
    [{ requestId: 'synthetic-outstanding-portal.execute', claimedAt: time, extra: true }],
    [{ requestId: 'synthetic-outstanding-portal.execute', claimedAt: time }, { requestId: 'synthetic-outstanding-portal.execute', claimedAt: time }],
  ].map(intents => ({ intents })))('preserves corrupt intent records without sending or resetting %#', async ({ intents }) => {
    const { storage, dispatch, send } = await setup(); snapshot(storage).dispatchIntents = intents;
    const before = structuredClone(storage.value);
    await expect(dispatch()).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(storage.value).toEqual(before); expect(send).not.toHaveBeenCalled();
  });
});
