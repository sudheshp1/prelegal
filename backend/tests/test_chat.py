import os
from types import SimpleNamespace

import openai
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.chat import MAX_HISTORY, MODEL, AiTurn, get_openai_client, openai_client
from app.documents import DocumentData, load_specs
from app.main import create_app
from app.saved_documents import MAX_MESSAGE, ChatMessage
from tests.conftest import sign_up, store
from tests.test_documents import complete_nda, party_updates


class FakeResponses:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.result, Exception):
            raise self.result
        return SimpleNamespace(output_parsed=self.result)


@pytest.fixture
def use_ai(client):
    """Replaces the OpenAI client with a fake that returns the given result."""

    def install(result):
        fake = SimpleNamespace(responses=FakeResponses(result))
        client.app.dependency_overrides[openai_client] = lambda: fake
        return fake.responses

    return install


def turn(reply="OK", document_type=None, party1=None, party2=None, **fields) -> AiTurn:
    return AiTurn(
        reply=reply,
        document_type=document_type,
        field_updates=[{"key": key, "value": value} for key, value in fields.items()],
        party1=party1,
        party2=party2,
    )


def incomplete_nda() -> DocumentData:
    document = complete_nda()
    document.values["governingLaw"] = ""
    return document


def chat(client, message="I need an NDA with Globex", document_id=None):
    return client.post("/api/chat", json={"documentId": document_id, "message": message})


def test_chat_requires_sign_in(client, use_ai):
    use_ai(turn())
    assert chat(client).status_code == 401


def test_first_message_creates_a_saved_document(signed_in, use_ai):
    use_ai(turn("Let's draft a Cloud Service Agreement.", document_type="cloud-service-agreement"))

    body = chat(signed_in, "We sell SaaS").json()

    assert body["documentId"] == 1
    assert body["document"]["documentType"] == "cloud-service-agreement"
    assert body["complete"] is False
    saved = signed_in.get("/api/documents/1").json()
    assert saved["messages"] == [
        {"role": "user", "content": "We sell SaaS"},
        {"role": "assistant", "content": "Let's draft a Cloud Service Agreement."},
    ]
    assert saved["document"] == body["document"]


def test_chat_continues_a_saved_document(signed_in, use_ai):
    document_id = store(incomplete_nda())
    use_ai(turn("Which state's law applies?", party2=party_updates(company="Globex Inc")))

    body = chat(signed_in, "Globex's full name is Globex Inc", document_id).json()

    assert body["documentId"] == document_id
    assert body["document"]["parties"][1]["company"] == "Globex Inc"
    saved = signed_in.get(f"/api/documents/{document_id}").json()
    assert [m["content"] for m in saved["messages"]] == ["hi", "Globex's full name is Globex Inc", "Which state's law applies?"]
    assert saved["companies"] == ["Acme", "Globex Inc"]


def test_chat_is_complete_once_required_fields_are_filled(signed_in, use_ai):
    document_id = store(incomplete_nda())
    use_ai(turn("All set!", governingLaw="Delaware"))

    body = chat(signed_in, "Delaware", document_id).json()

    assert body["document"]["values"]["governingLaw"] == "Delaware"
    assert body["complete"] is True
    assert signed_in.get("/api/documents").json()[0]["complete"] is True


def test_chat_cannot_use_another_users_document(client, use_ai):
    sign_up(client)
    adas = store(incomplete_nda())
    client.cookies.clear()
    sign_up(client, name="Grace", email="grace@example.com")
    calls = use_ai(turn()).calls

    assert chat(client, document_id=adas).status_code == 404
    assert calls == []


def test_chat_ignores_an_unknown_document_type_from_the_model(signed_in, use_ai):
    use_ai(turn("Sure", document_type="lease-agreement"))
    assert chat(signed_in).json()["document"]["documentType"] is None


def test_chat_prompt_lists_supported_documents_before_a_type_is_chosen(signed_in, use_ai):
    calls = use_ai(turn()).calls

    chat(signed_in)

    system = calls[0]["input"][0]["content"]
    assert "cloud-service-agreement: Cloud Service Agreement" in system
    assert "not supported" in system
    assert "No document has been chosen yet." in system


def test_chat_sends_saved_history_and_document_context_to_the_model(signed_in, use_ai):
    history = [
        ChatMessage(role="user", content="An NDA with Globex"),
        ChatMessage(role="assistant", content="Sure. Which law applies?"),
    ]
    document_id = store(incomplete_nda(), messages=history)
    calls = use_ai(turn()).calls

    chat(signed_in, "Delaware", document_id)

    (call,) = calls
    assert call["model"] == MODEL
    assert call["text_format"] is AiTurn
    system, *rest = call["input"]
    assert system["role"] == "system"
    assert "Current document: Mutual Non-Disclosure Agreement" in system["content"]
    assert "missing: Governing Law" in system["content"]
    assert rest == [*(m.model_dump() for m in history), {"role": "user", "content": "Delaware"}]


