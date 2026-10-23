import type { ContractError } from './domain';
import type { RequestFor, ResponseFor } from './messages';
import { ContractFault, id, invalid, parseSchedule, parseSettings, record, revision, text, version } from './validation';

export type FoundationMethod = 'schedule.read' | 'schedule.save' | 'settings.read' | 'settings.save';
export type FoundationRequest = { [K in FoundationMethod]: RequestFor<K> }[FoundationMethod];
export type FoundationResponse = { [K in FoundationMethod]: ResponseFor<K> }[FoundationMethod];
/** A malformed envelope may not have usable correlation fields. Never invent them. */
export interface RpcRejection {
  protocolVersion: 1;
  requestId: string | null;
  type: string | null;
  ok: false;
  error: ContractError;
}
export function parseEnvelope(value: unknown) {
  const row = record(value, ['protocolVersion', 'requestId', 'type', 'payload'], 'request');
  // Parse identity before version so version failures can still be correlated by the handler.
  const requestId = id(row.requestId, 'request.requestId');
  const type = text(row.type, 80, 'request.type');
  if (!type) invalid('request.type');
  return { requestId, type, protocolVersion: row.protocolVersion, payload: row.payload };
}
export function parseFoundationRequest(value: unknown): FoundationRequest {
  const request = parseEnvelope(value);
  const protocolVersion = version(request.protocolVersion, 'request.protocolVersion');
  const base = { protocolVersion, requestId: request.requestId };
  switch (request.type) {
    case 'schedule.read': {
      const row = record(request.payload, ['scheduleId'], 'payload');
      return { ...base, type: request.type, payload: { scheduleId: id(row.scheduleId, 'payload.scheduleId') } };
    }
    case 'schedule.save': {
      const row = record(request.payload, ['expectedRevision', 'schedule'], 'payload');
      return { ...base, type: request.type, payload: {
        expectedRevision: row.expectedRevision === null ? null : revision(row.expectedRevision, 'payload.expectedRevision'),
        schedule: parseSchedule(row.schedule),
      } };
    }
    case 'settings.read':
      record(request.payload, [], 'payload');
      return { ...base, type: request.type, payload: {} };
    case 'settings.save': {
      const row = record(request.payload, ['expectedRevision', 'settings'], 'payload');
      return { ...base, type: request.type, payload: {
        expectedRevision: revision(row.expectedRevision, 'payload.expectedRevision'), settings: parseSettings(row.settings),
      } };
    }
    case 'schedule.import': case 'professor.lookup': case 'professor.associate':
    case 'enrollment.review': case 'enrollment.activate': case 'enrollment.cancel': case 'enrollment.read':
      throw new ContractFault('FEATURE_UNAVAILABLE', 'This command is not available in this build.');
    default: return invalid('request.type');
  }
}

const errorCodes = ['INVALID_INPUT', 'UNSUPPORTED_VERSION', 'REVISION_CONFLICT', 'UNAUTHORIZED_SENDER',
  'PORTAL_UNSUPPORTED', 'STALE_REVIEW', 'SELECTION_CHANGED', 'INVALID_TIME', 'JOB_ALREADY_ACTIVE',
  'TOO_LATE_TO_CANCEL', 'STORAGE_ERROR', 'PROVIDER_UNAVAILABLE', 'NOT_FOUND', 'REQUEST_ID_REUSED',
  'FEATURE_UNAVAILABLE', 'TRANSPORT_ERROR'] as const;

export function parseFoundationResponse(value: unknown, request: FoundationRequest): FoundationResponse {
  const row = record(value, ['protocolVersion', 'requestId', 'type', 'ok', 'data', 'error'], 'response');
  const protocolVersion = version(row.protocolVersion, 'response.protocolVersion');
  if (row.requestId !== request.requestId || row.type !== request.type) invalid('response.identity');
  const base = { protocolVersion, requestId: request.requestId };
  if (row.ok === false) {
    if (Object.hasOwn(row, 'data')) invalid('response.data');
    const error = record(row.error, ['code', 'message', 'field'], 'response.error');
    const code = errorCodes.find(code => code === error.code);
    if (!code) invalid('response.error.code');
    const detail: ContractError = { code, message: text(error.message, 300, 'response.error.message') };
    if (Object.hasOwn(error, 'field')) detail.field = text(error.field, 100, 'response.error.field');
    return { ...base, type: request.type, ok: false, error: detail };
  }
  if (row.ok !== true || Object.hasOwn(row, 'error')) invalid('response.ok');
  if (request.type === 'schedule.read' || request.type === 'schedule.save') {
    const data = parseSchedule(row.data);
    const expectedId = request.type === 'schedule.read' ? request.payload.scheduleId : request.payload.schedule.id;
    if (data.id !== expectedId) invalid('response.data.id');
    return { ...base, type: request.type, ok: true, data };
  }
  return { ...base, type: request.type, ok: true, data: parseSettings(row.data) };
}
