"""Offline LanguageTool CLI adapter; candidate text never leaves this process."""

from __future__ import annotations

import os
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory


_RULE = re.compile(r"\bRule ID:\s*\S+")


class LocalGrammarError(RuntimeError):
    """Safe failure that never includes candidate text or CLI output."""


class LocalLanguageTool:
    def __init__(self, directory: Path | None = None) -> None:
        self._directory = directory or Path(
            os.environ.get("M3_LANGUAGETOOL_DIR", "/opt/languagetool/LanguageTool-6.6")
        )
        self._jar = self._directory / "languagetool-commandline.jar"

    def count_errors(self, text: str) -> int:
        if not text.strip():
            return 0
        if not self._jar.is_file():
            raise LocalGrammarError("local grammar checker is unavailable")
        with TemporaryDirectory(prefix="m3-grammar-") as temporary:
            input_file = Path(temporary) / "input.txt"
            input_file.write_text(text, encoding="utf-8")
            try:
                result = subprocess.run(
                    [
                        "java", "-Xmx512m", "-jar", str(self._jar),
                        "-l", "en-US", "-c", "UTF-8", str(input_file),
                    ],
                    cwd=self._directory,
                    stdin=subprocess.DEVNULL,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=30,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired) as error:
                raise LocalGrammarError("local grammar checker failed") from error
        if result.returncode != 0:
            raise LocalGrammarError("local grammar checker failed")
        return len(_RULE.findall(result.stdout))
