# Decisions Log

_Date initialized: April 1, 2026_

## ADR-001: One core profile per user

- Status: Accepted
- Date: April 1, 2026
- Decision: Each user has one canonical professional profile that powers ranking and generation.
- Rationale: The product is meant to strengthen one real professional identity, not fragment it into multiple personas.
- Consequences:
  - Profile editing must update a single source of truth.
  - Role targeting is handled through preferences and adjacent-role rules, not multiple profiles.
  - Resume and portfolio outputs must trace back to this one source profile.

## ADR-002: Resume tailoring happens per job

- Status: Accepted
- Date: April 1, 2026
- Decision: Resume changes are generated as job-specific versions derived from one master resume.
- Rationale: The user needs tailored applications without losing auditability or truthfulness.
- Consequences:
  - The system stores a canonical `resume_master` plus many `resume_versions`.
  - Tailoring logic should prioritize, reframe, and reorder real experience rather than invent new claims.
  - Resume versions should remain linked to both the master resume and the target job.

## ADR-003: Remote is required

- Status: Accepted
- Date: April 1, 2026
- Decision: Remote eligibility is a hard gate for Phase 1 job ranking.
- Rationale: Remote-only work is a confirmed user requirement and should not be diluted into a soft preference.
- Consequences:
  - Non-remote or hybrid-required roles should not receive an apply recommendation.
  - Remote normalization must be conservative and explicit.
  - Ranking quality depends on getting remote classification right early.

## ADR-004: Quality and salary are the leading ranking priorities

- Status: Accepted
- Date: April 1, 2026
- Decision: After remote gating, scoring should emphasize job quality first and salary second.
- Rationale: The product is meant to improve decision quality, not maximize application count.
- Consequences:
  - Scoring weights must put quality and salary above secondary factors.
  - Missing salary data should reduce confidence without automatically excluding a role.
  - The explanation layer must show why a high-quality role outranks a merely convenient one.

## ADR-005: Adjacent roles are allowed

- Status: Accepted
- Date: April 1, 2026
- Decision: The product supports designer-first roles plus adjacent roles when fit is credible.
- Rationale: Designers often move across overlapping role families, and strict title matching would hide viable opportunities.
- Consequences:
  - Role relevance scoring must distinguish exact-fit, adjacent-fit, and weak-fit roles.
  - Portfolio and skill alignment matter more for adjacent roles.
  - Clearly unrelated roles should still be deprioritized or filtered out operationally.

## ADR-006: Phase 1 focuses on manual application prep, not auto-submit

- Status: Accepted
- Date: April 1, 2026
- Decision: Phase 1 stops at recommendation, preparation, and tracking. Submission remains manual.
- Rationale: Direct apply automation is fragile, high-risk, and not necessary to deliver product value in the first release.
- Consequences:
  - The application packet becomes the central unit of value.
  - The product should optimize for reviewable outputs and faster manual apply flow.
  - Playwright or browser automation stays deferred until the prep workflow is stable.

## ADR-007: Portfolio is first-class for designers

- Status: Accepted
- Date: April 1, 2026
- Decision: Portfolio strategy is treated as a core system concern alongside resume strategy.
- Rationale: Design hiring depends heavily on visible work samples, not just written qualifications.
- Consequences:
  - `portfolio_items` must be structured data, not just a single URL field.
  - Scoring should consider whether the portfolio supports the role.
  - Application packets must recommend links or case studies intentionally.

## ADR-008: Recommended stack is Next.js + Supabase + GitHub + task-based model routing

- Status: Accepted
- Date: April 1, 2026
- Decision: Use Next.js for the app, Supabase for backend services, GitHub for source control and delivery, and route AI tasks across OpenAI, Anthropic, and Google models as appropriate.
- Rationale: This stack is practical for rapid product iteration, secure user data, and clear ownership of schema and app code.
- Consequences:
  - The repo can stay single-app and docs-first initially, then scaffold into a Next.js codebase.
  - Supabase should own Postgres and storage early; auth and row-level security can wait while the product stays internal.
  - AI services should stay modular by task instead of being collapsed into one opaque agent.
  - Playwright, PostHog, and Sentry are later-phase additions once the core workflow is working.

## ADR-009: Phase 1 runs as a single-user internal tool

- Status: Accepted
- Date: April 1, 2026
- Decision: The app should operate with one seeded internal user/profile instead of a login flow while usage is limited to Ocean / Alvis.
- Rationale: Product value right now comes from schema, ranking, and application-prep workflows, not account management.
- Consequences:
  - The first data layer should seed a deterministic internal operator record.
  - App routes can read and write against one default user/profile until true multi-user usage is needed.
  - Auth, login UX, and row-level security are intentionally deferred rather than half-built.
