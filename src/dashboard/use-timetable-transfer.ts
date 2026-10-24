import { useEffect, useMemo, useRef, useState } from 'react';
import type { Schedule, TimetableBackup } from '../shared/domain';
import { backupByteLimit, buildImport, parseBackupText, serializeBackup, type ImportMode } from '../shared/timetable-backup';
import { createFoundationClient } from '../shared/client';
import { ContractFault } from '../shared/validation';
import { emptySchedule, primaryScheduleId } from './course-model';
import type { CourseWorkspace } from './use-course-workspace';
const client = createFoundationClient();
const explain = (failure: unknown) => failure instanceof ContractFault ? failure.detail.message : 'The file operation could not be completed. Saved courses were not replaced.';
export function useTimetableTransfer(model: CourseWorkspace) {
  const [backup, setBackup] = useState<TimetableBackup | null>(null);
  const [base, setBase] = useState<Schedule | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [fileName, setFileName] = useState(''); const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(false);
  const [uncertain, setUncertain] = useState(false); const [needsRefresh, setNeedsRefresh] = useState(false);
  const sequence = useRef(0); const exporting = useRef(false);
  const stale = !!backup && (needsRefresh || base !== model.schedule);
  const preview = useMemo(() => {
    if (!backup) return null;
    try { return { schedule: buildImport(base, primaryScheduleId, mode, backup), error: '' }; }
    catch (failure) { return { schedule: null, error: explain(failure) }; }
  }, [backup, base, mode]);
  useEffect(() => {
    if (!backup) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [backup]);
  useEffect(() => () => { sequence.current++; }, []);
  function reset() { sequence.current++; setBackup(null); setFileName(''); setError(''); setUncertain(false); setNeedsRefresh(false); setLoading(false); }
  function open() { reset(); setMode('merge'); setNotice(''); model.openTransfer(); }
  function close() {
    if (model.busy) return; reset(); model.closeTransfer(); setNotice('Import cancelled. Saved courses were not changed.');
    queueMicrotask(() => document.getElementById('open-import')?.focus());
  }
  async function choose(file: File) {
    const attempt = ++sequence.current; setLoading(true); setBackup(null); setError(''); setFileName(file.name); setUncertain(false); setNeedsRefresh(false);
    try {
      if (file.size > backupByteLimit) throw new ContractFault('INVALID_INPUT', 'Choose a timetable backup no larger than 1 MiB.');
      const parsed = parseBackupText(await file.text());
      if (attempt !== sequence.current) return;
      setBackup(parsed); setBase(model.schedule); setNotice('File validated. Review the import before confirming.');
    } catch (failure) { if (attempt === sequence.current) { setError(explain(failure)); setNotice('No import was applied.'); } }
    finally { if (attempt === sequence.current) setLoading(false); }
  }
  async function confirm() {
    if (!backup || !preview?.schedule || stale || loading || model.busy || model.recovery) return;
    const saved = await model.applyImport(backup, mode, base?.revision ?? null);
    if (saved) { reset(); setNotice('Import complete. Your timetable is saved locally.'); queueMicrotask(() => document.getElementById('open-import')?.focus()); }
    else { setUncertain(true); setNeedsRefresh(true); }
  }
  async function download() {
    if (exporting.current || model.busy || model.recovery || model.draft) return;
    exporting.current = true; setLoading(true); setError('');
    try {
      const reply = await client('schedule.read', { scheduleId: primaryScheduleId });
      if (!reply.ok && reply.error.code !== 'NOT_FOUND') throw new ContractFault(reply.error.code, reply.error.message);
      const text = serializeBackup(reply.ok ? reply.data : emptySchedule());
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'uhd-timetable-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      document.body.append(anchor); try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setNotice('Backup download requested. Check your browser downloads.');
    } catch (failure) { setError(explain(failure)); }
    finally { exporting.current = false; setLoading(false); }
  }
  return { backup, base, mode, fileName, error, notice, loading, uncertain, stale, preview, open, close, choose, confirm, download,
    setMode, refresh: () => { if (!model.busy && !model.recovery) { setBase(model.schedule); setNeedsRefresh(false); setError(''); } } };
}
export type TimetableTransfer = ReturnType<typeof useTimetableTransfer>;
