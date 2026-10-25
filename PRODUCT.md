# UHD Student Extension

A desktop Chrome/Edge extension for UHD students planning a term and preparing to enroll.

## Product truth

- Students manually enter course-card details and place meetings on a weekly timetable.
- Card positions are fixed: professor top left, course name centered, room bottom left.
- Professor ratings must come from a permitted source with identity, review count and freshness. Missing data is not zero.
- The existing course planner remains a separate website and separately scoped project.
- Enrollment requires the student to activate the reviewed selection-and-submission sequence. Scheduled execution cannot guarantee a seat or exact timing.
- Local data first. No login credentials or private enrollment data belong in the repository.

## Current scope

Tasks 03A through 05B provide the MV3 package, validated background storage, navigation, planner link, course editor and meeting validation. Task 06A adds manual meeting rows, exact weekly placement, overlap warnings, an accessible meeting list, and saved visible days/hours. Course details and meetings save together with revision checks and explicit recovery after an uncertain save. Task 06B refreshes open dashboard views from saved changes while retaining drafts for explicit review. Invalid records remain intact and block writes; transient failures recover by explicit reload. Task 07A adds in-page drag placement, independent occurrence movement/resizing and keyboard proposals. Drops open editable drafts; Save course confirms them. Drag interactions snap to 15 minutes, while forms retain exact minute editing. Task 07B downloads timetable-only JSON and previews validated merge/replacement imports. Confirmation uses the single background writer and current revision; stale previews and uncertain outcomes require review. Task 10A adds a session-only professor name/profile-link review and opt-in synthetic rating states. URL validation checks format, not identity or school. Saved associations, live ratings and enrollment remain unfinished.

## Design commitments

Use Taste Skill and Impeccable as requested; see [the reference record](docs/DESIGN_GUIDANCE.md). Keep the established UI specification, familiar controls, readable density, and truthful feature states. The primary developer is using TypeScript because browser APIs and existing shared contracts fit it; the user's openness to other languages does not require another runtime.

## Collaboration

A owns the interface; B owns portal/provider discovery and integration. Work one task at a time. [STATUS.md](docs/STATUS.md) is the current handoff.
