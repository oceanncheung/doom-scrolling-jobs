# Phase B UI System Contracts

Date: April 5, 2026

## Purpose

This document translates the audit into implementation rules for Phase B.

The goal is to improve system quality without changing the existing visual language on live routes.

## Non-Negotiable Constraint

- No visible UI redesign on existing product surfaces.
- Refactors must preserve current spacing, typography, borders, and interaction appearance unless a bug fix requires otherwise.
- Shared primitives should absorb duplication behind the scenes instead of changing route-level markup ad hoc.

## Primitive Families

### 1. Field labels

Owned by:
- `components/ui/field-label-row.tsx`
- `components/profile/review-state-indicator.tsx`
- `components/ui/status-indicator.tsx`

Contract:
- Use one shared field-label row for label + review indicator composition.
- Reuse `.field-label-row` and existing label classes so there is zero visual diff.
- Do not hand-roll review-indicator markup inside profile sections when the shared label primitive can own it.
- Status dots should come from the shared status primitive even when a route only needs the dot-only form.

Allowed use:
- underline fields
- autosize textareas
- upload-style textarea blocks
- tag-input sections

### 1a. Labeled headings

Owned by:
- `components/ui/labeled-heading.tsx`
- `components/ui/page-intro-header.tsx`
- `components/ui/section-heading.tsx`
- `components/ui/today-block-heading.tsx`

Contract:
- Repeated label + heading stacks should use one shared heading primitive.
- Standard section headers on profile and packet surfaces should use the shared section-heading wrapper so the shell classes stay consistent.
- Left-rail `today-block` heading stacks should use the shared rail-heading wrapper instead of hand-written `panel-label + h2` markup.
- Non-job route intro blocks should use the shared page-intro wrapper over the existing `queue-meta` shell.
- Preserve the existing wrapper structure used by route CSS:
  - section headers keep their stack wrapper
  - tab panel headers keep their inner wrapper
  - disclosure summaries keep the nested block expected by settings selectors
  - rail blocks keep `.today-block-heading`
  - page intro blocks keep `.queue-meta` and `.queue-meta-heading`
- This primitive is for structure reuse only. It must not introduce new visual styles.

### 2. Overlay option fields

Owned by:
- `components/ui/overlay-option-field.tsx`
- `lib/profile/overlay-placement.ts`
- `app/styles/forms.css`

Contract:
- One overlay panel contract across searchable underline fields and click-open underline fields.
- Trigger look must remain route-consistent:
  - searchable underline
  - button-style underline
- Overlay panel styling is shared; route-specific look changes are not allowed.
- Elevated settings surfaces should provide background context through inherited CSS variables instead of descendant overrides wherever possible.

### 3. Tag inputs

Owned by:
- `components/ui/tag-input.tsx`
- `app/styles/forms.css`

Contract:
- Two variants only:
  - `field`
  - `square`
- Square variant may use suggestions, but should reuse the shared overlay panel contract instead of inventing a separate menu design.
- Add-trigger iconography and chevron iconography must come from shared icon primitives.

### 4. Tabs and disclosures

Owned by:
- `components/profile/profile-form-controls.tsx`
- `app/styles/settings.css`

Contract:
- Settings tabs and disclosure controls must reuse shared tab button and disclosure wrappers.
- Shared tab shells and tab panels should come from the same control module so elevated-control structure does not drift between profile sections.
- Review state dots belong to the shared tab button, not route-specific copies.
- Elevated-control layout rules stay in `settings.css`.

### 5. Packet primitives

Owned by:
- `components/jobs/packet-primitives.tsx`
- `components/ui/status-indicator.tsx`
- `app/styles/forms.css`

Contract:
- Packet status pills, inline notes, remediation callouts, and question disclosure summaries should reuse shared packet primitives.
- Packet readiness labels should compose the shared status primitive while preserving the existing packet class names expected by route CSS.
- Packet surface refactors should preserve the existing packet class names so the visual system remains unchanged.
- Packet-specific shared blocks belong in packet primitives, not in generic UI primitives, unless they become truly cross-surface.

### 6. Dashboard row primitives

Owned by:
- `components/dashboard/stage-primitives.tsx`

Contract:
- Dashboard row detail sections should reuse shared detail-grid, detail-item, and inline-link wrappers instead of hand-rolling `panel-label + copy + link row` markup in each stage row.
- Preserve the existing `detail-pair-grid`, `detail-pair-grid-stack`, and `inline-link-row` classes so the queue visuals do not change.
- Route-specific row copy still belongs in the row component; the primitive only owns repeated shell structure.

### 7. Upload controls

Owned by:
- `components/settings/file-upload-slot.tsx`
- `app/styles/forms.css`

Contract:
- Chip upload state and idle upload state stay on one shared component.
- Upload, remove, and filename compaction behavior should not be reimplemented locally.

## Protected Contracts

These patterns are visually settled and should not be reinterpreted during cleanup or responsive work unless a scoped bug explicitly targets them.

### Source upload row

Owned by:
- `components/profile/sections/application-materials-section.tsx`
- `app/styles/forms/settings-fields.css`

Contract:
- `Resume` and `Cover letter` remain joined with a single seam.
- `Generate profile` remains flush to the right edge of the source row.
- The row keeps its approved alignment with the section content.
- Breakpoint work may only stack or reflow this row when a breakpoint-specific layout rule explicitly requires it.

### Active disclosure and tab chips

Owned by:
- `app/styles/settings/elevated-controls.css`

Contract:
- Opening a chip must not move the label vertically.
- Active chips must not reveal a bottom-rule leak during open or close.
- Interaction polish belongs in the shared elevated-controls contract, not route-specific selector patches.

## Shared Icon Rule

Owned by:
- `components/ui/icons/*`

Contract:
- Repeated chevrons, plus signs, and upload/remove icons should come from shared icon components.
- The icon components exist to preserve exact visual output while reducing drift.
- New route work should not inline these SVGs again.

## Inventory Rule

Owned by:
- `/system-inventory`

Contract:
- New shared primitives or behavior refinements should be exercised in the internal inventory route before spreading across product routes.
- The inventory route is internal and unlinked from the main product IA.
- Inventory-specific layout styles must stay isolated from live-route selectors.

## Verification Workflow

- Before closing any UI bug fix, run one live geometry check, one screenshot check, and one interaction check on the affected route.
- For protected contracts, regressions must be fixed at the owning shared contract, not at the consuming route.

## CSS Ownership Rule

- `tokens.css` owns tokens only.
- `forms.css` owns shared field, overlay, upload, tag, and bullet contracts.
- `settings.css` owns profile/settings page layout, disclosure behavior, and elevated-control layout.
- `dashboard.css` owns queue/detail/prep surfaces only.
- If a primitive needs route-specific selector hacks to render correctly, the primitive contract is incomplete and should be fixed at the shared layer.

## Phase B Thresholds

- No new shared primitive should be introduced without an inventory example.
- No route-specific selector should be added if an owning shared stylesheet already exists for that behavior.
- No shared control should inline duplicate icon SVGs.
- No client orchestrator should gain more rendering logic when a smaller primitive can own that concern.
