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

Contract:
- Use one shared field-label row for label + review indicator composition.
- Reuse `.field-label-row` and existing label classes so there is zero visual diff.
- Do not hand-roll review-indicator markup inside profile sections when the shared label primitive can own it.

Allowed use:
- underline fields
- autosize textareas
- upload-style textarea blocks
- tag-input sections

### 1a. Labeled headings

Owned by:
- `components/ui/labeled-heading.tsx`

Contract:
- Repeated label + heading stacks should use one shared heading primitive.
- Preserve the existing wrapper structure used by route CSS:
  - section headers keep their stack wrapper
  - tab panel headers keep their inner wrapper
  - disclosure summaries keep the nested block expected by settings selectors
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
- Review state dots belong to the shared tab button, not route-specific copies.
- Elevated-control layout rules stay in `settings.css`.

### 5. Upload controls

Owned by:
- `components/settings/file-upload-slot.tsx`
- `app/styles/forms.css`

Contract:
- Chip upload state and idle upload state stay on one shared component.
- Upload, remove, and filename compaction behavior should not be reimplemented locally.

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
