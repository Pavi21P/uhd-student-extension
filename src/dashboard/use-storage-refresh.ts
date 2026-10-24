import { useEffect, useRef, useState } from 'react';
import { createRefreshQueue } from './refresh-queue';

/** Storage events are invalidations only; data always comes through validated worker RPC. */
export function useStorageRefresh(key: string, refresh: () => Promise<void>, blocked: () => boolean) {
  const latest = useRef({ refresh, blocked }); latest.current = { refresh, blocked };
  const queue = useRef<ReturnType<typeof createRefreshQueue> | null>(null);
  const [, settled] = useState(0);
  useEffect(() => {
    const current = createRefreshQueue(() => latest.current.refresh(), () => latest.current.blocked(), () => settled(value => value + 1));
    queue.current = current;
    const changed = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && Object.hasOwn(changes, key)) current.request();
    };
    const visible = () => { if (document.visibilityState === 'visible') current.request(); };
    const refresh = () => current.request();
    const storage = typeof chrome !== 'undefined' ? chrome.storage?.onChanged : undefined;
    storage?.addListener(changed);
    window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      current.dispose(); queue.current = null; storage?.removeListener(changed);
      window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [key]);
  // Run after committed state, including the successful reply to our own write.
  useEffect(() => { queue.current?.wake(); });
}
