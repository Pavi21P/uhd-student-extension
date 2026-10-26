import type { DashboardRpc } from './messages';
import type { ProfessorResult } from './domain';
import { normalizeInstructor, validateInstructor } from './professor-profile';
import { invalid, record, text } from './validation';
export type ProfessorLookupInput = DashboardRpc['professor.lookup']['input'];
export type UnconfiguredProfessorResult = Extract<ProfessorResult, { status: 'unavailable' }> & { reason: 'provider-unconfigured' };
export function parseProfessorLookup(value: unknown): ProfessorLookupInput {
  const row = record(value, ['instructorName', 'department'], 'payload');
  const raw = text(row.instructorName, 200, 'payload.instructorName');
  let instructorName: string;
  try { instructorName = validateInstructor(raw); } catch { return invalid('payload.instructorName'); }
  const result: ProfessorLookupInput = { instructorName };
  if (Object.hasOwn(row, 'department')) {
    const department = normalizeInstructor(text(row.department, 200, 'payload.department'));
    if ([...department].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) invalid('payload.department');
    if (department) result.department = department;
  }
  return result;
}
/** This build accepts only the explicit fallback result, never injected fixture/live snapshots. */
export function parseUnconfiguredProfessorResult(value: unknown): UnconfiguredProfessorResult {
  const row = record(value, ['status', 'reason'], 'response.data');
  if (row.status !== 'unavailable' || row.reason !== 'provider-unconfigured') invalid('response.data');
  return { status: 'unavailable', reason: 'provider-unconfigured' };
}
