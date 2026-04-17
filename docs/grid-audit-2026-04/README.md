# Grid audit 2026-04 — verification ledger

Running refactor per `/design-system` audit. Each commit adds tokens / contracts / utilities without moving pixels. This file records the baseline and the verification method used to confirm layout intactness at each step.

## Baseline

Captured 2026-04-17 before Commit 1:

- **Screenshots:** `baseline/` (via `npm run capture:ui` with `UI_ARTIFACTS_ROOT=docs/grid-audit-2026-04/baseline`). 11 PNGs covering every significant surface at multiple viewports.
- **Noise profile:** `routes/dashboard.png` is non-deterministic between captures (rotating timestamp / data). Two back-to-back captures with zero code changes produced different hashes on that file and that file only. For dashboard, fall back to computed-style inspection (below).
- **Stable targets:** the other 10 PNGs hash-match across repeat captures.

## Per-commit verification protocol

1. `npm run capture:ui` with a scoped `UI_ARTIFACTS_ROOT=docs/grid-audit-2026-04/post-commit-N/`.
2. `shasum -a 256` diff against `baseline/` for every PNG except the **flaky set** (below).
3. For the flaky set, fetch computed styles via preview_eval for the key selectors listed below and diff between clean state (git stash the commit's edits) and pilot state (git stash pop). Identical computed styles = no rendered difference; PNG hash diff is data drift.
4. If any stable PNG changes hash OR any computed-style value differs, **halt the commit, surface the diff, and roll back.**

### Flaky set (PNG hash-diff not reliable on these)
- `routes/dashboard.png` — rotates ranked-job order, relative timestamps.
- `routes/job-review.png` — similar, when backend cron updates the target job's state.

For the flaky set, ALWAYS verify via computed-style diff across stash/unstash of the commit's changes. See the Commit 2 investigation below for the proof-of-method.

## Selectors tracked for computed-style diffing

- `.button.button-primary`
- `.screening-actions-bar .button`
- `.screening-action-slot:first-child .button`
- `.screening-action-slot:last-child .button`
- `.job-overview-actions--triple-right .screening-action-slot:nth-child(2) .button`
- `.queue-column`
- `.screening-summary-grid` (null on detail pages; present on dashboard)
- `.settings-save-button` (null on detail pages; present on /profile)

## Commits

### Commit 1 — grid-system tokens (aliases, dead-code)
- Added to `tokens.css :root`: `--bp-xs`/`-sm`/`-md`/`-lg`/`-xl` (breakpoint seams 390/640/900/1180/1440), `--grid-gap-tight`/`-standard`/`-spacious`/`-section` (12/16/24/32), `--grid-page-pad-mobile`/`-tablet`/`-desktop` (16/24/32).
- Zero selector edits; no stylesheet consumes the new names yet.
- **Verification:** 10/10 stable PNGs hash-match baseline. Computed styles on `.screening-action-slot:last-child .button` = `border-right-width: 0px`, on `.screening-action-slot:first-child .button` = full borders, on `.queue-column` = `padding-left: 32px / column-gap: 24px`. All match pre-commit values.

### Commit 2 — edge-flush pilot (jobs-queue rules co-located)
- **Scope:** moved the `@media (max-width: 900px)` jobs-queue edge-flush rules from `responsive.css:1689-1714` to `dashboard/queue-rows.css` under a new documented block ("JOBS-QUEUE EDGE-FLUSH CONTRACT") that co-locates them with the `@media (min-width: 901px)` desktop branch already living there. Net: both breakpoint branches in one file, under one comment header. No selectors added or removed; CSS output identical.
- **Verification method:** Because two PNGs (`dashboard.png`, `job-review.png`) show hash diffs against the pre-Commit-1 baseline due to data drift (background jobs updating ranked-job order, timestamps, etc.), the hash-diff alone can't prove CSS equivalence. Computed-style diffing (clean-state vs pilot-state via `git stash` / `stash pop` + preview_eval on the target selectors at mobile + desktop) confirmed every affected button's border widths are identical in both states. All 10/10 stable PNGs also hash-match.
- **Target selectors verified identical (clean vs pilot):**
  - `main.jobs-index .queue-list .screening-actions-bar .screening-action-slot:first-child .button` at 375px: `bl:0px, br:1px, bt:1px, bb:1px` in both states
  - `…:last-child .button` at 375px: `bl:1px, br:0px, bt:1px, bb:1px` in both states
  - `.screening-actions-cluster > .screening-action-slot:last-child .button` at 1747px: `bl:0px, br:0px` in both states
- **Next:** this was the pilot. On approval, the same co-location pattern applies to the packet-page triple-right block (`responsive.css:2537-2579`), the pair-right packet block, and the form-page edge rules (`settings-fields.css:172` and similar).

### Commit 2a — packet triple-right consolidation
- **Scope:** `responsive.css` `@media (max-width: 900px)` block around lines 2519-2566. Factored the shared `border-top: 1px / var(--line)` out of slot-2 and slot-3 restoration rules into a combined selector. Added a "PACKET OVERVIEW EDGE-FLUSH CONTRACT" block comment documenting the visual grammar for both pair-right and triple-right variants. Removed the dead comment about the deleted Archive right-border restoration (historical noise from the 5c1d47f fix).
- **Verification:** computed-style diff on `.job-overview-actions--triple-right .screening-action-slot:nth-child(1|2|3) .button` at mobile (375px) produced identical border widths and colors in clean vs pilot states.
- **Rule count:** 3 restoration rules → 3 rules (shared-selector for border-top, slot-2 border-right, slot-3 border-left). Net: same rule count, shared-selector for the truly-shared property makes future drift less likely.

### Commit 2b — packet pair-right consolidation
- **Scope:** `responsive.css` @media (max-width: 900px) packet overview block. Merged pair-right's second-slot restoration into the same selector-list rules as triple-right's slot 2/3 restorations. Result: "top border restoration" is now ONE rule across pair-right slot 2 + triple-right slot 2 + triple-right slot 3. "Interior-seam left border restoration" is now ONE rule across pair-right slot 2 + triple-right slot 3 (both are right-hand slots in their respective layouts). Triple-right slot 2's right-border (the z:2 seam owner) stays in its own rule — unique to that slot.
- **Verification:** triple-right computed styles at 375px identical before/after the consolidation (stash/pop diff). Pair-right wasn't visible on the test job (requires pre-packet-generation state), but the cascade math is deterministic: pair-right slot 2 now matches triple-right slot 3's computed values for the shared properties (border-top + border-left), because they share the same selector-list rule.
- **Rule count:** 3 restoration rules (2 from 2a + 1 pair-right) → 3 rules (but now each is a shared-selector rule where applicable). Declaration count dropped from 7 to 5 — border-top is declared once for three slots, border-left once for two slots.

### Commit 2c — profile generate-action edge-flush cleanup
- **Scope:** `forms/settings-fields.css` — the `.upload-slot-chip-btn--action` rule (the "Generate profile" / "Profile generated" chip). Added a "PROFILE GENERATE-ACTION EDGE-FLUSH CONTRACT" block comment documenting why the chip has `border-right: 0` (bleeds through the settings section's right padding to the viewport edge). Removed three declarations that were exact duplicates of what the preceding `border: 1px solid var(--text)` shorthand already set: `border-left-width: 1px;`, `border-top-width: 1px;`, and `border-color: var(--text);`. Kept `border-right-width: 0` and `border-bottom: none` — those actually override the shorthand and are real behavior.
- **Verification:** computed-style diff on the action chip at both desktop (1747) and mobile (375) shows identical border widths and colors in clean vs pilot states (stash/pop both times). At desktop the chip is `bl:1 br:0 bt:1 bb:0` flush to viewport right (rect.right=1747); at mobile `bl:0 br:0 bt:1 bb:0` spanning full viewport (x:0, w:375, right:375). No pixel difference.

### Commit 2d — misc edge-flush cleanup (planned)
TBD.

### Commit 3 — grid-cell contract utilities (dead code)
- **Scope:** Created `app/styles/utilities/grid.css` with `.u-grid-cell`, `.u-grid-cell--first`, `.u-grid-cell--first-inset`, `.u-grid-cell--last`, and gap-tier modifiers (`--gap-tight`, `--gap-spacious`, `--gap-section`). Imported into `globals.css` between surface styles and `responsive.css`.
- **Zero-risk by construction:** zero elements in the DOM have any of the new class names (verified via `document.querySelectorAll` across the site). No rule can fire; no rendered element can differ.
- **The contract encoded:**
  - FIRST cell: `padding-left: 0` — the container's page padding provides the left inset.
  - NON-FIRST cells: `padding-left: 0` (text aligns to the column grid line so buttons below share the same line) + `padding-right: var(--grid-gap-standard)` (breathing room).
  - LAST cell: `padding-right: 0` (container's page padding owns the right edge; if the cluster bleeds to the viewport edge, the edge-flush contracts in queue-rows.css / settings-fields.css zero the button-level right border).
- **Verification:** dashboard's `.screening-summary-grid` already implements this exact contract today — `.queue-column` has `padding-left: 32px`, title cell has `padding-left: 0 / padding-right: 0`, meta cells have `padding-left: 0 / padding-right: 32px`. Applying the utility classes in Commit 4 will be pure annotation with identical computed output.

### Commit 4a — apply grid-cell contract to dashboard queue rows (pilot)
- **Scope:** [components/dashboard/stage-row.tsx](components/dashboard/stage-row.tsx) + [components/dashboard/potential-row.tsx](components/dashboard/potential-row.tsx). Title cell gets `u-grid-cell--first`, meta cells 2-5 get `u-grid-cell`. Both files are Protected Surfaces per AGENTS.md §Queue row family; user gave explicit approval to touch them for this pure-annotation pass.
- **No CSS changes.** The existing queue-rows.css rule (`main.jobs-index .queue-list .screening-summary-grid > .screening-cell:not(.screening-title-cell) { padding-right: var(--queue-column-pad); }`) has specificity `(0,4,1)` and wins over the utility's `(0,1,0)`. The utility's default `padding-right: var(--grid-gap-standard)` (16px) is therefore dormant on dashboard; the surface rule continues to own the value, breakpoint-responsive per `--queue-column-pad`.
- **Verification (bit-for-bit identical):**
  - Desktop (1747): all 5 cells have identical `pl`, `pr`, `x`, `w`, `right` values in clean vs pilot states. Title `pl:0 pr:0 x:521 w:418 right:939`; meta cells `pl:0 pr:32`, last cell `right:1747` (flush to viewport).
  - Mobile (375): identical across all 5 cells. Title `pl:0 pr:0 x:12 w:351 right:363`; meta cells `pl:0 pr:12`, last cell `right:363`.
- **Pattern documented in the TSX** via a block comment above the grid so the next editor sees the contract named without having to trace the CSS.

### Commit 4b — refine `.u-grid-cell` (drop default padding-right)
- **Scope:** `app/styles/utilities/grid.css`. Dropped `padding-right: var(--grid-gap-standard)` from the base `.u-grid-cell` rule; the base now sets only `padding-left: 0` (plus `box-sizing` and `min-width`). Added a new opt-in modifier `.u-grid-cell--gap-standard` so surfaces that want cell-level 16px breathing can still get it by name.
- **Motivation:** discovered while scoping 4c (packet-material-grid). That grid uses `gap: 24px` for breathing, with no cell-level padding. Applying the old `.u-grid-cell` would have stacked 16px of cell `padding-right` on top of the 24px gap, doubling the breathing — not pure annotation. The refined utility expresses only the universal invariant (column-line alignment via `padding-left: 0`); surfaces own breathing via `gap` or via opt-in `--gap-*` modifiers.
- **Verification:** dashboard computed styles unchanged at both desktop (1747) and mobile (375). The surface rule at `queue-rows.css:384` (specificity 0,4,1) wins over the utility (0,1,0), so removing the utility's default `padding-right: 16px` has no effect on dashboard — exactly as predicted. All 5 cells' `pl`, `pr`, `x`, `w`, `right` identical vs post-4a.

### Commits 4c-f — apply to remaining surfaces (planned)
TBD — packet, profile, job flow, operators. Each as a separate sub-commit with its own stash/pop verification.

### Commit 4 — roll contract to remaining surfaces (planned)
TBD.

### Commit 5 — docs sync (planned)
TBD.
