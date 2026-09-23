import json

from services.ml.scripts.export_stub_data import (
    EXAMPLE_FILES,
    OUTPUT_JSON,
    SOURCE,
)


def test_packaged_stub_payloads_match_the_frozen_examples() -> None:
    packaged = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))

    assert set(packaged) == set(EXAMPLE_FILES)
    for filename in EXAMPLE_FILES:
        source = json.loads((SOURCE / filename).read_text(encoding="utf-8"))
        assert packaged[filename] == source
