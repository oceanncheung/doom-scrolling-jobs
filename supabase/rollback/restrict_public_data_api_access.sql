-- Emergency rollback ONLY after separate action-time approval.
-- Restores the reviewed insecure baseline; prefer fixing server compatibility.
-- Freeze schema changes and verify the Oct 10 ACL snapshot before using this.
begin;
set local lock_timeout = '5s';
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'application_answers', 'application_events', 'application_packets',
    'company_watchlist', 'cover_letter_master', 'evidence_bank',
    'job_feedback_signals', 'job_scores', 'jobs', 'operators', 'portfolio_items',
    'prompts', 'raw_job_imports', 'resume_master', 'resume_versions',
    'saved_searches', 'source_registry', 'source_sync_diagnostics',
    'user_profiles', 'users', '_applied_migrations'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I disable row level security', table_name);
      execute format('grant all privileges on table public.%I to anon, authenticated', table_name);
    end if;
  end loop;
end $$;
grant usage on schema public to public, anon, authenticated;
grant execute on function public.set_updated_at() to public, anon, authenticated;
alter function public.set_updated_at() reset search_path;
commit;
