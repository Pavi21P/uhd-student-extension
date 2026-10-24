# Task 05A — blank course editor and local persistence

Verified 2026-10-23 on Windows. Scope: course cards and their optional details; no meeting editor/grid placement, live ratings, or enrollment execution.

## Implemented

- Add course immediately opens a genuinely blank card. A successful initial save retains it when Cancel closes the editor. Optional title/code/professor/room/color save through the existing dashboard RPC; whitespace-only text is omitted. Failed initial creation is explicitly unsaved and recoverable.
- Professor stays top left, title centered, room bottom left. Full values remain available in the editor and card accessible name. Color uses a small identity marker, preserving text contrast.
- Editor state lives above route views, so dashboard navigation preserves drafts. Cancel/Escape discards unsaved edits. Focus returns to the originating control, or the recovery/Add action when that control is unavailable. A native narrow-screen modal prevents access to background controls.
- Delete removes the course and all its meetings in one validated transaction. Courses with meetings require confirmation displaying the meeting count. Other courses, meetings, labels and timezone survive unchanged.
- Save failures and ambiguous replies keep the draft and stop writes. Reload reads authoritative storage; the user compares saved details, chooses Keep my draft, then explicitly saves. A course deleted by another window cannot be silently recreated. No automatic write retry.
- One primary timetable uses the reserved UUID documented in CONTRACTS.md; new course IDs use random UUIDs. No schema, RPC, background, dependency or permission changes. Unknown/malformed stored data is preserved, not reset. Ordinary web preview does not pretend to have extension storage.

## Validation

`npm run check` passed: oxlint, **95 tests**, strict TypeScript, Vite build and MV3 artifact verification. Final UI polish was followed by lint, typecheck/build and focused browser checks. Five new transaction tests cover genuinely blank records, normalization, stable-ID edits, preservation of unrelated data, atomic deletion, absent/duplicate IDs, invalid input and limits.

Unpacked-extension checks used isolated synthetic profiles in **Chrome 156.0.8078.47** and **Edge 155.0.4283.62**, driven through bundled Playwright and browser-level CDP. Both passed:

1. Blank creation, Cancel retention, exact saved fields, color reset, reload and full browser-process restart.
2. Navigation preserves draft; Escape discards edits; focus restoration; desktop-to-modal resize; narrow-screen background controls stay inert. A first keyboard assertion incorrectly expected Tab to skip browser chrome; it was replaced with checks that focus cannot reach background application controls.
3. Actual two-window revision conflict; stale edits cannot overwrite newly added cards. Reload/review keeps the draft and preserves the other window's course.
4. Actual deletion in another window blocks recreating that course; draft text remains available for copying.
5. Synthetic storage rejection and lost reply after a successful write. Read reconciliation confirms saved state without replaying the write or duplicating a card; deliberate retry works.
6. Confirmation includes the exact number of meetings; Keep course changes nothing; confirmed deletion removes only the selected course and its occurrences in one revision.
7. Rapid repeated Add creates one card. Cancelling a failed creation focuses the recovery action and does not falsely report a saved card.
8. Long values save and truncate on cards; no page-wide horizontal overflow at 320, 390, 768, 1024 and 1440px. Future-version stored records stop editing and remain untouched.

The browser checks also found and fixed the color selector's accessible label. No page errors were reported in the full flows. Detailed local runners and reports are under ignored `.local/` (`smoke-course-editor.mjs`, `final-course-editor.mjs`, `qa/05a-*-report.json`); formal extension E2E infrastructure remains task 09B.

## Visual evidence

Taste app-screen form guidance and Impeccable Operate guidance were read from the pinned reference copies described in DESIGN_GUIDANCE.md. The established sheet, typography, controls and spacing were reused. Screenshots were inspected; no vendor toolkit execution or screen-reader audit is claimed.

- [Desktop editor with synthetic course](05a-editor-desktop.png)
- [390px native editor dialog](05a-editor-narrow.png)
- [Saved cards with long synthetic text](05a-cards-narrow.png)
- [Conflict review retaining draft and saved version](05a-conflict-review.png)

All screenshots use invented academic details. Narrow dialog evidence is an actual viewport capture; full-page views show the scrollable document.

## Limits and next task

05A is complete locally. The grid, meeting form, imports, live multi-window subscriptions and backup recovery remain separate tasks. Other windows are reconciled on conflict/reload, not continuously synchronized. Drafts survive in-app navigation but are not persisted across tab closure; the browser receives a before-unload warning while an editor is open. No manual browser-toolbar zoom, screen-reader or real-portal test was performed.

Next ready task: **05B**, meeting/time validation and interval collision logic. Keep B's 01B portal research assignment intact. 06A placement depends on 05B.
