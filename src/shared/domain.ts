/** Contract v1. Types describe validated data; they do not validate untrusted input. */
export type Id = string;
export type EpochMs = number;
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // Monday = 1, Sunday = 7.

export interface CourseCard {
  id: Id;
  title?: string;
  courseCode?: string;
  professorName?: string;
  room?: string;
  color?: string; // Six-digit hex; identity only, never eligibility/status.
}
export interface Meeting {
  id: Id;
  courseId: Id;
  dayOfWeek: DayOfWeek;
  startMinute: number; // Integer 0..1439, wall-clock minutes in Schedule.timezone.
  endMinute: number; // Integer 1..1440; strictly greater than startMinute.
}
export interface Schedule {
  schemaVersion: 1;
  id: Id;
  revision: number; // Background-owned, nonnegative integer.
  label: string;
  termLabel: string; // Personal label, not an authoritative portal term ID.
  timezone: string; // Valid IANA zone, initially America/Chicago.
  courses: CourseCard[];
  meetings: Meeting[];
}
export interface TimetableBackup {
  kind: 'uhd-extension/timetable';
  schemaVersion: 1;
  exportedAt: EpochMs;
  schedule: Schedule;
}
export interface DisplaySettings {
  schemaVersion: 1;
  revision: number;
  visibleDays: DayOfWeek[];
  startMinute: number;
  endMinute: number;
  enrollmentTimezone: string;
}

export interface ProfessorAssociation {
  id: Id;
  schoolId: string; // Provider-verified UHD school ID; never guessed.
  instructorKey: string; // Normalized matching key; never replaces display name.
  instructorName: string;
  department?: string;
  professorId: string;
  profileUrl: string;
  matchingMethod: 'user-confirmed' | 'provider-exact';
  updatedAt: EpochMs;
}
export interface RatingSnapshot {
  provider: 'rmp';
  schoolId: string;
  professorId: string;
  overall: number | null; // 1..5 when present; null is not zero.
  reviewCount: number | null;
  sourceUrl: string;
  fetchedAt: EpochMs;
  expiresAt: EpochMs;
  provenance: 'verified-source' | 'synthetic-fixture';
}
export type ProfessorResult =
  | { status: 'available'; snapshot: RatingSnapshot }
  | { status: 'stale'; snapshot: RatingSnapshot }
  | { status: 'ambiguous'; candidates: ProfessorAssociation[] }
  | { status: 'no-match' }
  | { status: 'unavailable'; reason: 'provider-unconfigured' | 'network' | 'access' };

/** Populated from trusted browser metadata and a supported portal adapter. */
export interface PortalTarget {
  tabId: number;
  frameId: number;
  documentId: string;
  origin: string;
  adapterVersion: string;
}
export interface PortalSection {
  sectionId: string;
  courseCode: string;
  sectionLabel: string;
  title: string;
  instructor?: string;
  meetingLabel?: string;
  checked: boolean;
  selectable: boolean;
}
export interface PortalObservation {
  termId: string;
  termLabel: string;
  sections: PortalSection[];
  observedAt: EpochMs;
}
/** Background-issued review, not a dashboard-authored permission or live eligibility claim. */
export interface EnrollmentReview {
  id: Id;
  target: PortalTarget;
  termId: string;
  termLabel: string;
  sections: PortalSection[];
  selectedSectionIds: string[];
  deselectSectionIds: string[];
  fingerprint: string;
  observedAt: EpochMs;
  expiresAt: EpochMs;
}
export type EnrollmentTiming =
  | { mode: 'now' }
  | { mode: 'scheduled'; targetEpochMs: EpochMs; timezone: string; localDateTime: string; utcOffsetMinutes: number };
export interface SectionOutcome {
  sectionId: string;
  status: 'enrolled' | 'waitlisted' | 'rejected' | 'unknown';
  reason?: 'full' | 'ineligible' | 'portal-error' | 'unconfirmed';
  message?: string; // Sanitized portal text, no raw HTML or session information.
}
export type JobState = 'armed' | 'preflight' | 'executing' | 'succeeded' | 'partial'
  | 'failed' | 'unknown' | 'cancelled' | 'expired' | 'needs-review';
/** Safe projection for the dashboard: excludes execution token and document identifiers. */
export interface EnrollmentJobView {
  id: Id;
  revision: number;
  state: JobState;
  termId: string;
  termLabel: string;
  selectedSectionIds: string[];
  timing: EnrollmentTiming;
  targetEpochMs: EpochMs;
  expiresAt: EpochMs;
  createdAt: EpochMs;
  updatedAt: EpochMs;
  submittedAt: EpochMs | null;
  outcomes: SectionOutcome[];
}
/** Background storage only; never included in a timetable export or public job projection. */
export interface EnrollmentJob extends EnrollmentJobView {
  executionToken: string;
  review: EnrollmentReview;
}
export type ContractErrorCode = 'INVALID_INPUT' | 'UNSUPPORTED_VERSION' | 'REVISION_CONFLICT'
  | 'UNAUTHORIZED_SENDER' | 'PORTAL_UNSUPPORTED' | 'STALE_REVIEW' | 'SELECTION_CHANGED'
  | 'INVALID_TIME' | 'JOB_ALREADY_ACTIVE' | 'TOO_LATE_TO_CANCEL' | 'STORAGE_ERROR'
  | 'PROVIDER_UNAVAILABLE' | 'NOT_FOUND' | 'REQUEST_ID_REUSED';
export interface ContractError {
  code: ContractErrorCode;
  message: string;
  field?: string;
}
