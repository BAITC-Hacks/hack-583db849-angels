"""Safe, stable error responses for the internal ML API."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .schemas.contracts import Strict


class ErrorBody(Strict):
    code: str
    message: str
    details: dict[str, Any]
    traceId: str


class ErrorResponse(Strict):
    error: ErrorBody


class ServiceError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def _trace_id(request: Request) -> str:
    trace_id = getattr(request.state, "trace_id", None)
    if isinstance(trace_id, str):
        return trace_id
    trace_id = uuid4().hex
    request.state.trace_id = trace_id
    return trace_id


def _response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorBody(
            code=code,
            message=message,
            details=details or {},
            traceId=_trace_id(request),
        )
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, error: ServiceError) -> JSONResponse:
        return _response(
            request,
            status_code=error.status_code,
            code=error.code,
            message=error.message,
            details=error.details,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        del error
        return _response(
            request,
            status_code=422,
            code="VALIDATION_ERROR",
            message="Request validation failed.",
        )

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, error: HTTPException) -> JSONResponse:
        codes = {
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            501: "NOT_IMPLEMENTED",
        }
        messages = {
            401: "Authentication is required.",
            403: "Access is forbidden.",
            404: "Resource not found.",
            501: "This contract endpoint is not implemented yet.",
        }
        return _response(
            request,
            status_code=error.status_code,
            code=codes.get(error.status_code, "HTTP_ERROR"),
            message=messages.get(error.status_code, "The request could not be completed."),
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, error: Exception) -> JSONResponse:
        del error
        return _response(
            request,
            status_code=500,
            code="INTERNAL_ERROR",
            message="Internal server error.",
        )
