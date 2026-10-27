import { describe, expect, it, vi } from 'vitest';
import type { EnrollmentJob, EnrollmentReview, JobState, SectionOutcome } from '../../src/shared/domain';
import { parseStoredEnrollmentJob, parseStoredEnrollmentReview } from '../../src/shared/enrollment-records';
import { ContractFault } from '../../src/shared/validation';
import { sampleReview } from '../fixtures/contracts.examples';

const createdAt = Date.UTC(2025, 0, 1, 0, 0, 0);
function review(): EnrollmentReview {
  return { ...structuredClone(sampleReview), observedAt: createdAt - 1_000, expiresAt: createdAt + 119_000 };
}
function job(): EnrollmentJob {
  return {
    id: 'synthetic-job', revision: 0, state: 'armed', termId: 'sample-term', termLabel: 'Example term',
    selectedSectionIds: ['sample-section-a'], timing: { mode: 'now' }, targetEpochMs: createdAt,
    expiresAt: createdAt + 2_000, createdAt, updatedAt: createdAt, submittedAt: null,
    outcomes: [], executionToken: 'synthetic-token-only', review: review(),
  };
}
function scheduled(): EnrollmentJob {
  return { ...job(), timing: { mode: 'scheduled', targetEpochMs: createdAt + 60_000,
    timezone: 'UTC', localDateTime: '2025-01-01T00:01:00', utcOffsetMinutes: 0 },
  targetEpochMs: createdAt + 60_000, expiresAt: createdAt + 62_000 };
}
function settled(state: JobState, statuses: SectionOutcome['status'][]): EnrollmentJob {
  const value = job();
  value.state = state;
  value.submittedAt = createdAt + 100;
  value.updatedAt = createdAt + 5_000;
  value.review.selectedSectionIds = value.review.sections.slice(0, statuses.length).map(item => item.sectionId);
  value.review.deselectSectionIds = statuses.length === 2 ? [] : ['sample-section-b'];
  value.selectedSectionIds = [...value.review.selectedSectionIds];
  value.outcomes = statuses.map((status, index) => ({ sectionId: value.selectedSectionIds[index]!, status }));
  return value;
}
function invalid(operation: () => unknown) {
  expect(operation).toThrow(ContractFault);
}

