from app.agents.researcher import _fallback_claims


def test_researcher_recovers_claim_text_without_leaking_json_metadata(monkeypatch):
    raw_output = (
        '{"claims":[{"claim_id":"claim-1",'
        '"text":"TrustRAG retrieves document evidence and can abstain.",'
        '"evidence_ids":["chunk-1"]}'
    )

    claims = _fallback_claims(raw_output, [{"chunk_id": "chunk-1", "text": "Evidence."}])

    assert [claim.text for claim in claims] == [
        "TrustRAG retrieves document evidence and can abstain."
    ]
    assert claims[0].evidence_ids == ["chunk-1"]
    assert "claim_id" not in claims[0].text


def test_plain_fallback_does_not_attach_arbitrary_chunk_ids(monkeypatch):
    claims = _fallback_claims(
        "A plain sentence that lacks a structured evidence reference.",
        [{"chunk_id": "chunk-1", "text": "Evidence."}],
    )

    assert claims[0].evidence_ids == []
