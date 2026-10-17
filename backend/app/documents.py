"""Supported documents, loaded from documents.json and catalog.json, and how AI updates are applied to them."""

import json
import os
import re
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2]
MAX_TEXT = 2000  # bounds request size, since the document is sent to the model each turn

Text = Annotated[str, Field(max_length=MAX_TEXT)]


class CamelModel(BaseModel):
    """Uses camelCase on the wire to match the frontend's TypeScript types."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# Specs, as defined in documents.json.


class FieldSpec(CamelModel):
    key: str
    label: str
    description: str
    kind: Literal["text", "long", "date"] = "text"
    required: bool = False
    default: str = ""


class DocumentSpec(CamelModel):
    id: str
    filename: str
    title: str
    description: str = ""  # from catalog.json
    parties: tuple[str, str]
    fields: list[FieldSpec]

    def field(self, key: str) -> FieldSpec | None:
        return next((field for field in self.fields if field.key == key), None)


def data_dir() -> Path:
    return Path(os.environ.get("PRELEGAL_DATA_DIR", DEFAULT_DATA_DIR))


@lru_cache
def load_specs() -> dict[str, DocumentSpec]:
    root = data_dir()
    catalog = json.loads((root / "catalog.json").read_text(encoding="utf-8"))
    descriptions = {entry["filename"]: entry["description"] for entry in catalog["templates"]}
    documents = json.loads((root / "documents.json").read_text(encoding="utf-8"))["documents"]
    specs = [DocumentSpec(**doc, description=descriptions[doc["filename"]]) for doc in documents]
    return {spec.id: spec for spec in specs}


# The document being drafted, as sent between frontend and backend.


class Party(CamelModel):
    name: Text = ""
    title: Text = ""
    company: Text = ""
    notice_address: Text = ""


class DocumentData(CamelModel):
    document_type: str | None = None
    values: dict[str, Text] = Field(default_factory=dict, max_length=50)
    parties: tuple[Party, Party] = Field(default_factory=lambda: (Party(), Party()))

    @field_validator("document_type")
    @classmethod
    def _known_type(cls, value: str | None) -> str | None:
        if value is not None and value not in load_specs():
            raise ValueError(f"unknown document type: {value}")
        return value

    @model_validator(mode="after")
    def _only_spec_fields(self) -> "DocumentData":
        """Drops values that aren't fields of the document, so they never reach the prompt."""
        spec = load_specs().get(self.document_type) if self.document_type else None
        keys = {field.key for field in spec.fields} if spec else set()
        self.values = {key: value for key, value in self.values.items() if key in keys}
        return self


def new_document(document_type: str, parties: tuple[Party, Party] | None = None) -> DocumentData:
    spec = load_specs()[document_type]
    return DocumentData(
        document_type=document_type,
        values={field.key: field.default for field in spec.fields},
        parties=parties or (Party(), Party()),
    )


# Structured output from the AI. Every field is required but nullable, as
# Structured Outputs needs; null means "no change".


class PartyUpdates(BaseModel):
    name: str | None = Field(description="Signatory's full name")
    title: str | None = Field(description="Signatory's job title")
    company: str | None = Field(description="Company (legal entity) name")
    notice_address: str | None = Field(description="Email or postal address for legal notices")


class FieldUpdate(BaseModel):
    key: str = Field(description="A field key of the current document")
    value: str


class DocumentUpdates(BaseModel):
    document_type: str | None = Field(
        description="Set to a supported document id to start drafting it; null to keep the current document"
    )
    field_updates: list[FieldUpdate] = Field(description="Field values learned from the user's latest message")
    party1: PartyUpdates | None
    party2: PartyUpdates | None


def _is_iso_date(value: str) -> bool:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False  # fromisoformat also accepts forms like 20260101 and 2026-W01-1
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def _clean_text(value: str) -> str:
    return value.strip()[:MAX_TEXT]


def _merge_party(party: Party, updates: PartyUpdates | None) -> Party:
    if updates is None:
        return party
    changes = {key: _clean_text(value) for key, value in updates.model_dump().items() if value is not None}
    return party.model_copy(update=changes)


def merge(data: DocumentData, updates: DocumentUpdates) -> DocumentData:
    """Applies the AI's updates, ignoring anything that would make the document invalid.

    Choosing a different document type starts that document afresh; parties
    given before any type was chosen are kept.
    """
    specs = load_specs()
    if updates.document_type in specs and updates.document_type != data.document_type:
        data = new_document(updates.document_type, data.parties if data.document_type is None else None)

    values = dict(data.values)
    spec = specs.get(data.document_type) if data.document_type else None
    for update in updates.field_updates if spec else []:
        field = spec.field(update.key)
        value = _clean_text(update.value)
        if field is None or (field.kind == "date" and not _is_iso_date(value)):
            continue
        values[field.key] = value

    parties = (_merge_party(data.parties[0], updates.party1), _merge_party(data.parties[1], updates.party2))
    return data.model_copy(update={"values": values, "parties": parties})


PARTY_FIELD_LABELS = {
    "company": "company",
    "name": "signatory name",
    "title": "signatory title",
    "notice_address": "notice address",
}


def missing_fields(data: DocumentData) -> list[str]:
    """Labels of the required fields that are still blank."""
    if data.document_type is None:
        return ["Document type"]
    spec = load_specs()[data.document_type]
    missing = [field.label for field in spec.fields if field.required and not data.values.get(field.key, "").strip()]
    for role, party in zip(spec.parties, data.parties):
        missing += [f"{role} {label}" for key, label in PARTY_FIELD_LABELS.items() if not getattr(party, key).strip()]
    return missing
