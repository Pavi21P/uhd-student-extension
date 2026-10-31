import { describe, expect, it, vi } from 'vitest';
import { EnrollmentJobRepository, enrollmentJobsKey } from '../../src/storage/enrollment-repository';
import { finalizeExecutorResult } from '../../src/shared/enrollment-results';
import { payloadForJob } from '../../src/shared/enrollment-activation';
import type { EnrollmentJob, SectionOutcome } from '../../src/shared/domain';
import type { KeyValueStorage } from '../../src/storage/repository';
import { executorContext, executorJob, executorPolicy, executorTime as time } from '../fixtures/enrollment-executor';

class Storage implements KeyValueStorage {
  value: unknown;
  writes = 0;
  fail: 'before' | 'after' | null = null;
  gate?: () => Promise<void>;
  async get(key: string) { expect(key).toBe(enrollmentJobsKey); return structuredClone(this.value); }
  async set(key: string, value: unknown) {
    expect(key).toBe(enrollmentJobsKey); this.writes++;
    await this.gate?.();
    if (this.fail === 'before') throw new Error('Synthetic private failure');
    this.value = structuredClone(value);
    if (this.fail === 'after') throw new Error('Synthetic private lost acknowledgment');
  }
}
const fault = (code: string) => expect.objectContaining({ detail: expect.objectContaining({ code }) });
const statuses = ['enrolled', 'waitlisted', 'rejected', 'unknown'] as const;
function twoSectionJob(): EnrollmentJob {
  const job = executorJob();
  const second = { ...job.review.sections.find(section => section.sectionId === job.selectedSectionIds[0])!,
    sectionId: 'synthetic-second-section' };
  job.review.sections.push(second);
  job.selectedSectionIds.push(second.sectionId);
  job.review.selectedSectionIds.push(second.sectionId);
  return job;
}
async function setup(registrationTime = time) {
  const storage = new Storage();
  const clock = vi.fn(() => time);
  const repo = new EnrollmentJobRepository(storage, clock, executorPolicy());
  const job = twoSectionJob();
  await repo.recover();
  await repo.createForActivation('activation', payloadForJob(job), job);
  await repo.transition(job.id, 0, { type: 'begin-preflight' });
  await repo.transition(job.id, 1, { type: 'begin-execution' });
  clock.mockReturnValue(registrationTime);
  const context = executorContext(job, 2);
  await repo.registerExecutorRequest(job.id, 2, { requestId: context.pending.requestId,
    command: 'portal.execute', expiresAt: context.pending.expiresAt });
  clock.mockReturnValue(time + 100);
  const reply = (values: readonly SectionOutcome['status'][], submittedAt: number | null = time + 100) => ({
    protocolVersion: 1, requestId: context.pending.requestId, type: 'portal.completed',
    payload: { jobId: job.id, executionToken: job.executionToken, submittedAt,
      outcomes: values.map((status, index) => ({ sectionId: job.selectedSectionIds[index]!, status })) },
  });
  return { storage, clock, repo, job, context, reply };
}
function saved(storage: Storage) { return storage.value as { jobs: EnrollmentJob[]; executorRequests: { state: string; pending: { expectedRevision: number; expiresAt: number } }[] }; }
async function olderEvidence(values: readonly SectionOutcome['status'][] = ['enrolled', 'enrolled'], registrationTime = time) {
  const fixture = await setup(registrationTime);
  await fixture.repo.acceptExecutorReply(fixture.context.sender, fixture.reply(values));
  // Synthetic snapshot of the prior implementation: consumed reply with validated evidence,
  // still executing at the reply's accepted revision. No portal/storage production code runs.
  saved(fixture.storage).jobs[0]!.state = 'executing';
  if (!values.length) saved(fixture.storage).jobs[0]!.outcomes = [];
  return fixture;
}

