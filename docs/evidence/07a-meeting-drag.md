# 07A: Drag placement and independent move/resize

Verified 2026-10-24 (America/Chicago). Owner A. Extends the 06A grid and 06B draft/recovery model; parent reviews are still pending.

## Behavior

- Drag an unscheduled card onto a visible day to propose a 60-minute meeting, shortened at day end. A dashed preview and status text show the proposed time/duration. Snap points are every 15 minutes.
- Drag a saved occurrence to move it. The pointer offset is retained, the start snaps, and its exact duration and ID remain unchanged. Other recurring occurrences are untouched.
- Drag a full card's bottom handle within the same day to resize its end. Its start remains exact; end snaps to 15 minutes and stays after the start, at or before 24:00. Cross-day resizing is rejected. Short meetings and clipped ends remain editable through the full-detail list.
- A drop opens a proposal in the existing course editor, focused on the selected meeting start. Save course confirms; Cancel or Escape discards. No drag event writes storage. Existing validation, overlap warnings, revision checks and uncertain-save recovery remain in use.
- Keyboard: arrow keys on a meeting propose a time/day move; Shift + Up/Down proposes an end change. Up/Down on the resize handle also proposes an end change. Enter opens the ordinary exact-time editor. Keyboard day changes retain exact minutes; forms never snap.
- Escape/outside drops cancel. A changed schedule/view snapshot cancels a stale gesture. External drops without an in-page source are ignored. No course information is accepted from drag data.

Files: placement-model.ts, use-meeting-drag.ts, use-course-workspace.ts, CourseEditor.tsx, Timetable.tsx, WeeklyGrid.tsx, styles.css and tests/unit/placement.test.ts. No stored schema, RPC, dependency, permission, portal or separate planner changes.

## Validation

Final npm run check passed: **177 tests across 9 files**, lint, strict TypeScript, production build and MV3 artifact validation. The 16 new placement cases cover snapping, day-end clipping, exact duration preservation over a range of positions/durations, resize bounds, non-finite inputs, exact form round trips, independent siblings, stale/missing identities, duplicate rejection and allowed overlaps.

Installed **Chrome 156.0.8078.47** and **Edge 155.0.4283.62** loaded the production extension in isolated headless profiles. Native mouse input exercised actual HTML drag events, rather than only synthetic drop dispatch. Both passed:

1. Tray drag previews a snapped hour; drop stages a draft without changing storage. Cancel leaves the entire saved record unchanged.
2. Confirming the proposal saves exactly one new occurrence.
3. Moving a 09:07-10:23 occurrence to another day preserves its 76-minute duration and leaves its Wednesday sibling unchanged.
4. Bottom-handle resize changes only that occurrence's end.
5. Keyboard move/resize opens the same focused review form; ordinary form edits preserve exact minutes.
6. Escape cancels a native drag with no editor/write. Cross-day resize rejects. Another tab saving during the drag cancels the stale gesture. An external drop with no local source is ignored.
7. Narrow proposals use the native modal and Escape cancels. Document bounds pass 1440/1024/768/390 widths. Actual 200% tab zoom preserves keyboard/form access and document bounds; reduced motion remains respected.
8. A one-hour view uses its expanded time scale. A Sunday drop near 24:00 proposes 23:45-24:00. A one-minute meeting remains editable through the list.

No browser page errors. Local synthetic runners/reports remain ignored under .local/. Unit checks are repeatable via npm run check. This task did not re-audit unrelated portal features or rerun the full historical storage suite in browsers; those invariants remain covered by unit tests and prior 06B evidence.

## Design review and sources

Reused Taste app-screen form/settings and Impeccable Operate guidance. Card anatomy and visual direction are unchanged. Inspected the [drag preview](07a-drag-preview.png), [saved grid and handles](07a-grid.png), and narrow native editor. A reserved status area prevents drag-start layout shifts; stale drag messages now clear after editing. No vendor toolkit execution or screen-reader audit claimed.

Native drag behavior was checked against [MDN HTML Drag and Drop](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) and [dragover events](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragover_event) on 2026-10-24. Only synthetic courses were used.

## Limits and next task

Desktop mouse dragging and keyboard/form alternatives verified. Touch/pen drag behavior, exhaustive autoscroll stress and screen-reader operation are unverified. Resize changes the end only; use exact fields for start changes. Overnight meetings and cross-tab/external drag import remain unsupported. Backup/import, live ratings and enrollment are later tasks. Next ready: **07B**.
