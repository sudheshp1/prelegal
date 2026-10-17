"""SQLite storage. The database is temporary: it is rebuilt from scratch on every start."""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path
from typing import Annotated

from fastapi import Depends

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

-- `document` and `messages` hold JSON: the DocumentData being drafted and the chat history.
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    document TEXT NOT NULL,
    messages TEXT NOT NULL,
    complete INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX documents_by_user ON documents (user_id, updated_at);
"""


def db_path() -> Path:
    return Path(os.environ.get("PRELEGAL_DB_PATH", "prelegal.db"))


def init_db() -> None:
    """Deletes any existing database file and creates a fresh schema."""
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    # sqlite3's own context manager only commits, so close explicitly too.
    with closing(sqlite3.connect(path)) as conn:
        conn.executescript(SCHEMA)


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency yielding a connection that commits on success."""
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


# Routes take `db: Db`. scope="function" commits before the response is sent; by default
# FastAPI finishes yield dependencies afterwards, so a fast follow-up request could miss the data.
Db = Annotated[sqlite3.Connection, Depends(get_db, scope="function")]
