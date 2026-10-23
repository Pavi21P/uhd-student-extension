import { useState } from 'react';
import { Brand } from '../ui/Brand';
import { Icon } from '../ui/Icon';
import { openDashboard } from './open-dashboard';

export function App() {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);

  async function open() {
    if (opening) return;
    setOpening(true);
    setError(false);
    try {
      await openDashboard();
      // Closing the toolbar popup is appropriate only after the tab was created.
      if (typeof chrome !== 'undefined' && chrome.runtime?.id) window.close();
    } catch {
      setError(true);
    } finally {
      setOpening(false);
    }
  }

  return (
    <main className="popup">
      <header className="popup-header"><Brand compact /><span className="build-label">Preview</span></header>
      <div className="popup-content">
        <h1>Your week, in view.</h1>
        <p>One workspace for the classes you’re planning.</p>
        <button className="button button-primary" type="button" disabled={opening} onClick={() => void open()}>
          {opening ? 'Opening workspace…' : 'Open timetable'}<Icon name="arrow" />
        </button>
        {error && <p className="error-message" role="alert">The workspace could not open. Try again, or open Extension options from your browser.</p>}
      </div>
      <footer className="popup-footer">
        <strong>Course cards, saved locally</strong>
        <p>Add and edit course cards. Grid placement, ratings, and enrollment are still to come.</p>
      </footer>
    </main>
  );
}
