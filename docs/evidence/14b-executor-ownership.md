# 14B: internal executor-report ownership checks

Implemented 2026-10-28 (America/Chicago). Owner: Codex. This bounded portion validates executor reports before internal job updates. Full 14B and live enrollment remain incomplete.

## Result

The repository now has a separate transitionFromExecutor() entrypoint for submission-observed and cancellation-confirmed. The generic background transition() rejects both acknowledgments. The guarded path snapshots strict inputs, re-reads the saved job inside its existing queue, checks ownership and request correlation using the current clock, then applies the lifecycle/revision checks and awaits persistence.

Reports must match the configured extension, active browser document, exact tab/frame/document, HTTPS origin, saved adapter version, job, execution token, request ID, command/reply kind and expected revision. URL credentials, unsupported adapters, replaced documents and expired pending requests are rejected without changing the legitimate job. Nonzero frames are supported when explicitly matched. The pending reply deadline is separate from the dispatch cutoff: an in-window submission may be reported later while its request remains outstanding.

There is no default live host or adapter. Policy is copied from trusted worker configuration; tests use only synthetic identities and origins. The existing portal-target parser is reused. Storage remains schema v2; no new permissions, dependencies, UI or runtime wiring were added.

## Trust boundary and limits

The future bridge must obtain sender metadata from the browser and pending-request metadata from its own outstanding-request registry, never from a page or reply payload. The current API validates supplied projections; it does not authenticate their provenance. The reply projection covers correlation fields only, not the full PortalReply. The bridge must validate the full reply and derive its lifecycle event from that same message.

Request issuance, consumption and a durable executor lease are not implemented here. Revision checks reject competing callbacks at one saved revision but are not a complete single-use request registry. Generic background transitions remain trusted internal decisions and cannot be exposed directly through RPC. An executing state or accepted report does not authorize a click or prove successful enrollment.

No production browser metadata projection, Chrome storage/recovery wiring, portal interaction, real cancellation acknowledgment, result extraction or crash-boundary behavior has been verified. Enrollment commands remain unavailable.

## Validation

- 59 new synthetic cases; existing repository tests updated to use the guarded acknowledgment path.
- Targeted ownership/repository/deduplication run: 137 cases passed.
- Full local checks: lint, 669 tests across 21 files, TypeScript and production/MV3 build passed.
- Coverage includes mismatched identities/targets/tokens/requests, unsupported adapters, inactive documents, deadline boundaries, detached inputs/configuration, queued rechecks, callback/cancellation races, lost write acknowledgments and strict malformed-input rejection.
- Isolated Chromium 156.0.8078.4 extension E2E passed (10.9 seconds total). This timetable regression does not exercise the unconnected enrollment modules or replace either human acceptance pass.
- Hosted Windows/Linux CI and publication: pending.

## Resume

Next independent candidate: 14B internal outstanding executor request registry and single-use reply handling, using synthetic metadata. Retain the observed portal/adapter gate and keep activation/dispatch disabled. Full reply validation, production integration, review UI, live ratings and human QA remain outstanding. No merge or release.
