import type { EnrollmentJob } from './domain';
import type { DashboardRpc } from './messages';
import { parseEnrollmentTimingValue } from './enrollment-timing';
import { id, record } from './validation';

export type ActivationPayload = DashboardRpc['enrollment.activate']['input'];

/** Stable field order and detached values; historical replay is not a new timing proposal. */
export function parseActivationPayload(value: unknown): ActivationPayload {
  const row = record(value, ['reviewId', 'expectedFingerprint', 'timing'], 'activation');
  return { reviewId: id(row.reviewId, 'activation.reviewId'),
    expectedFingerprint: id(row.expectedFingerprint, 'activation.expectedFingerprint'),
    timing: parseEnrollmentTimingValue(row.timing) };
}
export function payloadForJob(job: EnrollmentJob): ActivationPayload {
  return parseActivationPayload({ reviewId: job.review.id, expectedFingerprint: job.review.fingerprint, timing: job.timing });
}
/** Both arguments must have been normalized through parseActivationPayload. */
export function sameActivationPayload(first: ActivationPayload, second: ActivationPayload): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}
