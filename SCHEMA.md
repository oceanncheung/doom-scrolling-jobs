# Initial Data Model

_Date: April 1, 2026_

## 1. Modeling Principles

- One user has one canonical profile.
- Resume tailoring creates job-specific versions, not alternate identities.
- Job normalization and scoring are separate concerns.
- Application prep outputs are stored as structured artifacts, not just blobs of AI text.
- The schema should support multi-user operation later, even if the initial product is effectively single-user.
- The initial Supabase seed can safely create one deterministic internal user/profile without changing the long-term model.

## 2. Shared Conventions

- Primary keys use `uuid`.
- Timestamps use `timestamptz`.
- `created_at` and `updated_at` exist on all user-owned records.
- Soft deletion is optional later; Phase 1 can use active/inactive states where needed.
- Enumerated values should be implemented as Postgres enums or constrained text once the schema moves into Supabase.

## 3. Entity Overview

| Entity | Purpose | Phase 1 |
| --- | --- | --- |
| `users` | Internal account container and future auth anchor | Core |
| `user_profiles` | Canonical professional profile and preferences | Core |
| `portfolio_items` | Structured portfolio library | Core |
| `resume_master` | Source resume content owned by the user | Core |
| `resume_versions` | Job-specific resume variants | Core |
| `jobs` | Normalized job listings | Core |
| `job_scores` | Per-user job ranking outputs | Core |
| `application_packets` | Per-job bundle of application-ready materials | Core |
| `application_answers` | Structured answers for specific questions or fields | Core |
| `application_events` | Timeline of status changes and actions | Core |
| `saved_searches` | Persisted filters and intake preferences | Core |
| `prompts` | Versioned prompt templates and task metadata | Core |

## 4. Tables

### 4.1 `users`

Purpose: account-level identity. In Phase 1 this is a manually seeded internal operator record rather than a Supabase Auth user.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; deterministic internal user ID in Phase 1 |
| `email` | `text` | Unique account email or internal operator identifier |
| `display_name` | `text` | Optional account display name |
| `auth_provider` | `text` | `internal` in Phase 1; can later map to real auth providers |
| `account_status` | `text` | `active`, `paused`, `disabled` |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |
| `last_seen_at` | `timestamptz` | Optional UX metric |

Relationships:

- one `users` -> one `user_profiles`
- one `users` -> many `portfolio_items`
- one `users` -> one `resume_master`
- one `users` -> many `resume_versions`
- one `users` -> many `job_scores`
- one `users` -> many `application_packets`
- one `users` -> many `application_events`
- one `users` -> many `saved_searches`

Phase 1 core:

- identity and ownership fields only

Later:

- billing, team access, onboarding state, subscription info

### 4.2 `user_profiles`

Purpose: canonical profile used for scoring and generation.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Unique FK to `users.id` |
| `search_brief` | `text` | One-field freeform preference brief used before structured follow-ups |
| `headline` | `text` | Primary professional label |
| `location_label` | `text` | Current location string |
| `timezone` | `text` | For reminders and follow-up cadence |
| `remote_required` | `boolean` | Hard requirement, defaults true |
| `salary_floor_currency` | `text` | ISO currency code |
| `salary_floor_amount` | `integer` | Minimum acceptable base pay |
| `salary_target_min` | `integer` | Preferred lower bound |
| `salary_target_max` | `integer` | Preferred upper bound |
| `seniority_level` | `text` | Mid, senior, lead, director, etc. |
| `target_roles` | `jsonb` | Ordered list of preferred role titles |
| `allowed_adjacent_roles` | `jsonb` | Approved nearby role families |
| `skills` | `jsonb` | Structured skills list |
| `tools` | `jsonb` | Figma, Adobe, After Effects, etc. |
| `industries_preferred` | `jsonb` | Preferred sectors |
| `industries_avoid` | `jsonb` | Avoid list |
| `work_authorization_notes` | `text` | Visa/work eligibility notes |
| `portfolio_primary_url` | `text` | Default portfolio landing page |
| `linkedin_url` | `text` | Optional |
| `personal_site_url` | `text` | Optional |
| `bio_summary` | `text` | Concise professional summary |
| `experience_summary` | `jsonb` | Structured role history summary |
| `education_summary` | `jsonb` | Structured education data |
| `preferences_notes` | `text` | Manual nuance not captured elsewhere |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- belongs to one `users`
- referenced by `job_scores`, `resume_versions`, and `application_packets`