def test_chat_sends_only_recent_history_to_the_model(signed_in, use_ai):
    history = [ChatMessage(role="user", content=f"message {i}") for i in range(MAX_HISTORY + 10)]
    document_id = store(incomplete_nda(), messages=history)
    calls = use_ai(turn()).calls

    chat(signed_in, "latest", document_id)

    sent = calls[0]["input"][1:]
    assert len(sent) == MAX_HISTORY
    assert sent[-1] == {"role": "user", "content": "latest"}
    # The full conversation is still saved.
    assert len(signed_in.get(f"/api/documents/{document_id}").json()["messages"]) == MAX_HISTORY + 12


def test_chat_caps_overlong_replies(signed_in, use_ai):
    use_ai(turn("x" * (MAX_MESSAGE + 100)))
    assert len(chat(signed_in).json()["reply"]) == MAX_MESSAGE


def test_chat_reports_openai_failure_without_saving(signed_in, use_ai):
    use_ai(openai.APIConnectionError(request=None))

    response = chat(signed_in)

    assert response.status_code == 502
    assert "unavailable" in response.json()["detail"]
    assert signed_in.get("/api/documents").json() == []


def test_chat_reports_unparseable_output(signed_in, use_ai):
    use_ai(None)
    assert chat(signed_in).status_code == 502


def test_chat_reports_output_that_fails_validation(signed_in, use_ai):
    with pytest.raises(ValidationError) as invalid_output:
        AiTurn.model_validate({"reply": "hi"})
    use_ai(invalid_output.value)

    assert chat(signed_in).status_code == 502


def test_chat_does_not_log_openai_error_messages(signed_in, use_ai, caplog):
    use_ai(openai.APIConnectionError(message="secret sk-proj-abcd", request=None))

    chat(signed_in)

    assert "APIConnectionError" in caplog.text
    assert "sk-proj" not in caplog.text


@pytest.mark.parametrize("message", ["", "x" * (MAX_MESSAGE + 1)])
def test_chat_rejects_invalid_messages(signed_in, use_ai, message):
    use_ai(turn())
    assert chat(signed_in, message).status_code == 422


def test_chat_without_api_key_is_unavailable(signed_in, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    get_openai_client.cache_clear()

    response = chat(signed_in)

    get_openai_client.cache_clear()
    assert response.status_code == 503


live = pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"), reason="needs OPENAI_API_KEY for a live call")


@pytest.fixture
def live_client(tmp_path, monkeypatch):
    monkeypatch.setenv("PRELEGAL_DB_PATH", str(tmp_path / "test.db"))
    with TestClient(create_app()) as client:
        sign_up(client)
        yield client


@live
def test_live_chat_extracts_fields(live_client):
    """Calls the real model; run with the key set, e.g. `uv run --env-file ../.env pytest -k live`."""
    document_id = store(incomplete_nda())

    body = chat(live_client, "Disputes go to New Castle, DE courts under Delaware law.", document_id).json()

    assert body["reply"]
    assert "delaware" in body["document"]["values"]["governingLaw"].lower()
    assert body["complete"] is True


@live
def test_live_chat_detects_the_document_type(live_client):
    body = chat(
        live_client, "I want to sell our SaaS product to a customer. Let's draft a cloud service agreement."
    ).json()

    assert body["document"]["documentType"] == "cloud-service-agreement"


@live
def test_live_chat_offers_an_alternative_for_unsupported_documents(live_client):
    body = chat(live_client, "I need an employment contract for a new hire.").json()

    reply = body["reply"].lower().replace("’", "'")
    assert body["document"]["documentType"] is None
    assert any(word in reply for word in ("can't", "cannot", "not able", "unable", "don't support", "not support"))
    assert any(spec.title.lower() in reply for spec in load_specs().values()), "should offer a supported document"


def test_chat_prompt_lists_field_keys_so_values_can_be_set_when_choosing(signed_in, use_ai):
    calls = use_ai(turn("Pilot it is", document_type="pilot-agreement", pilotPeriod="90 days")).calls

    body = chat(signed_in, "A 90 day pilot").json()

    assert "Field keys: effectiveDate, product, pilotPeriod" in calls[0]["input"][0]["content"]
    assert body["document"]["values"]["pilotPeriod"] == "90 days"


@live
def test_live_chat_records_details_given_with_the_request(live_client):
    body = chat(live_client, "Draft a pilot agreement: a 90-day pilot of our product Insightly.").json()

    assert body["document"]["documentType"] == "pilot-agreement"
    assert "90" in body["document"]["values"]["pilotPeriod"]
    assert "insightly" in body["document"]["values"]["product"].lower()


def test_chat_reply_for_a_document_deleted_meanwhile_is_not_saved(signed_in, use_ai):
    document_id = store(incomplete_nda())

    def delete_during_reply(**kwargs):
        signed_in.delete(f"/api/documents/{document_id}")
        return SimpleNamespace(output_parsed=turn())

    use_ai(None).parse = delete_during_reply

    assert chat(signed_in, "Delaware", document_id).status_code == 404
    assert signed_in.get("/api/documents").json() == []
