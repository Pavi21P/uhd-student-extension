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

Task 03A created the MV3 package, popup launcher and dashboard shell. Task 03B adds validated schedule/settings storage and typed messages behind the preview. The visible course card and weekly area remain previews, with no editor connected to storage yet. Working dashboard tabs, planner navigation, timetable editing, ratings and enrollment remain later tasks.

## Design commitments

Use Taste Skill and Impeccable as requested; see [the reference record](docs/DESIGN_GUIDANCE.md). Keep the established UI specification, familiar controls, readable density, and truthful feature states. The primary developer is using TypeScript because browser APIs and existing shared contracts fit it; the user's openness to other languages does not require another runtime.

## Collaboration

A owns the interface; B owns portal/provider discovery and integration. Work one task at a time. [STATUS.md](docs/STATUS.md) is the current handoff.
