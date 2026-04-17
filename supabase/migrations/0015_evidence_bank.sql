-- Phase A portfolio/web enrichment: a structured "evidence bank" populated by extraction
-- runs against the candidate's public portfolio, personal site, LinkedIn export, etc.
--
-- Rationale: resume_master and profile capture what the candidate explicitly wrote in their
-- source materials. But a designer's real industry reach often lives on their portfolio
-- (Curated Health, EVIIVE, etc.) and social presence (LinkedIn posts, pinned tweets) — work
-- the resume doesn't mention because it's too granular. Without this, the resume/cover-letter
-- generator is blind to highly relevant adjacent experience when a JD mentions a specific
-- industry or client type.
--
-- Entries are NEVER auto-used in generation. confirmed_at must be non-null before the
-- generator considers the entry. Extraction produces candidates; the user reviews and
-- confirms (Phase B, UI forthcoming). Matches ADR-006 "human-in-the-loop."
--
-- Separated from portfolio_items (user-curated structured projects) because these are:
--   - extracted, not hand-entered
--   - may span multiple source scrapes
--   - carry confidence scoring and provenance
--   - include types beyond "portfolio project" (client_work, side_gig, recognition, etc.)

-- Postgres doesn't support `create type if not exists`, so guard with a do-block.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'evidence_kind') then
    create type public.evidence_kind as enum (
      'project', 'client_work', 'side_gig', 'recognition', 'collaboration', 'press'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'evidence_confidence') then
    create type public.evidence_confidence as enum ('high', 'medium', 'low');
  end if;
  if not exists (select 1 from pg_type where typname = 'evidence_source_kind') then
    create type public.evidence_source_kind as enum (
      'portfolio_url', 'personal_site', 'linkedin_export', 'linkedin_page',
      'behance', 'dribbble', 'manual'
    );
  end if;
end$$;

create table if not exists public.evidence_bank (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators (id) on delete cascade,
  user_id uuid not null,

  -- Extraction output
  kind public.evidence_kind not null,
  client_name text,
  industry_tags jsonb not null default '[]'::jsonb,
  scope jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  summary text not null,
  proof_points jsonb not null default '[]'::jsonb,
  confidence public.evidence_confidence not null default 'medium',

  -- Provenance (required — every entry must trace to a source)
  source_kind public.evidence_source_kind not null,
  source_url text,
  source_snapshot_excerpt text,
  source_fetched_at timestamptz,

  -- Linkage to experience (optional — when the evidence clearly belongs under an existing
  -- role entry in resume_master.experience_entries, we record the source key here so the
  -- generator can attach the evidence to that role's bullets rather than surfacing it as
  -- a standalone entry)
  linked_experience_source_key text,

  -- User-confirmation gate. Never used in generation until confirmed_at is set.
  confirmed_at timestamptz,
  discarded_at timestamptz,
  confirmation_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evidence_bank_operator_id_idx on public.evidence_bank (operator_id);
create index if not exists evidence_bank_confirmed_idx on public.evidence_bank (operator_id, confirmed_at)
  where confirmed_at is not null and discarded_at is null;
create index if not exists evidence_bank_source_kind_idx on public.evidence_bank (operator_id, source_kind);

comment on table public.evidence_bank is
  'Phase A portfolio/web enrichment — extracted claims about a candidate''s projects / industry reach / client work. Never consumed by the resume generator until confirmed_at is non-null. See lib/ai/tasks/extract-evidence.ts for extraction and lib/data/evidence-bank.ts for CRUD.';
