#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE_NAME="${SERVICE_NAME:-doomscrollingjobs-web}"
REGION="${REGION:-northamerica-northeast1}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
ENV_SOURCE_FILE="${ENV_SOURCE_FILE:-.env.local}"
DISABLE_INVOKER_IAM_CHECK="${DISABLE_INVOKER_IAM_CHECK:-true}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required to deploy to Cloud Run." >&2
  exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "Set a Google Cloud project first with 'gcloud config set project PROJECT_ID'." >&2
  exit 1
fi

if [[ ! -f "$ENV_SOURCE_FILE" ]]; then
  echo "Expected environment file '$ENV_SOURCE_FILE' to exist." >&2
  exit 1
fi

if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "Your gcloud session needs to be refreshed. Run 'gcloud auth login' and retry." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_SOURCE_FILE"
set +a

required_vars=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  SUPABASE_SECRET_KEY
  OPENAI_API_KEY
)

for key in "${required_vars[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required environment variable '$key' in $ENV_SOURCE_FILE." >&2
    exit 1
  fi
done

TMP_ENV_FILE="$(mktemp)"
cleanup() {
  rm -f "$TMP_ENV_FILE"
}
trap cleanup EXIT

ENV_FILE="$TMP_ENV_FILE" node <<'NODE'
const fs = require('fs')

const orderedKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'OPENAI_API_KEY',
  'OPENAI_MODEL_PACKET',
  'OPENAI_MODEL_SUMMARY',
]

const yaml = orderedKeys
  .filter((key) => typeof process.env[key] === 'string' && process.env[key].length > 0)
  .map((key) => `${key}: ${JSON.stringify(process.env[key])}`)
  .join('\n')

fs.writeFileSync(process.env.ENV_FILE, `${yaml}\n`)
NODE

access_flag="--no-invoker-iam-check"
if [[ "$DISABLE_INVOKER_IAM_CHECK" != "true" ]]; then
  access_flag="--invoker-iam-check"
fi

gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source . \
  --port 8080 \
  --cpu 1 \
  --memory 1Gi \
  --max-instances 3 \
  --min-instances 0 \
  --execution-environment gen2 \
  --timeout 300 \
  "$access_flag" \
  --env-vars-file "$TMP_ENV_FILE"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"

echo "Cloud Run deploy complete."
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo "URL: $SERVICE_URL"
echo "Health: ${SERVICE_URL}/api/health"
