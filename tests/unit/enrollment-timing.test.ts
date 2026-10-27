import { describe, expect, it, vi } from 'vitest';
import { parseEnrollmentTiming } from '../../src/shared/enrollment-timing';
import { ContractFault } from '../../src/shared/validation';
import { parseFoundationRequest } from '../../src/shared/foundation-rpc';
import type { EnrollmentTiming } from '../../src/shared/domain';

const now = Date.parse('2027-01-01T00:00:00Z');
const scheduled = {
  mode: 'scheduled', targetEpochMs: Date.parse('2027-01-15T15:00:00Z'),
  timezone: 'America/Chicago', localDateTime: '2027-01-15T09:00:00', utcOffsetMinutes: -360,
} satisfies EnrollmentTiming;
const at = (localDateTime: string, utc: string, timezone = 'America/Chicago', utcOffsetMinutes = -360) => ({
  mode: 'scheduled', localDateTime, targetEpochMs: Date.parse(utc), timezone, utcOffsetMinutes,
});
function fault(value: unknown, code: string, clock = now) {
  let thrown: unknown;
  try { parseEnrollmentTiming(value, clock); } catch (error) { thrown = error; }
  expect(thrown).toBeInstanceOf(ContractFault);
  expect((thrown as ContractFault).detail.code).toBe(code);
}

