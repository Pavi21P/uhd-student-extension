# Project checkpoint

Updated: 2026-10-24 (America/Chicago)

## Current state

- **01A complete**: [UI specification](UI_SPEC.md); teammate review pending.
- **02A complete**: [shared contracts](CONTRACTS.md), TypeScript records/messages and synthetic examples.
- **03A complete**: loadable MV3 extension, working popup launcher, static dashboard preview, pinned toolchain and reproducible build. [Verification and screenshots](evidence/03a-foundation.md).
- **03B complete**: schedule/settings runtime validation, serialized revision-protected local storage, authenticated worker messages and typed client. [Verification](evidence/03b-storage-messaging.md). 05A now connects the editor; 06B now refreshes dashboard consumers from storage invalidations.
- **04A complete**: dashboard destination navigation, keyboard/focus/history behavior, and the live planner link. [Verification and screenshots](evidence/04a-navigation-planner.md). 06A now connects the weekly grid and view settings; Professors and Enrollment explain their unavailable features. Reserved provider/enrollment commands still return FEATURE_UNAVAILABLE without execution.
- **05A complete**: blank course cards, optional-field editor, delete/cancel and revision-aware local persistence. [Verification and screenshots](evidence/05a-course-editor.md).
- **05B complete**: exact meeting-time validation and deterministic overlap detection, with 45 new acceptance tests. [Verification](evidence/05b-meeting-validation.md). 06A now consumes these helpers in the meeting form and weekly grid.
- **06A complete**: manual meeting rows, exact weekly placement, overlap warnings, full-detail list and saved visible days/hours. [Verification and screenshots](evidence/06a-weekly-grid.md).
- **06B complete**: queued cross-tab refresh, preserved raw drafts with explicit review, missed-event catch-up and non-destructive read recovery. [Verification and screenshots](evidence/06b-cross-view-recovery.md).
- **07A complete**: native drag placement, per-occurrence move/resize, 15-minute snapping and keyboard/exact-form proposals with explicit Save/Cancel. [Verification and screenshots](evidence/07a-meeting-drag.md).
- **07B complete**: timetable-only JSON downloads, strict file validation, reviewed merge/replace and atomic revision-protected import. [Verification and screenshots](evidence/07b-timetable-backup.md).
- **08A complete**: readable overlap columns, clearer labels/contrast and a full-detail list shortcut. [Verification and screenshots](evidence/08a-timetable-readability.md).
- **08B complete**: 15 data-loss regressions for save/import races, uncertain writes/replies, limits and imported recurrence. [Verification](evidence/08b-timetable-regressions.md).
- Public repo: https://github.com/Pavi21P/uhd-student-extension. Foundation tasks 03A (`cffda38`) and 03B (`b4ea551`) are included in the 2026-10-22 main-branch publication, retaining their original author dates and history. Published `feat/05a-course-editor` at `5635520` includes 04A (`871beb4`) and 05A (`823f33f`). 05B (`2517dc1`) is published on `feat/05b-meeting-validation`, based on that branch. [Pull request #1](https://github.com/Pavi21P/uhd-student-extension/pull/1) includes 04A/05A/05B and is open for review. `main` remains at `a29eea5`; no merge is included.

## Active work

| Owner | Task | State | Next action |
| --- | --- | --- | --- |
| A / Pavitra | 08B | Complete | Published in [PR #7](https://github.com/Pavi21P/uhd-student-extension/pull/7); review pending. Next ready: 09A. |
| B / teammate | 01B | Ready | Inspect the real myUHD flow and build an anonymized portal map. |

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

- Task / owner: **08B / A**, complete on test/08b-timetable-regressions, based on [PR #6](https://github.com/Pavi21P/uhd-student-extension/pull/6). Implementation commit 151afe0 is published in [PR #7](https://github.com/Pavi21P/uhd-student-extension/pull/7), targeting feat/08a-timetable-readability. Remote commit and open PR verified; no merge performed. B's 01B assignment is unchanged.
- Changed: tests/unit/timetable-regressions.test.ts, README test count and [evidence](evidence/08b-timetable-regressions.md). Fifteen new cases cover data-loss boundaries; no production/UI/contract/dependency changes were needed.
- Passed: targeted **15 tests**, full **217 tests**, lint, strict typecheck, production build and MV3 checks. Synthetic faults exercise actual storage/RPC/mutation code; no live browser lifecycle or portal claim.
- Limits: browser UI checks were not repeated for a test-only change. Independent human QA, live RMP/enrollment and parent reviews remain pending.
- Next ready: **09A**, browser QA and fixes for timetable/planner. Completion requires two people independently completing create/place/edit/export/reload; do not substitute agent runs for that gate. Stop after 08B.

Read linked evidence for details; do not replay the full history.
