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

- **Next.js** for the internal dashboard and application-prep workspace
- **Supabase** for Postgres, storage, and future auth if the product expands beyond internal use
- **GitHub** for source control, issue tracking, and CI/CD
- **OpenAI / Anthropic / Google models** routed by task for parsing, scoring, and generation
- **Playwright** later for browser-assisted workflows, once manual apply prep is working
- **PostHog** later for product analytics and funnel instrumentation
- **Sentry** later for production error monitoring

## 6. Current Foundation

The repo now includes an initial Next.js + Supabase-ready foundation in addition to the planning docs.
The product is currently set up as a **single-user internal tool**, so there is no login flow in Phase 1.

- `app/` -> App Router layout, homepage, ranked jobs dashboard, job detail route, and health endpoint
- `app/profile/` -> single-user operator workspace with one freeform search brief plus structured profile, resume, and portfolio data
- `app/jobs/[jobId]` -> first job detail route with score breakdown, reasons, and risks
- `lib/` -> shared product constants, scoring weights, model routing, domain types, and Supabase helpers
- `supabase/` -> migrations, seed data, and local project config
- `.env.example` -> required Supabase public URL plus the server-only service role key for internal writes
- `README.md` / `PRD.md` / `SCHEMA.md` / `SCORING.md` / `TASKS.md` / `DECISIONS.md` -> durable product context

## 7. Local Setup

Requirements:

- Node.js `20.9+`
- npm `10+`

Commands:

1. `cp .env.example .env.local`
2. fill in the Supabase URL, publishable key, and service role key
3. `npm install`
4. `npm run dev`

Notes:

- No external auth is required right now; the app uses local operator selection instead.
- The app reads and writes against one seeded internal operator profile.
- The first preference input should be one freeform search brief, not a long questionnaire.
- Server-side profile reads and writes should use the service role key, not the public publishable key.

Useful scripts:

- `npm run lint`
- `npm run typecheck`
- `npm run check:ui-system`
- `npm run build`
- `npm run check`
- `npm run deploy:cloud-run`

## 8. Deployment

The app now supports a direct Google Cloud Run deployment flow.

- deployment guide: `docs/cloud-run-deployment.md`
- default service name: `doomscrollingjobs-web`
- default region: `northamerica-northeast1`
- default access mode: public

GitHub is now the deployment source of truth: pushes to `main` deploy the service through GitHub Actions.

## 9. Project Structure

Current structure and intended ownership:

- `app/` -> Next.js routes, layouts, and server actions
- `lib/config/` -> site metadata and product rails
- `lib/domain/` -> typed product entities and workflow enums
- `lib/scoring/` -> ranking weights and future evaluator logic
- `lib/ai/` -> task-based model routing and prompt orchestration
- `lib/supabase/` -> public and server-only Supabase clients for the internal operator setup
- `supabase/` -> SQL schema, policies, seeds, and local config
- `docs/` -> later home for long-form docs if the root gets too crowded

## 10. Next Steps

1. Build the normalization pipeline and source-selection logic behind the new job intake contracts.
2. Replace seeded `job_scores` with the first real scoring service using the model in `SCORING.md`.
3. Add shortlist, dismiss, and workflow mutation actions on the jobs dashboard.
4. Build the first packet review screen so profile -> jobs -> packet becomes a real flow.
5. Add generation services incrementally:
   - job parsing
   - scoring explanations
   - resume tailoring
   - portfolio recommendation
   - field-by-field application prep
