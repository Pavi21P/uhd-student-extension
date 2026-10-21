/** Invented examples only. Not provider data, live portal fixtures, or production defaults. */
import type { EnrollmentReview, Schedule, TimetableBackup } from '../../src/shared/domain';
import type { RequestFor, ResponseFor } from '../../src/shared/messages';

export const blankSchedule = {
  schemaVersion: 1, id: 'sample-schedule', revision: 0,
  label: 'Example term', termLabel: '', timezone: 'America/Chicago',
  courses: [{ id: 'sample-blank-course' }], meetings: [],
} satisfies Schedule;

export const recurringSchedule = {
  ...blankSchedule, revision: 1,
  courses: [
    { id: 'sample-blank-course' },
    { id: 'sample-course', title: 'Sample course', professorName: 'Sample instructor', room: 'Sample room' },
  ],
  meetings: [
    { id: 'sample-mon', courseId: 'sample-course', dayOfWeek: 1, startMinute: 600, endMinute: 675 },
    { id: 'sample-wed', courseId: 'sample-course', dayOfWeek: 3, startMinute: 600, endMinute: 675 },
    { id: 'sample-lab', courseId: 'sample-course', dayOfWeek: 5, startMinute: 840, endMinute: 900 },
  ],
} satisfies Schedule;

export const timetableBackup = {
  kind: 'uhd-extension/timetable', schemaVersion: 1,
  exportedAt: 1_800_000_000_000, schedule: recurringSchedule,
} satisfies TimetableBackup;

export const sampleReview = {
  id: 'sample-review',
  target: { tabId: 7, frameId: 0, documentId: 'sample-document', origin: 'https://portal.example.invalid', adapterVersion: 'fixture-only' },
  termId: 'sample-term', termLabel: 'Example term',
  sections: [
    { sectionId: 'sample-section-a', courseCode: 'EXAMPLE 1000', sectionLabel: 'A', title: 'Sample course', checked: false, selectable: true },
    { sectionId: 'sample-section-b', courseCode: 'EXAMPLE 2000', sectionLabel: 'B', title: 'Another sample course', checked: true, selectable: true },
  ],
  selectedSectionIds: ['sample-section-a'], deselectSectionIds: ['sample-section-b'],
  fingerprint: 'fixture-only-not-a-real-digest',
  observedAt: 1_800_000_000_000, expiresAt: 1_800_000_120_000,
} satisfies EnrollmentReview;

export const activateNow = {
  protocolVersion: 1, requestId: 'sample-request-activate', type: 'enrollment.activate',
  payload: { reviewId: sampleReview.id, expectedFingerprint: sampleReview.fingerprint, timing: { mode: 'now' } },
} satisfies RequestFor<'enrollment.activate'>;

export const conflictResponse = {
  protocolVersion: 1, requestId: 'sample-request-save', type: 'schedule.save', ok: false,
  error: { code: 'REVISION_CONFLICT', message: 'This timetable changed in another view. Reload it before saving.' },
} satisfies ResponseFor<'schedule.save'>;

/** Negative fixtures for the runtime validators in 03B. Unknown is intentional. */
export const invalidExamples: { name: string; value: unknown; expectedError: string }[] = [
  { name: 'duplicate course IDs', value: { ...blankSchedule, courses: [{ id: 'same' }, { id: 'same' }] }, expectedError: 'INVALID_INPUT' },
  { name: 'orphan meeting', value: { ...blankSchedule, meetings: [{ id: 'orphan', courseId: 'missing', dayOfWeek: 1, startMinute: 600, endMinute: 660 }] }, expectedError: 'INVALID_INPUT' },
  { name: 'zero duration', value: { ...recurringSchedule, meetings: [{ ...recurringSchedule.meetings[0], endMinute: 600 }] }, expectedError: 'INVALID_INPUT' },
  { name: 'future schema', value: { ...blankSchedule, schemaVersion: 2 }, expectedError: 'UNSUPPORTED_VERSION' },
  { name: 'arbitrary script request', value: { protocolVersion: 1, requestId: 'bad', type: 'portal.eval', payload: { code: 'not executable' } }, expectedError: 'INVALID_INPUT' },
];
