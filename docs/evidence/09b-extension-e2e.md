# 09B: maintained extension-only E2E

Date: 2026-10-26 (America/Chicago). Owner: Codex. This implements the extension-only portion under the user's instruction to continue without connected browser access. Completed 04B CI and 08B regressions are its prerequisites; observed portal loading still depends on unfinished 01B/04B. Full 09B and 09A human acceptance are not complete.

## Implementation

- `npm run test:e2e` runs `tests/e2e/timetable.spec.ts` against the existing production `dist` build. README documents the install/build/run sequence.
- Playwright Test 1.64.1 is an exact development dependency with lockfile integrity. Its bundled Chromium runs headless in a fresh test-output profile, never the user's signed-in profile. The test closes and relaunches the process with that same isolated profile to verify persistence.
- `playwright.config.ts` sets one worker, no retries, bounded test/expect/global timeouts, and list/JSON reports. `vitest.config.ts` limits unit discovery to existing `.test.ts` files so the E2E spec is not executed by Vitest. Both configs and the new test are linted/typechecked.
- Each existing Windows/Linux CI job installs Chromium and runs the smoke test after the verified build. There is no private profile, custom credential or myUHD connection in this workflow. Outputs remain ignored under test-results; no screenshot or trace publication was added.

## Acceptance journey

1. Open the actual popup page and use its launcher; create a blank saved course, cancel its editor and reload with optional fields still absent.
2. Save synthetic course details and two exact-minute meetings; check persisted records and visible grid occurrences.
3. Cancel a keyboard move without writes, then save it and verify only the selected occurrence changed.
4. Reject an invalid end time while preserving both draft and saved state; correct it and save the shared room.
5. Download a real JSON backup containing exact meetings and a second blank course, excluding settings and planner state.
6. Reopen the dashboard, close/relaunch the browser process, and reload again; persisted timetable must match exactly and remain visible.
7. Validate the exported backup through the import UI; cancelling must not change stored data.
8. Open Planner by keyboard in a separate tab against an intercepted synthetic target, check no opener, and return with unchanged timetable. Fail for unexpected HTTP requests from test pages or page errors.

All input is invented. The planner navigation is intercepted, not a live availability check. The test uses real extension storage and worker messaging through the built UI; storage reads verify results without seeding or mutating saved state from the runner. It does not exercise a personal session, toolbar rendering, Chrome/Edge branded acceptance, real portal controls, live RMP, suspension timing, or the two human sign-offs.

## Verification

- Local Windows: lint, 297 unit tests across 15 files, TypeScript, Vite and MV3 checks passed. Final lint passed without warnings after using Playwright's explicit fixture parameter.
- Local E2E: Chromium 156.0.8078.4, Playwright 1.64.1; 1 journey / 8 steps passed in 15.0 seconds total, zero skipped/flaky/unexpected tests and no runner errors. Includes a real browser-process restart; it does not establish a service-worker suspension test.
- Hosted Ubuntu 24.04 and Windows 2025: **all checks passed**, including clean installs, lint, 297 unit tests, TypeScript/MV3 build, Chromium installation, the eight-step E2E journey and unchanged dependency files. [Run 40444104134](https://github.com/Pavi21P/uhd-student-extension/actions/runs/40444104134) tested implementation commit `f0e673c825638ed7be5cd63025ab7a750f6449ff` through the pull-request event. [PR #15](https://github.com/Pavi21P/uhd-student-extension/pull/15) targets `ci/04b-checks`; subsequent handoff-only edits preserve the tested implementation. No merge.
- Documentation and staged diff reviewed; private captures and generated browser/report files excluded.

## Sources and handoff

The [official Playwright extension guide](https://playwright.dev/docs/chrome-extensions) supplies the persistent bundled-Chromium loading approach, and the [official CI guide](https://playwright.dev/docs/ci-intro) supplies browser/system dependency installation. The existing 09A synthetic QA journey supplied the app-specific regression steps; 09A remains pending human acceptance.

Next action: review the PR and complete the existing 09A human checklist against the current build. Resume the remaining 09B portal-loading portion only after 01B observations support 04B fixtures. No application feature, portal selector, permission, merge, alpha tag or release is added here.
