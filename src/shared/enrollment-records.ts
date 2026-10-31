import type { EnrollmentJob, EnrollmentReview, PortalSection, PortalTarget, SectionOutcome } from './domain';
import { parseEnrollmentLifecycle } from './enrollment-lifecycle';
import { parseEnrollmentTiming } from './enrollment-timing';
import { id, integer, invalid, list, record, text } from './validation';

const maxEpoch = 8_640_000_000_000_000;
const maxSections = 250;
const epoch = (value: unknown, field: string) => integer(value, -maxEpoch, maxEpoch, field);

function ids(value: unknown, field: string, nonempty = false): string[] {
  const values = list(value, maxSections, field).map(item => id(item, field));
  if ((nonempty && !values.length) || new Set(values).size !== values.length) invalid(field);
  return values;
}
function sameSet(first: readonly string[], second: readonly string[]): boolean {
  const expected = new Set(second);
  return first.length === second.length && first.every(value => expected.has(value));
}
function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') return invalid(field);
  return value;
}
export function parsePortalTarget(value: unknown): PortalTarget {
  const row = record(value, ['tabId', 'frameId', 'documentId', 'origin', 'adapterVersion'], 'review.target');
  const origin = text(row.origin, 300, 'review.target.origin');
  let url: URL;
  try { url = new URL(origin); } catch { return invalid('review.target.origin'); }
  // Structural origin only. Supported host/adapter/document identity requires live verification.
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) invalid('review.target.origin');
  return {
    tabId: integer(row.tabId, 0, Number.MAX_SAFE_INTEGER, 'review.target.tabId'),
    frameId: integer(row.frameId, 0, Number.MAX_SAFE_INTEGER, 'review.target.frameId'),
    documentId: id(row.documentId, 'review.target.documentId'), origin,
    adapterVersion: id(row.adapterVersion, 'review.target.adapterVersion'),
  };
}
function section(value: unknown): PortalSection {
  const row = record(value, ['sectionId', 'courseCode', 'sectionLabel', 'title', 'instructor', 'meetingLabel', 'checked', 'selectable'], 'review.section');
  const result: PortalSection = {
    sectionId: id(row.sectionId, 'review.section.sectionId'),
    courseCode: text(row.courseCode, 40, 'review.section.courseCode'),
    sectionLabel: text(row.sectionLabel, 120, 'review.section.sectionLabel'),
    title: text(row.title, 200, 'review.section.title'),
    checked: boolean(row.checked, 'review.section.checked'),
    selectable: boolean(row.selectable, 'review.section.selectable'),
  };
  if (Object.hasOwn(row, 'instructor')) result.instructor = text(row.instructor, 200, 'review.section.instructor');
  if (Object.hasOwn(row, 'meetingLabel')) result.meetingLabel = text(row.meetingLabel, 240, 'review.section.meetingLabel');
  return result;
}

/** Parse a historical internal record, not a dashboard-authored review or live permission. */
export function parseStoredEnrollmentReview(value: unknown): EnrollmentReview {
  const row = record(value, ['id', 'target', 'termId', 'termLabel', 'sections', 'selectedSectionIds',
    'deselectSectionIds', 'fingerprint', 'observedAt', 'expiresAt'], 'review');
  const sections = list(row.sections, maxSections, 'review.sections').map(section);
  const selectedSectionIds = ids(row.selectedSectionIds, 'review.selectedSectionIds', true);
  const deselectSectionIds = ids(row.deselectSectionIds, 'review.deselectSectionIds');
  const byId = new Map(sections.map(item => [item.sectionId, item]));
  if (byId.size !== sections.length) invalid('review.sections');
  if (selectedSectionIds.some(sectionId => !byId.get(sectionId)?.selectable)) invalid('review.selectedSectionIds');
  const selected = new Set(selectedSectionIds);
  const expectedDeselections = sections.filter(item => item.checked && !selected.has(item.sectionId));
  if (expectedDeselections.some(item => !item.selectable)
      || !sameSet(deselectSectionIds, expectedDeselections.map(item => item.sectionId))) invalid('review.deselectSectionIds');
  const observedAt = epoch(row.observedAt, 'review.observedAt');
  const expiresAt = epoch(row.expiresAt, 'review.expiresAt');
  if (expiresAt <= observedAt) invalid('review.expiresAt');
  return {
    id: id(row.id, 'review.id'), target: parsePortalTarget(row.target),
    termId: id(row.termId, 'review.termId'), termLabel: text(row.termLabel, 120, 'review.termLabel'),
    sections, selectedSectionIds, deselectSectionIds,
    // Shape only; digest creation/comparison belongs to the trusted coordinator.
    fingerprint: id(row.fingerprint, 'review.fingerprint'), observedAt, expiresAt,
  };
}
export function parseSectionOutcome(value: unknown): SectionOutcome {
  const row = record(value, ['sectionId', 'status', 'reason', 'message'], 'job.outcome');
  if (!['enrolled', 'waitlisted', 'rejected', 'unknown'].includes(row.status as string)) invalid('job.outcome.status');
  const result: SectionOutcome = { sectionId: id(row.sectionId, 'job.outcome.sectionId'), status: row.status as SectionOutcome['status'] };
  if (Object.hasOwn(row, 'reason')) {
    if (!['full', 'ineligible', 'portal-error', 'unconfirmed'].includes(row.reason as string)) invalid('job.outcome.reason');
    result.reason = row.reason as NonNullable<SectionOutcome['reason']>;
  }
  if (Object.hasOwn(row, 'message')) {
    const message = text(row.message, 300, 'job.outcome.message');
    // Storage accepts bounded plain text only; adapters must independently remove private data.
    // oxlint-disable-next-line no-control-regex -- Reject raw markup delimiters, controls and lone surrogates.
    if (/[<>\u0000-\u001f\u007f\ud800-\udfff]/u.test(message)) invalid('job.outcome.message');
    result.message = message;
  }
  return result;
}

