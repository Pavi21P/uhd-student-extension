import type { DisplaySettings, Meeting } from '../shared/domain';
export type WeekView = Pick<DisplaySettings, 'visibleDays' | 'startMinute' | 'endMinute'>;
export const minuteScale = (view: WeekView) => Math.max(1.2, 180 / (view.endMinute - view.startMinute));
export interface PositionedMeeting { meeting: Meeting; top: number; height: number; lane: number; lanes: number; clipped: boolean }
export const outsideView = (meeting: Meeting, view: WeekView) => !view.visibleDays.includes(meeting.dayOfWeek)
  || meeting.startMinute < view.startMinute || meeting.endMinute > view.endMinute;
export function revealMeetings(view: WeekView, meetings: Meeting[]): WeekView {
  return { visibleDays: [...new Set([...view.visibleDays, ...meetings.map(meeting => meeting.dayOfWeek)])].sort((a, b) => a - b),
    startMinute: Math.min(view.startMinute, ...meetings.map(meeting => meeting.startMinute)),
    endMinute: Math.max(view.endMinute, ...meetings.map(meeting => meeting.endMinute)) };
}
/** Exact vertical geometry; simple side-by-side lanes keep intersecting cards accessible. */
export function positionMeetings(meetings: Meeting[], view: WeekView): PositionedMeeting[] {
  const positions: PositionedMeeting[] = []; const scale = minuteScale(view);
  for (const day of view.visibleDays) {
    const visible = meetings.filter(meeting => meeting.dayOfWeek === day && meeting.endMinute > view.startMinute && meeting.startMinute < view.endMinute)
      .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    let group: PositionedMeeting[] = []; let ends: number[] = []; let groupEnd = -1;
    const flush = () => { for (const position of group) position.lanes = ends.length; group = []; ends = []; };
    for (const meeting of visible) {
      if (meeting.startMinute >= groupEnd) flush();
      let lane = ends.findIndex(end => end <= meeting.startMinute);
      if (lane < 0) lane = ends.length;
      ends[lane] = meeting.endMinute; groupEnd = Math.max(groupEnd, meeting.endMinute);
      const start = Math.max(meeting.startMinute, view.startMinute); const end = Math.min(meeting.endMinute, view.endMinute);
      const position = { meeting, top: (start - view.startMinute) * scale, height: (end - start) * scale,
        lane, lanes: 1, clipped: outsideView(meeting, view) };
      group.push(position); positions.push(position);
    }
    flush();
  }
  return positions;
}
export function hourMarks(view: WeekView): number[] {
  const marks = [view.startMinute];
  for (let minute = Math.ceil((view.startMinute + 1) / 60) * 60; minute < view.endMinute; minute += 60) marks.push(minute);
  return [...marks, view.endMinute];
}

/** Widen crowded days instead of shrinking overlapping cards below a readable lane. */
export function dayColumnWidths(positions: PositionedMeeting[], days: Meeting['dayOfWeek'][]): number[] {
  return days.map(day => 184 * positions.reduce((lanes, position) => position.meeting.dayOfWeek === day ? Math.max(lanes, position.lanes) : lanes, 1));
}
