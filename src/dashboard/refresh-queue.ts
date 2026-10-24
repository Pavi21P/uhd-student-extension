/** Coalesce invalidations, never overlap reads, and wait for the UI to commit before draining again. */
export function createRefreshQueue(read: () => Promise<void>, blocked: () => boolean, settled: () => void) {
  let pending = false; let running = false; let disposed = false;
  const wake = () => {
    if (disposed || running || !pending || blocked()) return;
    pending = false; running = true;
    // The consumer reports read failures in its existing recovery UI. No automatic retry.
    void Promise.resolve().then(() => { if (!disposed) return read(); }).catch(() => {}).finally(() => {
      running = false;
      if (!disposed) settled();
    });
  };
  return { request: () => { pending = true; wake(); }, wake, dispose: () => { disposed = true; pending = false; } };
}
