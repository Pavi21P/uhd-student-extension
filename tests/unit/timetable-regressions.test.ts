import { describe, expect, it, vi } from 'vitest';
import type { Schedule, TimetableBackup } from '../../src/shared/domain';
import type { StateEvent } from '../../src/shared/messages';
import { FoundationRepository, scheduleKey, type KeyValueStorage } from '../../src/storage/repository';
import { createMessageHandler } from '../../src/background/handler';
import { createFoundationClient } from '../../src/shared/client';
import { parseBackupText, serializeBackup } from '../../src/shared/timetable-backup';
import { changeCourse } from '../../src/dashboard/course-model';
import { proposePlacement, stagePlacement } from '../../src/dashboard/placement-model';
import { defaultSettings } from '../../src/shared/validation';
import { recurringSchedule, timetableBackup } from '../fixtures/contracts.examples';

function harness() {
  const values = new Map<string, unknown>();
  const events: StateEvent[] = [];
  let attempts = 0;
  let failure: 'none' | 'read' | 'before-write' | 'after-write' = 'none';
  const storage: KeyValueStorage = {
    get: async key => {
      if (failure === 'read') { failure = 'none'; throw Error('Synthetic read failure'); }
      return structuredClone(values.get(key));
    },
    set: async (key, value) => {
      attempts++;
      const next = failure; failure = 'none';
      if (next === 'before-write') throw Error('Synthetic rejected write');
      values.set(key, structuredClone(value));
      if (next === 'after-write') throw Error('Synthetic lost write confirmation');
    },
  };
  const restart = () => new FoundationRepository(storage, event => events.push(event));
  return { values, events, storage, restart, repo: restart(), get attempts() { return attempts; }, fail: (next: typeof failure) => { failure = next; } };
}
const backupOf = (schedule: Schedule): TimetableBackup => ({ ...timetableBackup, schedule });
const sender = { id: 'test-extension', url: 'chrome-extension://test-extension/dashboard.html', frameId: 0 };

// Integration regressions use the real validator, queue, mutation helpers and RPC bridge.
// Only the persistence/transport boundaries are synthetic; no browser lifecycle is claimed.
describe('08B import and save ordering', () => {
  it.each(['save', 'import'] as const)('keeps the first %s and rejects a competing write from the same snapshot', async first => {
    const h = harness(); const saved = await h.repo.saveSchedule(recurringSchedule, null);
    const edit = { ...saved, label: 'Edited before import', meetings: saved.meetings.slice(1) };
    const save = () => h.repo.saveSchedule(edit, saved.revision);
    const merge = () => h.repo.importSchedule(saved.id, saved.revision, 'merge', timetableBackup);
    const outcomes = await Promise.allSettled(first === 'save' ? [save(), merge()] : [merge(), save()]);
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'REVISION_CONFLICT' } } });
    const stored = await h.restart().readSchedule(saved.id);
    expect(stored.revision).toBe(1); expect(h.attempts).toBe(2);
    expect(stored.label).toBe(first === 'save' ? edit.label : saved.label);
    expect(stored.meetings).toHaveLength(first === 'save' ? 2 : 6);
    expect(h.events.map(event => event.payload.revision)).toEqual([0, 1]);
  });

  it.each(['save', 'import'] as const)('does not overwrite a fresh target created first by %s', async first => {
    const h = harness(); const draft = { ...recurringSchedule, label: 'New local timetable' };
    const save = () => h.repo.saveSchedule(draft, null);
    const replace = () => h.repo.importSchedule(draft.id, null, 'replace', timetableBackup);
    const outcomes = await Promise.allSettled(first === 'save' ? [save(), replace()] : [replace(), save()]);
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'REVISION_CONFLICT' } } });
    const stored = await h.restart().readSchedule(draft.id);
    expect(stored.label).toBe(first === 'save' ? draft.label : timetableBackup.schedule.label);
    expect(stored.revision).toBe(0); expect(h.attempts).toBe(1);
  });

  it('captures import content before waiting behind an in-flight read', async () => {
    const h = harness(); const saved = await h.repo.saveSchedule(recurringSchedule, null);
    let release!: () => void; let entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    let hold = true;
    const repo = new FoundationRepository({ ...h.storage, get: async key => {
      if (hold) { hold = false; entered(); await gate; }
      return h.storage.get(key);
    } });
    const read = repo.readSchedule(saved.id); await started;
    const input = structuredClone(timetableBackup);
    const pending = repo.importSchedule(saved.id, 0, 'replace', input);
    input.schedule.courses[1]!.title = 'Changed after confirmation'; input.schedule.meetings.length = 0;
    release(); await read;
    const imported = await pending;
    expect(imported.courses).toEqual(timetableBackup.schedule.courses);
    expect(imported.meetings).toEqual(timetableBackup.schedule.meetings);
    expect(await h.restart().readSchedule(saved.id)).toEqual(imported);
  });
});

