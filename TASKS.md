# Execution Checklist

_Last updated: April 2, 2026_

## Completed

- [x] Write and keep the product docs in `README.md`, `PRD.md`, `SCHEMA.md`, `SCORING.md`, and `DECISIONS.md`.
- [x] Scaffold the Next.js App Router app and single-user Supabase setup.
- [x] Commit `.env.example` and make `npm run check` a reliable local verification loop.
- [x] Create the core Supabase schema for users, profiles, jobs, scoring, packets, answers, events, saved searches, and prompts.
- [x] Add the `search_brief` profile migration and seed one deterministic internal operator workspace.
- [x] Build the profile workspace with save/load for canonical profile fields, resume source content, and portfolio items.
- [x] Define shared domain types, scoring weights, presentation helpers, and Supabase server/client helpers.
- [x] Build the ranked jobs dashboard with recommendation and workflow filters.
- [x] Build the job detail page with visible score breakdown, fit reasons, red flags, and source links.
- [x] Add workflow actions for shortlist, dismiss, and status changes, persisted through `job_scores` and `application_events`.
- [x] Add the first workflow-learning loop so shortlist/dismiss/apply behavior changes ranking.
- [x] Build the packet review screen with editable packet, resume version, checklist, and structured answers persistence.
- [x] Define the raw intake contract for imported jobs and normalize basic fields into persisted `jobs` rows.
- [x] Replace demo-first feed behavior with real imported jobs when persisted imports exist.
- [x] Keep Remote OK as a source and add source expansion foundations: source registry, company watchlist, Greenhouse ATS importer, and source diagnostics.
- [x] Enforce remote-only plus designer-first import gates before jobs enter the ranked queue.
- [x] Add deterministic dedupe for imported jobs and keep the dashboard on a ranked queue instead of a raw import list.
- [x] Add import/refresh diagnostics via `app/api/jobs/import`.

## Next Up

- [ ] Harden packet lifecycle so saved packets, resume versions, workflow moves, and application events stay fully in sync.
- [ ] Add a practical resume PDF export flow from saved `resume_versions`.
- [ ] Add saved searches and reusable dashboard filter presets backed by `saved_searches`.
- [ ] Wire the `prompts` table into real task contracts for scoring and packet-generation work.
- [ ] Add a job activity timeline view with status history, packet linkage, and manual notes.

## After That

- [ ] Add follow-up reminders and lightweight pipeline analytics on top of `application_events`.
- [ ] Define storage buckets and access rules for resume exports and packet assets.
- [ ] Set up GitHub Actions for lint, typecheck, build, and migration verification.
- [ ] Add prompt/version evaluation notes for generation and scoring tasks.
- [ ] Improve source coverage further without weakening designer-first gating or ranking quality.
- [ ] Add PostHog instrumentation for core workflow actions.
- [ ] Add Sentry for runtime and generation error monitoring.
- [ ] Explore Playwright-assisted workflows only after packet prep and export are stable.
