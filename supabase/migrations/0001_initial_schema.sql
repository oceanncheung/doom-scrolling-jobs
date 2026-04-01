create extension if not exists pgcrypto;

create type public.account_status as enum ('active', 'paused', 'disabled');
create type public.remote_type as enum ('remote', 'hybrid', 'onsite', 'unknown');
create type public.employment_type as enum (
  'full_time',
  'contract',
  'freelance',
  'part_time',
  'internship',
  'temporary',
  'unknown'
);
create type public.portfolio_requirement as enum ('yes', 'no', 'unknown');
create type public.listing_status as enum ('active', 'stale', 'closed', 'unknown');
create type public.recommendation_level as enum (
  'strong_apply',
  'apply_if_interested',
  'consider_carefully',
  'skip'
);
create type public.workflow_status as enum (
  'new',
  'ranked',
  'shortlisted',
  'preparing',
  'ready_to_apply',
  'applied',
  'follow_up_due',
  'interview',
  'rejected',
  'archived'
);
create type public.scam_risk_level as enum ('low', 'medium', 'high');
create type public.packet_status as enum ('draft', 'ready', 'applied', 'archived');
create type public.answer_review_status as enum ('draft', 'edited', 'approved');
create type public.application_event_type as enum (
  'status_changed',
  'note_added',
  'applied',
  'follow_up_due'
);
create type public.resume_export_status as enum ('draft', 'ready', 'exported');
create type public.compensation_period as enum (
  'annual',
  'monthly',
  'weekly',
  'daily',
  'hourly',
  'contract',
  'unknown'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  auth_provider text not null default 'internal',
  account_status public.account_status not null default 'active',
  is_internal boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  headline text not null default '',
  location_label text not null default '',
  timezone text not null default 'America/Toronto',
  remote_required boolean not null default true,
  salary_floor_currency text not null default 'USD',
  salary_floor_amount integer,
  salary_target_min integer,
  salary_target_max integer,
  seniority_level text,
  target_roles jsonb not null default '[]'::jsonb,
  allowed_adjacent_roles jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  industries_preferred jsonb not null default '[]'::jsonb,
  industries_avoid jsonb not null default '[]'::jsonb,
  work_authorization_notes text,
  portfolio_primary_url text,
  linkedin_url text,
  personal_site_url text,
  bio_summary text,
  experience_summary jsonb not null default '[]'::jsonb,
  education_summary jsonb not null default '[]'::jsonb,
  preferences_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  slug text,
  url text not null,
  project_type text not null,
  role_label text not null,
  summary text,
  skills_tags jsonb not null default '[]'::jsonb,
  industry_tags jsonb not null default '[]'::jsonb,
  outcome_metrics jsonb not null default '[]'::jsonb,
  visual_strength_rating integer check (
    visual_strength_rating is null
    or visual_strength_rating between 1 and 5
  ),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.resume_master (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  base_title text not null default '',
  summary_text text,
  experience_entries jsonb not null default '[]'::jsonb,
  achievement_bank jsonb not null default '[]'::jsonb,
  skills_section jsonb not null default '[]'::jsonb,
  education_entries jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  links jsonb not null default '{}'::jsonb,
  source_format text not null default 'json',
  source_content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_job_id text,
  source_url text not null,
  application_url text,
  company_name text not null,
  company_domain text,
  title text not null,
  department text,
  employment_type public.employment_type not null default 'unknown',
  location_label text,
  remote_type public.remote_type not null default 'unknown',
  remote_regions jsonb not null default '[]'::jsonb,
  salary_currency text,
  salary_min integer,
  salary_max integer,
  salary_period public.compensation_period not null default 'unknown',
  posted_at timestamptz,
  ingested_at timestamptz not null default timezone('utc', now()),
  description_text text,
  requirements jsonb not null default '[]'::jsonb,
  preferred_qualifications jsonb not null default '[]'::jsonb,
  skills_keywords jsonb not null default '[]'::jsonb,
  seniority_label text,
  portfolio_required public.portfolio_requirement not null default 'unknown',
  work_auth_notes text,
  duplicate_group_key text,
  listing_status public.listing_status not null default 'active',
  red_flag_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.job_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  remote_gate_passed boolean not null default false,
  quality_score numeric(5,2) not null default 0,
  salary_score numeric(5,2) not null default 0,
  role_relevance_score numeric(5,2) not null default 0,
  seniority_score numeric(5,2) not null default 0,
  portfolio_fit_score numeric(5,2) not null default 0,
  effort_score numeric(5,2) not null default 0,
  penalty_score numeric(5,2) not null default 0,
  total_score numeric(6,2) not null default 0,
  recommendation_level public.recommendation_level not null default 'skip',
  workflow_status public.workflow_status not null default 'new',
  last_status_changed_at timestamptz,
  fit_summary text,
  fit_reasons jsonb not null default '[]'::jsonb,
  missing_requirements jsonb not null default '[]'::jsonb,
  red_flags jsonb not null default '[]'::jsonb,
  scam_risk_level public.scam_risk_level not null default 'low',
  scored_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, job_id)
);

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  resume_master_id uuid not null references public.resume_master(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  application_packet_id uuid,
  version_label text not null,
  summary_text text,
  experience_entries jsonb not null default '[]'::jsonb,
  skills_section jsonb not null default '[]'::jsonb,
  highlighted_requirements jsonb not null default '[]'::jsonb,
  tailoring_notes text,
  export_status public.resume_export_status not null default 'draft',
  export_file_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.application_packets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_score_id uuid not null references public.job_scores(id) on delete cascade,
  resume_version_id uuid references public.resume_versions(id) on delete set null,
  packet_status public.packet_status not null default 'draft',
  professional_summary text,
  cover_letter_draft text,
  portfolio_recommendation jsonb not null default '{}'::jsonb,
  case_study_selection jsonb not null default '[]'::jsonb,
  application_checklist jsonb not null default '[]'::jsonb,
  manual_notes text,
  generated_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.resume_versions
  add constraint resume_versions_application_packet_id_fkey
  foreign key (application_packet_id)
  references public.application_packets(id)
  on delete set null;

create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_packet_id uuid not null references public.application_packets(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  question_key text not null,
  question_text text not null,
  field_type text not null,
  answer_text text,
  answer_variant_short text,
  character_limit integer,
  source_context jsonb not null default '{}'::jsonb,
  review_status public.answer_review_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  application_packet_id uuid references public.application_packets(id) on delete set null,
  event_type public.application_event_type not null,
  from_status public.workflow_status,
  to_status public.workflow_status,
  event_at timestamptz not null default timezone('utc', now()),
  event_payload jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  query_text text,
  target_roles jsonb not null default '[]'::jsonb,
  adjacent_roles jsonb not null default '[]'::jsonb,
  salary_floor_override integer,
  included_sources jsonb not null default '[]'::jsonb,
  excluded_companies jsonb not null default '[]'::jsonb,
  filters_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  task_name text not null,
  provider text not null,
  model_name text not null,
  prompt_version text not null,
  system_prompt text,
  user_prompt_template text not null,
  response_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (task_name, provider, model_name, prompt_version)
);

create index jobs_remote_type_idx on public.jobs (remote_type);
create index jobs_listing_status_idx on public.jobs (listing_status);
create index jobs_posted_at_idx on public.jobs (posted_at desc);
create index jobs_duplicate_group_key_idx on public.jobs (duplicate_group_key);
create index jobs_company_title_idx on public.jobs (company_name, title);
create unique index jobs_source_identity_idx
  on public.jobs (source_name, source_job_id)
  where source_job_id is not null;

create index portfolio_items_user_id_idx on public.portfolio_items (user_id);
create index resume_versions_user_id_idx on public.resume_versions (user_id);
create index resume_versions_job_id_idx on public.resume_versions (job_id);
create index application_packets_user_id_idx on public.application_packets (user_id);
create index application_packets_job_id_idx on public.application_packets (job_id);
create index application_answers_packet_id_idx on public.application_answers (application_packet_id);
create index application_events_user_id_event_at_idx on public.application_events (user_id, event_at desc);
create index saved_searches_user_id_idx on public.saved_searches (user_id);
create index job_scores_user_rank_idx on public.job_scores (user_id, workflow_status, total_score desc);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger portfolio_items_set_updated_at
before update on public.portfolio_items
for each row execute function public.set_updated_at();

create trigger resume_master_set_updated_at
before update on public.resume_master
for each row execute function public.set_updated_at();

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger job_scores_set_updated_at
before update on public.job_scores
for each row execute function public.set_updated_at();

create trigger resume_versions_set_updated_at
before update on public.resume_versions
for each row execute function public.set_updated_at();

create trigger application_packets_set_updated_at
before update on public.application_packets
for each row execute function public.set_updated_at();

create trigger application_answers_set_updated_at
before update on public.application_answers
for each row execute function public.set_updated_at();

create trigger application_events_set_updated_at
before update on public.application_events
for each row execute function public.set_updated_at();

create trigger saved_searches_set_updated_at
before update on public.saved_searches
for each row execute function public.set_updated_at();

create trigger prompts_set_updated_at
before update on public.prompts
for each row execute function public.set_updated_at();
