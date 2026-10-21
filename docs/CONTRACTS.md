# Shared contracts: task 02A

Contract version 1. [domain.ts](../src/shared/domain.ts) owns records; [messages.ts](../src/shared/messages.ts) owns message shapes. [Synthetic examples](../tests/fixtures/contracts.examples.ts) cover an unnamed card, recurring meetings, a precise enrollment review, an activation request and a revision conflict. TypeScript is compile-time checking only: runtime validators, persistence, messaging and execution are not implemented in this task.

## Ownership and compatibility

A owns timetable/editor consumers; B owns portal/provider adapters. Changes to shared records/messages need the other owner's review before integration. 03B implements validation and the single background writer against this contract. Browser setup and the pinned toolchain remain 03A. No portal selector, real school ID or provider endpoint is assumed here.

Persisted records use schemaVersion; transport uses protocolVersion. Both start at 1. Reject unknown versions with UNSUPPORTED_VERSION and leave saved data intact. A migration must explicitly read an old version and produce a validated new one; never reset a schedule because parsing failed. Unknown input enters validators as unknown, never through a type assertion.

## Validation rules for 03B

| Record | Rules |
| --- | --- |
| All IDs | Nonempty bounded strings, generated independently of display names. Course/meeting IDs unique within their schedule. Portal term/section IDs are opaque, case-sensitive observed values; do not infer them from course titles. |
| All objects | Plain JSON-compatible records; reject unexpected fields at import/message boundaries, including prototype keys. Reject nonfinite/fractional numbers where integers are required, unknown discriminants, and missing required fields. Render text as text, never HTML. |
| CourseCard | id is enough to create a blank card. Text fields are optional; normalize trimmed empty strings to absence. Suggested limits: title/professor 200 characters, courseCode 40, room 80. color is an optional #RRGGBB value, not arbitrary CSS. |
| Meeting | dayOfWeek 1..7, Monday first. Integer 0 <= startMinute < endMinute <= 1440. Referenced course must exist. A meeting is weekly wall time in its schedule zone, not a UTC timestamp. Reject identical occurrences; allow other overlaps with a warning. |
| Schedule | Valid IANA timezone, schemaVersion 1, nonnegative integer revision, label <= 120 and termLabel <= 120 characters. Empty labels allowed. Product limits: 250 courses and 1,000 meetings per timetable; no overnight meetings initially. |
| DisplaySettings | Nonempty unique visibleDays; valid start/end as above; valid enrollmentTimezone; nonnegative revision. Defaults: weekdays, 420..1320 minutes and America/Chicago. Hidden meetings remain saved and discoverable. |
| TimetableBackup | Exact kind/version and a validated schedule; finite exportedAt. Reject files above 1 MiB before parsing. Reject job/provider/auth fields; backups are timetable-only. A separate backup schema extension is required for additional data. |
| ProfessorAssociation | Verified UHD school identity before provider-exact matching. Normalize instructor keys with Unicode normalization, trimming, spacing and case handling, preserving accents/hyphens; normalization alone does not establish identity. Ambiguity requires user choice. Profile URL must be HTTPS, on the permitted RMP host and a recognized professor path; disallow credentials, nondefault ports and arbitrary redirects/hosts. Provider ID must match the profile. |
| RatingSnapshot | overall is null or finite 1..5; reviewCount null or nonnegative integer. Count zero requires overall null; a numeric overall requires a positive count. fetchedAt <= expiresAt; source identity must match the associated professor and verified school. Expired snapshots are stale. Synthetic provenance must stay visibly labeled and must never enter the production cache. No personal notes as provider ratings. |
| PortalObservation | Known adapter, unique sections and nonempty observed term. Exact checkbox/selectable state, no guessed eligibility. Browser target comes from trusted sender/tab metadata, not message payload. An unsupported page yields PORTAL_UNSUPPORTED. |
| EnrollmentReview | Nonempty unique selectedSectionIds, all present/selectable. deselectSectionIds lists exactly the currently checked sections outside the selected set; each must support deselection. Lists are disjoint. No extra checked section may reach submission. Review captures display/identity data, target and freshness. |
| EnrollmentTiming | now has no scheduled fields. scheduled carries a future epoch, IANA zone, local YYYY-MM-DDTHH:mm:ss and explicit offset in minutes east of UTC. Round-trip all fields against the zone: reject disagreement, nonexistent times, or unresolved ambiguous times. Dashboard input is not trusted just because a date picker produced it. |
| EnrollmentJob | Generated/stored by background. executionToken never reaches dashboard storage, backup or logs. Target epoch for now is activation time; for scheduled it is the validated target. proposed expiration is target + 2 seconds, subject to timing-gate evidence. No arbitrary client-specified tolerance. One active enrollment job at a time. |
| SectionOutcome | Exactly one result per selected section after submission, no extras. Missing/unreadable results become unknown. submittedAt reflects observed dispatch, never confirmed registration. Sanitize and bound result messages; no raw HTML, student IDs or session tokens. |

