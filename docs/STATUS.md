# Project checkpoint

Updated: 2026-10-31 (America/Chicago)

## Current state

- **01A complete**: [UI specification](UI_SPEC.md); teammate review pending.
- **02A complete**: [shared contracts](CONTRACTS.md), TypeScript records/messages and synthetic examples.
- **03A complete**: loadable MV3 extension, working popup launcher, static dashboard preview, pinned toolchain and reproducible build. [Verification and screenshots](evidence/03a-foundation.md).
- **03B complete**: schedule/settings runtime validation, serialized revision-protected local storage, authenticated worker messages and typed client. [Verification](evidence/03b-storage-messaging.md). 05A now connects the editor; 06B now refreshes dashboard consumers from storage invalidations.
- **04B CI portion verified and published**: [PR #14](https://github.com/Pavi21P/uhd-student-extension/pull/14), [workflow evidence](evidence/04b-ci.md). Windows/Linux clean-install CI and local checks passed. Portal fixture harness remains dependent on 01B; full 04B is incomplete.
- **04A complete**: dashboard destination navigation, keyboard/focus/history behavior, and the live planner link. [Verification and screenshots](evidence/04a-navigation-planner.md). 06A now connects the weekly grid and view settings; 10A now adds the Professors profile preview; live ratings and Enrollment remain unavailable. 10B now returns provider-unconfigured for validated lookup; reserved association/enrollment commands still return FEATURE_UNAVAILABLE without execution.
- **05A complete**: blank course cards, optional-field editor, delete/cancel and revision-aware local persistence. [Verification and screenshots](evidence/05a-course-editor.md).
- **05B complete**: exact meeting-time validation and deterministic overlap detection, with 45 new acceptance tests. [Verification](evidence/05b-meeting-validation.md). 06A now consumes these helpers in the meeting form and weekly grid.
- **06A complete**: manual meeting rows, exact weekly placement, overlap warnings, full-detail list and saved visible days/hours. [Verification and screenshots](evidence/06a-weekly-grid.md).
- **06B complete**: queued cross-tab refresh, preserved raw drafts with explicit review, missed-event catch-up and non-destructive read recovery. [Verification and screenshots](evidence/06b-cross-view-recovery.md).
- **07A complete**: native drag placement, per-occurrence move/resize, 15-minute snapping and keyboard/exact-form proposals with explicit Save/Cancel. [Verification and screenshots](evidence/07a-meeting-drag.md).
- **07B complete**: timetable-only JSON downloads, strict file validation, reviewed merge/replace and atomic revision-protected import. [Verification and screenshots](evidence/07b-timetable-backup.md).
- **08A complete**: readable overlap columns, clearer labels/contrast and a full-detail list shortcut. [Verification and screenshots](evidence/08a-timetable-readability.md).
- **08B complete**: 15 data-loss regressions for save/import races, uncertain writes/replies, limits and imported recurrence. [Verification](evidence/08b-timetable-regressions.md).
- **09B extension-only portion verified and published**: maintained `test:e2e` journey and Windows/Linux CI wiring; [evidence](evidence/09b-extension-e2e.md). Local Chromium and hosted Windows/Linux checks passed; [PR #15](https://github.com/Pavi21P/uhd-student-extension/pull/15) is open. Portal loading still depends on 01B/04B, so full 09B remains incomplete.
- **09A pending human acceptance**: Chrome/Edge end-to-end journey passed; [two-person checklist](evidence/09a-human-qa.md) prepared. [Browser evidence](evidence/09a-browser-qa.md). Neither human sign-off has been received.
- **10A complete (UI scope)**: validated session-only profile-link drafts and seven explicitly synthetic rating states. [Verification and screenshots](evidence/10a-professor-preview.md). Live ratings and saved associations remain unavailable.
- **11A complete (fixture scope)**: accessible inline badge, guarded profile navigation and synthetic enrollment-control isolation checks. [Evidence](evidence/11a-professor-badges.md). No live portal injection.
- **01B partial screenshot evidence; live inspection pending**: [portal map](evidence/portal-map.md) records the Shopping Cart structure and absent visible Enroll action. Registration-not-open is user-reported; DOM, submission sequence and G1 remain unverified.
- **02B independent research complete; portal-specific review pending**: [RMP source decision](evidence/rmp-source.md) retains links with live retrieval blocked; [preliminary timers](evidence/timing-report.md) retain all 84 measured trials. No live ratings or enrollment/timing gate passed.
- **10B fallback complete; live provider/cache blocked**: validated authenticated lookup returns provider-unconfigured with no network/storage access. Existing manual profile links remain the fallback. [Evidence](evidence/10b-provider-fallback.md). G2 is not passed.
- **14A timing-validation portion verified and published**: standalone validator and 76 boundary cases; [evidence](evidence/14a-timing-validation.md). Local and hosted Windows/Linux 373-test/build/E2E checks passed; [PR #16](https://github.com/Pavi21P/uhd-student-extension/pull/16) is open. UI, review and activation remain blocked on 01B; full 14A is incomplete.
- **14B pure lifecycle portion verified and published**: 63 new cases; [evidence](evidence/14b-job-transitions.md). Local and hosted Windows/Linux checks passed; [PR #17](https://github.com/Pavi21P/uhd-student-extension/pull/17) is open. Durable ownership, persistence and portal execution remain incomplete.
- **14B stored-record validation verified and published**: strict saved review/job parser and 96 synthetic cases; [evidence](evidence/14b-stored-records.md). Local and hosted Windows/Linux checks passed; [PR #18](https://github.com/Pavi21P/uhd-student-extension/pull/18) is open. Persistence, ownership and portal integration remain incomplete.
- **14B internal job repository verified and published**: versioned persistence, serialized revisions and explicit recovery with 36 synthetic cases; [evidence](evidence/14b-job-repository.md). Local and hosted Windows/Linux checks passed; [PR #19](https://github.com/Pavi21P/uhd-student-extension/pull/19) is open. No runtime integration or enrollment execution.
- **14B activation deduplication verified and published**: atomic request/job records, current-state replay and explicit v1 migration with 42 new cases; [evidence](evidence/14b-activation-deduplication.md). Local and hosted Windows/Linux checks passed; [PR #20](https://github.com/Pavi21P/uhd-student-extension/pull/20) is open. No public activation or dispatch.
- **14B executor-report ownership checks verified and published**: guarded acknowledgment entrypoint, explicit adapter policy and 59 new synthetic cases; [evidence](evidence/14b-executor-ownership.md). Local and hosted Windows/Linux 669-test/build/E2E checks passed; [PR #21](https://github.com/Pavi21P/uhd-student-extension/pull/21) is open. No live enrollment enabled.
- **14B outstanding executor registry verified and published**: persistent registration, single-use consumption, recovery abandonment and v3 migration with 44 new synthetic cases; [evidence](evidence/14b-executor-requests.md). Local and hosted Windows/Linux 713-test/build/E2E checks passed; [PR #22](https://github.com/Pavi21P/uhd-student-extension/pull/22) is open. No live enrollment enabled.
- **14B complete executor replies verified and published**: strict full-message parsing, saved-request-derived events, safe error/unknown handling and normalized evidence; [evidence](evidence/14b-executor-replies.md). Local and hosted Windows/Linux 741-test/build/E2E checks passed. Pushed directly to work/solo-development; no new PR. No live enrollment enabled.
- **14B final outcome reconciliation locally verified**: atomic final states, missing-result unknowns and guarded saved-evidence recovery with 41 new cases; [evidence](evidence/14b-final-results.md). Local 782-test/build/E2E checks passed; hosted CI pending. No live enrollment enabled.
- Public repo: https://github.com/Pavi21P/uhd-student-extension. Foundation tasks 03A (`cffda38`) and 03B (`b4ea551`) are included in the 2026-10-22 main-branch publication, retaining their original author dates and history. Published `feat/05a-course-editor` at `5635520` includes 04A (`871beb4`) and 05A (`823f33f`). 05B (`2517dc1`) is published on `feat/05b-meeting-validation`, based on that branch. [Pull request #1](https://github.com/Pavi21P/uhd-student-extension/pull/1) includes 04A/05A/05B and is open for review. `main` remains at `a29eea5`; no merge is included.

## Active work

| Owner | Task | State | Next action |
| --- | --- | --- | --- |
| A / Codex | 14B final outcome reconciliation | Locally verified; publishing | Push work/solo-development and verify CI without a PR. |
| B / former teammate | 01B | No longer participating (user, 2026-10-30) | Prior work preserved; Codex owns implementation. Live inspection evidence remains unavailable. |

## Decisions to retain

- Solo workflow from 2026-10-30: no new pull requests. Commit and push work/solo-development; existing PRs remain unchanged. No main-branch merge or release is included.

- Chrome/Edge desktop; Manifest V3 + React + TypeScript + Vite + plain CSS. TypeScript retained to reuse existing contracts and browser APIs.
- Full dashboard for timetable; small launcher popup. Local data first; no backend/accounts/analytics required.
- User confirmed myUHD; pressing the extension enrollment button must select reviewed boxes AND submit. Support immediate execution and explicitly armed future execution.
- Link to https://uhd-course-planner.pages.dev; keep that project separate. 04A verified the live planner opens in Chrome/Edge (HTTP 200). Saves remain separate.
- Manual initially blank course cards are required: professor top left, title center, room bottom left. Progress pie optional.
- Reuse [DESIGN.md](../DESIGN.md) and [design references](DESIGN_GUIDANCE.md): Taste app-screen and Impeccable Operate guidance applied. Browser screenshots inspected; vendor toolkits were not executed.
- Prior research read the inspiration post; local MP4 playback remains unverified.

## Blocking questions and dependencies

1. RMP: permitted working source for live ratings. Links/mocks do not complete it.
2. Portal: supported page/frame, checkbox semantics, confirmation sequence and result signals.
3. Timing: measured supported-browser behavior; no exact-second guarantee.
4. Project license remains undecided. Teammate invitations/review are no longer development dependencies; human acceptance evidence is still outstanding.

## Latest handoff

- Task / owner: **14B final outcome reconciliation / Codex**, solo development without connected browser access.
- Changed: shared result classification, atomic reply finalization, guarded explicit/startup reconciliation, uncertainty/provenance checks, 41 new cases and [evidence](evidence/14b-final-results.md). No new PR or live dispatch.
- Passed: targeted 208 result/reply/ownership/registry/repository cases; final lint, 782 tests across 24 files, TypeScript and production/MV3 build. Isolated Chromium 156.0.8078.4 extension E2E passed (9.9 seconds total), with one expected result and zero failures, skips or flaky results. Hosted Windows/Linux CI pending.
- Remaining: safe dashboard response projection, trusted browser metadata, durable dispatch coordination, production storage/recovery/RPC wiring, review UI, portal evidence/harness, live ratings and human acceptance. Synthetic results do not prove live enrollment.
- Next independent candidate: **14B safe EnrollmentJobView projection and response validation**, excluding execution tokens, internal reviews and request metadata. Keep activation/dispatch disabled and retain the observed portal/adapter requirement. Continue direct commits/pushes on work/solo-development without new PRs. No merge or release.

Read linked evidence for details; do not replay the full history.
