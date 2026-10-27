# 14B: internal job repository portion

Date: 2026-10-27 (America/Chicago). Owner: Codex. Implements serialized internal persistence and explicit restart/error recovery over the existing KeyValueStorage interface. Full 14B remains incomplete.

## Behavior and limits

The versioned uhd.enrollment.jobs envelope retains up to 100 unique jobs and permits one active job. Inserts, reads and revision-checked lifecycle transitions share one repository queue. Inputs are detached before waiting; changed decisions return only after the storage write resolves. Missing history needs no write, and full history is never silently evicted.

Explicit recover() is required before use. Pending jobs stop as needs-review or expired; interrupted execution becomes unknown, with existing observations/results preserved. Terminal records remain unchanged. Invalid data and future versions remain intact. Failed reads and uncertain writes block later operations until explicit recovery. A write that committed before its acknowledgment was lost is re-read and stopped, never blindly retried.

The lifecycle event parser is exported for reuse without behavioral changes. The repository is not wired to the background entrypoint, Chrome storage, dashboard or RPC. No new dependencies, permissions, UI or executor are included. It requires one trusted background instance; it is not a lock across processes/documents. Token issuance, authenticated ownership, activation deduplication, outcome extraction/reconciliation and real portal actions remain separate. Returned records contain internal tokens and must not be exposed to dashboard clients.

## Validation

- 36 new synthetic repository cases; 195 targeted repository/lifecycle/record cases passed.
- Coverage: explicit startup, detached input/output, competing creates/transitions, queued reads behind persistence, duplicate callbacks, revision conflicts, submit/cancel boundary, restart before/after possible dispatch, expiry/backwards clocks, all terminal states, invalid/future records, full history, revision exhaustion and stale insertion.
- Injected failures include rejected writes before persistence and after persistence, lost recovery acknowledgments, queued calls following failure and read failures. Assertions verify no automatic replay, no raw error leakage, preserved records and explicit recovery.
- Full local lint, 568 tests across 19 files, TypeScript and production/MV3 build passed.
- Isolated Chromium 156.0.8078.4 extension journey passed all eight existing steps (14.7 seconds total). Hosted Windows/Linux CI: pending publication.
- Persistence/restart tests use synthetic in-memory storage, not a real worker crash or physical disk durability test. The existing timetable E2E does not exercise this unconnected repository.

## Handoff

Next independent candidate: 14B durable activation-request deduplication, atomically associated with internal job creation, using synthetic requests. Keep public activation and dispatch disabled pending authenticated ownership and portal evidence. The live ratings source, 01B portal inspection and two 09A human passes remain outstanding. No merge or release.
