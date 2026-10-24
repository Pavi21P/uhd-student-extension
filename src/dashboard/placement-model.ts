import type { DayOfWeek, Meeting, Schedule } from '../shared/domain';
import { ContractFault, parseMeeting } from '../shared/validation';
import { changeCourse } from './course-model';
export type PlacementKind = 'place' | 'move' | 'resize';
const snap = (minute: number) => Math.round(minute / 15) * 15;
const clamp = (minute: number, min: number, max: number) => Math.min(max, Math.max(min, minute));
export function proposePlacement(kind: PlacementKind, source: Meeting, day: DayOfWeek, minute: number, snapped = true): Meeting {
  if (!Number.isFinite(minute)) throw new ContractFault('INVALID_INPUT', 'Choose a time on the grid.');
  const point = snapped ? snap(minute) : Math.round(minute);
  if (kind === 'resize') {
    if (day !== source.dayOfWeek) throw new ContractFault('INVALID_INPUT', 'Resize within the same day. Drag the card to move it to another day.');
    const minimum = snapped ? (Math.floor(source.startMinute / 15) + 1) * 15 : source.startMinute + 1;
    return parseMeeting({ ...source, endMinute: clamp(point, minimum, 1440) });
  }
  const duration = kind === 'place' ? 60 : source.endMinute - source.startMinute;
  const limit = kind === 'place' ? 1439 : 1440 - duration;
  const lastStart = snapped ? Math.floor(limit / 15) * 15 : limit;
  const startMinute = clamp(point, 0, lastStart);
  return parseMeeting({ ...source, dayOfWeek: day, startMinute, endMinute: Math.min(1440, startMinute + duration) });
}
/** Replace exactly one occurrence; validate the complete proposed schedule before opening a draft. */
export function stagePlacement(schedule: Schedule, expectedRevision: number, kind: PlacementKind, meeting: Meeting): Schedule {
  if (schedule.revision !== expectedRevision) throw new ContractFault('REVISION_CONFLICT', 'The timetable changed during this action. Start again from the saved version.');
  const course = schedule.courses.find(course => course.id === meeting.courseId);
  if (!course) throw new ContractFault('NOT_FOUND', 'This course is no longer saved.');
  const prior = schedule.meetings.find(item => item.id === meeting.id);
  if (kind === 'place' ? !!prior || schedule.meetings.some(item => item.courseId === course.id) : !prior || prior.courseId !== course.id) {
    throw new ContractFault('INVALID_INPUT', 'This meeting changed. Start again from the saved version.');
  }
  const meetings = schedule.meetings.filter(item => item.courseId === course.id).map(item => item.id === meeting.id ? meeting : item);
  if (kind === 'place') meetings.push(meeting);
  return changeCourse(schedule, { kind: 'edit', course, meetings });
}