describe('08B uncertain outcomes and recovery', () => {
  it('reads a committed import after a lost write confirmation and rejects stale replay', async () => {
    const h = harness(); const saved = await h.repo.saveSchedule(recurringSchedule, null);
    h.fail('after-write');
    await expect(h.repo.importSchedule(saved.id, 0, 'merge', timetableBackup)).rejects.toMatchObject({ detail: { code: 'STORAGE_ERROR' } });
    const restarted = h.restart(); const committed = await restarted.readSchedule(saved.id);
    expect(committed.meetings).toHaveLength(6); expect(committed.revision).toBe(1);
    await expect(restarted.importSchedule(saved.id, 0, 'merge', timetableBackup)).rejects.toMatchObject({ detail: { code: 'REVISION_CONFLICT' } });
    expect(await restarted.readSchedule(saved.id)).toEqual(committed);
    expect(h.attempts).toBe(2); expect(h.events).toHaveLength(1);
  });

  it.each(['closed', 'timeout'] as const)('never resends an import when its committed reply is %s', async failure => {
    vi.useFakeTimers();
    try {
      const h = harness(); const handle = createMessageHandler(h.repo, 'test-extension'); let calls = 0;
      let committed!: () => void; const done = new Promise<void>(resolve => { committed = resolve; });
      const client = createFoundationClient(async request => {
        calls++; const response = await handle(request, sender);
        expect(response.ok).toBe(true); committed();
        if (failure === 'closed') throw Error('Synthetic closed transport');
        return new Promise<never>(() => {});
      });
      const pending = client('schedule.import', { targetScheduleId: 'fresh', expectedRevision: null, mode: 'merge', backup: timetableBackup });
      const rejected = expect(pending).rejects.toMatchObject({ detail: { code: 'TRANSPORT_ERROR' } });
      await done; await vi.advanceTimersByTimeAsync(10_001); await rejected;
      await vi.advanceTimersByTimeAsync(30_000);
      expect(calls).toBe(1); expect(h.attempts).toBe(1);
      const stored = await h.restart().readSchedule('fresh');
      expect(stored.revision).toBe(0); expect(stored.meetings).toHaveLength(3);
    } finally { vi.useRealTimers(); }
  });

  it.each(['read', 'before-write'] as const)('retains every record after a failed import %s and permits deliberate recovery', async failure => {
    const h = harness(); const saved = await h.repo.saveSchedule(recurringSchedule, null);
    const other = await h.repo.saveSchedule({ ...recurringSchedule, id: 'other' }, null);
    const settings = await h.repo.saveSettings(defaultSettings(), 0);
    const snapshot = structuredClone([...h.values]); const notifications = h.events.length;
    h.fail(failure);
    await expect(h.repo.importSchedule(saved.id, 0, 'replace', backupOf({ ...saved, courses: [], meetings: [] }))).rejects.toMatchObject({ detail: { code: 'STORAGE_ERROR' } });
    expect([...h.values]).toEqual(snapshot); expect(h.events).toHaveLength(notifications);
    expect(await h.repo.readSchedule(saved.id)).toEqual(saved);
    const recovered = await h.repo.importSchedule(saved.id, 0, 'merge', timetableBackup);
    expect(recovered.revision).toBe(1); expect(recovered.meetings).toHaveLength(6);
    expect(await h.restart().readSchedule(other.id)).toEqual(other);
    expect(await h.repo.readSettings()).toEqual(settings);
  });
});