Phase 1 core:

- one freeform `search_brief` field as the lowest-friction way to start the preference model
- all profile and preference fields needed for ranking and generation

Later:

- more granular preference taxonomies
- relocation preferences
- multiple portfolio landing pages by audience

### 4.3 `portfolio_items`

Purpose: structured portfolio library used for recommendations.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users.id` |
| `title` | `text` | Case study or project title |
| `slug` | `text` | Optional stable identifier |
| `url` | `text` | Live case study or project link |
| `project_type` | `text` | Brand, campaign, product, motion, presentation |
| `role_label` | `text` | User's role on the project |
| `summary` | `text` | Short description |
| `skills_tags` | `jsonb` | Relevant skills and tools |
| `industry_tags` | `jsonb` | Industry alignment |
| `outcome_metrics` | `jsonb` | Optional impact proof points |
| `visual_strength_rating` | `integer` | Manual 1-5 confidence or quality signal |
| `is_primary` | `boolean` | Marks default showcase items |
| `is_active` | `boolean` | Hide or show in recommendations |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- belongs to one `users`
- referenced indirectly by `application_packets`

Phase 1 core:

- enough structure to recommend portfolio items per job

Later:

- image assets
- ordered galleries
- public/private visibility
- per-item narrative variants

### 4.4 `resume_master`

Purpose: canonical resume source used to generate tailored versions.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Unique FK to `users.id` |
| `base_title` | `text` | Default resume headline |
| `summary_text` | `text` | Canonical summary |
| `experience_entries` | `jsonb` | Structured work history |
| `achievement_bank` | `jsonb` | Reusable quantified bullets |
| `skills_section` | `jsonb` | Resume skill inventory |
| `education_entries` | `jsonb` | Structured education list |
| `certifications` | `jsonb` | Optional |
| `links` | `jsonb` | Portfolio, LinkedIn, website |
| `source_format` | `text` | Markdown, JSON, rich text |
| `source_content` | `jsonb` | Canonical storage format |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- belongs to one `users`
- source for many `resume_versions`

Phase 1 core:

- source content and structured entries needed for truthful tailoring

Later:

- style presets
- template metadata
- richer PDF layout configuration

### 4.5 `resume_versions`

Purpose: job-specific resume variants generated from the master resume.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users.id` |
| `resume_master_id` | `uuid` | FK to `resume_master.id` |
| `job_id` | `uuid` | FK to `jobs.id` |
| `application_packet_id` | `uuid` | Nullable FK to `application_packets.id` |
| `version_label` | `text` | Human-readable label |
| `summary_text` | `text` | Tailored summary |
| `experience_entries` | `jsonb` | Edited or prioritized entries |
| `skills_section` | `jsonb` | Curated skill subset |
| `highlighted_requirements` | `jsonb` | Requirements being addressed |
| `tailoring_notes` | `text` | Why this version differs |
| `export_status` | `text` | `draft`, `ready`, `exported` |
| `export_file_path` | `text` | Storage reference for generated PDF later |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- belongs to one `users`
- derived from one `resume_master`
- linked to one `jobs`
- optionally linked to one `application_packets`

Phase 1 core:

- stored tailored content and traceability to job + master resume

Later:

- diff history
- approval state
- multiple templates for the same job

### 4.6 `jobs`

