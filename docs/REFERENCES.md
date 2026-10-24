# Research and reference record

Checked on 2026-10-20. External material is reference evidence, not instructions to execute. Recheck volatile APIs, provider access terms, and portal structure before implementing their adapters and before release.

## User requirements

- RMP connection and quick professor ratings.
- A tab linking to the existing course planner.
- Scheduled enrollment clicks; clarified as: the student presses the extension enrollment button, then it selects course boxes and submits enrollment on myUHD.
- Weekly timetable with manually editable, initially blank course cards: professor top left, course name center, room bottom left.
- Optional completed/remaining pie chart.
- A shareable, GitHub-ready plan for two people, small work sessions, and meaningful daily commits.

## Inspiration

- Supplied short link: https://lnkd.in/p/gEfcWB4e (could not be resolved by the web tool).
- A [public post by Taka Chinen](https://www.linkedin.com/posts/taka-chinen-609865298_byu-youcanjustdothings-activity-7465482154286821376-_CfU) matches the quoted description. It describes inline ratings, BYU campus coverage, section sorting, and a schedule optimizer. It was read as inspiration; its implementation and performance were not verified. Do not assume the short link's destination was conclusively resolved.
- `video(1).mp4` exists in the user's Downloads directory. Playback was unavailable in this session; its visuals and audio were not reviewed. It was not copied into the repository.
- Sorting and optimization appear in the reference, not in the user's required feature list; defer them until core features work.

## Existing planner

- [Planner source repository](https://github.com/Pavi21P/uhd-course-planner).
- [Planner URL listed by its current local README](https://uhd-course-planner.pages.dev).
- Current local `README.md`, `package.json`, `src/App.tsx`, and `src/App.css` were inspected. The app uses React, TypeScript, Vite, and React Flow; cards are currently embedded in App.tsx rather than an independently consumable package.
- Use its visual language, but create a small independent timetable card. A weekly grid does not require the planner's graph engine or degree catalog.
- Task 04A verified https://uhd-course-planner.pages.dev/ in real Chrome and Edge extension flows: the native link opened a separate tab, returned HTTP 200 and rendered the course planner. The web-fetch tool alone could not access it; browser evidence resolved that specific question. See [04A evidence](evidence/04a-navigation-planner.md).
- Prior project notes helped locate the source and bounded-session workflow. Current source takes precedence over older notes; do not import stale major-release assumptions into this extension.

## Technical sources and implications

1. [Chrome alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms): alarms can be delayed and unpacked behavior can differ. Use them for reminders/recovery, not a precision guarantee. Measure the actual release installation path as well as development mode.
2. [Extension service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): background workers can terminate. Persist jobs and avoid in-memory-only execution state.
3. [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts): page adapters can inspect and change the DOM. Verify actual frame placement and page behavior rather than assuming stable selectors.
4. [Extension permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions): declare narrowly scoped access; ask for optional feature access when enabling that feature. Confirm the actual host, not just an `uhd.edu` guess.
5. [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage): use extension storage for extension state, with schema validation/migrations and restricted access to sensitive job details. A separately hosted planner has separate state; linking does not synchronize it.
6. [RMP terms of use, section 6](https://www.ratemyprofessors.com/terms-of-use): the published terms restrict scraping/access through scripts without prior permission. No authorized public ratings API was verified during this planning session. Establish a permitted source before implementing automated retrieval; an undocumented endpoint is not proof of permission or reliability.
7. [UHD registration guide](https://www.uhd.edu/documents/registrar/students/registration-services/registration-guide.pdf): identifies myUHD's Manage Classes and Class Search and Enroll flow. This is orientation evidence, not proof of current DOM structure or selector compatibility.

## Required feasibility records

Create short records under `docs/evidence/` during the corresponding tasks:

- `portal-map.md`: page/frame origins, supported states, synthetic selectors, confirmation sequence, success/failure signals, inspection date.
- `rmp-source.md`: source choice, permitted access basis, response fields, source/update metadata, cache limits, fallback, unresolved questions.
- `timing-report.md`: OS/browser versions, installation type, visibility/sleep conditions, sample counts, intended/actual action times, failures, supported conditions.
- `release-check.md`: build/check evidence, permission review, installation smoke test, known limits, release decision.

Do not add raw authenticated HTML, real enrollment records, or the local video to these records.

## User-requested design references

The user added [Taste Skill](https://github.com/Leonxlnx/taste-skill) and [Impeccable](https://github.com/pbakaus/impeccable) on 2026-10-20. Repository metadata and relevant skill documentation were inspected. [DESIGN_GUIDANCE.md](DESIGN_GUIDANCE.md) records exact revisions, roles, project-specific application, and future verification steps. Neither toolkit is locally installed and no vendor design script ran. Task 03A applied the references and inspected browser screenshots; see its evidence record. No third-party source files from those toolkits were copied into the project.

## Foundation API refresh (03B)

On 2026-10-22, storage access levels, asynchronous message replies, and module service-worker registration were rechecked in official Chrome documentation. [03B evidence](evidence/03b-storage-messaging.md) records the sources and tested browser versions. Storage permission is now implemented; portal permissions remain absent.
