# 14B: stored enrollment record validation portion

Date: 2026-10-27 (America/Chicago). Owner: Codex. This bounded continuation validates saved internal review/job records before future durable coordination. Full 14B remains incomplete.

## Implementation

src/shared/enrollment-records.ts checks strict review/job shapes, unique opaque identities, selected/deselected checkbox intent, bounded target metadata, timestamps and historical timing. Job term and selected IDs must match the issued review. Review freshness is checked at creation; an old scheduled target is readable and may be later than review expiry. Parsing never changes state or grants permission to execute.

Result sets reject duplicate, extra or missing entries within a nonempty set. Claimed succeeded/partial/failed states must match normalized results. Unknown states retain uncertainty and can preserve early/late dispatch evidence. Missing results are allowed during execution/reconciliation; no result is fabricated. CONTRACTS.md documents field limits and the distinction between structural checks and live authority.

The lifecycle parser is exported for reuse without changing its decision behavior. The shared list helper is exported and now rejects hidden custom array properties. No new dependencies, manifest permissions, handlers, timers, storage writes or UI are added. The new record parser is not wired to production entrypoints; enrollment remains FEATURE_UNAVAILABLE.

## Validation

- 96 new synthetic cases cover old records without a live clock read; review activation boundaries; target beyond review expiry; term/selection consistency; exact deselections; malformed origins/metadata; bounds, accessors, hidden/symbol properties and sparse lists; detached nested results; impossible result claims and retained unknown dispatch.
- Initial targeted review/job, lifecycle and existing validation suites: 196 cases passed. Reviewed result-table arguments before the full run so malformed outcomes reach the intended array validation.
- Full local checks: lint, 532 tests across 18 files, TypeScript and production/MV3 build passed.
- Isolated Chromium 156.0.8078.4 extension journey passed all eight existing steps (32.3 seconds total). This exercises existing timetable behavior, including the shared list helper, not browser integration of the new saved-job parser. Hosted Windows/Linux CI: pending publication.
- No personal browser profile, live myUHD action, real student record, RMP request or human QA sign-off was used.

## Limits and handoff

Record shape does not establish supported portal origin/adapter, fingerprint authenticity, token ownership, privacy sanitization, successful enrollment or activation deduplication. Current Intl rules are used for historical timing consistency. A future storage layer must preserve invalid records and report recovery problems rather than silently rewriting them.

Next independent candidate: 14B durable internal job repository with serialized revision checks and restart recovery, using synthetic storage and leaving activation/portal execution disabled. 01B portal evidence, live ratings and both 09A human sign-offs remain outstanding. No merge or release.
