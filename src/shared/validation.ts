import type { ContractError, ContractErrorCode, CourseCard, DayOfWeek, DisplaySettings, Meeting, Schedule } from './domain';

export class ContractFault extends Error {
  readonly detail: ContractError;
  constructor(code: ContractErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'ContractFault';
    this.detail = field === undefined ? { code, message } : { code, message, field };
  }
}

export function invalid(field: string): never {
  throw new ContractFault('INVALID_INPUT', 'The value does not match the supported format.', field);
}

/** Accept only plain data records. Do not invoke getters or copy prototype keys. */
export function record(value: unknown, keys: readonly string[], field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid(field);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid(field);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key) || !keys.includes(key)) return invalid(field);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return invalid(field);
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown, max: number, field: string): string {
  if (typeof value !== 'string' || value.length > max) return invalid(field);
  return value;
}
export function id(value: unknown, field = 'id'): string {
  const result = text(value, 128, field);
  // oxlint-disable-next-line no-control-regex -- IDs intentionally reject control characters and lone surrogates.
  if (!result.trim() || /[\u0000-\u001f\u007f\ud800-\udfff]/u.test(result)) return invalid(field);
  return result;
}
export function integer(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return invalid(field);
  return value;
}
export function revision(value: unknown, field = 'revision'): number {
  return integer(value, 0, Number.MAX_SAFE_INTEGER, field);
}
export function version(value: unknown, field: string): 1 {
  integer(value, 1, Number.MAX_SAFE_INTEGER, field);
  if (value !== 1) throw new ContractFault('UNSUPPORTED_VERSION', 'This data version is not supported. Existing data was not changed.', field);
  return 1;
}
export function timezone(value: unknown, field: string): string {
  const result = text(value, 100, field);
  if (!result || result.trim() !== result || /^[+-]/.test(result)) return invalid(field);
  try { new Intl.DateTimeFormat('en-US', { timeZone: result }).format(0); }
  catch { return invalid(field); }
  return result;
}
export function list(value: unknown, max: number, field: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) return invalid(field);
  // Sparse arrays and custom properties are not JSON lists.
  if (Reflect.ownKeys(value).length !== value.length + 1) return invalid(field);
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return invalid(field);
  }
  if (Object.getOwnPropertySymbols(value).length) return invalid(field);
  return value;
}
function unique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) invalid(field);
}
function day(value: unknown, field: string): DayOfWeek {
  return integer(value, 1, 7, field) as DayOfWeek;
}
function minutes(start: unknown, end: unknown, field: string) {
  const startMinute = integer(start, 0, 1439, field + '.startMinute');
  const endMinute = integer(end, 1, 1440, field + '.endMinute');
  if (startMinute >= endMinute) invalid(field + '.endMinute');
  return { startMinute, endMinute };
}

export function parseCourse(value: unknown): CourseCard {
  const row = record(value, ['id', 'title', 'courseCode', 'professorName', 'room', 'color'], 'course');
  const result: CourseCard = { id: id(row.id, 'course.id') };
  const limits = { title: 200, courseCode: 40, professorName: 200, room: 80 } as const;
  for (const key of ['title', 'courseCode', 'professorName', 'room'] as const) {
    if (Object.hasOwn(row, key)) {
      const normalized = text(row[key], limits[key], 'course.' + key).trim();
      if (normalized) result[key] = normalized;
    }
  }
  if (Object.hasOwn(row, 'color')) {
    const color = text(row.color, 7, 'course.color');
    if (!/^#[\da-f]{6}$/i.test(color)) invalid('course.color');
    result.color = color;
  }
  return result;
}
export function parseMeeting(value: unknown): Meeting {
  const row = record(value, ['id', 'courseId', 'dayOfWeek', 'startMinute', 'endMinute'], 'meeting');
  return { id: id(row.id, 'meeting.id'), courseId: id(row.courseId, 'meeting.courseId'),
    dayOfWeek: day(row.dayOfWeek, 'meeting.dayOfWeek'), ...minutes(row.startMinute, row.endMinute, 'meeting') };
}
export function parseSchedule(value: unknown): Schedule {
  const row = record(value, ['schemaVersion', 'id', 'revision', 'label', 'termLabel', 'timezone', 'courses', 'meetings'], 'schedule');
  const schemaVersion = version(row.schemaVersion, 'schedule.schemaVersion');
  const courses = list(row.courses, 250, 'schedule.courses').map(parseCourse);
  const meetings = list(row.meetings, 1000, 'schedule.meetings').map(parseMeeting);
  unique(courses.map(course => course.id), 'schedule.courses');
  unique(meetings.map(meeting => meeting.id), 'schedule.meetings');
  const courseIds = new Set(courses.map(course => course.id));
  for (const meeting of meetings) if (!courseIds.has(meeting.courseId)) invalid('meeting.courseId');
  unique(meetings.map(meeting => JSON.stringify([meeting.courseId, meeting.dayOfWeek, meeting.startMinute, meeting.endMinute])), 'schedule.meetings');
  return { schemaVersion, id: id(row.id, 'schedule.id'), revision: revision(row.revision),
    label: text(row.label, 120, 'schedule.label'), termLabel: text(row.termLabel, 120, 'schedule.termLabel'),
    timezone: timezone(row.timezone, 'schedule.timezone'), courses, meetings };
}
export function parseSettings(value: unknown): DisplaySettings {
  const row = record(value, ['schemaVersion', 'revision', 'visibleDays', 'startMinute', 'endMinute', 'enrollmentTimezone'], 'settings');
  const schemaVersion = version(row.schemaVersion, 'settings.schemaVersion');
  const visibleDays = list(row.visibleDays, 7, 'settings.visibleDays').map(value => day(value, 'settings.visibleDays'));
  if (!visibleDays.length || new Set(visibleDays).size !== visibleDays.length) invalid('settings.visibleDays');
  return { schemaVersion, revision: revision(row.revision), visibleDays,
    ...minutes(row.startMinute, row.endMinute, 'settings'), enrollmentTimezone: timezone(row.enrollmentTimezone, 'settings.enrollmentTimezone') };
}
export function defaultSettings(): DisplaySettings {
  return { schemaVersion: 1, revision: 0, visibleDays: [1, 2, 3, 4, 5], startMinute: 420, endMinute: 1320, enrollmentTimezone: 'America/Chicago' };
}
