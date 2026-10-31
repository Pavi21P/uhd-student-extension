import type { EnrollmentJob, SectionOutcome } from './domain';
import { classifyOutcomeState, parseStoredEnrollmentJob } from './enrollment-records';

/**
 * Internal finalization after verified reply acceptance or guarded saved-evidence recovery.
 * Preserves the caller's accepted revision/time. Does not authenticate or authorize dispatch.
 */
export function finalizeExecutorResult(value: unknown): EnrollmentJob {
  const job = parseStoredEnrollmentJob(value);
  if (job.state !== 'executing' && job.state !== 'unknown') return job;
  if (job.submittedAt === null) return parseStoredEnrollmentJob({ ...job, state: 'unknown' });
  const byId = new Map(job.outcomes.map(outcome => [outcome.sectionId, outcome]));
  const outcomes: SectionOutcome[] = job.selectedSectionIds.map(sectionId => {
    const outcome = byId.get(sectionId);
    return outcome ? { sectionId, status: outcome.status,
      ...(outcome.reason === undefined ? {} : { reason: outcome.reason }) }
      : { sectionId, status: 'unknown', reason: 'unconfirmed' };
  });
  // Unknown includes early/late dispatch and backwards clocks; never promote those cases.
  const state = job.state === 'unknown' ? 'unknown' : classifyOutcomeState(outcomes);
  return parseStoredEnrollmentJob({ ...job, state, outcomes });
}
