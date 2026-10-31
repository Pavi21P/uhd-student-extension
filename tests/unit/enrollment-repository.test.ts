import { describe, expect, it, vi } from 'vitest';
import type { EnrollmentJob, JobState } from '../../src/shared/domain';
import { EnrollmentJobRepository, enrollmentJobsKey } from '../../src/storage/enrollment-repository';
import type { KeyValueStorage } from '../../src/storage/repository';
import { sampleReview } from '../fixtures/contracts.examples';
import { executorReply, executorContext, executorPolicy } from '../fixtures/enrollment-executor';
import { payloadForJob } from '../../src/shared/enrollment-activation';

const time = Date.UTC(2025, 0, 1);
function job(id = 'synthetic-job'): EnrollmentJob {
  return { id, revision: 0, state: 'armed', termId: sampleReview.termId, termLabel: sampleReview.termLabel,
    selectedSectionIds: [...sampleReview.selectedSectionIds], timing: { mode: 'now' },
    targetEpochMs: time, expiresAt: time + 2_000, createdAt: time, updatedAt: time,
    submittedAt: null, outcomes: [], executionToken: 'synthetic-token-' + id,
    review: { ...structuredClone(sampleReview), observedAt: time - 1_000, expiresAt: time + 119_000 } };
}
class Storage implements KeyValueStorage {
  values = new Map<string, unknown>();
  writes = 0;
  failRead = false;
  failWrite: 'before' | 'after' | null = null;
  beforeWrite?: () => Promise<void>;
  async get(key: string) {
    if (this.failRead) throw new Error('Private read details');
    return structuredClone(this.values.get(key));
  }
  async set(key: string, value: unknown) {
    this.writes++;
    await this.beforeWrite?.();
    if (this.failWrite === 'before') throw new Error('Private failed write details');
    this.values.set(key, structuredClone(value));
    if (this.failWrite === 'after') throw new Error('Private lost acknowledgment details');
  }
  seed(...jobs: EnrollmentJob[]) { this.values.set(enrollmentJobsKey, { schemaVersion: 3, executorRequests: [], activations: [], legacyJobIds: jobs.map(job => job.id), jobs: structuredClone(jobs) }); }
}
function create(repo: EnrollmentJobRepository, input: unknown) {
  const value = input as EnrollmentJob; // Test fixture helper; production receives unknown at its boundary.
  return repo.createForActivation('request-' + value.id, payloadForJob(value), input).then(result => result.job);
}
const code = (value: string) => expect.objectContaining({ detail: expect.objectContaining({ code: value }) });
async function setup() {
  const storage = new Storage();
  let now = time;
  const repo = new EnrollmentJobRepository(storage, () => now, executorPolicy());
  await repo.recover();
  return { storage, repo, clock: (value: number) => { now = value; } };
}

