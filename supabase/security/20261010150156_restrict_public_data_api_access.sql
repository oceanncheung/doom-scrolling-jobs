-- PROPOSED ONLY: live execution requires action-time approval.
-- Phase 1 uses server-side service_role Data API requests, not Supabase Auth.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  required_tables text[] := array[
    'application_answers', 'application_events', 'application_packets',
    'company_watchlist', 'cover_letter_master', 'evidence_bank',
    'job_feedback_signals', 'job_scores', 'jobs', 'operators', 'portfolio_items',
    'prompts', 'raw_job_imports', 'resume_master', 'resume_versions',
    'saved_searches', 'source_registry', 'source_sync_diagnostics',
    'user_profiles', 'users'
  ];
  actual_tables text[];
  table_name text;
begin
  select array_agg(c.relname::text order by c.relname) into actual_tables
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p');
  -- The live-only legacy tracker is optional on a clean local database.
  if not (actual_tables @> required_tables and
          actual_tables <@ (required_tables || array['_applied_migrations'])) then
    raise exception 'Public table inventory differs from reviewed scope';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public') or
     exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and
             (c.relkind in ('v', 'm', 'S', 'f') or c.relrowsecurity or c.relforcerowsecurity)) then
    raise exception 'Public security/object state differs from reviewed snapshot';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public') <> 1 or
     not exists (select 1 from pg_proc where oid = 'public.set_updated_at()'::regprocedure
                 and not prosecdef and prorettype = 'trigger'::regtype and proconfig is null) then
    raise exception 'Public function inventory differs from reviewed snapshot';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role' and rolbypassrls) or
     not has_schema_privilege('service_role', 'public', 'USAGE') then
    raise exception 'Server role cannot preserve Data API access';
  end if;
  foreach table_name in array actual_tables loop
    if not (has_table_privilege('service_role', format('public.%I', table_name), 'SELECT') and
            has_table_privilege('service_role', format('public.%I', table_name), 'INSERT') and
            has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE') and
            has_table_privilege('service_role', format('public.%I', table_name), 'DELETE')) then
      raise exception 'Server CRUD privileges missing for %', table_name;
    end if;
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- No client policies: internal IDs are not auth.users IDs. Deny client access.
-- Schema USAGE closes inherited PUBLIC access and future-object default grants,
-- including objects created by supabase_admin. Retain all server grants/defaults.
revoke usage on schema public from public, anon, authenticated;
revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on function public.set_updated_at() from public, anon, authenticated;
alter function public.set_updated_at() set search_path = '';

do $$
begin
  if has_schema_privilege('anon', 'public', 'USAGE') or
     has_schema_privilege('authenticated', 'public', 'USAGE') or
     not has_schema_privilege('service_role', 'public', 'USAGE') or
     not has_function_privilege('service_role', 'public.set_updated_at()', 'EXECUTE') then
    raise exception 'Effective role privileges violate server-only boundary';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p(privilege)
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not has_table_privilege('service_role', c.oid, p.privilege)
  ) then
    raise exception 'Server CRUD privileges changed during restriction';
  end if;
end $$;

commit;
