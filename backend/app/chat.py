"""AI chat that drafts any supported document. Stateless: the client sends the whole conversation each turn."""

import logging
from datetime import date
from functools import lru_cache
from typing import Annotated, Literal

import openai
from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError

from .documents import CamelModel, DocumentData, DocumentUpdates, load_specs, merge, missing_fields

MODEL = "gpt-6-luna"
TIMEOUT_SECONDS = 60
MAX_MESSAGE = 4000

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE)


class ChatRequest(CamelModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    document: DocumentData


class ChatResponse(CamelModel):
    reply: str
    document: DocumentData
    complete: bool


class AiTurn(DocumentUpdates):
    reply: str = Field(description="Your next chat message to the user")


SYSTEM_PROMPT = """\
You are Prelegal's legal drafting assistant. You help the user draft a legal agreement based on \
Common Paper standard terms, through a friendly, concise chat. Today's date is {today}.

Supported documents (id: name - description):
{catalog}

Choosing the document:
- If no document has been chosen yet, find out what the user needs. When it matches a supported \
document, set `document_type` to its id and start gathering its fields.
- If the user asks for a document that is not supported, explain that Prelegal can't generate that \
document, suggest the closest supported document and why it may fit, and ask whether to proceed. \
Only set `document_type` once they agree.
- If the user wants to switch to a different document, confirm that this starts a new document, \
then set `document_type` to the new id.

Gathering fields:
- Ask about one or two missing fields at a time, in a natural order: the parties and signatories \
first, then the business terms, then governing law and courts.
- Whenever the user gives information, record it in `field_updates` (using the field keys below) \
and in `party1`/`party2`; leave everything else empty or null.
- Write field values as they should appear in the agreement. Use yyyy-mm-dd for date fields and \
interpret relative dates (e.g. "today", "next Monday") from today's date.
- Fields with defaults already have a value; mention them and let the user change them.
- If an answer is ambiguous, ask a short follow-up question rather than guessing.
- Once nothing required is missing, summarise the key terms and tell the user they can download the \
PDF from the preview panel. Offer to change anything.
- Keep replies short. Do not give legal advice; suggest consulting a lawyer if asked. Politely \
steer off-topic requests back to drafting.

{document}"""

DOCUMENT_SECTION = """\
Current document: {title} (id {id}).
party1 is the {role1}; party2 is the {role2}.

Fields (key: label - description):
{fields}

Current document (JSON):
{data}

Required fields still missing: {missing}"""


def _catalog() -> str:
    return "\n".join(f"- {spec.id}: {spec.title} - {spec.description}" for spec in load_specs().values())


def _document_section(document: DocumentData) -> str:
    if document.document_type is None:
        return "No document has been chosen yet."
    spec = load_specs()[document.document_type]
    fields = "\n".join(
        f"- {field.key}: {field.label} - {field.description}"
        + (" (date, yyyy-mm-dd)" if field.kind == "date" else "")
        + ("" if field.required else " (optional)")
        for field in spec.fields
    )
    return DOCUMENT_SECTION.format(
        title=spec.title,
        id=spec.id,
        role1=spec.parties[0],
        role2=spec.parties[1],
        fields=fields,
        data=document.model_dump_json(by_alias=True, indent=2),
        missing=", ".join(missing_fields(document)) or "none",
    )


def system_prompt(document: DocumentData) -> str:
    return SYSTEM_PROMPT.format(
        today=date.today().isoformat(), catalog=_catalog(), document=_document_section(document)
    )


@lru_cache
def get_openai_client() -> OpenAI:
    return OpenAI(timeout=TIMEOUT_SECONDS)  # reads OPENAI_API_KEY from the environment


def openai_client() -> OpenAI:
    try:
        return get_openai_client()
    except openai.OpenAIError as error:
        logger.error("OpenAI client unavailable: %s", type(error).__name__)
        raise HTTPException(503, "The AI assistant is not configured.") from error


@router.post("")
def chat(body: ChatRequest, client: Annotated[OpenAI, Depends(openai_client)]) -> ChatResponse:
    messages = [{"role": "system", "content": system_prompt(body.document)}, *(m.model_dump() for m in body.messages)]
    try:
        response = client.responses.parse(model=MODEL, input=messages, text_format=AiTurn)
    except (openai.OpenAIError, ValidationError) as error:
        # Log only the error type and status: OpenAI's messages can include part of the API key.
        logger.error("OpenAI request failed: %s (status %s)", type(error).__name__, getattr(error, "status_code", None))
        raise HTTPException(502, "The AI assistant is unavailable. Please try again.") from error

    turn = response.output_parsed
    if turn is None:
        raise HTTPException(502, "The AI assistant gave an unexpected response. Please try again.")

    document = merge(body.document, turn)
    # Capped so the reply can always be sent back as history on the next turn.
    reply = turn.reply.strip()[:MAX_MESSAGE]
    return ChatResponse(reply=reply, document=document, complete=not missing_fields(document))
