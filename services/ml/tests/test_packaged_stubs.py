import json

from services.ml.scripts.export_stub_data import (
    EXAMPLE_FILES,
    OUTPUT_AUDIO,
    OUTPUT_JSON,
    SOURCE,
    SOURCE_AUDIO,
)


def test_packaged_stub_payloads_match_the_frozen_examples() -> None:
    packaged = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))

    assert set(packaged) == set(EXAMPLE_FILES)
    for filename in EXAMPLE_FILES:
        source = json.loads((SOURCE / filename).read_text(encoding="utf-8"))
        assert packaged[filename] == source


def test_packaged_speech_is_the_synthetic_fixture() -> None:
    assert OUTPUT_AUDIO.read_bytes() == SOURCE_AUDIO.read_bytes()
    assert OUTPUT_AUDIO.stat().st_size > 0
