import { describe, expect, it, vi } from 'vitest';
import type { EnrollmentJob } from '../../src/shared/domain';
import { parseActivationPayload, payloadForJob } from '../../src/shared/enrollment-activation';
import { EnrollmentJobRepository, enrollmentJobsKey } from '../../src/storage/enrollment-repository';
import type { KeyValueStorage } from '../../src/storage/repository';
import { sampleReview } from '../fixtures/contracts.examples';

const time = Date.UTC(2025, 0, 1);
function job(id = 'synthetic-job'): EnrollmentJob {
  return { id, revision: 0, state: 'armed', termId: sampleReview.termId, termLabel: sampleReview.termLabel,
    selectedSectionIds: [...sampleReview.selectedSectionIds], timing: { mode: 'now' },
    targetEpochMs: time, expiresAt: time + 2_000, createdAt: time, updatedAt: time, submittedAt: null,
    outcomes: [], executionToken: 'synthetic-token-' + id,
    review: { ...structuredClone(sampleReview), observedAt: time - 1_000, expiresAt: time + 119_000 } };
}
function scheduled(): EnrollmentJob {
  return { ...job(), targetEpochMs: time + 60_000, expiresAt: time + 62_000,
    timing: { mode: 'scheduled', targetEpochMs: time + 60_000, timezone: 'UTC',
      localDateTime: '2025-01-01T00:01:00', utcOffsetMinutes: 0 } };
}
class Storage implements KeyValueStorage {
  value: unknown;
  writes = 0;
  fail: 'before' | 'after' | null = null;
  gate?: () => Promise<void>;
  async get(key: string) { expect(key).toBe(enrollmentJobsKey); return structuredClone(this.value); }
  async set(key: string, value: unknown) {
    expect(key).toBe(enrollmentJobsKey);
    this.writes++;
    await this.gate?.();
    if (this.fail === 'before') throw new Error('Synthetic private failure');
    this.value = structuredClone(value);
    if (this.fail === 'after') throw new Error('Synthetic private acknowledgment loss');
  }
}
const fault = (code: string) => expect.objectContaining({ detail: expect.objectContaining({ code }) });
async function setup() {
  const storage = new Storage();
  const clock = vi.fn(() => time);
  const repo = new EnrollmentJobRepository(storage, clock);
  await repo.recover();
  return { storage, clock, repo };
}
function envelope(value = job()) {
  return { schemaVersion: 3, executorRequests: [], jobs: [value], legacyJobIds: [],
    activations: [{ requestId: 'request-one', jobId: value.id, payload: payloadForJob(value) }] };
}