describe('internal enrollment job repository', () => {
  it('requires explicit recovery and does not create storage for an empty history', async () => {
    const storage = new Storage();
    const repo = new EnrollmentJobRepository(storage, () => time);
    await expect(repo.readAll()).rejects.toEqual(code('STORAGE_ERROR'));
    await expect(create(repo, job())).rejects.toEqual(code('STORAGE_ERROR'));
    await expect(repo.transition('missing', 0, { type: 'cancel' })).rejects.toEqual(code('STORAGE_ERROR'));
    expect(await repo.recover()).toEqual([]);
    expect(await repo.readAll()).toEqual([]);
    expect(storage.writes).toBe(0);
  });
  it('persists a detached job under one versioned key without touching timetable data', async () => {
    const { storage, repo } = await setup();
    storage.values.set('uhd.schedule.synthetic', { untouched: true });
    const input = job();
    const pending = create(repo, input);
    input.review.sections[0]!.title = 'changed after call';
    const saved = await pending;
    expect(saved).toEqual(job());
    saved.review.target.documentId = 'changed after save';
    saved.selectedSectionIds.push('unrelated');
    expect(await repo.readAll()).toEqual([job()]);
    expect(storage.values.get('uhd.schedule.synthetic')).toEqual({ untouched: true });
    expect(storage.values.get(enrollmentJobsKey)).toEqual({ schemaVersion: 3, executorRequests: [], jobs: [job()], legacyJobIds: [], activations: [{ requestId: 'request-synthetic-job', jobId: job().id, payload: payloadForJob(job()) }] });
    expect(storage.writes).toBe(1);
  });
  it('allows only one concurrent create and never replaces a reused ID', async () => {
    const { storage, repo } = await setup();
    const results = await Promise.allSettled([create(repo, job('first')), create(repo, job('second'))]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'JOB_ALREADY_ACTIVE' } } });
    await repo.transition('first', 0, { type: 'cancel' });
    await expect(repo.createForActivation('different-request', payloadForJob(job('first')), job('first'))).rejects.toEqual(code('REVISION_CONFLICT'));
    await create(repo, job('second'));
    expect((await repo.readAll()).map(value => value.state)).toEqual(['cancelled', 'armed']);
    expect(storage.writes).toBe(3);
  });
  it('serializes racing transitions and treats repeated callbacks as no additional write', async () => {
    const { storage, repo } = await setup();
    await create(repo, job());
    const results = await Promise.allSettled([
      repo.transition(job().id, 0, { type: 'begin-preflight' }),
      repo.transition(job().id, 0, { type: 'cancel' }),
    ]);
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: { changed: true, job: { state: 'preflight', revision: 1 } } });
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'REVISION_CONFLICT' } } });
    expect(await repo.transition(job().id, 1, { type: 'begin-preflight' })).toMatchObject({ changed: false });
    expect(storage.writes).toBe(2);
  });
  it('does not resolve a transition or let a queued read overtake its write', async () => {
    const { storage, repo } = await setup();
    await create(repo, job());
    let release!: () => void;
    storage.beforeWrite = () => new Promise<void>(resolve => { release = resolve; });
    let resolved = false;
    const pending = repo.transition(job().id, 0, { type: 'begin-preflight' }).then(value => { resolved = true; return value; });
    const read = repo.readAll();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(resolved).toBe(false);
    expect(storage.values.get(enrollmentJobsKey)).toMatchObject({ jobs: [{ state: 'armed' }] });
    release();
    expect((await pending).job.state).toBe('preflight');
    expect((await read)[0]!.state).toBe('preflight');
  });
  it('snapshots an event before a queued operation and never invokes accessor payloads', async () => {
    const { repo } = await setup();
    await create(repo, job());
    const event = { type: 'begin-preflight' };
    const pending = repo.transition(job().id, 0, event);
    event.type = 'cancel';
    expect((await pending).job.state).toBe('preflight');
    const getter = vi.fn(() => 'cancel');
    expect(() => repo.transition(job().id, 1, Object.defineProperty({}, 'type', { enumerable: true, get: getter }))).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
  it('persists execution before returning and enforces the submission/cancellation boundary', async () => {
    const { storage, repo, clock } = await setup();
    await create(repo, job());
    await repo.transition(job().id, 0, { type: 'begin-preflight' });
    const executing = await repo.transition(job().id, 1, { type: 'begin-execution' });
    expect(executing.job.state).toBe('executing');
    expect(storage.values.get(enrollmentJobsKey)).toMatchObject({ jobs: [{ state: 'executing', revision: 2 }] });
    expect(await repo.transition(job().id, 2, { type: 'cancel' })).toMatchObject({ changed: false, cancellation: 'executor-confirmation-required' });
    clock(time + 100);
    const context = executorContext(job(), 2);
    await repo.registerExecutorRequest(job().id, 2, { requestId: context.pending.requestId, command: context.pending.command, expiresAt: context.pending.expiresAt });
    await repo.acceptExecutorReply(context.sender, executorReply(context));
    await expect(repo.transition(job().id, 3, { type: 'cancel' })).rejects.toEqual(code('TOO_LATE_TO_CANCEL'));
    expect(storage.writes).toBe(5);
  });
  it.each(['armed', 'preflight'] as const)('disarms saved %s jobs on a fresh repository', async state => {
    const storage = new Storage();
    storage.seed({ ...job(), state, revision: 4 });
    const repo = new EnrollmentJobRepository(storage, () => time + 1);
    expect(await repo.recover()).toMatchObject([{ state: 'needs-review', revision: 5 }]);
    expect(storage.writes).toBe(1);
    expect(await repo.recover()).toMatchObject([{ state: 'needs-review', revision: 5 }]);
    expect(storage.writes).toBe(1);
  });
  it.each([null, time + 100])('marks interrupted execution unknown with submission timestamp %s', async submittedAt => {
    const storage = new Storage();
    storage.seed({ ...job(), state: 'executing', revision: 2, submittedAt, updatedAt: time + 100 });
    const repo = new EnrollmentJobRepository(storage, () => time + 3_000);
    expect(await repo.recover()).toMatchObject([{ state: 'unknown', revision: 3, submittedAt }]);
    expect(await repo.transition(job().id, 3, { type: 'begin-execution' })).toMatchObject({ changed: false, job: { state: 'unknown' } });
    expect(storage.writes).toBe(1);
  });
  it('preserves saved known results when recovery stops an executor as unknown', async () => {
    const storage = new Storage();
    const value: EnrollmentJob = { ...job(), state: 'executing', submittedAt: time + 1, updatedAt: time + 1,
      outcomes: [{ sectionId: 'sample-section-a', status: 'enrolled' }] };
    storage.seed(value);
    const recovered = await new EnrollmentJobRepository(storage, () => time + 100).recover();
    expect(recovered[0]).toMatchObject({ state: 'unknown', outcomes: value.outcomes, executionToken: value.executionToken });
  });
  it('expires missed jobs at the cutoff and stops backwards clocks without decreasing timestamps', async () => {
    for (const [now, state] of [[time + 2_000, 'expired'], [time - 1, 'needs-review']] as const) {
      const storage = new Storage(); storage.seed(job());
      const result = await new EnrollmentJobRepository(storage, () => now).recover();
      expect(result[0]).toMatchObject({ state, updatedAt: Math.max(time, now) });
    }
  });
  it.each(['succeeded', 'partial', 'failed', 'unknown', 'cancelled', 'expired', 'needs-review'] as const)(
    'leaves terminal %s records unchanged', async state => {
      const storage = new Storage();
      const value = job();
      value.state = state;
      if (state === 'succeeded' || state === 'partial') {
        value.submittedAt = time;
        value.outcomes = [{ sectionId: 'sample-section-a', status: state === 'succeeded' ? 'enrolled' : 'waitlisted' }];
      }
      storage.seed(value);
      expect(await new EnrollmentJobRepository(storage, () => time + 9_000).recover()).toEqual([value]);
      expect(storage.writes).toBe(0);
    },
  );
  it.each([
    null, { schemaVersion: 1, jobs: 'invalid' }, { schemaVersion: 1, jobs: [job(), job()] },
    { schemaVersion: 1, jobs: [job('first'), job('second')] },
    { schemaVersion: 1, jobs: [{ ...job(), review: null }] }, { schemaVersion: 1, jobs: [], extra: true },
  ])('preserves corrupt saved records without resetting or overwriting %#', async value => {
    const storage = new Storage(); storage.values.set(enrollmentJobsKey, value);
    const repo = new EnrollmentJobRepository(storage, () => time);
    await expect(repo.recover()).rejects.toEqual(code('STORAGE_ERROR'));
    await expect(create(repo, job())).rejects.toEqual(code('STORAGE_ERROR'));
    expect(storage.values.get(enrollmentJobsKey)).toEqual(value);
    expect(storage.writes).toBe(0);
  });
  it('preserves unsupported versions and blocks later operations', async () => {
    const storage = new Storage();
    const value = { schemaVersion: 4, jobs: [job()] };
    storage.values.set(enrollmentJobsKey, value);
    const repo = new EnrollmentJobRepository(storage, () => time);
    await expect(repo.recover()).rejects.toEqual(code('UNSUPPORTED_VERSION'));
    await expect(repo.readAll()).rejects.toEqual(code('STORAGE_ERROR'));
    expect(storage.values.get(enrollmentJobsKey)).toEqual(value);
    expect(storage.writes).toBe(0);
  });
  it.each(['before', 'after'] as const)('blocks after a write fails %s persistence; explicit recovery never retries execution', async failure => {
    const { storage, repo } = await setup();
    await create(repo, job());
    await repo.transition(job().id, 0, { type: 'begin-preflight' });
    storage.failWrite = failure;
    await expect(repo.transition(job().id, 1, { type: 'begin-execution' })).rejects.toMatchObject({
      detail: { code: 'STORAGE_ERROR' }, message: expect.not.stringContaining('Private'),
    });
    expect(storage.writes).toBe(3);
    await expect(repo.transition(job().id, 1, { type: 'begin-execution' })).rejects.toEqual(code('STORAGE_ERROR'));
    await expect(repo.readAll()).rejects.toEqual(code('STORAGE_ERROR'));
    storage.failWrite = null;
    const recovered = await repo.recover();
    expect(recovered[0]!.state).toBe(failure === 'after' ? 'unknown' : 'needs-review');
    expect(storage.writes).toBe(4);
    expect(await repo.transition(job().id, recovered[0]!.revision, { type: 'begin-execution' })).toMatchObject({ changed: false });
    expect(storage.writes).toBe(4);
  });
  it('blocks queued creates following a lost write acknowledgment and retains the saved job', async () => {
    const { storage, repo } = await setup();
    storage.failWrite = 'after';
    const results = await Promise.allSettled([create(repo, job('first')), create(repo, job('second'))]);
    expect(results.every(value => value.status === 'rejected')).toBe(true);
    expect(storage.writes).toBe(1);
    storage.failWrite = null;
    expect(await repo.recover()).toMatchObject([{ id: 'first', state: 'needs-review' }]);
  });
  it('keeps recovery blocked after an uncertain recovery write and reloads on the next explicit attempt', async () => {
    const storage = new Storage(); storage.seed(job());
    storage.failWrite = 'after';
    const repo = new EnrollmentJobRepository(storage, () => time);
    await expect(repo.recover()).rejects.toEqual(code('STORAGE_ERROR'));
    await expect(repo.readAll()).rejects.toEqual(code('STORAGE_ERROR'));
    storage.failWrite = null;
    expect(await repo.recover()).toMatchObject([{ state: 'needs-review', revision: 1 }]);
    expect(storage.writes).toBe(1);
  });
  it('sanitizes read failures, requires recovery, and revalidates storage on every operation', async () => {
    const { storage, repo } = await setup();
    await create(repo, job());
    storage.failRead = true;
    await expect(repo.readAll()).rejects.toMatchObject({ message: expect.not.stringContaining('Private'), detail: { code: 'STORAGE_ERROR' } });
    storage.failRead = false;
    await expect(repo.readAll()).rejects.toEqual(code('STORAGE_ERROR'));
    await repo.recover();
    storage.values.set(enrollmentJobsKey, null);
    await expect(repo.readAll()).rejects.toEqual(code('STORAGE_ERROR'));
    expect(storage.values.get(enrollmentJobsKey)).toBeNull();
  });
  it('rejects full history without eviction and preserves jobs on revision exhaustion', async () => {
    const storage = new Storage();
    const history = Array.from({ length: 100 }, (_, index) => ({ ...job('old-' + index), state: 'cancelled' as JobState }));
    storage.seed(...history);
    const repo = new EnrollmentJobRepository(storage, () => time);
    await repo.recover();
    await expect(create(repo, job())).rejects.toEqual(code('STORAGE_ERROR'));
    expect(storage.writes).toBe(0);
    storage.seed({ ...job(), revision: Number.MAX_SAFE_INTEGER });
    await expect(repo.recover()).rejects.toEqual(code('REVISION_CONFLICT'));
    expect(storage.writes).toBe(0);
  });
  it('checks insert-time freshness and expiry after queued work', async () => {
    const { storage, repo, clock } = await setup();
    clock(time - 1);
    await expect(create(repo, job())).rejects.toEqual(code('STALE_REVIEW'));
    clock(time + 2_000);
    await expect(create(repo, job())).rejects.toEqual(code('INVALID_TIME'));
    clock(time + 119_000);
    await expect(create(repo, job())).rejects.toEqual(code('STALE_REVIEW'));
    expect(storage.writes).toBe(0);
  });
  it('rejects inserting a past scheduled target even if the late cutoff has not elapsed', async () => {
    const { repo, clock } = await setup();
    const value: EnrollmentJob = { ...job(), targetEpochMs: time + 60_000, expiresAt: time + 62_000,
      timing: { mode: 'scheduled', targetEpochMs: time + 60_000, timezone: 'UTC', localDateTime: '2025-01-01T00:01:00', utcOffsetMinutes: 0 } };
    clock(time + 60_000);
    await expect(create(repo, value)).rejects.toEqual(code('INVALID_TIME'));
  });
  it('rejects non-new insertion, missing jobs and invalid clocks without writes', async () => {
    const { storage, repo, clock } = await setup();
    for (const patch of [{ revision: 1 }, { state: 'cancelled' }, { updatedAt: time + 1 }]) {
      await expect(create(repo, { ...job(), ...patch })).rejects.toEqual(code('INVALID_INPUT'));
    }
    await expect(repo.transition('absent', 0, { type: 'cancel' })).rejects.toEqual(code('NOT_FOUND'));
    clock(NaN);
    await expect(repo.recover()).rejects.toEqual(code('INVALID_INPUT'));
    await expect(repo.readAll()).rejects.toEqual(code('STORAGE_ERROR'));
    expect(storage.writes).toBe(0);
  });
});
