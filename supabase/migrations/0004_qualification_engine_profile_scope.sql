alter table public.user_profiles
  add column if not exists primary_market text not null default '',
  add column if not exists secondary_markets jsonb not null default '[]'::jsonb,
  add column if not exists allowed_remote_regions jsonb not null default '[]'::jsonb,
  add column if not exists timezone_tolerance_hours integer,
  add column if not exists relocation_open boolean not null default false;
