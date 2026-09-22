"""Contract-only F0 ML service; real module logic lands in later slices."""

from services.ml.scripts.export_contract_openapi import build_app


app = build_app()
