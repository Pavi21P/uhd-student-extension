import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { badgeView, type ProfessorBadgeProps } from '../../src/ui/professor-badge-model';
import { ProfessorBadge } from '../../src/ui/ProfessorBadge';
import type { RatingSnapshot } from '../../src/shared/domain';
const now = Date.UTC(2026, 9, 25, 12);
const snapshot: RatingSnapshot = { provider: 'rmp', schoolId: 'sample-school', professorId: '12345', overall: 4.2, reviewCount: 12, sourceUrl: 'https://ratemyprofessors.com/professor/12345?sample=1', fetchedAt: now - 1000, expiresAt: now + 1000, provenance: 'synthetic-fixture' };
const props: ProfessorBadgeProps = { instructorName: 'Alex Sample', identity: 'confirmed', result: { status: 'available', snapshot }, now };
const view = (patch: Partial<RatingSnapshot>) => badgeView({ ...props, result: { status: 'available', snapshot: { ...snapshot, ...patch } } });
describe('inline badge trust and navigation boundaries', () => {
  it('forces synthetic labeling, canonical source and count metadata', () => {
    expect(badgeView(props)).toMatchObject({ sample: true, label: '4.2 / 5', href: 'https://www.ratemyprofessors.com/professor/12345', snapshot: { reviewCount: 12 } });
  });
  it('withholds ratings and navigation until identity is confirmed', () => {
    expect(badgeView({ ...props, identity: 'unverified' })).toEqual({ sample: true, label: 'Identity unverified', explanation: expect.any(String) });
  });
  it('does not pick an ambiguous candidate even if the caller says confirmed', () => {
    const result = badgeView({ ...props, result: { status: 'ambiguous', candidates: [] } });
    expect(result.label).toBe('Choose a match'); expect(result.href).toBeUndefined(); expect(result.snapshot).toBeUndefined();
  });
  it('distinguishes missing values and zero reviews from a zero rating', () => {
    expect(view({ overall: null, reviewCount: 0 })).toMatchObject({ label: 'Not rated', snapshot: { reviewCount: 0 } });
    expect(view({ overall: null, reviewCount: null })).toMatchObject({ label: 'Not rated', snapshot: { reviewCount: null } });
  });
  it('labels expiry at the boundary and honors explicitly stale results', () => {
    expect(view({ expiresAt: now }).label).toBe('Stale: 4.2 / 5');
    expect(badgeView({ ...props, result: { status: 'stale', snapshot } }).label).toBe('Stale: 4.2 / 5');
  });
  it.each([
    { overall: 0 }, { overall: 6 }, { overall: NaN }, { reviewCount: -1 }, { reviewCount: 0 }, { reviewCount: 1.5 },
    { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'https://www.ratemyprofessors.com.evil.example/professor/12345' },
    { professorId: '67890' }, { schoolId: '' }, { fetchedAt: now + 1 }, { fetchedAt: NaN },
    { expiresAt: now - 2000 }, { expiresAt: 9e15 },
  ])('hides malformed or conflicting snapshot %j', patch => {
    expect(view(patch)).toMatchObject({ label: 'Ratings unavailable' });
    expect(view(patch).snapshot).toBeUndefined(); expect(view(patch).href).toBeUndefined();
  });
  it('provides only a canonical unverified link for link-only state', () => {
    expect(badgeView({ ...props, identity: 'unverified', result: { status: 'link-only', profileUrl: snapshot.sourceUrl } })).toMatchObject({ label: 'Unverified profile', href: 'https://www.ratemyprofessors.com/professor/12345' });
    expect(badgeView({ ...props, result: { status: 'link-only', profileUrl: 'javascript:alert(1)' } }).href).toBeUndefined();
  });
  it.each(['loading', 'unassigned', 'no-match'] as const)('keeps %s free of ratings and source navigation', status => {
    const result = badgeView({ ...props, result: { status } }); expect(result.snapshot).toBeUndefined(); expect(result.href).toBeUndefined();
  });
  it('renders literal names, a native disclosure and protected source link without form controls', () => {
    const html = renderToStaticMarkup(createElement(ProfessorBadge, { ...props, instructorName: '<b>Example</b>' }));
    expect(html).toContain('&lt;b&gt;Example&lt;/b&gt;'); expect(html).not.toContain('<b>');
    expect(html).toContain('<summary'); expect(html).toContain('Sample 4.2 / 5');
    expect(html).toContain('rel="noopener noreferrer"'); expect(html).toContain('target="_blank"');
    expect(html).not.toMatch(/<(button|input|form)\b/);
  });
});