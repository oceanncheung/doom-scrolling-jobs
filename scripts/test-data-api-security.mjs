// Synthetic PostgreSQL only. Never loads .env or connects to Supabase.
// See docs/security-data-api.md for the isolated, pinned test dependency.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const dependency = process.argv[2]
if (!dependency) throw new Error('Pass the absolute path to the PGlite dist/index.js module')
const { PGlite } = await import(pathToFileURL(dependency).href)
const migration = await readFile(new URL('../supabase/security/20261010150156_restrict_public_data_api_access.sql', import.meta.url), 'utf8')
const rollback = await readFile(new URL('../supabase/rollback/restrict_public_data_api_access.sql', import.meta.url), 'utf8')
const tables = [
  'application_answers', 'application_events', 'application_packets',
  'company_watchlist', 'cover_letter_master', 'evidence_bank',
  'job_feedback_signals', 'job_scores', 'jobs', 'operators', 'portfolio_items',
  'prompts', 'raw_job_imports', 'resume_master', 'resume_versions',
  'saved_searches', 'source_registry', 'source_sync_diagnostics',
  'user_profiles', 'users', '_applied_migrations',
]
const db = new PGlite()
async function asRole(role, sql) {
  await db.exec(`set role ${role}`)
  try { return await db.query(sql) } finally { await db.exec('reset role') }
}
async function denied(role, sql) {
  await assert.rejects(asRole(role, sql), (error) => error.code === '42501')
}
async function snapshot() {
  const tables = (await db.query(`
    select c.relname, array(select a::text from unnest(c.relacl) a order by a::text) as relacl,
           c.relrowsecurity, c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' order by c.relname
  `)).rows
  const schema = (await db.query(`select array(select a::text from unnest(nspacl) a
    order by a::text) as acl from pg_namespace where nspname='public'`)).rows
  const functions = (await db.query(`select proname, proconfig,
    array(select a::text from unnest(proacl) a order by a::text) as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' order by proname`)).rows
  const defaults = (await db.query(`select defaclrole, defaclnamespace, defaclobjtype,
    array(select a::text from unnest(defaclacl) a order by a::text) as acl
    from pg_default_acl order by defaclrole, defaclnamespace, defaclobjtype`)).rows
  return { tables, schema, functions, defaults }
}
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create role supabase_admin;
    grant usage on schema public to public, anon, authenticated, service_role;
    alter default privileges for role postgres in schema public
      grant all privileges on tables to anon, authenticated, service_role;
    alter default privileges for role supabase_admin in schema public
      grant all privileges on tables to anon, authenticated, service_role;
    create function public.set_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at = timezone('utc', now()); return new; end; $$;
    grant execute on function public.set_updated_at() to anon, authenticated, service_role;
  `)
  for (const table of tables) {
    await db.exec(`
      create table public.${table} (id integer primary key, value text, updated_at timestamptz);
      create trigger set_updated_at before update on public.${table}
        for each row execute function public.set_updated_at();
      insert into public.${table} values (1, 'synthetic fixture', now());
    `)
  }
  const baseline = await snapshot()
  // Fail closed when a required service privilege is absent; no partial RLS change.
  await db.exec('revoke delete on public.users from service_role')
  await assert.rejects(db.exec(migration), /Server CRUD privileges missing/)
  await db.exec('rollback; grant delete on public.users to service_role')
  assert.deepEqual(await snapshot(), baseline)
  // Fail closed on unreviewed tables too.
  await db.exec('create table public.unreviewed (id integer)')
  await assert.rejects(db.exec(migration), /inventory differs/)
  await db.exec('rollback; drop table public.unreviewed')
  assert.deepEqual(await snapshot(), baseline)
  await db.exec(migration)
  for (const table of tables) {
    for (const role of ['anon', 'authenticated']) {
      for (const sql of [
        `select * from public.${table}`,
        `insert into public.${table} (id, value) values (2, 'denied')`,
        `update public.${table} set value='denied' where id=1`,
        `delete from public.${table} where id=1`,
      ]) await denied(role, sql)
    }
    const state = (await db.query(`select relrowsecurity, relforcerowsecurity
      from pg_class where oid='public.${table}'::regclass`)).rows[0]
    assert.deepEqual(state, { relrowsecurity: true, relforcerowsecurity: false })
    assert.equal((await asRole('service_role', `select * from public.${table}`)).rows.length, 1)
    await asRole('service_role', `insert into public.${table} (id, value) values (2, 'server')`)
    await asRole('service_role', `update public.${table} set value='server update' where id=2`)
    await asRole('service_role', `delete from public.${table} where id=2`)
  }
  assert.equal((await db.query('select * from pg_policies where schemaname=\'public\'')).rows.length, 0)
  assert.deepEqual((await db.query(`select proconfig from pg_proc
    where oid='public.set_updated_at()'::regprocedure`)).rows[0].proconfig, ['search_path=""'])
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query(`select has_function_privilege('${role}',
      'public.set_updated_at()', 'EXECUTE') as allowed`)).rows[0].allowed, false)
  }
  // Default grants from either creator cannot bypass the schema boundary.
  await db.exec('grant create on schema public to supabase_admin')
  for (const creator of ['postgres', 'supabase_admin']) {
    await asRole(creator, `create table public.future_${creator} (id integer)`)
    for (const role of ['anon', 'authenticated']) {
      await denied(role, `select * from public.future_${creator}`)
    }
    await db.exec(`drop table public.future_${creator}`)
  }
  await db.exec('revoke create on schema public from supabase_admin')
  // Verify RLS itself still denies access if client grants are accidentally restored.
  await db.exec('grant usage on schema public to anon; grant select, insert on public.users to anon')
  assert.equal((await asRole('anon', 'select * from public.users')).rows.length, 0)
  await denied('anon', "insert into public.users (id, value) values (3, 'denied by RLS')")
  await db.exec('revoke usage on schema public from anon; revoke select, insert on public.users from anon')
  await db.exec(rollback)
  assert.deepEqual(await snapshot(), baseline)
  assert.equal((await asRole('anon', 'select * from public.users')).rows.length, 1)
  assert.equal((await db.query(`select proconfig from pg_proc
    where oid='public.set_updated_at()'::regprocedure`)).rows[0].proconfig, null)
  console.log(`PASS: ${tables.length} synthetic tables; client CRUD denied; server CRUD/trigger preserved; future objects blocked; RLS defense; drift aborts; rollback restores table ACLs/RLS.`)
} finally {
  await db.close()
}
