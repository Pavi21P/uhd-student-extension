# Project checkpoint

Updated: 2026-10-23 (America/Chicago)

## Current state

- **01A complete**: [UI specification](UI_SPEC.md); teammate review pending.
- **02A complete**: [shared contracts](CONTRACTS.md), TypeScript records/messages and synthetic examples.
- **03A complete**: loadable MV3 extension, working popup launcher, static dashboard preview, pinned toolchain and reproducible build. [Verification and screenshots](evidence/03a-foundation.md).
- **03B complete**: schedule/settings runtime validation, serialized revision-protected local storage, authenticated worker messages and typed client. [Verification](evidence/03b-storage-messaging.md). 05A now connects the editor; continuous UI storage subscriptions remain 06B.
- **04A complete**: dashboard destination navigation, keyboard/focus/history behavior, and the live planner link. [Verification and screenshots](evidence/04a-navigation-planner.md). The weekly grid remains a preview; Professors, Enrollment and Settings explain their unavailable features. Reserved commands still return FEATURE_UNAVAILABLE without execution.
- **05A complete**: blank course cards, optional-field editor, delete/cancel and revision-aware local persistence. [Verification and screenshots](evidence/05a-course-editor.md).
- **05B complete**: exact meeting-time validation and deterministic overlap detection, with 45 new acceptance tests. [Verification](evidence/05b-meeting-validation.md). Helpers are ready for 06A; no meeting UI is connected yet.
- Public repo: https://github.com/Pavi21P/uhd-student-extension. Foundation tasks 03A (`cffda38`) and 03B (`b4ea551`) are included in the 2026-10-22 main-branch publication, retaining their original author dates and history. Published `feat/05a-course-editor` at `5635520` includes 04A (`871beb4`) and 05A (`823f33f`). Current 05B is on `feat/05b-meeting-validation`, based on that branch, prepared for the requested commit/push and pull-request review. `main` remains at `a29eea5`; no merge is included.

## Active work

| Owner | Task | State | Next action |
| --- | --- | --- | --- |
| A / Pavitra | 05B | Complete; ready for review | Next ready task is 06A weekly grid and manual placement. |
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

- Task / owner: **05B / A**, complete on `feat/05b-meeting-validation`. User requested continuation and commits; branch publication/review is the next Git action. B's 01B assignment is unchanged.
- Changed: `src/shared/meeting-time.ts`, 45 acceptance tests, contract-consumer guidance, README test count and [evidence](evidence/05b-meeting-validation.md). No UI, existing validator, stored record, RPC, dependency or permission changes.
- Passed: targeted **45 tests**; full **140 tests**, lint, strict typecheck, production build/artifact checks. Boundary/adjacency/recurrence cases, independent occupancy oracle and 1000-meeting capacity checked.
- Limits: helpers are not yet connected to UI, so no new browser behavior or visual QA is claimed. Grid placement, continuous two-view refresh, imports, ratings, settings controls and enrollment remain unfinished. Existing RMP/portal/timing blockers are unchanged.
- Next ready task: **06A**, weekly grid and manual meeting placement, now unblocked by 05A/05B. Use exact wall-time parsing and derived conflict warnings; allow valid overlaps. Stop after 05B.

Read the linked evidence for details; do not replay the full history.
