"""AI chat that drafts a Mutual NDA. Stateless: the client sends the whole conversation each turn."""

import logging
from datetime import date
from functools import lru_cache
from typing import Annotated, Literal

import openai
from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError

from .nda import CamelModel, NdaFields, NdaUpdates, merge, missing_fields

MODEL = "gpt-6-luna"
TIMEOUT_SECONDS = 60

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(CamelModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    nda: NdaFields


class ChatResponse(CamelModel):
    reply: str
    nda: NdaFields
    complete: bool


class AiTurn(BaseModel):
    reply: str = Field(description="Your next chat message to the user")
    updates: NdaUpdates = Field(description="Field values learned from the user's latest message; null for no change")


SYSTEM_PROMPT = """\
You are Prelegal's legal drafting assistant. You help the user complete a Mutual Non-Disclosure \
Agreement (MNDA) based on the Common Paper Mutual NDA standard terms, through a friendly, concise chat.

How to behave:
- Ask about one or two missing fields at a time, in a natural order: the parties first, then purpose, \
dates and terms, then governing law and jurisdiction.
- Whenever the user gives information, record it in `updates`; leave every other field null. \
`party1` and `party2` in `updates` are `parties[0]` and `parties[1]` in the current fields.
- If an answer is ambiguous, ask a short follow-up question rather than guessing.
- Interpret relative dates (e.g. "today", "next Monday") using today's date: {today}.
- The term fields already have defaults (1 year each); mention them and let the user change them.
- Once nothing required is missing, summarise the key terms and tell the user they can download the \
PDF from the preview panel. Offer to change anything.
- Keep replies short. Do not give legal advice; suggest consulting a lawyer if asked.
- Politely steer off-topic requests back to the NDA.

Current document fields (JSON):
{fields}

Required fields still missing: {missing}
"""


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
    system = SYSTEM_PROMPT.format(
        today=date.today().isoformat(),
        fields=body.nda.model_dump_json(by_alias=True, indent=2),
        missing=", ".join(missing_fields(body.nda)) or "none",
    )
    messages = [{"role": "system", "content": system}, *(m.model_dump() for m in body.messages)]
    try:
        response = client.responses.parse(model=MODEL, input=messages, text_format=AiTurn)
    except (openai.OpenAIError, ValidationError) as error:
        # Log only the error type and status: OpenAI's messages can include part of the API key.
        logger.error("OpenAI request failed: %s (status %s)", type(error).__name__, getattr(error, "status_code", None))
        raise HTTPException(502, "The AI assistant is unavailable. Please try again.") from error

    turn = response.output_parsed
    if turn is None:
        raise HTTPException(502, "The AI assistant gave an unexpected response. Please try again.")

    nda = merge(body.nda, turn.updates)
    return ChatResponse(reply=turn.reply, nda=nda, complete=not missing_fields(nda))
