import { clockTime, weekDays } from './meeting-model';
import type { ViewSettings as ViewSettingsModel } from './use-view-settings';
export function ViewSettings({ model }: { model: ViewSettingsModel }) {
  const label = (days: readonly number[]) => weekDays.filter(day => days.includes(day.value)).map(day => day.short).join(', ');
  const errorFor = (part: string) => !!model.error && !!model.field?.endsWith(part);
  return <>
    <div className="page-heading"><div><h1 id="page-title">Settings</h1><p>A timetable that fits your week.</p></div></div>
    <div className="view-settings-layout">
      <section className="settings-description"><h2>Timetable view</h2><p>Choose which days and hours appear on the grid. Courses outside this view stay saved.</p>
        <p>Times use 24-hour HH:mm. Use 24:00 for the end of the day.</p>
        <p className="settings-preview">Preview: {label(model.draft.days) || 'No days selected'}<br />{model.draft.start || 'Start not set'}–{model.draft.end || 'End not set'}</p>
      </section>
      <form className="view-settings-form" onSubmit={event => { event.preventDefault(); void model.save(); }}>
        <p role="status" className="save-feedback">{model.message}</p>
        {model.error && !model.field && <p role="alert" className="error-message">{model.error}</p>}
        {model.recovery && <button type="button" className="button button-secondary" disabled={model.busy} onClick={model.reload}>Reload saved settings</button>}
        {model.review && <section className="review-panel"><h3>Review the saved view</h3><p>{label(model.settings.visibleDays)} · {clockTime(model.settings.startMinute)}–{clockTime(model.settings.endMinute)}</p><p>Your draft is below. Keeping it allows you to save these days and hours over the saved view.</p>
          <button type="button" className="button button-secondary" onClick={model.acceptReview}>Keep my view draft</button></section>}
        <fieldset className="view-fields" disabled={!model.ready || model.busy}>
          <legend>Visible days</legend>
          <div className="day-choices">{weekDays.map(day => <label key={day.value}><input type="checkbox" checked={model.draft.days.includes(day.value)}
            onChange={event => model.update({ ...model.draft, days: event.target.checked ? [...model.draft.days, day.value] : model.draft.days.filter(value => value !== day.value) })} />{day.label}</label>)}</div>
          {errorFor('visibleDays') && <p role="alert" className="error-message">{model.error}</p>}
          <div className="editor-fields view-time-fields">
            <label htmlFor="view-start"><span id="view-start-label">Start of day</span><input aria-labelledby="view-start-label" id="view-start" value={model.draft.start} placeholder="07:00" inputMode="numeric" autoComplete="off" aria-invalid={errorFor('startMinute')} aria-describedby={errorFor('startMinute') ? 'view-start-error' : undefined}
              onChange={event => model.update({ ...model.draft, start: event.target.value })} />{errorFor('startMinute') && <span id="view-start-error" role="alert" className="error-message">{model.error}</span>}</label>
            <label htmlFor="view-end"><span id="view-end-label">End of day</span><input aria-labelledby="view-end-label" id="view-end" value={model.draft.end} placeholder="22:00" inputMode="numeric" autoComplete="off" aria-invalid={errorFor('endMinute')} aria-describedby={errorFor('endMinute') ? 'view-end-error' : undefined}
              onChange={event => model.update({ ...model.draft, end: event.target.value })} />{errorFor('endMinute') && <span id="view-end-error" role="alert" className="error-message">{model.error}</span>}</label>
          </div>
        </fieldset>
        <div className="editor-actions"><button type="submit" className="button button-primary" disabled={!model.ready || model.busy || model.recovery || model.review || !model.dirty}>Save settings</button>
          <button type="button" className="button button-secondary" disabled={model.busy || !model.dirty} onClick={model.cancel}>Cancel changes</button></div>
      </form>
    </div>
    <p className="settings-limit">Backup, import, and timezone controls are not available yet. Changing the view never changes your meeting times.</p>
    <a className="text-action" href="#timetable">Back to timetable</a>
  </>;
}
