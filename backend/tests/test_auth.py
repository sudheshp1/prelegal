import pytest


def sign_in(client, name="Ada Lovelace", email="ada@example.com"):
    return client.post("/api/auth/signin", json={"name": name, "email": email})


def test_sign_in_creates_user(client):
    response = sign_in(client)

    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "Ada Lovelace", "email": "ada@example.com"}


def test_sign_in_again_reuses_user_and_updates_name(client):
    first = sign_in(client).json()
    second = sign_in(client, name="Ada King", email="ADA@example.com").json()

    assert second["id"] == first["id"]
    assert second["name"] == "Ada King"
    assert second["email"] == "ada@example.com"


def test_different_emails_create_different_users(client):
    first = sign_in(client).json()
    second = sign_in(client, name="Grace Hopper", email="grace@example.com").json()

    assert second["id"] != first["id"]


def test_sign_in_trims_name(client):
    assert sign_in(client, name="  Ada  ").json()["name"] == "Ada"


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "Ada", "email": "not-an-email"},
        {"name": "   ", "email": "ada@example.com"},
        {"name": "x" * 101, "email": "ada@example.com"},
        {"email": "ada@example.com"},
        {"name": "Ada"},
    ],
)
def test_sign_in_rejects_invalid_input(client, payload):
    assert client.post("/api/auth/signin", json=payload).status_code == 422
