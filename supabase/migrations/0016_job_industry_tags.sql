-- Phase C: industry classification on jobs. Populated once per job after the full
-- description is fetched (see 0014_job_description_fetched.sql). Lets Phase D match the
-- candidate's confirmed evidence_bank entries against a structured JD signal rather than
-- trying to infer industry from the title alone.
--
-- Shape:
--   primary_industry: single string — the most likely industry tag (e.g. "supplements")
--   adjacent_industries: jsonb string[] — related industries that would still qualify
--     work in an evidence entry as relevant (e.g. ["wellness", "CPG", "DTC"])
--   industry_evidence: jsonb string[] — short quotes from the JD text that support the
--     classification, so the result is auditable rather than opaque
--   classified_at: when the classification was run (null = not yet classified)

alter table public.jobs
  add column if not exists primary_industry text,
  add column if not exists adjacent_industries jsonb not null default '[]'::jsonb,
  add column if not exists industry_evidence jsonb not null default '[]'::jsonb,
  add column if not exists industry_classified_at timestamptz;
