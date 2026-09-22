"""Uvicorn entry point for the internal ML service."""

from services.ml.app.main import create_app


app = create_app()
