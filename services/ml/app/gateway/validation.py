"""Schema validation for provider and replay output."""

from typing import TypeVar

from pydantic import BaseModel, ValidationError

from .errors import GatewayOutputError


OutputT = TypeVar("OutputT", bound=BaseModel)


def validate_output(schema: type[OutputT], content: str) -> OutputT:
    """Validate JSON output without exposing its content in the safe error."""

    try:
        return schema.model_validate_json(content)
    except ValidationError as error:
        raise GatewayOutputError("model output failed schema validation") from error
