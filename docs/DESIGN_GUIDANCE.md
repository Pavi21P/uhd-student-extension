# Design guidance

Required references requested by the user on 2026-10-20: [Taste Skill](https://github.com/Leonxlnx/taste-skill) and [Impeccable](https://github.com/pbakaus/impeccable). Apply both to future UI work in this repository. This is project guidance, not a claim that either toolkit is installed or that its automated checks ran.

## Sources and roles

| Reference | Reviewed revision | Use here |
| --- | --- | --- |
| Taste Skill | `6010f91a9935f1c167dfc500fb1a475681892e6b` | App-screen composition, density, hierarchy, data presentation and rendered visual review. |
| Impeccable | `dad8dbb3aac21ad1fa236c110315ef4abece23e8` | Task-oriented interaction, design consistency, accessibility, edge cases and a focused quality pass. |

Read the relevant entrypoint before applying an upstream workflow:

- [Taste Skill entrypoint](https://github.com/Leonxlnx/taste-skill/blob/6010f91a9935f1c167dfc500fb1a475681892e6b/skills/taste-skill/SKILL.md) and its [app-screen route](https://github.com/Leonxlnx/taste-skill/blob/6010f91a9935f1c167dfc500fb1a475681892e6b/skills/taste-skill/references/app-screens.md).
- [Impeccable entrypoint](https://github.com/pbakaus/impeccable/blob/dad8dbb3aac21ad1fa236c110315ef4abece23e8/.agents/skills/impeccable/SKILL.md). Its [planning reference](https://github.com/pbakaus/impeccable/blob/dad8dbb3aac21ad1fa236c110315ef4abece23e8/.agents/skills/impeccable/reference/shape.md) was also reviewed for how to keep a brief focused; the interactive shape command was not invoked.

Taste's app route distinguishes a working interface from a marketing page. Use its emphasis on meaningful hierarchy, useful density, restrained surfaces, aligned information, and inspecting actual rendered results. Impeccable calls task-focused interfaces Operate surfaces: prioritize the student's job, familiar behavior, readable structure, and careful details. Apply their workflows only to the surface and task being built.

These revisions are the shared review baseline, not an automatic update channel. Inspect an upstream change before adopting it. Relevant upstream files must be read fully when executing their workflow; this summary does not replace them.

## Product context already settled

- Audience: UHD students building a schedule or preparing to enroll on desktop Chrome/Edge.
- Main working surface: a weekly timetable with a tray of unscheduled, manually editable course cards.
- Supporting tasks: check professor information, open the existing planner, and review or schedule enrollment.
- Registration is time-sensitive. The exact reviewed sections, activation status, and portal outcome must be legible without interpretation.
- Task 03A established the launcher/dashboard preview and rendered baseline. Reuse [DESIGN.md](../DESIGN.md) and [PRODUCT.md](../PRODUCT.md); inspect [03A evidence](evidence/03a-foundation.md) for screenshots and verification limits. UI_SPEC.md remains the behavior specification.

## Application to this extension

These are project decisions derived from the approved requirements; they are not claims that either upstream repository prescribes this exact layout.

1. **Let the schedule lead.** Make the weekly grid and course placement the dominant working area. Keep Add course easy to find. Do not replace useful schedule space with decorative statistics or a welcome banner.
2. **Keep the requested card anatomy.** Professor top left, course name centered, room bottom left. A compact state must retain access to the full details. A style recommendation cannot change those positions or require students to fill optional fields.
3. **Give color a job.** Distinguish selected courses, overlaps, focus, and enrollment outcomes with stable tokens and text/symbol support. User-chosen course identity colors do not imply success, eligibility, or a rating. Contrast takes priority over a subtle palette.
4. **Keep information precise.** Align times and counts; distinguish missing ratings from zero, sample fixtures from real data, and a submitted action from confirmed enrollment. Keep source/freshness beside professor results.
5. **Use consistent components.** Navigation, form labels, buttons, card editors, dialogs, and result rows share spacing and states. The timetable may use useful gridlines and repeated course cards; marketing-page restrictions must not erase them.
6. **Match motion to work.** Use brief feedback for placement, focus, and state changes. Support reduced motion. Never delay or obscure enrollment controls/results for an animation.
7. **Design all meaningful states.** Empty schedules, long names, dense overlaps, invalid input, save failure, missing permissions, stale ratings, armed jobs, and partial/unknown enrollment results are part of the screen, not later polish.
8. **Preserve the core flow.** The extension button authorizes selection and submission. Neither a decorative dashboard nor a reminder-only substitute satisfies the enrollment requirement.

## Focused implementation loop

1. Read STATUS.md, the active task, UI_SPEC.md, and this guide. Reuse settled product context; do not repeat the discovery interview.
2. Reuse the visual direction and token set recorded in DESIGN.md during 03A. Use Taste's app-screen route and Impeccable's relevant task guidance for subsequent screens; change the baseline only for a concrete usability need.
3. Read only the upstream files needed for that task. If a toolkit is installed later, inspect its scripts and dependencies before execution, use its supported setup, and record the actual revision. Do not silently download/run a binary merely to claim a tool was used.
4. Build the current task's screens and real states. Use clearly labeled synthetic fixtures for development, never fabricated live ratings or enrollment success.
5. Inspect the rendered dashboard at 1440px and 1024px, then at 768px for constrained desktop behavior. Inspect the popup at its actual extension width. Check browser zoom, long content, keyboard focus and reduced motion where affected. If an upstream checker requires other widths, include them without implying mobile-browser support.
6. Review composition and task clarity, then accessibility/edge cases, then polish the largest visible problems. Batch changes and recheck affected states instead of repeatedly auditing unchanged screens.
7. Record browser/viewport, screenshots or evidence paths, corrections, and remaining limitations in the task handoff. Tool checks and visual inspection are distinct; never claim either without doing it.

No design runtime, downloaded assets, source code, or scripts from these repositories are bundled now. Taste Skill identifies its license as MIT; Impeccable identifies its license as Apache-2.0. If files are incorporated later, preserve applicable license/notice files and attribution. Linking to guidance does not license this project's own code.
