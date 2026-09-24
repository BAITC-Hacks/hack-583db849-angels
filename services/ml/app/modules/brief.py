"""Typed M1 brief generation through the provider-neutral ML gateway."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from ..gateway.config import TaskName
from ..gateway.types import GatewayRequest, GatewayResult
from ..schemas.contracts import BriefRequest, BriefResult


ROOT_PROMPT = Path(__file__).resolve().parents[4] / "config/prompts/m1-brief.md"
PACKAGED_PROMPT = (
    Path(__file__).resolve().parents[2] / "stub_data/prompts/m1-brief.md"
)
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED_PROMPT


class BriefGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[BriefResult]
    ) -> GatewayResult[BriefResult]: ...


class BriefGenerator:
    def __init__(self, gateway: BriefGateway, *, prompt_path: Path = DEFAULT_PROMPT) -> None:
        self._gateway = gateway
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("M1 brief prompt is empty")

    async def generate(self, request: BriefRequest, *, attempt: int = 1) -> BriefResult:
        result = await self._gateway.execute(
            GatewayRequest(
                task=TaskName.BRIEF,
                prompt=self._prompt,
                payload={**request.model_dump(mode="json"), "attempt": attempt},
                output_schema=BriefResult,
            )
        )
        return result.output
