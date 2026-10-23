import { describe, expect, it } from 'vitest';
import { FoundationRepository, scheduleKey, type KeyValueStorage } from '../../src/storage/repository';
import { blankSchedule, recurringSchedule } from '../fixtures/contracts.examples';
import { defaultSettings } from '../../src/shared/validation';
import type { StateEvent } from '../../src/shared/messages';

export class MemoryStorage implements KeyValueStorage {
  values = new Map<string, unknown>();
  writes = 0;
  failRead = false;
  failWrite = false;
  async get(key: string) {
    if (this.failRead) throw new Error('Private underlying error');
    return structuredClone(this.values.get(key));
  }
  async set(key: string, value: unknown) {
    if (this.failWrite) throw new Error('Private quota details');
    this.values.set(key, structuredClone(value));
    this.writes++;
  }
}
const code = (name: string) => expect.objectContaining({ detail: expect.objectContaining({ code: name }) });

describe('single-writer schedule repository', () => {
  it('creates revision zero, reloads from a new repository and ignores client revision', async () => {
    const storage = new MemoryStorage();
    const repo = new FoundationRepository(storage);
    const saved = await repo.saveSchedule({ ...recurringSchedule, revision: 99 }, null);
    expect(saved.revision).toBe(0);
    expect(await new FoundationRepository(storage).readSchedule(saved.id)).toEqual(saved);
    const updated = await repo.saveSchedule({ ...saved, label: 'Edited', revision: 999 }, 0);
    expect(updated.revision).toBe(1);
    expect(storage.writes).toBe(2);
  });
  it('allows exactly one winner when two views save the same revision', async () => {
    const storage = new MemoryStorage();
    const repo = new FoundationRepository(storage);
    await repo.saveSchedule(blankSchedule, null);
    const results = await Promise.allSettled([
      repo.saveSchedule({ ...blankSchedule, label: 'View A' }, 0),
      repo.saveSchedule({ ...blankSchedule, label: 'View B' }, 0),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { detail: { code: 'REVISION_CONFLICT' } } });
    expect((await repo.readSchedule(blankSchedule.id)).label).toBe('View A');
    expect(storage.writes).toBe(2);
  });
  it('never turns create-only or missing-target updates into overwrites', async () => {
    const storage = new MemoryStorage();
    const repo = new FoundationRepository(storage);
    await expect(repo.readSchedule(blankSchedule.id)).rejects.toEqual(code('NOT_FOUND'));
    await expect(repo.saveSchedule(blankSchedule, 0)).rejects.toEqual(code('REVISION_CONFLICT'));
    await repo.saveSchedule(blankSchedule, null);
    await expect(repo.saveSchedule(blankSchedule, null)).rejects.toEqual(code('REVISION_CONFLICT'));
    expect(storage.writes).toBe(1);
  });
  it.each([
    [{ ...blankSchedule, schemaVersion: 2 }, 'UNSUPPORTED_VERSION'],
    [{ ...blankSchedule, courses: 'damaged' }, 'STORAGE_ERROR'],
    [{ ...blankSchedule, id: 'different' }, 'STORAGE_ERROR'],
    [null, 'STORAGE_ERROR'],
  ])('preserves unsupported or corrupt stored data %#', async (value, expectedCode) => {
    const storage = new MemoryStorage();
    const key = scheduleKey(blankSchedule.id);
    storage.values.set(key, value);
    const repo = new FoundationRepository(storage);
    await expect(repo.readSchedule(blankSchedule.id)).rejects.toEqual(code(String(expectedCode)));
    await expect(repo.saveSchedule(blankSchedule, null)).rejects.toEqual(code(String(expectedCode)));
    expect(storage.values.get(key)).toEqual(value);
    expect(storage.writes).toBe(0);
  });
  it('keeps data after a failed write, emits nothing, and allows a later deliberate save', async () => {
    const storage = new MemoryStorage();
    const events: StateEvent[] = [];
    const repo = new FoundationRepository(storage, event => events.push(event));
    await repo.saveSchedule(blankSchedule, null);
    storage.failWrite = true;
    await expect(repo.saveSchedule({ ...blankSchedule, label: 'Unsaved draft' }, 0)).rejects.toEqual(code('STORAGE_ERROR'));
    expect((await repo.readSchedule(blankSchedule.id)).label).toBe(blankSchedule.label);
    expect(events).toHaveLength(1);
    storage.failWrite = false;
    await repo.saveSchedule({ ...blankSchedule, label: 'Deliberate retry' }, 0);
    expect(events.at(-1)).toEqual({ protocolVersion: 1, type: 'schedule.changed', payload: { scheduleId: blankSchedule.id, revision: 1 } });
  });
  it('does not expose raw storage errors or misreport a saved record when notification fails', async () => {
    const storage = new MemoryStorage();
    const repo = new FoundationRepository(storage, () => { throw new Error('No listener'); });
    await expect(repo.saveSchedule(blankSchedule, null)).resolves.toMatchObject({ revision: 0 });
    storage.failRead = true;
    await expect(repo.readSchedule(blankSchedule.id)).rejects.toMatchObject({ message: 'Saved data could not be read. Nothing was changed.' });
  });
  it('copies the draft before waiting and rejects revision overflow', async () => {
    const storage = new MemoryStorage();
    const repo = new FoundationRepository(storage);
    const draft = structuredClone(blankSchedule);
    const pending = repo.saveSchedule(draft, null);
    draft.courses[0]!.id = 'changed-after-save';
    expect((await pending).courses[0]!.id).toBe('sample-blank-course');
    storage.values.set(scheduleKey(blankSchedule.id), { ...blankSchedule, revision: Number.MAX_SAFE_INTEGER });
    await expect(repo.saveSchedule(blankSchedule, Number.MAX_SAFE_INTEGER)).rejects.toEqual(code('STORAGE_ERROR'));
  });
  it('returns settings defaults without writing; saves and reloads with revision protection', async () => {
    const storage = new MemoryStorage();
    const repo = new FoundationRepository(storage);
    expect(await repo.readSettings()).toEqual(defaultSettings());
    expect(storage.writes).toBe(0);
    const saved = await repo.saveSettings({ ...defaultSettings(), visibleDays: [6, 7], revision: 44 }, 0);
    expect(saved.revision).toBe(1);
    expect(await new FoundationRepository(storage).readSettings()).toEqual(saved);
    await expect(repo.saveSettings(defaultSettings(), 0)).rejects.toEqual(code('REVISION_CONFLICT'));
    storage.values.set('uhd.settings', { schemaVersion: 2 });
    await expect(repo.saveSettings(defaultSettings(), 1)).rejects.toEqual(code('UNSUPPORTED_VERSION'));
    expect(storage.writes).toBe(1);
  });
});
