import { describe, expect, it } from 'vitest';
import type { Meeting } from '../../src/shared/domain';
import { defaultSettings } from '../../src/shared/validation';
import { changeCourse, emptySchedule } from '../../src/dashboard/course-model';
import { draftMeeting, parseMeetingDrafts } from '../../src/dashboard/meeting-model';
import { hourMarks, outsideView, positionMeetings, revealMeetings } from '../../src/dashboard/grid-layout';
import { parseViewDraft, viewDraft } from '../../src/dashboard/view-settings-model';
const row = (id: string, startMinute: number, endMinute: number, dayOfWeek: Meeting['dayOfWeek'] = 1, courseId = 'a'): Meeting => ({ id, courseId, startMinute, endMinute, dayOfWeek });
const view = defaultSettings();

describe('manual meeting transactions', () => {
  it('keeps independent occurrence IDs and exact minutes through the form representation', () => {
    const meetings = [row('mon', 547, 623), row('wed', 547, 623, 3), row('sun', 1439, 1440, 7)];
    expect(parseMeetingDrafts('a', meetings.map(draftMeeting))).toEqual({ ok: true, meetings });
    expect(parseMeetingDrafts('a', [])).toEqual({ ok: true, meetings: [] });
  });
  it('returns row-specific errors for missing, overnight, and duplicate times without partial output', () => {
    const bad = parseMeetingDrafts('a', [{ id: 'blank', dayOfWeek: 1, start: '', end: '' },
      { id: 'overnight', dayOfWeek: 2, start: '23:00', end: '01:00' },
      { id: 'one', dayOfWeek: 1, start: '09:00', end: '10:00' }, { id: 'two', dayOfWeek: 1, start: '09:00', end: '10:00' }]);
    expect(bad).toEqual({ ok: false, errors: { blank: { start: expect.any(String) }, overnight: { end: expect.any(String) }, two: { end: expect.any(String) } } });
  });
  it('saves course fields and replacement meetings atomically while preserving unrelated records', () => {
    const source = { ...emptySchedule(), courses: [{ id: 'a' }, { id: 'b' }], meetings: [row('mon', 540, 600), row('wed', 540, 600, 3), row('other', 600, 660, 1, 'b')] };
    const before = structuredClone(source);
    const result = changeCourse(source, { kind: 'edit', course: { id: 'a', title: 'Updated' }, meetings: [row('mon', 547, 623)] });
    expect(result.courses).toEqual([{ id: 'a', title: 'Updated' }, { id: 'b' }]);
    expect(result.meetings).toEqual([source.meetings[2], row('mon', 547, 623)]);
    expect(source).toEqual(before);
    expect(changeCourse(result, { kind: 'edit', course: { id: 'a' }, meetings: [] }).meetings).toEqual([source.meetings[2]]);
  });
  it('rejects foreign course ownership, reused meeting IDs, and duplicate occurrences', () => {
    const source = { ...emptySchedule(), courses: [{ id: 'a' }, { id: 'b' }], meetings: [row('other', 600, 660, 1, 'b')] };
    expect(() => changeCourse(source, { kind: 'edit', course: { id: 'a' }, meetings: [row('foreign', 600, 660, 1, 'b')] })).toThrow();
    expect(() => changeCourse(source, { kind: 'edit', course: { id: 'a' }, meetings: [row('other', 600, 660)] })).toThrow();
    expect(() => changeCourse(source, { kind: 'edit', course: { id: 'a' }, meetings: [row('one', 600, 660), row('two', 600, 660)] })).toThrow();
    expect(source.meetings).toHaveLength(1);
  });
});