describe('08B import data boundaries', () => {
  it.each(['merge', 'replace'] as const)('protects identity mismatches and exhausted revisions during %s', async mode => {
    const h = harness();
    for (const invalid of [{ ...recurringSchedule, id: 'wrong-key' }, { ...recurringSchedule, revision: Number.MAX_SAFE_INTEGER }]) {
      h.values.set(scheduleKey(recurringSchedule.id), structuredClone(invalid));
      await expect(h.repo.importSchedule(recurringSchedule.id, invalid.revision, mode, timetableBackup)).rejects.toMatchObject({ detail: { code: 'STORAGE_ERROR' } });
      expect(h.values.get(scheduleKey(recurringSchedule.id))).toEqual(invalid);
    }
    expect(h.attempts).toBe(0); expect(h.events).toEqual([]);
  });

  it.each(['courses', 'meetings'] as const)('accepts the exact %s limit but rejects one extra without a write', async limit => {
    const h = harness();
    const courseCount = limit === 'courses' ? 248 : 2;
    const local: Schedule = { ...recurringSchedule, courses: Array.from({ length: courseCount }, (_, i) => ({ id: 'local-' + i })),
      meetings: limit === 'meetings' ? Array.from({ length: 997 }, (_, i) => ({ id: 'm-' + i, courseId: 'local-0', dayOfWeek: 1, startMinute: i, endMinute: i + 1 })) : [] };
    const saved = await h.repo.saveSchedule(local, null);
    const full = await h.repo.importSchedule(saved.id, 0, 'merge', timetableBackup);
    expect(limit === 'courses' ? full.courses.length : full.meetings.length).toBe(limit === 'courses' ? 250 : 1000);
    const extra = backupOf({ ...recurringSchedule, courses: [{ id: 'extra' }], meetings: limit === 'meetings' ? [{ id: 'extra-m', courseId: 'extra', dayOfWeek: 7, startMinute: 1439, endMinute: 1440 }] : [] });
    await expect(h.repo.importSchedule(saved.id, 1, 'merge', extra)).rejects.toMatchObject({ detail: { code: 'INVALID_INPUT' } });
    expect(await h.restart().readSchedule(saved.id)).toEqual(full); expect(h.attempts).toBe(2);
  });
});

describe('08B imported recurrence lifecycle', () => {
  it('moves one imported occurrence, round trips it, then removes one meeting and deletes only its course', async () => {
    const h = harness(); const original = await h.repo.saveSchedule(recurringSchedule, null);
    const merged = await h.repo.importSchedule(original.id, 0, 'merge', parseBackupText(serializeBackup(original)));
    const imported = merged.meetings.slice(original.meetings.length);
    const monday = imported.find(meeting => meeting.dayOfWeek === 1)!;
    const proposal = proposePlacement('move', monday, 2, 547, false);
    const moved = await h.repo.saveSchedule(stagePlacement(merged, merged.revision, 'move', proposal), merged.revision);
    expect(moved.meetings.filter(meeting => meeting.courseId === monday.courseId)).toEqual(imported.map(meeting => meeting.id === monday.id ? proposal : meeting));
    expect(moved.meetings.filter(meeting => meeting.courseId !== monday.courseId)).toEqual(original.meetings);
    const exported = parseBackupText(serializeBackup(await h.restart().readSchedule(original.id)));
    const restored = await h.repo.importSchedule('restored', null, 'replace', exported);
    expect(restored.meetings).toEqual(moved.meetings); expect(restored.courses).toEqual(moved.courses);
    const course = restored.courses.find(item => item.id === monday.courseId)!;
    const removed = await h.repo.saveSchedule(changeCourse(restored, { kind: 'edit', course, meetings: imported.filter(meeting => meeting.id !== monday.id) }), restored.revision);
    expect(removed.meetings).toEqual([...original.meetings, ...imported.filter(meeting => meeting.id !== monday.id)]);
    const deleted = await h.repo.saveSchedule(changeCourse(removed, { kind: 'delete', courseId: course.id }), removed.revision);
    expect(deleted.meetings).toEqual(original.meetings);
    expect(deleted.courses).toEqual(restored.courses.filter(item => item.id !== course.id));
    expect(await h.restart().readSchedule('restored')).toEqual(deleted);
    expect(await h.repo.readSchedule(original.id)).toEqual(moved);
  });
});