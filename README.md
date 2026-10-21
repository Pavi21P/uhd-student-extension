# UHD Student Extension

A planned Chrome/Edge extension for UHD students: professor ratings, a link to the existing course planner, a weekly timetable, and user-armed enrollment assistance for myUHD.

**Status: planning only. No extension has been implemented or tested yet.**

## Start here

- [Detailed build plan and daily tasks](docs/BUILD_PLAN.md)
- [Screen layouts and interaction specification (01A)](docs/UI_SPEC.md)
- [Current checkpoint and next task](docs/STATUS.md)
- [Two-person GitHub workflow](CONTRIBUTING.md)
- [Instructions for focused AI work sessions](AGENTS.md)
- [Research, references, and unresolved feasibility questions](docs/REFERENCES.md)

## Planned features

| Feature | Initial scope |
| --- | --- |
| Professor ratings | Connect a professor's RMP profile; show verified-source ratings in the extension and beside supported myUHD professor rows, subject to a working permitted data source. |
| Course planner | A dedicated tab linking to https://uhd-course-planner.pages.dev. |
| Timetable | Blank, editable course cards placed on a weekly grid; professor at top left, course name centered, room at bottom left. |
| Enrollment | User presses the extension button to enroll now or arm a scheduled action; select the reviewed course boxes and submit through myUHD. |
| Progress chart | Optional later: completed versus remaining courses in a defined personal plan. |

This is an independent student project, not an official UHD or RateMyProfessors product. Timed browser actions cannot guarantee an exact execution time or a seat. Actual enrollment status comes from myUHD.

## Collaboration

The plan contains 20 paired workdays, with one small, reviewable task per teammate per day. These are estimates and task slots, not a deadline or a reason to create empty commits. Use real author identities and commit actual work at the time it happens.

No runtime setup commands exist until the foundation tasks are implemented. Select a license together before distributing code; no license choice is assumed here. See the checkpoint for repository setup and implementation status.
