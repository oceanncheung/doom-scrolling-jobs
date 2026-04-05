# UI Primitive Inventory

## Goal

Define what the site's shared UI system actually is today, what should remain shared, and what must stop being improvised across route-level CSS and component state.

## Primitive Taxonomy

### Foundation

| Primitive | Current owner | Role |
| --- | --- | --- |
| Tokens | `app/styles/tokens.css` | Colors, fonts, layout tokens, overlap token, shell-wide sizing. |
| App shell | `app/styles/shell.css`, `components/navigation/*` | Header, rail shell, main workspace split. |
| Surface owners | `dashboard.css`, `settings.css`, `forms.css`, `operators.css` | Route-family layout and component contracts. |

### Shared UI Primitives

| Primitive family | Approved variants | Current owners | Use for | Do not use for |
| --- | --- | --- | --- | --- |
| Buttons | `primary`, `secondary`, `ghost`, `text` | CSS across `forms.css`, `dashboard.css`, `settings.css` | All site actions and links that behave like actions. | New route-local button treatments. |
| Adjacent controls | bordered siblings with `-1px` overlap | `tokens.css` overlap token plus owning stylesheet | Tab bars, grouped actions, upload pairs. | One-off seam fixes or per-button border hacks. |
| Underline field | text, textarea, click-to-open field, searchable field | `forms.css`, `AutoSizeTextarea`, `OverlayOptionField` | Single-value data entry. | Square chip add-inputs or route-local custom dropdowns. |
| Searchable option field | `underline-button`, `underline-search`, square-trigger overlay | `OverlayOptionField`, `TagInput`, `forms.css` | Current location, salary currency, list-backed tag additions. | Mixing native select, datalist, and custom panels per route. |
| Tag input | `field`, `square` | `TagInput`, `forms.css` | Multi-value chips and additive lists. | Single-value fields or arbitrary pills without semantic meaning. |
| Bullet list field | system-owned bullet editor | `BulletTextarea`, `forms.css` | Key results, proof points. | Freeform textareas with typed bullet characters. |
| Elevated control | disclosure shell, tab shell | `settings.css`, section components | Advanced filters, experience tabs, cover-letter tabs. | Ad hoc grey panels with custom borders. |
| Upload slot | idle chip, uploaded chip, fixed-width pair | `FileUploadSlot`, `ApplicationMaterialsSection`, `forms.css` | Resume and cover-letter source uploads. | Route-local upload rows. |
| Queue row | potential, saved, ready, applied, archived families | `components/dashboard/*`, `dashboard.css` | Ranked job lists and queue views. | Page-local list items with different row contracts. |
| Rail block | today block, stat block, action block | `WorkspaceTodayRail`, `ProfileSettingsRail`, `WorkspaceRailShell` | Side-rail summaries and actions. | Standalone mini-cards without rail scaffolding. |
| Status and lock state | dot indicator, lock frame, form message | `ReviewStateIndicator`, `SectionLockFrame`, footer/message helpers | Readiness, locked states, inline attention. | Route-local badges or hand-written alert paragraphs. |

## Current Inconsistencies

| Priority | Finding | Why it matters | Recommendation | Impact | Effort | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| `P1` | Overlay list behavior is shared visually but still split across `OverlayOptionField` and square `TagInput` logic. | This creates two trigger systems that are close, but not yet one true primitive family. | Formalize one overlay panel contract and two trigger contracts only: `underline` and `square chip`. | `system consistency` | `medium` | `frontend` |
| `P1` | Shared field styling relies heavily on descendant selectors in `forms.css`. | The primitive contract is currently encoded in CSS selector shape rather than in explicit component boundaries. | Move each field family toward a component-first class contract with smaller CSS scopes. | `maintainability` | `large` | `frontend` |
| `P1` | Elevated controls are stable visually but partly governed by documentation comments and cross-file conventions rather than explicit UI primitives. | New work can easily drift because the behavior is remembered rather than enforced. | Build component-level contracts for tabs, disclosures, and their panel shells. | `maintainability` | `medium` | `frontend` |
| `P1` | Status and lock states exist across profile, dashboard, and packet surfaces, but their copy and trigger logic vary. | The site feels less trustworthy when "ready", "locked", "draft", and "generated" mean different things by route. | Create one status-state model for loading, empty, locked, needs attention, and ready. | `system consistency` | `medium` | `shared` |
| `P2` | There is no internal inventory surface to test primitives in isolation before they spread. | Regressions are caught only on live pages. | Add an internal `/system-inventory` route with one example of every approved primitive and state. | `maintainability` | `medium` | `frontend` |

## Use This / Avoid This

### Use this

- One component owns each primitive's interaction contract.
- One stylesheet owner defines its visual contract.
- Overlay menus share one panel behavior even if triggers differ.
- Queue rows and rail blocks are reused as families, not reinvented per route.

### Avoid this

- Route-local dropdowns or list panels.
- Border-seam fixes implemented button by button.
- New status badges that bypass the shared dot/lock/message system.
- Ad hoc textareas used for structured lists.
- New page sections that mimic the elevated controls without using the existing shell.

## Recommended Internal Inventory Surface

Create one internal route, `/system-inventory`, with these sections:

1. Buttons and adjacent button groups
2. Underline fields
3. Overlay-list triggers and panels
4. Tag inputs and square add-fields
5. Bullet list editors
6. Tabs and disclosures
7. Upload controls
8. Queue rows
9. Rail blocks
10. Empty, locked, loading, ready, and attention states

This page should become the regression baseline for visual QA before primitives are reused on live routes.
