# 14A: enrollment timing validation portion

Date: 2026-10-27 (America/Chicago). Owner: Codex. Continuing the user-authorized work without connected browser access, this implements only the pure timing boundary from 02A. The 14A review interface and activation flow retain their 01B dependency. Full 14A is not complete.

## Implementation and limits

`src/shared/enrollment-timing.ts` validates unknown input against the existing EnrollmentTiming union. It reuses the strict record, number, string and timezone helpers and returns a detached result. No dependency, schema, manifest, storage, dashboard, runtime-handler or executor changes are included. The new module is not yet imported by a production entrypoint. Every enrollment RPC still returns FEATURE_UNAVAILABLE.

The caller must provide a trusted current clock reading. Scheduled values require an exact whole-second future epoch, named zone, fixed-width Gregorian local time and explicit signed offset. Calendar rollover is rejected. The local date/offset must produce the target epoch, and formatting that epoch back in the named zone must reproduce the local date exactly. The machine's default timezone and locale are not used. DST gaps fail; repeated times require an explicit matching offset/epoch rather than an automatic earlier/later choice. Immediate input permits only the now mode field.

CONTRACTS.md documents years 0001..9999, integer-minute offset precision, error-code distinctions and the future activation/recovery integration boundary. Timezone rules come from the runtime's Intl database; they are not an enrollment-opening calendar or a seat/timing guarantee. The parser validates proposed activation times, not historical stored jobs. Future UI must collect the explicit ambiguity choice and the worker must revalidate against its own current clock. Portal G1, timing G3 and submission G4 remain pending.

## Validation

- Targeted suite: 76 cases passed. Covers winter/summer and midnight, quarter-hour and date-line zones, leap-year/century rules and years below 100; Chicago hour-long and Lord Howe half-hour DST gaps/folds; wrong zones, offsets, epochs and subsecond targets; strict past/equal/future boundaries; missing/extra fields, prototypes, accessors, invalid clocks and detached output.
- A regression proves valid timing does not enable the reserved enrollment.activate RPC.
- Local integration: lint, 373 tests across 16 files, TypeScript and production/MV3 build passed.
- Local isolated Chromium 156.0.8078.4 extension smoke: passed all eight steps (11.4 seconds total). Hosted Windows/Linux verification is pending the first PR run. The unchanged timetable E2E does not test this standalone timing module in a browser; its timing cases run under Node/Intl. Browser timing/UI validation remains part of later integration.
- No personal browser profile, student record, live provider, system-clock change, enrollment action or UI design change was used.

## Reference and handoff

Existing 02A contracts and 02B timing research remain authoritative for scope and unresolved timing guarantees. The previously consulted [Intl.DateTimeFormat documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) informs explicit calendar/numbering/hour-cycle formatting. [Date.UTC documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC) records the 0..99 year interpretation avoided here using setUTCFullYear plus round-trip checks.

Next independent candidate: 14B pure job-state transitions with synthetic observations and no portal executor; explicitly retain its portal integration and persistence acceptance requirements. Actual selection review/activation remains blocked on 01B. No merge or release is part of this task.
