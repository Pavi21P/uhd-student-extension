/** 02B research fixture only. No portal access, clicks, storage or enrollment execution. */
export interface TimingTrialOptions { delayMs: number; stallMs: number; clockShiftMs: number }
export interface TimingTrial {
  armedEpochMs: number; targetEpochMs: number; callbackEpochMs: number;
  elapsedMs: number; latenessMs: number; clockSkewMs: number;
  visibilityAtArm: DocumentVisibilityState; visibilityAtCallback: DocumentVisibilityState;
  outcome: 'observed' | 'expired' | 'needs-review'; markerCount: number;
}
export function runTimingTrial(options: TimingTrialOptions): Promise<TimingTrial> {
  const { delayMs, stallMs, clockShiftMs } = options;
  if (!Number.isInteger(delayMs) || delayMs < 50 || delayMs > 5000
    || !Number.isInteger(stallMs) || stallMs < 0 || stallMs > 5000
    || !Number.isInteger(clockShiftMs) || Math.abs(clockShiftMs) > 10000) throw Error('Invalid diagnostic trial options');
  const armedEpochMs = Date.now(), started = performance.now(), targetEpochMs = armedEpochMs + delayMs;
  const visibilityAtArm = document.visibilityState;
  return new Promise(resolve => {
    let markerCount = 0;
    function tick() {
      const elapsedMs = performance.now() - started;
      // Offset is a fixture input: never changes the computer or browser clock.
      const callbackEpochMs = Date.now() + clockShiftMs;
      const clockSkewMs = callbackEpochMs - armedEpochMs - elapsedMs;
      const latenessMs = callbackEpochMs - targetEpochMs;
      let outcome: TimingTrial['outcome'];
      if (Math.abs(clockSkewMs) > 250 || visibilityAtArm !== 'visible' || document.visibilityState !== 'visible') outcome = 'needs-review';
      else if (latenessMs > 2000) outcome = 'expired';
      else if (latenessMs >= 0) { outcome = 'observed'; markerCount++; }
      else { setTimeout(tick, Math.max(1, Math.min(50, -latenessMs))); return; }
      resolve({ armedEpochMs, targetEpochMs, callbackEpochMs, elapsedMs, latenessMs, clockSkewMs, visibilityAtArm, visibilityAtCallback: document.visibilityState, outcome, markerCount });
    }
    setTimeout(tick, delayMs);
    // Deliberate, bounded fault injection in this disposable test page only.
    // This is NOT a waiting strategy for the extension's eventual executor.
    if (stallMs) { const until = performance.now() + stallMs; while (performance.now() < until) { /* Block this test page's event loop. */ } }
  });
}
