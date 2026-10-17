"""Mutual NDA fields, mirroring frontend/lib/nda.ts, and how AI updates are applied to them."""

import re
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

MIN_YEARS = 1
MAX_YEARS = 99
MAX_TEXT = 2000  # bounds request size, since the fields are sent to the model each turn

Text = Annotated[str, Field(max_length=MAX_TEXT)]


class CamelModel(BaseModel):
    """Uses camelCase on the wire to match the frontend's TypeScript types."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Party(CamelModel):
    name: Text = ""
    title: Text = ""
    company: Text = ""
    notice_address: Text = ""


class NdaFields(CamelModel):
    purpose: Text = ""
    effective_date: Text = ""  # ISO yyyy-mm-dd
    mnda_term_type: Literal["expires", "untilTerminated"] = "expires"
    mnda_term_years: int = Field(1, ge=MIN_YEARS, le=MAX_YEARS)
    confidentiality_term_type: Literal["years", "perpetual"] = "years"
    confidentiality_term_years: int = Field(1, ge=MIN_YEARS, le=MAX_YEARS)
    governing_law: Text = ""
    jurisdiction: Text = ""
    modifications: Text = ""
    parties: tuple[Party, Party] = Field(default_factory=lambda: (Party(), Party()))


# Structured output from the AI. Every field is required but nullable, as
# Structured Outputs needs; null means "no change".


class PartyUpdates(BaseModel):
    name: str | None = Field(description="Signatory's full name")
    title: str | None = Field(description="Signatory's job title")
    company: str | None = Field(description="Company (legal entity) name")
    notice_address: str | None = Field(description="Email or postal address for legal notices")


class NdaUpdates(BaseModel):
    purpose: str | None = Field(description="How Confidential Information may be used")
    effective_date: str | None = Field(description="ISO date, yyyy-mm-dd")
    mnda_term_type: Literal["expires", "untilTerminated"] | None
    mnda_term_years: int | None = Field(description="Years until the MNDA expires, 1-99")
    confidentiality_term_type: Literal["years", "perpetual"] | None
    confidentiality_term_years: int | None = Field(description="Years Confidential Information is protected, 1-99")
    governing_law: str | None = Field(description="US state whose law governs, e.g. Delaware")
    jurisdiction: str | None = Field(description="City/county and state for disputes, e.g. New Castle, DE")
    modifications: str | None = Field(description="Any modifications to the standard terms")
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


def _clamp_years(years: int) -> int:
    return min(MAX_YEARS, max(MIN_YEARS, years))


def _clean_text(value: str) -> str:
    return value.strip()[:MAX_TEXT]


def _merge_party(party: Party, updates: PartyUpdates | None) -> Party:
    if updates is None:
        return party
    changes = {key: _clean_text(value) for key, value in updates.model_dump().items() if value is not None}
    return party.model_copy(update=changes)


def merge(nda: NdaFields, updates: NdaUpdates) -> NdaFields:
    """Applies the non-null updates, ignoring values that would make the document invalid."""
    changes = {
        key: _clean_text(value) if isinstance(value, str) else value
        for key, value in updates.model_dump(exclude={"party1", "party2"}).items()
        if value is not None
    }
    if "effective_date" in changes and not _is_iso_date(changes["effective_date"]):
        del changes["effective_date"]
    for key in ("mnda_term_years", "confidentiality_term_years"):
        if key in changes:
            changes[key] = _clamp_years(changes[key])
    changes["parties"] = (
        _merge_party(nda.parties[0], updates.party1),
        _merge_party(nda.parties[1], updates.party2),
    )
    return nda.model_copy(update=changes)


REQUIRED_FIELDS = {
    "purpose": "Purpose",
    "effective_date": "Effective Date",
    "governing_law": "Governing Law",
    "jurisdiction": "Jurisdiction",
}
REQUIRED_PARTY_FIELDS = {
    "company": "company",
    "name": "signatory name",
    "title": "signatory title",
    "notice_address": "notice address",
}


def missing_fields(nda: NdaFields) -> list[str]:
    """Labels of the required fields that are still blank. The term fields always have a value."""
    missing = [label for key, label in REQUIRED_FIELDS.items() if not getattr(nda, key).strip()]
    for number, party in enumerate(nda.parties, start=1):
        missing += [
            f"Party {number} {label}" for key, label in REQUIRED_PARTY_FIELDS.items() if not getattr(party, key).strip()
        ]
    return missing
