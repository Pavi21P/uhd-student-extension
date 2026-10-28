import type { EnrollmentTiming } from './domain';
import { ContractFault, integer, invalid, record, text, timezone } from './validation';

const maxDateEpochMs = 8_640_000_000_000_000;
const timingKeys = ['mode', 'targetEpochMs', 'timezone', 'localDateTime', 'utcOffsetMinutes'] as const;

function invalidTime(field: string, message: string): never {
  throw new ContractFault('INVALID_TIME', message, 'timing.' + field);
}

/** Parse fixed-width Gregorian wall time without the machine's local zone or date rollover. */
function localAsUtc(localDateTime: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(localDateTime)) invalid('timing.localDateTime');
  const year = Number(localDateTime.slice(0, 4));
  const date = new Date(0);
  // setUTCFullYear preserves years 1..99 instead of Date.UTC's 1900-based interpretation.
  date.setUTCFullYear(year, Number(localDateTime.slice(5, 7)) - 1, Number(localDateTime.slice(8, 10)));
  date.setUTCHours(Number(localDateTime.slice(11, 13)), Number(localDateTime.slice(14, 16)), Number(localDateTime.slice(17, 19)), 0);
  if (year === 0 || date.toISOString().slice(0, 19) !== localDateTime) {
    invalidTime('localDateTime', 'Choose a valid calendar date and time with seconds.');
  }
  return date.getTime();
}

function wallTimeAt(targetEpochMs: number, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, calendar: 'iso8601', numberingSystem: 'latn', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(targetEpochMs);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value ?? '';
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

/** Validate timing structure/zone consistency without rejecting historical replay payloads. */
export function parseEnrollmentTimingValue(value: unknown): EnrollmentTiming {
  const row = record(value, timingKeys, 'timing');
  if (row.mode === 'now') {
    record(row, ['mode'], 'timing');
    return { mode: 'now' };
  }
  if (row.mode !== 'scheduled') return invalid('timing.mode');

  const targetEpochMs = integer(row.targetEpochMs, -maxDateEpochMs, maxDateEpochMs, 'timing.targetEpochMs');
  const zone = timezone(row.timezone, 'timing.timezone');
  const localDateTime = text(row.localDateTime, 19, 'timing.localDateTime');
  const utcOffsetMinutes = integer(row.utcOffsetMinutes, -1439, 1439, 'timing.utcOffsetMinutes');
  const localEpochMs = localAsUtc(localDateTime);

  if (targetEpochMs % 1000 !== 0 || localEpochMs - utcOffsetMinutes * 60_000 !== targetEpochMs) {
    invalidTime('targetEpochMs', 'The timestamp, local time and UTC offset must describe the same second.');
  }
  if (wallTimeAt(targetEpochMs, zone) !== localDateTime) {
    invalidTime('timezone', 'This local time and offset do not match the selected time zone. Review daylight-saving changes.');
  }
  return { mode: 'scheduled', targetEpochMs, timezone: zone, localDateTime, utcOffsetMinutes };
}

/** A new activation additionally requires a future scheduled target against a trusted clock. */
export function parseEnrollmentTiming(value: unknown, nowEpochMs: number): EnrollmentTiming {
  integer(nowEpochMs, -maxDateEpochMs, maxDateEpochMs, 'nowEpochMs');
  const timing = parseEnrollmentTimingValue(value);
  if (timing.mode === 'scheduled' && timing.targetEpochMs <= nowEpochMs) {
    invalidTime('targetEpochMs', 'Choose a scheduled time in the future.');
  }
  return timing;
}
