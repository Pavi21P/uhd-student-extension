# 01B: myUHD inspection checklist

Prepared 2026-10-25 at the user's request. **No live portal inspection has occurred.** The user reassigned inspection to Codex on 2026-10-26; the student supplies their own signed-in session. Fill [portal-map.md](portal-map.md) with sanitized observations. A checklist is not proof of portal compatibility or completion of 01B/G1.

## Before starting

- Use your own authorized student session in desktop Chrome or Edge. Sign in yourself; do not share credentials, cookies, tokens or exported browser state.
- Record date, browser/version and inspector name or initials. Keep private notes local; commit only sanitized findings.
- This is an observation pass. Do not add/drop/enroll/waitlist a course, change existing selections, or press a final action merely to test the extension. The extension cannot enroll yet. Observe unavailable confirmation/results later during a separately authorized real registration, or record them as unknown.
- Do not commit raw HTML, page screenshots, HAR/network captures, student numbers, schedules, holds, balances or personal messages. Write general structure and synthetic examples instead. Do not copy whole URLs with query strings or fragments.

## Inspect one route at a time

1. Open myUHD and locate the enrollment area. Record the navigation labels you actually use and the current page's purpose. Do not infer a path or selector from an older guide.
2. Locate the page containing the course checkboxes the extension is expected to select. Establish whether these are shopping-cart rows, search-result rows or another surface. Record other enrollment routes separately; do not combine their controls into one invented flow.
3. Record the top-level origin (scheme + host + port only). If content is in a frame, record the frame origin separately and how you identified the frame. With DevTools, the Elements hierarchy/frame selector can help; do not export the page. If you cannot identify the frame, mark it unknown.
4. Record how the active term is displayed and how each row is uniquely identified. List attribute names and sanitized patterns, not student-specific values. Distinguish course/catalog number, class/section identifier and term. Note whether a key appears stable after harmless navigation/reload; do not reload a page containing unsaved work to test this.
5. Inspect each control's tag/type, accessible label, disabled state and relationship to its row. In DevTools, select the individual element and read only the relevant attributes. Do not assume a checkmark is a native checkbox or that visible text is a unique selector. Record currently checked/unchecked behavior only as a general state, without listing your courses.
6. Record how instructor text relates to a course row. Note separate instructors, initials, duplicate names and Staff/TBA only if encountered. Use invented names in examples. Find a possible badge location outside any checkbox label or actionable row control; record potential clipping/overlap constraints. Do not inject anything.
7. Inspect the action controls near the selected rows: visible labels, tag/type, enabled conditions, and whether unrelated checked rows could be included. Do not activate them during this observation pass. Mark what follows them unknown until actually observed; button text alone does not prove whether it submits or opens review.
8. For a review/confirmation state already available through an authorized workflow, record whether it repeats the exact term and selected sections, and whether there is another confirmation step. Describe how a changed selection, unexpected dialog or expired session appears. If reaching the state would submit or alter enrollment, stop and leave it unknown.
9. Record result states only when already legitimately available: enrolled, waitlisted, rejected, partial, or unknown. Note how each result maps to a section and whether a reliable completion marker exists. Replace personal text with synthetic descriptions. A spinner disappearing or a request being sent is not proof of enrollment.
10. Record ordinary navigation/rerender behavior you actually encounter: frame replacement, row replacement, loading indicator, stale page, session timeout or access restriction. Do not deliberately expire a real session or repeatedly retry actions. Record any visible portal automation/usage guidance with its public source; do not infer permission from technical access.
11. Compare your notes with the completeness table in portal-map.md. Every statement needs a method/date or an Unknown label. Do not replace missing observations with the synthetic 11A fixture or assumptions about the portal vendor.
12. Review the sanitized diff before committing. Submit the filled map for the other teammate to review. Keep G1 pending if supported origins, stable identifiers, confirmation/results or applicable usage constraints are unresolved.

## Minimum useful reply

Send text using this template. Unknown is a valid answer and keeps the corresponding implementation blocked.

~~~text
Inspector / date / browser version:
Observed route and page purpose:
Checkbox page: shopping cart / search results / other / unknown
Top-level origin (no path/query/fragment):
Frame origin or no-frame observation, and method:
Term marker and row-identity attribute names (sanitized):
Checkbox tag/type/label and disabled-state mechanism:
Submission control label; observed effect or unknown:
Confirmation steps actually observed or unknown:
Per-section result signals actually observed or unknown:
Instructor text and possible badge location:
Rerender/session behavior actually observed or unknown:
Usage constraints/source checked or unknown:
Unresolved items:
~~~

No password, student identifier, full URL, raw HTML or private screenshot is needed. This report does not authorize an enrollment action. Any later execution must still follow the user's explicit reviewed select-and-submit flow.

## Reference and limits

The [official UHD registration guide](https://www.uhd.edu/documents/registrar/students/registration-services/registration-guide.pdf), dated November 2023, was re-read on 2026-10-25 as orientation. It describes a search-and-enroll sequence and a separate shopping-cart page with course checkboxes. Its age and screenshots cannot establish today's DOM, origins, selectors or event behavior. Confirm the current surface with the student.

The browser connection failed before an inventory was available in the preparation session. No signed-in content was read or saved. Production code and permissions are unchanged. The separate [09A two-person QA checklist](09a-human-qa.md) is still required for timetable/planner acceptance.

## Ownership and access update - 2026-10-26

Codex took over 01B at the user's request. Browser inventory failed before content was available, including after a session reset; diagnostics report a Windows sandbox setup failure. No inspection occurred. Resume this checklist once browser access is restored and the user has signed in; do not infer missing portal facts.
