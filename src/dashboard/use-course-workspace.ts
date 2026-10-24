import { useCallback, useEffect, useRef, useState } from 'react';
import { createFoundationClient } from '../shared/client';
import type { CourseCard, Schedule } from '../shared/domain';
import { ContractFault } from '../shared/validation';
import { draftMeeting, parseMeetingDrafts, type MeetingDraft, type MeetingErrors } from './meeting-model';
import { changeCourse, emptySchedule, primaryScheduleId, type CourseChange } from './course-model';

const client = createFoundationClient();
const explanation = (error: unknown) => error instanceof ContractFault ? error.detail.message : 'Could not connect to local storage.';

/** Lives above route views so moving between tabs does not discard an editor draft. */
export function useCourseWorkspace() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [draft, setDraft] = useState<CourseCard | null>(null);
  const [meetingDrafts, setMeetingDrafts] = useState<MeetingDraft[]>([]);
  const [meetingErrors, setMeetingErrors] = useState<MeetingErrors>({});
  const [newCourse, setNewCourse] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState('Loading saved courses…');
  const [error, setError] = useState('');
  const origin = useRef<HTMLElement | null>(null);

  const load = useCallback(async (reviewDraft = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) throw new ContractFault('TRANSPORT_ERROR', 'Load the built extension in Chrome or Edge to save courses. The web preview has no extension storage.');
      const reply = await client('schedule.read', { scheduleId: primaryScheduleId });
      if (!reply.ok && reply.error.code !== 'NOT_FOUND') throw new ContractFault(reply.error.code, reply.error.message);
      setSchedule(reply.ok ? reply.data : null); setReady(true); setRecovery(false); setReview(reviewDraft);
      setError(''); setMessage(reviewDraft ? 'Latest saved courses loaded. Review your draft before saving again.' : reply.ok ? 'Saved courses loaded.' : 'No courses yet. Add your first course.');
    } catch (failure) {
      setRecovery(true); setError(explanation(failure)); setMessage(reviewDraft ? 'Could not load saved courses. Your draft is still here.' : 'Could not load saved courses.');
    } finally { lock.current = false; setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!draft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft]);

  function close() {
    if (lock.current) return;
    setDraft(null); setReview(false); setMeetingDrafts([]); setMeetingErrors({});
    if (recovery) setMessage('Save not confirmed. Reload saved courses before editing again.');
    else { setError(''); setMessage(schedule ? 'Saved locally.' : 'No courses yet. Add your first course.'); }
    queueMicrotask(() => {
      const target = origin.current?.isConnected && !origin.current.matches(':disabled') ? origin.current
        : document.getElementById('reload-courses') ?? document.querySelector<HTMLElement>('#add-course:not(:disabled)') ?? document.getElementById('main');
      target?.focus();
    });
  }
  async function persist(change: CourseChange, closeAfter: boolean) {
    if (lock.current || !ready || recovery || review) return;
    let next: Schedule;
    try { next = changeCourse(schedule ?? emptySchedule(), change); }
    catch (failure) { setError(explanation(failure)); return; }
    lock.current = true; setBusy(true); setError(''); setMessage('Saving…');
    try {
      const reply = await client('schedule.save', { expectedRevision: schedule?.revision ?? null, schedule: next });
      if (!reply.ok) throw new ContractFault(reply.error.code, reply.error.message);
      setSchedule(reply.data); setNewCourse(false);
      if (closeAfter) { lock.current = false; close(); }
      setMessage('Saved locally.');
    } catch (failure) {
      setRecovery(true); setError(explanation(failure));
      setMessage('Could not confirm the save. Reload saved courses before trying again. Your draft is kept.');
    } finally { lock.current = false; setBusy(false); }
  }
  function add(trigger: HTMLElement) {
    if (lock.current || draft || busy || !ready || recovery) return;
    const course = { id: crypto.randomUUID() };
    origin.current = trigger; setDraft(course); setNewCourse(true); setMeetingDrafts([]); setMeetingErrors({});
    void persist({ kind: 'add', course }, false);
  }
  function edit(course: CourseCard, trigger: HTMLElement) {
    if (lock.current || draft || busy || recovery) return;
    origin.current = trigger; setDraft({ ...course }); setMeetingDrafts((schedule?.meetings ?? []).filter(meeting => meeting.courseId === course.id).map(draftMeeting)); setMeetingErrors({}); setNewCourse(false); setError('');
  }
  const savedCourse = schedule?.courses.find(course => course.id === draft?.id);
  return { schedule, ready, busy, draft, meetingDrafts, meetingErrors, newCourse, savedCourse, recovery, review, message, error,
    setDraft: (next: CourseCard) => {
      setDraft(next);
      if (!recovery && !review) { setError(''); setMessage('Unsaved changes. Save course to keep them.'); }
    },
    setMeetings: (next: MeetingDraft[]) => {
      setMeetingDrafts(next); setMeetingErrors({});
      if (!recovery && !review) { setError(''); setMessage('Unsaved changes. Save course to keep them.'); }
    }, add, edit, close,
    reload: () => { void load(!!draft); },
    acceptReview: () => { setReview(false); setError(''); setMessage('Draft kept. Save when you are ready.'); },
    save: () => {
      if (!draft || (!savedCourse && !newCourse)) return;
      const parsed = parseMeetingDrafts(draft.id, meetingDrafts);
      if (!parsed.ok) { setMeetingErrors(parsed.errors); setMessage('Check the meeting times below. Nothing was saved.'); return; }
      setMeetingErrors({});
      void persist({ kind: savedCourse ? 'edit' : 'add', course: draft, meetings: parsed.meetings }, true);
    },
    remove: () => { if (draft) void persist({ kind: 'delete', courseId: draft.id }, true); },
  };
}
export type CourseWorkspace = ReturnType<typeof useCourseWorkspace>;
