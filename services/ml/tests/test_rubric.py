import json
from pathlib import Path

import pytest

from services.ml.app.rubric import RubricConfigurationError, load_drive_rubric


ROOT = Path(__file__).resolve().parents[3]
RUBRIC = ROOT / "config" / "rubric.drive.json"
PACKAGED = ROOT / "services" / "ml" / "stub_data" / "rubric.drive.json"


def test_drive_rubric_is_complete_ordered_and_safe() -> None:
    rubric = load_drive_rubric()

    assert [item.code.value for item in rubric.competencies] == ["D", "R", "I", "V", "E"]
    assert all([level.score for level in item.levels] == [0, 1, 2, 3, 4] for item in rubric.competencies)
    assert rubric.scoring_principles.insufficient_evidence_score is None
    assert rubric.scoring_principles.english_proficiency_affects_scores is False
    assert rubric.scoring_principles.human_decision_required is True
    assert all(item.insufficient_evidence_rule for item in rubric.competencies)
    assert all(item.forbidden_inferences for item in rubric.competencies)
    assert all(item.interview_question_templates for item in rubric.competencies)
    forbidden = " ".join(
        rule.lower()
        for item in rubric.competencies
        for rule in item.forbidden_inferences
    )
    assert "background" in forbidden
    assert "admission" in forbidden
    assert "rank" in forbidden


def test_every_evidence_quote_is_verbatim_and_has_source_metadata() -> None:
    rubric = load_drive_rubric()

    for competency in rubric.competencies:
        for example in competency.evidence_examples:
            assert example.quote in example.source.text
            assert example.source.source_id


@pytest.mark.parametrize("mutation", ["competency", "level", "null_rule"])
def test_required_rubric_parts_cannot_be_removed(tmp_path: Path, mutation: str) -> None:
    payload = json.loads(RUBRIC.read_text(encoding="utf-8"))
    if mutation == "competency":
        payload["competencies"].pop()
    elif mutation == "level":
        payload["competencies"][0]["levels"].pop()
    else:
        del payload["competencies"][0]["insufficient_evidence_rule"]
    path = tmp_path / "rubric.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(RubricConfigurationError):
        load_drive_rubric(path)


def test_service_only_rubric_copy_matches_the_source() -> None:
    assert PACKAGED.read_bytes() == RUBRIC.read_bytes()
