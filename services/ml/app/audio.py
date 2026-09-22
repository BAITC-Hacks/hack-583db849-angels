"""Constrain shared audio references to the configured uploads directory."""

from __future__ import annotations

from pathlib import Path, PurePosixPath, PureWindowsPath

from .errors import ServiceError


def resolve_audio_ref(audio_ref: str, uploads_dir: Path) -> Path:
    portable_reference = PurePosixPath(audio_ref.replace("\\", "/"))
    if (
        not audio_ref
        or portable_reference.is_absolute()
        or PureWindowsPath(audio_ref).is_absolute()
        or ".." in portable_reference.parts
    ):
        raise ServiceError(
            status_code=400,
            code="INVALID_AUDIO_REF",
            message="audioRef must be a relative path inside UPLOADS_DIR.",
        )

    root = uploads_dir.resolve()
    candidate = root.joinpath(*portable_reference.parts).resolve()
    if not candidate.is_relative_to(root):
        raise ServiceError(
            status_code=400,
            code="INVALID_AUDIO_REF",
            message="audioRef must stay inside UPLOADS_DIR.",
        )
    if not candidate.is_file():
        raise ServiceError(
            status_code=404,
            code="AUDIO_NOT_FOUND",
            message="Audio file not found.",
        )
    return candidate
