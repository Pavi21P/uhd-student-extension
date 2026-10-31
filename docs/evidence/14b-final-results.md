# 14B: final outcome reconciliation

Implemented 2026-10-31 (America/Chicago). Owner: Codex. Direct commits/pushes on work/solo-development; no new PR. Full 14B and live enrollment remain incomplete.

## Result

Accepted completed replies now finalize the job in the same awaited write that consumes the request. All enrolled -> succeeded; any waitlisted/enrolled mixed with other known results -> partial; all rejected -> failed; any unknown or missing evidence -> unknown. An all-waitlisted result is partial, never succeeded. Missing outcomes after known dispatch become one explicit unknown/unconfirmed outcome per selected section. A reply without observed dispatch stays unknown with no invented results. Nonempty incomplete selection coverage remains invalid and is not silently accepted as partial success.

Results are ordered by the saved selection and retain only section IDs, statuses and normalized reasons. Shared classification now also checks saved final-state consistency, avoiding separate rules for writes and reads. Early/late dispatch, a backwards clock, or submission before request registration remains unknown even when supplied outcomes say enrolled. Existing unknown jobs are never promoted by saved-evidence reconciliation.

For records saved by the prior implementation, reconcileExecutorResult(jobId, expectedRevision) can finalize an executing job with known dispatch and a consumed execute request from exactly the preceding revision. The queue re-reads all validated state, rejects stale revisions and awaits one write. Recovery uses the same rule automatically. Missing or mismatched provenance never yields success; ordinary interrupted execution still stops as unknown. Saved reply acceptance at/after its request deadline, dispatch before registration and backwards clocks also remain unknown. Recovery never sends or retries a portal action.

Accepted replies advance one revision total; explicit/recovery reconciliation of prior records advances one further revision. Terminal records are unchanged. Lost write acknowledgments block further operations until recovery: confirmed persisted final evidence is retained, while missing persisted evidence remains unknown. Request tombstones and activation replay links remain intact. Schema stays v3; permissions, dependencies and runtime wiring are unchanged.

## Validation and limits

- 41 new result cases, including status combinations, missing/unreadable evidence, result ordering/privacy, timing/provenance, held writes, uncertain writes, replay, explicit reconciliation races and startup recovery.
- Targeted result/reply/ownership/registry/repository run: 208 passed.
- Final local checks: lint, 782 tests across 24 files, TypeScript and production/MV3 build passed.
- Isolated Chromium 156.0.8078.4 extension E2E passed (9.9 seconds total), with one expected result and zero failures, skips or flaky results. Hosted Windows/Linux CI pending.
- Tests use synthetic storage, identities and results. Final state classification is only as trustworthy as the future portal adapter and browser-message source. It does not prove live enrollment, actual disk/crash durability or human acceptance.

## Resume

Next independent candidate: 14B safe EnrollmentJobView projection and response validation, excluding execution tokens, internal reviews and request metadata from future dashboard responses. Keep runtime activation/dispatch disabled and retain portal inspection/adapter gates. Production browser integration, live ratings, review UI and human acceptance remain outstanding.
