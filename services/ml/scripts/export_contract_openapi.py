"""Export the agreed F0 ML contract without duplicating its Pydantic models."""

import json
import re
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, ConfigDict


ROOT = Path(__file__).resolve().parents[3]
CONTRACT = ROOT / "docs" / "contracts" / "ml.md"
OUTPUT = ROOT / "services" / "ml" / "openapi.json"


def load_models() -> dict[str, Any]:
    markdown = CONTRACT.read_text(encoding="utf-8")
    match = re.search(r"## Models\s+```python\s+(.*?)\s+```", markdown, re.DOTALL)
    if match is None:
        raise RuntimeError("The Python models block is missing from docs/contracts/ml.md")
    namespace: dict[str, Any] = {}
    exec(compile(match.group(1), str(CONTRACT), "exec"), namespace)
    return namespace


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str


internal_token = APIKeyHeader(name="X-Internal-Token", auto_error=False)


def require_internal_token(token: str | None = Depends(internal_token)) -> None:
    if token is None:
        raise HTTPException(status_code=401, detail="Missing X-Internal-Token")


def add_post(app: FastAPI, path: str, request_model: type[Any], response_model: type[Any]) -> None:
    async def stub(request: Any) -> Any:
        del request
        raise HTTPException(status_code=501, detail="Contract-only stub")

    stub.__name__ = path.strip("/").replace("/", "_")
    stub.__annotations__ = {"request": request_model, "return": response_model}
    app.post(path, response_model=response_model, dependencies=[Depends(require_internal_token)])(stub)


def build_app() -> FastAPI:
    models = load_models()
    app = FastAPI(title="AI Leader ID ML API", version="1.0.0")

    @app.get(
        "/internal/v1/health",
        response_model=HealthResponse,
        dependencies=[Depends(require_internal_token)],
    )
    async def health() -> HealthResponse:
        return HealthResponse(status="ok")

    add_post(app, "/internal/v1/simulation/turn", models["TurnRequest"], models["TurnResult"])
    add_post(
        app,
        "/internal/v1/simulation/assessment",
        models["AssessmentRequest"],
        models["AssessmentResult"],
    )
    add_post(app, "/internal/v1/brief", models["BriefRequest"], models["BriefResult"])
    return app


if __name__ == "__main__":
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(build_app().openapi(), indent=2) + "\n", encoding="utf-8")
