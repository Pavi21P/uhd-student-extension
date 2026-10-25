# 09A: browser QA handoff — human acceptance pending

Status: **not complete**. On 2026-10-24 the user confirmed neither human reviewer had run the checklist yet and requested that it be prepared. [Independent human checklist](09a-human-qa.md) has setup, expected results and two separate pending sign-off rows. The build plan requires two people; agent runs do not satisfy that gate.

## Automated supporting evidence

Tested source commit: **9737c8fe0692b829d5bb1ddd9ed73906347fa659** (08B). This review branch changes documentation only; it contains the same application source. [Structured results](09a-browser-results.json) record the actual outcomes.

Installed Chrome **156.0.8078.47** and Edge **155.0.4283.62**, both headless with isolated persistent synthetic profiles, passed:

1. Popup launcher opens the dashboard; Add blank course / Cancel / Reload retains an empty saved card.
2. Optional course details and Monday/Wednesday **09:07–10:23** save together through the visible form.
3. Keyboard movement proposes Monday **09:15–10:31**; Cancel preserves all data, Save changes only Monday.
4. An end-before-start error retains the draft without changing saved data; correction saves a new shared room.
5. Adding another blank course and downloading an actual JSON file round-trips both courses and exact meetings, excluding settings/planner data.
6. Dashboard close/reopen and a complete browser-process close/relaunch preserve the timetable; another reload does too.
7. Selecting the downloaded file validates the import preview; Cancel leaves saved state unchanged.
8. The planner link opens by keyboard in a separate tab, returns **HTTP 200**, renders planner content and has no opener; returning leaves extension data unchanged. The separate planner application was not modified.
9. Actual **200% tab zoom** preserves list/form editing, modal Escape and document bounds without changing saved data.

No page errors or reproducible application defect occurred. No production changes were needed. The last full integration check from 08B passed **217 tests**, lint, strict TypeScript, production build and MV3 validation; unchanged checks were not rerun for this documentation-only task. Browser journey checks above were run fresh for 09A.

## Limits and next action

These are agent-driven browser checks, not human usability observations or screen-reader QA. They do not verify real myUHD enrollment, live RMP ratings, suspended-computer timing or a browser-store release. No alpha tag, PR merge or release was created.

**Resume 09A** when Pavitra and the teammate independently provide browser/version, tested commit, passed/failed steps and reproduction notes using the checklist. Fix and recheck any reported issues before marking 09A complete. Teammate 01B and prior PR reviews remain unchanged. Task 09B's separately scoped E2E setup was not started.
