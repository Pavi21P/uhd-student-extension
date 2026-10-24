import { describe, expect, it } from 'vitest';
import type { DayOfWeek, Meeting, Schedule } from '../../src/shared/domain';
import { findMeetingConflicts, parseMeetingTimes } from '../../src/shared/meeting-time';
import { blankSchedule } from '../fixtures/contracts.examples';

function meeting(id: string, startMinute: number, endMinute: number, dayOfWeek: DayOfWeek = 1, courseId = 'course'): Meeting {
  return { id, courseId, dayOfWeek, startMinute, endMinute };
}
function schedule(meetings: Meeting[]): Schedule {
  return { ...blankSchedule, courses: [...new Set(meetings.map(item => item.courseId))].map(id => ({ id })), meetings };
}
const invalidInput = (field: string) => expect.objectContaining({ detail: expect.objectContaining({ code: 'INVALID_INPUT', field }) });

describe('meeting time inputs', () => {
  it.each([
    ['00:00', '00:01', 0, 1], ['09:07', '10:23', 547, 623], ['12:00', '13:00', 720, 780],
    ['23:59', '24:00', 1439, 1440], ['00:00', '24:00', 0, 1440],
  ])('parses exact same-day wall time %s to %s', (start, end, startMinute, endMinute) => {
    expect(parseMeetingTimes(start, end)).toEqual({ startMinute, endMinute });
  });
  it.each(['', '9:00', '09:0', '09:60', '25:00', '09:00:00', '9 AM', ' 09:00', '09:00 ', '09:00\n', '０９:００', null, 540, {}, undefined])(
    'rejects malformed time without coercion: %j', value => {
      expect(() => parseMeetingTimes(value, '12:00')).toThrow(invalidInput('meeting.startMinute'));
      expect(() => parseMeetingTimes('00:00', value)).toThrow(invalidInput('meeting.endMinute'));
    });
  it.each([['24:00', '24:00'], ['24:01', '24:00']])('rejects an end-of-day start: %s', (start, end) => {
    expect(() => parseMeetingTimes(start, end)).toThrow(invalidInput('meeting.startMinute'));
  });
  it.each([['09:00', '09:00'], ['23:00', '01:00'], ['00:00', '00:00'], ['10:00', '09:59']])(
    'rejects zero, negative and overnight durations: %s to %s', (start, end) => {
      expect(() => parseMeetingTimes(start, end)).toThrow(invalidInput('meeting.endMinute'));
    });
});

