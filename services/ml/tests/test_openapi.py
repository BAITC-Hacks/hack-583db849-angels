from services.ml.app.main import create_app
from services.ml.scripts.export_openapi import OUTPUT, serialized_openapi


EXPECTED_PATHS = {
    "/internal/v1/health",
    "/internal/v1/scenarios",
    "/internal/v1/scenarios/{scenarioId}",
    "/internal/v1/simulation/turn",
    "/internal/v1/simulation/assessment",
    "/internal/v1/brief",
    "/internal/v1/transcribe",
    "/internal/v1/speech",
    "/internal/v1/consistency",
    "/internal/v1/surprise-question",
    "/internal/v1/usage",
    "/internal/v1/interview/draft",
}


def test_committed_openapi_matches_the_application_export() -> None:
    assert OUTPUT.read_text(encoding="utf-8") == serialized_openapi(), (
        "services/ml/openapi.json has drifted; run "
        "services/ml/scripts/export_openapi.py and commit the result"
    )


def test_openapi_contains_every_current_typed_operation() -> None:
    paths = create_app().openapi()["paths"]

    assert set(paths) == EXPECTED_PATHS


def test_only_health_is_public_in_openapi() -> None:
    paths = create_app().openapi()["paths"]

    assert "security" not in paths["/internal/v1/health"]["get"]
    for path, operations in paths.items():
        if path == "/internal/v1/health":
            continue
        for operation in operations.values():
            assert operation["security"] == [{"APIKeyHeader": []}]


def test_speech_is_documented_as_mpeg_audio() -> None:
    operation = create_app().openapi()["paths"]["/internal/v1/speech"]["post"]

    assert set(operation["responses"]["200"]["content"]) == {"audio/mpeg"}
