import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / "seed" / "candidates"
CONTRACT_A = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "snapshot.json"


def load(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_snapshot(snapshot: dict[str, object]) -> None:
    assert set(snapshot) == {
        "externalId",
        "profile",
        "application",
        "test",
        "englishCertificate",
    }
    assert isinstance(snapshot["externalId"], str)

    profile = snapshot["profile"]
    assert isinstance(profile, dict)
    assert set(profile) == {
        "fullName",
        "email",
        "phone",
        "iin",
        "gender",
        "region",
        "school",
        "familyIncome",
        "photoUrl",
    }
    assert "synthetic" in str(profile["fullName"]).lower()
    assert str(profile["email"]).endswith("@example.test")
    assert str(profile["phone"]).startswith("+7 000")
    assert str(profile["iin"]).startswith("00000000000")
    assert profile["photoUrl"] is None

    application = snapshot["application"]
    assert isinstance(application, dict)
    assert set(application) == {"answers"}
    application_answers = application["answers"]
    assert isinstance(application_answers, list) and application_answers
    for answer in application_answers:
        assert set(answer) == {"fieldId", "question", "answer"}
        assert all(isinstance(value, str) and value for value in answer.values())

    test = snapshot["test"]
    assert isinstance(test, dict)
    assert set(test) == {"answers"}
    test_answers = test["answers"]
    assert isinstance(test_answers, list) and test_answers
    for answer in test_answers:
        assert set(answer) == {"itemId", "response"}
        assert all(isinstance(value, str) and value for value in answer.values())

    certificate = snapshot["englishCertificate"]
    if certificate is not None:
        assert isinstance(certificate, dict)
        assert set(certificate) == {"type", "score"}
        assert all(isinstance(value, str) and value for value in certificate.values())


def test_candidate_a_snapshot_is_the_frozen_contract_example() -> None:
    assert load(SEED / "a" / "snapshot.json") == load(CONTRACT_A)


def test_all_candidate_snapshots_have_the_public_shape_and_synthetic_profiles() -> None:
    snapshots = [load(SEED / label / "snapshot.json") for label in ("a", "b", "c")]

    for snapshot in snapshots:
        validate_snapshot(snapshot)

    assert len({snapshot["externalId"] for snapshot in snapshots}) == 3
    assert len({snapshot["profile"]["iin"] for snapshot in snapshots}) == 3
