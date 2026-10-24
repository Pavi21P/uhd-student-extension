# 06B: Cross-view updates and non-destructive recovery

Verified 2026-10-24 (America/Chicago). Owner A. Builds on 03B's versioned repository and serialized writes, plus the 05B/06A meeting editor. Parent task reviews are still pending.

## Completed behavior

- Idle dashboard views refresh when their exact local schedule/settings key changes. Returning focus, visible state or pageshow triggers an authoritative read to catch missed notifications.
- The subscription treats storage events only as invalidations. Data still comes through the validating worker RPC, never from event payloads. Existing revision guards and serialized writes remain the authority.
- refresh-queue coalesces pending notifications, waits for active operations and committed UI state, and retains invalidations arriving during a read. Cleanup prevents queued reads and notifications after disposal.
- Unchanged reads, including an event from the view's own successful write, do not wipe drafts, errors or review state. Changed snapshots refresh idle views. Open course drafts and dirty settings retain raw input and require review before saving over the latest saved version.
- Remote deletion cannot silently recreate an edited course. Invalid or future-schema records remain untouched and block writes. Previously loaded grid settings are explicitly labeled when a new read fails.
- Recovery pauses automatic refresh. The user explicitly reloads and reviews after a failed/uncertain save. No automatic write retry, reset, migration or repair was added.

Files: src/dashboard/refresh-queue.ts, use-storage-refresh.ts, use-course-workspace.ts, use-view-settings.ts and WeeklyGrid.tsx; tests/unit/refresh-queue.test.ts and repository.test.ts. No dependency, permission, schema, background API or planner-project changes.

## Verification

Final npm run check passed: **161 tests across 8 files**, lint, strict TypeScript, production build and MV3 artifact validation. Ten new regressions cover queued/overlapping reads, recovery blocking, failure retry boundaries, disposal before/during reads, transient failures, corrupt settings preservation and stale writes after deletion.

Unpacked production extension tested in isolated profiles using installed **Chrome 156.0.8078.47** and **Edge 155.0.4283.62**, headless. Both passed:

1. An idle tab receives another tab's new course without reload; own writes do not create false review.
2. An open editor keeps changed course text and an invalid raw meeting time when another tab saves; saving stays blocked until review.
3. Another tab deleting that course retains the draft for copying and prevents resurrection.
4. Idle settings update automatically; dirty settings retain raw input, and Cancel adopts the latest saved values.
5. A deliberately held read followed by another save drains the pending event and eventually renders the newest version.
6. Dropping a storage event, then returning focus, catches up from authoritative state.
7. Injecting a corrupt schedule retains that exact stored value and the draft; separately restoring a known-valid fixture followed by explicit reload recovers. This does not demonstrate an in-app corruption repair feature.
8. Future-version settings stay intact, block writes and label the last-loaded grid view; explicit reload recovers after a valid fixture is restored.
9. Losing a successful save reply keeps recovery active despite its own change event and focus events. Explicit reload observes exactly one revision; no write is replayed.
10. A transient read failure blocks editing and recovers by explicit reload without writes.
11. Full browser-process restart restores schedule/settings exactly. No page errors were reported.

The final disposal-before-read guard was then checked by its unit regression and the full integration checks; it does not change active-view behavior. Local browser runners/reports remain ignored under .local/. The committed unit suite is repeatable via npm run check.

## Design and sources

Reused Taste app-screen form/settings guidance and Impeccable Operate guidance, plus the established tokens and recovery panels. Inspected the [desktop draft review](06b-draft-review.png) and [narrow last-loaded settings notice](06b-settings-recovery-narrow.png). The narrow capture includes the focused skip link; grid scrolling remains internal and document bounds passed. No vendor toolkit execution or screen-reader audit claimed.

The storage invalidation approach was checked against the official [Chrome storage API documentation](https://developer.chrome.com/docs/extensions/reference/api/storage#event-onChanged) on 2026-10-24. No portal source capture or real student data was used.

## Limits and next task

Unknown/corrupt records are preserved, not automatically repaired. Reload can recover a transient failure or separately restored valid record; backup/import and any explicit repair flow are separate work. No drag/resize, live ratings or enrollment execution. Next ready task: **07A**.
