from fastapi.testclient import TestClient

from app.db import init_db
from app.main import create_app
from tests.conftest import sign_up


def test_health(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_serves_frontend_index(client):
    response = client.get("/")

    assert response.status_code == 200
    assert "Prelegal" in response.text


def test_unknown_page_returns_frontend_404(client):
    response = client.get("/missing")

    assert response.status_code == 404
    assert response.text == "not found"


def test_api_works_without_built_frontend(tmp_path, monkeypatch):
    monkeypatch.setenv("PRELEGAL_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("PRELEGAL_STATIC_DIR", str(tmp_path / "does-not-exist"))

    with TestClient(create_app()) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404


def test_database_is_recreated_on_startup(client):
    sign_up(client)

    init_db()

    # The earlier account was wiped, so the same email can register again,
    # and the old session cookie no longer works.
    assert client.get("/api/auth/me").status_code == 401
    assert sign_up(client).status_code == 201
