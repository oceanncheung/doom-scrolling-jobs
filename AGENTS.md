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
