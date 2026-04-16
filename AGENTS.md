# Agent notes (UI system + profile/settings)

Use this when editing UI code in this repo, especially:
- `app/globals.css`
- `app/styles/*.css`
- `components/profile/profile-form.tsx`
- dashboard / detail / prep surfaces

## First principles

- Preserve the current layout unless the request explicitly changes it.
- This repo uses a split CSS architecture. Do **not** treat `app/globals.css` as the styling home.
- Generated artifacts are never part of the design system. Do not edit `.next`, `.next 2`, caches, or traces.
- Before editing CSS or TSX, read `DESIGN.md` and `UI_CHANGE_PROTOCOL.md`.

## Stylesheet ownership map

- `app/styles/tokens.css`: variables and global tokens
- `app/styles/shell.css`: app shell, header, shared rail/container scaffolding
- `app/styles/controls.css`: shared button/control primitives and edge-bleed utilities
- `app/styles/dashboard.css`: queue rows, left rail, detail/prep shared surfaces
- `app/styles/settings.css`: settings-page layout contracts and elevated controls
- `app/styles/forms.css`: shared fields, uploads, disclosures, form states
- `app/styles/operators.css`: operators/account screen only
- `app/styles/responsive.css`: breakpoint-only overrides

## UI change protocol

1. Identify the owning route, shared component, and stylesheet before changing anything.
2. Prefer shared contract fixes over local overrides.
3. Keep zero visual diff during cleanup unless the user explicitly asks for a visible change.
4. Verify every affected route after CSS or TSX changes.

## Default Harness Workflow

- Treat the harness as the default repo operating mode.
- Read the latest harness artifacts first:
  - `.codex-artifacts/eval/latest/report.json`
  - `.codex-artifacts/eval/latest/report.md`
  - relevant logs and UI artifacts when needed
- Always use `repo-harness-triage` for diagnosis and prioritization unless explicitly instructed otherwise.
- If no failure exists, select the highest-value weak spot or coverage caveat instead of inventing new work.
- Always operate on a single issue at a time. Do not bundle multiple fixes.
- Default implementation path for one approved issue: use `repo-controlled-fix-loop`.
- Rerun the smallest relevant verification first.
- Rerun `npm run eval` when the issue affects a scored layer, shared contract, workflow behavior, UI contracts, or UI artifacts.
- Keep external live diagnostics separate from the deterministic core harness. `npm run diagnostic:external-sourcing` is non-gating and must not be treated as part of `npm run eval`.

Natural-language triggers that should follow this workflow:

- "Check the latest harness run and tell me what to fix next."
- "Use the latest eval results and fix the top issue."
- "What is the highest-value weak spot after the last eval?"
- "Inspect the harness output and make one safe fix."
- "Review the latest screenshots and fix one real inconsistency."

## Custom UI Protection Rules

- Preserve the existing custom design language across the product.
- Do **not** normalize bespoke UI into generic design-system output.
- Do **not** replace custom components with generic abstractions unless the user explicitly instructs that refactor.
- Do **not** make broad global visual refactors unless the user explicitly asks for them.
- Prefer surgical fixes over broad cleanup.
- Treat current visuals as intentional unless they are clearly broken, inconsistent within the same pattern family, inaccessible, or unresponsive.
- Consistency means preserving the logic of related pattern families, not flattening the whole product into one uniform layout.
- When adjusting UI, preserve the editorial grid, ruled seams, monochrome hierarchy, and custom split-shell composition unless the request explicitly changes them.
- When a surface looks custom rather than accidental, assume that character is part of the product and should be protected.

## UI Consistency Refinement Scope

Allowed without extra approval:

- spacing and gap consistency
- alignment fixes
- text hierarchy refinement for elements serving the same role
- padding consistency
- same-family button/control sizing consistency
- responsive spacing and alignment fixes
- removal of obvious visual drift across related pages or pattern families

Not allowed without explicit instruction:

- layout structure changes
- composition changes
- replacing component types
- redesigning buttons or controls
- global typography redesign
- global spacing-system redesign
- visual simplification that removes intended character
- flattening intentionally different pages into one pattern

This refinement zone exists to improve implementation consistency, not to redesign the UI. Keep layout, composition, component choices, and the custom design language intact while fixing local drift.

## Frontend Logic Refinement Scope

Allowed without extra approval:

- extracting duplicated frontend logic into shared helpers or hooks
- simplifying component state handling
- improving loading, empty, and error-state consistency
- reducing fragile conditional rendering branches
- tightening boundaries between UI components and server/data logic
- improving type safety and shared transformation logic
- removing dead or obviously stale frontend paths when confidence is high

Not allowed without explicit instruction:

- broad architectural rewrites
- changing product behavior
- replacing core state-management patterns globally
- moving large areas of logic across the app at once
- refactoring unrelated files as cleanup
- changing route structure or API contracts unless required by the issue

This refinement zone exists to improve implementation quality and maintainability, not to redesign the product architecture.

## Sameness Rule

- Consistency should follow semantic role and pattern family.
- Elements that serve the same role should feel related.
- Elements with different roles or emphasis do **not** need to be forced to match.
- Same-family buttons should have consistent height, padding, and text/icon spacing unless a difference is clearly intentional.

## UI Red Lines

