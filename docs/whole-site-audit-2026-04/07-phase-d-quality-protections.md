# Phase D Quality Protections

Date: April 5, 2026

## Purpose

Phase D protects the product model and UI system that Phases A-C stabilized.

The goal is not a heavy QA platform yet. The goal is a lightweight, repeatable guardrail set that catches route breakage, visual drift, focus regressions, and copy leaks before they reach `main`.

## Protection Stack

### 1. Route smoke checks

Owned by:
- `scripts/smoke-routes.mts`
- `package.json`

Command:
- `npm run smoke:routes`

Coverage:
- `/operators`
- `/dashboard`
- `/profile`
- `/jobs/[jobId]`
- `/jobs/[jobId]/packet`

Contract:
- treat `200` as the expected result for primary pages
- allow `/jobs/[jobId]/packet` to return either `200` or the expected redirect response when packet routing intentionally bounces back to job review
- keep the default smoke base URL on the local dev server, but allow overrides through `SMOKE_BASE_URL` and `SMOKE_JOB_ID`

### 2. Lightweight screenshot baselines

Owned by:
- [09 Screenshot Baseline Manifest](./09-screenshot-baseline-manifest.md)

Contract:
- use `1920×1200` as the canonical desktop baseline
- keep screenshot coverage lightweight and route-focused
- do not introduce a full browser automation platform yet
- capture the five primary product surfaces first, then expand only if regressions justify it

### 3. Keyboard and focus regression checklist

Required surfaces:
- overlay lists
- upload controls
- disclosure summaries
- tab shells
- square tag inputs
- underline fields with chevrons

Required checks:
- keyboard user can reach every trigger
- focus ring or focus state is always visible
- overlays can be opened, navigated, and dismissed without the mouse
- active row hover styles do not obscure focus styles
- disclosure and tab controls preserve expected `Enter` / `Space` behavior

### 4. Copy QA checklist

All primary routes must be checked for:
- locked states that leak implementation detail
- empty states that do not explain the next action
- loading states that feel internal or technical
- fallback/database drift language
- packet/profile gating messages that say the same thing in different ways

Copy rule:
- user-facing product states must describe the user’s situation, not the implementation mode

## Release Gate

Before merge to `main`, the minimum Phase D gate is:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run build`
4. `npm run smoke:routes`
5. visual spot-check against the screenshot baseline manifest
6. keyboard/focus pass on the affected route family

## Notes

- This phase intentionally favors small, durable protections over large test infrastructure.
- If a route family keeps regressing, that is the signal to upgrade from checklist coverage to automated route-specific tests.