Purpose: normalized job listing record after ingestion and deduplication.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `source_name` | `text` | Board, company site, aggregator |
| `source_job_id` | `text` | Native source identifier if available |
| `source_url` | `text` | Original listing URL |
| `application_url` | `text` | Apply destination |
| `company_name` | `text` | Normalized company name |
| `company_domain` | `text` | Optional normalized domain |
| `title` | `text` | Normalized role title |
| `department` | `text` | Design, creative, marketing, product |
| `employment_type` | `text` | Full-time, contract, freelance |
| `location_label` | `text` | Display location text |
| `remote_type` | `text` | `remote`, `hybrid`, `onsite`, `unknown` |
| `remote_regions` | `jsonb` | Allowed regions or countries |
| `salary_currency` | `text` | ISO currency code |
| `salary_min` | `integer` | Nullable |
| `salary_max` | `integer` | Nullable |
| `salary_period` | `text` | Annual, hourly, contract |
| `posted_at` | `timestamptz` | Listing publish date when known |
| `ingested_at` | `timestamptz` | First seen date |
| `description_text` | `text` | Full cleaned description |
| `requirements` | `jsonb` | Extracted required qualifications |
| `preferred_qualifications` | `jsonb` | Extracted preferred items |
| `skills_keywords` | `jsonb` | Parsed skill list |
| `seniority_label` | `text` | Normalized seniority |
| `portfolio_required` | `text` | `yes`, `no`, `unknown` |
| `work_auth_notes` | `text` | Sponsorship or location notes |
| `duplicate_group_key` | `text` | Shared key for duplicate clustering |
| `listing_status` | `text` | `active`, `stale`, `closed`, `unknown` |
| `red_flag_notes` | `jsonb` | Listing-level issues |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- one `jobs` -> many `job_scores`
- one `jobs` -> many `resume_versions`
- one `jobs` -> many `application_packets`
- one `jobs` -> many `application_events`

Phase 1 core:

- normalized listing fields required for ranking and packet generation

Later:

- richer company intelligence
- source snapshots
- scraping metadata
- multi-source lineage tables

### 4.7 `job_scores`

Purpose: per-user evaluation record for a normalized job.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users.id` |
| `job_id` | `uuid` | FK to `jobs.id` |
| `profile_id` | `uuid` | FK to `user_profiles.id` |
| `remote_gate_passed` | `boolean` | Hard filter result |
| `quality_score` | `numeric` | Weighted component |
| `salary_score` | `numeric` | Weighted component |
| `role_relevance_score` | `numeric` | Weighted component |
| `seniority_score` | `numeric` | Weighted component |
| `portfolio_fit_score` | `numeric` | Weighted component |
| `effort_score` | `numeric` | Weighted component |
| `penalty_score` | `numeric` | Negative adjustments |
| `total_score` | `numeric` | Final rank value |
| `recommendation_level` | `text` | `strong_apply`, `apply_if_interested`, `consider_carefully`, `skip` |
| `workflow_status` | `text` | `new`, `ranked`, `shortlisted`, `preparing`, `ready_to_apply`, `applied`, `follow_up_due`, `interview`, `rejected`, `archived` |
| `last_status_changed_at` | `timestamptz` | Latest user workflow update |
| `fit_summary` | `text` | Human-readable summary |
| `fit_reasons` | `jsonb` | Ranked explanation bullets |
| `missing_requirements` | `jsonb` | Gaps or stretch points |
| `red_flags` | `jsonb` | Score penalties and warnings |
| `scam_risk_level` | `text` | `low`, `medium`, `high` |
| `scored_at` | `timestamptz` | When score was computed |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- belongs to one `users`
- belongs to one `jobs`
- references one `user_profiles`

Phase 1 core:

- one current score per user-job pairing is enough
- store the current workflow state alongside the score for dashboard queries

Later:

- scoring version history
- model comparison
- offline evaluation labels

### 4.8 `application_packets`

Purpose: saved bundle of materials prepared for a specific job.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users.id` |
| `job_id` | `uuid` | FK to `jobs.id` |
| `job_score_id` | `uuid` | FK to `job_scores.id` |
| `resume_version_id` | `uuid` | Nullable FK to `resume_versions.id` |
| `packet_status` | `text` | `draft`, `ready`, `applied`, `archived` |
| `professional_summary` | `text` | Tailored intro text |
| `cover_letter_draft` | `text` | Generated draft |
| `portfolio_recommendation` | `jsonb` | Primary link + rationale |
| `case_study_selection` | `jsonb` | Suggested portfolio items and order |
| `application_checklist` | `jsonb` | Steps before submission |
| `manual_notes` | `text` | User notes |
| `generated_at` | `timestamptz` | Initial packet generation time |
| `last_reviewed_at` | `timestamptz` | User review timestamp |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- belongs to one `users`
- belongs to one `jobs`
- references one `job_scores`
- may reference one `resume_versions`
- one `application_packets` -> many `application_answers`
- one `application_packets` -> many `application_events`

Phase 1 core:

- all user-facing application prep artifacts

Later:

- multiple packet versions per job
- collaboration or review states
- export manifests

### 4.9 `application_answers`

