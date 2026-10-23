import { Icon } from '../ui/Icon';
import { CourseEditor, SaveStatus } from './CourseEditor';
import type { CourseWorkspace } from './use-course-workspace';

export function Timetable({ model }: { model: CourseWorkspace }) {
  const saved = model.schedule?.courses ?? [];
  const courses = model.draft && model.newCourse && !saved.some(course => course.id === model.draft?.id)
    ? [...saved, { id: model.draft.id }] : saved;
  const unscheduled = courses.filter(course => !model.schedule?.meetings.some(meeting => meeting.courseId === course.id));
  const scheduled = courses.filter(course => !unscheduled.includes(course));
  function cards(items: typeof courses) {
    return items.map(course => <button type="button" className="course-card" key={course.id}
      disabled={!!model.draft || model.busy || model.recovery}
      aria-label={['Edit course', course.title || 'Untitled course', course.courseCode, course.professorName || 'Professor blank', course.room || 'Room blank'].filter(Boolean).join(', ')}
      onClick={event => model.edit(course, event.currentTarget)}>
      <span className="card-professor" title={course.professorName}>{course.professorName || 'Professor'}</span>
      {course.color && <span className="course-color" style={{ backgroundColor: course.color }} aria-hidden="true" />}
      <strong className="card-course-name" title={course.title}>{course.title || 'Course name'}</strong>
      <span className="card-room" title={course.room}>{course.room || 'Room'}</span>
    </button>);
  }
  return <>
    <div className="page-heading"><div><h1 id="page-title">Timetable</h1><p>Your classes. A clearer week.</p></div>
      <button id="add-course" type="button" className="button button-primary" disabled={!model.ready || model.busy || !!model.draft || model.recovery || courses.length >= 250}
        onClick={event => model.add(event.currentTarget)}><Icon name="plus" />Add course</button>
    </div>
    {!model.draft && <SaveStatus model={model} />}
    <div className="workspace-layout">
      <aside className="course-tray live-tray" aria-labelledby="tray-title">
        <div className="section-title"><h2 id="tray-title">Unscheduled</h2><span className="count-label">{unscheduled.length} {unscheduled.length === 1 ? 'course' : 'courses'}</span></div>
        <p className="tray-intro">Start blank. Fill in the details whenever you’re ready.</p>
        <div className="course-list">{cards(unscheduled)}</div>
        {model.ready && !unscheduled.length && <p className="tray-footnote">No unscheduled courses. Use Add course to create a card.</p>}
        {scheduled.length > 0 && <section className="scheduled-courses"><h2>Courses with saved meetings</h2><p className="tray-intro">Your meeting data is kept. Grid placement comes in a later build.</p><div className="course-list">{cards(scheduled)}</div></section>}
        {courses.length >= 250 && <p className="tray-footnote">This timetable has reached its 250-course limit.</p>}
      </aside>
      <div className="timetable-detail">
        {model.draft && <CourseEditor key={model.draft.id} model={model} />}
        <section className="week-panel" aria-labelledby="week-title">
          <div className="week-heading"><h2 id="week-title">Week at a glance</h2><span>Monday–Friday</span></div>
          <div className="week-preview"><div className="day-labels" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => <span key={day}>{day}</span>)}</div>
            <div className="week-canvas"><div className="week-columns" aria-hidden="true">{[0, 1, 2, 3, 4].map(day => <span key={day} />)}</div>
              <div className="empty-week"><Icon name="calendar" /><h3>Room for your week.</h3><p>Course details save locally.<br />Placing classes on this grid comes next.</p></div>
            </div>
          </div>
          <div className="week-footnote"><span>Grid preview · Meeting editing unavailable</span><span>Stored only in this browser profile</span></div>
        </section>
      </div>
    </div>
    <details className="availability"><summary>What works in this build?</summary><div className="availability-content">
      <p>Create blank course cards, edit their details, delete them, and reopen your saved courses. Open the separate course planner from Planner.</p>
      <p>Grid placement, live professor ratings, and enrollment are not available yet. No connection to myUHD is made.</p>
    </div></details>
  </>;
}
