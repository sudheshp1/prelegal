"""Each user's saved documents: the document being drafted plus its chat history."""

import json
import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import User, current_user
from .db import Db
from .documents import CamelModel, DocumentData, load_specs

router = APIRouter(prefix="/api/documents", tags=["documents"])

MAX_MESSAGE = 4000
UNTITLED = "Untitled draft"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE)


class DocumentSummary(CamelModel):
    id: int
    title: str
    companies: list[str]
    complete: bool
    updated_at: str


class SavedDocument(DocumentSummary):
    document: DocumentData
    messages: list[ChatMessage]


def _not_found() -> HTTPException:
    return HTTPException(404, "Document not found.")


def _summary(row: sqlite3.Row, document: DocumentData) -> DocumentSummary:
    spec = load_specs().get(document.document_type) if document.document_type else None
    return DocumentSummary(
        id=row["id"],
        title=spec.title if spec else UNTITLED,
        companies=[party.company for party in document.parties if party.company],
        complete=bool(row["complete"]),
        updated_at=row["updated_at"].replace(" ", "T") + "Z",  # SQLite's CURRENT_TIMESTAMP is UTC
    )


def load_document(db: sqlite3.Connection, user: User, document_id: int) -> SavedDocument:
    """The user's document, or 404 — also for other users' documents, so their ids aren't revealed."""
    row = db.execute(
        "SELECT * FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id)
    ).fetchone()
    if row is None:
        raise _not_found()
    document = DocumentData.model_validate_json(row["document"])
    return SavedDocument(
        **_summary(row, document).model_dump(), document=document, messages=json.loads(row["messages"])
    )


def save_document(
    db: sqlite3.Connection,
    user: User,
    document_id: int | None,
    document: DocumentData,
    messages: list[ChatMessage],
    complete: bool,
) -> int:
    """Creates the document when `document_id` is None, otherwise updates it. Returns its id.

    Raises 404 if the document was deleted meanwhile, e.g. while the AI was replying.
    """
    values = (
        document.model_dump_json(by_alias=True),
        json.dumps([message.model_dump() for message in messages]),
        complete,
    )
    if document_id is None:
        return db.execute(
            "INSERT INTO documents (user_id, document, messages, complete) VALUES (?, ?, ?, ?) RETURNING id",
            (user.id, *values),
        ).fetchone()["id"]
    updated = db.execute(
        """
        UPDATE documents SET document = ?, messages = ?, complete = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
        """,
        (*values, document_id, user.id),
    ).rowcount
    if not updated:
        raise _not_found()
    return document_id


@router.get("")
def list_documents(user: Annotated[User, Depends(current_user)], db: Db) -> list[DocumentSummary]:
    # The chat history isn't needed for summaries, so it isn't read.
    rows = db.execute(
        """
        SELECT id, document, complete, updated_at FROM documents
        WHERE user_id = ? ORDER BY updated_at DESC, id DESC
        """,
        (user.id,),
    ).fetchall()
    return [_summary(row, DocumentData.model_validate_json(row["document"])) for row in rows]


@router.get("/{document_id}")
def get_document(
    document_id: int,
    user: Annotated[User, Depends(current_user)],
    db: Db,
) -> SavedDocument:
    return load_document(db, user, document_id)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    user: Annotated[User, Depends(current_user)],
    db: Db,
) -> None:
    deleted = db.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id)).rowcount
    if not deleted:
        raise _not_found()
