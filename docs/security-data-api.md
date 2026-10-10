# Server-only Data API boundary and private service containment

Applied October 10, 2026 to project `itfaformdvyfronturhc`, following Ocean's
explicit approval at 15:58 UTC for the prepared database lockdown and private
Cloud Run service, including temporary loss of normal browser access.
No database rows, résumés, credentials, or environment files were inspected.

## Findings and compatibility

`lib/supabase/server.ts` uses `@supabase/supabase-js` with a server secret or legacy
service-role key and disables session persistence. The application uses the Data
API, not a direct Postgres connection. No application imports of the public
client helper or Supabase Auth sessions were found. The local server client now
has a `server-only` marker; CLI tooling already supports this marker.

Read-only catalog checks confirmed 21 public tables, all owned by `postgres`,
with RLS disabled and no policies. `anon` and `authenticated` have all table
privileges; PUBLIC has schema USAGE. `service_role` has schema USAGE, table CRUD,
and BYPASSRLS. There are no public views or sequences. The only public function
is `set_updated_at()`, a SECURITY INVOKER trigger with no fixed search path.
Automatic grants exist for both `postgres` and `supabase_admin` object creators.
Data API enabled/exposed-schema runtime settings remain unverified; the absence
of `pgrst` role settings does not establish those settings. No breach is established.

The live migration history lists six timestamped migrations; local history uses
older numeric names, includes a duplicate `0012`, and lacks the live legacy
`_applied_migrations` tracker. Do not run a bulk `db push` or replay old migrations.
Apply only the reviewed new migration after action-time approval.

## Exact database change

Applied SQL archive: `supabase/security/20261010150156_restrict_public_data_api_access.sql`.
The exact applied SQL is intentionally outside `migrations/`: GitHub's legacy
runner tracks filenames separately from Supabase's migration history. Keeping
this file in its glob would attempt to replay the already-applied lockdown and
fail its reviewed-baseline guard. No live migration tracker was changed. New
installations must review and explicitly apply this SQL after schema creation;
do not automatically replay it against the contained production database.

1. In one transaction, require the reviewed 20 app tables (plus optional live
   `_applied_migrations`), no policies/views/sequences, and the reviewed trigger.
   Require service-role BYPASSRLS, schema USAGE, and each CRUD grant independently.
   Abort on drift or incompatibility, with 5-second lock and 30-second statement timeouts.
2. Enable ordinary RLS on all present app tables and the tracker. Add no policies:
   internal operator/user IDs are not Supabase Auth identities, and browsers do
   not need direct database access. Do not use FORCE RLS.
3. Revoke schema USAGE from PUBLIC, `anon`, and `authenticated`. Revoke their
   privileges on all existing public tables and on `set_updated_at()`.
4. Set that trigger's `search_path` to the empty string. Its existing builtin
   `timezone`/`now` calls resolve through `pg_catalog`; retain SECURITY INVOKER.

Service-role grants, role attributes, object ownership, data, schema structure,
default ACLs, Data API settings, and deployment configuration remain unchanged.
Schema USAGE removal also blocks future objects regardless of creator defaults.
New tables still need explicit service-role CRUD grants and RLS in their own
migration, particularly under Supabase's forthcoming default-grant rollout.
Client access requires a separately reviewed Auth model, schema USAGE, object
grants, and ownership policies together. Never merely regrant schema access.

## Verification and approval sequence

The repeatable test executes the exact migration and rollback in embedded
PostgreSQL 17.5, using synthetic minimal tables for all 21 reviewed names. It
verifies both client roles cannot SELECT/INSERT/UPDATE/DELETE; service-role CRUD
and update triggers still work; RLS still denies access if client grants return;
future objects from either creator are inaccessible; drift/missing service
privileges abort without partial changes; rollback restores table ACLs and RLS.
It does not emulate PostgREST or validate every production column/foreign key.
The synthetic suite and script syntax check passed. Repository lint could not
start because installed dependencies lack `imurmurhash` (isolated ESLint also
failed on missing project dependency `micromatch`); repository typecheck
stalled without diagnostics. Full app lint/typecheck/build remain unverified.

Run without reading project env or using the live database:

```sh
npm install --prefix /tmp/dsj-security-test --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.3.14
node scripts/test-data-api-security.mjs /tmp/dsj-security-test/node_modules/@electric-sql/pglite/dist/index.js
```

Before live application, recheck catalogs/ACLs and freeze concurrent schema work.
Get approval for the exact migration and project at action time. Keep Data API
enabled and service-role access available. After applying, verify metadata:
all 21 tables have RLS, no client schema/table/function privileges, no policies,
unchanged service-role privileges/BYPASSRLS, and fixed trigger search path.
Use zero-row requests (`limit=0`) for runtime API compatibility if authorized;
never fetch user contents. Do not run the full eval/live workflow smokes during
this task: they can access real operator/material data. User-assisted workflow
validation or a synthetic staging environment is still required.

## Rollback

`supabase/rollback/restrict_public_data_api_access.sql` is outside migration
discovery. Separate live approval is required. Use only immediately against the
reviewed snapshot with schema changes frozen; capture fresh catalog ACL/RLS
metadata before rollout for comparison. It disables RLS on the reviewed tables,
restores all prior client table privileges and schema USAGE, restores trigger
EXECUTE grants, and resets search_path. It deliberately restores the insecure
baseline. Prefer diagnosing service compatibility with catalogs before rollback.
If state has drifted, generate an exact inverse from the captured metadata rather
than executing this template. Do not roll back by disabling the Data API.

## Remaining app access concern

