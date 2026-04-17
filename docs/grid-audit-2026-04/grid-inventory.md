# Grid Inventory — Doom Scrolling Jobs

Reference snapshot of every grid container rendered across the site, organized by page. Paired with the `.u-grid-cell` contract documented in `app/styles/utilities/grid.css`:

- **FIRST cell** → `padding-left: 0` (container's page padding provides the left inset).
- **NON-FIRST cells** → `padding-left: 0` (align to column grid line so buttons below share the same left edge as text above).
- **Breathing** → owned by the surface via `gap: Npx` on the grid container OR via `padding-right: Npx` on the cell. Never by the utility.
- **LAST cell** → `padding-right: 0` when the cluster bleeds to the viewport edge (paired with the edge-flush contracts in `queue-rows.css`, `responsive.css`, `settings-fields.css`).

Status key:
- **ANNOTATED** — `.u-grid-cell` / `.u-grid-cell--first` classes applied in TSX (Commit 4 series).
- **INHERENT** — contract satisfied by default; classes not applied (protected surface or low-value annotation).
- **PROTECTED** — render site in `AGENTS.md §Protected Surfaces`; touch only with explicit user approval.

---

## `/dashboard` (jobs queue)

### `.screening-summary-grid` — 5-col desktop meta grid
- **CSS:** `app/styles/dashboard/queue-rows.css:355`
- **Rendered in:** `components/dashboard/potential-row.tsx:42`, `components/dashboard/stage-row.tsx:29` _(both Protected)_
- **Cells:** `.screening-title-cell` (first) + 4× `.screening-cell`
- **Cell pr rule:** `padding-right: var(--queue-column-pad)` via `queue-rows.css:384` (non-title cells only)
- **Contract status:** **ANNOTATED** in Commit 4a (with explicit user approval for Protected files)

### `.screening-actions-bar` / `.stage-actions-bar` — 2-button action row
- **CSS:** `app/styles/dashboard/queue-rows.css:486, 507`
- **Rendered in:** `components/dashboard/potential-row.tsx:93`, `stage-row.tsx:66`
- **Cells:** `.screening-action-slot` × 2
- **Contract status:** **INHERENT** (cells have pl:0 by default; edge-flush handled via the JOBS-QUEUE EDGE-FLUSH CONTRACT block at `queue-rows.css:690+`)

### `.stage-row-grid` — 6-col expanded row
- **CSS:** `app/styles/dashboard/queue-rows.css:798`
- **Cells:** various metadata + action slot
- **Contract status:** INHERENT

---

## `/jobs/[jobId]` (job review)

### `.job-review-grid` — 2-col overview grid
- **CSS:** `app/styles/dashboard/job-flow.css:254`
- **Rendered in:** `components/jobs/job-overview-section.tsx:47`
- **Cells:** `.job-review-column` × 2 (Job overview + Skills)
- **Contract status:** **ANNOTATED** in Commit 4e

### `.flow-snapshot` — 3-col meta snapshot
- **CSS:** `app/styles/shell.css:54`
- **Cells:** 3 × metadata items
- **Contract status:** INHERENT

### `.job-flow-meta-band` — auto-flow meta grid
- **CSS:** `app/styles/dashboard/job-flow.css:71`
- **Cells:** `.job-flow-meta-item--*`
- **Contract status:** INHERENT

---

## `/jobs/[jobId]/packet`

### `.packet-material-grid` — 2-col summary grid
- **CSS:** `app/styles/forms/packet-form.css:116`
- **Rendered in:** `components/jobs/packet-materials-section.tsx:63`
- **Cells:** `.packet-material-block` × 4 (Resume summary / changes, Cover letter summary / changes)
- **Contract status:** **ANNOTATED** in Commit 4c

### `.packet-material-review-stack` — vertical download stack
- **CSS:** `app/styles/forms/packet-form.css:128`
- **Cells:** `.packet-material-review-block` × 2
- **Contract status:** INHERENT (single-column stack; contract doesn't apply semantically)

### `.screening-actions-bar.job-overview-actions` — Apply / Regenerate / Archive row
- **Edge-flush contract:** documented in `responsive.css` PACKET OVERVIEW EDGE-FLUSH CONTRACT block at `~line 2519`
- **Contract status:** INHERENT + edge-flush documented

---

## `/profile` _(all files are Protected Surfaces — Commit 4d skipped)_

### Experience + Strengths section
- `.strengths-experience-grid` — 2-col header
- `.field-grid-2` — repeat cards (2-col label pairs)
- `.field-grid-dates-row` — start/end date pairs
- **Protected:** `components/profile/sections/experience-strengths-section.tsx`
- **Contract status:** INHERENT + PROTECTED

### Cover Letter Strategy section
- `.repeat-card-proof-grid` — 2-col proof card layout
- **Protected:** `components/profile/sections/cover-letter-strategy-section.tsx`
- **Contract status:** INHERENT + PROTECTED

### Job Targets section
- `.settings-core-grid` — 2-col fields
- `.settings-matching-controls-grid` — 3-col sliders
- `.settings-job-targets-grid` — flex column
- **Protected:** `components/profile/sections/job-targets-section.tsx`
- **Contract status:** INHERENT + PROTECTED

### Application Materials section
- `.settings-source-grid` — 2-col upload grid
- `.settings-source-uploads-row--materials` — 3-col chip row with seam-sharing
- **Protected:** `components/profile/sections/application-materials-section.tsx`
- **Contract status:** INHERENT + PROTECTED + custom edge-flush contract at `settings-fields.css:158+` (PROFILE GENERATE-ACTION EDGE-FLUSH CONTRACT, Commit 2c)

---

## `/operators`

### `.operator-row-button` — 2-cell sign-in row
- **CSS:** `app/styles/operators.css:226`
- **Rendered in:** `components/operators/operator-access-form.tsx:27`
- **Cells:** `.operator-row-main` (name+email) + `.operator-row-meta` (status)
- **Contract status:** **ANNOTATED** in Commit 4f

### `.operator-setup-form` — create-account form
- **Cells:** `.field` × 2 (display name + email)
- **Contract status:** INHERENT (vertical stack via `.profile-fields`)

---

## Edge-flush contracts (button-level seam + viewport handling)

Separate from the grid-cell contract. These handle border painting when a button cluster bleeds to the viewport edge.

| Surface | Block location | Scope |
|---|---|---|
| Jobs-queue action bars | `queue-rows.css:690+` "JOBS-QUEUE EDGE-FLUSH CONTRACT" | desktop + mobile |
| Packet overview actions | `responsive.css:~2519` "PACKET OVERVIEW EDGE-FLUSH CONTRACT" | ≤900px |
| Profile generate-action | `settings-fields.css:158+` "PROFILE GENERATE-ACTION EDGE-FLUSH CONTRACT" | all breakpoints |
| Action-bar top hairline | `queue-rows.css:~528+` (bar-level `::before` overlay) | all breakpoints |

These exist because viewport edges aren't a painted container — painting a 1px border flush against the viewport reads as a line glued to the screen. Each contract zeros the cluster's viewport-adjacent button borders and (where needed) anchors a hairline at the bar level so the top rule survives button opacity fades during pending states.

---

## Adding a new grid

When introducing a new grid to any surface:

1. **Inventory the cells.** Does the first cell need a left inset? The container should provide it via padding. Do NOT set cell-level `padding-left` on non-first cells.
2. **Pick a breathing mechanism.** `gap: var(--grid-gap-*)` on the container is the default. If you need breakpoint-responsive breathing (like the dashboard), use a surface-specific `padding-right` rule on the cell.
3. **Apply the utility classes if possible.** `.u-grid-cell--first` on cell 1, `.u-grid-cell` on the rest. This is optional — the contract holds as long as cells have `padding-left: 0` by default.
4. **If the cluster bleeds to the viewport,** add an edge-flush block to the nearest surface stylesheet. Follow the pattern of the three existing blocks listed above.
5. **If the grid lives in a Protected Surface file** (`AGENTS.md §Protected Surfaces`), consult the user before touching TSX. The CSS utility applies regardless.

Update this inventory when you add a grid that renders on a page not yet listed here.
