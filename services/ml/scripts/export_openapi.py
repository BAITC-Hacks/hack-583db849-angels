"""Deterministically export OpenAPI from the FastAPI application."""

from __future__ import annotations

import json
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.main import create_app  # noqa: E402


OUTPUT = ROOT / "services" / "ml" / "openapi.json"


def openapi_document() -> dict[str, Any]:
    return create_app().openapi()


def serialized_openapi() -> str:
    return json.dumps(openapi_document(), indent=2) + "\n"


def export_openapi(output: Path = OUTPUT) -> None:
    output.write_text(serialized_openapi(), encoding="utf-8")


if __name__ == "__main__":
    export_openapi()
