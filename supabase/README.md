# Supabase Workspace

This folder is reserved for the database foundation as the product moves out of planning mode.

The current repo uses a single-user internal setup:

- `migrations/` holds the schema created from `SCHEMA.md`
- `seed.sql` creates one deterministic internal operator and profile
- there is no app login flow yet
- auth and row-level security are intentionally deferred until the product actually needs them

Planned contents:

- `migrations/` for schema changes derived from `SCHEMA.md`
- `seed.sql` for local development data
- `config.toml` once the Supabase CLI is installed
- policy and storage definitions tied to the one-profile-per-user model when auth becomes necessary