Purpose: structured answer units for forms, short answers, and paste-ready fields.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `application_packet_id` | `uuid` | FK to `application_packets.id` |
| `job_id` | `uuid` | FK to `jobs.id` |
| `user_id` | `uuid` | FK to `users.id` |
| `question_key` | `text` | Stable internal label |
| `question_text` | `text` | Original or normalized question |
| `field_type` | `text` | Short answer, textarea, summary, portfolio field |
| `answer_text` | `text` | Primary answer |
| `answer_variant_short` | `text` | Optional shorter version |
| `character_limit` | `integer` | Nullable |
| `source_context` | `jsonb` | Prompt inputs or evidence references |
| `review_status` | `text` | `draft`, `edited`, `approved` |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- belongs to one `application_packets`
- belongs to one `jobs`
- belongs to one `users`

Phase 1 core:

- structured answers and variants for manual copy/paste

Later:

- answer reuse library
- performance tracking by answer type

### 4.10 `application_events`

Purpose: event log for pipeline and activity history.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users.id` |
| `job_id` | `uuid` | FK to `jobs.id` |
| `application_packet_id` | `uuid` | Nullable FK to `application_packets.id` |
| `event_type` | `text` | `status_changed`, `note_added`, `applied`, `follow_up_due` |
| `from_status` | `text` | Nullable |
| `to_status` | `text` | Nullable |
| `event_at` | `timestamptz` | Event timestamp |
| `event_payload` | `jsonb` | Additional structured metadata |
| `notes` | `text` | Optional user-entered notes |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- belongs to one `users`
- belongs to one `jobs`
- optionally belongs to one `application_packets`

Phase 1 core:

- status history and reminders

Later:

- interview schedules
- communication tracking
- integrations with calendars or email

### 4.11 `saved_searches`

Purpose: persist reusable search/filter setups for the job dashboard.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users.id` |
| `name` | `text` | User-facing label |
| `query_text` | `text` | Free-text search or filter summary |
| `target_roles` | `jsonb` | Specific roles for this search |
| `adjacent_roles` | `jsonb` | Optional expanded role families |
| `salary_floor_override` | `integer` | Optional search-specific override |
| `included_sources` | `jsonb` | Source allow-list |
| `excluded_companies` | `jsonb` | Company blocklist |
| `filters_json` | `jsonb` | Structured filter set |
| `is_default` | `boolean` | Default dashboard search |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- belongs to one `users`

Phase 1 core:

- reusable dashboard filters

Later:

- alert schedules
- source sync rules

### 4.12 `prompts`

Purpose: versioned prompt registry for parsing, scoring, and generation tasks.

Key fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `task_name` | `text` | `job_parse`, `job_score`, `resume_tailor`, etc. |
| `provider` | `text` | OpenAI, Anthropic, Google |
| `model_name` | `text` | Model used for the prompt |
| `prompt_version` | `text` | Semantic or dated version |
| `system_prompt` | `text` | System instruction text |
| `user_prompt_template` | `text` | Templated prompt body |
| `response_schema` | `jsonb` | Expected structured output |
| `is_active` | `boolean` | Active version flag |
| `notes` | `text` | Purpose or change notes |
| `created_at` | `timestamptz` | Audit |
| `updated_at` | `timestamptz` | Audit |

Relationships:

- referenced by jobs parsing, scoring, and packet generation workflows at runtime

Phase 1 core:

- enough prompt metadata to version and compare core AI tasks

Later:

- evaluation datasets
- prompt run logs
- provider fallback policies

## 5. Relationship Summary

- `users` 1 -> 1 `user_profiles`
- `users` 1 -> 1 `resume_master`
- `users` 1 -> many `portfolio_items`
- `users` 1 -> many `resume_versions`
- `jobs` 1 -> many `job_scores`
- `jobs` 1 -> many `application_packets`
- `application_packets` 1 -> many `application_answers`
- `jobs` and `application_packets` 1 -> many `application_events`

## 6. Phase 1 Notes

- `job_scores` should be recomputable, but the latest explanation and recommendation should be persisted for the dashboard.
- `application_packets` should store structured recommendation data rather than a single generated document blob.
- `resume_versions` should remain auditable against the source resume so tailoring stays truthful.
- The initial schema is intentionally biased toward strong contracts for ranking and packet generation before source expansion or automation.
