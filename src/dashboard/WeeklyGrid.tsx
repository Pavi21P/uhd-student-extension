import { useMemo, useState } from 'react';
import { findMeetingConflicts } from '../shared/meeting-time';
import { clockTime, meetingLabel, weekDays } from './meeting-model';
import { hourMarks, outsideView, minuteScale, positionMeetings, revealMeetings } from './grid-layout';
import type { CourseWorkspace } from './use-course-workspace';
import type { ViewSettings } from './use-view-settings';

export function WeeklyGrid({ model, view }: { model: CourseWorkspace; view: ViewSettings }) {
  const [expanded, setExpanded] = useState(false);
  const meetings = model.schedule?.meetings ?? [];
  const shown = expanded ? revealMeetings(view.settings, meetings) : view.settings;
  const days = weekDays.filter(day => shown.visibleDays.includes(day.value));
  const positions = useMemo(() => positionMeetings(meetings, shown), [meetings, shown]);
  const conflicts = useMemo(() => model.schedule ? findMeetingConflicts(model.schedule) : [], [model.schedule]);
  const conflictIds = new Set(conflicts.flatMap(conflict => conflict.meetingIds));
  const outside = meetings.filter(meeting => outsideView(meeting, shown));
  const marks = hourMarks(shown); const scale = minuteScale(shown); const height = (shown.endMinute - shown.startMinute) * scale;
  const disabled = !!model.draft || model.busy || model.recovery;
  const sorted = [...meetings].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  return <section className="week-panel weekly-grid" aria-labelledby="week-title">
    <div className="week-heading"><div><h2 id="week-title">Your week</h2><p>{model.schedule?.timezone ?? 'America/Chicago'} · 24-hour time</p></div><a className="text-action" href="#settings">Change days & hours</a></div>
    {!view.ready && <p className="grid-notice" role="status">{view.recovery ? 'View settings unavailable. Showing default days and hours.' : 'Loading saved days and hours…'} <a href="#settings">View settings</a></p>}
    {outside.length > 0 && <div className="grid-notice"><p>{outside.length} {outside.length === 1 ? 'meeting extends' : 'meetings extend'} outside this view. All meeting details remain in the list below.</p>
      <button type="button" className="button button-secondary" onClick={() => setExpanded(true)}>Show meetings</button></div>}
    {expanded && <div className="grid-notice"><p>Expanded to show all meetings. Your saved view is unchanged.</p><button type="button" className="button button-secondary" onClick={() => setExpanded(false)}>Reset to saved view</button></div>}
    {conflicts.length > 0 && <p className="grid-notice overlap-note" role="status">{conflicts.length} {conflicts.length === 1 ? 'overlap' : 'overlaps'}. Conflicting meetings stay side by side and are marked in the meeting list.</p>}
    {!meetings.length && <p className="grid-notice">Your week is open. Add a course, then use Add meeting in its editor to place it here.</p>}
    <p id="grid-scroll-help" className="sr-only">Scrollable weekly timetable. Focus this area and use arrow keys to scroll. The meeting list below provides the same course details and edit actions.</p>
    <div className="calendar-scroll" role="region" tabIndex={0} aria-label="Weekly timetable" aria-describedby="grid-scroll-help">
      <div className="calendar-board" style={{ minWidth: 64 + days.length * 168 }}>
        <div className="calendar-head" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(168px, 1fr))` }}><span className="time-head">Time</span>{days.map(day => <span key={day.value}>{day.label}</span>)}</div>
        <div className="calendar-body" style={{ height, gridTemplateColumns: `64px repeat(${days.length}, minmax(168px, 1fr))` }}>
          <div className="time-axis" aria-hidden="true">{marks.map((minute, index) => <span key={minute} className={index === 0 ? 'first-mark' : index === marks.length - 1 ? 'last-mark' : ''} style={{ top: (minute - shown.startMinute) * scale }}>{clockTime(minute)}</span>)}</div>
          {days.map(day => <div className="calendar-day" key={day.value} aria-label={day.label}>
            {marks.map(minute => <span className="hour-line" key={minute} style={{ top: (minute - shown.startMinute) * scale }} aria-hidden="true" />)}
            {positions.filter(position => position.meeting.dayOfWeek === day.value).map(position => {
              const meeting = position.meeting; const course = model.schedule!.courses.find(item => item.id === meeting.courseId)!;
              const compact = position.height < 58; const overlaps = conflictIds.has(meeting.id);
              const name = [course.title || 'Untitled course', course.courseCode, course.professorName || 'Professor blank', course.room || 'Room blank', meetingLabel(meeting), overlaps ? 'Overlaps another meeting' : '', position.clipped ? 'Partly outside the current view' : ''].filter(Boolean).join(', ');
              return <button type="button" key={meeting.id} data-meeting-id={meeting.id} className={'calendar-meeting' + (compact ? ' compact-meeting' : '') + (overlaps ? ' conflicting-meeting' : '')}
                disabled={disabled} aria-label={'Edit meeting: ' + name} title={name} onClick={event => model.edit(course, event.currentTarget)}
                style={{ top: position.top, height: position.height, left: `${position.lane / position.lanes * 100}%`, width: `${100 / position.lanes}%` }}>
                {!compact && <span className="card-professor">{course.professorName || 'Professor'}</span>}
                {course.color && <span className="course-color" style={{ backgroundColor: course.color }} aria-hidden="true" />}
                <strong className="card-course-name">{course.title || 'Course name'}</strong>
                {!compact && <span className="meeting-card-footer"><span className="card-room">{course.room || 'Room'}</span><span>{clockTime(meeting.startMinute)}–{clockTime(meeting.endMinute)}</span></span>}
              </button>;
            })}
          </div>)}
        </div>
      </div>
    </div>
    <div className="week-footnote"><span>{days.map(day => day.short).join(', ')} · {clockTime(shown.startMinute)}–{clockTime(shown.endMinute)}</span><span>Edit times through the course form</span></div>
    {meetings.length > 0 && <details className="meeting-list" open><summary>Meeting list ({meetings.length})</summary><ul>{sorted.map(meeting => {
      const course = model.schedule!.courses.find(item => item.id === meeting.courseId)!;
      return <li key={meeting.id}><div><strong>{course.title || 'Untitled course'}</strong><span>{meetingLabel(meeting)}</span><span>{course.professorName || 'Professor not entered'} · {course.room || 'Room not entered'}</span>
        {conflictIds.has(meeting.id) && <span className="overlap-label">Overlaps another meeting</span>}{outsideView(meeting, shown) && <span>Outside current view</span>}</div>
        <button type="button" className="button button-secondary" disabled={disabled} aria-label={`Edit ${course.title || 'untitled course'}, ${meetingLabel(meeting)}`} onClick={event => model.edit(course, event.currentTarget)}>Edit course</button></li>;
    })}</ul></details>}
  </section>;
}
