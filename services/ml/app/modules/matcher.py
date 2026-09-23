"""Local sentence-embedding matcher used only to steer scenario branches."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Protocol, Sequence

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..gateway.errors import GatewayConfigurationError
from ..schemas.contracts import AnswerType, Beat, ScenarioConfig


ROOT_MODEL_CONFIG = Path(__file__).resolve().parents[4] / "config" / "embedding-model.json"
PACKAGED_MODEL_CONFIG = (
    Path(__file__).resolve().parents[2] / "stub_data" / "embedding-model.json"
)
DEFAULT_MODEL_CONFIG = (
    ROOT_MODEL_CONFIG if ROOT_MODEL_CONFIG.is_file() else PACKAGED_MODEL_CONFIG
)
DEFAULT_MODEL_PATH = Path("/opt/models/all-MiniLM-L6-v2")


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class EmbeddingModelConfiguration(_StrictModel):
    model_id: str = Field(min_length=1)
    revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    license: str = Field(pattern=r"^apache-2\.0$")
    onnx_file: str = Field(pattern=r"^onnx/[A-Za-z0-9._-]+\.onnx$")
    onnx_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    dimensions: int = Field(gt=0)
    max_sequence_length: int = Field(gt=0)


class SentenceEncoder(Protocol):
    def encode(self, texts: Sequence[str]) -> list[list[float]]: ...


class OnnxSentenceEncoder:
    def __init__(
        self,
        model_path: Path,
        configuration: EmbeddingModelConfiguration,
    ) -> None:
        marker = model_path / ".revision"
        try:
            installed_revision = marker.read_text(encoding="utf-8").strip()
        except OSError as error:
            raise GatewayConfigurationError(
                "local embedding model is unavailable"
            ) from error
        if installed_revision != configuration.revision:
            raise GatewayConfigurationError("local embedding model revision mismatch")
        try:
            digest = _sha256(model_path / configuration.onnx_file)
        except OSError as error:
            raise GatewayConfigurationError(
                "local embedding model is unavailable"
            ) from error
        if digest != configuration.onnx_sha256:
            raise GatewayConfigurationError("local embedding model checksum mismatch")

        try:
            import numpy as np
            import onnxruntime as ort
            from tokenizers import Tokenizer

            self._numpy = np
            self._tokenizer = Tokenizer.from_file(str(model_path / "tokenizer.json"))
            self._tokenizer.enable_truncation(configuration.max_sequence_length)
            self._tokenizer.enable_padding(pad_id=0, pad_token="[PAD]")
            self._session = ort.InferenceSession(
                str(model_path / configuration.onnx_file),
                providers=["CPUExecutionProvider"],
            )
        except Exception as error:
            raise GatewayConfigurationError(
                "local embedding model could not be loaded"
            ) from error
        self._dimensions = configuration.dimensions

    def encode(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        encoded = self._tokenizer.encode_batch(list(texts))
        arrays = {
            "input_ids": self._numpy.asarray(
                [item.ids for item in encoded], dtype=self._numpy.int64
            ),
            "attention_mask": self._numpy.asarray(
                [item.attention_mask for item in encoded], dtype=self._numpy.int64
            ),
            "token_type_ids": self._numpy.asarray(
                [item.type_ids for item in encoded], dtype=self._numpy.int64
            ),
        }
        inputs = {
            item.name: arrays[item.name]
            for item in self._session.get_inputs()
            if item.name in arrays
        }
        try:
            hidden = self._session.run(None, inputs)[0]
        except Exception as error:
            raise GatewayConfigurationError("embedding inference failed") from error
        mask = arrays["attention_mask"][..., self._numpy.newaxis].astype(
            self._numpy.float32
        )
        embeddings = (hidden * mask).sum(axis=1) / self._numpy.clip(
            mask.sum(axis=1), 1e-9, None
        )
        embeddings /= self._numpy.clip(
            self._numpy.linalg.norm(embeddings, axis=1, keepdims=True),
            1e-12,
            None,
        )
        result = embeddings.tolist()
        if any(len(vector) != self._dimensions for vector in result):
            raise GatewayConfigurationError("embedding dimensions do not match config")
        return result


@dataclass(frozen=True)
class MatchResult:
    answer_type: AnswerType
    similarity: float
    used_fallback: bool


class ScenarioMatcher:
    def __init__(self, encoder: SentenceEncoder) -> None:
        self._encoder = encoder
        self._examples: dict[
            tuple[str, str], tuple[list[AnswerType], list[list[float]]]
        ] = {}

    def match(
        self, scenario: ScenarioConfig, beat_id: str, candidate_text: str
    ) -> MatchResult:
        beat = _beat(scenario, beat_id)
        answer_types, example_embeddings = self._example_embeddings(scenario, beat)
        candidate_embeddings = self._encoder.encode([candidate_text])
        if len(candidate_embeddings) != 1:
            raise GatewayConfigurationError("encoder returned an invalid candidate batch")
        candidate = candidate_embeddings[0]
        if not example_embeddings:
            raise GatewayConfigurationError("beat has no matcher examples")

        best_index = 0
        best_similarity = _cosine(candidate, example_embeddings[0])
        for index, example in enumerate(example_embeddings[1:], start=1):
            similarity = _cosine(candidate, example)
            if similarity > best_similarity:
                best_index = index
                best_similarity = similarity
        if best_similarity < scenario.matchThreshold:
            return MatchResult(
                answer_type=beat.fallback,
                similarity=best_similarity,
                used_fallback=True,
            )
        return MatchResult(
            answer_type=answer_types[best_index],
            similarity=best_similarity,
            used_fallback=False,
        )

    def _example_embeddings(
        self, scenario: ScenarioConfig, beat: Beat
    ) -> tuple[list[AnswerType], list[list[float]]]:
        key = (scenario.scenarioId, beat.beatId)
        cached = self._examples.get(key)
        if cached is not None:
            return cached
        answer_types: list[AnswerType] = []
        phrases: list[str] = []
        for answer_type in beat.answerTypes:
            for phrase in answer_type.examples:
                answer_types.append(answer_type)
                phrases.append(phrase)
        embeddings = self._encoder.encode(phrases)
        if len(embeddings) != len(phrases):
            raise GatewayConfigurationError("encoder returned an invalid example batch")
        cached = (answer_types, embeddings)
        self._examples[key] = cached
        return cached


class LazyLocalMatcher:
    """Delay ONNX loading so health and OpenAPI do not initialize the model."""

    def __init__(self) -> None:
        self._matcher: ScenarioMatcher | None = None

    def match(
        self, scenario: ScenarioConfig, beat_id: str, candidate_text: str
    ) -> MatchResult:
        if self._matcher is None:
            self._matcher = create_local_matcher()
        return self._matcher.match(scenario, beat_id, candidate_text)


def load_embedding_configuration(
    path: Path = DEFAULT_MODEL_CONFIG,
) -> EmbeddingModelConfiguration:
    try:
        return EmbeddingModelConfiguration.model_validate_json(
            path.read_text(encoding="utf-8")
        )
    except (OSError, ValidationError, json.JSONDecodeError) as error:
        raise GatewayConfigurationError("embedding model config is invalid") from error


def create_local_matcher(
    *,
    model_path: Path | None = None,
    configuration_path: Path = DEFAULT_MODEL_CONFIG,
) -> ScenarioMatcher:
    configuration = load_embedding_configuration(configuration_path)
    resolved_path = model_path or Path(
        os.environ.get("M2_EMBEDDING_MODEL_PATH", DEFAULT_MODEL_PATH)
    )
    return ScenarioMatcher(OnnxSentenceEncoder(resolved_path, configuration))


def _beat(scenario: ScenarioConfig, beat_id: str) -> Beat:
    for beat in scenario.beats:
        if beat.beatId == beat_id:
            return beat
    raise GatewayConfigurationError("scenario beat is unavailable")


def _cosine(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right) or not left:
        raise GatewayConfigurationError("embedding vectors have invalid dimensions")
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        raise GatewayConfigurationError("embedding vector has zero magnitude")
    similarity = sum(a * b for a, b in zip(left, right, strict=True)) / (
        left_norm * right_norm
    )
    return max(-1.0, min(1.0, similarity))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as artifact:
        for chunk in iter(lambda: artifact.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
