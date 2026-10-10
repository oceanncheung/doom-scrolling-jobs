# Supabase Workspace

This folder is reserved for the database foundation as the product moves out of planning mode.

The current repo uses a single-user internal setup:

- `migrations/` holds the schema created from `SCHEMA.md`
- `seed.sql` creates one deterministic internal operator and profile
- there is no app login flow yet
- app authentication is not implemented; operator selection is not authentication
- the server-only Data API boundary was applied October 10, 2026; [the security record](../docs/security-data-api.md) documents verification, rollback and remaining app access work
- `security/` archives the exact applied lockdown SQL outside the automatic migration glob to prevent replay; new installations require explicit review/application

Planned contents:

- `migrations/` for schema changes derived from `SCHEMA.md`
- `seed.sql` for local development data
- `config.toml` once the Supabase CLI is installed
- ownership policies tied to verified Supabase Auth identities if browser database access is introduced
