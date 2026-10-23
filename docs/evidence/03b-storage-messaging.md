# 03B: validated storage and message foundation

Completed 2026-10-22 (America/Chicago). Owner: A / Pavitra, claiming the shared foundation task locally. B's 01B portal research assignment is unchanged. No UI or next-task feature was implemented.

## Result and boundaries

Implemented strict runtime parsing for courses, meetings, schedules and display settings, a revision-protected single background writer, authenticated dashboard messages and a typed client. The module worker is bundled as `background.js`; the only new permission is `storage`, with no website access. Existing 03A launcher/dashboard rendering is unchanged.

The four supported operations are `schedule.read`, `schedule.save`, `settings.read` and `settings.save`. Import, professor and enrollment commands fail with FEATURE_UNAVAILABLE. Other commands fail with INVALID_INPUT. No future command is routed to execution as a fallback. [CONTRACTS.md](../CONTRACTS.md) documents key formats, versions, errors, defaults, timeouts and event delivery.

Tests use invented data only. No authenticated portal, student record, RMP provider or production enrollment was accessed.

## Automated checks

- Full suite: **90 tests passed** across four files, including the existing four launcher tests.
- Runtime rejection coverage: original 02A negative fixtures, record shape, versions, field bounds, invalid zones/numbers, prototype/accessor fields, duplicate IDs/occurrences, missing references and invalid time ranges. Other overlaps remain allowed for 05B warnings.
- Persistence coverage: create-only and expected-revision checks, concurrent saves, ignored client revisions, save/reload through a fresh repository, settings defaults, corrupt/future data preservation, failures, queue recovery, detached drafts and revision overflow.
- Message coverage: spoofed senders, unsupported documents, malformed envelopes/payloads, reserved commands, initialization failure, response mismatch and a 10-second client timeout without retry. Raw storage/transport errors do not reach responses.
- Lint passed without warnings after documenting the intentional control-character check and making the sparse-array test explicit. The affected 37-test validation file passed again after that test adjustment.
- Strict TypeScript and Vite production build passed. Artifact guard checks the module worker, bundled entries, exactly `storage` permission, and no host permissions/content scripts. No package or lockfile changes were needed; dependencies were reused from the clean 03A installation.

## Real browser checks

Ran isolated, headless, persistent Playwright profiles on Windows. Used browser-level DevTools `Extensions.loadUnpacked`; requests originated from the installed extension's actual dashboard page, through chrome.runtime messaging to the worker and chrome.storage.local. Test profiles and automation scripts remain under ignored `.local/`; the repeatable domain/transport regression tests are committed. A maintained extension E2E runner remains task 09B.

| Browser | Outcome |
| --- | --- |
| Chrome 156.0.8078.47 | Passed all checks below; zero page errors. |
| Edge 155.0.4283.62 | Passed all checks below; zero page errors. |

1. Save a synthetic schedule, normalize whitespace-only optional text to absence, and assign revision 0 despite the supplied revision.
2. Reload the dashboard and read the saved schedule through the worker.
3. Submit two updates from separate dashboard tabs with expectedRevision 0: exactly one succeeds, the other gets REVISION_CONFLICT. Observe schedule.changed revision 1 after the persisted save.
4. Reject a duplicate-ID save and an enrollment activation command without changing any storage keys. Reject the popup as an unauthorized schedule API sender.
5. Read default settings, save a different visible-day list, and receive revision 1.
6. Inject separate synthetic damaged/future-version records into the isolated test profile. Read and create attempts fail with STORAGE_ERROR or UNSUPPORTED_VERSION; byte-equivalent JSON data remains untouched.
7. Close the whole test browser, reopen the same test profile and extension, and verify that the schedule and settings match their saved revisions/content.
8. Confirm manifest permission is only storage and host_permissions is absent.

## Manual reproduction

Build and load `dist` using [README.md](../../README.md). From the dashboard's developer console in a throwaway test profile:

```js
const request = (type, payload) => chrome.runtime.sendMessage({
  protocolVersion: 1, requestId: crypto.randomUUID(), type, payload,
});
const schedule = {
  schemaVersion: 1, id: crypto.randomUUID(), revision: 0,
  label: 'Synthetic check', termLabel: '', timezone: 'America/Chicago',
  courses: [{ id: crypto.randomUUID() }], meetings: [],
};
await request('schedule.save', { expectedRevision: null, schedule });
// Retain schedule.id, reload, then read it using the same request helper.
await request('schedule.read', { scheduleId: schedule.id });
await request('schedule.save', { expectedRevision: null, schedule }); // REVISION_CONFLICT
```

Do not seed real student information in test profiles. Recreating a schedule with a new ID does not test persistence; the read must use the saved ID.

## Remaining limits and next task

The visible dashboard remains a static preview with no storage-connected editor. No UI subscription, migration/recovery interface, import/export, collision-warning UI or live adapter exists. Browser restart persistence was checked; forced crash during a write, unavailable storage hardware, screen readers and live portal behavior were not tested. Unit failure injection covers rejected storage calls; uncertain writes still require a read before any deliberate retry.

Next ready task: **04A**, dashboard navigation and the existing planner link. The worker foundation does not satisfy any enrollment release gate.

API sources checked for this implementation: [Chrome storage and access levels](https://developer.chrome.com/docs/extensions/reference/api/storage), [message response channels](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), and [module service-worker registration](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics). The listener returns literal true for callback-based asynchronous replies, retaining compatibility with the declared Chrome 120 minimum; actual browser tests used the versions above.
