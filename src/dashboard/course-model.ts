import type { CourseCard, Schedule } from '../shared/domain';
import { ContractFault, parseCourse, parseSchedule } from '../shared/validation';

// One primary workspace per browser profile; display names never identify records.
export const primaryScheduleId = '48bdbce8-b801-4d5e-8748-35283d6803d7';
export const emptySchedule = (): Schedule => ({ schemaVersion: 1, id: primaryScheduleId, revision: 0,
  label: 'My timetable', termLabel: '', timezone: 'America/Chicago', courses: [], meetings: [] });
export type CourseChange = { kind: 'add' | 'edit'; course: CourseCard } | { kind: 'delete'; courseId: string };

/** A single validated transaction; never reconstruct a schedule from just the visible cards. */
export function changeCourse(schedule: Schedule, change: CourseChange): Schedule {
  const courseId = change.kind === 'delete' ? change.courseId : change.course.id;
  const exists = schedule.courses.some(course => course.id === courseId);
  if (change.kind === 'add' && exists) throw new ContractFault('REVISION_CONFLICT', 'This course already exists. Reload saved courses.');
  if (change.kind !== 'add' && !exists) throw new ContractFault('NOT_FOUND', 'This course was removed. Reload saved courses.');
  const courses = change.kind === 'delete' ? schedule.courses.filter(course => course.id !== courseId)
    : change.kind === 'add' ? [...schedule.courses, parseCourse(change.course)]
    : schedule.courses.map(course => course.id === courseId ? parseCourse(change.course) : course);
  return parseSchedule({ ...schedule, courses,
    meetings: change.kind === 'delete' ? schedule.meetings.filter(meeting => meeting.courseId !== courseId) : schedule.meetings });
}
