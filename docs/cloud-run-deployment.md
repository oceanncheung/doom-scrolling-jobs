# Cloud Run Deployment

This app can deploy to Google Cloud Run directly from source. The deployment flow uses the local `.env.local` file to populate the runtime environment for Cloud Run, so no secrets are committed to the repo.

## Defaults

- Service name: `doomscrollingjobs-web`
- Region: `northamerica-northeast1`
- Access: public by default (`--no-invoker-iam-check`)

This project’s Google Cloud org policy blocks `allUsers` IAM bindings, so the public path uses Cloud Run with invoker IAM checks disabled instead of `--allow-unauthenticated`.

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
DISABLE_INVOKER_IAM_CHECK=true \
npm run deploy:cloud-run
```

If you want to keep the service private:

```bash
DISABLE_INVOKER_IAM_CHECK=false npm run deploy:cloud-run
```

## After deploy

The script prints:

- the service URL
- the health URL at `/api/health`

## GitHub-backed deploys

The live deploy source is GitHub. Pushes to `main` run [.github/workflows/deploy-cloud-run.yml](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/.github/workflows/deploy-cloud-run.yml), which builds a container, pushes it to Artifact Registry, and deploys the same Cloud Run service.

Required GitHub repo settings:

- variables:
  - `GCP_PROJECT_ID`
  - `GCP_REGION`
  - `GCP_SERVICE_NAME`
  - `GCP_ARTIFACT_REPOSITORY`
  - `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - `GCP_SERVICE_ACCOUNT_EMAIL`

The repo also includes [cloudbuild.yaml](/Users/oceancheung/Documents/Startup/MM.S/z_misc./Doom%20Scrolling%20Jobs/cloudbuild.yaml) for optional Google-native build automation later, but the current automated source of truth is GitHub Actions.

## Security note

This first deployment path injects runtime secrets from `.env.local` into Cloud Run service configuration. That is fast and workable for an internal tool, but the stronger follow-up is to move `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY` into Secret Manager and switch the service to `--set-secrets`.
