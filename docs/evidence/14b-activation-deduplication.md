# 14B: durable activation-request deduplication portion

Implemented 2026-10-27; handoff resumed 2026-10-28 (America/Chicago). Owner: Codex. Adds request-backed internal job creation and explicit storage migration. Full 14B and live enrollment remain incomplete.

## Result

The repository saves the normalized activation payload, request ID and job in one awaited write. Matching replay returns the current saved job with created: false; changed payload returns REQUEST_ID_REUSED. Historical scheduled requests remain comparable after target/review expiry. New requests still require valid timing and review freshness, and separate request IDs cannot bypass the active-job rule. The prior create() API is removed.

Storage v2 validates association uniqueness, payload/job consistency and complete coverage: every job has an association or explicit legacy marker. Explicit recovery migrates v1 jobs, stops pending/executing work and marks legacy jobs without inventing request IDs. Associations have no expiry/eviction and remain through terminal states and recovery. Full history permits known replay but rejects new jobs. CONTRACTS.md records normalization, retention, migration and error boundaries.

The timing parser now separates value consistency from proposal freshness. Existing timing checks remain; current-clock checks are intentionally absent only when validating historical payloads. No dependencies, permissions, UI, RPC or background integration are changed. Storage is still internal and tested through synthetic adapters. Authenticated ownership and actual submission remain unavailable.

## Validation

- 42 new deduplication/migration cases; existing repository cases updated to use request-backed creation.
- Targeted repository/timing/deduplication run: 149 cases passed before the final five legacy-integrity cases were added.
- Final local checks: lint, 610 tests across 20 files, TypeScript and production/MV3 build passed.
- New coverage includes concurrent matching/conflicting requests, normalized property order, stopped/unknown replay, lost acknowledgments, held writes, capacity, detached inputs/results, corrupt or missing links, legacy migration and uncertain migration writes.
- Isolated Chromium 156.0.8078.4 extension E2E passed (9.5 seconds total); its saved report has one expected result, zero failures, skips or flaky results. Hosted Windows/Linux CI: pending publication.
- The existing timetable E2E guards extension behavior; it does not exercise these unconnected internal modules. No live portal, personal browser profile, real student data or human sign-off was used.

## Resume

Next independent candidate: 14B internal executor-ownership checks using synthetic browser identities, retaining the live portal/adapter gate. Production storage/RPC wiring, review UI, outcome extraction, live ratings and both human QA passes remain outstanding. No merge or release.
