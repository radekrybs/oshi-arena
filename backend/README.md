# OSHI Arena — Signup API (GCP backend)

A small **FastAPI** service on **Cloud Run** that collects signups from the
landing page (newsletter, challenge submissions, and OSHI Grid volunteers) and
stores them in **Firestore**.

> **Scope & safety:** This service handles only contact details people
> voluntarily submit (name, email, and the message they typed). It does **not**
> handle any health data. PHI / de-identified health data belongs to the
> separately designed, access-controlled pipelines described in
> [`../docs/patient-cases.md`](../docs/patient-cases.md) and
> [`../docs/oshi-grid.md`](../docs/oshi-grid.md) — never this endpoint.

## What it does

- `POST /signup` — accepts a JSON body for any of the three forms and upserts it
  into Firestore (deduplicated per `type` + email).
- `GET /healthz` — health check.
- CORS locked to the production domains. Honeypot + best-effort rate limiting for
  basic spam resistance.

### Request shape

```json
{ "type": "newsletter", "email": "you@example.com" }
{ "type": "challenge", "email": "...", "name": "...", "title": "...", "details": "..." }
{ "type": "volunteer", "email": "...", "name": "...", "goal": "general", "resource": "NVIDIA GPU" }
```

`type` is one of `newsletter` | `challenge` | `volunteer`. Extra `website` field
is a honeypot and must be empty.

## Run locally

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Auth for local Firestore access (or point at the emulator):
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-gcp-project

uvicorn app.main:app --reload --port 8080
# Test:
curl -X POST localhost:8080/signup -H 'Content-Type: application/json' \
  -d '{"type":"newsletter","email":"you@example.com"}'
```

## Deploy — quick path (one command)

```bash
PROJECT_ID=your-gcp-project REGION=us-central1 ./deploy.sh
```

This enables APIs, creates the Firestore database (if needed), builds from
source, deploys a public Cloud Run service, grants it Firestore access, and
prints the service URL.

## Deploy — Terraform (reproducible infra)

```bash
# 1) Build & push the image
gcloud builds submit . \
  --tag us-central1-docker.pkg.dev/PROJECT/oshi-arena/oshi-arena-api:latest

# 2) Provision
cd infra
cp terraform.tfvars.example terraform.tfvars   # then edit
terraform init && terraform apply
```

Terraform creates a **least-privilege** runtime service account (Firestore
access only), the Firestore database, Artifact Registry, and the Cloud Run
service. Output `api_url` is what the frontend needs.

## Connect the frontend

The landing page reads the API base from a meta tag in `../index.html`:

```html
<meta name="oshi-api-base" content="" />
```

Set `content` to your deployed URL (or a custom domain like
`https://api.oshiarena.com`) and the forms will POST live. **While it's empty,
the forms still work** — they validate and show a confirmation without a network
call — so the site is safe to ship before the backend exists.

```html
<meta name="oshi-api-base" content="https://oshi-arena-api-xxxx.run.app" />
```

## Export / use the data

```bash
# Quick look with the Firestore console, or export to Cloud Storage:
gcloud firestore export gs://YOUR_BUCKET/signups --collection-ids=signups
```

For analytics later, stream Firestore → **BigQuery** with the official
"Firestore to BigQuery" extension or a scheduled export, then query with SQL.

## Cost & scaling

Cloud Run scales to zero (you pay per request) and Firestore has a generous free
tier, so a signup form costs ~nothing at low volume. `max_instance_count` is
capped to keep spend bounded.

## Notes

- Rate limiting here is per-instance and best-effort. For stronger protection put
  **Cloud Armor** or **API Gateway** in front, or add reCAPTCHA to the forms.
- No secrets are required for signups. If you later add notifications (e.g. email
  on new signup), store credentials in **Secret Manager**, not env vars.
