import type { ContractError, EnrollmentJobView } from './domain';
import { parseEnrollmentJobView, parseStoredEnrollmentJob } from './enrollment-records';
import { errorCodes } from './foundation-rpc';
import type { RequestFor, ResponseFor } from './messages';
import { id, invalid, record, text, version } from './validation';

export type EnrollmentJobMethod = 'enrollment.activate' | 'enrollment.cancel' | 'enrollment.read';
export type EnrollmentJobRequest = { [K in EnrollmentJobMethod]: RequestFor<K> }[EnrollmentJobMethod];
export type EnrollmentJobResponse = { [K in EnrollmentJobMethod]: ResponseFor<K> }[EnrollmentJobMethod];

/** Only validated persisted records may be projected. No authority or raw portal text leaves here. */
export function projectEnrollmentJob(value: unknown): EnrollmentJobView {
  const job = parseStoredEnrollmentJob(value);
  return parseEnrollmentJobView({
    id: job.id, revision: job.revision, state: job.state, termId: job.termId, termLabel: job.termLabel,
    selectedSectionIds: job.selectedSectionIds, timing: job.timing, targetEpochMs: job.targetEpochMs,
    expiresAt: job.expiresAt, createdAt: job.createdAt, updatedAt: job.updatedAt, submittedAt: job.submittedAt,
    outcomes: job.outcomes.map(outcome => ({ sectionId: outcome.sectionId, status: outcome.status,
      ...(outcome.reason === undefined ? {} : { reason: outcome.reason }) })),
  });
}

function plainText(value: unknown, max: number, field: string): string {
  const result = text(value, max, field);
  // oxlint-disable-next-line no-control-regex -- Reject markup, controls and lone surrogates.
  if (/[<>\u0000-\u001f\u007f\ud800-\udfff]/u.test(result)) invalid(field);
  return result;
}

/** Future client boundary for an already validated outstanding request; does not enable RPC. */
export function parseEnrollmentJobResponse(value: unknown, request: EnrollmentJobRequest): EnrollmentJobResponse {
  const row = record(value, ['protocolVersion', 'requestId', 'type', 'ok', 'data', 'error'], 'response');
  const protocolVersion = version(row.protocolVersion, 'response.protocolVersion');
  if (!['enrollment.activate', 'enrollment.cancel', 'enrollment.read'].includes(request.type)
      || row.requestId !== request.requestId || row.type !== request.type) invalid('response.identity');
  const base = { protocolVersion, requestId: id(row.requestId, 'response.requestId'), type: request.type };
  if (row.ok === false) {
    if (Object.hasOwn(row, 'data')) invalid('response.data');
    const error = record(row.error, ['code', 'message', 'field'], 'response.error');
    const code = errorCodes.find(code => code === error.code);
    if (!code) invalid('response.error.code');
    const detail: ContractError = { code, message: plainText(error.message, 300, 'response.error.message') };
    if (Object.hasOwn(error, 'field')) detail.field = plainText(error.field, 100, 'response.error.field');
    return { ...base, ok: false, error: detail };
  }
  if (row.ok !== true || Object.hasOwn(row, 'error')) invalid('response.ok');
  const data = parseEnrollmentJobView(row.data);
  if (request.type !== 'enrollment.activate' && data.id !== request.payload.jobId) invalid('response.data.id');
  return { ...base, ok: true, data };
}
