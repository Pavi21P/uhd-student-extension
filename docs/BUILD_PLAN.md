# UHD Student Extension — build plan

Planning baseline: 2026-10-20. Owners: **A = Pavitra**, **B = teammate**, interchangeable by agreement. Status and the next task live in [STATUS.md](STATUS.md); GitHub workflow lives in [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. Scope and completion rules

Build a desktop Chrome/Edge Manifest V3 extension for UHD students. Deliver in small milestones: useful planning tools first, connected professor ratings next, tested enrollment assistance afterward. Keep the progress chart optional.

| Feature | Required behavior | Completion evidence |
| --- | --- | --- |
| RMP | Student can associate an RMP profile with a UHD professor and quickly view ratings; show inline on supported myUHD professor rows. | Working permitted data source, correct identity mapping, rating count/source/freshness, no-result and ambiguous-match behavior. |
| Planner | Dedicated Planner tab opens the existing course planner. | Correct live URL opens from the loaded extension; no copied academic logic. |
| Timetable | Create blank cards, enter details, and place them on a weekly timesheet. | Editing, dragging, recurring days, collisions, reload persistence, and keyboard placement work. |
| Enrollment | Student chooses sections, then presses the extension button to select their boxes and submit now or at a scheduled time. | Observed myUHD compatibility, one-shot execution, result verification, cancellation, failure handling, and timing evidence. |
| Progress | Optional pie showing completed and remaining courses. | Explicit denominator, duplicate/zero handling, accessible numeric summary. |

**Do not mark the whole project finished if RMP only opens links or enrollment only sends a reminder.** Those can be honest intermediate releases. If a gate cannot be passed, keep that feature blocked and report the remaining scope.

Out of initial scope: BYU support, other universities, automatic schedule optimization, section sorting, grade prediction, accounts/cloud sync, a backend, mobile browsers, degree-audit certification, and rebuilding the planner. These can become separate issues after the core release.

## 2. Screens and user flows

### Launcher and dashboard

The toolbar popup shows quick actions and opens a full extension dashboard. Use a full page for the timetable so closing the popup does not lose work or act as the job runner.

Dashboard tabs: **Timetable | Professors | Planner | Enrollment | Settings**. Add **Progress** only when its optional milestone is implemented.

### Timetable

1. Press Add course to create a blank card in an Unscheduled tray. No course number, name, professor, or room is required to create it.
2. Edit title, optional course code, professor, room, color, and meeting times. Blank text displays a placeholder without inventing course data.
3. Drag onto a day/time cell or use an accessible day/start/end form. Snap to 15-minute grid increments by default; allow exact times in the editor.
4. Allow multiple meetings per course, such as Monday/Wednesday lecture plus a separate Friday lab. Editing course text updates all occurrences; deleting one meeting does not delete the course.
5. Drag to move and resize duration, with equivalent form controls. Start before end; no silent wrapping into another day. Overnight classes are deferred and explicitly rejected initially.
6. Display overlaps without hiding either card. Warn but allow them; do not automatically choose classes for the student.
7. Persist after changes. Provide JSON backup/import with validation and an explicit replace/merge choice; never silently overwrite an existing schedule.

```text
+-----------------------------------+
| Professor name                    |
|                                   |
|            Course name            |
|                                   |
| Room number           10:00–11:15  |
+-----------------------------------+
```

Default view: Monday–Friday, 7 a.m.–10 p.m.; settings reveal weekends and extend hours. Keep unscheduled/online asynchronous courses in the tray. These are adjustable product defaults, not academic restrictions. Use the planner's simple cards, borders, and restrained colors as visual inspiration.

### Professors and RMP

1. Detect instructor names only on explicitly supported myUHD pages, or let the student type a name in the Professors tab.
2. Accept a valid RMP professor profile URL as a manual association. Validate the URL host/path; never fetch arbitrary pasted URLs.
3. Match on school plus name and, where available, department. Preserve accents/hyphens, normalize spacing, handle initials, multiple instructors, and `Staff`/`TBA`.
4. If candidates are ambiguous, ask the student to choose. Never silently attach another school's rating.
5. Show overall rating, review count, source profile, and checked date. Difficulty or would-take-again fields are optional only if actually supplied. Missing is not zero.
6. Distinguish verified-source values, stale cached values, loading, no match, no reviews, and provider unavailable. Student-entered notes are personal notes, not verified ratings.
7. Inline badges must survive page rerenders without duplication or changing portal form behavior. Offer direct profile navigation on failures.

Start with a provider interface and synthetic records. Complete task 02B before selecting a live retrieval implementation. Link-only mode can ship early, but the ratings requirement stays open until live retrieval works.

### Planner

Show an Open course planner action on the Planner tab using `https://uhd-course-planner.pages.dev`. Open it in a regular browser tab, not an iframe. Saved planner state remains with that site. Import/sync is a separate future feature; do not read unrelated browsing data to simulate integration.

### Enrollment: confirmed user intent

The student presses a button **inside the extension**. That action authorizes the reviewed selection-and-submission sequence. Default mode is Enroll now; choosing Schedule changes the button to Schedule enrollment and displays the exact target date, time, seconds, and zone.

1. Student logs into myUHD normally and opens the supported enrollment/shopping-cart page.
2. Read eligible visible rows; student selects desired section IDs. Show term, subject/number, section, instructor/time where present, and the current checkbox state.
3. Review the exact selection. Other preselected courses must be explicitly included or deselected with the student's knowledge; stop if the final checked set differs from the reviewed set.
4. Student chooses Now or a future date/time. Default zone is `America/Chicago`; store the resolved epoch and zone. Reject past times and ambiguous/nonexistent daylight-saving inputs until resolved.
5. Pressing Enroll now runs preflight and executes. Pressing Schedule enrollment stores a one-shot job and arms the same sequence for that time. Show Cancel and an observable armed status.
6. Preflight checks the specific tab/frame, supported URL, term, exact section identities, login state, expected page version/state, available controls, and any visible enrollment restrictions. The portal remains authoritative about eligibility.
7. At execution, re-read the page; check only the reviewed course boxes that are not already selected. Confirm the final selection and click the supported submit control. Handle a known confirmation step only if it still matches the exact reviewed operation. Unexpected dialogs stop the sequence.
8. Read each section's result. Distinguish enrolled, waitlisted, rejected/full, and unknown. A successful click or HTTP response is not proof of enrollment.
9. Save a short local result. Do not retry unknown submissions automatically; require the student to inspect myUHD first.

The actual selectors, confirmation sequence, and whether scripted clicks are accepted must be established on the real portal. Do not invent API endpoints, bypass login/CAPTCHA/queues, or run enrollment requests in a tight retry loop.

## 3. Architecture and contracts

Proposed stack: **Manifest V3, React, TypeScript, Vite**, plain CSS, extension storage, Vitest for domain/adapter tests, and Playwright for synthetic browser flows. Pin compatible stable versions and a supported Node LTS during 03A, then commit one lockfile. Avoid adding a framework or server for one feature. Use CSS Grid for the timetable; React Flow is unnecessary for this layout.

```text
Popup -> Dashboard -> typed messages -> Background service worker
                  |                         |
                  +-> timetable state       +-> storage / job coordination
                                            +-> permitted RMP provider
                                            +-> myUHD content script
                                                -> page adapter / inline badges
                                                -> armed one-shot executor
```

Proposed source layout, created incrementally rather than as empty scaffolding:

```text
src/popup/                  toolbar launcher
src/dashboard/              tab shell and settings
src/features/timetable/     cards, grid, placement, collisions
src/features/professors/    search, association, badges
src/features/enrollment/    review, scheduling, outcomes
src/background/             coordination and alarms
src/content/myuhd/          page detection and DOM adapter
src/adapters/rmp/           provider boundary and permitted retrieval
src/shared/                 types, validation, messages, storage
tests/unit/                 domain and state-machine tests
tests/fixtures/             synthetic portal pages and provider replies
tests/e2e/                  extension and fixture integration
public/                     manifest/icons as build design requires
docs/evidence/              short feasibility/QA records
```

Agree on these contracts in 02A/03B before parallel feature work:

| Record | Minimum fields / invariants |
| --- | --- |
| CourseCard | Generated `id`; optional title, courseCode, professorName, room, color; never key by name. |
| Meeting | `id`, `courseId`, dayOfWeek, startMinute, endMinute; valid bounds and positive duration. |
| Schedule | `id`, label, termLabel, timezone, courses, meetings, schemaVersion, revision. |
| ProfessorAssociation | School ID, normalized instructor key, verified profile URL/ID, matching method; editable by user. |
| RatingSnapshot | Provider, professor ID, nullable rating/review count, sourceUrl, fetchedAt, provenance/status. |
| EnrollmentJob | `id`, execution token, target tab/frame/document, term, section IDs, reviewed selection fingerprint, target epoch/zone, expiration, state, result. |
| Message | Explicit type and validated payload; check sender/host/frame. No arbitrary selector, script, or URL execution messages. |

Use one serialized background writer for state mutations to avoid lost updates across dashboard/content-script contexts. Persist schema versions and validate imports; support recoverable migration/backup instead of silent resets. Restrict sensitive job storage from unnecessary content-script access. Never store login credentials.

Permissions are incremental: `storage` first; `alarms` for scheduled reminders/recovery; add narrow portal host access and `scripting` only as the injection approach requires. Notifications are optional. Confirm actual portal and frame origins in 01B; do not request `<all_urls>`. An ordinary planner link does not need permission to read the planner site. RMP host access depends on the selected provider strategy. Bundle executable code locally; no remote script loading.

## 4. Enrollment reliability design and gates

### Job lifecycle

`draft -> armed -> preflight -> executing -> succeeded | partial | failed | unknown`

`armed -> cancelled | expired | needs-review` on user cancellation, missed timing, tab/page changes, or lost context. Browser restart/reload disarms jobs pending explicit review. A stale stored job must never unexpectedly submit later.

- One active executor owns a job token. Repeated messages/button presses cannot trigger another submission.
- Persist the execution transition before DOM submission. If a crash occurs around submission, classify it as unknown and reconcile from visible portal results; do not try again automatically.
- Cancel works before the submit boundary. Once a submission is sent, the UI must explain it cannot undo registration; never auto-drop courses as rollback.
- Invalidate on tab navigation, session expiry, changed term, changed selected section set, unknown portal state, or revoked permission. Multiple portal tabs cannot independently run the same job.

### Timing approach

Use Chrome alarms for advance reminders and recovery checks. They are not the exact-time trigger. Investigate an armed executor in the supported, open portal document that compares against an absolute target time and performs one bounded action when due. Avoid countdown decrement drift and continuous busy loops.

Proposed supported condition: computer awake, browser running, logged-in portal tab open and foreground during the final countdown. At arm time, explain these requirements. Detect observed sleep/clock jumps, missed deadlines, and page changes; expire or require review. Default proposed late cutoff: 2 seconds, configurable only after evidence. Missing the window is preferable to an unexpected late submission, but this policy must be visible to the student.

Engineering target for the active-tab prototype: local submit dispatch within 1 second after the target in 30 synthetic trials, reporting median, p95, maximum, and every miss. This is a test target, not a claim about portal acceptance or a seat guarantee. Record queue/network/server delay separately when observable. Do not require 30 actual enrollments.

Test both development mode and the intended packaged/distributed installation route because alarms differ in unpacked mode. If packaged testing is unavailable, mark that evidence missing rather than claiming release readiness. If browser conditions cannot meet the needed timing, keep the precision feature experimental/blocked; do not mask that by calling reminders equivalent.

### Gates

| Gate | Required evidence | If blocked |
| --- | --- | --- |
| G1 Portal | Exact supported page/frame, safe stable identifiers, synthetic fixture, known confirmation and result states; portal usage constraints checked. | Continue timetable/planner; no live enrollment compatibility claim. |
| G2 RMP | Permitted live source and working verified professor match. | Offer profile links; keep live ratings task open. |
| G3 Timing | Measured timing and interruption behavior under documented conditions. | Keep scheduled execution disabled/experimental; immediate mode still needs G4. |
| G4 Submit | One-shot selection/submission, no duplicates, per-section outcomes, stale/unknown behavior; real portal acceptance of scripted interaction verified in an appropriate user-authorized session. | Synthetic prototype only; no production enrollment claim. |
| G5 Release | Passing build/tests, permission/privacy review, browser smoke tests, accurate release notes and recovery instructions. | Remain a development build. |

## 5. Twenty paired workdays

Each cell is a task/issue with its own acceptance check. Estimate 1–3 focused hours per person per workday, approximately 40–120 combined person-hours across 20 days. Portal/provider access and store review can extend elapsed time. Do not force completion to match a date. Dependencies listed as prior tasks must be merged first; parallel work uses agreed contracts and synthetic fixtures.

### Phase 0 — feasibility and shared decisions (days 1–2)

| Day | A: interface / planning | B: integrations / research | Merge checkpoint |
| --- | --- | --- | --- |
| 1 | **01A**: Agree screen map, card layout, required/deferred features and ownership. Done: one short UI spec covers blank cards, planner link, professors, and enrollment review. | **01B**: Inspect myUHD with the student; map page/frame origins, course IDs, checkboxes, submit/confirm/results. Build an anonymized state inventory. Done: `portal-map.md` separates observed facts from unknowns. | User flow and portal map recorded. Do not save raw student data. |
| 2 | **02A**: Define data/message contracts and card interactions. Depends 01A. Done: examples cover blank cards, recurring meetings, and exact enrollment selections. | **02B**: Investigate permitted RMP access and a small browser timing prototype. Depends 01B for portal-specific assumptions. Done: source decision with blocker/fallback plus measured preliminary timer behavior; no claim of live integration. | G1/G2 preliminary decision. Assign contract owner before coding. |

### Phase 1 — extension foundation (days 3–4)

| Day | A | B | Merge checkpoint |
| --- | --- | --- | --- |
| 3 | **03A**: Create build, manifest, dashboard and launcher; pin toolchain/lockfile. Depends 02A. Done: clean install/build yields a loadable MV3 extension. | **03B**: Implement shared validation, storage and typed message contracts after 03A bootstrap. Depends 02A/03A. Done: save/reload and malformed-message rejection demonstrated with small domain tests. | Unpacked Chrome/Edge smoke test; no broad site access. |
| 4 | **04A**: Add dashboard tabs and working Planner action. Depends 03A. Done: existing live planner opens and navigation is keyboard usable. | **04B**: Add CI, documented development commands and synthetic portal fixture harness. Depends 03A/03B and 01B. Done: CI runs typecheck/lint/test/build on a PR; fixtures contain no private data. | First useful shell; clean-clone instructions verified. |

### Phase 2 — timetable MVP (days 5–9)

| Day | A | B | Merge checkpoint |
| --- | --- | --- | --- |
| 5 | **05A**: Blank card editor and Unscheduled tray. Depends 03B/04A. Done: specified professor/title/room positions, blank creation, edit/delete with persistence. | **05B**: Meeting/time validation and interval collision logic. Depends 03B. Done: same-day overlap, adjacent classes, invalid/zero durations, and recurring occurrences covered. | Card/meeting contracts remain consistent. |
| 6 | **06A**: Weekly grid and manual placement form. Depends 05A/05B. Done: timed height/position and adjustable days/hours render correctly. | **06B**: Versioned schedule repository and serialized writes. Depends 03B/05B. Done: restart restoration, bad data recovery, and two-view update handling. | Schedule survives reload without lost edits. |
| 7 | **07A**: Drag/move/resize with keyboard/form alternatives. Depends 06A. Done: snapping and exact form times agree, one occurrence can move independently. | **07B**: JSON export/import with validation and replace/merge policy. Depends 06B. Done: round trip works; malformed files and ID collisions do not erase existing work. | Portable backup and usable weekly editing. |
| 8 | **08A**: Overlap layout, labels, contrast and responsive dashboard. Depends 07A/05B. Done: colliding cards remain readable; long/blank text works. | **08B**: Regression cases for storage/import/recurrence. Depends 07B. Done: tests address data-loss boundaries and real failures, not CSS snapshots. | Timetable acceptance cases pass. |
| 9 | **09A**: Browser QA and fixes for timetable/planner. Depends 08A/08B. Done: two people independently complete create/place/edit/export/reload tasks. | **09B**: Extension E2E setup and regression smoke flows. Depends 04B/08B. Done: `test:e2e` covers dashboard persistence and synthetic portal loading. | Tag an honest timetable/planner alpha after checks. |

### Phase 3 — professor integration (days 10–13)

| Day | A | B | Merge checkpoint |
| --- | --- | --- | --- |
| 10 | **10A**: Professors UI and profile association editor. Depends 04A/02A. Done: loading, ambiguous, no-match, stale and unavailable states using clearly labeled synthetic data. | **10B**: RMP provider adapter and constrained cache. Depends 02B/G2 source choice/03B. Done: permitted source returns rating/count/provenance; if unavailable, record blocker and implement only the explicit link fallback. | No fabricated numeric ratings. |
| 11 | **11A**: Accessible inline badge component and profile navigation. Depends 10A. Done: fixture shows unobtrusive badge without altering checkbox/submit behavior. | **11B**: myUHD professor extraction and identity matching. Depends 01B/10B. Done: initials, duplicate names, multiple instructors and Staff/TBA handled without false automatic matches. | Badges show identity uncertainty correctly. |
| 12 | **12A**: Wire dashboard/inline identity correction and source display. Depends 11A/11B. Done: manual correction persists and updates matching badges. | **12B**: Dynamic-page observer, cache expiry, backoff, invalidation. Depends 11B. Done: rerenders do not duplicate badges; failures do not create request floods. | G2 live integration checked, or explicitly still blocked. |
| 13 | **13A**: Cross-browser/keyboard professor QA and copy fixes. Depends 12A. Done: source/freshness/missing-data states clear. | **13B**: Adapter regression and observed portal smoke test. Depends 12B. Done: real supported rows render correctly; record date/browser and limits. | Professor beta only if G2 passes; mocks do not count. |

### Phase 4 — enrollment assistance (days 14–18)

| Day | A | B | Merge checkpoint |
| --- | --- | --- | --- |
| 14 | **14A**: Selection review, Now/Schedule controls, date/time/zone. Depends 04A/02A/01B. Done: exact term/sections/action are visible; invalid dates blocked. | **14B**: Job state machine, executor ownership, persistence. Depends 03B/01B. Done: duplicate messages, restart, cancel and stale job cases pass. | No live submission yet. |
| 15 | **15A**: Arm/cancel/countdown/result interfaces. Depends 14A/14B. Done: status stays accurate across views and shows cancel boundary. | **15B**: Synthetic select-and-submit adapter and preflight. Depends 14B/G1. Done: exact selection, already-checked rows, changed rows and unexpected confirmation cases pass. | Fixture runs the full requested sequence once. |
| 16 | **16A**: Failure/partial/unknown result and recovery UX. Depends 15A/15B. Done: no success label without section outcomes; unknown discourages retry. | **16B**: Absolute-time execution, alarm reminders, late expiration and interruption handling. Depends 15B/02B. Done: sleep/navigation/session/clock-change cases stop safely and never auto-replay. | Timing design ready for measurements. |
| 17 | **17A**: Run timed fixture trials in Chrome/Edge; record conditions and fix UI findings. Depends 16A/16B. Done: evidence includes misses, not just successful runs. | **17B**: Verify actual portal click compatibility and supported confirmation/result parsing in an appropriate student-authorized session. Depends G1/15B. Done: record real observations; if no suitable enrollment session exists, mark G4 pending. | G3/G4 decision; no unattended or fake live tests. |
| 18 | **18A**: Enrollment walkthrough, warning copy and accessibility fixes. Depends 17A. Done: both teammates can explain arming, requirements, cancel, outcomes and recovery. | **18B**: Regression matrix and packaged-install timing validation. Depends 17A/17B. Done: duplicate/restart/late/partial/unknown cases pass; unavailable release-route evidence remains flagged. | Enrollment candidate only if G3/G4 pass. |

### Phase 5 — release (days 19–20)

| Day | A | B | Merge checkpoint |
| --- | --- | --- | --- |
| 19 | **19A**: README, install guide, screenshots with invented course data, and short demo. Depends completed feature gates. Done: descriptions match implemented behavior. | **19B**: Permission, dependency, packaged-code, storage and privacy review; fix findings. Depends implemented features. Done: no credentials/private fixtures/remote executable code in release output. | G5 candidate with known limits written. |
| 20 | **20A**: Fresh install QA and two-person acceptance walkthrough. Depends 19A/19B. Done: required flows pass on supported browsers, including backup/restore. | **20B**: Reproducible release build, changelog, versioned source/archive and final checkpoint. Depends 20A. Done: remote source/asset coverage verified when published; release status reflects all gates. | v1 only when required features pass. Otherwise publish a clearly scoped alpha/beta and retain blockers. |

Day 20 creates reviewable release materials. Actual GitHub publication follows the confirmed repository settings; a store submission is an additional publishing action with its own listing/privacy requirements and external review time. A release zip is not a Chrome Web Store installation.

## 6. Optional progress chart — after core gates

Two small follow-up tasks, not hidden inside day 20:

- **O1 (A)**: Personal checklist of unique required course entries with completed/remaining status and a pie plus text counts. With zero courses, show an empty state rather than dividing by zero. Credits are a separate mode only if data supports it.
- **O2 (B)**: Define an explicit planner export/import contract if desired. Any change to the planner becomes its own separately reviewed task. A timetable alone is not a complete degree plan; label the chart as progress through the user's list, not verified graduation progress.

Deferred backlog after that: sort section views by verified rating, optimizer, timetable export image/calendar, planner course import, Firefox, additional campuses. Each needs a new scope and acceptance criteria.

## 7. Verification checklist

| Area | Required cases |
| --- | --- |
| Timetable | Blank/long names; optional code; correct card positions; recurrence; overlap versus adjacent meetings; keyboard placement; weekend view; reload; backup/import; bad data recovery. |
| RMP | Correct UHD identity; same-name ambiguity; TBA/multiple instructors; missing reviews; stale/cache expiry; unavailable provider; manual correction; duplicate-free dynamic badges. |
| Enrollment selection | Wrong term; missing/disabled row; unrelated checked row; exact reviewed set; DOM reorder; delayed render; no scripted-click support; known/unknown confirmation. |
| Enrollment lifecycle | Duplicate button/message; two tabs; worker restart; page reload/navigation; logout; permission revoke; sleep/wake; late job; clock change; cancel before/after submit. |
| Enrollment outcome | Enrolled; waitlisted; full/rejected; mixed results; timeout/unknown; no automatic retry or auto-drop. |
| Timing | Target epoch/zone; daylight-saving input; 30 active-tab synthetic trials; background/sleep interruptions; development versus distribution route; documented limits. |
| Release | Clean install/build; Chrome/Edge smoke test; minimal permissions; no private data; no remote executable code; truthful README; reproducible artifact; all core gates tracked. |

Run targeted checks during tasks and the agreed integration suite before merge/release. Avoid expensive full reruns for unchanged documentation. Test reports should include the command, outcome, browser/version where relevant, and remaining uncertainty.

## 8. How to resume without wasting context

1. Open STATUS.md and choose one ready task ID.
2. Read the corresponding phase table and only the relevant feature/contract section.
3. Check dependencies and who owns shared files; inspect current changes.
4. Implement one small task, validate it, and record evidence.
5. Update the checkpoint, commit the actual work, and hand it to the other person for review.
6. End the session with the next task ID. Do not re-plan the entire extension every day.

Use the reusable prompt in CONTRIBUTING.md. The checkpoint is the source of current progress; this plan is the source of scope and acceptance criteria.
