# 14B durable dispatch intent

Date: 2026-11-01. Owner: Codex. Scope: internal coordination with synthetic sender callbacks; no production browser or portal actions.

- Added `src/shared/enrollment-dispatch.ts`: strict durable-intent records and saved-record-derived command/target construction.
- Updated `src/storage/enrollment-repository.ts`: schema v4 migration, one-use persisted intent before sender invocation, pre/post-write timing checks, exact source ownership, cancellation ordering, uncertain-delivery recovery and dispatch timestamp checks during result acceptance/reconciliation.
- Added 36 regressions in `tests/unit/enrollment-dispatch.test.ts`; updated current schema expectations and historical fixtures in repository/deduplication/request suites.
- Cases include concurrent duplicate calls, held writes, before/after write failure, restart, deadline/clock changes, wrong document/source/revision, synchronous/asynchronous delivery failure, reentrant replies, stalled delivery, detached commands, cancellation, late delivery failure after a verified result, v3 migration, corrupt intents and explicit/startup reconciliation of pre-intent timestamps.
- Initial targeted dispatch/request/result suites passed 116 cases. Final integration passed lint, 881 tests across 26 files, TypeScript, production/MV3 build and isolated Chromium 156.0.8078.4 extension E2E. Hosted Windows 2025 and Ubuntu 24.04 passed all checks in [run 41375427410](https://github.com/Pavi21P/uhd-student-extension/actions/runs/41375427410) for implementation commit `a1701319b6fc2459fffe631d1525f5454d625e15`.
- A test-only exact-optional-property TypeScript error was corrected; the final complete check and rebuilt browser verification passed. Historical v2 fixture construction was updated to omit the v4-only field while preserving the migration test.
- Guarantees apply to one repository owner and retained request IDs. An intent means a dispatch attempt was reserved, not delivered or submitted. The sender must enforce its deadline and never retry; live executor deduplication, preflight and document targeting remain required.
- Production activation, enrollment RPC and page permissions remain disabled. No live enrollment, live RMP, precision timing or human acceptance gate passed.
- Next bounded candidate: 14B trusted browser transport boundary for document-targeted sends and browser-derived metadata, using synthetic transport tests and retaining the disabled live integration gate.
