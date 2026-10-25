import { useRef } from 'react';
import { badgeView, type ProfessorBadgeProps } from './professor-badge-model';
import './professor-badge.css';
/** Mount beside instructor text, never inside a checkbox label or enrollment button.
 * The supported portal adapter owns mounting/identity; this component performs no portal actions.
 */
export function ProfessorBadge(props: ProfessorBadgeProps) {
  const summary = useRef<HTMLElement>(null);
  const view = badgeView(props);
  return <details className="uhdx-professor" onClick={event => event.stopPropagation()} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.currentTarget.open = false; summary.current?.focus(); }
  }} onKeyUp={event => event.stopPropagation()}>
    <summary ref={summary} aria-label={props.instructorName + ': ' + (view.sample ? 'Sample ' : '') + view.label + '. Professor details'}>{view.sample ? 'Sample ' : 'RMP '}{view.label}</summary>
    <div className="uhdx-professor-details">
      <strong>{props.instructorName || 'Unnamed instructor'}</strong>
      {view.sample && <p className="uhdx-professor-sample">Sample data only. Invented identity and rating; no live lookup or saved association.</p>}
      <p>{view.explanation}</p>
      {view.snapshot && <dl>
        <div><dt>Review count</dt><dd>{view.snapshot.reviewCount ?? 'Unavailable'}</dd></div>
        <div><dt>Source</dt><dd>{view.sample ? 'Synthetic fixture' : 'RateMyProfessors'}</dd></div>
        <div><dt>Checked (UTC)</dt><dd>{new Date(view.snapshot.fetchedAt).toISOString()}</dd></div>
        <div><dt>Expires (UTC)</dt><dd>{new Date(view.snapshot.expiresAt).toISOString()}</dd></div>
      </dl>}
      {view.href && <a href={view.href} target="_blank" rel="noopener noreferrer">{view.sample ? 'Open example profile (new tab)' : 'Open profile to view ratings (new tab)'}</a>}
      {view.sample && view.href && <p>The example address is for navigation testing, not the source of these sample values.</p>}
    </div>
  </details>;
}
