import { Icon } from '../ui/Icon';

export function TimetablePreview() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1 id="page-title">Timetable</h1>
          <p>Your classes. A clearer week.</p>
        </div>
        <button type="button" className="button button-disabled" disabled aria-describedby="preview-note"><Icon name="plus" />Add course</button>
      </div>

      <p className="preview-note" id="preview-note"><Icon name="info" /><span>This is a workspace preview. Course editing, ratings, and enrollment are not available yet.</span></p>

      <div className="workspace-layout">
        <aside className="course-tray" aria-labelledby="tray-title">
          <div className="section-title">
            <h2 id="tray-title">Unscheduled</h2>
            <span className="count-label">No courses</span>
          </div>
          <p className="tray-intro">A place for classes before they have a time.</p>
          <figure className="card-example">
            <div className="course-card-preview" role="img" aria-label="Course card layout preview: professor at top left, course name centered, room at bottom left. No course has been created.">
              <span className="card-professor">Professor name</span>
              <strong className="card-course-name">Course name</strong>
              <span className="card-room">Room number</span>
            </div>
            <figcaption>Card layout preview</figcaption>
          </figure>
          <p className="tray-footnote">Name, professor, and room will be yours to fill in. Start blank, add details later.</p>
        </aside>

        <section className="week-panel" aria-labelledby="week-title">
          <div className="week-heading">
            <h2 id="week-title">Week at a glance</h2>
            <span>Monday–Friday</span>
          </div>
          <div className="week-preview">
            <div className="day-labels" aria-hidden="true">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => <span key={day}>{day}</span>)}
            </div>
            <div className="week-canvas">
              <div className="week-columns" aria-hidden="true">{[0, 1, 2, 3, 4].map(day => <span key={day} />)}</div>
              <div className="empty-week">
                <Icon name="calendar" />
                <h3>Room for your week.</h3>
                <p>Your course cards will go here.<br />Timetable editing is coming in a later build.</p>
              </div>
            </div>
          </div>
          <div className="week-footnote"><span>No schedule data is stored in this preview.</span><span>No classes selected</span></div>
        </section>
      </div>

      <details className="availability">
        <summary>What works in this preview?</summary>
        <div className="availability-content">
          <p>Switch between the workspace tabs or open the existing course planner from Planner. The course card and weekly layout are previews only.</p>
          <p>You cannot add courses, fetch ratings, or schedule enrollment yet. No connection to myUHD is made.</p>
        </div>
      </details>
    </>
  );
}
