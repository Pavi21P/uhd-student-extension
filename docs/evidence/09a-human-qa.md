# 09A independent human QA checklist

09A remains incomplete until **two people independently run this checklist**. Automated agent runs are supporting evidence, not human sign-off. Each person should use their own browser profile and record their own observations before comparing notes.

## Setup

Use a separate Chrome or Edge profile with synthetic course data. Build this review branch, not main (the feature PRs are still stacked and unmerged):

```sh
git fetch origin
git switch test/09a-browser-qa
npm ci
npm run check
```

Use the pinned Node/npm versions in README. Load `dist` with Developer mode / Load unpacked at `chrome://extensions` or `edge://extensions`. A normal web preview cannot test extension persistence. Record the commit from `git rev-parse HEAD` and browser version. Do not test real enrollment or upload real student data.

## Run independently

1. Open the extension popup and select **Open timetable**. Add a course, leave it blank, and Cancel. Reload: the blank card should still exist with placeholders, not invented data.
2. Edit that card: Course name `QA Algorithms`, Course code `TEST 3300`, Professor `Dr. Example`, Room `Demo 210`. Add Monday **09:07–10:23** and Wednesday **09:07–10:23**. Save. Confirm two exact-time meetings and the professor/title/room layout.
3. Select Monday's meeting using the keyboard. ArrowDown should propose **09:15–10:31**. Cancel once and verify nothing changed. Repeat and Save; Wednesday must remain **09:07–10:23**. The form can also edit exact minutes.
4. Edit the course room to `Demo 211`. Try an end before the start and Save: the error must preserve input without changing saved meetings. Correct it and Save. Check both occurrences use the new room.
5. Add another blank course and Cancel. It should remain unscheduled. Long optional text must remain available through the editor/list; no field is required.
6. Use **Download backup** and confirm the browser downloads JSON. It should contain the two courses and both saved meetings, including exact times and blank fields. View settings and the separate planner are excluded.
7. Close the dashboard, reopen through the popup, then close and reopen the browser/profile. Confirm the same courses, meetings, room and times remain. Reload once more.
8. Choose **Import backup**, select that file, inspect the preview, then **Cancel import**. No courses should be added or removed. Repeating an actual Merge would create new copies; replacement removes the current timetable, so neither is needed for this acceptance check.
9. Open **Planner**, activate **Open course planner**, and verify it loads in a separate tab. Return to the extension: timetable data must remain intact. The planner saves separately.
10. At **200% browser zoom**, use **Go to meeting list** and edit a meeting through the list. Confirm all details and Save/Cancel remain usable. Reset zoom afterward.

For any failure, record the step, expected/actual result and reproduction details. Use synthetic screenshots only. Do not mark a step passed if it was skipped or uncertain.

## Separate results

| Reviewer | Browser/version | Commit | Steps 1–10 | Failures | Date |
| --- | --- | --- | --- | --- | --- |
| Pavitra | Pending | Pending | Pending | Pending | Pending |
| Teammate (name) | Pending | Pending | Pending | Pending | Pending |

Send each result separately, for example:

> Reviewer: …; Browser/version: …; Commit: …; Steps passed: …; Failed/skipped steps: …; Reproduction notes: …; Date: …

A second browser run by the same person is useful but does not replace the second independent reviewer. Only record sign-off after both people provide results and any failures are resolved. No alpha tag or release is implied by this checklist.