# Project checkpoint

Updated: 2026-10-22 (America/Chicago)

## Current state

- **01A complete**: [UI specification](UI_SPEC.md); teammate review pending.
- **02A complete**: [shared contracts](CONTRACTS.md), TypeScript records/messages and synthetic examples.
- **03A complete**: loadable MV3 extension, working popup launcher, static dashboard preview, pinned toolchain and reproducible build. [Verification and screenshots](evidence/03a-foundation.md).
- **03B complete**: schedule/settings runtime validation, serialized revision-protected local storage, authenticated worker messages and typed client. [Verification](evidence/03b-storage-messaging.md). The dashboard is still a static preview; no editor or UI storage subscription is connected yet.
- No working destination tabs, live ratings or enrollment actions yet. Reserved feature commands return FEATURE_UNAVAILABLE without execution.
- Public repo: https://github.com/Pavi21P/uhd-student-extension. Previously published planning/contracts checkpoint: `439d5d4` on `main`. 03A is local commit `cffda38`. Current 03B work is local on `feat/03b-storage-messaging`, based on that commit; neither task branch has been pushed.

## Active work

| Owner | Task | State | Next action |
| --- | --- | --- | --- |
| A / Pavitra | 03B | Complete locally | Next ready task: 04A, dashboard tabs and working Planner action. |
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

- Task / owner: 03B / A (Pavitra lane), complete. The shared-file claim was recorded before implementation; B's portal research is unchanged.
- Changed: shared validators/RPC/client; background worker/handler; storage repository; three unit-test files; manifest/build guards; current contract/setup/product/reference docs and 03B evidence. No UI changes or new dependencies.
- Passed: 90 unit tests; lint without warnings; strict typecheck; production build/artifact checks. Chrome 156.0.8078.47 and Edge 155.0.4283.62 passed actual worker/storage save, dashboard reload, concurrent-view conflict, malformed/unavailable command rejection, corrupt/future record preservation, settings save and whole-browser restart restoration.
- Permissions: only storage; no host access. Storage access restricted to trusted extension contexts before any operation. Client timeout is 10 seconds, with no automatic retry; saved revisions remain authoritative.
- Limits: UI remains preview-only. No migrations/recovery UI, import/export, live provider/portal actions, enrollment deduplication/executor or crash-during-write test. Provider/portal/job validators are deferred with those disabled feature commands. No teammate sign-off yet.
- Next ready task: **04A**, dashboard navigation and the existing planner link. Read its UI/design requirements before editing; stop after that task.

Read the linked evidence for detailed versions and limits; do not replay the full history.
