insert into public.users (
  id,
  email,
  display_name,
  auth_provider,
  account_status,
  is_internal
)
values (
  '11111111-1111-4111-8111-111111111111',
  'internal@doomscrollingjobs.local',
  'Internal Operator',
  'internal',
  'active',
  true
)
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  auth_provider = excluded.auth_provider,
  account_status = excluded.account_status,
  is_internal = excluded.is_internal;

insert into public.user_profiles (
  id,
  user_id,
  headline,
  location_label,
  timezone,
  remote_required,
  target_roles,
  allowed_adjacent_roles,
  skills,
  tools,
  bio_summary,
  preferences_notes
)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Graphic Designer',
  'Toronto, Canada',
  'America/Toronto',
  true,
  '["graphic designer","brand designer","visual designer","marketing designer","presentation designer"]'::jsonb,
  '["product designer","motion designer","art director","creative lead","creative director","content designer","campaign designer","ui designer"]'::jsonb,
  '["visual systems","brand identity","presentation design","campaign design"]'::jsonb,
  '["Figma","Adobe Creative Suite","Photoshop","Illustrator"]'::jsonb,
  'Single internal operator profile used to rank remote design opportunities and prepare high-quality manual applications.',
  'Internal single-user mode for Ocean / Alvis. Replace these defaults as the real operator profile is filled in.'
)
on conflict (id) do update
set
  headline = excluded.headline,
  location_label = excluded.location_label,
  timezone = excluded.timezone,
  remote_required = excluded.remote_required,
  target_roles = excluded.target_roles,
  allowed_adjacent_roles = excluded.allowed_adjacent_roles,
  skills = excluded.skills,
  tools = excluded.tools,
  bio_summary = excluded.bio_summary,
  preferences_notes = excluded.preferences_notes;

insert into public.resume_master (
  id,
  user_id,
  base_title,
  summary_text,
  experience_entries,
  achievement_bank,
  skills_section,
  education_entries,
  certifications,
  links,
  source_format,
  source_content
)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Graphic Designer',
  'Seeded canonical resume record for the internal operator profile.',
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  'json',
  '{"seeded": true}'::jsonb
)
on conflict (id) do update
set
  base_title = excluded.base_title,
  summary_text = excluded.summary_text,
  source_format = excluded.source_format,
  source_content = excluded.source_content;
