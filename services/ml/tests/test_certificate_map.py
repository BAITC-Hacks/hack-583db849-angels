import json
from pathlib import Path

import pytest

from services.ml.app.metrics.certificate import (
    PACKAGED_MAP,
    ROOT_MAP,
    load_english_map,
    mapped_certificate_cefr,
)
from services.ml.scripts.export_seed import brief


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        ("4.0", "B1"), ("4.5", "B1"), ("5.0", None),
        ("5.5", "B2"), ("6.5", "B2"), ("7.0", "C1"),
        ("7.5", "C1"), ("8.0", None), ("8.5", "C2"),
        ("9.0", "C2"), ("9.5", None),
    ],
)
def test_ielts_overall_band_mapping_and_borderlines(score: str, expected: str | None) -> None:
    assert mapped_certificate_cefr(" IELTS ", score) == expected


@pytest.mark.parametrize("score", ["", "nan", "Infinity", "not a band"])
def test_unknown_or_invalid_certificate_is_not_mapped(score: str) -> None:
    assert mapped_certificate_cefr("IELTS", score) is None
    assert mapped_certificate_cefr("unknown", "6.5") is None


def test_packaged_map_matches_source() -> None:
    assert json.loads(ROOT_MAP.read_text(encoding="utf-8")) == json.loads(
        PACKAGED_MAP.read_text(encoding="utf-8")
    )


def test_malformed_map_fails_closed(tmp_path: Path) -> None:
    path = tmp_path / "english_map.json"
    path.write_text('{"version": 2, "certificates": {}}', encoding="utf-8")
    with pytest.raises(ValueError, match="version or shape"):
        load_english_map(path)


@pytest.mark.parametrize("candidate", ["a", "b", "c"])
def test_seed_brief_generator_preserves_expected_certificate_observation(candidate: str) -> None:
    directory = ROOT_MAP.parents[1] / "seed/candidates" / candidate
    snapshot = json.loads((directory / "snapshot.json").read_text(encoding="utf-8"))
    expected = json.loads((directory / "expected-brief.json").read_text(encoding="utf-8"))
    assert brief(candidate, snapshot)["consistency"] == expected["consistency"]
