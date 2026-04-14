alter table public.user_profiles
  add column if not exists matching_preferences jsonb not null default
    '{"roleBreadth":"balanced","marketStrictness":"balanced","sourceMix":"balanced"}'::jsonb;
