# UI specification: task 01A

Status: specification delivered in 01A; current implementation is tracked in [STATUS.md](STATUS.md). Based on the approved build plan and the user's confirmed myUHD select-and-submit behavior. Teammate review has not yet occurred. This is a behavioral specification, not evidence that every feature already works.

## Scope and ownership

| Owner | Responsibility | Handoff |
| --- | --- | --- |
| A / Pavitra | Popup, dashboard, timetable, planner entry, accessible controls | This spec; shared records/messages are defined in 02A. |
| B / teammate | Portal discovery, RMP provider, enrollment execution and result parsing | 01B supplies observed portal states; integration details must not be inferred from the wireframes. |

Required: timetable, professor ratings with verified source, planner link, and user-activated immediate/scheduled enrollment. Optional later: progress pie. Deferred: optimizer, rating-based section sorting, other schools, accounts/cloud sync, and planner data import. Feature availability follows the gates in [BUILD_PLAN.md](BUILD_PLAN.md#4-enrollment-reliability-design-and-gates).

## Screen map

The toolbar popup is a launcher. The dashboard is a regular extension page. Opening the popup or visiting Enrollment never arms or submits a job.

| Surface | Main content | Primary action | Empty/unavailable state |
| --- | --- | --- | --- |
| Popup | Project name; shortcuts; current enrollment job status when present | Open timetable | No enrollment scheduled |
| Timetable (default) | Toolbar, Unscheduled tray, weekly grid, course editor | Add course | Your timetable is empty. Add a course to begin. |
| Professors | Name search, profile URL entry, matched professor details and saved associations | Find professor / Link profile | Add a professor name or their RMP profile link. |
| Planner | Description of existing planner, external link, separate-save explanation | Open course planner | Link remains available without a portal session. |
| Enrollment | Portal connection state, exact section review, Now/Schedule, job status and results | Enroll now / Schedule enrollment | Open the supported myUHD enrollment page and sign in. |
| Settings | Visible days/hours, timezone, JSON backup/import, local-data controls | Save settings | Sensible defaults; no account required. |

Dashboard navigation order: Timetable, Professors, Planner, Enrollment, Settings. Task 04A implements these as native hash navigation links with aria-current, browser history, route titles, and focus transfer to main content. Use Tab/Shift+Tab and Enter; these links do not use ARIA tab-widget roles or arrow-key activation. Unknown hashes fall back to Timetable. The skip link focuses content without changing destinations. Progress is absent until implemented. Popup shortcuts open the relevant dashboard view; enrollment activation is only on the full review screen. A header job-status link returns to Enrollment when a job is armed or has a new result.

## Timetable layout and interactions

Implementation checkpoint (06A): blank cards, optional details, manual weekday meeting rows, exact grid placement and saved visible days/hours are implemented. Course details and meetings save atomically; invalid rows retain input without partial saves. Valid overlaps show warnings and simple separate lanes. Meetings outside the view remain in the full-detail list and can be temporarily revealed. The desktop editor sits above the grid; at 800px and below it is a native modal. Course and settings drafts survive destination navigation; save failures require authoritative reload and explicit review. Deleted courses are not silently recreated. Task 06B now refreshes idle views from saved changes and on return to a tab. If a course editor is open or settings are dirty, raw drafts are kept and the latest saved version is shown for review. Unchanged reads do not dismiss existing review or errors. Recovery blocks automatic refresh until explicit reload. Invalid/future records are preserved, and the grid labels last-loaded settings when they cannot be verified. Task 07A implements drag placement and per-occurrence move/resize. Each drop opens an exact-time proposal in the existing editor; Save course confirms and Cancel discards. Arrow keys on a focused meeting propose moves; Shift + Up/Down proposes resizing. Drag starts/ends snap to 15 minutes; moves preserve exact duration. Full cards have an end handle; short/clipped ends remain editable through the meeting list. Escape, outside drops and stale gestures never write. See [06A evidence](evidence/06a-weekly-grid.md).

```text
UHD Student Extension                       [Enrollment status]
[Timetable] [Professors] [Planner] [Enrollment] [Settings]

My timetable                  [Add course] [Backup] [Import]
+------------------+--------------------------------------------+
| Unscheduled      | Time | Mon | Tue | Wed | Thu | Fri          |
| [blank card]     | 7:00 |     |     |     |     |              |
| [course card]    | 7:15 |     |     |     |     |              |
|                  | ...                                        |
+------------------+--------------------------------------------+
[Course editor opens beside the grid or as a narrow-screen dialog]
```

- Default hours: 7 a.m.-10 p.m., Monday-Friday. Settings can reveal weekends and extend hours. Preserve access to out-of-view meetings through a notice with a Show meetings action; never hide them without explanation.
- Add course immediately creates an empty card in Unscheduled and opens its editor. Cancel closes the editor and retains that blank card; Delete course removes it explicitly. No name, number, professor, or room is required to create a card.
- Editor fields: course name, optional course code, professor, room, color, meeting rows. Text placeholders are display hints, not stored academic data. Save applies edits; Cancel discards unsaved editor changes.
- Each meeting row has day, start, end, and Remove meeting. Add meeting supports a second day or a separate lab. Removing the last meeting returns the course to Unscheduled. An asynchronous course can stay unscheduled.
- Dragging an unscheduled card onto the grid proposes that day/time with a 60-minute duration, clipped to the end of the day if needed; show the proposed duration and allow editing before confirmation. This is an editable placement default, not a statement about class length.
- Moving a scheduled occurrence changes that occurrence only; resizing changes its duration. Snap drag interactions to 15 minutes. The meeting form allows exact minute values. Escape cancels an in-progress drag.
- Reject end times at/before start and overnight meetings with an inline explanation. Display adjacent meetings without an overlap warning. Overlapping meetings remain visible side by side with a text warning; the student can retain them.
- Editing course text updates every occurrence. Delete meeting and Delete course are separate actions. Confirm deleting a course with meetings and state how many meetings will be removed.
- Persist confirmed changes and display Saving, Saved locally, or Could not save. On a save failure, retain the edited state and offer Retry; do not falsely show Saved.
- Import presents a validated preview and explicit Merge or Replace choice. Cancel leaves the current timetable unchanged. Reject invalid input before modifying saved data; details belong to 02A/07B.

Task 08A reserves 184px per overlap lane within a horizontally scrollable grid. Full cards preserve professor/title/room positions and add an Overlap label with a dashed border. Cards under 84px high use compact labels; under 24px they become exact-duration marks with full accessible names. The full-detail list includes optional course codes and all text; Go to meeting list opens and focuses it.

### Course card

```text
+--------------------------------------+
| Professor name             [Edit]    |
|                                      |
|              Course name             |
|            Optional code             |
|                                      |
| Room number              10:00-11:15  |
+--------------------------------------+
```

Professor is always top left, course name centered, room bottom left. Meeting time is bottom right when scheduled. Empty fields use subdued Professor, Course name, and Room placeholders. No fake course number or rating is inserted. Long text truncates visually while full values remain available in the editor and accessible name. Very short meetings may use a compact card with an accessible details action rather than overlapping text.

### Implemented backup and import (07B)

Timetable contains Download backup and Import backup. Backups contain saved courses/meetings, labels and timetable timezone; view settings and the separate planner are excluded. The inline preview shows current/file/result counts, timezone, course details and every imported meeting. Opening or cancelling a file writes nothing. Merge adds independent copies and explains repeat-import duplication. Replace clearly warns that current courses/meetings will be removed and requires the Replace timetable action. Files above 1 MiB, bad JSON, unsupported schemas and invalid records are rejected. Changed saved data disables confirmation until Refresh import preview. Uncertain imports require explicit reload/review, with a warning that the previous import may already have completed. Escape cancels; focus returns to Import backup. The preview survives destination navigation.

## Professors and inline ratings

Implementation checkpoint (10A): the dashboard accepts a professor name and supported HTTPS profile URL for explicit review. This is an unverified session draft, not a saved association; it survives route navigation and clears on reload. Editing either field invalidates the reviewed link. School/identity/ratings remain unverified and no lookup runs. An opt-in Sample data disclosure demonstrates all seven result states and explicit ambiguous-candidate choice/correction without persistence. The bullets below describe the full integration target; live search, saved correction and inline portal integration are still pending. See [10A evidence](evidence/10a-professor-preview.md).

- Search is scoped to UHD. Link profile accepts a supported RMP professor URL; validation errors stay beside the field.
- A result shows professor name, school/department where supplied, rating out of five, review count, source link, and checked date. Numeric data appears only when supplied by the chosen provider.
- Ambiguous matches show candidate identities and a Choose professor action. Correct match lets the student replace a saved association. Multiple instructors get separate identities; Staff/TBA is Unassigned instructor.
- States: Loading; Match found; Choose a match; No match found; No reviews; Cached (checked date); Ratings unavailable. Missing values are unavailable, never zero.
- During a link-only release, say Open profile to view ratings; do not render invented sample values as live results. Development fixtures must be visibly labeled Sample data.
Implementation checkpoint (11A): a reusable native-disclosure badge and synthetic enrollment fixture now exercise source navigation, uncertainty and stale/missing states. Badge interactions stop bubbling to the fixture row handler; checkbox labels and explicit submission remain unchanged. No portal adapter or live injection is implemented. Details expand in document flow, Escape returns focus to the summary, and source links open separate tabs. See [11A evidence](evidence/11a-professor-badges.md).

- Inline myUHD badges sit beside instructor text without covering or changing portal controls. A badge opens details/source; it cannot select a course or submit enrollment.
- Provider permission and retrieval remain task 02B/G2 work. This spec does not assert that a usable live API exists.

## Planner

Open course planner opens https://uhd-course-planner.pages.dev in a regular browser tab. Supporting text: Your course planner saves separately from this extension. No iframe, copying of degree logic, or automatic synchronization in the initial release. Timetable and planner changes cannot silently affect each other.

## Enrollment review and execution

```text
Enrollment                     Portal: connected / action needed
Term: [observed term]           Portal tab: [identified page]
[ ] Subject / course / section | Instructor | Meeting time
[ ] Subject / course / section | Instructor | Meeting time

When: (Now) (Schedule)
Scheduled mode: [date] [time incl. seconds] [America/Chicago]
Review: [N sections] / [term] / [now or exact date, time, zone]
[Enroll now] or [Schedule enrollment]
```

The final button explicitly authorizes selecting the reviewed boxes and submitting enrollment. It is not a reminder-only action and does not require a second extension confirmation after activation. Any known myUHD confirmation must still match that same reviewed operation.

- Selecting rows in the extension is preparation only. Show current portal checkbox state and make unrelated preselected sections visible; resolve them before activation.
- Enable activation only with an identified supported portal tab, one or more unambiguous selected sections, a valid term, and valid timing. Show the reason when disabled; the executor rechecks at action time.
- The summary lists exact section IDs, not only course names. If multiple portal tabs are open, require the student to identify the target. Unknown page structure cannot be treated as ready.
- Now is the default. Schedule requires a future date/time including seconds and an explicit zone (default America/Chicago). Ambiguous or nonexistent daylight-saving times need resolution before arming.
- Before scheduled activation, show that the computer must remain awake and the supported portal tab open, signed in, and foreground during the final countdown. Timing is best effort and enrollment depends on myUHD; do not promise a seat.
- After activation, prevent repeated execution and show one of the states below. Closing the launcher popup does not cancel or restart the job.

| State | Visible message/action |
| --- | --- |
| Armed | Scheduled date/time/zone, section summary, countdown, Cancel enrollment |
| Preflight | Checking selected classes; cancellation remains available before submission |
| Executing | Submitting selected classes; duplicate activation disabled |
| Cancelled | Enrollment cancelled before submission; explicit review required to start again |
| Expired / needs review | Schedule expired or page changed; Review enrollment, never auto-replay |
| Result | Per-section Enrolled, Waitlisted, Rejected/full, or Unknown with portal message where available |
| Unknown outcome | Could not confirm enrollment. Check myUHD before trying again. No automatic retry |

Mixed outcomes show a per-section list, not a blanket success message. Cancel after the submit boundary cannot reverse enrollment; explain this and link back to myUHD. Never offer an automatic drop as rollback. Changing the reviewed selections of an armed job requires cancelling it and explicitly scheduling again.

## Visual and accessibility rules

Required design references: **Taste Skill and Impeccable**, as requested by the user. Follow [DESIGN_GUIDANCE.md](DESIGN_GUIDANCE.md) for the reviewed revisions, app-specific interpretation, and visual QA workflow. The rules below remain behavioral and accessibility constraints; select the final visual direction during the first UI implementation.

Use the planner's restrained cards, neutral surfaces, readable text and one accent color. Preserve the specific card positions above rather than reusing the graph-based planner component directly. Exact CSS tokens belong to implementation, not this scope task.

All actions have visible labels and keyboard access. Dragging has a day/start/end form equivalent. Focus returns to the originating action when an editor/dialog closes; Escape cancels dialogs without submitting. Errors are adjacent to fields; status changes are announced without stealing focus. Never communicate conflict, rating, or enrollment outcome by color alone.

At narrower desktop widths, move the tray above the grid and allow a labeled horizontal grid scroll. Keep navigation and primary actions visible. Mobile browser support remains deferred.

## Acceptance and next handoff

- [x] Required/deferred features and A/B ownership are explicit.
- [x] Popup, dashboard tabs, timetable, professors, planner and enrollment screens are mapped.
- [x] Blank-card lifecycle and exact professor/title/room positions are specified.
- [x] Enrollment activation includes selection and submission for Now and Schedule.
- [x] Missing ratings, timing limits, partial/unknown results and keyboard alternatives are specified.
- [x] No portal selectors, verified API access, teammate approval or working screens are claimed.

Task **02A** now defines the [shared records, validation rules and message contracts](CONTRACTS.md). See [STATUS.md](STATUS.md) for the current next task. B task **01B** remains ready and independent: inspect the real myUHD flow and record only observed, anonymized facts. If those observations require a UI change, update this spec in that task instead of silently diverging.
