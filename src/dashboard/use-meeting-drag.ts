import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { DayOfWeek, Meeting, Schedule, DisplaySettings } from '../shared/domain';
import { ContractFault } from '../shared/validation';
import { meetingLabel } from './meeting-model';
import { minuteScale, type WeekView } from './grid-layout';
import { proposePlacement, type PlacementKind } from './placement-model';
import type { CourseWorkspace } from './use-course-workspace';
import type { ViewSettings } from './use-view-settings';
interface DragSource { kind: PlacementKind; meeting: Meeting; schedule: Schedule; settings: DisplaySettings; offset: number; trigger: HTMLElement }
export function useMeetingDrag(model: CourseWorkspace, view: ViewSettings) {
  const source = useRef<DragSource | null>(null);
  const [preview, setPreview] = useState<Meeting | null>(null);
  const [message, setMessage] = useState('');
  const disabled = model.transferOpen || !!model.draft || model.busy || model.recovery || !model.schedule || !view.ready || view.busy || view.recovery;
  function cancel(text = 'Drag cancelled. Nothing was saved.') {
    if (source.current) { source.current = null; setPreview(null); setMessage(text); }
  }
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    const outside = (event: globalThis.DragEvent) => { if (!(event.target instanceof Element) || !event.target.closest('[data-day]')) setPreview(null); };
    window.addEventListener('keydown', escape); window.addEventListener('dragover', outside);
    return () => { source.current = null; window.removeEventListener('keydown', escape); window.removeEventListener('dragover', outside); };
  }, []);
  useEffect(() => { if (!source.current) setMessage(''); }, [model.draft?.id]);
  function begin(event: DragEvent<HTMLElement>, kind: PlacementKind, courseId: string, meeting?: Meeting, offset = 0) {
    if (disabled) { event.preventDefault(); return; }
    const value = meeting ?? { id: crypto.randomUUID(), courseId, dayOfWeek: 1, startMinute: 0, endMinute: 60 };
    source.current = { kind, meeting: value, schedule: model.schedule!, settings: view.settings, offset, trigger: event.currentTarget };
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'UHD timetable meeting');
    setPreview(null); setMessage(kind === 'resize' ? 'Drag the end handle within this day. Escape cancels.' : 'Drop on a day to propose a time. Escape cancels.');
  }
  function target(event: DragEvent<HTMLElement>, day: DayOfWeek, shown: WeekView) {
    const active = source.current;
    if (!active) return null; // Never import external drag payloads or another tab's drag.
    if (disabled || active.schedule !== model.schedule || active.settings !== view.settings) {
      cancel('Timetable or view changed. Start the drag again. Nothing was saved.'); return null;
    }
    const minute = shown.startMinute + (event.clientY - event.currentTarget.getBoundingClientRect().top) / minuteScale(shown);
    try { return proposePlacement(active.kind, active.meeting, day, minute - (active.kind === 'move' ? active.offset : 0)); }
    catch (failure) { setPreview(null); setMessage(failure instanceof ContractFault ? failure.detail.message : 'Choose a valid meeting time.'); return null; }
  }
  function over(event: DragEvent<HTMLElement>, day: DayOfWeek, shown: WeekView) {
    const proposed = target(event, day, shown); if (!proposed) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setPreview(proposed);
    setMessage('Proposed ' + meetingLabel(proposed) + ' (' + (proposed.endMinute - proposed.startMinute) + ' minutes). Drop to review before saving.');
    const scroll = event.currentTarget.closest('.calendar-scroll');
    if (scroll) {
      const rect = scroll.getBoundingClientRect();
      scroll.scrollBy(event.clientX > rect.right - 24 ? 24 : event.clientX < rect.left + 24 ? -24 : 0,
        event.clientY > rect.bottom - 32 ? 24 : event.clientY < rect.top + 58 ? -24 : 0);
    }
  }
  function drop(event: DragEvent<HTMLElement>, day: DayOfWeek, shown: WeekView) {
    const proposed = target(event, day, shown); const active = source.current;
    if (!proposed || !active) return;
    event.preventDefault(); source.current = null; setPreview(null);
    const accepted = model.propose(active.kind, proposed, active.schedule.revision, active.trigger);
    setMessage(accepted ? 'Proposed times are in the course editor. Save course to confirm, or Cancel.' : 'This proposal was not applied. Review the timetable message.');
  }
  function keyboard(event: KeyboardEvent<HTMLElement>, meeting: Meeting, shown: WeekView, resize = false) {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const sizing = resize || event.shiftKey;
    if (sizing && !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    let day = meeting.dayOfWeek; let minute = sizing ? meeting.endMinute : meeting.startMinute;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const index = shown.visibleDays.indexOf(day) + (event.key === 'ArrowLeft' ? -1 : 1);
      const next = shown.visibleDays[index]; if (!next) { setMessage('No visible day in that direction. Use the meeting form for other days.'); return; }
      day = next;
    } else minute = event.key === 'ArrowUp' ? (Math.ceil(minute / 15) - 1) * 15 : (Math.floor(minute / 15) + 1) * 15;
    const proposed = proposePlacement(sizing ? 'resize' : 'move', meeting, day, minute, false);
    model.propose(sizing ? 'resize' : 'move', proposed, model.schedule!.revision, event.currentTarget);
  }
  return { preview, message, disabled, begin, over, drop, keyboard, end: () => cancel() };
}
export type MeetingDrag = ReturnType<typeof useMeetingDrag>;
