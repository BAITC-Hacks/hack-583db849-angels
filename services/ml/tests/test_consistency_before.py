import json
from pathlib import Path

from services.ml.app.evidence import candidate_view_sources, verify_evidence
from services.ml.app.modules.consistency import assemble_before_consistency, before_consistency
from services.ml.app.schemas.contracts import BriefRequest, BriefResult


ROOT = Path(__file__).resolve().parents[3]
EXAMPLE = ROOT / "docs/contracts/examples/candidate-a/ml/brief.request.json"


def request() -> BriefRequest:
    return BriefRequest.model_validate(json.loads(EXAMPLE.read_text(encoding="utf-8")))


def test_a_claimed_c2_is_compared_with_actual_b2_metric() -> None:
    source = request()
    items = before_consistency(source)
    assert len(items) == 1
    item = items[0]
    assert item.status == "discrepancy"
    assert item.observation.metric is not None
    assert item.observation.metric.name == "cefrEstimate"
    assert item.observation.metric.value == "B2"
    assert item.observation.metric.source == "simulation"
    assert item.askInInterview
    evidence = item.claim.evidence
    assert verify_evidence(evidence, candidate_view_sources(source.candidate))[0] == evidence


def test_missing_simulation_does_not_invent_a_measurement() -> None:
    source = request().model_copy(update={"simulationEnglish": None})
    item = before_consistency(source)[0]
    assert item.status == "unverified"
    assert item.observation.metric is None
    assert "No simulation English estimate" in item.observation.text
    assert "IELTS overall band indicatively maps to B2" in item.observation.text
    assert "has not been verified" in item.observation.text


def test_certificate_mapping_is_described_as_unverified_and_not_interview_metric() -> None:
    source = request()
    item = before_consistency(source)[0]
    assert "IELTS overall band indicatively maps to B2" in item.observation.text
    assert "has not been verified" in item.observation.text
    assert item.observation.metric.source == "simulation"
    source.candidate.englishCertificate.score = "8.0"
    assert "indicatively maps" not in before_consistency(source)[0].observation.text


def test_matching_measurement_is_consistent() -> None:
    source = request()
    assert source.simulationEnglish is not None
    source.simulationEnglish.cefrEstimate = "C2"
    assert before_consistency(source)[0].status == "consistent"


def test_no_explicit_self_rating_does_not_invent_one() -> None:
    source = request()
    source.candidate.application.answers[-1].answer = "I can read technical texts."
    assert before_consistency(source) == []


def test_ambiguous_self_rating_does_not_pick_one() -> None:
    source = request()
    source.candidate.application.answers[-1].answer = "I was B2; now I think C2."
    assert before_consistency(source) == []


def test_self_rating_can_be_found_by_question_not_only_seed_field_id() -> None:
    source = request()
    source.candidate.application.answers[-1].fieldId = "language_level"
    assert before_consistency(source)[0].claim.evidence[0].sourceId == "language_level"


def test_shared_before_assembler_preserves_grounded_non_english_items() -> None:
    source = request()
    proposed = BriefResult.model_validate(json.loads(
        EXAMPLE.with_name("brief.response.json").read_text(encoding="utf-8")
    ))
    sources = candidate_view_sources(source.candidate)

    def checked(evidence):
        return verify_evidence(evidence, sources)[0]

    first = assemble_before_consistency(source, proposed.consistency, checked)
    second = assemble_before_consistency(source, proposed.consistency, checked)

    assert first == second
    assert [item.itemId for item in first] == ["c_01", "c_02", "c_03"]
    assert first[0].status == "discrepancy"
    assert first[1].topic == "other"
    assert first[1].status == "unverified"
    assert first[1].claim.evidence[0].sourceId == "motivation"
    assert first[2].topic == "invision_knowledge"


def test_shared_before_assembler_drops_unsupported_non_english_claim() -> None:
    source = request()
    proposed = BriefResult.model_validate(json.loads(
        EXAMPLE.with_name("brief.response.json").read_text(encoding="utf-8")
    ))
    proposed.consistency[1].claim.evidence[0].quote = "Invented application claim"
    sources = candidate_view_sources(source.candidate)

    def checked(evidence):
        return verify_evidence(evidence, sources)[0]

    items = assemble_before_consistency(source, proposed.consistency, checked)
    assert [item.itemId for item in items] == ["c_01", "c_02"]
    assert items[1].topic == "invision_knowledge"