- Do **not** change brand-defining components without explicit instruction.
- Do **not** change flagship page composition without explicit instruction.
- Do **not** change motion behavior or distinctive layout rhythms without explicit instruction.
- Do **not** turn the current ruled editorial UI into card-heavy, rounded, shadowed, gradient, or generic SaaS styling.
- Do **not** merge distinct pattern families just to make the product feel more uniform.

### Protected Surfaces

- Global workflow header and queue navigation:
  - `app/layout.tsx`
  - `components/navigation/workspace-header.tsx`
  - `app/styles/tokens.css`
  - `app/styles/responsive.css`
- Split workspace shell and rail seam:
  - `components/navigation/workspace-surface.tsx`
  - `components/navigation/workspace-rail-shell.tsx`
  - `app/styles/shell.css`
- Editorial page-header language:
  - `components/dashboard/queue-meta.tsx`
  - `components/ui/page-intro-header.tsx`
  - `components/jobs/job-flow-header.tsx`
  - `app/styles/dashboard/queue-meta.css`
  - `app/styles/settings/page-shell.css`
- Queue row family and action bands:
  - `components/dashboard/potential-row.tsx`
  - `components/dashboard/saved-row.tsx`
  - `components/dashboard/stage-row.tsx`
  - `app/styles/dashboard/queue-rows.css`
  - `app/styles/controls.css`
- Profile elevated controls and seam logic:
  - `components/profile/profile-form-controls.tsx`
  - `components/profile/sections/job-targets-section.tsx`
  - `components/profile/sections/experience-strengths-section.tsx`
  - `components/profile/sections/cover-letter-strategy-section.tsx`
  - `app/styles/settings/elevated-controls.css`
- Source upload row:
  - `components/profile/sections/application-materials-section.tsx`
  - `app/styles/forms/uploads.css`
  - `app/styles/forms/settings-fields.css`
- Flagship route structures:
  - `/`
  - `/dashboard`
  - `/profile`
  - `/jobs/[jobId]`
- Internal reference surface:
  - `/system-inventory`
  - `app/system-inventory/page.tsx`
  - `components/system/system-inventory-page.tsx`

## Shared control + hairline contract

- The base `.button` contract lives in `app/styles/controls.css`. Do not define root `.button`, `.button-primary`, `.button-ghost`, `.button-small`, `.button__label`, or `.action-note*` selectors anywhere else.
- Surface styles may size or place buttons, but they should not re-own button reset/centering mechanics unless the user explicitly asks for a visual change.
- Queue-column hairlines must use the shared edge-bleed variables from `app/styles/controls.css` instead of reintroducing raw `calc(-1 * var(--queue-column-pad))` math in pseudo-element rules.
- Treat UI cleanups as zero-diff by default. If a request is about a bug like centering or flush edges, fix the contract without redesigning the surrounding UI.

## Elevated controls (single pattern)

**Additional filters** (`details.settings-action-disclosure`) and **Experience tabs** (`.settings-tab-shell`) share one layout contract—keep them in sync.

1. **Vertical stack on the profile form**: `.settings-main` uses **`--settings-stack-gap: 24px`** for spacing between major blocks (section grid gap, disclosure body gap). **Do not** add extra `margin-top` on `.settings-action-disclosure` or `.settings-tab-shell`—rely on that gap. Label/textarea/helper stacks use **`.field` / `.upload-slot` gap `6px`** under `.settings-main` for upload-style blocks.

2. **Open surface (Additional filters)**:
   - **`details[open]`**: horizontal bleed only — **`background: transparent`**, **`padding-bottom: 0`**. The **summary row** stays **page white** (`var(--bg)`) to the **right** of the chip; **grey fill is only** the **tab chip** + **`.settings-action-body`**.
   - **`.settings-action-body`**: grey background, **`border-top: 1px solid var(--line)`** (full width), **`padding-bottom: calc(24px + 48px)`** for the tail. **`margin-bottom: -1px`** + **`z-index`** on the **open chip** so the chip’s grey overlaps the body’s top rule — the black line **only reads to the right** of the tab (one continuous grey from chip into content).
   - **`.settings-action-toggle`**: **`border-bottom: none`** always (closed and open). When **open**: grey fill, **L/T/R** black borders, **`margin-bottom: -1px`**, **`z-index: 2`**.

3. **Experience tabs:** Same bleed on **`.settings-tab-shell.has-selection`**; panel/body rules can mirror the above pattern where applicable.

4. **Toolbar** (tabs only): When `has-selection`, same horizontal inset as inner panel: `padding-left: var(--queue-column-pad); padding-right: var(--settings-section-pad-right);` so tab chips line up with padded content. Background **`var(--surface-soft)`**; active tab **`var(--bg)`**.

## Application materials (`#source-files`)

- **Secondary column** (`settings-source-secondary`): **`padding-bottom: 48px`** under the portfolio upload.

## Vertical rhythm (section / disclosure blocks)

- **`padding-bottom: 48px`** on **`.settings-main > details.disclosure` only** — not on the job targets **`section`**, or a white band appears under **closed** Additional filters.
- **`.settings-main .profile-form-footer`**: **`padding-bottom: 48px`**.

## Job targets fields

- **Ideal roles**: `settings-search-brief` textarea keeps the standard `.field` bottom border (do not zero it).

## Text fields

- Default: transparent background, **bottom border only** on `.field` inputs/textareas (plus listed exceptions in `globals.css`).
