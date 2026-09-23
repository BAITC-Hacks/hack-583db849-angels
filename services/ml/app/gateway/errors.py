"""Stable gateway errors that never expose prompts, payloads, or provider details."""


class GatewayError(RuntimeError):
    """Base class for safe gateway failures."""


class GatewayConfigurationError(GatewayError):
    """The requested task cannot be routed with the configured providers."""


class GatewayProviderError(GatewayError):
    """A provider call failed without exposing its unsafe error message."""


class GatewayReplayError(GatewayError):
    """Replay data is unavailable and live fallback is forbidden."""


class GatewayOutputError(GatewayError):
    """A provider or cassette returned output that failed validation."""
