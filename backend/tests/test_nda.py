from app.nda import MAX_TEXT, NdaFields, NdaUpdates, Party, PartyUpdates, merge, missing_fields

NO_PARTY_CHANGE = {"name": None, "title": None, "company": None, "notice_address": None}
NO_CHANGE = {
    "purpose": None,
    "effective_date": None,
    "mnda_term_type": None,
    "mnda_term_years": None,
    "confidentiality_term_type": None,
    "confidentiality_term_years": None,
    "governing_law": None,
    "jurisdiction": None,
    "modifications": None,
    "party1": None,
    "party2": None,
}


def updates(**changes) -> NdaUpdates:
    return NdaUpdates(**{**NO_CHANGE, **changes})


def party_updates(**changes) -> PartyUpdates:
    return PartyUpdates(**{**NO_PARTY_CHANGE, **changes})


def complete_nda() -> NdaFields:
    party = Party(name="Ada", title="CEO", company="Acme", notice_address="ada@acme.com")
    return NdaFields(
        purpose="Evaluate a partnership",
        effective_date="2026-10-17",
        governing_law="Delaware",
        jurisdiction="New Castle, DE",
        parties=(party, party.model_copy(update={"company": "Globex"})),
    )


def test_merge_with_no_changes_keeps_everything():
    nda = complete_nda()
    assert merge(nda, updates()) == nda


def test_merge_applies_and_trims_changes():
    merged = merge(NdaFields(), updates(governing_law=" Delaware ", mnda_term_type="untilTerminated"))

    assert merged.governing_law == "Delaware"
    assert merged.mnda_term_type == "untilTerminated"


def test_merge_updates_only_the_given_party_fields():
    nda = complete_nda()
    merged = merge(nda, updates(party2=party_updates(title="CTO")))

    assert merged.parties[0] == nda.parties[0]
    assert merged.parties[1].title == "CTO"
    assert merged.parties[1].company == "Globex"


def test_merge_ignores_invalid_effective_date():
    merged = merge(complete_nda(), updates(effective_date="next Tuesday"))
    assert merged.effective_date == "2026-10-17"


def test_merge_clamps_term_years():
    merged = merge(NdaFields(), updates(mnda_term_years=0, confidentiality_term_years=500))

    assert merged.mnda_term_years == 1
    assert merged.confidentiality_term_years == 99


def test_missing_fields_lists_every_blank_required_field():
    missing = missing_fields(NdaFields())

    assert "Purpose" in missing
    assert "Effective Date" in missing
    assert "Party 1 company" in missing
    assert "Party 2 notice address" in missing
    assert len(missing) == 12


def test_missing_fields_ignores_optional_modifications():
    assert missing_fields(complete_nda()) == []


def test_whitespace_counts_as_missing():
    nda = complete_nda().model_copy(update={"jurisdiction": "  "})
    assert missing_fields(nda) == ["Jurisdiction"]


def test_fields_use_camel_case_on_the_wire():
    data = NdaFields().model_dump(by_alias=True)

    assert "effectiveDate" in data
    assert "noticeAddress" in data["parties"][0]
    assert NdaFields.model_validate({"governingLaw": "Delaware"}).governing_law == "Delaware"


def test_merge_requires_a_plain_iso_date():
    for value in ("20261018", "2026-W43-1"):
        assert merge(complete_nda(), updates(effective_date=value)).effective_date == "2026-10-17"
    assert merge(complete_nda(), updates(effective_date="2026-10-18")).effective_date == "2026-10-18"


def test_merge_truncates_overlong_ai_text():
    merged = merge(NdaFields(), updates(purpose="x" * (MAX_TEXT + 50)))
    assert len(merged.purpose) == MAX_TEXT
