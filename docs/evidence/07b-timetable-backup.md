# 07B: Timetable JSON backup and reviewed import

Verified 2026-10-24 (America/Chicago). Owner A. Parent task/contract review is pending.

## Delivered behavior

Download backup reads authoritative saved state and downloads the whitelisted timetable backup JSON. It includes courses, meetings, labels and timetable timezone; view settings, planner data and other extension storage are excluded. Exporting an unsaved empty timetable does not persist a record.

Import accepts JSON up to 1 MiB, validates before preview and writes only after explicit Merge courses or Replace timetable. The preview shows current/file/result counts, resulting labels/zone and all imported course/meeting details. It survives destination navigation and can be cancelled with Escape. Local course editing is blocked while previewing. A changed saved snapshot requires Refresh import preview.

Merge retains local content and remaps every imported course/meeting ID, even if names or source IDs match. Repeat imports produce copies and are labeled accordingly. Different timezones and post-merge limits reject merge. Replace adopts imported content/labels/zone while retaining the target timetable identity; imported revision never controls local revision. Both paths validate and persist once inside the existing serialized writer.

The existing schedule.import RPC is enabled behind the authenticated dashboard handler. expectedRevision now permits null for create-only import into a fresh installation, matching schedule.save. A present target requires its exact revision; corrupt/future targets are never silently replaced. Stored backup/schedule schemaVersion remains 1; no permissions or dependencies added.

Failures retain the file/preview. Uncertain outcomes require explicit authoritative reload and fresh review with a warning that another merge may duplicate data. No import is automatically replayed. Selecting another file or cancelling an asynchronous read cannot resurrect an old preview.

## Files and validation

Core: src/shared/timetable-backup.ts, foundation-rpc.ts, messages.ts; src/storage/repository.ts; src/background/handler.ts. UI: use-timetable-transfer.ts, TimetableBackup.tsx, workspace/app/grid wiring and styles. Tests: timetable-backup.test.ts and the updated reserved-command messaging assertion.

Final npm run check passed: **200 tests across 10 files**, lint, strict TypeScript, production build and MV3 artifact checks. Twenty-four import acceptance cases were added; the obsolete import-is-unavailable case was removed. Tests cover exact/blank/recurring round trips, malicious/unknown fields, malformed/oversized UTF-8 input, getters, references/duplicates, ID collisions/remapping, repeat merges, zones/limits, fresh targets, concurrent confirms, failed writes, corrupt targets and RPC authentication/correlation.

Installed unpacked **Chrome 156.0.8078.47** and **Edge 155.0.4283.62**, isolated headless synthetic profiles, both passed:

- Fresh-install preview/navigation/Cancel does not create storage and restores focus.
- Explicit fresh replacement preserves all source content while using local ID/revision 0.
- Actual downloaded JSON round-trips saved data and excludes an unrelated synthetic storage entry.
- Merge remaps colliding IDs and preserves local occurrences; changed data in another tab invalidates confirmation until preview refresh.
- Bad JSON, future schema, extra credential fields and files over 1 MiB leave storage unchanged. Mixed-zone merge rejects; explicit replacement remains available.
- Lost successful-import reply produces exactly one revision, pauses confirmation, and requires reload/review without replay. The duplicate warning remains visible.
- A future-version stored target stays intact despite a valid file. A separate test fixture restoration and explicit reload recovers it; this is not an in-app corruption repair feature.
- Cancel during asynchronous file reading prevents late preview reopening. Empty replacement survives reload.
- Long filenames and course strings render as text, with no document overflow at 320/390/768/1024/1440 widths. Escape cancels at actual 200% browser zoom.
- Final native chooser checks retain the selected filename and support choosing the same file again in both browsers.

No page errors. Local runners, JSON reports and synthetic browser profiles remain ignored under .local/. Browser checks do not replace human acceptance review.

## Visual review and references

Inspected [desktop import preview](07b-import-desktop.png) and [narrow import preview](07b-import-narrow.png). Reused the established design direction and the relevant Taste app-screen form/settings and Impeccable Operate guidance. A visual review caught the chooser resetting its filename after selection; that was corrected and checked in both browsers. No vendor toolkit or screen-reader audit claimed.

Checked [MDN Blob.text](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text) and [object URLs](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) for UTF-8 file reading and download URL lifecycle. URLs are revoked after initiating the download; the UI says to check browser downloads rather than claiming the OS saved the file.

## Limits and next task

Timetable-only backups; no settings/planner/provider/job data. No automatic corruption repair, migrations or cross-zone conversion. Live ratings/enrollment remain unavailable. Next ready: **08A**, overlap readability and responsive/contrast polish.
