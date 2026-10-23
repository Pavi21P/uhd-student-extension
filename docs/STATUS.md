# Project checkpoint

Updated: 2026-10-22 (America/Chicago)

## Current state

- **01A complete**: [UI specification](UI_SPEC.md); teammate review pending.
- **02A complete**: [shared contracts](CONTRACTS.md), TypeScript records/messages and synthetic examples. Runtime validation remains 03B.
- **03A complete**: loadable MV3 extension, working popup launcher, static dashboard preview, pinned toolchain and reproducible build. [Verification and screenshots](evidence/03a-foundation.md).
- No course editing/storage, working destination tabs, live ratings or enrollment actions yet. Disabled preview controls say so.
- Public repo: https://github.com/Pavi21P/uhd-student-extension. Previously published planning/contracts checkpoint: `439d5d4` on `main`. Current foundation work is local on `feat/03a-extension-foundation`; not pushed.

## Active work

| Owner | Task | State | Next action |
| --- | --- | --- | --- |
| A / Pavitra | 03A | Complete locally | Review foundation handoff; next proposed task is 03B (shared foundation, claim ownership before editing). |
| B / teammate | 01B | Ready | Inspect the real myUHD flow and build an anonymized portal map. |

## Decisions to retain

- Chrome/Edge desktop; Manifest V3 + React + TypeScript + Vite + plain CSS. TypeScript retained to reuse existing contracts and browser APIs.
- Full dashboard for timetable; small launcher popup. Local data first; no backend/accounts/analytics required.
- User confirmed myUHD; pressing the extension enrollment button must select reviewed boxes AND submit. Support immediate execution and explicitly armed future execution.
- Link to https://uhd-course-planner.pages.dev; keep that project separate. Live planner reachability remains for 04A.
- Manual initially blank course cards are required: professor top left, title center, room bottom left. Progress pie optional.
- Reuse [DESIGN.md](../DESIGN.md) and [design references](DESIGN_GUIDANCE.md): Taste app-screen and Impeccable Operate guidance applied. Browser screenshots inspected; vendor toolkits were not executed.
- Prior research read the inspiration post; local MP4 playback remains unverified.

## Blocking questions and dependencies

1. RMP: permitted working source for live ratings. Links/mocks do not complete it.
2. Portal: supported page/frame, checkbox semantics, confirmation sequence and result signals.
3. Timing: measured supported-browser behavior; no exact-second guarantee.
4. Collaboration: teammate GitHub username needed before an invitation; project license still undecided. Shared contracts and foundation need teammate review.

## Latest handoff

- Task / owner: 03A / A (Pavitra lane), complete.
- Changed: build/toolchain and lockfile; public manifest/icons/notices; dashboard, popup and shared UI; launcher tests; PRODUCT.md, DESIGN.md, README.md, CONTRIBUTING.md, design guidance and evidence.
- Passed: clean `npm ci`; lint; 4 tests; strict typecheck; production build/artifact checks; unpacked Chrome/Edge popup-to-dashboard flow; responsive visual inspection; keyboard/reduced-motion/error-state checks. No page-access permissions requested.
- Limits: headless extension-page checks, not manual toolbar interaction; CSS 200% scale, not browser-toolbar zoom; no screen-reader audit, live portal work or teammate sign-off.
- Next ready task: **03B**, runtime validation/storage/typed message handling; coordinate the shared-file editor first. 04A is also dependency-ready, and B's 01B assignment is unchanged. Stop after one claimed task.

Read the linked evidence for detailed versions and limits; do not replay the full history.