Provider access and portal compatibility remain unresolved gates. These contracts specify the boundaries for a later implementation; a structurally valid message is neither authentication nor proof of successful enrollment.

## Timetable mutation and import semantics

- The background writer serializes mutations. schedule.save compares expectedRevision with the current saved revision; a mismatch returns REVISION_CONFLICT without changing either copy. expectedRevision null means create only and fails if the ID already exists. A new record starts at revision 0; successful updates increment the stored revision by one. Never trust an imported/client revision as the next revision.
- The editor retains its unsaved draft on save failure/conflict. Offer reload/review rather than last-writer-wins overwriting. schedule.changed carries the authoritative revision; readers ignore old events and refetch on gaps.
- Backup export is constructed from the whitelisted TimetableBackup shape, not from all extension storage. No enrollment activation is possible through import.
- Import preview and confirmation happen before schedule.import. Both modes retain the local target schedule ID and increment its current revision. Replace adopts the imported timetable content/zone/labels but ignores its ID/revision. Existing data stays available if validation or writing fails.
- Merge requires matching timezones; otherwise reject and ask the student to choose replacement or adjust the source explicitly. Keep local labels and timezone. Generate new IDs for all imported courses/meetings and remap course references together; equal titles never imply equal identity. Show the resulting counts before confirmation, including any repeated import duplicates. Apply post-merge size limits.
- Duplicate course makes a new independent ID. Add/remove a meeting changes only that occurrence. Editing a course updates every occurrence. Deleting a course removes its meetings in the same transaction. Missing field values remain blank; placeholders never persist as text.

## Message directions and authorization

Every dashboard request carries protocolVersion, requestId, type and payload. The response echoes requestId and type with either validated data or a typed error. No arbitrary selector, script, URL fetch or general-purpose execute command exists.

| Sender -> receiver | Allowed messages and checks |
| --- | --- |
| Dashboard -> background | DashboardRpc operations. Verify own extension ID and dashboard document URL from browser-supplied sender metadata. Only the enrollment review screen's explicit activation handler invokes enrollment.activate. A page cannot self-identify as the dashboard. |
| Background -> supported portal document | portal.inspect, portal.execute, portal.cancel. Target the verified tab/frame/document. Execute carries an exact reviewed selection and private job token. Reject stale/mismatched job or document identity. |
| Portal content script -> background | PortalReply only for an outstanding request from that exact tab/frame/document, matching requestId and job/token where applicable. Never accept a website postMessage as an enrollment command. Validate origin and adapter against the allowlist established by 01B. |
| Background -> subscribed dashboard | StateEvent only after successful persistence. Use safe EnrollmentJobView, never the internal EnrollmentJob. A changed-event notification cannot start an enrollment. |

