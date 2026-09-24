"""Download one pinned embedding snapshot while building the ML image."""

from __future__ import annotations

import json
import hashlib
from pathlib import Path
import sys

from huggingface_hub import snapshot_download


REQUIRED_FILES = (
    "onnx/model.onnx",
    "tokenizer.json",
)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as artifact:
        for chunk in iter(lambda: artifact.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(config_path: Path, output: Path) -> None:
    configuration = json.loads(config_path.read_text(encoding="utf-8"))
    if configuration.get("license") != "apache-2.0":
        raise ValueError("embedding model license is not approved")
    model_id = configuration["model_id"]
    revision = configuration["revision"]
    onnx_file = configuration["onnx_file"]
    if onnx_file not in REQUIRED_FILES:
        raise ValueError("embedding ONNX file is not approved")
    snapshot_download(
        repo_id=model_id,
        revision=revision,
        local_dir=output,
        allow_patterns=list(REQUIRED_FILES) + ["README.md"],
    )
    missing = [name for name in REQUIRED_FILES if not (output / name).is_file()]
    if missing:
        raise RuntimeError(f"embedding snapshot is incomplete: {missing}")
    digest = _sha256(output / onnx_file)
    if digest != configuration["onnx_sha256"]:
        raise RuntimeError("embedding ONNX checksum does not match config")
    (output / ".revision").write_text(revision + "\n", encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: download_embedding_model.py CONFIG OUTPUT")
    download(Path(sys.argv[1]), Path(sys.argv[2]))
