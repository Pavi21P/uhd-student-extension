# 03A: extension foundation verification

Completed 2026-10-22 (America/Chicago). Owner: A / Pavitra. Scope: build, manifest, popup launcher, static dashboard shell, pinned toolchain and lockfile. No adjacent feature task was implemented.

## Implementation

- React + TypeScript + Vite, with plain CSS. TypeScript reuses the existing browser contracts; another language would add an unnecessary runtime boundary here.
- MV3 `public/manifest.json`: `popup.html` action, `dashboard.html` options page, original icons, bundled fonts/scripts and restrictive extension CSP. No permissions, host permissions, content scripts, or background worker.
- Popup opens the fixed dashboard URL through `chrome.tabs.create`. A failed creation shows an alert and restores the button. An ordinary Vite preview navigates to its local dashboard instead.
- Dashboard previews the requested professor/title/room card positions and weekly workspace. Future controls are disabled and explained. No ratings, saved courses or enrollment outcomes are fabricated.
- [PRODUCT.md](../../PRODUCT.md) records scope; [DESIGN.md](../../DESIGN.md) records the chosen visual direction. Taste app-screen and Impeccable Operate guidance informed the implementation. Vendor toolkits, scripts, binaries and a separate reviewer agent were not run.
- Runtime dependency notices are copied into the build. Browser profiles, local tooling, build output and installed packages stay ignored.

## Reproducible project checks

| Check | Result |
| --- | --- |
| Node 24.21.0 / npm 12.2.1 | Toolchain pinned; installed dependency versions locked. |
| `npm ci` on final lockfile | Passed: 50 packages installed, audit reported zero vulnerabilities at the time of the check. |
| `npm run lint` | Passed (Oxlint). |
| `npm test` | Passed: 4 launcher tests covering extension URL, failed creation, ordinary preview and missing runtime identity. |
| `npm run typecheck` | Passed: strict TypeScript 6.0.3, including pre-existing contract examples. |
| `npm run build` | Passed: Vite 8.3.5 and MV3/artifact/CSP-source checks. |
| Final `npm run check` | Passed after the interrupted terminal session; no application source changed afterward. |

The workstation's bundled Node was invoked by absolute path and npm was bootstrapped into ignored `.local/`. Registry integrity was checked. Its certificate-chain issue was resolved using Node's system CA support; TLS verification was not disabled. These machine-specific paths and wrappers are not project requirements.

## Browser and rendered checks

Used Playwright with isolated persistent profiles and the installed browsers in headless mode. The browser-level DevTools `Extensions.loadUnpacked` API loaded `dist`; `Extensions.getExtensions` confirmed it enabled. No personal browser profile or student data was used.

| Browser | Checks |
| --- | --- |
| Chrome 155.0.8059.85 | Unpacked load, popup-page button creates dashboard tab, dashboard reload, disclosure, local fonts, disabled future controls; 1440, 1024, 768 and 390 CSS-pixel widths. |
| Edge 155.0.4283.62 | Unpacked load, popup-page button creates dashboard tab, dashboard reload, disclosure, local fonts, disabled future controls; 1440px dashboard and 360px popup. |

No page errors or document-wide horizontal overflow occurred. The narrow destination strip intentionally scrolls horizontally. The 390px check tests layout resilience, not mobile extension support. All captured dashboard widths and both 360px popups were visually inspected.

Additional Chrome checks passed: keyboard skip link focuses main, disclosure is reachable and toggles with Enter, focus has a visible 2px outline, reduced-motion mode removes transitions, and synthetic tab-creation failure shows recovery with an enabled retry button. A 200% CSS layout-scale check had no document overflow and was visually inspected; this is not a browser-toolbar zoom test.

A rendering issue found during inspection was corrected: extension browser defaults overrode the inherited body font. Explicit body font inheritance now loads Public Sans in both browsers.

Selected screenshots, containing only the empty preview:

- [Chrome desktop, 1440px](03a-dashboard-desktop.png)
- [Chrome narrow layout, 390px](03a-dashboard-narrow.png)
- [Chrome popup, 360px](03a-popup.png)
- [Chrome synthetic launch failure](03a-popup-error.png)

## Limits and next step

The actual toolbar chrome was not manually clicked: the installed extension's popup page and its real tab-creation API were exercised. No browser-store package, screen-reader audit, manual browser zoom, or teammate acceptance review was completed. Long user-supplied course content remains a later editor/grid check because this task has no course input.

No runtime storage/message validation, timetable editing, live RMP source, planner navigation, portal adapter or enrollment execution exists yet. No live portal interaction occurred. Task 03B is now ready for validation/storage/messages; task 04A is also dependency-ready for dashboard navigation and the planner link. Claim only one before resuming.

Technical references used: [Chrome extension setup](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world), [Vite guide](https://vite.dev/guide/), [Playwright extension testing](https://playwright.dev/docs/chrome-extensions), and [DevTools protocol definitions](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json).
