import type { ProfessorResult, RatingSnapshot } from '../shared/domain';
import { parseProfileLink } from '../shared/professor-profile';
export type BadgeResult = ProfessorResult | { status: 'loading' } | { status: 'unassigned' } | { status: 'link-only'; profileUrl: string };
export interface ProfessorBadgeProps {
  instructorName: string;
  result: BadgeResult;
  identity: 'confirmed' | 'unverified';
  sample?: boolean;
  now?: number;
}
export interface BadgeView { label: string; explanation: string; sample: boolean; href?: string; snapshot?: RatingSnapshot }
export function badgeView({ result, identity, sample = false, now = Date.now() }: ProfessorBadgeProps): BadgeView {
  const base = { sample: sample || (('snapshot' in result) && result.snapshot.provenance === 'synthetic-fixture') };
  const unavailable = { ...base, label: 'Ratings unavailable', explanation: 'No usable rating data. Missing ratings are not zero.' };
  if (result.status === 'unassigned') return { ...base, label: 'Unassigned instructor', explanation: 'Wait for an assigned instructor. No profile was chosen.' };
  if (result.status === 'loading') return { ...base, label: 'Loading ratings', explanation: base.sample ? 'Sample loading state. No request is running.' : 'Waiting for professor information.' };
  if (result.status === 'ambiguous') return { ...base, label: 'Choose a match', explanation: 'Identity is uncertain. Compare instructor, school and department in Professors before linking a profile. No candidate was chosen automatically.' };
  if (result.status === 'no-match') return { ...base, label: 'No match found', explanation: 'Check the instructor spelling and school in Professors, or review a profile link there.' };
  if (result.status === 'unavailable') return unavailable;
  if (result.status === 'link-only') {
    try { return { ...base, label: 'Unverified profile', explanation: 'Only the link format was checked. Verify instructor, UHD school and department on the profile. No ratings loaded.', href: parseProfileLink(result.profileUrl).profileUrl }; }
    catch { return unavailable; }
  }
  if (identity !== 'confirmed') return { ...base, label: 'Identity unverified', explanation: 'Confirm the instructor, school and department before using this rating. No source was selected for navigation.' };
  const s = result.snapshot;
  let href: string;
  try { const parsed = parseProfileLink(s.sourceUrl); if (parsed.professorId !== s.professorId) return unavailable; href = parsed.profileUrl; } catch { return unavailable; }
  if (s.provider !== 'rmp' || !s.schoolId.trim() || !['verified-source', 'synthetic-fixture'].includes(s.provenance)
    || (s.overall !== null && (!Number.isFinite(s.overall) || s.overall < 1 || s.overall > 5))
    || (s.reviewCount !== null && (!Number.isSafeInteger(s.reviewCount) || s.reviewCount < 0))
    || (s.reviewCount === 0 && s.overall !== null)
    || !Number.isSafeInteger(s.fetchedAt) || s.fetchedAt < 0 || s.fetchedAt > now
    || !Number.isSafeInteger(s.expiresAt) || s.expiresAt <= s.fetchedAt || s.expiresAt > 8.64e15 || !Number.isFinite(now)) return unavailable;
  const stale = result.status === 'stale' || s.expiresAt <= now;
  const score = s.overall === null ? 'Not rated' : s.overall + ' / 5';
  return { ...base, label: (stale ? 'Stale: ' : '') + score, explanation: stale ? 'Cached result has expired. Refresh through the provider before treating it as current.' : s.overall === null ? 'No overall rating is available. This is not a score of zero.' : 'Review the source, count and checked time before comparing instructors.', href, snapshot: s };
}