describe('durable activation deduplication', () => {
  it('writes the normalized request and job together and returns one winner for concurrent replay', async () => {
    const { storage, repo } = await setup();
    const results = await Promise.all([
      repo.createForActivation('request-one', payloadForJob(job()), job()),
      repo.createForActivation('request-one', payloadForJob(job()), job('different-candidate')),
    ]);
    expect(results.map(result => result.created)).toEqual([true, false]);
    expect(results.map(result => result.job.id)).toEqual(['synthetic-job', 'synthetic-job']);
    expect(storage.value).toEqual(envelope());
    expect(storage.writes).toBe(1);
  });
  it('does not acknowledge creation before the single combined write completes', async () => {
    const { storage, repo } = await setup();
    let release!: () => void;
    storage.gate = () => new Promise<void>(resolve => { release = resolve; });
    let acknowledged = false;
    const pending = repo.createForActivation('request-one', payloadForJob(job()), job()).then(value => { acknowledged = true; return value; });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(storage.value).toBeUndefined();
    expect(acknowledged).toBe(false);
    release();
    expect((await pending).created).toBe(true);
    expect(storage.value).toEqual(envelope());
  });
  it('normalizes property order including nested timing without changing explicit values', async () => {
    const { storage, repo } = await setup();
    const value = scheduled();
    await repo.createForActivation('request-one', payloadForJob(value), value);
    const replay = { timing: { utcOffsetMinutes: 0, localDateTime: '2025-01-01T00:01:00',
      timezone: 'UTC', targetEpochMs: time + 60_000, mode: 'scheduled' },
    expectedFingerprint: value.review.fingerprint, reviewId: value.review.id };
    expect(await repo.createForActivation('request-one', replay)).toEqual({ created: false, job: value });
    expect(storage.writes).toBe(1);
  });
  it.each([
    { reviewId: 'different-review' }, { expectedFingerprint: 'different-fingerprint' },
    { timing: scheduled().timing },
  ])('rejects a reused ID with changed valid payload %#', async patch => {
    const { storage, repo } = await setup();
    await repo.createForActivation('request-one', payloadForJob(job()), job());
    await expect(repo.createForActivation('request-one', { ...payloadForJob(job()), ...patch }, job('another'))).rejects.toEqual(fault('REQUEST_ID_REUSED'));
    expect(storage.writes).toBe(1);
    expect(storage.value).toEqual(envelope());
  });
  it('rejects changed timing fields even when two zone names describe the same instant', async () => {
    const { repo } = await setup();
    const value = scheduled();
    await repo.createForActivation('request-one', payloadForJob(value), value);
    const payload = payloadForJob(value);
    if (payload.timing.mode !== 'scheduled') throw new Error('Fixture');
    payload.timing.timezone = 'Etc/UTC';
    await expect(repo.createForActivation('request-one', payload)).rejects.toEqual(fault('REQUEST_ID_REUSED'));
  });
  it('serializes conflicting payloads under one request ID', async () => {
    const { storage, repo } = await setup();
    const results = await Promise.allSettled([
      repo.createForActivation('request-one', payloadForJob(job()), job()),
      repo.createForActivation('request-one', { ...payloadForJob(job()), reviewId: 'different' }, job('another')),
    ]);
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: { created: true } });
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'REQUEST_ID_REUSED' } } });
    expect(storage.writes).toBe(1);
  });
  it('does not let a different request ID bypass the active-job rule', async () => {
    const { repo, storage } = await setup();
    await repo.createForActivation('request-one', payloadForJob(job()), job());
    await expect(repo.createForActivation('request-two', payloadForJob(job('another')), job('another'))).rejects.toEqual(fault('JOB_ALREADY_ACTIVE'));
    expect(storage.writes).toBe(1);
  });
  it('returns current stopped state rather than the original armed response and does not read the clock', async () => {
    const { repo, storage, clock } = await setup();
    await repo.createForActivation('request-one', payloadForJob(job()), job());
    await repo.transition(job().id, 0, { type: 'cancel' });
    clock.mockImplementation(() => { throw new Error('A replay must not check freshness'); });
    const result = await repo.createForActivation('request-one', payloadForJob(job()));
    expect(result).toMatchObject({ created: false, job: { state: 'cancelled', revision: 1 } });
    result.job.review.sections[0]!.title = 'changed';
    expect((await repo.createForActivation('request-one', payloadForJob(job()))).job.review.sections[0]!.title).toBe(sampleReview.sections[0]!.title);
    expect(storage.writes).toBe(2);
  });
  it('retains replay after restart, review expiry and the scheduled target without rearming', async () => {
    const { repo, storage } = await setup();
    const value = scheduled();
    await repo.createForActivation('request-one', payloadForJob(value), value);
    const fresh = new EnrollmentJobRepository(storage, () => time + 1_000_000);
    await fresh.recover();
    expect(await fresh.createForActivation('request-one', payloadForJob(value))).toMatchObject({
      created: false, job: { id: value.id, state: 'expired', revision: 1 },
    });
    expect(storage.writes).toBe(2);
  });
  it('retains unknown execution across restart and replay without another dispatch transition', async () => {
    const { repo, storage } = await setup();
    await repo.createForActivation('request-one', payloadForJob(job()), job());
    await repo.transition(job().id, 0, { type: 'begin-preflight' });
    await repo.transition(job().id, 1, { type: 'begin-execution' });
    const fresh = new EnrollmentJobRepository(storage, () => time + 1);
    await fresh.recover();
    expect(await fresh.createForActivation('request-one', payloadForJob(job()), job('another'))).toMatchObject({
      created: false, job: { state: 'unknown', revision: 3 },
    });
    expect(storage.writes).toBe(4);
  });
  it('keeps request association after a committed write loses its acknowledgment', async () => {
    const { repo, storage } = await setup();
    storage.fail = 'after';
    await expect(repo.createForActivation('request-one', payloadForJob(job()), job())).rejects.toEqual(fault('STORAGE_ERROR'));
    await expect(repo.createForActivation('request-one', payloadForJob(job()))).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.fail = null;
    const fresh = new EnrollmentJobRepository(storage, () => time + 1);
    await fresh.recover();
    expect(await fresh.createForActivation('request-one', payloadForJob(job()))).toMatchObject({
      created: false, job: { id: job().id, state: 'needs-review' },
    });
    expect(storage.writes).toBe(2);
  });
  it('does not invent a request mapping if the combined write never persisted', async () => {
    const { repo, storage } = await setup();
    storage.fail = 'before';
    await expect(repo.createForActivation('request-one', payloadForJob(job()), job())).rejects.toEqual(fault('STORAGE_ERROR'));
    storage.fail = null;
    await repo.recover();
    await expect(repo.createForActivation('request-one', payloadForJob(job()))).rejects.toEqual(fault('NOT_FOUND'));
    expect(storage.value).toBeUndefined();
    expect(storage.writes).toBe(1);
  });
  it('detaches payload before queueing and requires the candidate to match the request', async () => {
    const { repo, storage } = await setup();
    const payload = payloadForJob(job());
    const pending = repo.createForActivation('request-one', payload, job());
    payload.reviewId = 'mutated';
    expect((await pending).created).toBe(true);
    expect(storage.value).toEqual(envelope());
    await repo.transition(job().id, 0, { type: 'cancel' });
    await expect(repo.createForActivation('request-two', { ...payloadForJob(job()), expectedFingerprint: 'different' }, job('another'))).rejects.toEqual(fault('INVALID_INPUT'));
    expect(storage.writes).toBe(2);
  });
  it('keeps replay available at full capacity and retains every mapping', async () => {
    const storage = new Storage();
    const jobs = Array.from({ length: 100 }, (_, index) => ({ ...job('job-' + index), state: 'cancelled' as const }));
    const activations = jobs.map(value => ({ requestId: 'request-' + value.id, jobId: value.id, payload: payloadForJob(value) }));
    const original = { schemaVersion: 3, executorRequests: [], jobs, activations, legacyJobIds: [] };
    storage.value = structuredClone(original);
    const repo = new EnrollmentJobRepository(storage, () => time);
    await repo.recover();
    expect(await repo.createForActivation('request-job-0', payloadForJob(jobs[0]!))).toEqual({ job: jobs[0], created: false });
    await expect(repo.createForActivation('new-request', payloadForJob(job()), job())).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(storage.value).toEqual(original);
    expect(storage.writes).toBe(0);
  });
});

