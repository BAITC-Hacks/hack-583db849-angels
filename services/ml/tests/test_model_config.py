import copy
import json
from pathlib import Path

import pytest

from services.ml.app.gateway.config import (
    DEFAULT_MODELS_PATH,
    ModelConfigurationError,
    ModelsConfiguration,
    Provider,
    TaskName,
    load_models_configuration,
)


def raw_configuration() -> dict:
    return json.loads(DEFAULT_MODELS_PATH.read_text(encoding="utf-8"))


def write_configuration(tmp_path: Path, payload: dict) -> Path:
    path = tmp_path / "models.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_checked_in_configuration_covers_every_gateway_task() -> None:
    configuration = load_models_configuration()

    assert set(configuration.tasks) == set(TaskName)
    assert configuration.tasks[TaskName.SIMULATION_ACTOR].max_tokens == 180
    assert configuration.tasks[TaskName.TRANSCRIPTION].provider is Provider.DEEPGRAM
    assert all(task.max_tokens > 0 for task in configuration.tasks.values())
    assert all(
        task.request_cost_limit_usd > 0 for task in configuration.tasks.values()
    )
    assert all(task.cache_ttl_seconds > 0 for task in configuration.tasks.values())


def test_replay_configuration_loads_without_provider_keys(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("DEEPGRAM_API_KEY", raising=False)

    assert load_models_configuration().tasks[TaskName.BRIEF].provider is Provider.OPENAI


@pytest.mark.parametrize(
    ("mutation", "expected"),
    [
        (
            lambda data: data["tasks"].pop("brief"),
            "invalid models configuration",
        ),
        (
            lambda data: data["tasks"]["brief"].update({"max_tokens": 0}),
            "invalid models configuration",
        ),
        (
            lambda data: data["tasks"]["brief"].update(
                {"request_cost_limit_usd": -1}
            ),
            "invalid models configuration",
        ),
        (
            lambda data: data["tasks"]["brief"].update({"cache_ttl_seconds": -1}),
            "invalid models configuration",
        ),
        (
            lambda data: data["tasks"]["brief"].update({"model": "unknown"}),
            "invalid models configuration",
        ),
        (
            lambda data: data["tasks"]["brief"].update({"unexpected": True}),
            "invalid models configuration",
        ),
    ],
)
def test_invalid_task_configuration_is_rejected(
    tmp_path: Path,
    mutation,
    expected: str,
) -> None:
    payload = copy.deepcopy(raw_configuration())
    mutation(payload)

    with pytest.raises(ModelConfigurationError, match=expected):
        load_models_configuration(write_configuration(tmp_path, payload))


def test_duplicate_json_keys_are_rejected(tmp_path: Path) -> None:
    path = tmp_path / "models.json"
    path.write_text('{"version": 1, "version": 1}', encoding="utf-8")

    with pytest.raises(ModelConfigurationError, match="duplicate key"):
        load_models_configuration(path)


def test_provider_mismatch_is_rejected(tmp_path: Path) -> None:
    payload = raw_configuration()
    payload["tasks"]["speech"]["provider"] = "openai"

    with pytest.raises(ModelConfigurationError, match="invalid models configuration"):
        load_models_configuration(write_configuration(tmp_path, payload))


def test_models_configuration_forbids_unknown_top_level_fields() -> None:
    payload = raw_configuration()
    payload["secret"] = "must never be configurable here"

    with pytest.raises(ValueError):
        ModelsConfiguration.model_validate(payload)
