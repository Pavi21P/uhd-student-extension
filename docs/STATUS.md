# Project checkpoint

Updated: 2026-10-23 (America/Chicago)

## Current state

- **01A complete**: [UI specification](UI_SPEC.md); teammate review pending.
- **02A complete**: [shared contracts](CONTRACTS.md), TypeScript records/messages and synthetic examples.
- **03A complete**: loadable MV3 extension, working popup launcher, static dashboard preview, pinned toolchain and reproducible build. [Verification and screenshots](evidence/03a-foundation.md).
- **03B complete**: schedule/settings runtime validation, serialized revision-protected local storage, authenticated worker messages and typed client. [Verification](evidence/03b-storage-messaging.md). 05A now connects the editor; continuous UI storage subscriptions remain 06B.
- **04A complete**: dashboard destination navigation, keyboard/focus/history behavior, and the live planner link. [Verification and screenshots](evidence/04a-navigation-planner.md). The weekly grid remains a preview; Professors, Enrollment and Settings explain their unavailable features. Reserved commands still return FEATURE_UNAVAILABLE without execution.
- **05A complete**: blank course cards, optional-field editor, delete/cancel and revision-aware local persistence. [Verification and screenshots](evidence/05a-course-editor.md).
- Public repo: https://github.com/Pavi21P/uhd-student-extension. Foundation tasks 03A (`cffda38`) and 03B (`b4ea551`) are included in the 2026-10-22 main-branch publication, retaining their original author dates and history. 04A (`871beb4`) and current 05A are local on `feat/05a-course-editor`, based on published `a29eea5`; not pushed.

## Active work

| Owner | Task | State | Next action |
| --- | --- | --- | --- |
| A / Pavitra | 05A | Complete locally | Ready for review; next ready task is 05B meeting/time validation. |
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

- Task / owner: **05A / A**, complete locally on `feat/05a-course-editor`; not pushed. B's 01B assignment is unchanged.
- Changed: course transaction model, persistent editor state, Timetable view, responsive CourseEditor, popup copy/styles, five unit tests, documentation and screenshot evidence. No new dependencies, permissions, shared schema/RPC or background changes.
- Passed: **95 unit tests**, lint, strict typecheck, production build/artifact checks; Chrome 156.0.8078.47 and Edge 155.0.4283.62 synthetic browser flows for blank/edit/cancel/delete, restart persistence, two-window conflicts/deletion, failed or uncertain saves, focus and responsive layout.
- Visual inspection: desktop editor, narrow modal/cards, conflict review and popup. Taste/Impeccable reference guidance applied; vendor scripts, manual toolbar zoom, screen-reader and live portal tests not run.
- Limits: weekly grid/meeting editing, continuous two-view refresh, imports, ratings, settings controls and enrollment remain unfinished. RMP source and portal/timing evidence blockers above are unchanged.
- Next ready task: **05B**, meeting/time validation and interval collision logic. Then 06A can connect manual meeting placement. Stop after 05A; see [evidence](evidence/05a-course-editor.md) for reproduction and limits.

Read the linked evidence for details; do not replay the full history.