describe('deduplication storage migration and validation', () => {
  it.each(['armed', 'cancelled'] as const)('migrates legacy %s records with recovery in one write without guessing request IDs', async state => {
    const storage = new Storage();
    const legacy = { ...job(), state };
    storage.value = { schemaVersion: 1, jobs: [legacy] };
    const repo = new EnrollmentJobRepository(storage, () => time);
    const recovered = await repo.recover();
    expect(storage.value).toEqual({ schemaVersion: 3, executorRequests: [], jobs: recovered, activations: [], legacyJobIds: [legacy.id] });
    expect(recovered[0]).toMatchObject({ id: legacy.id, executionToken: legacy.executionToken, state: state === 'armed' ? 'needs-review' : state });
    await expect(repo.createForActivation('unknown-legacy-request', payloadForJob(legacy))).rejects.toEqual(fault('NOT_FOUND'));
    await repo.recover();
    expect(storage.writes).toBe(1);
  });
  it('migrates a stored empty v1 envelope but never writes for absent storage', async () => {
    const storage = new Storage(); storage.value = { schemaVersion: 1, jobs: [] };
    await new EnrollmentJobRepository(storage, () => time).recover();
    expect(storage.value).toEqual({ schemaVersion: 3, executorRequests: [], jobs: [], activations: [], legacyJobIds: [] });
    expect(storage.writes).toBe(1);
  });
  it.each(['before', 'after'] as const)('requires explicit recovery after migration write fails %s persistence', async fail => {
    const storage = new Storage();
    const original = { schemaVersion: 1, jobs: [job()] };
    storage.value = structuredClone(original); storage.fail = fail;
    const repo = new EnrollmentJobRepository(storage, () => time);
    await expect(repo.recover()).rejects.toEqual(fault('STORAGE_ERROR'));
    await expect(repo.readAll()).rejects.toEqual(fault('STORAGE_ERROR'));
    if (fail === 'before') expect(storage.value).toEqual(original);
    storage.fail = null;
    expect(await repo.recover()).toMatchObject([{ state: 'needs-review', revision: 1 }]);
    expect(storage.writes).toBe(fail === 'before' ? 2 : 1);
  });
  it.each([
    { activations: undefined },
    { activations: [] },
    { legacyJobIds: undefined },
    { legacyJobIds: ['absent'] },
    { legacyJobIds: [job().id] },
    { activations: [], legacyJobIds: [job().id, job().id] },
    { activations: [{ requestId: 'request-one', jobId: 'absent', payload: payloadForJob(job()) }] },
    { activations: [{ requestId: '', jobId: job().id, payload: payloadForJob(job()) }] },
    { activations: [{ requestId: 'request-one', jobId: job().id, payload: { ...payloadForJob(job()), reviewId: 'different' } }] },
    { activations: [envelope().activations[0], envelope().activations[0]] },
    { activations: [envelope().activations[0], { ...envelope().activations[0], requestId: 'another-request' }] },
    { activations: [{ ...envelope().activations[0], extra: true }] },
  ])('rejects corrupt associations without replacing saved data %#', async patch => {
    const storage = new Storage(); storage.value = { ...envelope(), ...patch };
    const original = structuredClone(storage.value);
    const repo = new EnrollmentJobRepository(storage, () => time);
    await expect(repo.recover()).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(storage.value).toEqual(original);
    expect(storage.writes).toBe(0);
  });
  it('rejects duplicate request IDs linked to different valid jobs', async () => {
    const storage = new Storage();
    const jobs = [job(), job('another')].map(value => ({ ...value, state: 'cancelled' as const }));
    storage.value = { schemaVersion: 3, executorRequests: [], jobs, legacyJobIds: [], activations: jobs.map(value => ({ requestId: 'same-request', jobId: value.id, payload: payloadForJob(value) })) };
    await expect(new EnrollmentJobRepository(storage, () => time).recover()).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(storage.writes).toBe(0);
  });
  it('requires explicit migration if a legacy envelope appears after initialization', async () => {
    const { repo, storage } = await setup();
    storage.value = { schemaVersion: 1, jobs: [] };
    await expect(repo.readAll()).rejects.toEqual(fault('STORAGE_ERROR'));
    expect(storage.writes).toBe(0);
    await repo.recover();
    expect(storage.value).toEqual({ schemaVersion: 3, executorRequests: [], jobs: [], activations: [], legacyJobIds: [] });
  });
  it.each([
    null, {}, { ...payloadForJob(job()), extra: true }, { ...payloadForJob(job()), reviewId: '' },
    { ...payloadForJob(job()), timing: { mode: 'now', timezone: 'UTC' } },
    { ...payloadForJob(job()), timing: { mode: 'scheduled', targetEpochMs: time } },
  ])('rejects malformed payloads before storage %#', payload => {
    expect(() => parseActivationPayload(payload)).toThrow();
  });
  it('rejects accessors without evaluating them and rejects invalid request IDs', async () => {
    const { repo, storage } = await setup();
    const getter = vi.fn(() => 'synthetic');
    const payload = Object.defineProperty(payloadForJob(job()), 'reviewId', { enumerable: true, get: getter });
    expect(() => repo.createForActivation('request-one', payload, job())).toThrow();
    expect(() => repo.createForActivation('', payloadForJob(job()), job())).toThrow();
    expect(() => repo.createForActivation('x'.repeat(129), payloadForJob(job()), job())).toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(storage.writes).toBe(0);
  });
});
