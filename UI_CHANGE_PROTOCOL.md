# UI Change Protocol

Use this protocol before editing CSS or TSX in this repo.

## 1. Start with the real architecture

This app does **not** use a single stylesheet. The active ownership map is:

- `app/styles/tokens.css`: variables and theme tokens
- `app/styles/shell.css`: app shell, header, shared rail/container scaffolding
- `app/styles/controls.css`: shared button/control primitives and edge-bleed utilities
- `app/styles/dashboard.css`: queue rows, job detail/prep shared surfaces, left-rail content
- `app/styles/settings.css`: settings-page layout contracts and elevated controls
- `app/styles/forms.css`: shared fields, uploads, disclosures, form states
- `app/styles/operators.css`: operators/account page
- `app/styles/responsive.css`: breakpoint-only overrides

`app/globals.css` is import order only.

## 2. Preserve before improving

- Default rule: zero visual diff.
- Only change layout, spacing, or visual structure when the user explicitly asks for it or a bug forces it.
- Prefer shared contract fixes over local overrides.

## 3. Identify the owning surface first

Before editing:
1. identify the route and component
2. identify the owning shared component
3. identify the owning stylesheet
4. read the relevant rule docs:
   - `DESIGN.md`
   - `AGENTS.md`
   - `.cursor/rules/`

## 4. Fix the contract, not the symptom

Prefer:
- shared row wrappers over one-off row tweaks
- shared job-flow components over page-local patches
- shared control ownership in `app/styles/controls.css` over per-surface button reset duplicates
- owning stylesheet changes over scattered selector overrides

Avoid:
- duplicate spacing rules
- duplicate base `.button` selectors or raw edge-hairline math in surface files
- per-component layout hacks when a shared surface already owns the behavior
- hidden fallbacks that make blank states behave like demo data

## 5. Verify every affected route

After CSS or TSX edits, re-check the relevant routes, especially:

- `/profile`
- `/operators`
- `/dashboard`
- `/jobs/[jobId]`
- `/jobs/[jobId]/packet`

## 6. Never edit generated artifacts

These are disposable local outputs, not source-of-truth files:

- `.next`
- `.next 2`
- `.trace`
- caches, coverage, build, dist

If generated artifacts are confusing the editor, clean or ignore them. Do not treat them as implementation files.
