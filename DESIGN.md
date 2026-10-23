# Extension design baseline

Established during task 03A. Implemented styles live in [styles.css](src/ui/styles.css). This is the local design decision record; no third-party design runtime or generated direction sheet is claimed.

## Direction

A light, framed workspace for students working in a browser alongside course information. The white working sheet, soft green-gray outer surface, and restrained teal details relate to the existing planner. Public Sans carries all text. A small mark made from three course blocks identifies this extension; it is an original project mark, not UHD's official logo.

The timetable is the main working area. A narrow Unscheduled tray establishes the requested card anatomy. In this foundation, the empty weekly area is a static layout preview, not an editable grid or a saved schedule.

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
- At 768px: tray above the week, with the preview card alongside its explanation.
- At narrow widths: stacked content and horizontally scrollable destination strip. This is responsive resilience, not a mobile-browser support claim.
- Popup: 360px wide, one working Open timetable action, opening state, and a recoverable failure state.
- Add course and future destinations are genuinely disabled until implemented. Details disclosure explains what currently works.
- Body text, placeholders, labels and state descriptions must remain readable at browser zoom. No animation delays content or enrollment actions.

## Visual review

Use the screenshot and browser evidence in [03A foundation verification](docs/evidence/03a-foundation.md). That report distinguishes actual browser checks from unrun third-party checks. Later tasks should extend this system rather than choose another theme.