describe('stored enrollment review validation', () => {
  it('accepts the synthetic contract example and historical records without a live clock check', () => {
    expect(parseStoredEnrollmentReview(sampleReview)).toEqual(sampleReview);
    const now = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('No live clock permitted'); });
    try { expect(parseStoredEnrollmentReview(review())).toEqual(review()); } finally { now.mockRestore(); }
  });
  it('preserves opaque case-sensitive identifiers, blank display fields and detached nested data', () => {
    const value = review();
    value.sections[0]!.sectionId = ' a:A ';
    value.sections[0]!.title = '';
    value.sections[0]!.instructor = '';
    value.sections[0]!.meetingLabel = 'Synthetic Monday';
    value.selectedSectionIds = [' a:A '];
    const before = structuredClone(value);
    const parsed = parseStoredEnrollmentReview(value);
    expect(parsed).toEqual(before);
    parsed.target.documentId = 'changed';
    parsed.sections[0]!.title = 'Changed';
    parsed.selectedSectionIds.push('changed');
    parsed.deselectSectionIds.pop();
    expect(value).toEqual(before);
  });
  it('permits an already checked selected section and unselectable unchecked unrelated section', () => {
    const value = review();
    value.sections[0]!.checked = true;
    value.sections.push({ ...value.sections[0]!, sectionId: 'unrelated', checked: false, selectable: false });
    expect(parseStoredEnrollmentReview(value)).toEqual(value);
  });
  it.each([
    ['empty selection', (v: EnrollmentReview) => { v.selectedSectionIds = []; }],
    ['duplicate selection', (v: EnrollmentReview) => { v.selectedSectionIds.push(v.selectedSectionIds[0]!); }],
    ['missing selected section', (v: EnrollmentReview) => { v.selectedSectionIds = ['absent']; }],
    ['case mismatch', (v: EnrollmentReview) => { v.selectedSectionIds = ['SAMPLE-SECTION-A']; }],
    ['unselectable selected section', (v: EnrollmentReview) => { v.sections[0]!.selectable = false; }],
    ['duplicate section', (v: EnrollmentReview) => { v.sections.push({ ...v.sections[0]! }); }],
    ['missing deselection', (v: EnrollmentReview) => { v.deselectSectionIds = []; }],
    ['extra deselection', (v: EnrollmentReview) => { v.deselectSectionIds.push('absent'); }],
    ['duplicate deselection', (v: EnrollmentReview) => { v.deselectSectionIds.push(v.deselectSectionIds[0]!); }],
    ['selected also deselected', (v: EnrollmentReview) => { v.deselectSectionIds.push(v.selectedSectionIds[0]!); }],
    ['unchecked deselection', (v: EnrollmentReview) => { v.sections[1]!.checked = false; }],
    ['locked checked outside selection', (v: EnrollmentReview) => { v.sections[1]!.selectable = false; }],
    ['empty term', (v: EnrollmentReview) => { v.termId = ' '; }],
    ['empty fingerprint', (v: EnrollmentReview) => { v.fingerprint = ''; }],
    ['reversed timestamps', (v: EnrollmentReview) => { v.expiresAt = v.observedAt; }],
  ] as const)('rejects %s', (_label, mutate) => {
    const value = review(); mutate(value);
    invalid(() => parseStoredEnrollmentReview(value));
  });
  it.each([
    'http://portal.example.invalid', 'https://portal.example.invalid/', 'https://portal.example.invalid/path',
    'https://portal.example.invalid?token=synthetic', 'https://portal.example.invalid#fragment',
    'https://user:synthetic@portal.example.invalid', 'null', 'javascript:void(0)', 'not a URL',
  ])('rejects non-origin target %s', origin => {
    const value = review(); value.target.origin = origin;
    invalid(() => parseStoredEnrollmentReview(value));
  });
  it('validates origin syntax without claiming a supported host or adapter', () => {
    const value = review();
    value.target.origin = 'https://different.example.invalid:8443';
    value.target.adapterVersion = 'unknown-synthetic-adapter';
    expect(parseStoredEnrollmentReview(value)).toEqual(value);
  });
  it.each([
    { tabId: -1 }, { frameId: 1.5 }, { documentId: '' }, { adapterVersion: '' }, { tabId: '7' },
    { cookie: 'synthetic-only' },
  ])('rejects malformed target metadata %#', patch => {
    const value = review();
    invalid(() => parseStoredEnrollmentReview({ ...value, target: { ...value.target, ...patch } }));
  });
  it.each([
    { checked: 'true' }, { selectable: 1 }, { instructor: undefined }, { title: undefined },
    { courseCode: 'x'.repeat(41) }, { title: 'x'.repeat(201) }, { instructor: 'x'.repeat(201) },
    { sectionLabel: 'x'.repeat(121) }, { meetingLabel: 'x'.repeat(241) }, { rawHtml: 'synthetic' },
  ])('rejects invalid section fields %#', patch => {
    const value = review();
    invalid(() => parseStoredEnrollmentReview({ ...value, sections: [{ ...value.sections[0], ...patch }, value.sections[1]] }));
  });
  it('bounds review lists at 250 sections and selected IDs', () => {
    const value = review();
    value.sections = Array.from({ length: 250 }, (_, index) => ({ ...value.sections[0]!, sectionId: 'synthetic-' + index }));
    value.selectedSectionIds = value.sections.map(item => item.sectionId);
    value.deselectSectionIds = [];
    expect(parseStoredEnrollmentReview(value).sections).toHaveLength(250);
    value.sections.push({ ...value.sections[0]!, sectionId: 'synthetic-over-limit' });
    invalid(() => parseStoredEnrollmentReview(value));
  });
  it('rejects getters, custom properties, symbols, sparse arrays and inherited objects without executing getters', () => {
    const getter = vi.fn(() => 'sample-section-a');
    const accessor = Object.defineProperty(['sample-section-a'], '0', { get: getter, enumerable: true });
    const hidden = Object.defineProperty(['sample-section-a'], 'hidden', { value: true });
    const symbol = Object.assign(['sample-section-a'], { [Symbol('extra')]: true });
    const sparse: string[] = []; sparse.length = 1;
    for (const selectedSectionIds of [accessor, hidden, symbol, sparse]) {
      invalid(() => parseStoredEnrollmentReview({ ...review(), selectedSectionIds }));
    }
    const target = Object.defineProperty({ ...review().target }, 'documentId', { enumerable: true, get: getter });
    invalid(() => parseStoredEnrollmentReview({ ...review(), target }));
    invalid(() => parseStoredEnrollmentReview(Object.create(review())));
    invalid(() => parseStoredEnrollmentReview({ ...review(), extra: true }));
    expect(getter).not.toHaveBeenCalled();
  });
});

