import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorageRefresh } from './use-storage-refresh';
import { createFoundationClient } from '../shared/client';
import { ContractFault, defaultSettings } from '../shared/validation';
import { parseViewDraft, viewDraft, type ViewDraft } from './view-settings-model';
const client = createFoundationClient();
export function useViewSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [draft, setDraft] = useState(() => viewDraft(defaultSettings()));
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [dirty, setDirty] = useState(false); const [recovery, setRecovery] = useState(false); const [review, setReview] = useState(false);
  const [message, setMessage] = useState('Loading view settings…');
  const [error, setError] = useState(''); const [field, setField] = useState<string | undefined>();
  const latest = useRef({ settings, dirty, ready }); latest.current = { settings, dirty, ready };
  const load = useCallback(async (keepDraft = false, background = false) => {
    if (lock.current) return; lock.current = true; setBusy(true);
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) throw new ContractFault('TRANSPORT_ERROR', 'Load the extension in Chrome or Edge to use saved view settings.');
      const reply = await client('settings.read', {});
      if (!reply.ok) throw new ContractFault(reply.error.code, reply.error.message);
      if (background && latest.current.ready && JSON.stringify(reply.data) === JSON.stringify(latest.current.settings)) return;
      if (background) keepDraft = latest.current.dirty;
      setSettings(reply.data); setReady(true); setRecovery(false); setReview(keepDraft); setError(''); setField(undefined);
      if (!keepDraft) { setDraft(viewDraft(reply.data)); setDirty(false); }
      setMessage(keepDraft ? 'Latest view settings loaded. Review before saving your changes.' : 'View settings loaded.');
    } catch (failure) {
      setRecovery(true); setError(failure instanceof ContractFault ? failure.detail.message : 'Could not load view settings.');
      setMessage('View settings could not be loaded. No saved settings were replaced.');
    } finally { lock.current = false; setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useStorageRefresh('uhd.settings', () => load(false, true), () => lock.current || busy || recovery);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save() {
    if (lock.current || !ready || recovery || review) return;
    let next;
    try { next = parseViewDraft(settings, draft); }
    catch (failure) {
      setError(failure instanceof ContractFault ? failure.detail.message : 'Check the view settings.');
      setField(failure instanceof ContractFault ? failure.detail.field : undefined); return;
    }
    lock.current = true; setBusy(true); setError(''); setField(undefined); setMessage('Saving view settings…');
    try {
      const reply = await client('settings.save', { expectedRevision: settings.revision, settings: next });
      if (!reply.ok) throw new ContractFault(reply.error.code, reply.error.message);
      setSettings(reply.data); setDraft(viewDraft(reply.data)); setDirty(false); setMessage('View settings saved locally.');
    } catch (failure) {
      setRecovery(true); setError(failure instanceof ContractFault ? failure.detail.message : 'Could not confirm the save.');
      setMessage('Save not confirmed. Your view draft is kept. Reload saved settings before trying again.');
    } finally { lock.current = false; setBusy(false); }
  }
  return { settings, draft, ready, busy, dirty, recovery, review, message, error, field, save,
    update: (next: ViewDraft) => { setDraft(next); setDirty(true); if (!recovery && !review) { setError(''); setField(undefined); setMessage('Unsaved view changes.'); } },
    reload: () => { void load(dirty); },
    acceptReview: () => { setReview(false); setMessage('View draft kept. Save when ready.'); },
    cancel: () => { if (lock.current) return; setDraft(viewDraft(settings)); setDirty(false); setReview(false); setField(undefined);
      if (!recovery) { setError(''); setMessage('Unsaved view changes discarded.'); }
      else setMessage('Save not confirmed. Reload saved settings before editing again.'); },
  };
}
export type ViewSettings = ReturnType<typeof useViewSettings>;
