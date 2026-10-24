import { useEffect, useRef, useState } from 'react';
import type { CourseCard } from '../shared/domain';
import { MeetingFields } from './MeetingFields';
import { meetingLabel } from './meeting-model';
import type { CourseWorkspace } from './use-course-workspace';

const fields = [
  ['title', 'Course name', 200], ['courseCode', 'Course code', 40],
  ['professorName', 'Professor', 200], ['room', 'Room', 80],
] as const;
const colors = [['', 'Default'], ['#21675a', 'Green'], ['#395d91', 'Blue'], ['#76548b', 'Purple'], ['#a46a24', 'Amber']] as const;
export function SaveStatus({ model }: { model: CourseWorkspace }) {
  return <div className="save-feedback">
    <p role="status">{model.message}</p>
    {model.error && <p className="error-message" role="alert">{model.error}</p>}
    {model.recovery && <button id="reload-courses" type="button" className="button button-secondary" onClick={model.reload} disabled={model.busy}>Reload saved courses</button>}
  </div>;
}
export function CourseEditor({ model }: { model: CourseWorkspace }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!model.busy && !focused.current) { firstInput.current?.focus(); focused.current = true; }
  }, [model.busy]);
  useEffect(() => {
    const element = dialog.current!;
    const media = window.matchMedia('(max-width: 800px)');
    const display = () => { element.close(); if (media.matches) element.showModal(); else element.show(); };
    display(); firstInput.current?.focus();
    media.addEventListener('change', display);
    return () => { media.removeEventListener('change', display); element.close(); };
  }, []);
  useEffect(() => {
    if (model.focusedMeeting) document.getElementById('start-' + model.focusedMeeting)?.focus();
  }, [model.focusedMeeting]);
  const draft = model.draft!;
  const meetingCount = model.schedule?.meetings.filter(meeting => meeting.courseId === draft.id).length ?? 0;
  const missing = !model.savedCourse && !model.newCourse;
  const blocked = model.busy || model.recovery || model.review || missing;
  const update = (field: keyof Omit<CourseCard, 'id'>, value: string) => {
    const next = { ...draft, [field]: value };
    if (field === 'color' && !value) delete next.color;
    model.setDraft(next);
  };
  return <dialog ref={dialog} className="course-editor" aria-labelledby="editor-title" aria-describedby="editor-help"
    onCancel={event => { event.preventDefault(); model.close(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); model.close(); } }}>
    <form onSubmit={event => { event.preventDefault(); if (!blocked) model.save(); }}>
      <h2 id="editor-title">Course details</h2>
      <p id="editor-help" className="editor-help">Course details are optional. Add meetings when you know their times.</p>
      <SaveStatus model={model} />
      {model.review && <section className="review-panel" aria-labelledby="review-title">
        <h3 id="review-title">Review the saved version</h3>
        <p>Your draft is in the fields below. Saving it replaces this course’s saved details and meetings; other courses stay as loaded.</p>
        {model.savedCourse ? <dl>{fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{model.savedCourse?.[key] || 'Blank'}</dd></div>)}<div><dt>Color</dt><dd>{model.savedCourse.color || 'Default'}</dd></div></dl>
          : <p>{missing ? 'This course is no longer saved. Copy any draft text you need, then Cancel. It will not be recreated automatically.' : 'This new card has not been saved. Keep your draft to create it.'}</p>}
        {model.savedCourse && <div className="saved-meetings"><strong>Saved meetings</strong><ul>{model.schedule?.meetings.filter(meeting => meeting.courseId === draft.id).map(meeting => <li key={meeting.id}>{meetingLabel(meeting)}</li>)}</ul>{!meetingCount && <p>No saved meetings</p>}</div>}
        {!missing && <button type="button" className="button button-secondary" onClick={model.acceptReview}>Keep my draft</button>}
      </section>}
      <fieldset className="editor-fields" disabled={model.busy}>
        <legend className="sr-only">Optional course details</legend>
        {fields.map(([key, label, limit], index) => <label key={key} htmlFor={'course-' + key}>{label}
          <input ref={index === 0 ? firstInput : undefined} id={'course-' + key} value={draft[key] ?? ''} maxLength={limit}
            onChange={event => update(key, event.target.value)} autoComplete="off" />
        </label>)}
        <label htmlFor="course-color"><span id="course-color-label">Card color</span>
          <select aria-labelledby="course-color-label" id="course-color" value={draft.color ?? ''} onChange={event => update('color', event.target.value)}>
            {colors.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            {draft.color && !colors.some(([value]) => value === draft.color) && <option value={draft.color}>Custom ({draft.color})</option>}
          </select>
        </label>
      </fieldset>
      <MeetingFields model={model} />
      <div className="editor-actions">
        <button type="submit" className="button button-primary" disabled={blocked}>Save course</button>
        <button type="button" className="button button-secondary" onClick={model.close} disabled={model.busy}>Cancel</button>
      </div>
      <div className="delete-course">
        {confirmDelete ? <div role="group" aria-label="Confirm course deletion"><p>Delete this course and its {meetingCount} {meetingCount === 1 ? 'meeting' : 'meetings'}? This cannot be undone.</p>
      <div className="editor-actions"><button type="button" className="button button-danger" disabled={blocked} onClick={model.remove}>Confirm delete</button>
          <button type="button" className="button button-secondary" onClick={() => setConfirmDelete(false)} disabled={model.busy}>Keep course</button></div></div>
          : <button type="button" className="button button-danger" disabled={blocked || !model.savedCourse}
            onClick={() => { if (meetingCount) setConfirmDelete(true); else model.remove(); }}>Delete course</button>}
      </div>
    </form>
  </dialog>;
}
