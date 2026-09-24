from pathlib import Path
import subprocess

import pytest

from services.ml.app.metrics.languagetool import LocalGrammarError, LocalLanguageTool


def test_local_cli_counts_rule_matches_without_network_or_logging(tmp_path: Path, monkeypatch) -> None:
    jar = tmp_path / "languagetool-commandline.jar"
    jar.write_bytes(b"synthetic-test-jar")
    seen = {}

    def fake_run(args, **kwargs):
        seen["args"] = args
        seen["kwargs"] = kwargs
        seen["text"] = Path(args[-1]).read_text(encoding="utf-8")
        return subprocess.CompletedProcess(
            args, 0,
            "1.) Line 1, column 3, Rule ID: EN_A\n"
            "2.) Line 1, column 8, Rule ID: EN_B\n",
            "",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)
    assert LocalLanguageTool(tmp_path).count_errors("This is is synthetic.") == 2
    assert seen["text"] == "This is is synthetic."
    assert seen["kwargs"]["stdin"] == subprocess.DEVNULL
    assert seen["kwargs"]["timeout"] == 30
    assert not list(tmp_path.glob("m3-grammar-*"))


def test_missing_jar_fails_safely(tmp_path: Path) -> None:
    with pytest.raises(LocalGrammarError, match="unavailable"):
        LocalLanguageTool(tmp_path).count_errors("Synthetic candidate statement")


def test_cli_error_does_not_expose_input_or_stderr(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / "languagetool-commandline.jar").write_bytes(b"synthetic-test-jar")
    monkeypatch.setattr(
        subprocess, "run",
        lambda args, **kwargs: subprocess.CompletedProcess(
            args, 1, "", "private candidate text"
        ),
    )
    with pytest.raises(LocalGrammarError) as captured:
        LocalLanguageTool(tmp_path).count_errors("private candidate text")
    assert "private" not in str(captured.value)


def test_empty_text_skips_java(tmp_path: Path) -> None:
    assert LocalLanguageTool(tmp_path).count_errors("  ") == 0


def test_bundled_languagetool_runs_offline_on_synthetic_text() -> None:
    checker = LocalLanguageTool()
    if not checker._jar.is_file():
        pytest.skip("LanguageTool is bundled in the ML Docker image")
    assert checker.count_errors("This is is a synthetic sentence.") >= 1
