# Screenshot Baseline Manifest

Date: April 5, 2026

## Purpose

This manifest defines the lightweight screenshot set that should be kept current during the next audit and responsive passes.

Desktop baseline:
- `1920×1200`

## Required Baselines

| Route | Viewport | Artifact label |
| --- | --- | --- |
| `/operators` | `1920×1200` | `operators-desktop-baseline` |
| `/dashboard` | `1920×1200` | `dashboard-desktop-baseline` |
| `/profile` | `1920×1200` | `profile-desktop-baseline` |
| `/jobs/[jobId]` | `1920×1200` | `job-review-desktop-baseline` |
| `/jobs/[jobId]/packet` | `1920×1200` | `packet-route-desktop-baseline` |

## Protected Contract Captures

Keep these focused captures alongside the route baselines because they are visually settled UI contracts:

| Surface | Viewport | Artifact label |
| --- | --- | --- |
| `/profile` source upload row | `1920×1200` | `profile-source-row-contract` |
| `/profile` open Additional filters chip | `1920×1200` | `profile-additional-filters-chip-open` |

## Responsive Audit Widths

These widths are for review coverage across the breakpoint system:

- `1680`
- `1440`
- `1280`
- `1180`
- `1024`
- `900`
- `768`
- `640`
- `390`

## Responsive Checkpoint Captures

After the responsive implementation sweep, keep spot-check captures at:

- `1440×1200`
- `1180×1100`
- `900×1000`
- `640×900`
- `390×844`

## Capture Notes

- Keep captures aligned to the current editorial/brutalist composition.
- Baselines are for regression spotting, not for approving redesign.
- When a route changes intentionally, replace the baseline artifact and note the reason in the change summary.
