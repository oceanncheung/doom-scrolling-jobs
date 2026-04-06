# Responsive Route Audit and Implementation Plan

Date: April 5, 2026

## Purpose

This document turns the breakpoint contract into an implementation-ready responsive plan.

It does three things:

1. identifies the current responsive drift in the repo
2. maps the pressure points by route
3. sequences the five-breakpoint implementation work

## Locked Decisions

- Canonical desktop baseline: `1920×1200`
- Actual breakpoints only:
  - `1440px`
  - `1180px`
  - `900px`
  - `640px`
  - `390px`
- Additional audit widths beyond those breakpoint widths are for coverage only
- Visual language must remain unchanged:
  - 1px rules
  - monochrome surfaces
  - uppercase labels
  - hard-edged geometry
  - existing type hierarchy

## Protected UI Contracts During Responsive Work

These controls are already approved and should be preserved while breakpoint work continues:

- the profile source upload row
- the active disclosure chip behavior
- the active experience / cover-letter tab behavior

Responsive implementation may only touch these patterns when a breakpoint-specific layout rule explicitly requires it, and every change must pass geometry, screenshot, and interaction verification before it is accepted.

## Current Responsive Drift

### 1. Breakpoint contract is now centralized, but still needs hardening

Current evidence:
- [responsive.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/responsive.css) uses:
  - `1440px`
  - `1180px`
  - `900px`
  - `640px`
  - `390px`
- [dashboard/job-flow.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/dashboard/job-flow.css) no longer owns its own route-local breakpoint override

Finding:
- The breakpoint contract now matches the agreed six layout zones
- The remaining work is pass-by-pass hardening, not inventing new breakpoint rules

### 2. Rail width and header width are too tightly coupled

Current evidence:
- [tokens.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/tokens.css) defines:
  - `--dashboard-rail: minmax(18rem, 28%)`
  - `--site-workflow-tab-width: calc((100vw - max(18rem, 28vw)) / 5)`
- [shell.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/shell.css) fixes the rail to `width: max(18rem, 28%)`

Finding:
- the header tab math, profile source row widths, and some settings field widths inherit desktop assumptions from the rail width
- this works at large desktop sizes, but it becomes brittle as the viewport narrows

### 3. Narrow desktop now exists, but still needs route sweeps

Current evidence:
- at `1180px`, [responsive.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/responsive.css) keeps the desktop rail/content shell and collapses inner grids and action groups instead
- the rail does not switch to stacked flow until `900px`

Finding:
- the missing narrow-desktop zone is now in place structurally
- the remaining work is to sweep each route for collisions, clipping, and density regressions within that zone

## Route Audit

### `/dashboard`

Current strengths:
- the queue / rail split is clear at desktop
- row/action seam logic is already robust

Current pressure points:
- between `901px` and `1180px`, the fixed rail still consumes a large percentage of the viewport
- queue rows and action clusters remain too dense until the full collapse hits
- the current `1180px` collapse is too abrupt for the amount of information in stage rows

Implementation target:
- `1440px`: keep the current structure, tighten row internals only
- `1180px`: keep rail + queue as two regions, but reduce rail claim and collapse inner row grids
- `900px`: convert the rail to a top band and stack queue content below
- `640px`: keep the queue readable with one-column row summaries and vertically stacked action groups
- `390px`: tighten safe padding, shorter action rows, and compact summary wrapping without changing the visual language

### `/profile`

Current strengths:
- the desktop rail + form composition is strong at large sizes
- disclosures, tabs, and ruled sections already form stable editorial bands

Current pressure points:
- the fixed settings rail remains too dominant between `901px` and `1180px`
- source document rows, tag rows, and paired form grids depend on desktop-era width assumptions
- too many form grids fully collapse only at `1180px`, which makes the change feel sudden

Implementation target:
- `1440px`: preserve full composition and tighten only internal measures
- `1180px`: keep rail + main split, but collapse selected inner grids earlier than today
- `900px`: move the rail to a full-width top band and keep the form below as ruled sections
- `640px`: convert all paired rows, upload/action rows, and repeat-card internals to single-column without horizontal overflow
- `390px`: tighten padding, chip wrapping, and overlay placement constraints for compact mobile

### `/jobs/[jobId]`

Current strengths:
- header, snapshot, and action systems already share the same editorial shell
- packet/job-review logic is now clearer after Phase C

