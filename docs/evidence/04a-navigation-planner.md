# 04A: dashboard navigation and course planner

Implementation and browser verification: 2026-10-22. Handoff completed: 2026-10-23 (America/Chicago). Owner: A / Pavitra. Scope: dashboard destinations and the existing planner link.

## Result

- Timetable, Professors, Planner, Enrollment and Settings are working hash destinations in the agreed order. Native links use aria-current and visible focus, with Tab/Shift+Tab and Enter rather than ARIA tab-widget arrow handling.
- Each destination has one h1 and its own document title. Route changes focus main content. The skip link preserves the current destination. Back/Forward and reload preserve the selected route; unknown hashes fall back to Timetable.
- Planner opens https://uhd-course-planner.pages.dev/ through a native new-tab link with noopener/noreferrer. Separate-save and new-tab explanations are visible. No iframe, automatic data transfer, custom URL input, new permission or planner-project change was introduced.
- Professors, Enrollment and Settings contain honest unavailable messages and a Back to timetable link. No fake ratings, reviewed enrollment selections or settings values appear. Timetable retains its existing card preview and disabled Add course control.
- Timetable markup was extracted into TimetablePreview.tsx. Storage and background behavior are unchanged.

## Design review

Reused the 03A visual direction and tokens. Consulted cached Taste app-screen guidance for navigation, hierarchy and unavailable states, plus Impeccable Operate/craft guidance for familiar controls, focus and truthful copy. No vendor toolkit, binary, randomized direction workflow or separate reviewer agent ran.

Planner has one destination panel and a separate-save explanation; columns stack at constrained widths. Unavailable views have a concise notice and usable return link. Native navigation focus outlines sit inside the scrolling strip to avoid clipping.

## Verification

- Existing **90 unit tests passed**. These cover the prior launcher/storage/message boundaries, not a new dashboard UI test suite.
- Lint passed; strict TypeScript and production build/artifact checks passed after explicitly typing the route hook as SectionId. No dependencies or lockfile changes.
- Isolated, headless Chrome **156.0.8078.47** and Edge **155.0.4283.62** completed the extension checks with zero dashboard page errors.
- Both verified all five destinations, one active navigation link/h1, correct titles, focus transfer, Back/Forward/reload, unknown-hash fallback and unchanged extension storage after navigation.
- Keyboard-only navigation reached Planner and opened the external site. Both observed HTTP **200**, document title **UHD Course Planner**, rendered course-map content, and null window.opener. The dashboard remained open. This resolves the earlier web-fetch reachability uncertainty; it is not a full audit of the separate planner.
- Skip-to-content retained #planner and focused main. The test harness explicitly brought the dashboard to the foreground after closing the external tab; an initial run lost browser focus there and was rerun successfully.
- The popup launcher still opened the default Timetable view in both browsers.
- Layout bounds passed for Planner and Enrollment at Chrome 1440/1024/768/390px and Edge 1440/768px. The narrow navigation strip intentionally scrolls. No document-wide horizontal overflow occurred.
- Reduced motion removed the action transition. A 200% CSS layout-scale check passed; this is not a manual browser-toolbar zoom test.

Visual inspection covered Chrome Planner at 1440, 1024, 768 and 390px, its enlarged layout, Professors/Settings at desktop width, Enrollment at desktop/narrow widths, the live planner page, and Edge's 768px Planner and 360px popup. No clipping or overlapping content was found in the inspected layouts. No screen-reader audit or mobile-browser support is claimed.

Selected screenshots contain only the extension's empty/unavailable views:

- [Planner, 1440px](04a-planner-desktop.png)
- [Planner, 390px](04a-planner-narrow.png)
- [Enrollment unavailable, 390px](04a-enrollment-unavailable.png)

Browser reports/scripts remain ignored under .local/qa and .local/. A maintained E2E runner remains 09B. The live-site check records observed availability, not a guarantee. Future network errors belong to the destination browser tab; the extension does not claim a remote health status.

## Handoff

Next ready task: **05A**, blank course-card creation/edit/delete in the Unscheduled tray with persistence. Dependencies 03B and 04A are complete. B's independent 01B portal research remains ready. Ratings, settings controls and enrollment remain unavailable; the select-and-submit requirement is unchanged.
