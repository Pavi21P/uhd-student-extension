# 14B: complete executor replies and derived events

Implemented 2026-10-30; hosted verification completed 2026-10-31 (America/Chicago). Owner: Codex. Solo workflow: commit and push work/solo-development without a new PR. Full 14B and live enrollment remain incomplete.

## Result

acceptExecutorReply(sender, reply) replaces transitionFromExecutor(jobId, revision, event, context). The repository accepts browser metadata and a complete wire reply; the caller can no longer supply a lifecycle event, expected revision or pending-request projection. A saved pending request identifies the job and revision inside the serialized queue.

The strict parser validates and detaches all fields of portal.completed, portal.cancelled and portal.error. It rejects unknown fields, accessors/prototypes, malformed tokens/IDs/timestamps, duplicate or oversized outcomes, unsupported statuses/reasons and unbounded/markup-bearing text. Inspection replies belong to a separate future inspection path and are rejected here.

Existing configured-adapter, exact tab/frame/document/origin, active-document, request deadline and stored-token checks remain. Complete/cancelled replies must match the saved job and token and the corresponding command. Error replies have no token in the agreed protocol: they are bound by the saved request and browser source, with jobId checked when present. They cannot be accepted on an unregistered, expired, consumed or abandoned request.

The repository derives the event from that same parsed reply. A known submission timestamp records dispatch evidence; a matching cancellation acknowledges no dispatch; a completed reply without observed dispatch or an error stops the executing job as unknown. Future dispatch timestamps are rejected; early/late evidence remains uncertain under existing lifecycle rules. Nonempty outcomes must cover exactly the selected sections. Normalized section/status/reason evidence is retained; free-text outcome/error messages and error fields are not persisted. No final enrollment success/partial/failure is inferred in this portion.

Job updates, request consumption and abandonment of competing requests remain one awaited write. Malformed/unauthorized replies leave the legitimate state unchanged. Uncertain writes still block until explicit recovery. Storage stays v3; no permissions, dependency or live runtime integration is added.

## Validation and limits

- 42 new complete-reply schema and repository cases; existing ownership/registry tests migrated to the new API. Obsolete caller-pending projections are now rejected as extra input instead of treated as authority.
- Targeted reply/ownership/registry/repository run: 167 passed. Full unit suite: 741 passed across 23 files.
- Final lint, TypeScript and production/MV3 build passed after removing stale test bindings; affected 89 ownership/registry cases passed after the test API migration fixes.
- Isolated Chromium 156.0.8078.4 extension E2E passed (10.7 seconds total), with one expected result and zero failures, skips or flaky results. Hosted Ubuntu 24.04 and Windows 2025 passed all checks, including 741 unit tests, build and isolated Chromium E2E: [run 41170637339](https://github.com/Pavi21P/uhd-student-extension/actions/runs/41170637339), implementation commit [897e4b78bc1f84f5bd4e659892dcf70b6bd45fae](https://github.com/Pavi21P/uhd-student-extension/commit/897e4b78bc1f84f5bd4e659892dcf70b6bd45fae), dated 2026-10-30 23:57:28 -05:00. Published directly to work/solo-development; no PR created. Subsequent documentation-only edits preserve the tested implementation.
- CI now runs on direct pushes to work/solo-development, retaining the existing PR and main triggers. No new PR, merge or release.
- Synthetic fixtures only. Browser metadata is still a trusted bridge input; its actual browser provenance, live results, real worker crash boundaries and select-and-submit behavior remain unverified. The timetable smoke test does not exercise these internal modules or replace human acceptance.

## Resume

Next independent candidate: 14B final outcome reconciliation from validated stored evidence, covering complete, partial, rejected and uncertain results without claiming unverified success. Keep runtime activation/dispatch disabled and retain portal inspection/adapter gates. Production integration, live ratings, review UI and human QA remain outstanding.