describe('atomic final outcome reconciliation', () => {
  it.each([
    [['enrolled', 'enrolled'], 'succeeded'],
    [['waitlisted', 'waitlisted'], 'partial'],
    [['enrolled', 'waitlisted'], 'partial'],
    [['waitlisted', 'enrolled'], 'partial'],
    [['enrolled', 'rejected'], 'partial'],
    [['rejected', 'enrolled'], 'partial'],
    [['waitlisted', 'rejected'], 'partial'],
    [['rejected', 'waitlisted'], 'partial'],
    [['rejected', 'rejected'], 'failed'],
    [['unknown', 'enrolled'], 'unknown'],
    [['enrolled', 'unknown'], 'unknown'],
    [['unknown', 'rejected'], 'unknown'],
    [['waitlisted', 'unknown'], 'unknown'],
    [['unknown', 'unknown'], 'unknown'],
  ] as const)('maps %j to %s and consumes the reply in one write', async (values, state) => {
    const { repo, job, context, reply, storage } = await setup();
    const before = storage.writes;
    const result = await repo.acceptExecutorReply(context.sender, reply(values));
    expect(result).toMatchObject({ changed: true, job: { state, revision: 3, submittedAt: time + 100 } });
    expect(result.job.outcomes.map(outcome => outcome.status)).toEqual(values);
    expect(storage.writes).toBe(before + 1);
    expect(saved(storage)).toMatchObject({ jobs: [{ state, revision: 3 }], executorRequests: [{ state: 'consumed' }] });
    await expect(repo.acceptExecutorReply(context.sender, reply(values))).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    const replay = await repo.createForActivation('activation', payloadForJob(job));
    expect(replay).toMatchObject({ created: false, job: { state, revision: 3 } });
  });
  it('fills missing result evidence with explicit unknowns for every selected section', async () => {
    const { repo, context, reply, job } = await setup();
    const result = await repo.acceptExecutorReply(context.sender, reply([]));
    expect(result.job.state).toBe('unknown');
    expect(result.job.outcomes).toEqual(job.selectedSectionIds.map(sectionId => ({ sectionId, status: 'unknown', reason: 'unconfirmed' })));
  });
  it('keeps absent dispatch unknown without inventing section results', async () => {
    const { repo, context, reply } = await setup();
    const result = await repo.acceptExecutorReply(context.sender, reply([], null));
    expect(result.job).toMatchObject({ state: 'unknown', submittedAt: null, outcomes: [] });
  });
  it('canonicalizes result order, strips messages and retains normalized rejection reasons', async () => {
    const { repo, context, reply, job, storage } = await setup();
    const message = reply(['rejected', 'enrolled']);
    const outcomes = [{ ...message.payload.outcomes[1]!, message: 'Synthetic private text' },
      { ...message.payload.outcomes[0]!, reason: 'ineligible', message: 'Synthetic private text' }];
    const result = await repo.acceptExecutorReply(context.sender, { ...message, payload: { ...message.payload, outcomes } });
    expect(result.job.outcomes).toEqual([{ sectionId: job.selectedSectionIds[0], status: 'rejected', reason: 'ineligible' },
      { sectionId: job.selectedSectionIds[1], status: 'enrolled' }]);
    expect(JSON.stringify(storage.value)).not.toContain('Synthetic private text');
  });
  it.each(['early', 'late', 'before-registration', 'backwards-clock'] as const)(
    'keeps %s dispatch unknown despite all-enrolled outcomes', async mode => {
      const { repo, context, reply, clock } = await setup(mode === 'before-registration' ? time + 90 : time);
      let submittedAt = time + 100;
      if (mode === 'early') submittedAt = time - 1;
      if (mode === 'late') { submittedAt = time + 2_000; clock.mockReturnValue(time + 2_000); }
      if (mode === 'before-registration') submittedAt = time + 80;
      if (mode === 'backwards-clock') clock.mockReturnValue(time - 1);
      const result = await repo.acceptExecutorReply(context.sender, reply(['enrolled', 'enrolled'], submittedAt));
      expect(result.job.state).toBe('unknown');
      expect(result.job.submittedAt).toBe(mode === 'backwards-clock' ? null : submittedAt);
    },
  );
  it('does not acknowledge success before the atomic write finishes', async () => {
    const { repo, context, reply, storage } = await setup();
    let release!: () => void;
    storage.gate = () => new Promise<void>(resolve => { release = resolve; });
    let acknowledged = false;
    const pending = repo.acceptExecutorReply(context.sender, reply(['enrolled', 'enrolled'])).then(value => { acknowledged = true; return value; });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(saved(storage).jobs[0]!.state).toBe('executing');
    expect(saved(storage).executorRequests[0]!.state).toBe('pending');
    expect(acknowledged).toBe(false);
    release();
    expect((await pending).job.state).toBe('succeeded');
  });
  it.each(['before', 'after'] as const)('blocks after result write failure %s persistence and never resubmits', async fail => {
    const { repo, context, reply, storage } = await setup();
    storage.fail = fail;
    await expect(repo.acceptExecutorReply(context.sender, reply(['enrolled', 'enrolled']))).rejects.toEqual(fault('STORAGE_ERROR'));
    await expect(repo.acceptExecutorReply(context.sender, reply(['enrolled', 'enrolled']))).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.fail = null;
    const recovered = await repo.recover();
    expect(recovered[0]!.state).toBe(fail === 'before' ? 'unknown' : 'succeeded');
    await expect(repo.acceptExecutorReply(context.sender, reply(['enrolled', 'enrolled']))).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it('rejects partial coverage without saving an apparent partial success', async () => {
    const { repo, context, reply, storage } = await setup();
    const before = structuredClone(storage.value);
    await expect(repo.acceptExecutorReply(context.sender, reply(['enrolled']))).rejects.toEqual(fault('INVALID_INPUT'));
    expect(storage.value).toEqual(before);
  });
});

describe('guarded reconciliation of saved evidence', () => {
  it.each([
    [['enrolled', 'enrolled'], 'succeeded'],
    [['enrolled', 'rejected'], 'partial'],
    [['rejected', 'rejected'], 'failed'],
    [[], 'unknown'],
  ] as const)('reconciles prior executing evidence %j into %s during startup recovery', async (values, state) => {
    const { storage } = await olderEvidence(values);
    const writes = storage.writes;
    const fresh = new EnrollmentJobRepository(storage, () => time + 200, executorPolicy());
    expect(await fresh.recover()).toMatchObject([{ state, revision: 4, submittedAt: time + 100 }]);
    expect(storage.writes).toBe(writes + 1);
    await fresh.recover();
    expect(storage.writes).toBe(writes + 1);
    expect(saved(storage).executorRequests[0]!.state).toBe('consumed');
  });
  it('serializes explicit reconciliation and rejects the stale competing revision', async () => {
    const { repo, job, storage, clock } = await olderEvidence();
    clock.mockReturnValue(time + 200);
    const results = await Promise.allSettled([repo.reconcileExecutorResult(job.id, 3), repo.reconcileExecutorResult(job.id, 3)]);
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: { changed: true, job: { state: 'succeeded', revision: 4 } } });
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'REVISION_CONFLICT' } } });
    const writes = storage.writes;
    expect(await repo.reconcileExecutorResult(job.id, 4)).toMatchObject({ changed: false });
    expect(storage.writes).toBe(writes);
  });
  it.each(['no-consumed-request', 'wrong-revision'] as const)('never promotes historical evidence with %s', async mode => {
    const { repo, job, storage } = await olderEvidence();
    if (mode === 'no-consumed-request') saved(storage).executorRequests[0]!.state = 'abandoned';
    else saved(storage).executorRequests[0]!.pending.expectedRevision = 1;
    await expect(repo.reconcileExecutorResult(job.id, 3)).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    const fresh = new EnrollmentJobRepository(storage, () => time + 200);
    expect(await fresh.recover()).toMatchObject([{ state: 'unknown' }]);
  });
  it.each(['backwards-clock', 'expired-reply', 'pre-request-dispatch'] as const)('keeps %s saved evidence unknown', async mode => {
    const { repo, job, storage, clock } = await olderEvidence(['enrolled', 'enrolled'], mode === 'pre-request-dispatch' ? time + 90 : time);
    if (mode === 'backwards-clock') clock.mockReturnValue(time + 50);
    if (mode === 'expired-reply') {
      saved(storage).jobs[0]!.updatedAt = time + 10_000;
      clock.mockReturnValue(time + 11_000);
    }
    if (mode === 'pre-request-dispatch') saved(storage).jobs[0]!.submittedAt = time + 80;
    expect((await repo.reconcileExecutorResult(job.id, 3)).job.state).toBe('unknown');
  });
  it('never upgrades an existing unknown result even when its section evidence says enrolled', async () => {
    const { repo, job, storage } = await olderEvidence();
    saved(storage).jobs[0]!.state = 'unknown';
    const before = structuredClone(storage.value);
    expect(await repo.reconcileExecutorResult(job.id, 3)).toMatchObject({ changed: false, job: { state: 'unknown' } });
    await repo.recover();
    expect(storage.value).toEqual(before);
  });
  it('does not reconcile an executing job before any reply and rejects missing/stale jobs', async () => {
    const { repo, job } = await setup();
    await expect(repo.reconcileExecutorResult(job.id, 2)).rejects.toEqual(fault('UNAUTHORIZED_SENDER'));
    await expect(repo.reconcileExecutorResult(job.id, 1)).rejects.toEqual(fault('REVISION_CONFLICT'));
    await expect(repo.reconcileExecutorResult('missing', 0)).rejects.toEqual(fault('NOT_FOUND'));
  });
  it.each(['before', 'after'] as const)('requires recovery after a saved-result write fails %s persistence', async fail => {
    const { repo, job, storage } = await olderEvidence();
    storage.fail = fail;
    await expect(repo.reconcileExecutorResult(job.id, 3)).rejects.toEqual(fault('STORAGE_ERROR'));
    await expect(repo.reconcileExecutorResult(job.id, 3)).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.fail = null;
    expect(await repo.recover()).toMatchObject([{ state: 'succeeded', revision: 4 }]);
  });
  it('preserves data and blocks on revision exhaustion', async () => {
    const { repo, job, storage } = await olderEvidence();
    saved(storage).jobs[0]!.revision = Number.MAX_SAFE_INTEGER;
    saved(storage).executorRequests[0]!.pending.expectedRevision = Number.MAX_SAFE_INTEGER - 1;
    const before = structuredClone(storage.value);
    await expect(repo.reconcileExecutorResult(job.id, Number.MAX_SAFE_INTEGER)).rejects.toEqual(fault('REVISION_CONFLICT'));
    expect(storage.value).toEqual(before);
  });
  it('does not let pure finalization mutate its input or promote uncertainty', () => {
    const job = twoSectionJob();
    const original: EnrollmentJob = { ...job, state: 'unknown', revision: 3, submittedAt: time + 100, updatedAt: time + 100,
      outcomes: job.selectedSectionIds.map(sectionId => ({ sectionId, status: statuses[0] })) };
    const finalized = finalizeExecutorResult(original);
    expect(finalized.state).toBe('unknown');
    finalized.outcomes[0]!.status = 'rejected';
    expect(original.outcomes[0]!.status).toBe('enrolled');
  });
});
