import { useEffect, useRef } from 'react';
import { meetingLabel } from './meeting-model';
import type { CourseWorkspace } from './use-course-workspace';
import type { TimetableTransfer } from './use-timetable-transfer';
export function TimetableBackup({ model, transfer }: { model: CourseWorkspace; transfer: TimetableTransfer }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (model.transferOpen) input.current?.focus(); }, [model.transferOpen]);
  const blocked = model.busy || transfer.loading || model.recovery || !model.ready;
  const imported = transfer.backup?.schedule; const result = transfer.preview?.schedule;
  return <section className="backup-tools" aria-labelledby="backup-title">
    <div className="backup-toolbar"><h2 id="backup-title">Backup & import</h2><div className="backup-actions">
      <button type="button" className="button button-secondary" disabled={blocked || !!model.draft} onClick={() => void transfer.download()}>Download backup</button>
      <button id="open-import" type="button" className="button button-secondary" disabled={blocked || !!model.draft || model.transferOpen} onClick={transfer.open}>Import backup</button>
    </div></div>
    <p className="backup-scope">Timetable courses and meetings only. View settings and the separate course planner are not included.{model.draft && ' Save or cancel the course draft first.'}</p>
    {transfer.notice && <p role="status" className="save-feedback">{transfer.notice}</p>}
    {transfer.error && <p role="alert" className="error-message">{transfer.error}</p>}
    {model.transferOpen && <div className="import-panel" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); transfer.close(); } }}>
      <h3>Choose and review a backup</h3><p>Opening a file does not change your timetable. Maximum file size: 1 MiB.</p>
      <label className="backup-file">Timetable JSON file<input ref={input} type="file" accept=".json,application/json" disabled={blocked}
        onClick={event => { event.currentTarget.value = ''; }} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void transfer.choose(file); }} /></label>
      {transfer.loading && <p role="status">Reading saved timetable data...</p>}
      {imported && <>
        <p className="backup-filename">File: {transfer.fileName}</p>
        <fieldset className="import-mode" disabled={blocked}><legend>How should this file be imported?</legend>
          <label><input type="radio" name="import-mode" value="merge" checked={transfer.mode === 'merge'} onChange={() => transfer.setMode('merge')} />Merge as new courses</label>
          <label><input type="radio" name="import-mode" value="replace" checked={transfer.mode === 'replace'} onChange={() => transfer.setMode('replace')} />Replace this timetable</label>
        </fieldset>
        <p className={transfer.mode === 'replace' ? 'import-warning' : ''}>{transfer.mode === 'merge' ? 'Merge adds every imported course as a separate copy. Importing the same file again creates duplicates, even when names match.' : 'Replace removes all currently saved courses and meetings from this timetable and adopts the file contents. Download a backup first if you want to keep the current version.'}</p>
        {transfer.uncertain && <p role="alert" className="import-warning">The previous import may already be saved. Reload saved courses and check the current counts before refreshing this preview. Another merge can duplicate courses.</p>}
        {transfer.stale && <div className="review-panel"><p>The saved timetable changed or the previous import is unconfirmed. Review a fresh preview before importing.</p><button type="button" className="button button-secondary" disabled={blocked} onClick={transfer.refresh}>Refresh import preview</button></div>}
        {transfer.preview?.error && <p role="alert" className="error-message">{transfer.preview.error}</p>}
        <dl className="import-summary">
          <div><dt>Current saved timetable</dt><dd>{model.schedule?.courses.length ?? 0} courses, {model.schedule?.meetings.length ?? 0} meetings</dd></div>
          <div><dt>In this file</dt><dd>{imported.courses.length} courses, {imported.meetings.length} meetings · {imported.timezone}</dd></div>
          {result && <div><dt>After {transfer.mode}{transfer.stale ? ' (outdated preview)' : ''}</dt><dd>{result.courses.length} courses, {result.meetings.length} meetings · {result.timezone}<br />{result.label || 'Unnamed timetable'}{result.termLabel ? ' · ' + result.termLabel : ''}</dd></div>}
        </dl>
        <details className="import-contents"><summary>Review imported courses and meeting times</summary><ul>{imported.courses.map(course => <li key={course.id}><strong>{course.title || 'Untitled course'}</strong><span>{[course.courseCode, course.professorName, course.room].filter(Boolean).join(' · ') || 'Details not entered'}</span>
          <ul>{imported.meetings.filter(meeting => meeting.courseId === course.id).map(meeting => <li key={meeting.id}>{meetingLabel(meeting)}</li>)}</ul>{!imported.meetings.some(meeting => meeting.courseId === course.id) && <span>No meetings</span>}</li>)}</ul>{!imported.courses.length && <p>This backup contains no courses.</p>}</details>
      </>}
      <div className="editor-actions">
        {imported && <button type="button" className={'button ' + (transfer.mode === 'replace' ? 'button-danger' : 'button-primary')} disabled={blocked || transfer.stale || !result} onClick={() => void transfer.confirm()}>{transfer.mode === 'replace' ? 'Replace timetable' : 'Merge courses'}</button>}
        <button type="button" className="button button-secondary" disabled={model.busy} onClick={transfer.close}>Cancel import</button>
      </div>
    </div>}
  </section>;
}
