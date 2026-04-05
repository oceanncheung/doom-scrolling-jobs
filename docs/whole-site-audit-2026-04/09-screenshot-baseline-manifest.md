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

## Responsive Audit Widths

These widths are for review coverage, not for adding more breakpoint rules:

- `1680`
- `1440`
- `1280`
- `1180`
- `1024`
- `900`
- `768`
- `640`
- `390`

## Capture Notes

- Keep captures aligned to the current editorial/brutalist composition.
- Baselines are for regression spotting, not for approving redesign.
- When a route changes intentionally, replace the baseline artifact and note the reason in the change summary.
