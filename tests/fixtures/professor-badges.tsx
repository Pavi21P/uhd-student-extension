import { createRoot } from 'react-dom/client';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/600.css';
import { ProfessorBadge } from '../../src/ui/ProfessorBadge';
import type { ProfessorBadgeProps } from '../../src/ui/professor-badge-model';
import type { RatingSnapshot } from '../../src/shared/domain';
import './professor-badges.css';
const now = Date.UTC(2026, 9, 25, 12);
const snapshot: RatingSnapshot = { provider: 'rmp', schoolId: 'synthetic-school', professorId: '12345', overall: 4.2, reviewCount: 12, sourceUrl: 'https://www.ratemyprofessors.com/professor/12345', fetchedAt: now - 3600000, expiresAt: now + 3600000, provenance: 'synthetic-fixture' };
const examples: ProfessorBadgeProps[] = [
  { instructorName: 'Alex Sample', result: { status: 'available', snapshot }, identity: 'confirmed' },
  { instructorName: 'Jordan Example', result: { status: 'ambiguous', candidates: [] }, identity: 'unverified' },
  { instructorName: 'Sam Sample', result: { status: 'available', snapshot: { ...snapshot, overall: null, reviewCount: 0 } }, identity: 'confirmed' },
  { instructorName: 'Casey Example', result: { status: 'stale', snapshot: { ...snapshot, expiresAt: now - 1 } }, identity: 'confirmed' },
  { instructorName: 'Taylor Example', result: { status: 'link-only', profileUrl: snapshot.sourceUrl + '?fixture=1' }, identity: 'unverified' },
  { instructorName: 'Staff / TBA', result: { status: 'unassigned' }, identity: 'unverified' },
  { instructorName: 'A. Example', result: { status: 'available', snapshot }, identity: 'unverified' },
  { instructorName: 'Morgan Sample', result: { status: 'no-match' }, identity: 'unverified' },
  { instructorName: 'Loading Sample', result: { status: 'loading' }, identity: 'unverified' },
  { instructorName: 'Unavailable Sample', result: { status: 'unavailable', reason: 'provider-unconfigured' }, identity: 'unverified' },
  { instructorName: '<b>Long synthetic instructor</b> ' + 'Extended name '.repeat(10), result: { status: 'link-only', profileUrl: 'javascript:alert(1)' }, identity: 'unverified' },
];
const tbody = document.querySelector('#fixture-rows')!;
for (const [index, example] of examples.entries()) {
  const row = document.createElement('tr'); row.dataset.fixtureRow = String(index);
  row.innerHTML = '<td><input type="checkbox" name="sections"><label></label></td><td></td><td><span class="instructor"></span> <div class="badge-host"></div></td>';
  const checkbox = row.querySelector('input')!; checkbox.id = 'section-' + index; checkbox.value = 'sample-' + index;
  const label = row.querySelector('label')!; label.htmlFor = checkbox.id; label.textContent = 'Select ' + (index + 1);
  row.cells[1]!.textContent = 'EXAMPLE ' + (1000 + index);
  row.querySelector('.instructor')!.textContent = example.instructorName;
  // Deliberately exercise a delegated row handler; badge events must not reach it.
  row.addEventListener('click', event => { if (!(event.target as Element).closest('input, label, button, a')) checkbox.checked = !checkbox.checked; });
  tbody.append(row); createRoot(row.querySelector('.badge-host')!).render(<ProfessorBadge {...example} sample now={now} />);
}
let submissions = 0;
document.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); const selected = new FormData(event.currentTarget as HTMLFormElement).getAll('sections'); document.querySelector('#fixture-outcome')!.textContent = 'Sample submissions: ' + ++submissions + '; selected: ' + selected.join(', '); });
