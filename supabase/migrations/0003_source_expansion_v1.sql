create type public.job_source_kind as enum (
  'remote_board',
  'company_career_page',
  'ats_hosted_job_page'
);

create table public.source_registry (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  source_kind public.job_source_kind not null,
  provider text not null,
  base_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.company_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_registry_id uuid not null references public.source_registry(id) on delete cascade,
  company_name text not null,
  company_slug text not null,
  source_key text not null unique,
  source_name text not null,
  career_page_url text not null,
  ats_board_token text,
  priority integer not null default 100,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.source_sync_diagnostics (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_name text not null,
  source_kind public.job_source_kind not null,
  provider text not null,
  rows_seen integer not null default 0,
  rows_candidate integer not null default 0,
  rows_excluded integer not null default 0,
  rows_deduped integer not null default 0,
  rows_imported integer not null default 0,
  rows_stale integer not null default 0,
  issue text,
  sync_metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index source_registry_kind_idx on public.source_registry (source_kind);
create index company_watchlist_user_priority_idx on public.company_watchlist (user_id, priority asc);
create index company_watchlist_registry_idx on public.company_watchlist (source_registry_id);
create index source_sync_diagnostics_synced_at_idx on public.source_sync_diagnostics (synced_at desc);

create trigger source_registry_set_updated_at
before update on public.source_registry
for each row execute function public.set_updated_at();

create trigger company_watchlist_set_updated_at
before update on public.company_watchlist
for each row execute function public.set_updated_at();

create trigger source_sync_diagnostics_set_updated_at
before update on public.source_sync_diagnostics
for each row execute function public.set_updated_at();
