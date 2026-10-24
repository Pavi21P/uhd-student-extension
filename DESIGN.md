# Extension design baseline

Established during task 03A. Implemented styles live in [styles.css](src/ui/styles.css). This is the local design decision record; no third-party design runtime or generated direction sheet is claimed.

## Direction

A light, framed workspace for students working in a browser alongside course information. The white working sheet, soft green-gray outer surface, and restrained teal details relate to the existing planner. Public Sans carries all text. A small mark made from three course blocks identifies this extension; it is an original project mark, not UHD's official logo.

The timetable is the main working area. The Unscheduled tray and saved-course cards retain the requested anatomy. The editor appears above the grid on desktop and in a native modal at 800px and below. Task 06A adds labeled meeting rows and a real weekly grid: exact proportional placement, simple overlap lanes, and an always-available full-detail meeting list. Short meetings use compact grid marks; the list keeps their details and editing accessible. Color remains a small identity marker.

Taste's app-screen guidance informed hierarchy, flat surfaces and disciplined density. Impeccable's Operate guidance informed familiar controls, consistent states and purposeful feedback. The implementation uses these as reviewed design references: no randomized draw, vendor inspector, vendor binary or separate reviewer agent was run. The user's bounded-work and no-subagent instructions remain in force.

## Tokens

| Role | Value |
| --- | --- |
| Outer ground | #edf2f0 |
| Working surface | #ffffff |
| Secondary surface | #f6f8f7 |
| Main ink | #202e2d |
| Secondary text | #596763 |
| Structural line | #dce3df |
| Accent / focus | #21675a |
| Course-preview tint / ink | #eaf2ee / #34584c |
| Error text | #a32f32 |
| Typeface | Locally bundled Public Sans, 400/500/600/700 |
| Type sizes | 11–14px metadata and controls, 16–20px card/empty titles, 24–28px page titles |
| Spacing | 4/8/12/16/24/32px base |
| Corners | 8px controls, 12px working panels, 16px outer sheet |
| Motion | 150ms state feedback; disabled for reduced motion |

No resting shadows, gradients, decorative metrics or simulated live ratings. Course colors identify a course and do not imply enrollment success. All interactive elements have visible focus; disabled controls have an adjacent explanation.

## Geometry and states

- Desktop: common header/content edges; 250px tray, 32px gap, remaining width for the week.
- At 1024px: 220px tray and 24px gap.
- At 768px: saved cards flow in a responsive tray above the week. The open editor is a narrow modal dialog.
- At narrow widths: stacked content and horizontally scrollable destination strip. This is responsive resilience, not a mobile-browser support claim.
- Popup: 360px wide, one working Open timetable action, opening state, and a recoverable failure state.
- All five destinations now use native hash links in the underline navigation strip, with aria-current, visible focus, Tab/Enter access, browser history and a route-specific page title. Focus moves to the new main content; the skip link preserves the selected destination.
- Planner uses one destination panel and an adjacent separate-save explanation, stacked at 768px and below. Its native external link clearly announces a new browser tab.
- Add course, meeting editing and Settings days/hours are enabled. Professors and Enrollment retain truthful unavailable states. Backup, import and timezone controls remain deferred.
- The week scrolls inside a labeled keyboard-focusable region with sticky day/time headers. Normal scale is 72px/hour; short visible ranges expand proportionally to at least 180px. Partial cards are clipped to the view, with full details and an out-of-view reveal action.
- Settings uses native weekday checkboxes and exact HH:mm fields, explicit save/cancel, and preserved drafts through navigation and save recovery.
- Body text, placeholders, labels and state descriptions must remain readable at browser zoom. No animation delays content or enrollment actions.

## Visual review

Use the screenshot and browser evidence in [03A foundation verification](docs/evidence/03a-foundation.md). That report distinguishes actual browser checks from unrun third-party checks. [04A verification](docs/evidence/04a-navigation-planner.md) adds the destination views and live planner link. Later tasks should extend this system rather than choose another theme.

Task 05A reuses Taste app-screen form guidance and Impeccable Operate: labeled optional fields, explicit save/cancel, destructive action separated last, readable recovery state, preserved drafts, and native narrow-screen focus management. [Editor evidence](docs/evidence/05a-course-editor.md) includes desktop, narrow and conflict views. Vendor toolkits were not executed.

Task 06A reuses the same Taste app-screen form/settings and Impeccable Operate guidance. [Grid and settings evidence](docs/evidence/06a-weekly-grid.md) records inspected desktop/narrow screenshots and Chrome/Edge functional checks. Browser zoom was checked using actual tab zoom and DOM bounds; a full-page screenshot capture artifact is not presented as visual proof. No vendor toolkit or screen-reader audit was run.

Task 06B reuses the existing review and reload panels for cross-view updates, preserves raw drafts, and labels last-loaded grid settings after read failure. [Recovery evidence](docs/evidence/06b-cross-view-recovery.md) records synthetic desktop/narrow screenshot inspection. No new theme, vendor toolkit or screen-reader audit.
