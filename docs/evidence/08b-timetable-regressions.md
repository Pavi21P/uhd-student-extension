# 08B: storage, import and recurrence regressions

Verified 2026-10-24. Added 15 synthetic integration regressions in tests/unit/timetable-regressions.test.ts. No production code, UI, contracts, dependencies or permissions changed.

## Coverage

| Failure boundary | Assertions |
| --- | --- |
| Competing save/import, both arrival orders | Exactly one same-revision writer succeeds; losing update cannot erase the winning edit or merge; one authoritative revision/event. |
| Fresh-target create race, both arrival orders | Create-only save/import cannot replace a target created by the other operation. |
| Caller mutation while import is queued | A gated in-flight read delays import; subsequent mutation of the input cannot alter confirmed course/meeting content. No timing sleeps. |
| Write commits but confirmation fails | Read through a new repository instance finds the committed merge; stale replay is rejected without duplicates. |
| Committed reply closes or times out | Real typed client and authenticated handler run together. Synthetic transport loss returns TRANSPORT_ERROR; advancing fake timers confirms exactly one request/write. |
| Transient read failure or rejected write | Failed replacement leaves target, another timetable and view settings intact; explicit read and later deliberate merge recover without poisoning the queue. |
| Wrong stored identity or exhausted revision, both import modes | Saved data remains structurally identical; no writes/events. |
| Exact course/meeting limits | Merge reaches 250 courses or 1,000 meetings successfully; one additional item is rejected without a write. |
| Imported recurrence lifecycle | Merge remaps IDs; moving one imported occurrence preserves siblings and original course meetings. Export/replacement/reload retains exact values. Removing one meeting and then deleting its course affects only that imported course. |

## Results

- Targeted suite: **15/15 passed**.
- Required npm run check: lint, **217 tests across 12 files**, strict TypeScript, production build and MV3 artifact validation passed.
- The new suite exercises real validators, serialized repository operations, RPC client/handler and course/placement helpers. Only storage and transport boundaries are synthetic. No production defect was reproduced, so no production-code changes were needed.
- Fake timers cover the real client timeout without waiting ten seconds. Repository reconstruction proves persisted-record reload behavior; it does not simulate Chrome service-worker termination.
- UI/browser checks were not rerun for this test-only change. Prior 08A evidence remains separate; this task makes no new live portal, RMP, screen-reader or two-person QA claims.

## Handoff

Next ready: **09A**, browser QA and any resulting timetable/planner fixes. Its completion criterion requires two people independently performing create/place/edit/export/reload; one agent's runs cannot satisfy that gate. Teammate 01B portal mapping, existing PR reviews and live provider/enrollment gates remain unchanged. Stop after 08B.
