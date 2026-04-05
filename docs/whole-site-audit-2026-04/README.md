# Whole-Site Product and System Audit

Date: April 5, 2026

## Purpose

This audit reviews the current site as one connected product system, not as separate frontend, backend, and UX tracks.

The goal is to preserve the current Swiss/editorial visual direction while answering four questions:

1. Is the product model coherent?
2. Are the page responsibilities and IA clean?
3. Is the UI system stable enough for repeated growth?
4. Are the logic and code boundaries sustainable for private beta and beyond?

## Assumptions

- Keep the current editorial grid direction.
- Optimize for balanced private-beta usability and long-term system health.
- Treat these docs as a working audit and execution roadmap, not a speculative strategy deck.

## Repo Evidence Snapshot

| Area | Current evidence |
| --- | --- |
| Primary routes | `/operators`, `/dashboard`, `/profile`, `/jobs/[jobId]`, `/jobs/[jobId]/packet` |
| Shared CSS hotspots | `app/styles/forms.css` (1,967 lines), `app/styles/dashboard.css` (1,450), `app/styles/settings.css` (941) |
| UI orchestrators | `components/profile/profile-form.tsx` (545 lines), `components/ui/tag-input.tsx` (346), `components/ui/overlay-option-field.tsx` (224) |
| Domain and logic hotspots | `lib/profile/master-assets.ts` (1,287 lines), `lib/data/application-packets.ts` (900), `lib/data/operator-profile.ts` (373) |
| Shared route shell | `WorkspaceSurface`, `WorkspaceTodayRail`, `WorkspaceHeader` |
| AI task shape | task-based files already exist for profile generation, canonical sources, job summaries, resume variants, cover letters, and answers |

## Deliverables

| Artifact | Purpose |
| --- | --- |
| [01 Route and User Flow Map](./01-route-and-user-flow-map.md) | Defines the real user journey and the responsibility of each page. |
| [02 Canonical IA and Terminology Map](./02-canonical-ia-terminology-map.md) | Cleans up nouns, verbs, and user-facing naming. |
| [03 UI Primitive Inventory](./03-ui-primitive-inventory.md) | Defines the shared UI system, primitive families, and inconsistency fixes. |
| [04 Logic and State Machine Audit](./04-logic-and-state-machine-audit.md) | Separates truth, preferences, generated artifacts, and UI state; defines target state models. |
| [05 Prioritized Remediation Roadmap](./05-prioritized-remediation-roadmap.md) | Sequences the work into executable phases with ownership and thresholds. |
| [06 Phase B UI System Contracts](./06-phase-b-ui-system-contracts.md) | Locks the no-visual-diff primitive rules for the current UI system cleanup. |
| [07 Phase D Quality Protections](./07-phase-d-quality-protections.md) | Defines smoke checks, screenshot baselines, keyboard/focus QA, and copy QA expectations. |
| [08 Responsive Breakpoint Contract](./08-responsive-breakpoint-contract.md) | Locks the desktop baseline, the four breakpoint system, and route-level responsive behavior rules. |
| [09 Screenshot Baseline Manifest](./09-screenshot-baseline-manifest.md) | Lists the lightweight baseline captures that should be maintained for the core routes. |

## Top Findings

| Priority | Finding | Impact | Effort | Owner |
| --- | --- | --- | --- | --- |
| `P0` | Ranking unlock depends on several scattered signals instead of one explicit readiness state. | `logic integrity` | `medium` | `shared` |
| `P1` | User-facing terminology drifts between `account`, `operator`, `workspace`, `profile`, `saved`, `shortlisted`, `prepared`, and `ready to apply`. | `user clarity` | `small` | `product` |
| `P1` | Job review and application packet are routed separately but rendered from the same page model, which blurs page purpose. | `system consistency` | `medium` | `shared` |
| `P1` | Shared field, overlay, and tag behaviors are split across large CSS files and overlapping components, increasing regression risk. | `maintainability` | `large` | `frontend` |
| `P1` | Current large shared files already exceed a sustainable threshold for long-term ownership. | `maintainability` | `large` | `shared` |
| `P1` | Custom overlay list behavior does not yet have a fully explicit accessibility and keyboard contract. | `accessibility` | `medium` | `frontend` |

## Recommended Reading Order

1. Start with the route and user flow map.
2. Lock the canonical terminology map.
3. Review the logic/state audit before touching UI refactors.
4. Use the roadmap as the execution sequence.
