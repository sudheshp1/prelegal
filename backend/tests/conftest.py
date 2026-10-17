import sqlite3
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app.auth import User
from app.db import db_path
from app.documents import DocumentData
from app.main import create_app
from app.saved_documents import ChatMessage, save_document


@pytest.fixture
def static_dir(tmp_path):
    out = tmp_path / "out"
    out.mkdir()
    (out / "index.html").write_text("<h1>Prelegal</h1>")
    (out / "404.html").write_text("not found")
    return out


@pytest.fixture
def client(tmp_path, static_dir, monkeypatch):
    monkeypatch.setenv("PRELEGAL_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("PRELEGAL_STATIC_DIR", str(static_dir))
    # Entering the client runs the lifespan, which creates the database.
    with TestClient(create_app()) as client:
        yield client


PASSWORD = "correct horse battery"


def sign_up(client, name="Ada Lovelace", email="ada@example.com", password=PASSWORD):
    return client.post("/api/auth/signup", json={"name": name, "email": email, "password": password})


@pytest.fixture
def signed_in(client):
    """The test client, signed in as Ada (its cookie jar holds her session)."""
    assert sign_up(client).status_code == 201
    return client


ADA = User(id=1, name="Ada Lovelace", email="ada@example.com")


def store(document: DocumentData, complete=False, user=ADA, messages=None) -> int:
    """Saves a document directly, as the chat route would; returns its id."""
    messages = messages or [ChatMessage(role="user", content="hi")]
    with closing(sqlite3.connect(db_path())) as db, db:
        db.row_factory = sqlite3.Row
        return save_document(db, user, None, document, messages, complete)