describe('stored enrollment job validation', () => {
  it('accepts an old armed job without rearming, expiring, or checking the current date', () => {
    const now = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('No live clock permitted'); });
    try {
      expect(parseStoredEnrollmentJob(job())).toEqual(job());
      expect(parseStoredEnrollmentJob(scheduled())).toEqual(scheduled());
    } finally { now.mockRestore(); }
  });
  it('allows a target beyond review expiry when activation happened during the review lifetime', () => {
    const value = scheduled();
    value.review.expiresAt = createdAt + 1;
    expect(parseStoredEnrollmentJob(value)).toEqual(value);
  });
  it('accepts matching result sets in any order and detaches all returned records', () => {
    const value = settled('partial', ['enrolled', 'waitlisted']);
    value.outcomes.reverse();
    value.selectedSectionIds.reverse();
    const before = structuredClone(value);
    const parsed = parseStoredEnrollmentJob(value);
    expect(parsed).toEqual(before);
    parsed.outcomes[0]!.status = 'unknown';
    parsed.review.sections[0]!.title = 'changed';
    parsed.review.target.documentId = 'changed';
    parsed.selectedSectionIds.pop();
    expect(value).toEqual(before);
    const schedule = scheduled();
    const parsedSchedule = parseStoredEnrollmentJob(schedule);
    if (parsedSchedule.timing.mode === 'scheduled') parsedSchedule.timing.localDateTime = 'changed';
    expect(schedule).toEqual(scheduled());
  });
  it.each(['armed', 'preflight', 'executing', 'failed', 'unknown', 'cancelled', 'expired', 'needs-review'] as const)(
    'accepts %s without recorded dispatch or outcomes', state => {
      const value = { ...job(), state };
      expect(parseStoredEnrollmentJob(value)).toEqual(value);
    },
  );
  it.each([
    ['succeeded', ['enrolled']], ['partial', ['waitlisted']], ['partial', ['enrolled', 'rejected']],
    ['failed', ['rejected']], ['unknown', ['enrolled', 'unknown']], ['unknown', ['enrolled']],
    ['executing', ['unknown']],
  ] satisfies [JobState, SectionOutcome['status'][]][])('accepts consistent %s results %#', (state, statuses) => {
    const value = settled(state, statuses);
    expect(parseStoredEnrollmentJob(value)).toEqual(value);
  });
  it.each([
    ['succeeded', ['waitlisted']], ['succeeded', ['enrolled', 'unknown']], ['partial', ['enrolled']],
    ['partial', ['rejected']], ['partial', ['waitlisted', 'unknown']], ['failed', ['waitlisted']],
  ] satisfies [JobState, SectionOutcome['status'][]][])('rejects false %s claims %#', (state, statuses) => {
    invalid(() => parseStoredEnrollmentJob(settled(state, statuses)));
  });
  it.each([
    ['created before observation', { createdAt: createdAt - 1_001 }],
    ['created at review expiry', { createdAt: createdAt + 119_000, targetEpochMs: createdAt + 119_000, updatedAt: createdAt + 119_000, expiresAt: createdAt + 121_000 }],
    ['updated before creation', { updatedAt: createdAt - 1 }],
    ['immediate target mismatch', { targetEpochMs: createdAt + 1 }],
    ['term mismatch', { termId: 'different-term' }],
    ['term label mismatch', { termLabel: 'Different term' }],
    ['selection mismatch', { selectedSectionIds: ['sample-section-b'] }],
    ['missing token', { executionToken: undefined }],
    ['empty token', { executionToken: '' }],
    ['extra field', { authority: true }],
    ['outcome before dispatch', { outcomes: [{ sectionId: 'sample-section-a', status: 'enrolled' }] }],
  ] as const)('rejects %s', (_label, patch) => {
    invalid(() => parseStoredEnrollmentJob({ ...job(), ...patch }));
  });
  it('checks review freshness independently of job target bounds', () => {
    const value = job();
    value.review.observedAt = createdAt + 1;
    invalid(() => parseStoredEnrollmentJob(value));
    value.review.observedAt = createdAt - 100;
    value.review.expiresAt = createdAt;
    invalid(() => parseStoredEnrollmentJob(value));
    value.review.expiresAt = createdAt + 1;
    expect(parseStoredEnrollmentJob(value)).toEqual(value);
  });
  it('validates scheduled timing relative to creation and checks the duplicate target', () => {
    const value = scheduled();
    invalid(() => parseStoredEnrollmentJob({ ...value, targetEpochMs: value.targetEpochMs + 1 }));
    if (value.timing.mode !== 'scheduled') throw new Error('Fixture');
    invalid(() => parseStoredEnrollmentJob({ ...value, timing: { ...value.timing, utcOffsetMinutes: 60 } }));
    invalid(() => parseStoredEnrollmentJob({ ...value, timing: { ...value.timing, localDateTime: '2025-02-30T00:01:00' } }));
    invalid(() => parseStoredEnrollmentJob({ ...value, timing: { ...value.timing, targetEpochMs: createdAt, localDateTime: '2025-01-01T00:00:00' }, targetEpochMs: createdAt }));
  });
  it('preserves early or late dispatch evidence only as unknown', () => {
    for (const submittedAt of [createdAt - 100, createdAt + 2_000]) {
      const value = { ...job(), state: 'unknown' as const, submittedAt, updatedAt: createdAt + 5_000 };
      expect(parseStoredEnrollmentJob(value)).toEqual(value);
      invalid(() => parseStoredEnrollmentJob({ ...value, state: 'executing' }));
    }
  });
  it('allows no recorded outcomes during execution/unknown but requires them for a claimed final result', () => {
    for (const state of ['executing', 'unknown'] as const) {
      const value = { ...job(), state, submittedAt: createdAt + 100, updatedAt: createdAt + 100 };
      expect(parseStoredEnrollmentJob(value)).toEqual(value);
      for (const final of ['succeeded', 'partial', 'failed']) {
        invalid(() => parseStoredEnrollmentJob({ ...value, state: final }));
      }
    }
  });
  it.each([
    [{ sectionId: 'absent', status: 'enrolled' }],
    [{ sectionId: 'sample-section-a', status: 'enrolled' }, { sectionId: 'sample-section-a', status: 'enrolled' }],
    [{ sectionId: 'sample-section-a', status: 'available' }],
    [{ sectionId: 'sample-section-a', status: 'enrolled', reason: 'unexpected' }],
    [{ sectionId: 'sample-section-a', status: 'enrolled', message: '<b>raw</b>' }],
    [{ sectionId: 'sample-section-a', status: 'enrolled', message: 'line\nbreak' }],
    [{ sectionId: 'sample-section-a', status: 'enrolled', message: 'x'.repeat(301) }],
    [{ sectionId: 'sample-section-a', status: 'enrolled', rawHtml: 'synthetic' }],
  ].map(outcomes => ({ outcomes })))('rejects malformed result records %#', ({ outcomes }) => {
    invalid(() => parseStoredEnrollmentJob({ ...settled('unknown', ['unknown']), outcomes }));
  });
  it('rejects missing results within a nonempty result set instead of inventing them', () => {
    const value = settled('unknown', ['enrolled', 'unknown']);
    value.outcomes.pop();
    invalid(() => parseStoredEnrollmentJob(value));
  });
  it('preserves bounded plain result text and recognized reasons', () => {
    const value = settled('failed', ['rejected']);
    value.outcomes[0]!.reason = 'full';
    value.outcomes[0]!.message = 'Synthetic section is full.';
    expect(parseStoredEnrollmentJob(value)).toEqual(value);
  });
  it('does not invoke nested job accessors or accept incomplete job shapes', () => {
    const getter = vi.fn(() => 'synthetic-token-only');
    const value = Object.defineProperty(job(), 'executionToken', { enumerable: true, get: getter });
    invalid(() => parseStoredEnrollmentJob(value));
    invalid(() => parseStoredEnrollmentJob(null));
    invalid(() => parseStoredEnrollmentJob({}));
    expect(getter).not.toHaveBeenCalled();
  });
});
