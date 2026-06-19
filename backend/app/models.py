"""Request schema for signups.

A single endpoint accepts all three form types (newsletter, challenge,
volunteer). Type-specific required fields are enforced in the handler.
"""
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

SignupType = Literal["newsletter", "challenge", "volunteer"]


class Signup(BaseModel):
    type: SignupType
    email: EmailStr
    name: Optional[str] = Field(default=None, max_length=200)

    # Challenge submission fields
    title: Optional[str] = Field(default=None, max_length=300)
    details: Optional[str] = Field(default=None, max_length=5000)

    # Volunteer (OSHI Grid) fields
    goal: Optional[str] = Field(default=None, max_length=100)
    resource: Optional[str] = Field(default=None, max_length=300)

    # Honeypot — real users never fill this; bots often do. Must stay empty.
    website: Optional[str] = Field(default=None, max_length=300)

    @field_validator("name", "title", "details", "goal", "resource", mode="before")
    @classmethod
    def _trim_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v
