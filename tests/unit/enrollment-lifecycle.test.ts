import { describe, expect, it, vi } from 'vitest';
import { transitionEnrollmentLifecycle, type EnrollmentLifecycle, type LifecycleEvent } from '../../src/shared/enrollment-lifecycle';
import { ContractFault } from '../../src/shared/validation';
import type { JobState } from '../../src/shared/domain';

const armed: EnrollmentLifecycle = {
  id: 'synthetic-job', revision: 0, state: 'armed', targetEpochMs: 10_000,
  expiresAt: 12_000, updatedAt: 9_000, submittedAt: null,
};
const preflight: EnrollmentLifecycle = { ...armed, state: 'preflight', revision: 1, updatedAt: 9_500 };
const executing: EnrollmentLifecycle = { ...preflight, state: 'executing', revision: 2, updatedAt: 10_000 };
const submitted: EnrollmentLifecycle = { ...executing, revision: 3, submittedAt: 10_100, updatedAt: 10_100 };
const decide = (job: EnrollmentLifecycle, type: LifecycleEvent['type'], now = 10_500) =>
  transitionEnrollmentLifecycle(job, { type }, job.revision, now);
function expectFault(operation: () => unknown, code: string) {
  let thrown: unknown;
  try { operation(); } catch (error) { thrown = error; }
  expect(thrown).toBeInstanceOf(ContractFault);
  expect((thrown as ContractFault).detail.code).toBe(code);
}

