# AI Job Search Dashboard & Application Prep Hub
_Last updated: April 1, 2026_

## 1. Product Definition

Build a **job search dashboard and application-prep hub for designers**.

This is **not** a full auto-apply bot in the first phase.

The product should help a designer:

- automatically discover relevant jobs
- prioritize **quality-first** opportunities
- filter for **remote-only**
- evaluate salary potential
- support **graphic design + adjacent roles**
- generate all application materials needed for each job
- prepare field-by-field content for manual submission
- adapt the resume per job while keeping **one core user profile**

## 2. Product Goal

Create a system that behaves like a **designer job operating system**, not a spray-and-pray tracker.

The product should answer:

- Which jobs are worth applying to?
- Which remote roles are highest quality?
- Which roles fit the user's real experience and portfolio?
- Which resume version and portfolio link should be used?
- What text should be pasted into each application field?
- What has already been applied to, skipped, or followed up on?

## 3. Phase 1 Scope

Phase 1 is a **job discovery, ranking, and application-prep system**.

It should:

- collect jobs from a small set of sources
- normalize and deduplicate job records
- score jobs against one canonical user profile
- rank remote roles by quality first and salary second
- support designer-first and adjacent design roles
- let the user shortlist, dismiss, and track jobs
- generate application materials for **manual** submission

Phase 1 does **not** include direct application submission automation.

## 4. Confirmed Product Rules

- Primary user is a designer; adjacent design roles are allowed when fit is strong.
- Each user has **one core profile**.
- Resume tailoring happens **per job** from that source profile.
- Remote is a **hard requirement**.
- Quality and salary are the most important ranking factors after remote.
- Portfolio strategy is first-class, not an afterthought.
- AI should prepare application content, but the user stays in control of the final submission.

## 5. Recommended Stack

- **Next.js** for the web app and authenticated dashboard
- **Supabase** for auth, Postgres, storage, and row-level security
- **GitHub** for source control, issue tracking, and CI/CD
- **OpenAI / Anthropic / Google models** routed by task for parsing, scoring, and generation
- **Playwright** later for browser-assisted workflows, once manual apply prep is working
- **PostHog** later for product analytics and funnel instrumentation
- **Sentry** later for production error monitoring

## 6. Current Foundation

The repo now includes an initial Next.js + Supabase-ready foundation in addition to the planning docs.

- `app/` -> App Router layout, homepage, dashboard shell, and health endpoint
- `lib/` -> shared product constants, scoring weights, model routing, domain types, and Supabase helpers
- `supabase/` -> reserved workspace for migrations, policies, and local project config
- `proxy.ts` -> session refresh boundary for Supabase SSR auth
- `.env.example` -> required public Supabase environment variables
- `README.md` / `PRD.md` / `SCHEMA.md` / `SCORING.md` / `TASKS.md` / `DECISIONS.md` -> durable product context

## 7. Local Setup

Requirements:

- Node.js `20.9+`
- npm `10+`

Commands:

1. `cp .env.example .env.local`
2. fill in the Supabase URL and publishable key
3. `npm install`
4. `npm run dev`

Useful scripts:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run check`

## 8. Project Structure

Current structure and intended ownership:

- `app/` -> Next.js routes, layouts, and server actions
- `lib/config/` -> site metadata and product rails
- `lib/domain/` -> typed product entities and workflow enums
- `lib/scoring/` -> ranking weights and future evaluator logic
- `lib/ai/` -> task-based model routing and prompt orchestration
- `lib/supabase/` -> browser, server, and proxy auth utilities
- `supabase/` -> SQL schema, policies, seeds, and local config
- `docs/` -> later home for long-form docs if the root gets too crowded

## 9. Next Steps

1. Convert `SCHEMA.md` into the first Supabase migration and row-level security plan.
2. Add authenticated profile onboarding for the one-profile-per-user model.
3. Define ingestion contracts for raw jobs, normalized jobs, and deduplication.
4. Build the scoring service around the hard-filter plus weighted-score model in `SCORING.md`.
5. Add generation services incrementally:
   - job parsing
   - scoring explanations
   - resume tailoring
   - portfolio recommendation
   - field-by-field application prep
