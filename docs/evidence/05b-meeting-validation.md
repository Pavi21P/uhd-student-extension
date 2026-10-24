# Task 05B — meeting time validation and conflicts

Verified 2026-10-23 (America/Chicago). A claimed this shared utility task while B retains 01B portal research.

## Implemented

`src/shared/meeting-time.ts` adds two pure functions for the upcoming placement form:

- `parseMeetingTimes(start, end)` accepts exact 24-hour `HH:mm` strings. It returns integer wall-clock minutes without timezone conversion or rounding. `24:00` is accepted only as the end of the current day. Empty/malformed/coerced values, zero or negative durations and overnight wrapping are rejected with field-specific `ContractFault` details.
- `findMeetingConflicts(schedule)` first reuses the existing schedule validator, then reports every intersecting meeting pair once. Each result contains the two meeting IDs, weekday and exact overlap interval. The intervals are `[start, end)`: one class ending when another starts is not a conflict. Results are deterministic in day/start/end/ID order regardless of input order.

Recurring lectures and labs remain independent meeting records. Different weekdays do not conflict; overlapping occurrences of the same course do. Exact duplicate occurrences and invalid references are rejected by the existing contract. Conflicts are derived warnings, not stored records, and do not remove or reject otherwise-valid overlapping schedules. Input data is never mutated.

No UI, persisted schema, message, dependency, permission, background or existing validator changes. The helpers will be consumed by 06A; the current grid remains a preview. No local time is converted to a UTC enrollment timestamp.

## Validation

- Targeted run: `npm test -- tests/unit/meeting-time.test.ts` — **45 passed**.
- Integration: `npm run check` — lint, **140 tests**, strict TypeScript, Vite production build and MV3 artifact checks passed.
- Cases include minute precision, midnight/day-end, malformed/non-string times, invalid numeric ranges, adjacent and cross-day classes, partial overlaps, full containment, coincident times, weekends, recurring occurrences, duplicate/orphan data and source-order independence.
- An independent minute-occupancy oracle checks all interval pairs in 63 synthetic meetings across three weekdays. A separate case covers the 1000-meeting contract limit.
- Browser QA was not repeated: this task adds no UI or browser behavior, and the helpers are not connected to the form yet. 05A browser evidence remains in its own report.

## Handoff

Next ready task: **06A**, weekly grid and manual placement form. Use `parseMeetingTimes` for field inputs and `findMeetingConflicts` to warn while allowing overlap. Preserve independent occurrence IDs; do not collapse recurrence into one movable record. Keep imported/loaded data behind `parseSchedule` and preserve 05A revision/conflict handling.

Review the new utility API with the teammate before consuming it. The stored CourseCard/Meeting/Schedule and RPC contracts are unchanged.
