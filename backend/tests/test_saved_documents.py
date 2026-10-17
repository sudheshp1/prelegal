from app.documents import DocumentData
from tests.conftest import sign_up, store
from tests.test_documents import complete_nda


def test_documents_require_sign_in(client):
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/documents/1").status_code == 401
    assert client.delete("/api/documents/1").status_code == 401


def test_new_user_has_no_documents(signed_in):
    assert signed_in.get("/api/documents").json() == []


def test_list_shows_summaries_newest_first(signed_in):
    store(DocumentData())
    store(complete_nda(), complete=True)

    first, second = signed_in.get("/api/documents").json()

    assert first["title"] == "Mutual Non-Disclosure Agreement"
    assert first["companies"] == ["Acme", "Globex"]
    assert first["complete"] is True
    assert first["updatedAt"].endswith("Z")
    assert "document" not in first and "messages" not in first
    assert second["title"] == "Untitled draft"
    assert second["companies"] == []


def test_get_returns_document_and_conversation(signed_in):
    document_id = store(complete_nda())

    body = signed_in.get(f"/api/documents/{document_id}").json()

    assert body["document"]["documentType"] == "mutual-nda"
    assert body["messages"] == [{"role": "user", "content": "hi"}]


def test_delete_removes_the_document(signed_in):
    document_id = store(complete_nda())

    assert signed_in.delete(f"/api/documents/{document_id}").status_code == 204
    assert signed_in.get(f"/api/documents/{document_id}").status_code == 404
    assert signed_in.delete(f"/api/documents/{document_id}").status_code == 404


def test_users_cannot_see_each_others_documents(client):
    sign_up(client)
    adas = store(complete_nda())

    client.cookies.clear()
    sign_up(client, name="Grace", email="grace@example.com")

    assert client.get("/api/documents").json() == []
    assert client.get(f"/api/documents/{adas}").status_code == 404
    assert client.delete(f"/api/documents/{adas}").status_code == 404
