# 02B preliminary browser timing report

Measured 2026-10-25. **Independent timer research complete; G3/G4 remain pending.** This measures diagnostic callbacks in an ordinary isolated page. It does not measure enrollment submission, portal acceptance, a content script, service-worker scheduling or a packaged extension.

## Conditions and method

- OS: win32, kernel 10.0.19045, x64. Chrome 156.0.8078.47; Edge 156.0.4314.42. Node/npm remain pinned in README.
- Headless browsers, fresh isolated contexts, no installed extension, local Vite fixture. Browser runs were sequential, with no concurrent build or other measured-browser run. Other host processes/power conditions were not controlled.
- Document visibility values actually reported: visible. A headless document reporting visible is not a verified foreground window or a test of the student's final-countdown conditions.
- Playwright defaults that disable background timer throttling, renderer backgrounding and occluded-window backgrounding were removed. Browser command-line verification found none of those overrides active. This still does not establish realistic hidden-tab behavior.
- Each trial uses an absolute Date.now target 150 ms after arming, schedules a timeout, and compares wall-clock elapsed time with performance.now. A separately recorded warmup precedes 30 idle trials and four groups of three fault trials per browser: **84 measured trials plus two warmups** total.
- Timer callbacks increment only a local diagnostic marker. They never select a checkbox, submit, fetch a provider, contact myUHD or write extension state. The fixture is outside the production bundle and does not add permissions.
- Diagnostic guards: lateness over the plan's proposed 2,000 ms cutoff is expired; absolute wall/monotonic discrepancy over 250 ms or observed nonvisible state needs review. These are prototype policies, not validated production thresholds. The clock-shift input changes a fixture-local reading only, never the machine clock.
- Deliberate stalls block this disposable page's event loop for 1,300 or 2,400 ms. The bounded busy loop is fault injection, not a waiting strategy for an enrollment executor. Clock scenarios inject +5,000 or -5,000 ms offsets.

Lateness = callback wall time minus target epoch. Median is the middle value (mean of the two middle values for even counts); p95 is nearest rank, ceil(0.95*n). Every trial and miss is retained; no retry or selective rerun was used to improve these results. With three fault trials, p95 is simply the maximum.

## Observations

| Browser | Scenario | Trials | Median late ms | p95 late ms | Max late ms | Over 1,000 ms | Marker observed | Expired |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chrome | idle-visible-document | 30 | 5 | 8 | 15 | 0 | 30 | 0 |
| chrome | blocked-event-loop-1300ms | 3 | 1150 | 1151 | 1151 | 3 | 3 | 0 |
| chrome | blocked-event-loop-2400ms | 3 | 2250 | 2250 | 2250 | 3 | 0 | 3 |
| msedge | idle-visible-document | 30 | 5 | 9 | 15 | 0 | 30 | 0 |
| msedge | blocked-event-loop-1300ms | 3 | 1150 | 1151 | 1151 | 3 | 3 | 0 |
| msedge | blocked-event-loop-2400ms | 3 | 2250 | 2250 | 2250 | 3 | 0 | 3 |

Both idle runs had zero misses of the one-second callback target. The 1,300 ms stall caused every trial to miss that target while still falling inside the proposed two-second cutoff. This distinction matters: the cutoff is not a promise to meet the target. The 2,400 ms stall expired every trial without a marker.

| Browser | Simulated clock change | Trials | Needs review | Markers |
| --- | --- | ---: | ---: | ---: |
| chrome | simulated-clock-forward-5000ms | 3 | 3 | 0 |
| chrome | simulated-clock-backward-5000ms | 3 | 3 | 0 |
| msedge | simulated-clock-forward-5000ms | 3 | 3 | 0 |
| msedge | simulated-clock-backward-5000ms | 3 | 3 | 0 |

Clock-scenario wall lateness includes the injected offset and is not physical callback delay; it is intentionally omitted from the latency table. Both directions stopped the marker. These are injected discrepancies, not observations of actual OS sleep or clock adjustment. The single-call marker check is not proof of duplicate-message or multi-executor protection.

Raw evidence: [Chrome](02b-chrome-timing.json), [Edge](02b-msedge-timing.json). Each includes browser version, requested conditions, every target/callback epoch, elapsed time, skew, visibility, outcome, marker count and summaries. ok=true means the harness assertions and external-request isolation passed, not that G3 passed.

## Source checks

[Chrome's alarms documentation](https://developer.chrome.com/docs/extensions/reference/api/alarms) allows delayed firing and distinguishes unpacked behavior from the usual minimum alarm interval. Alarms remain a proposed reminder/recovery mechanism, not the precision trigger. No alarms API behavior was measured in this probe.

[Chrome's service-worker lifecycle documentation](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) describes worker termination and loss of global state. This ordinary page test does not justify moving job ownership into an unpersisted worker timer.

[MDN's timeout documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#late_timeouts) explains late callbacks when the thread is busy and throttling in inactive tabs. The stall results support keeping deadline checks at execution time; they cannot predict portal/server latency.

## Reproduce and validation

Run npm ci with the pinned Node/npm versions. With Playwright available to Node and Chrome/Edge installed, run these **sequentially**:

~~~sh
node tests/browser/timing-probe.mjs chrome
node tests/browser/timing-probe.mjs msedge
~~~

Set PLAYWRIGHT_MODULE_PATH to an external Playwright module directory if it is not on Node's module path. The runner starts/stops a localhost Vite server and isolated browser; raw results go to ignored .local/qa. No dependency is installed automatically. It intentionally stalls its own test page briefly; do not adapt it to a signed-in portal.

npm run check passed after adding the fixture/runner: lint, 266 tests in 14 files, strict TypeScript, production build and MV3 checks. Both browser harness runs completed without page errors or outside-fixture requests. No product UI changed and no visual audit is claimed.

## Remaining evidence and handoff

Unmeasured: actual foreground/background windows, long countdowns, OS sleep/resume, browser restart, navigation/document replacement, real clock changes, extension worker termination, alarms, unpacked/package/store differences, simultaneous executors, cancellation, select-and-submit dispatch, network/server latency and authoritative outcomes. The 30 idle trials are preliminary callbacks, not the plan's final 30-trial synthetic submission test.

02B's independent source/timer slice is complete. Portal-specific assumptions remain pending 01B; G1/G2/G3/G4 do not pass from this report. Keep enrollment unavailable. The next ready project action remains the teammate's [01B inspection checklist](01b-inspection-checklist.md); later 14B/15B/16B/17A tasks own execution, interruption and end-to-end timing evidence.
