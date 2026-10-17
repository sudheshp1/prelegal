import pytest
from fastapi.testclient import TestClient

from app.main import create_app


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
