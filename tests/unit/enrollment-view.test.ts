import { describe, expect, it } from 'vitest';
import type { EnrollmentJob, JobState } from '../../src/shared/domain';
import { parseEnrollmentJobView, parseStoredEnrollmentJob } from '../../src/shared/enrollment-records';
import { parseEnrollmentJobResponse, projectEnrollmentJob, type EnrollmentJobRequest } from '../../src/shared/enrollment-view';
import { parseFoundationRequest } from '../../src/shared/foundation-rpc';
import { executorJob, executorTime as time } from '../fixtures/enrollment-executor';

function completed(state: JobState = 'succeeded'): EnrollmentJob {
  const job = executorJob();
  return { ...job, state, revision: 3, updatedAt: time + 100, submittedAt: time + 100,
    outcomes: [{ sectionId: job.selectedSectionIds[0]!,
      status: state === 'partial' ? 'waitlisted' : state === 'failed' ? 'rejected' : state === 'unknown' ? 'unknown' : 'enrolled',
      reason: 'unconfirmed', message: 'Synthetic private portal detail' }] };
}
const read = { protocolVersion: 1, requestId: 'read-request', type: 'enrollment.read',
  payload: { jobId: executorJob().id } } satisfies EnrollmentJobRequest;
const cancel = { protocolVersion: 1, requestId: 'cancel-request', type: 'enrollment.cancel',
  payload: { jobId: executorJob().id, expectedRevision: 0 } } satisfies EnrollmentJobRequest;
const activate = { protocolVersion: 1, requestId: 'activate-request', type: 'enrollment.activate',
  payload: { reviewId: 'review-id', expectedFingerprint: 'fingerprint', timing: { mode: 'now' } } } satisfies EnrollmentJobRequest;
function success(request: EnrollmentJobRequest = read) {
  return { protocolVersion: 1, requestId: request.requestId, type: request.type, ok: true,
    data: projectEnrollmentJob(completed()) };
}

describe('public enrollment snapshots', () => {
  it.each<JobState>(['armed', 'preflight', 'executing', 'succeeded', 'partial', 'failed', 'unknown', 'cancelled', 'expired', 'needs-review'])(
    'preserves valid %s state without making a lifecycle decision', state => {
      const job = ['succeeded', 'partial', 'failed', 'unknown'].includes(state) ? completed(state) : { ...executorJob(), state };
      expect(projectEnrollmentJob(job).state).toBe(state);
      expect(parseEnrollmentJobView(projectEnrollmentJob(job))).toEqual(projectEnrollmentJob(job));
    });
  it('omits the token, review, target identity and raw outcome message with exact public keys', () => {
    const job = completed();
    const result = projectEnrollmentJob(job);
    expect(Object.keys(result).sort()).toEqual(['id', 'revision', 'state', 'termId', 'termLabel', 'selectedSectionIds',
      'timing', 'targetEpochMs', 'expiresAt', 'createdAt', 'updatedAt', 'submittedAt', 'outcomes'].sort());
    expect(result.outcomes).toEqual([{ sectionId: job.selectedSectionIds[0], status: 'enrolled', reason: 'unconfirmed' }]);
    for (const privateValue of [job.executionToken, job.review.fingerprint, job.review.target.documentId, 'Synthetic private portal detail']) {
      expect(JSON.stringify(result)).not.toContain(privateValue);
    }
    expect(job.outcomes[0]!.message).toBe('Synthetic private portal detail');
  });
  it('detaches all nested values in both directions', () => {
    const job = completed();
    const view = projectEnrollmentJob(job);
    const parsed = parseEnrollmentJobView(view);
    job.selectedSectionIds.push('source-change'); job.outcomes[0]!.status = 'unknown';
    view.selectedSectionIds.push('view-change'); view.outcomes[0]!.status = 'rejected'; view.timing.mode = 'now';
    expect(parsed.selectedSectionIds).toHaveLength(1);
    expect(parsed.outcomes[0]!.status).toBe('enrolled');
    expect(parsed.timing).not.toBe(view.timing);
  });
  it('keeps historical scheduled timing detached and valid', () => {
    const job = executorJob();
    job.timing = { mode: 'scheduled', targetEpochMs: time + 1_000, timezone: 'UTC',
      localDateTime: '2025-01-01T00:00:01', utcOffsetMinutes: 0 };
    job.targetEpochMs = time + 1_000;
    const view = projectEnrollmentJob(job);
    expect(view.timing).toEqual(job.timing); expect(view.timing).not.toBe(job.timing);
  });
  it('preserves unknown outcomes and the distinction between no result and no dispatch', () => {
    for (const submittedAt of [null, time + 100]) {
      const job = { ...executorJob(), state: 'unknown' as const, submittedAt, updatedAt: time + 100 };
      expect(projectEnrollmentJob(job)).toMatchObject({ state: 'unknown', submittedAt, outcomes: [] });
    }
    const job = completed('unknown'); job.submittedAt = time - 1;
    expect(projectEnrollmentJob(job).state).toBe('unknown');
  });
  it.each(['executionToken', 'review', 'target', 'executorRequests', 'activations', 'requestId'])(
    'rejects leaked %s rather than silently stripping it on receipt', key => {
      expect(() => parseEnrollmentJobView({ ...projectEnrollmentJob(completed()), [key]: 'private' })).toThrow();
    });
  it('rejects raw outcome messages in a public snapshot', () => {
    const view = projectEnrollmentJob(completed());
    view.outcomes[0]!.message = 'private';
    expect(() => parseEnrollmentJobView(view)).toThrow();
  });
  it.each([
    { revision: -1 }, { state: 'invented' }, { termId: '' }, { termLabel: 'x'.repeat(121) },
    { selectedSectionIds: [] }, { selectedSectionIds: ['a', 'a'] }, { targetEpochMs: time + 1 },
    { createdAt: time + 101 }, { updatedAt: time - 1 }, { submittedAt: null }, { outcomes: [] },
    { outcomes: [{ sectionId: 'unselected', status: 'enrolled' }] },
    { outcomes: [{ sectionId: executorJob().selectedSectionIds[0], status: 'rejected' }] },
  ])('rejects inconsistent public snapshots %#', patch => {
    expect(() => parseEnrollmentJobView({ ...projectEnrollmentJob(completed()), ...patch })).toThrow();
  });
  it('rejects invalid internal records before projecting any fields', () => {
    const job = completed(); job.review.termId = 'different-term';
    expect(() => projectEnrollmentJob(job)).toThrow();
    expect(() => projectEnrollmentJob({ ...completed(), executionToken: '' })).toThrow();
    expect(() => projectEnrollmentJob({ ...completed(), internalSecret: 'unexpected' })).toThrow();
  });
  it('retains internal message compatibility without permitting public messages', () => {
    expect(parseStoredEnrollmentJob(completed()).outcomes[0]!.message).toBe('Synthetic private portal detail');
    expect(projectEnrollmentJob(completed()).outcomes[0]).not.toHaveProperty('message');
  });
  it('rejects accessors without invoking them and rejects hidden or symbol fields', () => {
    let invoked = false;
    const accessor = { ...projectEnrollmentJob(completed()) };
    Object.defineProperty(accessor, 'termLabel', { enumerable: true, get() { invoked = true; return 'secret'; } });
    expect(() => parseEnrollmentJobView(accessor)).toThrow(); expect(invoked).toBe(false);
    for (const key of ['private', Symbol('private')]) {
      const value = projectEnrollmentJob(completed()); Object.defineProperty(value, key, { value: 'private' });
      expect(() => parseEnrollmentJobView(value)).toThrow();
    }
  });
});