Current pressure points:
- the job-flow header and snapshot still rely on desktop-style horizontal balance for too long
- action clusters, summary grids, and packet-adjacent blocks compress late
- route-local responsive behavior still lives partly outside the shared breakpoint contract

Implementation target:
- `1440px`: preserve the current header silhouette
- `1180px`: collapse dense snapshot/action internals without fully stacking the page
- `900px`: shift to stacked editorial bands with no squeezed side region
- `640px`: stack action groups cleanly and keep section rules aligned
- `390px`: shorten action and summary rows further while keeping rule alignment intact

### `/operators`

Current strengths:
- simplest route
- lower interaction density than profile/dashboard

Current pressure points:
- still inherits the shared rail/content shell behavior
- will look squeezed if the rail remains desktop-fixed too long

Implementation target:
- keep current composition until `900px`
- at `900px`, stack the rail band above the main operator content
- at `640px`, reduce internal padding but preserve the same rule rhythm
- at `390px`, apply compact-mobile padding and field spacing without changing the block language

## Breakpoint Implementation Order

### Pass 1: `1440px` compressed desktop

Goal:
- preserve the exact desktop architecture
- only tighten measures

Scope:
- reduce oversized horizontal assumptions tied to rail/header math
- collapse selected 3/4-column internals to 2 where needed
- keep fixed rail behavior intact

### Pass 2: `1180px` narrow desktop

Goal:
- create the missing narrow-desktop zone

Scope:
- stop using `1180px` as the full stack breakpoint
- preserve two-part composition
- relax rail width and collapse inner grids/action clusters before full stacking

### Pass 3: `900px` tablet

Goal:
- make the rail a top band instead of a squeezed sidebar

Scope:
- move desktop-fixed rail behavior to stacked flow
- keep sections as ruled horizontal bands, not cardified mobile blocks
- recompose dashboard, profile, and job review into top-band + content stack

### Pass 4: `640px` mobile

Goal:
- ensure no horizontal overflow and no broken control groups

Scope:
- move the current `720px` mobile logic down to `640px`
- collapse chips, button clusters, tab rows, and repeat-card internals into compact single-column systems

### Pass 5: `390px` compact mobile

Goal:
- make compact mobile intentional instead of a squeezed version of `640px`

Scope:
- tighten safe padding and action-row assumptions
- increase chip wrapping tolerance and summary stacking
- ensure overlays and list panels stay fully usable within the viewport

## Concrete CSS Refactor Targets

### Shared shell and tokens

- [tokens.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/tokens.css)
- [shell.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/shell.css)
- [responsive.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/responsive.css)

Needed:
- decouple rail width assumptions from header tab width assumptions
- make `responsive.css` the single owner of breakpoint overrides
- fold the current `720px` behavior into the new `640px` mobile breakpoint
- add an explicit `390px` compact-mobile pass instead of treating it as audit-only

### Route families

- Dashboard:
  - [dashboard/queue-meta.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/dashboard/queue-meta.css)
  - [dashboard/queue-rows.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/dashboard/queue-rows.css)
  - [dashboard/job-flow.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/dashboard/job-flow.css)
- Profile/settings:
  - [settings/page-shell.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/settings/page-shell.css)
  - [settings/elevated-controls.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/settings/elevated-controls.css)
  - [forms/settings-fields.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/forms/settings-fields.css)
  - [forms/overlay-controls.css](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/app/styles/forms/overlay-controls.css)

## Audit Widths

Review at:
- `1920`
- `1680`
- `1440`
- `1280`
- `1180`
- `1024`
- `900`
- `768`
- `640`
- `390`

These widths are still required for audit coverage even though only five of them become implementation breakpoints.

## Implementation Rule

Do not start writing responsive CSS route by route from memory.

Use this sequence every time:

1. reproduce at the target audit width
2. classify the failure:
   - overflow
   - broken rail behavior
   - collapsed action grouping
   - misaligned rules
   - unreadable density
   - overlay placement failure
3. fix the shared owner first
4. verify the affected route family

## Immediate Next Step

Finish and harden the `1440px` pass before moving to `1180px`.

Reason:
- it is the safest pass
- it lets the route families shake out compressed-desktop collisions before the bigger shell changes
- it gives the later `1180px`, `900px`, `640px`, and `390px` work cleaner shared contracts to build on
