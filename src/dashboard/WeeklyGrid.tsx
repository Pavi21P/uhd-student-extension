import { Fragment, useMemo, useRef, useState } from 'react';
import { findMeetingConflicts } from '../shared/meeting-time';
import { clockTime, meetingLabel, weekDays } from './meeting-model';
import { dayColumnWidths, hourMarks, outsideView, minuteScale, positionMeetings, revealMeetings } from './grid-layout';
import type { CourseWorkspace } from './use-course-workspace';
import type { MeetingDrag } from './use-meeting-drag';
import type { ViewSettings } from './use-view-settings';

export function WeeklyGrid({ model, view, drag }: { model: CourseWorkspace; view: ViewSettings; drag: MeetingDrag }) {
  const listRef = useRef<HTMLDetailsElement>(null);
  const [expanded, setExpanded] = useState(false);
  const meetings = model.schedule?.meetings ?? [];
  const shown = expanded ? revealMeetings(view.settings, meetings) : view.settings;
  const days = weekDays.filter(day => shown.visibleDays.includes(day.value));
  const positions = useMemo(() => positionMeetings(meetings, shown), [meetings, shown]);
  const widths = dayColumnWidths(positions, days.map(day => day.value));
  const columns = '64px ' + widths.map(width => `minmax(${width}px, 1fr)`).join(' ');
  const conflicts = useMemo(() => model.schedule ? findMeetingConflicts(model.schedule) : [], [model.schedule]);
  const conflictIds = new Set(conflicts.flatMap(conflict => conflict.meetingIds));
  const outside = meetings.filter(meeting => outsideView(meeting, shown));
  const marks = hourMarks(shown); const scale = minuteScale(shown); const height = (shown.endMinute - shown.startMinute) * scale;
  const disabled = model.transferOpen || !!model.draft || model.busy || model.recovery;
  const ghost = drag.preview ? positionMeetings([drag.preview], shown)[0] : undefined;
  const sorted = [...meetings].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  return <section className="week-panel weekly-grid" aria-labelledby="week-title">
    <div className="week-heading"><div><h2 id="week-title">Your week</h2><p>{model.schedule?.timezone ?? 'America/Chicago'} · 24-hour time</p></div><a className="text-action" href="#settings">Change days & hours</a></div>
    {!view.ready && <p className="grid-notice" role="status">{view.recovery ? 'View settings unavailable. Showing default days and hours.' : 'Loading saved days and hours…'} <a href="#settings">View settings</a></p>}
    {outside.length > 0 && <div className="grid-notice"><p>{outside.length} {outside.length === 1 ? 'meeting extends' : 'meetings extend'} outside this view. All meeting details remain in the list below.</p>
      <button type="button" className="button button-secondary" onClick={() => setExpanded(true)}>Show meetings</button></div>}
    {view.ready && view.recovery && <p className="grid-notice" role="status">Saved view settings could not be verified. Showing the last loaded days and hours. <a href="#settings">Reload in Settings</a></p>}
    {expanded && <div className="grid-notice"><p>Expanded to show all meetings. Your saved view is unchanged.</p><button type="button" className="button button-secondary" onClick={() => setExpanded(false)}>Reset to saved view</button></div>}
    {conflicts.length > 0 && <p className="grid-notice overlap-note" role="status">{conflicts.length} {conflicts.length === 1 ? 'overlap' : 'overlaps'}. Conflicting meetings stay side by side. Crowded days widen; scroll across or use the meeting list for full details.</p>}
    {!meetings.length && <p className="grid-notice">Your week is open. Add a course, then use Add meeting in its editor to place it here.</p>}
    <details className="placement-help" id="placement-help"><summary>Move and resize meetings</summary><p>Drag an unscheduled card onto a day. Drag a meeting to move it; drag its bottom handle within the same day to resize. Times snap to 15 minutes. Drop opens a proposal: review, then Save course. Escape or Cancel leaves the saved timetable unchanged.</p><p>Keyboard: focus a meeting and use arrow keys to propose a move between visible days or times. Shift + Up/Down proposes a new end time. Enter opens the exact-time form. Short meetings and all other days remain editable in the meeting list.</p></details>
    <p className="grid-notice drag-status" role="status">{drag.message || 'Drag a card or edit its meeting times. Proposed changes need Save course.'}</p>
    <div className="grid-reading-help"><p id="grid-scroll-help">Scroll across to see all days. Short cards keep exact durations; full details and edit actions are in the meeting list.</p>{meetings.length > 0 && <button type="button" className="button button-secondary" onClick={() => { const list = listRef.current; if (list) { list.open = true; list.querySelector("summary")?.focus(); } }}>Go to meeting list</button>}</div>
    <div className="calendar-scroll" role="region" tabIndex={0} aria-label="Weekly timetable" aria-describedby="grid-scroll-help">
      <div className="calendar-board" style={{ minWidth: 64 + widths.reduce((sum, width) => sum + width, 0) }}>
        <div className="calendar-head" style={{ gridTemplateColumns: columns }}><span className="time-head">Time</span>{days.map(day => <span key={day.value}>{day.label}</span>)}</div>
        <div className="calendar-body" style={{ height, gridTemplateColumns: columns }}>
          <div className="time-axis" aria-hidden="true">{marks.map((minute, index) => <span key={minute} className={index === 0 ? 'first-mark' : index === marks.length - 1 ? 'last-mark' : ''} style={{ top: (minute - shown.startMinute) * scale }}>{clockTime(minute)}</span>)}</div>
          {days.map(day => <div className="calendar-day" key={day.value} data-day={day.value} aria-label={day.label}
            onDragOver={event => drag.over(event, day.value, shown)} onDrop={event => drag.drop(event, day.value, shown)}>
            {marks.map(minute => <span className="hour-line" key={minute} style={{ top: (minute - shown.startMinute) * scale }} aria-hidden="true" />)}
            {ghost && ghost.meeting.dayOfWeek === day.value && <div className="drag-preview" aria-hidden="true" style={{ top: ghost.top, height: ghost.height }}>{ghost.height >= 30 && <span>{clockTime(ghost.meeting.startMinute)}–{clockTime(ghost.meeting.endMinute)}</span>}</div>}
            {positions.filter(position => position.meeting.dayOfWeek === day.value).map(position => {
              const meeting = position.meeting; const course = model.schedule!.courses.find(item => item.id === meeting.courseId)!;
              const compact = position.height < 84; const overlaps = conflictIds.has(meeting.id);
              const name = [course.title || 'Untitled course', course.courseCode, course.professorName || 'Professor blank', course.room || 'Room blank', meetingLabel(meeting), overlaps ? 'Overlaps another meeting' : '', position.clipped ? 'Partly outside the current view' : ''].filter(Boolean).join(', ');
              return <Fragment key={meeting.id}><button type="button" data-meeting-id={meeting.id} className={'calendar-meeting' + (compact ? ' compact-meeting' : '') + (overlaps ? ' conflicting-meeting' : '') + (position.height < 24 ? ' tiny-meeting' : '')}
                draggable={!drag.disabled} aria-describedby="placement-help"
                onDragStart={event => drag.begin(event, 'move', course.id, meeting, (event.clientY - event.currentTarget.getBoundingClientRect().top) / scale + Math.max(0, shown.startMinute - meeting.startMinute))}
                onDragEnd={drag.end} onKeyDown={event => drag.keyboard(event, meeting, shown)}
                disabled={disabled} aria-label={'Edit meeting: ' + name} title={name} onClick={event => model.edit(course, event.currentTarget)}
                style={{ top: position.top, height: position.height, left: `${position.lane / position.lanes * 100}%`, width: `${100 / position.lanes}%` }}>
                {!compact && <span className="card-professor">{overlaps && <span className="card-overlap">Overlap · </span>}{course.professorName || 'Professor'}</span>}
                {course.color && <span className="course-color" style={{ backgroundColor: course.color }} aria-hidden="true" />}
                <strong className="card-course-name">{compact && overlaps && <span className="card-overlap">! </span>}{course.title || 'Course name'}</strong>
                {compact && position.height >= 44 && <span className="compact-time">{clockTime(meeting.startMinute)}–{clockTime(meeting.endMinute)}</span>}
                {!compact && <span className="meeting-card-footer"><span className="card-room">{course.room || 'Room'}</span><span>{clockTime(meeting.startMinute)}–{clockTime(meeting.endMinute)}</span></span>}
              </button>
                {!compact && meeting.endMinute <= shown.endMinute && <button type="button" className="meeting-resize-handle" data-resize-id={meeting.id}
                  disabled={drag.disabled} draggable={!drag.disabled} aria-label={'Resize meeting: ' + name} aria-describedby="placement-help"
                  title="Drag to resize, or select to edit exact times" onClick={event => model.edit(course, event.currentTarget)}
                  onDragStart={event => drag.begin(event, 'resize', course.id, meeting)} onDragEnd={drag.end}
                  onKeyDown={event => drag.keyboard(event, meeting, shown, true)}
                  style={{ top: position.top + position.height - 8, left: 'calc(' + (position.lane + 0.5) / position.lanes * 100 + '% - 18px)' }} />}
              </Fragment>;
            })}
          </div>)}
        </div>
      </div>
    </div>
    <div className="week-footnote"><span>{days.map(day => day.short).join(', ')} · {clockTime(shown.startMinute)}–{clockTime(shown.endMinute)}</span><span>Drops open a draft for review</span></div>
    {meetings.length > 0 && <details className="meeting-list" ref={listRef} open><summary>Meeting list ({meetings.length})</summary><ul>{sorted.map(meeting => {
      const course = model.schedule!.courses.find(item => item.id === meeting.courseId)!;
      return <li key={meeting.id}><div><strong>{course.title || 'Untitled course'}</strong>{course.courseCode && <span>{course.courseCode}</span>}<span>{meetingLabel(meeting)}</span><span>{course.professorName || 'Professor not entered'} · {course.room || 'Room not entered'}</span>
        {conflictIds.has(meeting.id) && <span className="overlap-label">Overlaps another meeting</span>}{outsideView(meeting, shown) && <span>Outside current view</span>}</div>
        <button type="button" className="button button-secondary" disabled={disabled} aria-label={`Edit ${course.title || 'untitled course'}, ${meetingLabel(meeting)}`} onClick={event => model.edit(course, event.currentTarget)}>Edit course</button></li>;
    })}</ul></details>}
  </section>;
}
