# Project checkpoint

Updated: 2026-10-24 (America/Chicago)

## Current state

- **01A complete**: [UI specification](UI_SPEC.md); teammate review pending.
- **02A complete**: [shared contracts](CONTRACTS.md), TypeScript records/messages and synthetic examples.
- **03A complete**: loadable MV3 extension, working popup launcher, static dashboard preview, pinned toolchain and reproducible build. [Verification and screenshots](evidence/03a-foundation.md).
- **03B complete**: schedule/settings runtime validation, serialized revision-protected local storage, authenticated worker messages and typed client. [Verification](evidence/03b-storage-messaging.md). 05A now connects the editor; continuous UI storage subscriptions remain 06B.
- **04A complete**: dashboard destination navigation, keyboard/focus/history behavior, and the live planner link. [Verification and screenshots](evidence/04a-navigation-planner.md). 06A now connects the weekly grid and view settings; Professors and Enrollment explain their unavailable features. Reserved commands still return FEATURE_UNAVAILABLE without execution.
- **05A complete**: blank course cards, optional-field editor, delete/cancel and revision-aware local persistence. [Verification and screenshots](evidence/05a-course-editor.md).
- **05B complete**: exact meeting-time validation and deterministic overlap detection, with 45 new acceptance tests. [Verification](evidence/05b-meeting-validation.md). 06A now consumes these helpers in the meeting form and weekly grid.
- **06A complete**: manual meeting rows, exact weekly placement, overlap warnings, full-detail list and saved visible days/hours. [Verification and screenshots](evidence/06a-weekly-grid.md).
- Public repo: https://github.com/Pavi21P/uhd-student-extension. Foundation tasks 03A (`cffda38`) and 03B (`b4ea551`) are included in the 2026-10-22 main-branch publication, retaining their original author dates and history. Published `feat/05a-course-editor` at `5635520` includes 04A (`871beb4`) and 05A (`823f33f`). 05B (`2517dc1`) is published on `feat/05b-meeting-validation`, based on that branch. [Pull request #1](https://github.com/Pavi21P/uhd-student-extension/pull/1) includes 04A/05A/05B and is open for review. `main` remains at `a29eea5`; no merge is included.

## Active work

| Owner | Task | State | Next action |
| --- | --- | --- | --- |
| A / Pavitra | 06A | Complete | Pushed in PR #2, based on PR #1; review and merge pending. Next ready: 06B. |
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

- Task / owner: **06A / A**, complete on `feat/06a-weekly-grid`, stacked on the open [PR #1](https://github.com/Pavi21P/uhd-student-extension/pull/1). Implementation commit `6352da4` is pushed in [PR #2](https://github.com/Pavi21P/uhd-student-extension/pull/2), based on `feat/05b-meeting-validation`. GitHub source and PR head were verified. Review/merge #1 first, then retarget #2 to main; no merge performed. B's 01B assignment is unchanged.
- Changed: meeting form/model, exact grid geometry and accessible list, view-settings form/state, course transaction wiring, popup copy, styles, 11 acceptance tests and [evidence](evidence/06a-weekly-grid.md). Stored schema, RPC, dependencies and permissions are unchanged.
- Passed: **151 tests**, lint, strict typecheck, production build/artifact validation; Chrome and Edge unpacked-extension checks for exact placement, recurrence, overlap/adjacency, settings persistence, restart, stale writes and uncertain-save recovery. Responsive bounds, keyboard scrolling and actual 200% tab zoom checked.
- Limits: no live portal/RMP, screen-reader audit or vendor toolkit execution. Dragging, automatic cross-view refresh, imports and enrollment remain unfinished. Human review and merge are pending.
- Next ready task: **06B**, complete remaining bad-data recovery and two-view update handling on the existing 03B repository. Reuse serialized writes and revision guards; do not rebuild the foundation. Stop after 06A.

Read the linked evidence for details; do not replay the full history.
