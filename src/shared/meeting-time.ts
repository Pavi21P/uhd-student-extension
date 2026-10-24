import type { DayOfWeek, Meeting } from './domain';
import { ContractFault, parseSchedule } from './validation';

function wallMinute(value: unknown, field: string, allowDayEnd: boolean): number {
  if (allowDayEnd && value === '24:00') return 1440;
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new ContractFault('INVALID_INPUT', allowDayEnd
      ? 'Use HH:mm in 24-hour time, or 24:00 for the end of the day.'
      : 'Use HH:mm in 24-hour time, from 00:00 to 23:59.', field);
  }
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

/** Weekly wall time, without Date parsing, UTC conversion, rounding or overnight wrapping. */
export function parseMeetingTimes(start: unknown, end: unknown): Pick<Meeting, 'startMinute' | 'endMinute'> {
  const startMinute = wallMinute(start, 'meeting.startMinute', false);
  const endMinute = wallMinute(end, 'meeting.endMinute', true);
  if (endMinute <= startMinute) {
    throw new ContractFault('INVALID_INPUT', 'End time must be after start time on the same day. Overnight meetings are not supported.', 'meeting.endMinute');
  }
  return { startMinute, endMinute };
}

/** Derived warning data only; not part of the stored schedule or message protocol. */
export interface MeetingConflict {
  meetingIds: [string, string];
  dayOfWeek: DayOfWeek;
  startMinute: number;
  endMinute: number;
}

/**
 * Validate first, then return each intersecting pair once, including same-course pairs.
 * Intervals are [start, end), so adjacent meetings never conflict. Pair order follows
 * day/start/end/ID; results are independent of source array order. Input is not mutated.
 * Overlaps remain valid schedule data: consumers warn, never discard or auto-select.
 */
export function findMeetingConflicts(value: unknown): MeetingConflict[] {
  const meetings = parseSchedule(value).meetings.sort((a, b) =>
    a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute || a.endMinute - b.endMinute
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const conflicts: MeetingConflict[] = [];
  for (let index = 0; index < meetings.length; index++) {
    const left = meetings[index]!;
    for (let next = index + 1; next < meetings.length; next++) {
      const right = meetings[next]!;
      if (right.dayOfWeek !== left.dayOfWeek || right.startMinute >= left.endMinute) break;
      conflicts.push({ meetingIds: [left.id, right.id], dayOfWeek: left.dayOfWeek,
        startMinute: right.startMinute, endMinute: Math.min(left.endMinute, right.endMinute) });
    }
  }
  return conflicts;
}
