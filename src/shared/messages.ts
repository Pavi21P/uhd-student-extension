import type {
  ContractError, DisplaySettings, EnrollmentJobView, EnrollmentReview, EnrollmentTiming,
  PortalObservation, ProfessorAssociation, ProfessorResult, Schedule, SectionOutcome, TimetableBackup,
} from './domain';

/** Request/response pairs. The bridge takes unknown input until runtime validation passes. */
export interface DashboardRpc {
  'schedule.read': { input: { scheduleId: string }; output: Schedule };
  'schedule.save': {
    input: { expectedRevision: number | null; schedule: Schedule };
    output: Schedule;
  };
  'schedule.import': {
    input: { targetScheduleId: string; expectedRevision: number; mode: 'merge' | 'replace'; backup: TimetableBackup };
    output: Schedule;
  };
  'settings.read': { input: Record<string, never>; output: DisplaySettings };
  'settings.save': { input: { expectedRevision: number; settings: DisplaySettings }; output: DisplaySettings };
  'professor.lookup': { input: { instructorName: string; department?: string }; output: ProfessorResult };
  'professor.associate': { input: { instructorName: string; department?: string; profileUrl: string }; output: ProfessorAssociation };
  'enrollment.review': {
    input: { tabId: number; termId: string; selectedSectionIds: string[]; deselectSectionIds: string[] };
    output: EnrollmentReview;
  };
  'enrollment.activate': {
    input: { reviewId: string; expectedFingerprint: string; timing: EnrollmentTiming };
    output: EnrollmentJobView;
  };
  'enrollment.cancel': { input: { jobId: string; expectedRevision: number }; output: EnrollmentJobView };
  'enrollment.read': { input: { jobId: string }; output: EnrollmentJobView };
}
export type RequestFor<T extends keyof DashboardRpc> = {
  protocolVersion: 1;
  requestId: string;
  type: T;
  payload: DashboardRpc[T]['input'];
};
export type DashboardRequest = { [T in keyof DashboardRpc]: RequestFor<T> }[keyof DashboardRpc];
export type ResponseFor<T extends keyof DashboardRpc> = {
  protocolVersion: 1;
  requestId: string;
  type: T;
} & ({ ok: true; data: DashboardRpc[T]['output'] } | { ok: false; error: ContractError });
export type DashboardResponse = { [T in keyof DashboardRpc]: ResponseFor<T> }[keyof DashboardRpc];

/** Private bridge, targeted to one browser-verified tab/frame/document. */
export type PortalCommand = {
  protocolVersion: 1;
  requestId: string;
} & (
  | { type: 'portal.inspect'; payload: Record<string, never> }
  | { type: 'portal.execute'; payload: {
      jobId: string;
      executionToken: string;
      reviewFingerprint: string;
      termId: string;
      selectedSectionIds: string[];
      deselectSectionIds: string[];
      targetEpochMs: number;
      expiresAt: number;
    } }
  | { type: 'portal.cancel'; payload: { jobId: string; executionToken: string } }
);
export type PortalReply = {
  protocolVersion: 1;
  requestId: string;
} & (
  | { type: 'portal.inspected'; payload: PortalObservation }
  | { type: 'portal.completed'; payload: {
      jobId: string;
      executionToken: string;
      submittedAt: number | null;
      outcomes: SectionOutcome[];
    } }
  | { type: 'portal.cancelled'; payload: { jobId: string; executionToken: string } }
  | { type: 'portal.error'; payload: { error: ContractError; jobId?: string } }
);
/** Emitted after persisted changes. Consumers ignore older revisions and refetch on gaps. */
export type StateEvent = { protocolVersion: 1 } & (
  | { type: 'schedule.changed'; payload: { scheduleId: string; revision: number } }
  | { type: 'settings.changed'; payload: { revision: number } }
  | { type: 'enrollment.changed'; payload: EnrollmentJobView }
);
