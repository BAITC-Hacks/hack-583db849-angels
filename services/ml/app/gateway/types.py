"""Provider-neutral types used by every model-backed module."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Generic, Mapping, Protocol, TypeVar

from pydantic import BaseModel

from .config import Provider, TaskName


OutputT = TypeVar("OutputT", bound=BaseModel)


@dataclass(frozen=True)
class GatewayRequest(Generic[OutputT]):
    task: TaskName
    prompt: str
    payload: Mapping[str, Any]
    output_schema: type[OutputT]


@dataclass(frozen=True)
class ProviderRequest:
    task: TaskName
    model: str
    prompt: str
    payload: Mapping[str, Any]
    output_schema: type[BaseModel]
    max_tokens: int


@dataclass(frozen=True)
class ProviderResponse:
    content: str
    input_tokens: int
    output_tokens: int
    request_id: str | None = None


@dataclass(frozen=True)
class GatewayResult(Generic[OutputT]):
    output: OutputT
    provider: Provider
    model: str
    input_tokens: int
    output_tokens: int
    replayed: bool


class ModelProvider(Protocol):
    async def generate(self, request: ProviderRequest) -> ProviderResponse: ...


class CassetteStore(Protocol):
    async def load(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
    ) -> ProviderResponse: ...

    async def save(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
        response: ProviderResponse,
    ) -> None: ...
