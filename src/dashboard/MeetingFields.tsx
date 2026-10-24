import { useMemo, useRef } from 'react';
import type { DayOfWeek } from '../shared/domain';
import { findMeetingConflicts } from '../shared/meeting-time';
import { changeCourse, emptySchedule } from './course-model';
import { clockTime, parseMeetingDrafts, weekDays } from './meeting-model';
import type { CourseWorkspace } from './use-course-workspace';
export function MeetingFields({ model }: { model: CourseWorkspace }) {
  const addButton = useRef<HTMLButtonElement>(null);
  const conflicts = useMemo(() => {
    if (!model.draft || (!model.savedCourse && !model.newCourse)) return [];
    const parsed = parseMeetingDrafts(model.draft.id, model.meetingDrafts);
    if (!parsed.ok) return [];
    try {
      const next = changeCourse(model.schedule ?? emptySchedule(), { kind: model.savedCourse ? 'edit' : 'add', course: model.draft, meetings: parsed.meetings });
      const ids = new Set(parsed.meetings.map(meeting => meeting.id));
      return findMeetingConflicts(next).filter(conflict => conflict.meetingIds.some(id => ids.has(id)));
    } catch { return []; }
  }, [model.draft, model.meetingDrafts, model.savedCourse, model.newCourse, model.schedule]);
  return <section className="meeting-fields" aria-labelledby="meeting-fields-title">
    <h3 id="meeting-fields-title">Meetings</h3><p id="meeting-time-help">Add one row for each day or lab. Use 24-hour HH:mm, including 24:00 for the end of the day. Leave the list empty for an unscheduled course.</p>
    {model.meetingDrafts.map((meeting, index) => {
      const errors = model.meetingErrors[meeting.id];
      return <fieldset className="meeting-row" key={meeting.id} disabled={model.busy}>
        <legend>Meeting {index + 1}</legend>
        <label htmlFor={'day-' + meeting.id}><span id={'day-label-' + meeting.id}>Day</span><select id={'day-' + meeting.id} aria-labelledby={'day-label-' + meeting.id} value={meeting.dayOfWeek}
          aria-invalid={!!errors?.day} onChange={event => model.setMeetings(model.meetingDrafts.map(row => row.id === meeting.id ? { ...row, dayOfWeek: Number(event.target.value) as DayOfWeek } : row))}>
          {weekDays.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select>{errors?.day && <span role="alert" className="error-message">{errors.day}</span>}</label>
        {(['start', 'end'] as const).map(field => <label htmlFor={field + '-' + meeting.id} key={field}><span id={`${field}-label-${meeting.id}`}>{field === 'start' ? 'Start' : 'End'}</span>
          <input id={field + '-' + meeting.id} aria-labelledby={`${field}-label-${meeting.id}`} value={meeting[field]} inputMode="numeric" placeholder={field === 'start' ? '09:00' : '10:00'} autoComplete="off"
            aria-invalid={!!errors?.[field]} aria-describedby={errors?.[field] ? `${field}-error-${meeting.id}` : 'meeting-time-help'}
            onChange={event => model.setMeetings(model.meetingDrafts.map(row => row.id === meeting.id ? { ...row, [field]: event.target.value } : row))} />
          {errors?.[field] && <span id={`${field}-error-${meeting.id}`} role="alert" className="error-message">{errors[field]}</span>}</label>)}
        <button type="button" className="button button-secondary remove-meeting" onClick={() => { model.setMeetings(model.meetingDrafts.filter(row => row.id !== meeting.id)); queueMicrotask(() => addButton.current?.focus()); }}>Remove meeting {index + 1}</button>
      </fieldset>;
    })}
    <button ref={addButton} type="button" className="button button-secondary" disabled={model.busy || model.meetingDrafts.length >= 1000} onClick={() => {
      const id = crypto.randomUUID(); model.setMeetings([...model.meetingDrafts, { id, dayOfWeek: 1, start: '', end: '' }]);
      queueMicrotask(() => document.getElementById('day-' + id)?.focus());
    }}>Add meeting</button>
    {conflicts.length > 0 && <div className="overlap-note" role="status"><strong>{conflicts.length} {conflicts.length === 1 ? 'overlap' : 'overlaps'} in this draft</strong>
      <p>You can save these times. Check that you can attend both meetings.</p>
      <ul>{conflicts.slice(0, 5).map(conflict => <li key={conflict.meetingIds.join(':')}>{weekDays[conflict.dayOfWeek - 1]!.label}, {clockTime(conflict.startMinute)}–{clockTime(conflict.endMinute)}</li>)}</ul>
      {conflicts.length > 5 && <p>And {conflicts.length - 5} more overlaps.</p>}
    </div>}
  </section>;
}
