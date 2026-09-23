import json
import math
from pathlib import Path
from typing import Sequence

import pytest

from services.ml.app.gateway.errors import GatewayConfigurationError
from services.ml.app.modules.matcher import (
    PACKAGED_MODEL_CONFIG,
    ROOT_MODEL_CONFIG,
    ScenarioMatcher,
    OnnxSentenceEncoder,
    load_embedding_configuration,
)
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository


class ExactPhraseEncoder:
    def __init__(self, phrases: list[str]) -> None:
        self._positions = {phrase: index for index, phrase in enumerate(phrases)}
        self._dimensions = len(phrases)
        self.batches: list[list[str]] = []

    def encode(self, texts: Sequence[str]) -> list[list[float]]:
        self.batches.append(list(texts))
        vectors: list[list[float]] = []
        for text in texts:
            if text in self._positions:
                vector = [0.0] * self._dimensions
                vector[self._positions[text]] = 1.0
            else:
                value = -1 / math.sqrt(self._dimensions)
                vector = [value] * self._dimensions
            vectors.append(vector)
        return vectors


def scenario_and_phrases():
    scenario = ScenarioRepository.load(ROOT_SCENARIOS).get("conflict-resolution")
    assert scenario is not None
    phrases = [
        phrase
        for beat in scenario.beats
        for answer_type in beat.answerTypes
        for phrase in answer_type.examples
    ]
    return scenario, phrases


def test_every_example_phrase_matches_its_own_answer_type() -> None:
    scenario, phrases = scenario_and_phrases()
    matcher = ScenarioMatcher(ExactPhraseEncoder(phrases))

    for beat in scenario.beats:
        for answer_type in beat.answerTypes:
            for phrase in answer_type.examples:
                result = matcher.match(scenario, beat.beatId, phrase)
                assert result.answer_type.answerTypeId == answer_type.answerTypeId
                assert result.similarity == pytest.approx(1)
                assert result.used_fallback is False


def test_below_threshold_text_uses_the_current_beat_fallback() -> None:
    scenario, phrases = scenario_and_phrases()
    matcher = ScenarioMatcher(ExactPhraseEncoder(phrases))

    result = matcher.match(scenario, "opening", "Unrelated synthetic response")

    assert result.answer_type.answerTypeId == "other"
    assert result.similarity < scenario.matchThreshold
    assert result.used_fallback is True


def test_repeated_input_has_a_deterministic_result() -> None:
    scenario, phrases = scenario_and_phrases()
    matcher = ScenarioMatcher(ExactPhraseEncoder(phrases))

    first = matcher.match(scenario, "opening", phrases[0])
    second = matcher.match(scenario, "opening", phrases[0])

    assert second == first


def test_examples_are_embedded_once_per_beat() -> None:
    scenario, phrases = scenario_and_phrases()
    encoder = ExactPhraseEncoder(phrases)
    matcher = ScenarioMatcher(encoder)

    matcher.match(scenario, "opening", phrases[0])
    matcher.match(scenario, "opening", phrases[1])

    assert len(encoder.batches) == 3
    assert len(encoder.batches[0]) == sum(
        len(answer.examples) for answer in scenario.beats[0].answerTypes
    )


def test_matcher_uses_only_the_current_beat() -> None:
    scenario, phrases = scenario_and_phrases()
    matcher = ScenarioMatcher(ExactPhraseEncoder(phrases))
    decision_phrase = scenario.beats[3].answerTypes[0].examples[0]

    result = matcher.match(scenario, "opening", decision_phrase)

    assert result.answer_type.answerTypeId == "other"


def test_embedding_configuration_is_pinned_and_packaged() -> None:
    root = json.loads(ROOT_MODEL_CONFIG.read_text(encoding="utf-8"))
    packaged = json.loads(PACKAGED_MODEL_CONFIG.read_text(encoding="utf-8"))
    configuration = load_embedding_configuration()

    assert packaged == root
    assert configuration.revision == "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
    assert configuration.license == "apache-2.0"
    assert configuration.dimensions == 384
    assert configuration.onnx_sha256 == (
        "6fd5d72fe4589f189f8ebc006442dbb529bb7ce38f8082112682524616046452"
    )


def test_local_encoder_refuses_a_missing_or_wrong_revision(tmp_path: Path) -> None:
    configuration = load_embedding_configuration()
    with pytest.raises(GatewayConfigurationError, match="unavailable"):
        OnnxSentenceEncoder(tmp_path / "missing", configuration)

    model = tmp_path / "model"
    model.mkdir()
    (model / ".revision").write_text("wrong\n", encoding="utf-8")
    with pytest.raises(GatewayConfigurationError, match="revision mismatch"):
        OnnxSentenceEncoder(model, configuration)

    (model / ".revision").write_text(configuration.revision + "\n", encoding="utf-8")
    with pytest.raises(GatewayConfigurationError, match="unavailable"):
        OnnxSentenceEncoder(model, configuration)