Request IDs are unique per client operation. For enrollment.activate, persist its request ID and normalized payload with its job before acknowledging it. Repeating the same ID/payload returns the existing result, not another execution; reusing it with different payload returns REQUEST_ID_REUSED. Separate request IDs do not bypass the one-active-job rule. Timeouts require reading/reconciling the existing job, not generating a new activation ID automatically.

All other mutating operations use revision checks or defined idempotent association updates; read operations may be retried. A response timeout is not proof that the operation failed. Transport timeout durations and safe retention of the activation deduplication record are implementation decisions for 03B/14B and must be documented before execution is enabled.

## Exact enrollment review and lifecycle

1. Background inspects the selected supported tab and issues a review. Proposed review TTL: 120 seconds to activate, after which a fresh review is required. Once scheduled, the job retains its reviewed intent; at execution it must freshly compare the portal against that intent. The 120-second activation TTL must not accidentally limit how far ahead scheduling works.
2. Compute the review fingerprint in the background from a canonical JSON representation: verified target identity/adapter, termId, sorted complete section records (fixed key order, absent optional display fields normalized to empty strings), sorted selected IDs, and sorted deselect IDs. Use a cryptographic digest, not a hash supplied by the dashboard. Exclude timestamps and the fingerprint itself. Changing relevant page content invalidates the review. The fingerprint is a comparison aid, not a signature or sender-authentication substitute.
3. Activation supplies only reviewId, expectedFingerprint and timing. Retrieve the issued review, compare the token and current state, and generate job ID/execution token in the background. Reject stale or changed selections. Never accept a dashboard-authored EnrollmentJob or PortalTarget as execution authority.
4. Draft is editor state, not a persisted executable job. Active flow: armed -> preflight -> executing. Before dispatch, persist executor ownership/execution intent; repeated callbacks cannot submit again. Only one matching document may own execution. Restart or document loss before dispatch requires review; a crash around dispatch is unknown until reconciled.
5. Cancel before dispatch may transition armed/preflight to cancelled. The exact dispatch boundary is authoritative: a late cancellation returns TOO_LATE_TO_CANCEL and cannot trigger an auto-drop. A cancel acknowledgement must match the owning executor; do not show Cancelled merely because a message was sent.
6. Execution rechecks target, term, section identities, checkbox state and timing; apply the exact selection/deselection and submit once. Unknown dialogs or mismatches stop. Portal interaction details and whether scripting works are still 01B/G4 evidence, not part of this contract.
7. If no submission occurred, failure/cancellation/expiry may have no outcomes. After submission, normalize results to exactly the selected IDs. All enrolled -> succeeded. Any unknown -> unknown (retain known outcomes). Otherwise any enrolled or waitlisted -> partial unless all enrolled. All rejected -> failed. All waitlisted is partial, never successful enrollment.
8. Terminal jobs never auto-return to armed. A new attempt requires the student to inspect the portal and explicitly activate a new review. Do not retry an unknown submission, including after a worker restart or lost reply.

Runtime state transitions, durable execution ownership and late-job detection belong to 14B-18B. This task does not claim to have implemented or proved them.

## Validation and handoff

Compile the three TypeScript files with strict checks and no output. The examples' satisfies checks verify required shapes; they are not runtime validators. In 03B, promote invalidExamples into runtime rejection tests and add sender-spoofing, revision-conflict and save/reload checks. Keep separate domain tests for recurrence/collisions in 05B and enrollment state transitions in 14B.

Task 02A is complete when these definitions and examples type-check, the stated invariants agree with UI_SPEC.md, and the next implementation owners can proceed without guessing message shapes. B's 01B portal research remains independent. Next A task: 03A, build/manifest/toolchain foundation; 03B then implements these validators and storage/message boundaries.

Verification on 2026-10-20: TypeScript 6.0.3 under Node 24.21.0 passed `--noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --target es2022 --module esnext --moduleResolution bundler` for both contract files and the examples. A separate fixture check passed relationship, duration, selection/deselection and JSON round-trip assertions. This used an existing local compiler read-only; 03A must pin the project toolchain and add reproducible project commands.
