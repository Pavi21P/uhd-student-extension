# UHD Student Extension

A Chrome/Edge extension for UHD students: professor ratings, a link to the existing course planner, a weekly timetable, and user-armed enrollment assistance for myUHD.

**Current build: loadable Manifest V3 foundation (03A).** The popup opens a responsive dashboard preview. Course editing, saved schedules, working destination tabs, ratings, and enrollment are not implemented yet.

## Run locally

Use Node **24.21.0** and npm **12.2.1** (pinned in `.node-version` and `package.json`). If your Node installation ships another npm version, install the pinned version with `npm install --global npm@12.2.1`.

```sh
npm ci
npm run check
```

`check` runs lint, four launcher tests, strict TypeScript checking, and the production build. The build verifies the MV3 entrypoints and bundled assets. Output goes to `dist/`, which is intentionally ignored by Git.

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**, choose **Load unpacked**, and select this repository's `dist` folder.
3. Open the extension's toolbar popup and select **Open timetable**. Extension options opens the same dashboard.
4. After source changes, run `npm run build` and reload the extension on the extensions page.

For UI development, run `npm run dev` and open the printed local URL with `/dashboard.html` or `/popup.html`. This previews ordinary web pages; it does not load an extension. `npm run build:watch` rebuilds the unpacked files, but browser extension reloads remain manual. Run `npm run check` before submitting changes.

The foundation requests no browser permissions or host access. Fonts and scripts are bundled locally. There is no background worker or connection to myUHD in this build.

## Start here

- [Detailed build plan and daily tasks](docs/BUILD_PLAN.md)
- [Current checkpoint and next task](docs/STATUS.md)
- [Foundation verification and screenshots](docs/evidence/03a-foundation.md)
- [Screen layouts and interaction specification](docs/UI_SPEC.md)
- [Design references: Taste Skill and Impeccable](docs/DESIGN_GUIDANCE.md)
- [Recorded visual direction and tokens](DESIGN.md)
- [Shared records, validation rules, and messages](docs/CONTRACTS.md)
- [Two-person GitHub workflow](CONTRIBUTING.md)
- [Instructions for focused AI sessions](AGENTS.md)
- [Research and unresolved feasibility questions](docs/REFERENCES.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

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

The contributors have not selected a license for this project's own code. Dependency license notices are retained in `public/licenses/` and included in the build.
