# Grid audit 2026-04 — verification ledger

Running refactor per `/design-system` audit. Each commit adds tokens / contracts / utilities without moving pixels. This file records the baseline and the verification method used to confirm layout intactness at each step.

## Baseline

Captured 2026-04-17 before Commit 1:

- **Screenshots:** `baseline/` (via `npm run capture:ui` with `UI_ARTIFACTS_ROOT=docs/grid-audit-2026-04/baseline`). 11 PNGs covering every significant surface at multiple viewports.
- **Noise profile:** `routes/dashboard.png` is non-deterministic between captures (rotating timestamp / data). Two back-to-back captures with zero code changes produced different hashes on that file and that file only. For dashboard, fall back to computed-style inspection (below).
- **Stable targets:** the other 10 PNGs hash-match across repeat captures.

## Per-commit verification protocol

1. `npm run capture:ui` with a scoped `UI_ARTIFACTS_ROOT=docs/grid-audit-2026-04/post-commit-N/`.
2. `shasum -a 256` diff against `baseline/` for every PNG except `routes/dashboard.png`.
3. For dashboard (and any page that newly enters the flaky set), fetch computed styles via preview_eval for the key selectors listed below and diff against the JSON baseline.
4. If any stable PNG changes hash OR any computed-style value differs beyond sub-pixel rounding, **halt the commit, surface the diff, and roll back.**

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

### Commit 2 — edge-flush utility (planned)
TBD.

### Commit 3 — grid-cell contract pilot on dashboard (planned)
TBD.

### Commit 4 — roll contract to remaining surfaces (planned)
TBD.

### Commit 5 — docs sync (planned)
TBD.
