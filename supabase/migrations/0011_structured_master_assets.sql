alter table public.user_profiles
  add column if not exists phone_number text not null default '',
  add column if not exists languages jsonb not null default '[]'::jsonb,
  add column if not exists canonical_profile_reviewed_at timestamptz;

alter table public.resume_master
  add column if not exists contact_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists selected_impact_highlights jsonb not null default '[]'::jsonb,
  add column if not exists core_expertise jsonb not null default '[]'::jsonb,
  add column if not exists archived_experience_entries jsonb not null default '[]'::jsonb,
  add column if not exists languages jsonb not null default '[]'::jsonb,
  add column if not exists tools_platforms jsonb not null default '[]'::jsonb,
  add column if not exists additional_information jsonb not null default '[]'::jsonb,
  add column if not exists raw_source_text text,
  add column if not exists rendered_markdown text,
  add column if not exists section_provenance jsonb not null default '{}'::jsonb,
  add column if not exists generation_issues jsonb not null default '[]'::jsonb,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approved_at timestamptz;

update public.resume_master
set contact_snapshot = jsonb_strip_nulls(
  jsonb_build_object(
    'email', users.email,
    'linkedinUrl', nullif(user_profiles.linkedin_url, ''),
    'location', nullif(user_profiles.location_label, ''),
    'name', nullif(users.display_name, ''),
    'phone', nullif(user_profiles.phone_number, ''),
    'portfolioUrl', nullif(coalesce(user_profiles.portfolio_primary_url, user_profiles.personal_site_url), ''),
    'websiteUrl', nullif(user_profiles.personal_site_url, '')
  )
)
from public.users
join public.user_profiles on user_profiles.user_id = users.id
where public.resume_master.user_id = users.id
  and public.resume_master.contact_snapshot = '{}'::jsonb;

update public.resume_master
set selected_impact_highlights = coalesce(
  (
    select jsonb_agg(highlight.value)
    from (
      select coalesce(nullif(trim(item->>'detail'), ''), nullif(trim(item->>'title'), '')) as value
      from jsonb_array_elements(public.resume_master.achievement_bank) item
    ) highlight
    where highlight.value is not null
  ),
  '[]'::jsonb
)
where public.resume_master.selected_impact_highlights = '[]'::jsonb;

update public.resume_master
set core_expertise = skills_section
where public.resume_master.core_expertise = '[]'::jsonb
  and public.resume_master.skills_section <> '[]'::jsonb;

update public.resume_master
set tools_platforms = skills_section
where public.resume_master.tools_platforms = '[]'::jsonb
  and public.resume_master.skills_section <> '[]'::jsonb;

update public.resume_master
set languages = user_profiles.languages
from public.user_profiles
where public.resume_master.user_id = user_profiles.user_id
  and public.resume_master.languages = '[]'::jsonb
  and user_profiles.languages <> '[]'::jsonb;

update public.resume_master
set raw_source_text = coalesce(
  nullif(public.resume_master.raw_source_text, ''),
  nullif(public.resume_master.source_content->>'resumeDocumentText', ''),
  nullif(public.resume_master.summary_text, '')
)
where public.resume_master.raw_source_text is null;

create table if not exists public.cover_letter_master (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  operator_id uuid not null unique references public.operators(id) on delete cascade,
  contact_snapshot jsonb not null default '{}'::jsonb,
  target_roles jsonb not null default '[]'::jsonb,
  positioning_philosophy text,
  proof_bank jsonb not null default '[]'::jsonb,
  capability_disciplines jsonb not null default '[]'::jsonb,
  capability_tools jsonb not null default '[]'::jsonb,
  tone_voice jsonb not null default '[]'::jsonb,
  key_differentiators jsonb not null default '[]'::jsonb,
  selection_rules jsonb not null default '[]'::jsonb,
  output_constraints jsonb not null default '[]'::jsonb,
  raw_source_text text,
  rendered_markdown text,
  source_format text not null default 'structured_json',
  source_content jsonb not null default '{}'::jsonb,
  section_provenance jsonb not null default '{}'::jsonb,
  generation_issues jsonb not null default '[]'::jsonb,
  approval_status text not null default 'draft',
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger cover_letter_master_set_updated_at
before update on public.cover_letter_master
for each row execute function public.set_updated_at();

create index if not exists cover_letter_master_operator_id_idx
  on public.cover_letter_master (operator_id);

insert into public.cover_letter_master (
  user_id,
  operator_id,
  contact_snapshot,
  target_roles,
  positioning_philosophy,
  raw_source_text,
  rendered_markdown,
  source_format,
  source_content,
  approval_status,
  approved_at
)
select
  resume_master.user_id,
  resume_master.operator_id,
  jsonb_strip_nulls(
    jsonb_build_object(
      'location', nullif(user_profiles.location_label, ''),
      'name', nullif(users.display_name, ''),
      'roleTargets', user_profiles.target_roles
    )
  ),
  coalesce(user_profiles.target_roles, '[]'::jsonb),
  nullif(resume_master.base_cover_letter_text, ''),
  nullif(resume_master.base_cover_letter_text, ''),
  nullif(resume_master.base_cover_letter_text, ''),
  'legacy_backfill',
  jsonb_build_object(
    'migratedFrom', 'resume_master.base_cover_letter_text'
  ),
  case
    when coalesce(nullif(resume_master.base_cover_letter_text, ''), '') <> '' then 'approved'
    else 'draft'
  end,
  case
    when coalesce(nullif(resume_master.base_cover_letter_text, ''), '') <> '' then timezone('utc', now())
    else null
  end
from public.resume_master
join public.users on users.id = resume_master.user_id
join public.user_profiles on user_profiles.user_id = resume_master.user_id
left join public.cover_letter_master on cover_letter_master.user_id = resume_master.user_id
where cover_letter_master.id is null;