describe('pure enrollment lifecycle decisions', () => {
  it('moves through preflight and execution with explicit revision changes and no mutation', () => {
    const input = Object.freeze({ ...armed });
    const checked = decide(input, 'begin-preflight', 9_500);
    expect(checked).toEqual({ job: preflight, changed: true, cancellation: 'none' });
    expect(decide(checked.job, 'begin-execution', 10_000).job).toEqual(executing);
    expect(input).toEqual(armed);
  });

  it('rejects early dispatch and bypassing preflight', () => {
    expectFault(() => decide(preflight, 'begin-execution', 9_999), 'INVALID_TIME');
    expectFault(() => decide(armed, 'begin-execution'), 'INVALID_INPUT');
    expectFault(() => decide(executing, 'begin-preflight'), 'INVALID_INPUT');
  });

  it('accepts the last millisecond before expiry, but expires exactly at the deadline', () => {
    expect(decide(preflight, 'begin-execution', 11_999).job.state).toBe('executing');
    expect(decide(preflight, 'begin-execution', 12_000).job.state).toBe('expired');
  });

  it.each(['begin-preflight', 'begin-execution', 'cancel', 'recover', 'invalidate', 'timeout'] as const)(
    'expires a stale preflight rather than handling %s', type => {
      const result = decide(preflight, type, 12_001);
      expect(result.job).toMatchObject({ state: 'expired', submittedAt: null, revision: 2 });
    },
  );

  it('does not treat receipt of a duplicate event as another execution or revision', () => {
    for (const [job, type] of [[preflight, 'begin-preflight'], [executing, 'begin-execution']] as const) {
      const result = decide(job, type);
      expect(result).toEqual({ job, changed: false, cancellation: 'none' });
      expect(result.job).not.toBe(job);
    }
    expect(decide(submitted, 'begin-execution', 20_000).job).toEqual(submitted);
    expectFault(() => transitionEnrollmentLifecycle(executing, { type: 'begin-execution' }, preflight.revision, 10_100), 'REVISION_CONFLICT');
  });

  it('requires the future serialized writer to compare the revision before accepting a competing decision', () => {
    const first = decide(preflight, 'begin-execution', 10_000);
    expectFault(() => transitionEnrollmentLifecycle(first.job, { type: 'cancel' }, preflight.revision, 10_001), 'REVISION_CONFLICT');
    // Two calls against the same old input can both propose a decision; this is not a lock.
    expect(decide(preflight, 'begin-execution', 10_000)).toEqual(first);
  });

  it.each([armed, preflight])('cancels before executor entry %#', job => {
    const result = decide(job, 'cancel');
    expect(result.job).toMatchObject({ state: 'cancelled', submittedAt: null });
    expect(result.changed).toBe(true);
  });

  it('requires owner confirmation once execution could have begun, then accepts a no-dispatch acknowledgment', () => {
    expect(decide(executing, 'cancel')).toEqual({ job: executing, changed: false, cancellation: 'executor-confirmation-required' });
    expect(decide(executing, 'cancellation-confirmed').job.state).toBe('cancelled');
    expectFault(() => decide(armed, 'cancellation-confirmed'), 'INVALID_INPUT');
  });

  it('does not accept cancellation acknowledgment after a racing submission decision', () => {
    expect(decide(executing, 'cancel').cancellation).toBe('executor-confirmation-required');
    const dispatched = transitionEnrollmentLifecycle(executing,
      { type: 'submission-observed', submittedAt: 10_100 }, executing.revision, 10_100).job;
    expectFault(() => transitionEnrollmentLifecycle(dispatched,
      { type: 'cancellation-confirmed' }, executing.revision, 10_200), 'REVISION_CONFLICT');
    expectFault(() => decide(dispatched, 'cancellation-confirmed', 10_200), 'TOO_LATE_TO_CANCEL');
  });
  it.each(['cancel', 'cancellation-confirmed'] as const)('rejects %s after observed submission', type => {
    expectFault(() => decide(submitted, type), 'TOO_LATE_TO_CANCEL');
  });

  it.each(['recover', 'invalidate', 'timeout'] as const)('stops pre-execution jobs for %s without claiming cancellation', type => {
    expect(decide(armed, type).job.state).toBe('needs-review');
    expect(decide(preflight, type).job.state).toBe('needs-review');
  });

  it.each(['recover', 'invalidate', 'timeout'] as const)('marks both recorded and unrecorded dispatch uncertain on %s', type => {
    for (const job of [executing, submitted]) {
      const unknown = decide(job, type, 13_000).job;
      expect(unknown).toMatchObject({ state: 'unknown', submittedAt: job.submittedAt });
      expect(decide(unknown, 'begin-execution', 13_001).changed).toBe(false);
      expectFault(() => decide(unknown, 'cancel', 13_001), 'TOO_LATE_TO_CANCEL');
    }
  });

  it.each([armed, preflight, executing, submitted])('stops on a backwards clock without decreasing updatedAt %#', job => {
    const result = decide(job, 'begin-execution', job.updatedAt - 1);
    expect(result.job.state).toBe(job.state === 'executing' ? 'unknown' : 'needs-review');
    expect(result.job.updatedAt).toBe(job.updatedAt);
    expect(result.job.submittedAt).toBe(job.submittedAt);
  });

  it('records an observed dispatch without claiming enrollment success; exact replay is a no-op', () => {
    const event = { type: 'submission-observed', submittedAt: 10_100 };
    const result = transitionEnrollmentLifecycle(executing, event, executing.revision, 10_100);
    expect(result.job).toEqual(submitted);
    expect(transitionEnrollmentLifecycle(result.job, event, result.job.revision, 10_200)).toEqual({ job: submitted, changed: false, cancellation: 'none' });
    const conflicting = transitionEnrollmentLifecycle(submitted, { ...event, submittedAt: 10_200 }, submitted.revision, 10_300);
    expect(conflicting.job).toMatchObject({ state: 'unknown', submittedAt: 10_100 });
  });

  it.each([9_999, 12_000, 12_001])('retains out-of-window dispatch %s as unknown', submittedAt => {
    const result = transitionEnrollmentLifecycle(executing, { type: 'submission-observed', submittedAt }, executing.revision, 13_000);
    expect(result.job).toMatchObject({ state: 'unknown', submittedAt });
  });

  it('rejects an impossible future observation or observation before execution entry', () => {
    expectFault(() => transitionEnrollmentLifecycle(executing, { type: 'submission-observed', submittedAt: 10_501 }, 2, 10_500), 'INVALID_INPUT');
    expectFault(() => transitionEnrollmentLifecycle(armed, { type: 'submission-observed', submittedAt: 10_100 }, 0, 10_500), 'INVALID_INPUT');
  });

  it('allows a known preflight failure but never assumes execution failed without submission', () => {
    expect(decide(preflight, 'preflight-failed').job).toMatchObject({ state: 'failed', submittedAt: null });
    expectFault(() => decide(executing, 'preflight-failed'), 'INVALID_INPUT');
  });

  it.each(['succeeded', 'partial', 'failed', 'unknown', 'cancelled', 'expired', 'needs-review'] as const)(
    'keeps %s terminal despite delayed callbacks, restart or clock rollback', state => {
      const job: EnrollmentLifecycle = { ...submitted, state, submittedAt: ['succeeded', 'partial', 'failed', 'unknown'].includes(state) ? 10_100 : null };
      for (const type of ['begin-preflight', 'begin-execution', 'recover', 'invalidate', 'timeout', 'cancellation-confirmed'] as const) {
        expect(decide(job, type, 8_000)).toEqual({ job, changed: false, cancellation: 'none' });
      }
    },
  );

  it.each([
    null, {}, { ...armed, state: 'draft' }, { ...armed, revision: -1 },
    { ...armed, expiresAt: armed.targetEpochMs }, { ...armed, updatedAt: NaN },
    { ...armed, submittedAt: 9_500 }, { ...submitted, submittedAt: 10_600 },
    { ...submitted, state: 'cancelled' }, { ...submitted, state: 'succeeded', submittedAt: null },
    { ...executing, updatedAt: 9_999 },
    { ...armed, executionToken: 'not-part-of-projection' }, Object.create(armed),
  ])('rejects malformed lifecycle projections %#', input => {
    expectFault(() => transitionEnrollmentLifecycle(input, { type: 'cancel' }, 0, 10_500), 'INVALID_INPUT');
  });

  it.each([{}, { type: 'retry' }, { type: 'settle', state: 'succeeded' }, { type: 'cancel', submittedAt: null },
    { type: 'submission-observed' }, { type: 'submission-observed', submittedAt: 1.5 },
    { type: 'cancel', executionToken: 'not-authority' }])('rejects unknown or malformed events %#', event => {
    expectFault(() => transitionEnrollmentLifecycle(armed, event, 0, 10_500), 'INVALID_INPUT');
  });

  it('does not invoke accessor fields in a job or event', () => {
    const getter = vi.fn(() => 'cancel');
    const event = Object.defineProperty({}, 'type', { enumerable: true, get: getter });
    expectFault(() => transitionEnrollmentLifecycle(armed, event, 0, 10_500), 'INVALID_INPUT');
    const job = Object.defineProperty({ ...armed }, 'state', { enumerable: true, get: getter });
    expectFault(() => transitionEnrollmentLifecycle(job, { type: 'cancel' }, 0, 10_500), 'INVALID_INPUT');
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects invalid clocks and revision exhaustion without mutating the input', () => {
    expectFault(() => decide(armed, 'cancel', Infinity), 'INVALID_INPUT');
    const job = Object.freeze({ ...armed, revision: Number.MAX_SAFE_INTEGER });
    expectFault(() => decide(job, 'cancel'), 'REVISION_CONFLICT');
    expect(job.state).toBe('armed');
  });

  it('cannot produce success or partial outcomes through any implemented transition', () => {
    const types = ['begin-preflight', 'begin-execution', 'cancel', 'cancellation-confirmed', 'preflight-failed', 'invalidate', 'recover', 'timeout'] as const;
    for (const job of [armed, preflight, executing, submitted]) {
      for (const type of types) {
        try {
          const result = decide(job, type);
          expect(['succeeded', 'partial'] satisfies JobState[]).not.toContain(result.job.state);
        } catch (error) { expect(error).toBeInstanceOf(ContractFault); }
      }
    }
  });
});
