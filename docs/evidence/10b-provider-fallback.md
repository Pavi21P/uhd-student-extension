# 10B: Explicit provider fallback

Completed 2026-10-25 for the plan's fallback branch, using the [02B source decision](rmp-source.md). **Live retrieval/cache and G2 remain blocked.** No portal-specific assumption or 01B observation is needed to return a provider-unconfigured result.

## Behavior and scope

Previously professor.lookup returned FEATURE_UNAVAILABLE alongside wholly unimplemented commands. It now accepts a validated instructor name/optional department through the authenticated dashboard RPC and returns exactly unavailable/provider-unconfigured. No identity match, score or source data is implied. Malformed inputs fail with INVALID_INPUT, and unsupported senders fail with UNAUTHORIZED_SENDER.

src/adapters/rmp/provider.ts is a frozen link-only provider boundary with no network, cache or storage capability. Its lookup validates input and returns a fresh unavailable result. src/shared/professor-lookup.ts bounds/normalizes input and permits only that response shape. Unexpected numeric/live/synthetic results cannot pass the client parser. This narrow parser must be extended deliberately if a permitted live provider is implemented later.

Existing 10A name validation moved into the shared profile helper without changing the editor's behavior, avoiding a React dependency in the worker. The existing manual profile-link review/navigation remains the explicit fallback. It is still an unverified session draft and clears on reload. The dashboard does not start automatic lookups or render a new search UI. Association/enrollment commands remain disabled.

No permission, dependency, domain/message schema, storage version, portal selector or planner change. No response cache was added: the source decision allows zero live records while source access/TTL are unknown. This is completion of 10B's allowed fallback, not completion of the original live-ratings feature or 12A persistence work.

## Validation

npm run check passed: lint, **297 tests in 15 files**, strict TypeScript, production build and MV3 checks. There are 32 new provider cases; the former professor.lookup FEATURE_UNAVAILABLE expectation was replaced, giving a net 31-test increase. Coverage includes Unicode/department normalization, malformed/oversized/unassigned names, URL/selector/snapshot injection, getter rejection without invocation, sender guards, initialization failure, disabled associations, malformed/forged response rejection, and no transport/network/storage side effects where applicable.

The built unpacked extension passed in Chrome 156.0.8078.47 and Edge 156.0.4314.42. [Chrome report](10b-chrome-report.json); [Edge report](10b-msedge-report.json). Both verified actual worker messages from the dashboard, rejection from the popup, invalid payloads, disabled association/enrollment, unchanged chrome.storage.local and zero external requests during lookup. The existing manual review and keyboard-open link worked after validator extraction; the target was intercepted with synthetic HTML and had no opener. Reload cleared the draft. No live RMP page fetch was tested.

The only recorded external request in each report is that explicit intercepted navigation. There were no page errors. No UI layout changed; no new visual audit or human acceptance is claimed. The separate two-person 09A checklist remains pending.

## Reproduce

Run npm ci and npm run check using the pinned Node/npm versions. With installed Chrome/Edge and Playwright available to Node, run:

~~~sh
node tests/browser/provider-fallback.mjs chrome
node tests/browser/provider-fallback.mjs msedge
~~~

Set PLAYWRIGHT_MODULE_PATH to an external module directory when needed. The runner loads dist as an unpacked extension in isolated profiles under ignored .local/qa and saves synthetic reports there. It does not use the user's portal session or install dependencies automatically.

## Handoff

Fallback scope is ready for review. Live ratings require a permitted source, verified UHD identity, response/cache validation and matching work. The next ready project task remains B's 01B portal inspection; 11B still depends on those observations and cannot be inferred from the fallback. 12A persistence and both 09A human sign-offs remain pending. No merge or release is included.
