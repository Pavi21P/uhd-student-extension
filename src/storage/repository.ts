import type { DisplaySettings, Schedule, ContractErrorCode } from '../shared/domain';
import type { StateEvent } from '../shared/messages';
import { ContractFault, defaultSettings, id, parseSchedule, parseSettings, revision } from '../shared/validation';

export interface KeyValueStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}
const settingsKey = 'uhd.settings';
export const scheduleKey = (scheduleId: string) => 'uhd.schedule.' + encodeURIComponent(id(scheduleId));

/** One instance, in the background worker only. Revision checks and writes share one queue. */
export class FoundationRepository {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: KeyValueStorage, private readonly notify: (event: StateEvent) => void = () => {}) {}

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation);
    this.tail = next.catch(() => undefined); // A failed write must not poison later operations.
    return next;
  }
  private async load(key: string): Promise<unknown> {
    try { return await this.storage.get(key); }
    catch { throw new ContractFault('STORAGE_ERROR', 'Saved data could not be read. Nothing was changed.'); }
  }
  private async persist(key: string, value: Schedule | DisplaySettings, event: StateEvent): Promise<void> {
    try { await this.storage.set(key, value); }
    catch { throw new ContractFault('STORAGE_ERROR', 'The save could not be confirmed. Keep your draft and read the saved version before trying again.'); }
    // Notification loss cannot turn a committed save into a reported failure.
    try { this.notify(event); } catch { /* Readers refetch authoritative state. */ }
  }
  private stored<T>(value: unknown, parse: (value: unknown) => T): T {
    try { return parse(value); }
    catch (error) {
      if (error instanceof ContractFault && error.detail.code === 'UNSUPPORTED_VERSION') throw error;
      throw new ContractFault('STORAGE_ERROR', 'Saved data is invalid. It was left intact; no reset or replacement was attempted.');
    }
  }
  private async currentSchedule(scheduleId: string): Promise<Schedule | undefined> {
    const value = await this.load(scheduleKey(scheduleId));
    if (value === undefined) return undefined;
    const current = this.stored(value, parseSchedule);
    if (current.id !== scheduleId) throw new ContractFault('STORAGE_ERROR', 'Saved timetable identity does not match its storage key. Nothing was changed.');
    return current;
  }
  readSchedule(scheduleId: string): Promise<Schedule> {
    const validId = id(scheduleId);
    return this.serial(async () => {
      const current = await this.currentSchedule(validId);
      if (!current) throw new ContractFault('NOT_FOUND', 'This timetable has not been saved.');
      return current;
    });
  }
  saveSchedule(input: unknown, expectedRevision: number | null): Promise<Schedule> {
    const schedule = parseSchedule(input); // Fresh copy before any asynchronous work.
    if (expectedRevision !== null) revision(expectedRevision, 'expectedRevision');
    return this.serial(async () => {
      const current = await this.currentSchedule(schedule.id);
      if (expectedRevision === null ? current !== undefined : !current || current.revision !== expectedRevision) this.conflict();
      const saved: Schedule = { ...schedule, revision: current ? this.increment(current.revision) : 0 };
      await this.persist(scheduleKey(saved.id), saved, { protocolVersion: 1, type: 'schedule.changed', payload: { scheduleId: saved.id, revision: saved.revision } });
      return saved;
    });
  }
  private async currentSettings(): Promise<DisplaySettings> {
    const value = await this.load(settingsKey);
    return value === undefined ? defaultSettings() : this.stored(value, parseSettings);
  }
  readSettings(): Promise<DisplaySettings> { return this.serial(() => this.currentSettings()); }
  saveSettings(input: unknown, expectedRevision: number): Promise<DisplaySettings> {
    const settings = parseSettings(input);
    revision(expectedRevision, 'expectedRevision');
    return this.serial(async () => {
      const current = await this.currentSettings();
      if (current.revision !== expectedRevision) this.conflict();
      const saved = { ...settings, revision: this.increment(current.revision) };
      await this.persist(settingsKey, saved, { protocolVersion: 1, type: 'settings.changed', payload: { revision: saved.revision } });
      return saved;
    });
  }
  private conflict(): never {
    throw new ContractFault('REVISION_CONFLICT', 'This data changed in another view. Keep your draft and reload the saved version before saving.');
  }
  private increment(value: number): number {
    if (value === Number.MAX_SAFE_INTEGER) {
      const code: ContractErrorCode = 'STORAGE_ERROR';
      throw new ContractFault(code, 'The revision limit was reached. Saved data was left intact.');
    }
    return value + 1;
  }
}
