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
  industries_preferred,
  industries_avoid,
  skills,
  tools,
  work_authorization_notes,
  portfolio_primary_url,
  bio_summary,
  experience_summary,
  education_summary,
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
  '["technology","education","media"]'::jsonb,
  '["gambling","crypto scams"]'::jsonb,
  '["visual systems","brand identity","presentation design","campaign design"]'::jsonb,
  '["Figma","Adobe Creative Suite","Photoshop","Illustrator"]'::jsonb,
  'Authorized to work remotely for roles open to Canada-based candidates.',
  'https://portfolio.example.com',
  'Single internal operator profile used to rank remote design opportunities and prepare high-quality manual applications.',
  '[
    {
      "companyName": "Northshore Studio",
      "roleTitle": "Senior Graphic Designer",
      "locationLabel": "Toronto, Canada",
      "startDate": "2022-01",
      "endDate": "",
      "summary": "Own brand design systems, launch campaigns, and executive presentation work across marketing and product initiatives.",
      "highlights": [
        "Built a reusable campaign design system adopted across multiple product launches.",
        "Led high-visibility deck design for executive and investor presentations."
      ]
    },
    {
      "companyName": "Signal Works",
      "roleTitle": "Visual Designer",
      "locationLabel": "Remote",
      "startDate": "2019-04",
      "endDate": "2021-12",
      "summary": "Delivered visual identity, landing pages, and growth creative for a distributed SaaS team.",
      "highlights": [
        "Created campaign assets that improved paid social click-through performance.",
        "Partnered with product marketing to turn strategy into launch-ready visuals."
      ]
    }
  ]'::jsonb,
  '[
    {
      "schoolName": "OCAD University",
      "credential": "Bachelor of Design",
      "fieldOfStudy": "Graphic Design",
      "startDate": "2014",
      "endDate": "2018",
      "notes": "Focused on visual communication and brand systems."
    }
  ]'::jsonb,
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
  industries_preferred = excluded.industries_preferred,
  industries_avoid = excluded.industries_avoid,
  skills = excluded.skills,
  tools = excluded.tools,
  work_authorization_notes = excluded.work_authorization_notes,
  portfolio_primary_url = excluded.portfolio_primary_url,
  bio_summary = excluded.bio_summary,
  experience_summary = excluded.experience_summary,
  education_summary = excluded.education_summary,
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
  'Designer focused on brand systems, presentation design, and campaign work for high-quality remote teams.',
  '[
    {
      "companyName": "Northshore Studio",
      "roleTitle": "Senior Graphic Designer",
      "locationLabel": "Toronto, Canada",
      "startDate": "2022-01",
      "endDate": "",
      "summary": "Own brand design systems, launch campaigns, and executive presentation work across marketing and product initiatives.",
      "highlights": [
        "Built a reusable campaign design system adopted across multiple product launches.",
        "Led high-visibility deck design for executive and investor presentations."
      ]
    },
    {
      "companyName": "Signal Works",
      "roleTitle": "Visual Designer",
      "locationLabel": "Remote",
      "startDate": "2019-04",
      "endDate": "2021-12",
      "summary": "Delivered visual identity, landing pages, and growth creative for a distributed SaaS team.",
      "highlights": [
        "Created campaign assets that improved paid social click-through performance.",
        "Partnered with product marketing to turn strategy into launch-ready visuals."
      ]
    }
  ]'::jsonb,
  '[
    {
      "category": "brand",
      "title": "Scaled brand systems",
      "detail": "Created reusable visual systems that improved consistency across campaigns and presentations."
    },
    {
      "category": "collaboration",
      "title": "Cross-functional execution",
      "detail": "Worked closely with marketing, product, and leadership teams to ship polished launch assets."
    }
  ]'::jsonb,
  '["branding","campaign design","presentation design","visual storytelling"]'::jsonb,
  '[
    {
      "schoolName": "OCAD University",
      "credential": "Bachelor of Design",
      "fieldOfStudy": "Graphic Design",
      "startDate": "2014",
      "endDate": "2018",
      "notes": "Focused on visual communication and brand systems."
    }
  ]'::jsonb,
  '[]'::jsonb,
  '{"portfolio":"https://portfolio.example.com"}'::jsonb,
  'structured_json',
  '{
    "updatedFrom": "seed",
    "experienceCount": 2,
    "achievementCount": 2,
    "educationCount": 1
  }'::jsonb
)
on conflict (id) do update
set
  base_title = excluded.base_title,
  summary_text = excluded.summary_text,
  experience_entries = excluded.experience_entries,
  achievement_bank = excluded.achievement_bank,
  skills_section = excluded.skills_section,
  education_entries = excluded.education_entries,
  certifications = excluded.certifications,
  links = excluded.links,
  source_format = excluded.source_format,
  source_content = excluded.source_content;

insert into public.portfolio_items (
  id,
  user_id,
  title,
  slug,
  url,
  project_type,
  role_label,
  summary,
  skills_tags,
  industry_tags,
  outcome_metrics,
  visual_strength_rating,
  is_primary,
  is_active
)
values
(
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  'Brand System Refresh',
  'brand-system-refresh',
  'https://portfolio.example.com/brand-system-refresh',
  'brand design',
  'Lead designer',
  'Rebuilt the visual system for a growing software brand across web, lifecycle, and sales touchpoints.',
  '["brand identity","visual systems","marketing design"]'::jsonb,
  '["saas","technology"]'::jsonb,
  '["Unified launch visuals across five channels","Improved internal design reuse"]'::jsonb,
  5,
  true,
  true
),
(
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'Executive Launch Deck',
  'executive-launch-deck',
  'https://portfolio.example.com/executive-launch-deck',
  'presentation design',
  'Presentation designer',
  'Designed a narrative deck for leadership, sales, and investor-facing product launch communication.',
  '["presentation design","storytelling","information hierarchy"]'::jsonb,
  '["technology","b2b"]'::jsonb,
  '["Reduced ad hoc slide redesign work","Created reusable story modules for leadership"]'::jsonb,
  4,
  false,
  true
)
on conflict (id) do update
set
  title = excluded.title,
  slug = excluded.slug,
  url = excluded.url,
  project_type = excluded.project_type,
  role_label = excluded.role_label,
  summary = excluded.summary,
  skills_tags = excluded.skills_tags,
  industry_tags = excluded.industry_tags,
  outcome_metrics = excluded.outcome_metrics,
  visual_strength_rating = excluded.visual_strength_rating,
  is_primary = excluded.is_primary,
  is_active = excluded.is_active;