/** Classification only; callers must validate selection coverage and dispatch provenance. */
export function classifyOutcomeState(outcomes: readonly SectionOutcome[]): 'succeeded' | 'partial' | 'failed' | 'unknown' {
  return !outcomes.length || outcomes.some(item => item.status === 'unknown') ? 'unknown'
    : outcomes.every(item => item.status === 'enrolled') ? 'succeeded'
      : outcomes.some(item => item.status === 'enrolled' || item.status === 'waitlisted') ? 'partial' : 'failed';
}

/** Validate an internal saved job without arming, expiring, persisting or executing it. */
export function parseStoredEnrollmentJob(value: unknown): EnrollmentJob {
  const row = record(value, ['id', 'revision', 'state', 'termId', 'termLabel', 'selectedSectionIds', 'timing',
    'targetEpochMs', 'expiresAt', 'createdAt', 'updatedAt', 'submittedAt', 'outcomes', 'executionToken', 'review'], 'job');
  const lifecycle = parseEnrollmentLifecycle({
    id: row.id, revision: row.revision, state: row.state, targetEpochMs: row.targetEpochMs,
    expiresAt: row.expiresAt, updatedAt: row.updatedAt, submittedAt: row.submittedAt,
  });
  const createdAt = epoch(row.createdAt, 'job.createdAt');
  if (lifecycle.updatedAt < createdAt || lifecycle.targetEpochMs < createdAt) invalid('job.createdAt');
  const timing = parseEnrollmentTiming(row.timing, createdAt);
  if (lifecycle.targetEpochMs !== (timing.mode === 'now' ? createdAt : timing.targetEpochMs)) invalid('job.targetEpochMs');
  const review = parseStoredEnrollmentReview(row.review);
  if (createdAt < review.observedAt || createdAt >= review.expiresAt) invalid('job.review');
  const selectedSectionIds = ids(row.selectedSectionIds, 'job.selectedSectionIds', true);
  const termId = id(row.termId, 'job.termId');
  const termLabel = text(row.termLabel, 120, 'job.termLabel');
  if (termId !== review.termId || termLabel !== review.termLabel
      || !sameSet(selectedSectionIds, review.selectedSectionIds)) invalid('job.review');
  const outcomes = list(row.outcomes, maxSections, 'job.outcomes').map(parseSectionOutcome);
  const resultIds = outcomes.map(item => item.sectionId);
  if (new Set(resultIds).size !== resultIds.length
      || (outcomes.length && !sameSet(resultIds, selectedSectionIds))) invalid('job.outcomes');
  const { state, submittedAt, targetEpochMs, expiresAt } = lifecycle;
  if (outcomes.length && submittedAt === null) invalid('job.outcomes');
  if (submittedAt !== null && state !== 'unknown'
      && (submittedAt < targetEpochMs || submittedAt >= expiresAt)) invalid('job.submittedAt');
  // An empty result set is allowed while executing or reconciling unknown dispatch.
  // A claimed final result must contain exactly one normalized outcome per selected section.
  if (state === 'succeeded' || state === 'partial' || (state === 'failed' && submittedAt !== null)) {
    if (!outcomes.length) invalid('job.outcomes');
    const derived = classifyOutcomeState(outcomes);
    if (state !== derived) invalid('job.state');
  }
  return { ...lifecycle, termId, termLabel, selectedSectionIds, timing, createdAt, outcomes,
    executionToken: id(row.executionToken, 'job.executionToken'), review };
}
