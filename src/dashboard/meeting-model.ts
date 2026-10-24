import type { DayOfWeek, Meeting } from '../shared/domain';
import { parseMeetingTimes } from '../shared/meeting-time';
import { ContractFault, parseMeeting } from '../shared/validation';

export const weekDays = [
  { value: 1, label: 'Monday', short: 'Mon' }, { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' }, { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' }, { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
] as const;
export const clockTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export const meetingLabel = (meeting: Meeting) => `${weekDays[meeting.dayOfWeek - 1]!.label}, ${clockTime(meeting.startMinute)}–${clockTime(meeting.endMinute)}`;
export interface MeetingDraft { id: string; dayOfWeek: DayOfWeek; start: string; end: string }
export type MeetingErrors = Record<string, { start?: string; end?: string; day?: string }>;
export const draftMeeting = (meeting: Meeting): MeetingDraft => ({ id: meeting.id, dayOfWeek: meeting.dayOfWeek,
  start: clockTime(meeting.startMinute), end: clockTime(meeting.endMinute) });

export function parseMeetingDrafts(courseId: string, drafts: MeetingDraft[]): { ok: true; meetings: Meeting[] } | { ok: false; errors: MeetingErrors } {
  const meetings: Meeting[] = []; const errors: MeetingErrors = {};
  const occurrences = new Set<string>(); const ids = new Set<string>();
  for (const draft of drafts) {
    try {
      const meeting = parseMeeting({ id: draft.id, courseId, dayOfWeek: draft.dayOfWeek, ...parseMeetingTimes(draft.start, draft.end) });
      const occurrence = `${meeting.dayOfWeek}:${meeting.startMinute}:${meeting.endMinute}`;
      if (occurrences.has(occurrence) || ids.has(meeting.id)) {
        errors[draft.id] = { end: 'This meeting is already listed. Change its day or time, or remove this row.' };
      } else { occurrences.add(occurrence); ids.add(meeting.id); meetings.push(meeting); }
    } catch (error) {
      const detail = error instanceof ContractFault ? error.detail : undefined;
      const field = detail?.field?.endsWith('startMinute') ? 'start' : detail?.field?.endsWith('dayOfWeek') ? 'day' : 'end';
      errors[draft.id] = { [field]: detail?.message ?? 'Check this meeting’s day and times.' };
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, meetings };
}
