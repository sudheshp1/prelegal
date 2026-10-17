"""Email/password accounts with server-side sessions held in an HttpOnly cookie."""

import hashlib
import hmac
import secrets
import sqlite3
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .db import Db

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_COOKIE = "prelegal_session"
SESSION_LIFETIME = timedelta(days=7)
MIN_PASSWORD = 8

# scrypt with a per-user salt; parameters follow the stdlib's recommended minimums.
SCRYPT_PARAMS = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **SCRYPT_PARAMS)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    _, salt, digest = stored.split("$")
    candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), **SCRYPT_PARAMS)
    return hmac.compare_digest(candidate.hex(), digest)


# Compared against when the email is unknown, so both failures take the same time.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


class Credentials(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class SignUpRequest(Credentials):
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=MIN_PASSWORD, max_length=128)


class User(BaseModel):
    id: int
    name: str
    email: str


def _start_session(db: sqlite3.Connection, response: Response, user_id: int) -> None:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(UTC) + SESSION_LIFETIME
    db.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires.isoformat())
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        samesite="lax",
    )


def current_user(
    db: Db,
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    """Dependency for routes that need a signed-in user; 401 otherwise."""
    row = None
    if token:
        row = db.execute(
            """
            SELECT users.id, users.name, users.email FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ? AND sessions.expires_at > ?
            """,
            (token, datetime.now(UTC).isoformat()),
        ).fetchone()
    if row is None:
        raise HTTPException(401, "Please sign in.")
    return User(**row)


@router.post("/signup", status_code=201)
def sign_up(body: SignUpRequest, response: Response, db: Db) -> User:
    try:
        row = db.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id, name, email",
            (body.name, body.email.lower(), hash_password(body.password)),
        ).fetchone()
    except sqlite3.IntegrityError as error:
        raise HTTPException(409, "An account with this email already exists.") from error
    _start_session(db, response, row["id"])
    return User(**row)


@router.post("/signin")
def sign_in(body: Credentials, response: Response, db: Db) -> User:
    row = db.execute(
        "SELECT id, name, email, password_hash FROM users WHERE email = ?", (body.email.lower(),)
    ).fetchone()
    stored_hash = row["password_hash"] if row else _DUMMY_HASH
    if not verify_password(body.password, stored_hash) or row is None:
        raise HTTPException(401, "Incorrect email or password.")
    _start_session(db, response, row["id"])
    return User(id=row["id"], name=row["name"], email=row["email"])


@router.post("/signout", status_code=204)
def sign_out(
    response: Response,
    db: Db,
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> None:
    if token:
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))
    response.delete_cookie(SESSION_COOKIE, httponly=True, samesite="lax")


@router.get("/me")
def me(user: Annotated[User, Depends(current_user)]) -> User:
    return user
