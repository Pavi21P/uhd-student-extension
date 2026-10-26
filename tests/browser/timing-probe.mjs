// 02B preliminary measurements; not an enrollment executor or a release timing gate.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const channel = process.argv[2] || 'chrome';
assert(['chrome', 'msedge'].includes(channel));
const out = '.local/qa'; await mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const ignoredFlags = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
let browser, context;
const report = { channel, measuredAt: new Date().toISOString(), platform: os.platform(), osRelease: os.release(), architecture: os.arch(), mode: 'headless isolated ordinary page; no extension installed', ignoredDefaultArgs: ignoredFlags, scenarios: [], errors: [], requestsOutsideFixture: [] };
const scenarios = [
  { name: 'idle-visible-document', trials: 30, delayMs: 150, stallMs: 0, clockShiftMs: 0 },
  { name: 'blocked-event-loop-1300ms', trials: 3, delayMs: 150, stallMs: 1300, clockShiftMs: 0 },
  { name: 'blocked-event-loop-2400ms', trials: 3, delayMs: 150, stallMs: 2400, clockShiftMs: 0 },
  { name: 'simulated-clock-forward-5000ms', trials: 3, delayMs: 150, stallMs: 0, clockShiftMs: 5000 },
  { name: 'simulated-clock-backward-5000ms', trials: 3, delayMs: 150, stallMs: 0, clockShiftMs: -5000 },
];
function summarize(trials) {
  const sorted = trials.map(t => t.latenessMs).sort((a,b) => a-b);
  return { count: trials.length, medianLatenessMs: (sorted[Math.floor((sorted.length-1)/2)] + sorted[Math.ceil((sorted.length-1)/2)]) / 2,
    p95LatenessMs: sorted[Math.ceil(sorted.length * 0.95)-1], maxLatenessMs: sorted.at(-1),
    missedOneSecondWindow: trials.filter(t => t.latenessMs > 1000).map(t => t.trial),
    observed: trials.filter(t => t.outcome === 'observed').length, expired: trials.filter(t => t.outcome === 'expired').length,
    needsReview: trials.filter(t => t.outcome === 'needs-review').length, markerCount: trials.reduce((n,t) => n+t.markerCount,0) };
}
try {
  browser = await chromium.launch({ channel, headless: true, ignoreDefaultArgs: ignoredFlags });
  report.version = browser.version();
  const cdp = await browser.newBrowserCDPSession();
  report.activeThrottlingOverrideFlags = (await cdp.send('Browser.getBrowserCommandLine')).arguments.filter(value => ignoredFlags.includes(value));
  assert.deepEqual(report.activeThrottlingOverrideFlags, []);
  context = await browser.newContext();
  const base = server.resolvedUrls.local[0];
  await context.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    report.requestsOutsideFixture.push(route.request().url().split('?')[0]); return route.abort();
  });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(base + 'tests/fixtures/timing-probe.html');
  // Import/warm up before measuring. Preserve the warmup separately, outside the 30-trial set.
  report.warmup = await page.evaluate(async () => (await import('/tests/fixtures/timing-probe.ts')).runTimingTrial({ delayMs: 150, stallMs: 0, clockShiftMs: 0 }));
  for (const scenario of scenarios) {
    const record = { ...scenario, trials: [] }; report.scenarios.push(record);
    for (let index=0; index<scenario.trials; index++) {
      const trial = await page.evaluate(async options => (await import('/tests/fixtures/timing-probe.ts')).runTimingTrial(options), { delayMs: scenario.delayMs, stallMs: scenario.stallMs, clockShiftMs: scenario.clockShiftMs });
      record.trials.push({ trial: index+1, ...trial });
      assert(Number.isFinite(trial.latenessMs)); assert(trial.markerCount <= 1);
      if (trial.outcome !== 'observed') assert.equal(trial.markerCount, 0);
      else { assert(trial.latenessMs >= 0 && trial.latenessMs <= 2000); assert.equal(trial.markerCount, 1); }
      if (scenario.clockShiftMs) assert.equal(trial.outcome, 'needs-review');
      if (scenario.stallMs === 2400) assert.notEqual(trial.outcome, 'observed');
    }
    record.summary = summarize(record.trials); console.log(JSON.stringify({ channel, scenario: scenario.name, ...record.summary }));
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.requestsOutsideFixture, []);
  // Misses are retained, not retried or excluded. ok reports harness integrity, not G3 readiness.
  report.ok = true;
} catch(error) { report.failure = error.stack; throw error; }
finally { await writeFile(out + '/02b-' + channel + '-timing.json', JSON.stringify(report,null,2)); await context?.close(); await browser?.close(); await server.close(); }
