"""OpenAI Responses API adapter hidden behind the gateway provider protocol."""

from __future__ import annotations

import json
from typing import Any

from openai import AsyncOpenAI

from ..gateway.errors import GatewayProviderError
from ..gateway.types import ProviderRequest, ProviderResponse


class OpenAIProvider:
    def __init__(self, client: Any | None = None) -> None:
        self._client = client if client is not None else AsyncOpenAI()

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        try:
            response = await self._client.responses.create(
                model=request.model,
                instructions=request.prompt,
                input=json.dumps(
                    request.payload,
                    ensure_ascii=False,
                    separators=(",", ":"),
                    sort_keys=True,
                ),
                max_output_tokens=request.max_tokens,
                text={
                    "format": {
                        "type": "json_schema",
                        "name": request.output_schema.__name__,
                        "strict": True,
                        "schema": request.output_schema.model_json_schema(),
                    }
                },
            )
        except Exception as error:
            raise GatewayProviderError("OpenAI request failed") from error

        if getattr(response, "status", None) != "completed":
            raise GatewayProviderError("OpenAI response was incomplete")
        output_text = getattr(response, "output_text", None)
        if not output_text:
            raise GatewayProviderError("OpenAI response contained no output")

        usage = getattr(response, "usage", None)
        return ProviderResponse(
            content=output_text,
            input_tokens=int(getattr(usage, "input_tokens", 0)),
            output_tokens=int(getattr(usage, "output_tokens", 0)),
            request_id=getattr(response, "id", None),
        )
