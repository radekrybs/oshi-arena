"""OSHI Arena signup API (FastAPI on Cloud Run).

One endpoint, POST /signup, receives submissions from the newsletter,
challenge, and volunteer (OSHI Grid) forms and stores them in Firestore.

Privacy/safety: this service handles only contact details that people
voluntarily submit. It does NOT handle any health data — that belongs to the
separately-designed, access-controlled pipelines (see docs/patient-cases.md and
docs/oshi-grid.md), not this endpoint.
"""
import logging
import time
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .models import Signup
from .store import save_signup

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("oshi-api")

app = FastAPI(title="OSHI Arena API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
    max_age=3600,
)

# Type-specific required fields (email is always required).
REQUIRED_FIELDS = {
    "newsletter": ["email"],
    "challenge": ["email", "name", "title", "details"],
    "volunteer": ["email", "name"],
}

# Best-effort, per-instance rate limiting. For robust limiting across
# instances, front the service with Cloud Armor or API Gateway.
_hits: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_ok(ip: str) -> bool:
    now = time.time()
    window = config.RATE_LIMIT_WINDOW_SECONDS
    dq = _hits[ip]
    while dq and now - dq[0] > window:
        dq.popleft()
    if len(dq) >= config.RATE_LIMIT_MAX:
        return False
    dq.append(now)
    return True


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/signup")
def signup(payload: Signup, request: Request):
    if not _rate_ok(_client_ip(request)):
        raise HTTPException(status_code=429, detail="Too many requests")

    # Honeypot tripped: accept silently so bots get no signal, but store nothing.
    if payload.website:
        log.info("honeypot triggered for type=%s", payload.type)
        return {"ok": True}

    missing = [
        f for f in REQUIRED_FIELDS.get(payload.type, ["email"])
        if not getattr(payload, f, None)
    ]
    if missing:
        raise HTTPException(
            status_code=422, detail=f"Missing required fields: {', '.join(missing)}"
        )

    try:
        save_signup(payload.model_dump())
    except Exception:  # noqa: BLE001 - surface a generic error, log the detail
        log.exception("failed to save signup")
        raise HTTPException(status_code=500, detail="Could not save signup")

    log.info("stored signup type=%s", payload.type)
    return {"ok": True}
