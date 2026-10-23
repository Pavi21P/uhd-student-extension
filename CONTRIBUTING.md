# Working together

## Ownership

- **A: Pavitra, initially** — extension interface, timetable, planner entry, accessibility.
- **B: teammate, initially** — myUHD adapter, RMP adapter, enrollment state machine.
- Either person may swap lanes by updating the task assignment before starting.
- Shared types, manifest, package/lock files, and storage changes have one editor per task. The other person reviews them.

## GitHub setup — first shared session

1. Agree on the owner, repository name (`uhd-student-extension` suggested), visibility, and license.
2. Create an empty GitHub repository when ready to publish. Do not add a second README remotely.
3. Initialize this folder with `git init -b main`. Inspect `git status --short`, then stage the intended planning files explicitly and review `git diff --cached` before the first commit.
4. Add the confirmed remote and push `main`. Do not embed credentials in a remote URL.
5. Invite the teammate as a collaborator; they clone the repository to their own folder.
6. Each person uses their own Git name and an email connected to their GitHub account, or their GitHub-provided private email. Never impersonate the other author.
7. Create labels `foundation`, `ui`, `portal`, `rmp`, `enrollment`, `test`, `blocked`, and `optional`; create a board with Backlog, Ready, In progress, Review, and Done.
8. Turn each plan task ID into an issue using the supplied template. Record dependencies and acceptance checks. Move only unblocked work into Ready.
9. Enable review/check requirements if supported by the repository's settings and plan; otherwise follow the same rules manually. Establish CI in task 04B before requiring its checks.

Repository setup progress is recorded in `docs/STATUS.md`. Collaborator invitations require the teammate's GitHub username and a separate request.

## Daily loop

1. Pull `main` with `git pull --ff-only`; check the board and claim one task.
2. Create a short branch such as `feat/05a-course-card` or `fix/16b-stale-job`.
3. Work only within that task. Use 30–120 minute slices; if a task grows, split it at an independently reviewable boundary.
4. Run relevant checks; inspect your diff and staged file list for unrelated files and private data.
5. Make a meaningful commit: `feat(timetable): add editable course card`, `test(enrollment): cover duplicate execution`, or `docs(portal): record supported enrollment states`.
6. Push your branch and open a PR using the template. The other teammate reviews behavior and evidence, not just formatting.
7. Resolve feedback, merge passing work, then delete the finished branch. Update the checkpoint and issue.

Aim for one useful completed slice per person on days you work. Research, documentation, fixtures, bug fixes, and verification are valid work. Do not split a trivial edit into many commits, backdate work, or create empty commits to fill the activity graph. A blocked day can still produce a documented experiment and an honest result.

Prefer ordinary merge commits when preserving both contributors' individual commit history matters. Branch commits may not appear in profile contributions until they reach the default branch; contribution display also depends on account settings and [GitHub's contribution rules](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/troubleshooting-missing-contributions). Correct attribution and shipped work are the project goals.

## Merge and release checks

The foundation now provides `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Run `npm run check` for the combined integration checks; see README.md for pinned toolchain and unpacked installation. Add `npm run test:e2e` in 09B; CI remains task 04B.

- Source changes: relevant tests plus typecheck, lint, and production build; CI will enforce the agreed checks once task 04B is complete.
- User-facing changes: manually verify the changed flow in a loaded extension and record browser/version.
- Enrollment changes: synthetic portal tests first; no unattended real enrollment tests.
- Documentation-only changes: check accuracy, links, and diff; no unnecessary application tests.
- Keep main usable. Feature flags hide incomplete RMP and enrollment features, with their limitations visible in release notes.
- A stable release requires the feature gates in BUILD_PLAN.md. GitHub source publication and browser-store distribution are separate steps.

## Low-token session prompt

```text
Read AGENTS.md and docs/STATUS.md. Work only on task <ID> from
docs/BUILD_PLAN.md. Check dependencies and existing changes first.
Implement the acceptance criteria, run relevant checks, update the
checkpoint, and stop after that task. Preserve the other owner's work.
If blocked, record the evidence and the exact missing input.
```
