import type { DayOfWeek, DisplaySettings } from '../shared/domain';
import { parseMeetingTimes } from '../shared/meeting-time';
import { ContractFault, parseSettings } from '../shared/validation';
import { clockTime } from './meeting-model';
export interface ViewDraft { days: DayOfWeek[]; start: string; end: string }
export const viewDraft = (settings: DisplaySettings): ViewDraft => ({ days: [...settings.visibleDays], start: clockTime(settings.startMinute), end: clockTime(settings.endMinute) });
export function parseViewDraft(settings: DisplaySettings, draft: ViewDraft): DisplaySettings {
  if (!draft.days.length) throw new ContractFault('INVALID_INPUT', 'Choose at least one visible day.', 'settings.visibleDays');
  return parseSettings({ ...settings, visibleDays: [...draft.days].sort((a, b) => a - b), ...parseMeetingTimes(draft.start, draft.end) });
}
