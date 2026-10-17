"""Placeholder sign-in: no passwords or sessions yet, it just records who entered the platform."""

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .db import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignInRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    email: EmailStr


class User(BaseModel):
    id: int
    name: str
    email: str


@router.post("/signin")
def sign_in(body: SignInRequest, db: Annotated[sqlite3.Connection, Depends(get_db)]) -> User:
    """Creates the user on first sign-in, or updates their name, keyed by email."""
    row = db.execute(
        """
        INSERT INTO users (name, email) VALUES (?, ?)
        ON CONFLICT (email) DO UPDATE SET name = excluded.name
        RETURNING id, name, email
        """,
        (body.name, body.email.lower()),
    ).fetchone()
    return User(**row)
