import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Brand } from '../ui/Brand';
import { Icon } from '../ui/Icon';
import { sectionFromHash, sections, type SectionId } from './navigation';
import { Planner } from './Planner';
import { useCourseWorkspace } from './use-course-workspace';
import { ViewSettings } from './ViewSettings';
import { useViewSettings } from './use-view-settings';
import { useTimetableTransfer } from './use-timetable-transfer';
import { Timetable } from './Timetable';
import { UnavailableSection } from './UnavailableSection';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
const snapshot = () => sectionFromHash(window.location.hash);

export function App() {
  const courses = useCourseWorkspace();
  const transfer = useTimetableTransfer(courses);
  const view = useViewSettings();
  const section = useSyncExternalStore<SectionId>(subscribe, snapshot, () => 'timetable');
  const main = useRef<HTMLElement>(null);
  const previousSection = useRef(section);
  useEffect(() => {
    const label = sections.find(item => item.id === section)!.label;
    document.title = label + ' · UHD Student Extension';
    if (previousSection.current !== section) {
      main.current?.focus();
      previousSection.current = section;
    }
  }, [section]);

  return (
    <div className="workspace">
      <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); main.current?.focus(); }}>Skip to content</a>
      <header className="app-header"><Brand /><span className="build-label">Preview build</span></header>
      <div className="workspace-sheet">
        <nav className="workspace-nav" aria-label="Workspace sections">
          {sections.map(item => (
            <a key={item.id} className={'nav-item' + (item.id === section ? ' current' : '')}
              href={'#' + item.id} aria-current={item.id === section ? 'page' : undefined}
              onClick={event => {
                if (item.id === section && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) main.current?.focus();
              }}>
              {item.id === 'timetable' && <Icon name="calendar" />}{item.label}
            </a>
          ))}
        </nav>
        <main ref={main} id="main" tabIndex={-1} className="main-content" aria-labelledby="page-title">
          {section === 'timetable' ? <Timetable model={courses} view={view} transfer={transfer} /> : section === 'planner' ? <Planner /> : section === 'settings' ? <ViewSettings model={view} /> : <UnavailableSection section={section} />}
        </main>
        <footer className="app-footer"><span>Built for UHD students.</span><span>Independent project · Not affiliated with UHD</span></footer>
      </div>
    </div>
  );
}
