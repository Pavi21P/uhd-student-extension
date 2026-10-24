# 06A: Weekly grid and manual placement

Implemented and checked 2026-10-23; handoff finalized 2026-10-24 (America/Chicago). Owner A. Dependencies 05A/05B are on the parent review branch; human review and merge remain pending.

## Behavior and files

- MeetingFields and meeting-model add independent weekday rows with raw HH:mm drafts, row errors, add/remove, duplicate rejection and derived overlap warnings. Course details plus its meetings save atomically through course-model/use-course-workspace; other courses stay intact. Navigation retains drafts. Deleting the last occurrence returns the course to Unscheduled.
- WeeklyGrid/grid-layout place saved meetings at exact offsets and heights, clip to visible hours and separate intersecting cards into simple lanes. Full cards retain professor top left, title center and room bottom left. Short marks have full labels and a full-detail editing list. Show meetings temporarily expands the view without changing settings or meeting data.
- ViewSettings/use-view-settings/view-settings-model save visible weekdays and start/end hours through the existing revision-protected RPC. Defaults do not write. Failed or uncertain writes preserve drafts and require authoritative reload/review. Future-schema data stays intact and blocks writes.
- App, Timetable, CourseEditor, popup and CSS connect the feature. No stored-schema, background API, permission, dependency or external-service changes.

## Acceptance evidence

Full npm run check passed: lint, **151 tests across 7 files**, strict TypeScript, production build and MV3 artifact validation. The 11 new manual-placement tests cover independent occurrences, invalid/duplicate rows, atomic replacement and ownership, precise geometry/clipping, overlap lanes, reveal behavior, day-end boundaries and settings validation. Existing 140 tests remain green.

Unpacked production extension checks passed in **Chrome 156.0.8078.47** and **Edge 155.0.4283.62**, using installed browser channels in headless mode and isolated synthetic profiles:

| Area | Observed result |
| --- | --- |
| Exact placement | 09:07-10:23 retains its exact 76-minute duration; normal geometry matches the minute scale. One-hour and one-minute views expand proportionally with separated boundary labels. |
| Editing | Zero duration and duplicate rows reject without partial writes. Independent weekday rows persist; removing one preserves others. Scheduled-course delete confirmation has one meeting editor and removes only its own meetings. |
| Overlap | Valid overlaps save, show warnings and occupy separate lanes; adjacent meetings do not conflict. |
| Out-of-view | Sunday 23:59-24:00 stays accessible in the list. Show meetings reveals it without a settings write; exact short duration is retained. |
| Settings | Empty days/inverted hours reject. Custom days/hours survive reload and browser-process restart together with the schedule. |
| Concurrency | Actual two-tab stale course/settings saves are rejected; reload/review retains raw drafts and preserves another course added in the other tab. Automatic live refresh remains 06B. |
| Recovery | Injected storage failure retains saved data and draft. A deliberately lost reply after a committed save creates exactly one revision and does not replay; explicit read recovers. Unsupported settings schema remains unchanged. |
| Responsive/access | 320/390/768/1024/1440 widths have no document overflow; the grid scrolls internally by keyboard. Native narrow dialog Escape, reduced motion and long text/full accessible labels checked. Actual browser tab zoom 200% passes timetable/settings DOM bounds. |

Local runner scripts and JSON reports remain ignored under .local/; the committed unit suite is repeatable with npm run check. Browser checks used synthetic course names only, no authenticated portal or student records. Screenshots below are selected evidence, not a complete accessibility audit.

## Design review

Reused the recorded white workspace, green-gray surface, Public Sans and teal controls. Read the relevant cached Taste app-screen form/settings instructions and Impeccable Operate guidance. No vendor toolkit execution or separate reviewer agent is claimed. Desktop grid/settings and narrow editor/settings screenshots were visually inspected. The 200% full-page screenshot capture cropped the physical right edge despite passing DOM bounds, so it is omitted as visual evidence.

- [Chrome weekly grid](06a-grid-chrome.png)
- [Edge weekly grid](06a-grid-edge.png)
- [Chrome narrow meeting editor](06a-editor-narrow.png)
- [Chrome narrow Settings](06a-settings-narrow.png)

## Remaining scope

No drag/move/resize (07A), continuous cross-view refresh (06B), backup/import, timezone controls, live RMP or enrollment execution. Simple overlap lanes are usable; later collision polish remains 08A. No screen-reader audit or live portal validation. Next ready task: **06B**, reuse the existing repository and finish recovery/two-view handling.
