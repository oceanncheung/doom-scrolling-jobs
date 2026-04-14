# Cloud Run Deployment

This app can deploy to Google Cloud Run directly from source. The deployment flow uses the local `.env.local` file to populate the runtime environment for Cloud Run, so no secrets are committed to the repo.

## Defaults

- Service name: `doomscrollingjobs-web`
- Region: `northamerica-northeast1`
- Access: private by default (`--no-allow-unauthenticated`)

The private default is intentional. The app is still a single-user internal tool with no built-in login, so public deployment should be treated as an explicit choice.

## Prerequisites

1. Install the Google Cloud SDK.
2. Select a project with Cloud Run enabled:
   - `gcloud config set project YOUR_PROJECT_ID`
3. Refresh auth if needed:
   - `gcloud auth login`
4. Make sure `.env.local` contains:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `OPENAI_API_KEY`

## Deploy

Run:

```bash
npm run deploy:cloud-run
```

Optional overrides:

```bash
SERVICE_NAME=doomscrollingjobs-web \
REGION=northamerica-northeast1 \
ALLOW_UNAUTHENTICATED=false \
npm run deploy:cloud-run
```

If you explicitly want a public URL while the app still has no login wall:

```bash
ALLOW_UNAUTHENTICATED=true npm run deploy:cloud-run
```

## After deploy

The script prints:

- the service URL
- the health URL at `/api/health`

## Security note

This first deployment path injects runtime secrets from `.env.local` into Cloud Run service configuration. That is fast and workable for an internal tool, but the stronger follow-up is to move `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY` into Secret Manager and switch the service to `--set-secrets`.