describe('future enrollment response boundary', () => {
  it.each([read, cancel, activate])('accepts detached correlated $type results', request => {
    const wire = success(request); const result = parseEnrollmentJobResponse(wire, request);
    expect(result).toEqual(wire);
    wire.data.selectedSectionIds.push('mutated');
    if (!result.ok) throw new Error('Expected success');
    expect(result.data.selectedSectionIds).toHaveLength(1);
  });
  it.each([read, cancel])('rejects another job in a $type response', request => {
    const wire = success(request); wire.data.id = 'another-job';
    expect(() => parseEnrollmentJobResponse(wire, request)).toThrow();
  });
  it.each([
    { requestId: 'other-request' }, { type: 'enrollment.cancel' }, { protocolVersion: 2 },
    { ok: 'true' }, { ok: undefined }, { error: undefined }, { payload: {} }, { executionToken: 'private' },
    { data: completed() }, { data: undefined },
  ])('rejects mismatched or unsafe response envelopes %#', patch => {
    expect(() => parseEnrollmentJobResponse({ ...success(), ...patch }, read)).toThrow();
  });
  it('accepts detached typed failures without a job payload', () => {
    const wire = { protocolVersion: 1, requestId: read.requestId, type: read.type, ok: false,
      error: { code: 'NOT_FOUND', message: 'No saved job.', field: 'jobId' } };
    const parsed = parseEnrollmentJobResponse(wire, read);
    expect(parsed).toEqual(wire); wire.error.message = 'changed';
    if (parsed.ok) throw new Error('Expected error');
    expect(parsed.error.message).toBe('No saved job.');
    expect(() => parseEnrollmentJobResponse({ ...wire, data: undefined }, read)).toThrow();
  });
  it.each([
    { code: 'MADE_UP', message: '' }, { code: 'NOT_FOUND' }, { code: 'NOT_FOUND', message: '<raw>' },
    { code: 'NOT_FOUND', message: 'x'.repeat(301) }, { code: 'NOT_FOUND', message: '', field: 'x'.repeat(101) },
    { code: 'NOT_FOUND', message: '', executionToken: 'private' }, { code: 'NOT_FOUND', message: 'line\nbreak' },
  ])('rejects malformed errors %#', error => {
    expect(() => parseEnrollmentJobResponse({ protocolVersion: 1, requestId: read.requestId,
      type: read.type, ok: false, error }, read)).toThrow();
  });
  it.each([read, cancel, activate])('leaves $type disabled in the production request parser', request => {
    expect(() => parseFoundationRequest(request)).toThrow(expect.objectContaining({
      detail: expect.objectContaining({ code: 'FEATURE_UNAVAILABLE' }),
    }));
  });
});
