alter table public.user_profiles
  add column if not exists search_brief text not null default '';
