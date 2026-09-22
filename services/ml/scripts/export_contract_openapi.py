"""Export OpenAPI from the application code."""

from __future__ import annotations

import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.main import create_app  # noqa: E402


OUTPUT = ROOT / "services" / "ml" / "openapi.json"
build_app = create_app


if __name__ == "__main__":
    OUTPUT.write_text(json.dumps(create_app().openapi(), indent=2) + "\n", encoding="utf-8")
