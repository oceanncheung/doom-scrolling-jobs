# Responsive Breakpoint Contract

Date: April 5, 2026

## Canonical Desktop Baseline

- Desktop truth: `1920×1200`
- This is the reference composition, not a breakpoint
- The current Swiss / brutalist layout language should be preserved exactly at this size

## Breakpoint System

Use only four actual breakpoints:

- `1440px`
- `1180px`
- `900px`
- `640px`

This creates five layout zones:

| Zone | Width | Purpose |
| --- | --- | --- |
| Baseline desktop | `>= 1441px` | Canonical desktop composition |
| Compressed desktop | `1181px – 1440px` | Same architecture, tighter measures |
| Narrow desktop | `901px – 1180px` | Preserve two-part structure while collapsing inner grids |
| Tablet | `641px – 900px` | Rail becomes a top band, main content stacks below |
| Mobile | `<= 640px` | Single-column vertical composition |

## Non-Negotiable Rules

- Do not redesign the visual language at smaller sizes.
- Keep the same:
  - 1px rule weight
  - monochrome palette
  - uppercase label system
  - hard rectangular geometry
  - type hierarchy
- Recompose layout structure instead of endlessly shrinking content.
- Prefer stacking, re-gridding, and track changes over font downsizing.

## Route-Level Responsive Rules

### `/dashboard`

- `>= 1441px`: current rail + queue composition
- `1181px – 1440px`: same composition, tighter row internals and action clusters
- `901px – 1180px`: keep rail and queue distinct, but relax fixed widths and collapse dense row tracks
- `<= 900px`: rail becomes a top band above queue content; stage rows stack detail pairs vertically

### `/profile`

- `>= 1441px`: current rail + settings main
- `1181px – 1440px`: same structure, tighter field grids
- `901px – 1180px`: preserve left rail, but collapse inner two-column settings grids as needed
- `<= 900px`: left rail becomes a top block; disclosures and tabs remain ruled sections, not “cards”
- `<= 640px`: one-column stack; upload/action clusters and chip rows must avoid horizontal overflow

### `/operators`

- `>= 901px`: keep the current editorial composition
- `<= 900px`: stack operator/account blocks vertically while preserving rule rhythm

### `/jobs/[jobId]`

- `>= 1441px`: current job-review shell
- `1181px – 1440px`: same layout, tighter summary/action internals
- `901px – 1180px`: header snapshot and action bars collapse more aggressively
- `<= 900px`: route behaves like stacked editorial bands; no squeezed sidebar pattern

## Audit Widths

These widths should be audited even though not all of them are breakpoints:

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

## Failure Categories

Every responsive issue should be tagged as one of:

- overflow
- broken rail behavior
- collapsed action grouping
- misaligned rules or seams
- unreadable density
- broken overlay placement
- broken tab/disclosure behavior

## Implementation Guidance

- Keep breakpoint overrides in `app/styles/responsive.css`
- Shared contract ownership remains:
  - `forms.css` for shared field / overlay / tag behavior
  - `settings.css` for profile/settings layout behavior
  - `dashboard.css` for queue / job-review layout behavior
- Route owners should not solve responsive failures with ad hoc per-component inline styles
