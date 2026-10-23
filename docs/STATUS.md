# Project checkpoint

Updated: 2026-10-23 (America/Chicago)

## Current state

- **01A complete**: [UI specification](UI_SPEC.md); teammate review pending.
- **02A complete**: [shared contracts](CONTRACTS.md), TypeScript records/messages and synthetic examples.
- **03A complete**: loadable MV3 extension, working popup launcher, static dashboard preview, pinned toolchain and reproducible build. [Verification and screenshots](evidence/03a-foundation.md).
- **03B complete**: schedule/settings runtime validation, serialized revision-protected local storage, authenticated worker messages and typed client. [Verification](evidence/03b-storage-messaging.md). No editor or UI storage subscription is connected yet.
- **04A complete**: dashboard destination navigation, keyboard/focus/history behavior, and the live planner link. [Verification and screenshots](evidence/04a-navigation-planner.md). Timetable remains a preview; Professors, Enrollment and Settings explain their unavailable features. Reserved commands still return FEATURE_UNAVAILABLE without execution.
- Public repo: https://github.com/Pavi21P/uhd-student-extension. Foundation tasks 03A (`cffda38`) and 03B (`b4ea551`) are included in the 2026-10-22 main-branch publication, retaining their original author dates and history. Current 04A work is local on `feat/04a-dashboard-navigation`, based on published `a29eea5`; not pushed.

## Active work

| Owner | Task | State | Next action |
| --- | --- | --- | --- |
| A / Pavitra | 04A | Complete locally | Next ready task: 05A, blank course-card editor and Unscheduled tray with persistence. |
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

- Task / owner: 04A / A (Pavitra lane), complete locally. B's 01B assignment is unchanged.
- Changed: dashboard routing, Planner/unavailable views, extracted timetable preview, shared icon/styles; README, PRODUCT, DESIGN, UI spec, references, evidence and this checkpoint. No background/storage changes or new dependencies/permissions.
- Passed: existing 90 unit tests; lint; strict typecheck; production build/artifact checks. Chrome 156.0.8078.47 and Edge 155.0.4283.62 verified destination links, keyboard/focus, Back/Forward/reload, popup launcher, responsive bounds and actual live planner opening in a separate tab.
- Visual inspection: desktop and narrow Planner/unavailable views, 200% CSS layout scale and popup. No manual browser-toolbar zoom or screen-reader audit; vendor design scripts were not run.
- Limits: no course editor, UI persistence, real ratings, settings controls or enrollment execution. Planner is linked only; no copying/synchronizing its data.
- Next ready task: **05A**, initially blank course-card creation, edit/delete and persistence in the Unscheduled tray. Reuse the fixed professor/title/room layout and 03B revision-aware client. Stop after that task.

Read the linked evidence for detailed versions and limits; do not replay the full history.
