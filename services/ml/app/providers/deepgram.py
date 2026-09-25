"""Deepgram REST adapter hidden behind the media gateway protocol."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from decimal import Decimal
import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from ..gateway.errors import GatewayConfigurationError, GatewayProviderError
from ..gateway.media import MediaProviderRequest, MediaProviderResponse


DEEPGRAM_API = "https://api.deepgram.com/v1"


class DeepgramProvider:
    def __init__(
        self,
        api_key: str | None = None,
        *,
        opener: Callable[..., Any] = urlopen,
    ) -> None:
        self._api_key = api_key or os.environ.get("DEEPGRAM_API_KEY")
        self._opener = opener

    async def execute(self, request: MediaProviderRequest) -> MediaProviderResponse:
        return await asyncio.to_thread(self._execute_sync, request)

    def _execute_sync(self, request: MediaProviderRequest) -> MediaProviderResponse:
        if not self._api_key:
            raise GatewayProviderError("Deepgram request failed")
        try:
            if request.operation == "transcribe":
                return self._transcribe(request)
            if request.operation == "speech":
                return self._speech(request)
        except (HTTPError, URLError, OSError, ValueError, json.JSONDecodeError) as error:
            raise GatewayProviderError("Deepgram request failed") from error
        raise GatewayConfigurationError("unsupported Deepgram operation")

    def _transcribe(self, request: MediaProviderRequest) -> MediaProviderResponse:
        speakers = int(request.parameters.get("speakers", 1))
        parameters = {
            "model": request.model,
            "language": request.parameters.get("language", "en"),
            "smart_format": "true",
            "punctuate": "true",
        }
        if speakers == 2 and request.parameters.get("purpose") == "interview":
            diarize_model = request.parameters.get("diarize_model")
            if diarize_model not in {"latest", "v1", "v2"}:
                raise GatewayConfigurationError("interview diarization model is missing")
            if request.model == "nova-2":
                # The approved fallback uses legacy diarization, never both
                # diarize and diarize_model in the same Deepgram request.
                parameters["diarize"] = "true"
            else:
                parameters["diarize_model"] = diarize_model
            parameters["utterances"] = "true"
        elif speakers == 1:
            parameters["diarize"] = "false"
        else:
            raise GatewayConfigurationError("unsupported transcription speaker count")
        http_request = Request(
            f"{DEEPGRAM_API}/listen?{urlencode(parameters)}",
            data=request.content,
            headers={
                "Authorization": f"Token {self._api_key}",
                "Content-Type": request.content_type,
                "Accept": "application/json",
            },
            method="POST",
        )
        with self._opener(http_request, timeout=30) as response:
            content = response.read()
            request_id = response.headers.get("dg-request-id")
        payload = json.loads(content)
        duration_seconds = Decimal(str(payload.get("metadata", {}).get("duration", 0)))
        billed_units = (
            duration_seconds / Decimal(60)
            if duration_seconds > 0
            else request.estimated_units
        )
        return MediaProviderResponse(
            content=content,
            media_type="application/json",
            billed_units=billed_units,
            request_id=request_id,
        )

    def _speech(self, request: MediaProviderRequest) -> MediaProviderResponse:
        text = request.content.decode("utf-8")
        http_request = Request(
            f"{DEEPGRAM_API}/speak?{urlencode({'model': request.model, 'encoding': 'mp3'})}",
            data=json.dumps({"text": text}, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Token {self._api_key}",
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            method="POST",
        )
        with self._opener(http_request, timeout=30) as response:
            content = response.read()
            request_id = response.headers.get("dg-request-id")
        if not content:
            raise GatewayProviderError("Deepgram returned empty speech audio")
        return MediaProviderResponse(
            content=content,
            media_type="audio/mpeg",
            billed_units=Decimal(len(text)) / Decimal(1000),
            request_id=request_id,
        )
