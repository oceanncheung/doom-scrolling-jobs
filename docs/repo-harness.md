# Repo Quality Harness

`npm run eval` is the repo's single quality gate.

It measures shipping confidence across four layers:

- `correctness`: lint, typecheck, UI-system checks, and production build
- `workflows`: deterministic sourcing/import contract validation, route smoke checks, packet workflow smoke validation, packet draft persistence + guardrail validation, authenticated server-action workflow validation, queue derivation / workflow-state domain validation, and workflow transition round-trip validation
- `ui`: Playwright UI contract assertions
- `ui-artifacts`: screenshot capture for UI review evidence

## Default Harness Workflow

Use the harness as the default repo workflow:

1. read `.codex-artifacts/eval/latest/report.json` and `.codex-artifacts/eval/latest/report.md` first
2. always use `repo-harness-triage` for diagnosis and prioritization unless explicitly instructed otherwise
3. if no failure exists, select the highest-value weak spot or coverage caveat instead of inventing new work
4. operate on a single issue at a time and do not bundle multiple fixes
5. use `repo-controlled-fix-loop` to fix one identified issue
6. rerun the smallest relevant verification first
7. rerun `npm run eval` when the change affects a scored layer or shared repo confidence

Keep external live diagnostics separate from the deterministic core harness. `npm run diagnostic:external-sourcing` is non-gating and does not affect `npm run eval`.

Natural-language prompts that should route into this workflow:

- "What should we fix next from the latest eval?"
- "Inspect the latest harness run and prioritize the next issue."
- "Fix one issue from the latest harness report."
- "Review the latest UI artifacts and fix one safe inconsistency."
- "Use the harness and make the smallest high-value fix."

## Commands

- `npm run eval`
- `npm run eval:correctness`
- `npm run eval:workflows`
- `npm run eval:ui`
- `npm run eval:ui-artifacts`
- `npm run capture:ui`
- `npm run smoke:import-contract`
- `npm run smoke:routes`
- `npm run smoke:packet`
- `npm run smoke:packet-persistence`
- `npm run smoke:server-action-workflow`
- `npm run smoke:workflow-state`
- `npm run smoke:workflow-transition`
- `npm run smoke:resume-v4`
- `npm run diagnostic:external-sourcing`

## Outputs

Running `npm run eval` writes:

- `.codex-artifacts/eval/latest/report.json`
- `.codex-artifacts/eval/latest/report.md`
- `.codex-artifacts/eval/latest/ui/`
- `.codex-artifacts/eval/runs/<timestamp>/` for archived previous full runs

The report includes:

- pass/fail per layer
- duration per layer
- score contribution per layer
- total score
- artifact paths when available
- a lightweight regression comparison against the previous full eval run when one exists

## Optional live diagnostics

`npm run diagnostic:external-sourcing` is a separate, manual live-network diagnostic.

- It writes:
  - `.codex-artifacts/diagnostics/external-sourcing/latest/report.json`
  - `.codex-artifacts/diagnostics/external-sourcing/latest/report.md`
- It is non-gating.
- It does not affect `npm run eval`, repo score, or harness status.
- v1 intentionally uses one tiny allowlist source and a strict timeout so the blast radius stays small.

## Scoring

The v1 harness uses a deterministic 100-point score:

- `40`: correctness
- `25`: workflows
- `20`: ui
- `15`: ui-artifacts

v1 scoring is bucket-based and all-or-nothing within each bucket; future versions may introduce per-check weighting inside a bucket.

## Exit behavior

`npm run eval` exits non-zero if any required layer fails:

- `correctness`
- `workflows`
- `ui`

`ui-artifacts` remains part of the report and score, but does not fail the top-level eval command in v1.

## Regression Comparison

Each full `npm run eval` compares the new `latest` run against the previous archived full run.

The regression section reports:

- score change by layer
- newly failing layers
- resolved failures
- artifact generation changes
- repeated weak spots when the same failure pattern appears in consecutive runs

The previous run bundle is archived under `.codex-artifacts/eval/runs/<timestamp>/`, and the latest report links back to that previous report for quick inspection.

## UI artifact coverage

`capture:ui` captures:

- `/`
- `/dashboard`
- `/profile`
- `/jobs/[jobId]`
- `/jobs/[jobId]/packet`
- `/system-inventory`

It also captures focused UI contract surfaces for:

- profile source upload row
- open Additional filters
- experience tabs closed
- experience tabs open
- system-inventory active tab shell

## UI Review Workflow

After running `npm run eval`, open the screenshots in `.codex-artifacts/eval/latest/ui/`.

Review them for:

- hierarchy
- spacing consistency
- alignment
- component reuse
- responsiveness

Fix the top 2–3 issues before the next iteration.

## Safe UI Improvement Workflow

- run `npm run eval`
- inspect `report.json`, `report.md`, and the screenshots in `.codex-artifacts/eval/latest/ui/`
- identify only high-confidence UI issues
- focus on usability, hierarchy, responsiveness, accessibility, and true inconsistency within the same pattern family
- avoid generic cleanup or aesthetic normalization
- preserve the custom design language and existing page composition unless the task explicitly asks for a visual change
- fix one focused issue at a time
- re-run `npm run eval`

## Consistency Pass Workflow

- inspect the latest `report.json`, `report.md`, and UI artifacts in `.codex-artifacts/eval/latest/ui/`
- identify only high-confidence consistency issues
- focus on gaps, spacing rhythm, alignment, text hierarchy, padding, and same-family sizing
- avoid layout or component redesign
- prefer minimal localized fixes
- fix one focused issue at a time
- rerun `npm run eval` after each pass

## Iteration Loop

- run `npm run eval`
- identify the failing layer or weakest area
- fix one focused issue
- re-run `npm run eval`
- repeat

## Codex Prompt Template For UI Work

Use a prompt like this when asking Codex to improve the interface:

```text
Inspect the repo and latest eval artifacts before changing anything.

Preserve the existing custom design language.
Do not genericize bespoke UI.
Do not flatten distinct pattern families into a single uniform treatment.
Do not replace custom components with generic abstractions unless explicitly instructed.
Propose only minimal, localized changes.
Treat current visuals as intentional unless they are clearly broken, inaccessible, unresponsive, or inconsistent within the same pattern family.

Focus on one specific UI issue.
Explain why the proposed fix preserves the intended design character.
After changes, run the repo harness and verify the affected screenshots.
```

## Codex Prompt Template For Consistency Refinement

Use a prompt like this when asking Codex to run a consistency pass:

```text
Inspect the repo and latest eval artifacts before changing anything.

Preserve the existing layout, component choices, and custom design language.
Do not redesign anything.
Focus only on spacing, alignment, text hierarchy, padding, and same-family sizing.
Avoid layout changes, component swaps, or visual simplification.
Propose only the smallest localized changes.
Explain why each proposed fix is safe and why it preserves the intended design character.

Fix one focused consistency issue at a time.
After changes, rerun the repo harness and verify the affected screenshots.
```