describe('weekly grid geometry', () => {
  it('uses exact offsets and durations instead of snapping form times', () => {
    const result = positionMeetings([row('precise', 547, 623)], view)[0]!;
    expect(result.top).toBeCloseTo(152.4); expect(result.height).toBeCloseTo(91.2);
    expect(result.lanes).toBe(1); expect(result.clipped).toBe(false);
  });
  it('excludes boundary-adjacent and hidden-day meetings but clips partial visibility truthfully', () => {
    const meetings = [row('early', 360, 420), row('late', 1320, 1380), row('weekend', 600, 660, 7), row('clipped', 390, 450)];
    const result = positionMeetings(meetings, view);
    expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ meeting: meetings[3], top: 0, height: 36, clipped: true });
    expect(meetings.every(meeting => outsideView(meeting, view))).toBe(true);
    const expanded = revealMeetings(view, meetings);
    expect(expanded).toEqual({ visibleDays: [1, 2, 3, 4, 5, 7], startMinute: 360, endMinute: 1380 });
    expect(positionMeetings(meetings, expanded)).toHaveLength(4); expect(view.startMinute).toBe(420);
  });
  it('assigns separate lanes to intersecting meetings, reuses lanes for adjacency, and resets later groups', () => {
    const meetings = [row('wide', 540, 720), row('early', 540, 600, 1, 'b'), row('next', 600, 660, 1, 'b'), row('later', 720, 780)];
    const result = positionMeetings(meetings, view);
    expect(result.find(item => item.meeting.id === 'wide')?.lanes).toBe(2);
    expect(result.find(item => item.meeting.id === 'early')?.lane).toBe(result.find(item => item.meeting.id === 'next')?.lane);
    expect(result.find(item => item.meeting.id === 'later')).toMatchObject({ lane: 0, lanes: 1 });
    for (const a of result) for (const b of result) if (a !== b && a.meeting.startMinute < b.meeting.endMinute && b.meeting.startMinute < a.meeting.endMinute) expect(a.lane).not.toBe(b.lane);
    expect(positionMeetings([...meetings].reverse(), view)).toEqual(result);
  });
  it('keeps very short visible ranges readable without changing the represented times', () => {
    const narrow = { ...view, startMinute: 600, endMinute: 601 };
    expect(positionMeetings([row('minute', 600, 601)], narrow)[0]).toMatchObject({ top: 0, height: 180 });
    expect(hourMarks(narrow)).toEqual([600, 601]);
    const hour = { ...view, startMinute: 600, endMinute: 660 };
    expect(positionMeetings([row('half', 630, 660)], hour)[0]).toMatchObject({ top: 90, height: 90 });
  });
  it('supports an exact one-minute full-day endpoint and custom hour boundaries', () => {
    const allDay = { ...view, visibleDays: [7 as const], startMinute: 0, endMinute: 1440 };
    expect(positionMeetings([row('last', 1439, 1440, 7)], allDay)[0]).toMatchObject({ top: 1726.8, height: 1.2 });
    expect(hourMarks({ ...view, startMinute: 457, endMinute: 603 })).toEqual([457, 480, 540, 600, 603]);
    expect(hourMarks({ ...view, startMinute: 600, endMinute: 601 })).toEqual([600, 601]);
  });
});

describe('view preferences', () => {
  it('preserves revision and enrollment timezone while normalizing visible days and exact hours', () => {
    const settings = { ...view, revision: 8, enrollmentTimezone: 'America/New_York' };
    const result = parseViewDraft(settings, { days: [7, 1], start: '06:07', end: '24:00' });
    expect(result).toEqual({ ...settings, visibleDays: [1, 7], startMinute: 367, endMinute: 1440 });
    expect(viewDraft(result)).toEqual({ days: [1, 7], start: '06:07', end: '24:00' });
    expect(settings.visibleDays).toEqual([1, 2, 3, 4, 5]);
  });
  it('rejects empty/duplicate days and invalid hours instead of changing the saved view', () => {
    expect(() => parseViewDraft(view, { days: [], start: '07:00', end: '22:00' })).toThrow();
    expect(() => parseViewDraft(view, { days: [1, 1], start: '07:00', end: '22:00' })).toThrow();
    expect(() => parseViewDraft(view, { days: [1], start: '22:00', end: '07:00' })).toThrow();
    expect(() => parseViewDraft(view, { days: [1], start: '07:60', end: '22:00' })).toThrow();
  });
});
