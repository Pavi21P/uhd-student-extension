import type { Schedule, TimetableBackup } from './domain';
import { ContractFault, id, invalid, parseSchedule, record, version } from './validation';
export const backupByteLimit = 1024 * 1024;
export type ImportMode = 'merge' | 'replace';
export function parseImportMode(value: unknown): ImportMode {
  if (value !== 'merge' && value !== 'replace') return invalid('import.mode');
  return value;
}
export function parseBackup(value: unknown): TimetableBackup {
  const row = record(value, ['kind', 'schemaVersion', 'exportedAt', 'schedule'], 'backup');
  if (row.kind !== 'uhd-extension/timetable') return invalid('backup.kind');
  const schemaVersion = version(row.schemaVersion, 'backup.schemaVersion');
  if (typeof row.exportedAt !== 'number' || !Number.isFinite(row.exportedAt)) return invalid('backup.exportedAt');
  const backup: TimetableBackup = { kind: 'uhd-extension/timetable', schemaVersion, exportedAt: row.exportedAt, schedule: parseSchedule(row.schedule) };
  if (new TextEncoder().encode(JSON.stringify(backup)).length > backupByteLimit) throw new ContractFault('INVALID_INPUT', 'Choose a timetable backup no larger than 1 MiB.');
  return backup;
}
export function parseBackupText(text: string): TimetableBackup {
  if (text.length > backupByteLimit || new TextEncoder().encode(text).length > backupByteLimit) throw new ContractFault('INVALID_INPUT', 'Choose a timetable backup no larger than 1 MiB.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new ContractFault('INVALID_INPUT', 'This file is not valid JSON. No saved courses were changed.'); }
  return parseBackup(value);
}
export function serializeBackup(schedule: Schedule, exportedAt = Date.now()): string {
  const backup = parseBackup({ kind: 'uhd-extension/timetable', schemaVersion: 1, exportedAt, schedule });
  // Compact serialization keeps exported files within the same import byte limit.
  return JSON.stringify(backup);
}
/** Shared by preview and the serialized writer. Generated merge IDs are never trusted from the UI. */
export function buildImport(current: Schedule | null, targetId: string, mode: ImportMode, input: TimetableBackup, generateId: () => string = () => crypto.randomUUID()): Schedule {
  const backup = parseBackup(input); const target = id(targetId); parseImportMode(mode);
  const local = current ? parseSchedule(current) : { ...backup.schedule, id: target, revision: 0, courses: [], meetings: [] };
  if (local && local.id !== target) throw new ContractFault('INVALID_INPUT', 'The target timetable does not match the saved version.');
  if (mode === 'replace') return parseSchedule({ ...backup.schedule, id: target, revision: local?.revision ?? 0 });
  if (local.timezone !== backup.schedule.timezone) throw new ContractFault('INVALID_INPUT', 'Merge requires matching timetable timezones. Choose Replace, or adjust the source backup explicitly.');
  if (local.courses.length + backup.schedule.courses.length > 250 || local.meetings.length + backup.schedule.meetings.length > 1000) {
    throw new ContractFault('INVALID_INPUT', 'The combined timetable exceeds 250 courses or 1,000 meetings. Choose a smaller backup or Replace.');
  }
  const used = new Set([...local.courses, ...local.meetings, ...backup.schedule.courses, ...backup.schedule.meetings].map(item => item.id));
  const fresh = () => {
    for (let attempt = 0; attempt < 8; attempt++) { const value = id(generateId()); if (!used.has(value)) { used.add(value); return value; } }
    throw new ContractFault('INVALID_INPUT', 'Could not allocate unique course IDs. Nothing was changed.');
  };
  const mapping = new Map<string, string>();
  const courses = backup.schedule.courses.map(course => { const value = fresh(); mapping.set(course.id, value); return { ...course, id: value }; });
  const meetings = backup.schedule.meetings.map(meeting => ({ ...meeting, id: fresh(), courseId: mapping.get(meeting.courseId)! }));
  return parseSchedule({ ...local, courses: [...local.courses, ...courses], meetings: [...local.meetings, ...meetings] });
}
