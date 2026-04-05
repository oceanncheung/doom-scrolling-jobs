# Prioritized Remediation Roadmap

## Prioritized Findings Register

| Priority | Finding | Impact | Effort | Owner | Phase |
| --- | --- | --- | --- | --- | --- |
| `P0` | Create one explicit profile-readiness and ranking-eligibility model. | `logic integrity` | `medium` | `shared` | A |
| `P1` | Standardize terminology across account/profile/queue/job/packet flows. | `user clarity` | `small` | `product` | A |
| `P1` | Separate job review and application packet view models. | `system consistency` | `medium` | `shared` | A |
| `P1` | Formalize shared field, overlay, and tag primitives. | `system consistency` | `medium` | `frontend` | B |
| `P1` | Build an internal system-inventory route for primitive QA. | `maintainability` | `medium` | `frontend` | B |
| `P1` | Split oversized CSS owners into smaller contract-based partials without breaking ownership. | `maintainability` | `large` | `frontend` | B |
| `P1` | Decompose profile and packet orchestration layers. | `maintainability` | `large` | `shared` | C |
| `P1` | Normalize seed, fallback, and database-backed behavior into one explicit environment mode contract. | `logic integrity` | `medium` | `shared` | C |
| `P1` | Add shared accessibility behavior for overlay lists and custom input controls. | `accessibility` | `medium` | `frontend` | B |
| `P2` | Remove internal implementation terms from user-facing copy and system messages. | `user clarity` | `small` | `product` | A |
| `P2` | Add route smoke tests, visual baselines, and keyboard regression checks. | `maintainability` | `medium` | `shared` | D |

## Phase A: Correct the Product Model

### Deliverables

- Canonical glossary for user-facing nouns and verbs
- Route responsibility spec for the five main surfaces
- Explicit state definitions for:
  - profile source state
  - profile readiness
  - ranking eligibility
  - job workflow state
  - packet state
- Copy cleanup plan for any terms that leak implementation

### Success criteria

- Every route has one primary job to be done.
- Every user-facing queue/view label maps clearly to one underlying state model.
- No user-facing copy uses `operator`, `canonical`, `seed`, `database-fallback`, or similar implementation terms.

## Phase B: Stabilize the UI System

### Deliverables

- Shared primitive catalog implemented as an internal `/system-inventory` surface
- One approved overlay-list contract
- One approved field-family contract per field type
- One approved elevated-control contract for disclosures and tabs
- One approved status-state contract for ready/attention/locked/loading/empty

### Success criteria

- A new page can be built using existing primitives without route-level CSS hacks.
- Overlay lists behave consistently across profile, advanced filters, and rail fields.
- Keyboard and focus behavior is defined and testable for all custom list controls.

## Phase C: Simplify Logic Boundaries

### Deliverables

- Separate parsing, normalization, validation, rendering, generation, persistence, and route invalidation into explicit layers
- Split large mixed-responsibility modules
- Distinct view models for job review and application packet
- Explicit environment mode handling for blank fallback, seeded fallback, and live database mode

### Success criteria

- Server actions read like commands, not like full feature implementations.
- Normalizer modules do not call the database or route invalidation APIs.
- Route loaders assemble view models instead of carrying business logic.

## Phase D: Add Product-Quality Protections

### Deliverables

- Route-level smoke tests for all five primary surfaces
- Visual regression baselines for:
  - dashboard
  - profile
  - operators
  - job review
  - application packet
- Keyboard and focus checks for overlays, disclosures, tabs, and uploads
- Copy QA checklist

### Success criteria

- Shared primitive regressions are caught before they land on live routes.
- Locked, empty, loading, and error states behave consistently.
- The private-beta flow remains stable as new features are added.

## Architecture Refactor Map

## CSS owners

| Current hotspot | Current size | Risk | Target |
| --- | --- | --- | --- |
| `app/styles/forms.css` | 1,967 lines | Shared field, overlay, upload, tag, bullet, and state behavior all live together. | Keep `forms.css` as the owner file, but split it into contract partials such as `forms/fields.css`, `forms/overlays.css`, `forms/uploads.css`, `forms/lists.css`, imported by the owner. |
| `app/styles/dashboard.css` | 1,450 lines | Queue rows, detail surfaces, rails, and job-flow presentation are tightly coupled. | Split into queue rows, job flow, and rail sections while keeping `dashboard.css` as the ownership entrypoint. |
| `app/styles/settings.css` | 941 lines | Settings layout and elevated control behavior are dense and easy to regress. | Split into page layout, elevated controls, and rail-specific sections under the same ownership root. |

## UI and domain hotspots

| Current hotspot | Current size | Risk | Target |
| --- | --- | --- | --- |
| `components/profile/profile-form.tsx` | 545 lines | One client component owns too many route concerns and local state branches. | Split into page container, form model hook, and section-level containers. |
| `lib/profile/master-assets.ts` | 1,287 lines | Normalization, rendering, validation, issue collection, and confidence policy are coupled. | Split into `normalize`, `validate`, `render`, and `derive-state` modules. |
| `lib/data/application-packets.ts` | 900 lines | Data loading and packet-composition logic are mixed. | Separate packet read model, selection heuristics, and generation input assembly. |

## Maintainability Thresholds

Use these as hard review triggers:

| Area | Warning threshold | Split threshold |
| --- | --- | --- |
| Shared stylesheet owner | 600 lines | 900 lines |
| Client orchestration component | 300 lines | 450 lines |
| Shared UI primitive component | 200 lines | 300 lines |
| Domain/service module | 500 lines | 800 lines |

Additional rules:

- No shared primitive should require route-specific descendant selectors to look correct.
- No client component should own route orchestration, review logic, and serialization at the same time.
- No route should directly implement a new control pattern if an approved primitive family already exists.

## Recommended Sequence

1. Lock terminology and state models before any visual cleanup.
2. Stabilize primitives before refactoring route sections.
3. Simplify logic boundaries before adding more AI-assisted features.
4. Add regression protection before the next major feature wave.
