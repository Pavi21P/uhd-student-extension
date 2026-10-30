# 14B: durable outstanding executor requests

Implemented 2026-10-28; verification/publication resumed 2026-10-29 (America/Chicago) after an automatic approval-review usage-limit interruption. Owner: Codex. Full 14B and live enrollment remain incomplete.

## Result

Storage schema v3 retains executor requests with jobs, activation associations and legacy markers. Each request holds its correlation metadata, creation time and pending/consumed/abandoned state. Registration derives the job, token, target and expected revision from the saved job. It requires a configured adapter, an executing job without observed submission, valid timing and an awaited write. Cancellation registration requires an existing pending execute request.

Request IDs and each job/command pair are single-use for the lifetime of retained history: even a different request ID cannot reissue the same job's execute or cancel command. There is no eviction or automatic retry. At most two requests per job and 100 retained jobs bound the registry at 200 entries.

The guarded reply path now requires an actual pending record in storage. The caller's pending projection is only a consistency assertion; the saved record is authoritative. It cannot invent a request, extend its deadline or change its job/target/token/revision. Existing browser-identity, adapter, deadline and lifecycle checks still apply. An accepted reply consumes its request, updates the job and abandons competing pending requests for that job in one awaited whole-value write. Generic job-changing transitions also abandon outstanding requests. Unauthorized or malformed replies leave the legitimate job and registry unchanged.

Explicit recovery abandons all outstanding requests and stops active jobs together. Consumed/abandoned records remain as replay protection. A write failure before or after persistence blocks later operations until explicit recovery; no failed registration or reply causes execution to be retried. Recovery migrates v1/v2 envelopes directly to v3, preserving jobs and activation links without inventing requests. Corrupt or future-version storage is preserved and rejected.

## Boundaries

This is an internal, single-writer repository using the existing storage adapter contract. Atomicity means one awaited set of the combined value; synthetic tests do not prove disk durability or coordination across repository instances. Registration is not dispatch permission, and no code sends a portal command. The request's reply deadline is independent of the execution window; expiration rejects a reply, while future coordinator timeout handling must stop the job.

The browser bridge must still supply actual browser metadata, validate the full PortalReply and derive the event from that same message. The current API handles correlation projections and trusted internal lifecycle events. Error replies, result extraction/reconciliation, durable dispatch coordination and production Chrome-storage/runtime wiring remain unfinished. Neither browser provenance nor real select-and-submit behavior has been verified. No permission, dependency, UI or public command was added; enrollment remains unavailable.

## Validation

- 44 new registry cases plus updated existing storage/ownership regressions.
- Targeted registry/ownership/repository/deduplication run: 181 cases passed.
- Coverage: persistence before acknowledgment, atomic consumption, concurrent replies/registration, changed-revision replay, request-ID/command reuse, cancellation races, unregistered or forged pending metadata, clocks/deadlines, lost writes, recovery, v2 migration and corrupt request links.
- Local lint, 713 tests across 22 files, TypeScript and production/MV3 build passed. After two type-only inference fixes, lint, all 44 registry tests and the build passed again. Isolated Chromium 156.0.8078.4 extension E2E passed (13.2 seconds total), with one expected result and zero failures, skips or flaky results.
- Hosted Windows/Linux CI and publication: pending.
- Synthetic fixtures only. The existing timetable E2E is a regression check, not proof of live enrollment or either human QA pass.

## Resume

Next independent candidate: 14B full executor reply validation and lifecycle-event derivation from the same validated message, using synthetic replies. Keep runtime activation/dispatch disabled and retain the observed portal/adapter gate. Review UI, live ratings, portal inspection and human QA remain outstanding. No merge or release.
