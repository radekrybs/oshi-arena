"""Runtime configuration, read from environment variables.

All settings have sensible defaults so the service runs locally with no setup.
On Cloud Run, set ALLOWED_ORIGINS (and optionally the Firestore settings).
"""
import os


def _origins() -> list[str]:
    raw = os.environ.get(
        "ALLOWED_ORIGINS",
        # Production domains + local dev server by default.
        "https://oshiarena.com,https://www.oshiarena.com,http://localhost:8000",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


# Browser origins allowed to call the API (CORS allowlist).
ALLOWED_ORIGINS = _origins()

# Firestore collection that stores signups.
COLLECTION = os.environ.get("FIRESTORE_COLLECTION", "signups")

# Firestore database id. "(default)" is the database created by
# `gcloud firestore databases create`.
FIRESTORE_DATABASE = os.environ.get("FIRESTORE_DATABASE", "(default)")

# GCP project. On Cloud Run this is provided automatically.
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")

# Best-effort, per-instance rate limit (requests per IP per window).
RATE_LIMIT_MAX = int(os.environ.get("RATE_LIMIT_MAX", "20"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60"))
