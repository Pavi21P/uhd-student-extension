# 04B: continuous integration portion

Date: 2026-10-26. Owner: Codex, taking over the teammate implementation work at the user's request. The user requested progress without browser access; BUILD_PLAN.md records this explicit split. 03A/03B supply the runnable checks. The portal fixture harness still depends on 01B and is not complete.

## Workflow

`.github/workflows/checks.yml` runs on every pull request, including stacked feature branches, and pushes to main. Manual dispatch becomes available through the default branch. Each Ubuntu 24.04 and Windows 2025 job installs Node from `.node-version`, installs npm from `package.json`'s exact `packageManager`, runs `npm ci`, then runs `npm run check`. The combined command covers lint, 297 tests, strict TypeScript, Vite and the existing MV3 artifact checks. A final diff check rejects dependency-file changes.

Jobs have a 15-minute limit, do not fail-fast across operating systems, and cancel superseded runs for the same PR/ref. Permissions are contents-read only; checkout does not persist credentials. Actions use full commit pins, resolved from the official v6 tags on the inspection date. npm caching stores downloads keyed by the lockfile, not installed node_modules. No deployment, artifact upload, browser session, student data, custom secret or live portal request is part of CI. Branch protection and repository settings were not changed.

## Verification

- Local Windows `npm run check`: passed, 297 tests across 15 files, lint, TypeScript and production/MV3 validation.
- Documentation and workflow diff reviewed; `git diff --check` passed.
- Hosted Windows/Linux clean installs and workflow execution: pending publication and first PR run. Local checks do not establish a successful GitHub Actions run.
- Existing 01B ownership and sanitized screenshot notes were preserved in this branch; no screenshot, authenticated HTML or course records were added.

## Sources and remaining work

Workflow inputs and behavior were checked against the official [setup-node documentation](https://github.com/actions/setup-node) and [checkout documentation](https://github.com/actions/checkout). Full pins were resolved using `git ls-remote` against those repositories. Node/npm/dependency versions remain the existing project choices.

04B is only partially complete until the observed synthetic portal harness can be implemented from 01B facts. No browser QA, live enrollment, live RMP, timing gate, human sign-off, merge or release is claimed by this work. A browser-independent maintained extension E2E slice of 09B can be considered next using the existing synthetic extension behavior; portal-specific tests retain their observation dependency.