describe('enrollment timing boundary (no execution)', () => {
  it('accepts only the immediate-mode shape and returns a fresh value', () => {
    const input = { mode: 'now' };
    const parsed = parseEnrollmentTiming(input, now);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
  });

  it.each([
    scheduled,
    at('2027-07-15T09:00:00', '2027-07-15T14:00:00Z', 'America/Chicago', -300),
    at('2027-01-15T00:00:00', '2027-01-15T06:00:00Z'),
    at('2027-01-15T09:00:00', '2027-01-15T03:15:00Z', 'Asia/Kathmandu', 345),
    at('2027-01-15T09:00:00', '2027-01-14T19:00:00Z', 'Pacific/Kiritimati', 840),
    at('2027-01-15T09:00:00', '2027-01-15T19:00:00Z', 'Pacific/Honolulu', -600),
    at('2028-02-29T23:59:59', '2028-02-29T23:59:59Z', 'UTC', 0),
    at('2000-02-29T12:00:00', '2000-02-29T12:00:00Z', 'UTC', 0),
    at('0099-01-15T09:00:00', '0099-01-15T09:00:00Z', 'UTC', 0),
  ])('accepts consistent zone/offset/calendar values %#', input => {
    const parsed = parseEnrollmentTiming(input, Math.min(now, input.targetEpochMs - 1));
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
  });

  it.each([
    at('2027-11-07T01:30:00', '2027-11-07T06:30:00Z', 'America/Chicago', -300),
    at('2027-11-07T01:30:00', '2027-11-07T07:30:00Z', 'America/Chicago', -360),
    at('2027-04-04T01:45:00', '2027-04-03T14:45:00Z', 'Australia/Lord_Howe', 660),
    at('2027-04-04T01:45:00', '2027-04-03T15:15:00Z', 'Australia/Lord_Howe', 630),
  ])('accepts either repeated-time occurrence only with its matching explicit offset %#', input => {
    expect(parseEnrollmentTiming(input, now)).toEqual(input);
  });

  it.each([
    at('2027-03-14T02:30:00', '2027-03-14T08:30:00Z', 'America/Chicago', -360),
    at('2027-03-14T02:30:00', '2027-03-14T07:30:00Z', 'America/Chicago', -300),
    at('2027-10-03T02:15:00', '2027-10-02T15:45:00Z', 'Australia/Lord_Howe', 630),
    at('2027-10-03T02:15:00', '2027-10-02T15:15:00Z', 'Australia/Lord_Howe', 660),
    at('2027-11-07T01:30:00', '2027-11-07T08:30:00Z', 'America/Chicago', -420),
    { ...scheduled, timezone: 'America/New_York' },
    { ...scheduled, utcOffsetMinutes: 360 },
    { ...scheduled, targetEpochMs: scheduled.targetEpochMs + 1000 },
    { ...scheduled, targetEpochMs: scheduled.targetEpochMs + 1 },
  ])('rejects nonexistent wall times and mismatched zone/offset/epoch values %#', input => fault(input, 'INVALID_TIME'));

  it.each(['2027-02-29T09:00:00', '2100-02-29T09:00:00', '2027-04-31T09:00:00',
    '2027-00-15T09:00:00', '2027-13-15T09:00:00', '2027-01-00T09:00:00',
    '2027-01-15T24:00:00', '2027-01-15T09:60:00', '2027-01-15T09:00:60', '0000-01-15T09:00:00',
  ])('rejects calendar rollover instead of silently changing %s', localDateTime => {
    fault({ ...scheduled, localDateTime }, 'INVALID_TIME');
  });

  it('requires the target to be strictly future at the supplied clock reading', () => {
    expect(parseEnrollmentTiming(scheduled, scheduled.targetEpochMs - 1)).toEqual(scheduled);
    fault(scheduled, 'INVALID_TIME', scheduled.targetEpochMs);
    fault(scheduled, 'INVALID_TIME', scheduled.targetEpochMs + 1);
  });

  it.each([
    null, [], 'scheduled', {}, { mode: 'later' }, { mode: 'now', targetEpochMs: now },
    { mode: 'now', utcOffsetMinutes: undefined }, { ...scheduled, executionToken: 'not-allowed' },
    { ...scheduled, targetEpochMs: Infinity }, { ...scheduled, targetEpochMs: NaN },
    { ...scheduled, targetEpochMs: 8_640_000_000_000_001 }, { ...scheduled, targetEpochMs: 1.5 },
    { ...scheduled, targetEpochMs: String(scheduled.targetEpochMs) },
    { ...scheduled, utcOffsetMinutes: undefined }, { ...scheduled, utcOffsetMinutes: '-360' },
    { ...scheduled, utcOffsetMinutes: -360.5 }, { ...scheduled, utcOffsetMinutes: 1440 },
    { ...scheduled, timezone: '+06:00' }, { ...scheduled, timezone: 'Not/A_Zone' },
    { ...scheduled, timezone: ' America/Chicago' }, { ...scheduled, timezone: '' },
    { ...scheduled, localDateTime: '2027-01-15T09:00' },
    { ...scheduled, localDateTime: '2027-01-15 09:00:00' },
    { ...scheduled, localDateTime: '2027-01-15T09:00:00Z' },
    { ...scheduled, localDateTime: '2027-1-15T09:00:00' },
    { ...scheduled, localDateTime: '2027-01-15T09:00:00.000' },
    { ...scheduled, localDateTime: '2027-01-15T09:00:00\n' },
    Object.create(scheduled), JSON.parse('{"mode":"now","__proto__":{}}'),
    { ...scheduled, [Symbol('extra')]: true },
  ])('rejects malformed or over-specified data before use %#', input => fault(input, 'INVALID_INPUT'));

  it.each(['mode', 'targetEpochMs', 'timezone', 'localDateTime', 'utcOffsetMinutes'])('never invokes an accessor for %s', field => {
    const getter = vi.fn(() => scheduled[field as keyof typeof scheduled]);
    const input = { ...scheduled };
    Object.defineProperty(input, field, { enumerable: true, get: getter });
    fault(input, 'INVALID_INPUT');
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -Infinity, 8_640_000_000_000_001, 0.5])('rejects an invalid caller clock %#', clock => {
    fault({ mode: 'now' }, 'INVALID_INPUT', clock);
  });

  it('accepts a null-prototype data record and detaches the returned snapshot', () => {
    const input = Object.assign(Object.create(null), scheduled);
    const parsed = parseEnrollmentTiming(input, now);
    input.localDateTime = 'changed after validation';
    expect(parsed).toEqual(scheduled);
  });

  it('does not enable activation even when timing is valid', () => {
    const timing = parseEnrollmentTiming(scheduled, now);
    expect(() => parseFoundationRequest({
      protocolVersion: 1, requestId: 'timing-only', type: 'enrollment.activate',
      payload: { reviewId: 'synthetic-review', expectedFingerprint: 'synthetic', timing },
    })).toThrow(expect.objectContaining({ detail: expect.objectContaining({ code: 'FEATURE_UNAVAILABLE' }) }));
  });
});
