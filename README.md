# UHD Student Extension

A Chrome/Edge extension for UHD students: professor ratings, a link to the existing course planner, a weekly timetable, and user-armed enrollment assistance for myUHD.

**Current build: timetable tools plus a professor profile-link preview (10A).** Create blank cards, edit optional details, and add independent weekday meetings with exact 24-hour times. Crowded days widen inside the scrollable grid so overlapping cards remain readable. Go to meeting list exposes full course details and editing, including very short meetings. The grid reflects each duration, warns about overlaps, and retains access to meetings outside your chosen days/hours. Save the view in Settings. Course and view drafts survive navigation. Other open dashboard tabs refresh automatically; incoming changes preserve drafts and require review before saving. Failed or uncertain saves still require an explicit reload/review. Live ratings and enrollment remain unavailable.

## Run locally

Use Node **24.21.0** and npm **12.2.1** (pinned in `.node-version` and `package.json`). If your Node installation ships another npm version, install the pinned version with `npm install --global npm@12.2.1`.

```sh
npm ci
npm run check
```

`check` runs lint, 297 unit tests, strict TypeScript checking, and the production build. The build verifies the MV3 entrypoints and bundled assets. Output goes to `dist/`, which is intentionally ignored by Git.

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**, choose **Load unpacked**, and select this repository's `dist` folder.
3. Open the extension's toolbar popup and select **Open timetable**. Extension options opens the same dashboard.
4. In Timetable, choose **Add course**. The blank card is saved immediately. Fill optional details and choose **Save course**; **Cancel** discards edits while keeping the saved card. After a save failure, use **Reload saved courses** and review before retrying.
5. In the course editor, choose **Add meeting**, select a day, and enter start/end times such as **09:07** and **10:23**. Choose **Save course** to save details and meetings together. Use **Settings** to save visible days and hours; **Show meetings** temporarily reveals anything outside that view. Drag an unscheduled card onto the week, drag a meeting to move it, or drag its bottom handle to resize. Drops propose times in the editor; choose **Save course** or **Cancel**. Dragging snaps to 15 minutes. With a meeting focused, arrow keys propose a move; Shift + Up/Down proposes a resize. Enter opens exact editing.
6. Use **Download backup** to save timetable-only JSON. **Import backup** validates files up to 1 MiB and previews **Merge as new courses** or **Replace this timetable** before confirmation. Merge adds separate copies, including on repeated imports; replace removes current timetable content. View settings and planner data are not included.
7. Select **Planner**, then **Open course planner**. It opens https://uhd-course-planner.pages.dev in a new tab; planner data saves separately.
8. Select **Professors** to review a professor name and RMP profile link. The draft survives navigation but clears on reload; school, identity and ratings are not verified. An optional disclosure previews clearly labeled sample rating states.
9. After source changes, run `npm run build` and reload the extension on the extensions page.

For UI development, run `npm run dev` and open the printed local URL with `/dashboard.html` or `/popup.html`. This previews ordinary web pages; it does not load an extension. Course persistence requires the unpacked extension; the web preview explains that storage is unavailable. `npm run build:watch` rebuilds the unpacked files, but browser extension reloads remain manual. Run `npm run check` before submitting changes.

Task 11A provides a reusable inline professor badge and a development fixture. Run `npm run dev` and open `/tests/fixtures/professor-badges.html` to inspect it. The fixture is excluded from the production extension; badges are not yet injected into myUHD.

The foundation requests only `storage`; it has no host permissions or connection to myUHD. A module background worker owns schedule/settings writes and accepts commands only from this extension's dashboard. Fonts and scripts are bundled locally. Validated `professor.lookup` requests return `unavailable / provider-unconfigured` without network or cache access. Association and enrollment commands still return `FEATURE_UNAVAILABLE`.

## Extension regression smoke test

After installing dependencies, install Playwright's Chromium once, build the extension, and run the maintained synthetic journey:

```sh
npx playwright install chromium
npm run check
npm run test:e2e
```

`test:e2e` loads the existing `dist` build, so rebuild after application edits. It uses its own headless Chromium and a fresh profile under ignored `test-results/`, not your signed-in browser or the Codex browser connection. It verifies blank cards, exact meetings, keyboard Save/Cancel, invalid-time recovery, JSON export, browser restart persistence, cancelled import and a planner link intercepted with synthetic content. HTTP requests from test pages are intercepted or blocked; no live planner availability, RMP or myUHD behavior is claimed. A JSON report is written to `test-results/e2e-results.json`. No personal profile path or credentials are needed.

[09B evidence](docs/evidence/09b-extension-e2e.md) records validation. The portal-loading portion still requires 01B/04B; this test is not either human 09A sign-off.

## Continuous integration

[Checks](.github/workflows/checks.yml) runs `npm ci` and `npm run check` on Ubuntu and Windows for every pull request (including stacked PRs), pushes to `main`, and manual dispatch when available on the default branch. Node comes from `.node-version`; npm comes from `package.json`'s `packageManager`. Dependency caching stores npm downloads, not `node_modules`; the lockfile still controls installation.

These checks cover lint, unit tests, TypeScript, the MV3 build and the isolated Chromium extension smoke test above. CI installs Chromium with its system dependencies before `test:e2e`. It does not run signed-in myUHD actions, live ratings, real Chrome/Edge acceptance, or the two human QA passes. See [04B CI evidence](docs/evidence/04b-ci.md) for the verified run and remaining fixture dependency.

## Start here

- [Detailed build plan and daily tasks](docs/BUILD_PLAN.md)
- [Current checkpoint and next task](docs/STATUS.md)
- [Foundation verification and screenshots](docs/evidence/03a-foundation.md)
- [Storage and messaging verification (03B)](docs/evidence/03b-storage-messaging.md)
- [Navigation and planner verification (04A)](docs/evidence/04a-navigation-planner.md)
- [Course editor verification (05A)](docs/evidence/05a-course-editor.md)
- [Meeting validation and conflicts (05B)](docs/evidence/05b-meeting-validation.md)
- [Weekly grid, manual placement and view settings (06A)](docs/evidence/06a-weekly-grid.md)
- [Cross-tab updates and recovery (06B)](docs/evidence/06b-cross-view-recovery.md)
- [Drag placement, move/resize and keyboard editing (07A)](docs/evidence/07a-meeting-drag.md)
- [Timetable backup and reviewed import (07B)](docs/evidence/07b-timetable-backup.md)
- [Overlap readability and responsive timetable (08A)](docs/evidence/08a-timetable-readability.md)
- [Storage/import/recurrence regressions (08B)](docs/evidence/08b-timetable-regressions.md)
- [Browser QA handoff (09A, human acceptance pending)](docs/evidence/09a-browser-qa.md)
- [Professor profile preview and sample states (10A)](docs/evidence/10a-professor-preview.md)
- [Inline badge component and synthetic enrollment fixture (11A)](docs/evidence/11a-professor-badges.md)
- [Two-person QA checklist](docs/evidence/09a-human-qa.md)
- [myUHD inspection checklist (01B)](docs/evidence/01b-inspection-checklist.md)
- [Portal map: live observations pending](docs/evidence/portal-map.md)
- [RMP source decision and remaining access blocker (02B)](docs/evidence/rmp-source.md)
- [Validated provider fallback and browser checks (10B)](docs/evidence/10b-provider-fallback.md)
- [Preliminary Chrome/Edge timer measurements (02B)](docs/evidence/timing-report.md)
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
