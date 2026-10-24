import { Icon } from '../ui/Icon';
import { plannerUrl } from './navigation';

export function Planner() {
  return (
    <>
      <div className="page-heading">
        <div><h1 id="page-title">Planner</h1><p>Plan your degree. Make room for your week.</p></div>
      </div>
      <div className="planner-layout">
        <section className="planner-destination" aria-labelledby="planner-title">
          <h2 id="planner-title">UHD Course Planner</h2>
          <p>Explore your degree requirements and course connections in your existing planner.</p>
          <a className="button button-primary" href={plannerUrl} target="_blank" rel="noopener noreferrer" aria-describedby="planner-tab-note">
            Open course planner<Icon name="external" />
          </a>
          <p className="destination-note" id="planner-tab-note">Opens in a new browser tab.</p>
          <span className="destination-host">uhd-course-planner.pages.dev</span>
        </section>
        <aside className="planner-save-note" aria-labelledby="planner-save-title">
          <h2 id="planner-save-title">Saved separately</h2>
          <p>Your course planner saves separately from this extension.</p>
          <p>Changes in one won’t change the other. Courses aren’t copied into your timetable automatically.</p>
        </aside>
      </div>
    </>
  );
}
