# 14B: pure enrollment lifecycle portion

Date: 2026-10-27 (America/Chicago). Owner: Codex. This bounded continuation implements pure lifecycle decisions with synthetic inputs. Full 14B, including durable ownership/persistence and observed portal integration, remains incomplete.

## Implementation and limits

src/shared/enrollment-lifecycle.ts validates a strict internal projection of the existing job contract and returns detached decisions. Events cover preflight/execution entry, cancellation, no-dispatch acknowledgment, preflight failure, expiry through clock checks, recovery/invalidation/timeout and observed dispatch. CONTRACTS.md documents the precise event and integration boundaries.

Execution entry requires preflight and a current time in [target, expiry). Recovery or an observed backwards clock requires review before execution; during execution it becomes unknown even without a saved submission timestamp. Missing evidence is not proof that no click happened. A cancellation request during execution waits for an authenticated future owner's no-dispatch acknowledgment; recorded submission cannot be undone. Stale revisions fail, terminal states never re-arm, and uncertain submission is never retried. A dispatch observation does not mean successful enrollment.

This is a pure decision helper, not durable duplicate prevention. Two callers can propose the same decision against an old snapshot. A future coordinator must authenticate, serialize, compare and persist before dispatch, enforce one active job, and implement activation deduplication. Full stored-job/review validation, executor tokens, result aggregation/reconciliation, timers, sleep/clock-jump detection and the observed portal adapter are not implemented here. The module is not imported by production entrypoints. No UI, manifest, dependency, storage or runtime-handler changes are included; enrollment commands remain FEATURE_UNAVAILABLE.

## Validation

- New lifecycle suite: 63 synthetic cases. Covers ordering and dispatch-window boundaries; revision races and duplicate callbacks; cancel/submission acknowledgment races; restart, invalidation and timeout before/after possible dispatch; backwards clocks; retained early/late/conflicting dispatch evidence; immutable terminal states; strict records/accessor rejection; invalid clocks and revision exhaustion.
- Explicit regression demonstrates that pure revision checking is not a shared lock.
- Local integration: lint, 436 unit tests across 17 files, TypeScript and production/MV3 build passed.
- Isolated Chromium 156.0.8078.4 timetable journey passed all eight existing steps (10.9 seconds total). This guards the existing extension; it does not exercise the new unconnected lifecycle helper in a browser.
- Hosted Ubuntu/Windows CI: pending publication.
- No connected personal browser, real student data, live enrollment, ratings retrieval or human acceptance sign-off was used.

## Handoff

Next independent candidate: 14B strict stored-job/review validation before durable coordinator integration, using synthetic records and retaining the 01B portal dependency. G1/G3/G4, the live ratings source and both 09A human passes remain open. No merge or release.
