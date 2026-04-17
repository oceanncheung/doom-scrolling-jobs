-- Stores the full-text description fetched from a job's source_url, separate from the
-- feed-provided `description_text` column. Many job feeds (Remotive, Jobspresso, etc.)
-- return a summary stub — e.g. the Grüns listing shipped as just
-- "Senior Graphic Designer. Creates natural performance supplements. Design & UX. Senior."
-- which is nowhere near the richness of the actual posting page.
--
-- We fetch the canonical posting once at ingest time (via Jina Reader / similar) and
-- persist the result here. Downstream code prefers this when present, falls back to
-- `description_text` when it isn't (e.g. fetch failed, or older rows not yet backfilled).
--
-- Kept as a separate column rather than overwriting `description_text` so we can:
--   1. Tell which data came from the feed vs the fetch (diagnostics + debugging)
--   2. Roll forward without a destructive write to existing rows
--   3. Re-fetch periodically (description_fetched_at tracks freshness) without losing
--      the feed baseline
alter table public.jobs
  add column if not exists description_text_fetched text,
  add column if not exists description_fetched_at timestamptz,
  add column if not exists description_fetch_error text;
