#!/usr/bin/env bash
#
# One-shot deploy of the OSHI Arena signup API to Cloud Run + Firestore.
# Requires: gcloud CLI, authenticated (`gcloud auth login`) with rights to the
# target project. Run from the repo root or the backend/ directory.
#
# Usage:
#   PROJECT_ID=my-gcp-project REGION=us-central1 ./backend/deploy.sh
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID=your-gcp-project}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-oshi-arena-api}"
# Firestore location (e.g. nam5 multi-region, or a single region like us-central1).
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-nam5}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://oshiarena.com,https://www.oshiarena.com}"

# Resolve the directory of this script so it works from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ">> Project: $PROJECT_ID   Region: $REGION   Service: $SERVICE"
gcloud config set project "$PROJECT_ID" >/dev/null

echo ">> Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com >/dev/null

echo ">> Ensuring a Firestore (native) database exists..."
if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  gcloud firestore databases create \
    --location="$FIRESTORE_LOCATION" \
    --type=firestore-native
else
  echo "   Firestore database already exists — skipping."
fi

echo ">> Deploying to Cloud Run (builds from source)..."
gcloud run deploy "$SERVICE" \
  --source "$SCRIPT_DIR" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "ALLOWED_ORIGINS=${ALLOWED_ORIGINS},FIRESTORE_COLLECTION=signups"

echo ">> Granting the Cloud Run runtime service account access to Firestore..."
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user" \
  --condition=None >/dev/null

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo ""
echo ">> Done. API URL: $URL"
echo "   Health check: curl ${URL}/healthz"
echo ""
echo "   Next: set the frontend to use it by editing index.html:"
echo "     <meta name=\"oshi-api-base\" content=\"${URL}\" />"
echo "   (or point a custom domain like https://api.oshiarena.com at the service)."