`selectOperator` in `app/operators/actions.ts` verifies existence and sets an
unsigned operator-selection cookie. `lib/data/operators.ts` accepts ID/slug as
the active operator. The entry screen enumerates operators, and write paths use
the service role. `app/api/jobs/import/route.ts` checks configured env, not login.
Deployment paths previously defaulted to public Cloud Run access. Live public access was confirmed in
the Cloud Console after the user completed sign-in, as detailed below.
Server-mediated access remains a separate boundary after database lockdown.
Cloud Run IAM containment now closes public invocation as detailed below. Proper
app sign-in and verified operator ownership still require a separately scoped
implementation. Auth is protected by CLAUDE.md; this patch does not change it.

### Live Cloud Run verification follow-up

Read-only verification was attempted for service `doomscrollingjobs-web`, region
`northamerica-northeast1`, project `spry-climber-491704-m7` (the configured gcloud
project). Both service metadata and service IAM queries failed because the existing
Google session requires reauthentication. The Cloud Console security URL also
required a user passkey confirmation on the first attempt.

After the user completed sign-in, read-only Console checks at October 10, 2026
15:26–15:27 UTC confirmed:

- Authentication: **Allow public access** selected; Console explicitly states
  **No authentication checks will be performed** (Require authentication unselected).
- Ingress: **All**, allowing direct internet access.
- Default HTTPS endpoint: enabled. No custom URLs or custom domains are configured.
- Service healthy and serving traffic.
- An unauthenticated HEAD request to the data-free `/api/health` route returned
  HTTP 200 at `https://doomscrollingjobs-web-394476327013.northamerica-northeast1.run.app`.
  The Console also lists `https://doomscrollingjobs-web-zz3pteh4xa-nn.a.run.app`.

These checks confirmed the service's public infrastructure boundary was open.
The deployed image was not matched to a repository commit. The unsigned-cookie
flow was identified in local code; it was not exercised against live operator
routes. No user-facing app pages or operator records/materials were fetched.
No evidence of unauthorized access is established.

IAM alone does not provide a normal app
login screen; an authenticated Cloud Run proxy suits a sole internal operator,
while browser access for more people may justify IAP instead. Signing or marking
the selection cookie HttpOnly by itself would not authenticate an operator.

## Approved live application and verification

Fresh catalogs matched the reviewed baseline immediately before applying the
exact migration. Supabase reported success and recorded migration version
`20261010155959`, name `restrict_public_data_api_access`. The local file's
generation timestamp differs; do not bulk replay migrations to reconcile it.
At 16:00:18 UTC the following postconditions were confirmed:

- All 21 public tables have RLS enabled; no FORCE RLS and no policies.
- `anon` and `authenticated` lack schema USAGE, table privileges and trigger
  EXECUTE. `service_role` retains schema USAGE, all table CRUD grants, trigger
  EXECUTE and BYPASSRLS. Object ownership and default ACLs remain unchanged.
- The trigger remains SECURITY INVOKER with `search_path=""`.
- Read-only permission probes using `SELECT 1 FROM public.users WHERE false`
  failed with schema permission denied for both client roles and succeeded with
  zero rows for `service_role`. No application rows were read or modified.
- Security advisors report only the 21 expected informational RLS-without-policy
  notices; no warnings or errors. Data API settings were not changed or disabled.

After reviewing the fresh Cloud Console state, the service authentication setting
was changed from Allow public access to Require authentication (IAM). The review
showed only that service-level change; force-revision deployment was unchecked.
Console confirmed update/routing completion, healthy service, and the saved IAM
setting at 16:01:27 UTC. No code/image deployment was performed.

Unauthenticated HEAD requests to `/api/health` returned HTTP 403 at both default
service URLs. The service permission pane, including inherited roles, showed no
`allUsers` or `allAuthenticatedUsers` binding. Existing project Owner, Cloud Run
Admin service accounts and Cloud Run Service Agent bindings were preserved;
there were no public bindings to remove. Ingress remains All, IAP remains off.
An authenticated runtime request was not performed: CLI reauthentication remains
unavailable, and no personal-data workflow was exercised. Intended IAM access
is retained by metadata, with browser access now intentionally blocked until an
authenticated access path is used. Rollback was not needed or executed.

**Local deployment prevention completed:** GitHub Actions, the local shell
script, and optional `cloudbuild.yaml` now explicitly pass `--invoker-iam-check`.
The local public-access override was removed. A dependency-free static check
scans scripts/workflows/Cloud Build for public flags or bindings, requires all
three reviewed deployment paths to have an explicit IAM check, and rejects new
unreviewed deployment paths. All three invoke it before deployment work.
`node scripts/check-private-cloud-run.mjs`, Node syntax and shell syntax checks
passed. Mutation probes confirmed public flags and missing IAM flags are rejected.
The prepared patch is intended for a review branch: the only remote workflow
triggers on `main` pushes or manual dispatch, and repository webhook inventory
is empty. No deployment, IAM grant or app authentication implementation is part
of this push. The remote main configuration still requires this patch to be
reviewed and landed before another deployment. Static checks
do not prove deployed IAM bindings or authenticated application compatibility.

Official reference: [Cloud Run public access and restoring the IAM check](https://docs.cloud.google.com/run/docs/authenticating/public).

## Official guidance checked

- [Data API security](https://supabase.com/docs/guides/api/securing-your-api): grants, schema boundaries, and RLS work together; disabling Data API is for apps not using it.
- [RLS and service keys](https://supabase.com/docs/guides/database/postgres/row-level-security): secret keys use service_role/BYPASSRLS when no user token overrides the request.
- [April 28 default-grant changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): October 30 rollout changes new-object grants; existing grants persist.

The markdown changelog endpoint could not be fetched through available web/shell
access, so the official HTML changelog and relevant breaking-change page were checked.
