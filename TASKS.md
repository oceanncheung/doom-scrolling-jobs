# Execution Checklist

_Date: April 1, 2026_

## Phase A Planning

- [x] Write the initial product overview in `README.md`.
- [x] Capture Phase 1 requirements in `PRD.md`.
- [x] Define the initial schema for users, jobs, scoring, and application packets.
- [x] Define the job ranking framework with hard filters and weighted factors.
- [x] Record accepted product and architecture decisions in `DECISIONS.md`.
- [ ] Turn the Phase 1 checklist into GitHub issues and milestones.
- [ ] Decide the first launch sources for job ingestion.
- [ ] Define normalized enums for remote type, status, seniority, and recommendation levels.
- [ ] Draft prompt contracts for job parsing, scoring, resume tailoring, portfolio recommendation, and answer generation.
- [ ] Define acceptance criteria for a "good application packet."

## Phase B Foundation

- [x] Scaffold the Next.js app with TypeScript, App Router, and Supabase integration.
- [x] Set up environment variable strategy and commit an `.env.example`.
- [ ] Create the first Supabase migration for core tables and enums.
- [ ] Add row-level security policies for all user-owned data.
- [ ] Define storage buckets and access rules for resume exports and packet assets.
- [ ] Set up auth flow and initial onboarding gate.
- [x] Create shared types for profile, job, score, packet, and event records.
- [ ] Implement a repository-wide validation and formatting baseline.
- [ ] Set up GitHub Actions for lint, typecheck, and migration checks.

## Phase C Core Product

- [ ] Build the canonical profile setup flow.
- [ ] Implement CRUD for portfolio items and the master resume source.
- [ ] Design the raw intake contract for imported job data.
- [ ] Build the normalization pipeline for title, company, location, remote status, salary, and extracted skills.
- [ ] Add duplicate detection and source selection logic.
- [ ] Implement the first scoring engine using the model in `SCORING.md`.
- [ ] Persist per-user `job_scores` with explanation payloads.
- [ ] Build the main jobs dashboard with ranking, filtering, and shortlist actions.
- [ ] Build the job detail view with score breakdown, reasons, and red flags.
- [ ] Add saved searches and reusable filter presets.

## Phase D Application Prep

- [ ] Define the application packet generation contract end to end.
- [ ] Implement resume tailoring output generation from `resume_master` to `resume_versions`.
- [ ] Implement portfolio recommendation logic against `portfolio_items`.
- [ ] Generate cover letter drafts with editable sections.
- [ ] Generate structured short-answer responses and field-by-field application text.
- [ ] Build the packet review screen for editing and approval.
- [ ] Implement a practical resume PDF export flow.
- [ ] Save packet versions and tie them to application status changes.
- [ ] Add a user checklist for final manual submission steps.

## Phase E Refinement

- [ ] Tune scoring weights against real saved and skipped jobs.
- [ ] Add prompt version tracking and evaluation notes for each AI task.
- [ ] Improve remote classification for ambiguous listings.
- [ ] Add follow-up reminders and lightweight pipeline analytics.
- [ ] Instrument core user actions with PostHog.
- [ ] Add Sentry for runtime and generation error monitoring.
- [ ] Explore Playwright-assisted workflows only after manual prep flow is reliable.
- [ ] Review whether source expansion improves quality or only volume.
- [ ] Add export and reporting views for packet history and application outcomes.
