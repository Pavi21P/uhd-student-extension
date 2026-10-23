import { describe, expect, it } from 'vitest';
import { blankSchedule, recurringSchedule, invalidExamples } from '../fixtures/contracts.examples';
import { defaultSettings, parseCourse, parseSchedule, parseSettings } from '../../src/shared/validation';
import { parseFoundationRequest } from '../../src/shared/foundation-rpc';

const meeting = recurringSchedule.meetings[0]!;
describe('runtime timetable boundary', () => {
  it('preserves blank cards and creates detached normalized values', () => {
    const source = { ...blankSchedule, courses: [{ id: 'blank', title: '  ', room: '  R1  ' }] };
    const parsed = parseSchedule(source);
    expect(parsed.courses).toEqual([{ id: 'blank', room: 'R1' }]);
    expect(source.courses[0]?.room).toBe('  R1  ');
    expect(parsed.courses).not.toBe(source.courses);
    expect(parseSchedule(recurringSchedule)).toEqual(recurringSchedule);
  });
  it.each(invalidExamples)('rejects the contract fixture: $name', ({ value, expectedError, name }) => {
    const parse = name === 'arbitrary script request' ? parseFoundationRequest : parseSchedule;
    expect(() => parse(value)).toThrow(expect.objectContaining({ detail: expect.objectContaining({ code: expectedError }) }));
  });
  it.each([
    ['missing required field', { ...blankSchedule, label: undefined }],
    ['unknown field', { ...blankSchedule, executionToken: 'fixture-only' }],
    ['fractional revision', { ...blankSchedule, revision: 0.5 }],
    ['nonfinite revision', { ...blankSchedule, revision: Infinity }],
    ['oversized label', { ...blankSchedule, label: 'a'.repeat(121) }],
    ['invalid zone', { ...blankSchedule, timezone: 'Not/A_Zone' }],
    ['offset instead of IANA zone', { ...blankSchedule, timezone: '+01:00' }],
    ['too many courses', { ...blankSchedule, courses: Array.from({ length: 251 }, (_, n) => ({ id: String(n) })) }],
    ['too many meetings', { ...recurringSchedule, meetings: Array.from({ length: 1001 }, (_, n) => ({ ...meeting, id: String(n) })) }],
    ['duplicate meeting ID', { ...recurringSchedule, meetings: [meeting, { ...meeting, dayOfWeek: 4 }] }],
    ['duplicate occurrence', { ...recurringSchedule, meetings: [meeting, { ...meeting, id: 'other' }] }],
    ['invalid day', { ...recurringSchedule, meetings: [{ ...meeting, dayOfWeek: 0 }] }],
    ['fractional minute', { ...recurringSchedule, meetings: [{ ...meeting, startMinute: 600.5 }] }],
    ['overnight range', { ...recurringSchedule, meetings: [{ ...meeting, startMinute: 1380, endMinute: 60 }] }],
    ['out of day', { ...recurringSchedule, meetings: [{ ...meeting, endMinute: 1441 }] }],
  ])('rejects %s', (_, input) => expect(() => parseSchedule(input)).toThrow());
  it('allows other overlapping meetings for later conflict warnings', () => {
    expect(parseSchedule({ ...recurringSchedule, meetings: [meeting, { ...meeting, id: 'overlap', startMinute: 610 }] }).meetings).toHaveLength(2);
  });
  it.each([
    { id: '' }, { id: 'x', color: 'url(unsafe)' }, { id: 'x', title: undefined },
    { id: 'x', professorName: 'a'.repeat(201) }, { id: 'x', courseCode: 'a'.repeat(41) },
    { id: 'x', room: 'a'.repeat(81) }, JSON.parse('{"id":"x","__proto__":{"polluted":true}}'),
    Object.create({ id: 'inherited' }), { id: 'x', [Symbol('hidden')]: true },
  ])('rejects unsafe or oversized course records %#', value => expect(() => parseCourse(value)).toThrow());
  it('rejects accessors without invoking them and sparse lists', () => {
    let called = false;
    const input = { get id() { called = true; return 'x'; } };
    expect(() => parseCourse(input)).toThrow();
    expect(called).toBe(false);
    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(() => parseSchedule({ ...blankSchedule, courses: sparse })).toThrow();
  });
  it.each([[], [1, 1], [8], [1.5]])('rejects invalid visible days %j', (...days) => {
    // Each table row is a list of day values, including the empty list.
    expect(() => parseSettings({ ...defaultSettings(), visibleDays: days })).toThrow();
  });
  it('rejects invalid settings and returns fresh defaults', () => {
    expect(() => parseSettings({ ...defaultSettings(), startMinute: 1320 })).toThrow();
    expect(() => parseSettings({ ...defaultSettings(), enrollmentTimezone: 'invalid' })).toThrow();
    expect(() => parseSettings({ ...defaultSettings(), schemaVersion: 2 })).toThrow();
    defaultSettings().visibleDays.pop();
    expect(parseSettings(defaultSettings()).visibleDays).toEqual([1, 2, 3, 4, 5]);
  });
});