describe('weekly meeting conflicts', () => {
  it('does not report adjacent classes, separate days, or self-conflicts', () => {
    expect(findMeetingConflicts(schedule([meeting('a', 600, 660), meeting('b', 660, 720), meeting('c', 600, 660, 2)]))).toEqual([]);
    expect(findMeetingConflicts(schedule([]))).toEqual([]);
    expect(findMeetingConflicts(schedule([meeting('alone', 0, 1440)]))).toEqual([]);
  });
  it('reports partial overlap, containment and coincident times with the exact intersection', () => {
    const source = schedule([meeting('a', 600, 660), meeting('b', 630, 700), meeting('c', 640, 650), meeting('d', 600, 660, 1, 'another-course')]);
    expect(findMeetingConflicts(source)).toEqual([
      { meetingIds: ['a', 'd'], dayOfWeek: 1, startMinute: 600, endMinute: 660 },
      { meetingIds: ['a', 'b'], dayOfWeek: 1, startMinute: 630, endMinute: 660 },
      { meetingIds: ['a', 'c'], dayOfWeek: 1, startMinute: 640, endMinute: 650 },
      { meetingIds: ['d', 'b'], dayOfWeek: 1, startMinute: 630, endMinute: 660 },
      { meetingIds: ['d', 'c'], dayOfWeek: 1, startMinute: 640, endMinute: 650 },
      { meetingIds: ['b', 'c'], dayOfWeek: 1, startMinute: 640, endMinute: 650 },
    ]);
  });
  it('treats recurring lectures and a separate lab as independent occurrences, including weekends', () => {
    const source = schedule([meeting('lecture-mon', 540, 600), meeting('lecture-wed', 540, 600, 3),
      meeting('lab-fri', 780, 900, 5), meeting('other-mon', 570, 630, 1, 'other'),
      meeting('weekend', 1439, 1440, 7), meeting('weekend-other', 1438, 1440, 7, 'other')]);
    expect(findMeetingConflicts(source)).toEqual([
      { meetingIds: ['lecture-mon', 'other-mon'], dayOfWeek: 1, startMinute: 570, endMinute: 600 },
      { meetingIds: ['weekend-other', 'weekend'], dayOfWeek: 7, startMinute: 1439, endMinute: 1440 },
    ]);
    expect(source.meetings).toHaveLength(6);
  });
  it('is deterministic for reordered records and never mutates the schedule', () => {
    const source = schedule([meeting('z', 600, 700, 1, 'z'), meeting('a', 600, 700), meeting('inner', 620, 650)]);
    const before = structuredClone(source);
    const expected = findMeetingConflicts(source);
    expect(findMeetingConflicts({ ...source, meetings: [...source.meetings].reverse() })).toEqual(expected);
    expect(source).toEqual(before);
  });
  it.each([
    { startMinute: -1 }, { startMinute: 600.5 }, { startMinute: '600' }, { startMinute: NaN },
    { startMinute: Infinity }, { startMinute: 1440 }, { endMinute: 600 }, { endMinute: 599 },
    { startMinute: 1380, endMinute: 60 }, { endMinute: 1441 }, { dayOfWeek: 0 }, { dayOfWeek: 8 },
  ])('rejects invalid saved meeting data before calculating conflicts: %j', change => {
    const source = schedule([meeting('bad', 600, 660)]);
    expect(() => findMeetingConflicts({ ...source, meetings: [{ ...source.meetings[0], ...change }] })).toThrow();
  });
  it('rejects duplicate IDs, duplicate occurrences, and orphan course references', () => {
    expect(() => findMeetingConflicts(schedule([meeting('same-id', 600, 660), meeting('same-id', 700, 760)]))).toThrow();
    expect(() => findMeetingConflicts(schedule([meeting('one', 600, 660), meeting('two', 600, 660)]))).toThrow();
    expect(() => findMeetingConflicts({ ...schedule([meeting('orphan', 600, 660)]), courses: [] })).toThrow();
  });
  it('agrees with minute-by-minute occupancy for every pair of short intervals across three days', () => {
    const records: Meeting[] = [];
    for (const day of [1, 3, 7] as const) for (let start = 0; start < 6; start++) for (let end = start + 1; end <= 6; end++) {
      records.push(meeting(`${day}-${start}-${end}`, start, end, day));
    }
    const expected: string[] = [];
    for (let a = 0; a < records.length; a++) for (let b = a + 1; b < records.length; b++) {
      const first = records[a]!; const second = records[b]!;
      const occupied = new Set(Array.from({ length: first.endMinute - first.startMinute }, (_, i) => first.startMinute + i));
      const collision = first.dayOfWeek === second.dayOfWeek && Array.from({ length: second.endMinute - second.startMinute }, (_, i) => second.startMinute + i).some(minute => occupied.has(minute));
      if (collision) expected.push([first.id, second.id].sort().join('|'));
    }
    const actual = findMeetingConflicts(schedule(records)).map(conflict => [...conflict.meetingIds].sort().join('|'));
    expect(actual.sort()).toEqual(expected.sort());
    expect(new Set(actual).size).toBe(actual.length);
  });
  it('handles the supported 1000-occurrence limit without treating adjacent minutes as conflicts', () => {
    const records = Array.from({ length: 1000 }, (_, index) => meeting(String(index), index, index + 1));
    expect(findMeetingConflicts(schedule(records))).toEqual([]);
  });
});
