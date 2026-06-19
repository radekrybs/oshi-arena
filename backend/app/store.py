"""Firestore persistence for signups.

Each (type, email) pair maps to a deterministic document id, so re-submitting
the same address updates the record instead of creating duplicates. A person
may still sign up for different form types (newsletter vs volunteer).
"""
import hashlib

from google.cloud import firestore

from . import config

_client: firestore.Client | None = None


def client() -> firestore.Client:
    global _client
    if _client is None:
        kwargs: dict = {}
        if config.PROJECT_ID:
            kwargs["project"] = config.PROJECT_ID
        if config.FIRESTORE_DATABASE and config.FIRESTORE_DATABASE != "(default)":
            kwargs["database"] = config.FIRESTORE_DATABASE
        _client = firestore.Client(**kwargs)
    return _client


def _doc_id(signup_type: str, email: str) -> str:
    digest = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:32]
    return f"{signup_type}:{digest}"


def save_signup(data: dict) -> None:
    """Upsert a signup. `data` is a validated Signup.model_dump()."""
    db = client()
    email = data["email"].strip().lower()
    stype = data["type"]
    ref = db.collection(config.COLLECTION).document(_doc_id(stype, email))

    # Drop the honeypot and any null fields before writing.
    payload = {
        k: v for k, v in data.items() if k != "website" and v is not None
    }
    payload["email"] = email
    payload["updated_at"] = firestore.SERVER_TIMESTAMP

    # Set created_at only on first write so we keep the original signup time.
    if not ref.get().exists:
        payload["created_at"] = firestore.SERVER_TIMESTAMP

    ref.set(payload, merge=True)
