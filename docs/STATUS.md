# Project checkpoint

Updated: 2026-10-26 (America/Chicago)

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
- **09A pending human acceptance**: Chrome/Edge end-to-end journey passed; [two-person checklist](evidence/09a-human-qa.md) prepared. [Browser evidence](evidence/09a-browser-qa.md). Neither human sign-off has been received.
- **10A complete (UI scope)**: validated session-only profile-link drafts and seven explicitly synthetic rating states. [Verification and screenshots](evidence/10a-professor-preview.md). Live ratings and saved associations remain unavailable.
- **11A complete (fixture scope)**: accessible inline badge, guarded profile navigation and synthetic enrollment-control isolation checks. [Evidence](evidence/11a-professor-badges.md). No live portal injection.
- **01B partial screenshot evidence; live inspection pending**: [portal map](evidence/portal-map.md) records the Shopping Cart structure and absent visible Enroll action. Registration-not-open is user-reported; DOM, submission sequence and G1 remain unverified.
- **02B independent research complete; portal-specific review pending**: [RMP source decision](evidence/rmp-source.md) retains links with live retrieval blocked; [preliminary timers](evidence/timing-report.md) retain all 84 measured trials. No live ratings or enrollment/timing gate passed.
- **10B fallback complete; live provider/cache blocked**: validated authenticated lookup returns provider-unconfigured with no network/storage access. Existing manual profile links remain the fallback. [Evidence](evidence/10b-provider-fallback.md). G2 is not passed.
- Public repo: https://github.com/Pavi21P/uhd-student-extension. Foundation tasks 03A (`cffda38`) and 03B (`b4ea551`) are included in the 2026-10-22 main-branch publication, retaining their original author dates and history. Published `feat/05a-course-editor` at `5635520` includes 04A (`871beb4`) and 05A (`823f33f`). 05B (`2517dc1`) is published on `feat/05b-meeting-validation`, based on that branch. [Pull request #1](https://github.com/Pavi21P/uhd-student-extension/pull/1) includes 04A/05A/05B and is open for review. `main` remains at `a29eea5`; no merge is included.

## Active work

| Owner | Task | State | Next action |
| --- | --- | --- | --- |
| A / Codex | 04B CI portion | Verified and published | PR #14 open; Windows/Linux checks passed. Portal fixture portion still depends on 01B. |
| B / teammate | 01B | Reassigned to Codex by user | No live inspection findings supplied; prior work preserved. |

## Decisions to retain

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
4. Collaboration: teammate GitHub username needed before an invitation; project license still undecided. Shared contracts and foundation need teammate review.

## Latest handoff

- Task / owner: **04B CI portion / Codex**, selected under the user's instruction to continue without browser access. Plan explicitly separates this portion from the 01B-dependent portal harness; existing 01B notes preserved.
- Changed: Windows/Linux PR workflow, README and contributor commands, plan split and [CI evidence](evidence/04b-ci.md). No application code, dependencies, manifest or permissions changed.
- Passed: local lint, 297 tests across 15 files, TypeScript, production/MV3 checks and diff whitespace check. Hosted clean installs and all workflow steps passed on Ubuntu 24.04 and Windows 2025 in [run 40443205744](https://github.com/Pavi21P/uhd-student-extension/actions/runs/40443205744) at implementation commit 649082b; [PR #14](https://github.com/Pavi21P/uhd-student-extension/pull/14) is open against feat/10b-provider-fallback. No merge.
- Remaining: 04B observed portal harness, 01B DOM/submission evidence, permitted live ratings source and both 09A human QA results. Browser access is still unavailable.
- Next browser-independent candidate: maintained extension-only E2E portion of 09B, using existing synthetic behavior after CI verification; explicitly preserve the outstanding portal harness dependency. No merge or release.

Read linked evidence for details; do not replay the full history.
