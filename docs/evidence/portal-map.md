# myUHD portal map — 01B

Status: **Partial screenshot evidence received; DOM and enrollment flow unverified; G1 not passed.** Prepared 2026-10-25; updated 2026-10-26. The user supplied a Shopping Cart screenshot and reports registration has not started. The user reassigned live inspection to Codex on 2026-10-26; use the existing [inspection checklist](01b-inspection-checklist.md). Browser access failed before inventory, including after reset; no live browser content was inspected. The later user-supplied screenshot supports only the visual observations below. No supported adapter, host permission or safe selector has been established.

## Evidence ledger

| ID | Evidence / date | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| U1 | User requirements, recorded in BUILD_PLAN.md | Target is myUHD; explicit extension activation must select reviewed course boxes and submit. | Exact route, DOM, origins, confirmations or outcomes. |
| P1 | [UHD registration guide](https://www.uhd.edu/documents/registrar/students/registration-services/registration-guide.pdf), November 2023; read 2026-10-25 | Public orientation: Manage Classes, Class Search and Enroll, term selection, preferences, review/submission and status. Shopping Cart has course boxes and enrollment/delete/validation actions; adding to the cart alone is not enrollment. | Current authenticated behavior, URLs, frame placement, identifiers, selector compatibility or permission to automate. |
| F1 | [11A synthetic fixture](11a-professor-badges.md), 2026-10-25 | Badge interactions preserve the fixture's checkboxes and submit behavior. | Any myUHD structure or live compatibility. |
| S1 | User-supplied screenshot, visually reviewed 2026-10-26; image not copied into repository | Manage Classes > Shopping Cart; a displayed term; selectable table rows; separate Class, Description and Instructor columns; checked and unchecked appearances; Delete visible; no Enroll button visible in the captured viewport. Address bar displays host saprd.my.uh.edu. | DOM tags/attributes, accessible names, frame origins, unique/stable identifiers, control behavior, offscreen controls, registration timing, confirmations or outcomes. |
| U2 | User statement, 2026-10-26 | User reports the Enroll option is absent because registration has not started. | Independently verified opening time or proof that registration timing is the only cause of a missing control. |
| U3 | User statement, 2026-10-26 | User reports Enroll usually appears to the left of Delete. | Current button presence, exact label, DOM identity, enabled conditions or action sequence; not visible in S1. |
| L1 | Direct live browser inspection | None; browser connection fails before tab inventory. | DOM and interactive behavior remain unknown. |

S1 confirms that Shopping Cart is the visible checkbox surface supplied by the user. It does not establish the eventual submission sequence. Do not assume the search wizard and shopping cart have the same submission steps.

## Inspection record

| Field | Observation |
| --- | --- |
| Inspector / second reviewer | Pending / Pending |
| Observation date / browser version | Screenshot reviewed 2026-10-26 / Chrome interface visible, version unknown |
| Observed route and page purpose | Manage Classes > Shopping Cart; heading Your Shopping Cart (S1) |
| Top-level origin (scheme, host, port only) | Visible hostname saprd.my.uh.edu (S1); full origin and frame relationship unverified |
| Frame origin / frame identification method | Unknown |
| Portal usage constraints and source | Unknown |
| Changes from public guide | Unknown |

Only general structure and synthetic values belong below. Add evidence IDs with method/date for observed facts. Do not insert private records or token-bearing URLs.

## State inventory

| State | How it is recognized | Controls / next state actually observed | Evidence |
| --- | --- | --- | --- |
| Signed out / expired session | Unknown | Unknown | None |
| Term selection / selected term | A term heading is visible; actual value omitted | Selection mechanism unknown | S1 |
| Course search / results | Unknown | Unknown | None |
| Shopping cart / selectable course rows | Your Shopping Cart table with Select column | Checkbox appearances visible; behavior untested | S1 |
| Disabled / unavailable row | Unknown | Unknown | None |
| Existing checked rows / exact selection review | Checked and unchecked appearances visible; no row details retained | Exact selection boundary and interaction unknown | S1 |
| Final submission control | No Enroll button visible in captured viewport; Delete visible | Submission behavior unknown; user reports registration not open and Enroll usually left of Delete | S1, U2, U3 |
| Additional confirmation | Unknown; do not assume absent | Unknown | None |
| Submission pending | Unknown | Unknown | None |
| Per-section enrolled / waitlisted / rejected | Unknown | Unknown | None |
| Partial / uncertain outcome | Unknown | Unknown | None |
| Rerender / navigation / frame replacement | Unknown | Unknown | None |

## Element and identity inventory

| Element | Attribute/label and sanitized pattern | Uniqueness/stability evidence | Adapter decision |
| --- | --- | --- | --- |
| Term marker | Unknown | None | Blocked |
| Section/class identifier | Unknown | None | Blocked |
| Course/catalog display | Unknown | None | Blocked |
| Row container / selectable control | Unknown | None | Blocked |
| Checked and disabled state mechanism | Unknown | None | Blocked |
| Instructor(s) / department if present | Instructor column contains abbreviated names; values omitted (S1) | DOM relationship and identity matching unverified | Blocked |
| Badge placement outside controls/labels | Unknown | None | Blocked |
| Review / submit / confirmation controls | Unknown | None | Blocked |
| Pending / per-section outcome markers | Unknown | None | Blocked |
| Session-expiry / unsupported-page marker | Unknown | None | Blocked |

No selectors are approved. Do not use placeholder selectors as adapter constants or guess portal origins when adding permissions. An attribute's name is not evidence that its value is stable or unique.

## Missing-enrollment-control state

Record the observed state as **enrollment action unavailable**, with registration-not-open as user-reported context (U2). A missing button alone cannot establish the cause or an opening time. Later implementation must stop if the expected action is absent or ambiguous; Delete must never be treated as a substitute action. Reinspect after registration opens to establish the actual review/submit/confirmation/result sequence. No exact-second timing claim is supported by this screenshot. U3 supplies a location to inspect when the control appears, not a selector: never identify the action solely by coordinates, sibling position or proximity to Delete.

The screenshot, URL path/query, actual term, instructor names, course identifiers, meeting details and selection-to-course mapping are not saved in the repository. No portal controls were activated.

## Select-and-submit questions

- How does the page identify the exact term and selected sections?
- Can checked rows outside the reviewed selection be identified and safely deselected? What happens with disabled or non-native controls?
- Does a control submit immediately or navigate to review? Which confirmations are required, and what is the stop condition for an unexpected one?
- How does each section receive an authoritative result? Which cases must remain unknown and prevent a retry?
- What observable signals indicate loading, stale state, session expiry, document replacement or unsupported pages?

All answers are **unknown** until recorded with live evidence. The final feature must select and submit after explicit activation; stopping at a reminder or checkbox selection does not complete it. Discovery itself does not execute that feature.

## Acceptance and handoff

- [ ] Current supported page and frame origins observed.
- [ ] Stable unique term/section identities established without personal-data selectors.
- [ ] Checkbox semantics, prechecked/disabled cases and exact selection boundary observed.
- [ ] Submission/confirmation sequence and result signals recorded; unknowns explicitly separated.
- [ ] Instructor extraction/badge location and rerender constraints recorded.
- [ ] Applicable portal usage constraints checked and unresolved questions recorded.
- [ ] Sanitized findings reviewed by the other teammate; no private captures in Git.
- [ ] Later synthetic adapter fixtures reflect observations and pass their assigned task checks.

01B is incomplete. Its core deliverable is the observed, anonymized map; later fixture implementation belongs to 04B/15B and contributes to the broader G1 gate. Do not mark G1 passed merely because this worksheet exists. Tasks needing observed portal facts (including 14A/11B) remain blocked. Next action: restore browser access and have the user open their signed-in enrollment page; Codex then performs the checklist and records sanitized observations. No downstream portal task is ready until its required observations are available.
