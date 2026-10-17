"""SQLite storage. The database is temporary: it is rebuilt from scratch on every start."""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
    try:
        with conn:
            yield conn
    finally:
        conn.close()
