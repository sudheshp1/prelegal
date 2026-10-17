from fastapi.testclient import TestClient

from app.db import init_db
from app.main import create_app


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
    client.post("/api/auth/signin", json={"name": "Ada", "email": "ada@example.com"})

    init_db()

    # The earlier user was wiped, so the next user starts again at id 1.
    response = client.post("/api/auth/signin", json={"name": "Grace", "email": "grace@example.com"})
    assert response.json()["id"] == 1
