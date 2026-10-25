# myUHD portal map — 01B

Status: **Pending live observation; G1 not passed.** Prepared 2026-10-25. The user reported that the teammate has not inspected the flow; no live findings have been supplied. B retains live inspection ownership; A prepared the [inspection checklist](01b-inspection-checklist.md). No supported adapter, host permission or safe selector has been established.

## Evidence ledger

| ID | Evidence / date | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| U1 | User requirements, recorded in BUILD_PLAN.md | Target is myUHD; explicit extension activation must select reviewed course boxes and submit. | Exact route, DOM, origins, confirmations or outcomes. |
| P1 | [UHD registration guide](https://www.uhd.edu/documents/registrar/students/registration-services/registration-guide.pdf), November 2023; read 2026-10-25 | Public orientation: Manage Classes, Class Search and Enroll, term selection, preferences, review/submission and status. Shopping Cart has course boxes and enrollment/delete/validation actions; adding to the cart alone is not enrollment. | Current authenticated behavior, URLs, frame placement, identifiers, selector compatibility or permission to automate. |
| F1 | [11A synthetic fixture](11a-professor-badges.md), 2026-10-25 | Badge interactions preserve the fixture's checkboxes and submit behavior. | Any myUHD structure or live compatibility. |
| L1 | Live observation | **None received.** | All live facts remain unknown. |

Inference to verify: the requested checkbox flow may be on Shopping Cart. Do not assume the search wizard and shopping cart have the same submission steps.

## Inspection record

| Field | Observation |
| --- | --- |
| Inspector / second reviewer | Pending / Pending |
| Observation date / browser version | Unknown / Unknown |
| Observed route and page purpose | Unknown |
| Top-level origin (scheme, host, port only) | Unknown |
| Frame origin / frame identification method | Unknown |
| Portal usage constraints and source | Unknown |
| Changes from public guide | Unknown |

Only general structure and synthetic values belong below. Add evidence IDs with method/date for observed facts. Do not insert private records or token-bearing URLs.

## State inventory

| State | How it is recognized | Controls / next state actually observed | Evidence |
| --- | --- | --- | --- |
| Signed out / expired session | Unknown | Unknown | None |
| Term selection / selected term | Unknown | Unknown | None |
| Course search / results | Unknown | Unknown | None |
| Shopping cart / selectable course rows | Unknown | Unknown | None |
| Disabled / unavailable row | Unknown | Unknown | None |
| Existing checked rows / exact selection review | Unknown | Unknown | None |
| Final submission control | Unknown | Unknown | None |
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
| Instructor(s) / department if present | Unknown | None | Blocked |
| Badge placement outside controls/labels | Unknown | None | Blocked |
| Review / submit / confirmation controls | Unknown | None | Blocked |
| Pending / per-section outcome markers | Unknown | None | Blocked |
| Session-expiry / unsupported-page marker | Unknown | None | Blocked |

No selectors are approved. Do not use placeholder selectors as adapter constants or guess portal origins when adding permissions. An attribute's name is not evidence that its value is stable or unique.

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

01B is incomplete. Its core deliverable is the observed, anonymized map; later fixture implementation belongs to 04B/15B and contributes to the broader G1 gate. Do not mark G1 passed merely because this worksheet exists. Tasks needing observed portal facts (including 14A/11B) remain blocked. Next ready action: B performs the checklist and returns the minimum useful reply; A can incorporate those observations without changing their meaning.
