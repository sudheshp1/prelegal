import sqlite3
from datetime import UTC, datetime, timedelta

import pytest

from app.auth import SESSION_COOKIE, hash_password, verify_password
from app.db import db_path
from tests.conftest import PASSWORD, sign_up

ADA = {"id": 1, "name": "Ada Lovelace", "email": "ada@example.com"}


def sign_in(client, email="ada@example.com", password=PASSWORD):
    return client.post("/api/auth/signin", json={"email": email, "password": password})


def test_sign_up_creates_account_and_signs_in(client):
    response = sign_up(client)

    assert response.status_code == 201
    assert response.json() == ADA
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert client.get("/api/auth/me").json() == ADA


def test_sign_up_normalises_email_and_name(client):
    body = sign_up(client, name="  Ada  ", email="ADA@Example.com").json()
    assert (body["name"], body["email"]) == ("Ada", "ada@example.com")


def test_sign_up_rejects_duplicate_email(client):
    sign_up(client)

    response = sign_up(client, email="ADA@example.com")

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "Ada", "email": "ada@example.com", "password": "short"},
        {"name": "Ada", "email": "not-an-email", "password": PASSWORD},
        {"name": "   ", "email": "ada@example.com", "password": PASSWORD},
        {"email": "ada@example.com", "password": PASSWORD},
    ],
)
def test_sign_up_rejects_invalid_input(client, payload):
    assert client.post("/api/auth/signup", json=payload).status_code == 422


def test_password_is_stored_hashed(client):
    sign_up(client)

    with sqlite3.connect(db_path()) as conn:
        (stored,) = conn.execute("SELECT password_hash FROM users").fetchone()

    assert PASSWORD not in stored
    assert stored.startswith("scrypt$")
    assert verify_password(PASSWORD, stored)
    assert not verify_password("wrong password", stored)


def test_hashes_are_salted():
    assert hash_password(PASSWORD) != hash_password(PASSWORD)


def test_sign_in_returns_to_the_account(client):
    sign_up(client)
    client.cookies.clear()

    response = sign_in(client, email="ADA@example.com")

    assert response.status_code == 200
    assert response.json() == ADA
    assert client.get("/api/auth/me").json() == ADA


@pytest.mark.parametrize("email, password", [("ada@example.com", "wrong password"), ("nobody@example.com", PASSWORD)])
def test_sign_in_failures_give_the_same_message(client, email, password):
    sign_up(client)
    client.cookies.clear()

    response = sign_in(client, email=email, password=password)

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."
    assert client.get("/api/auth/me").status_code == 401


def test_me_requires_a_session(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_an_unknown_token(client):
    client.cookies.set(SESSION_COOKIE, "made-up-token")
    assert client.get("/api/auth/me").status_code == 401


def test_sign_out_ends_the_session(signed_in):
    token = signed_in.cookies[SESSION_COOKIE]

    assert signed_in.post("/api/auth/signout").status_code == 204
    assert signed_in.get("/api/auth/me").status_code == 401

    # The old token is revoked server-side, not just deleted from the browser.
    signed_in.cookies.set(SESSION_COOKIE, token)
    assert signed_in.get("/api/auth/me").status_code == 401


def test_sign_out_without_a_session_is_harmless(client):
    assert client.post("/api/auth/signout").status_code == 204


def test_expired_sessions_are_rejected(signed_in):
    past = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    with sqlite3.connect(db_path()) as conn:
        conn.execute("UPDATE sessions SET expires_at = ?", (past,))

    assert signed_in.get("/api/auth/me").status_code == 401
