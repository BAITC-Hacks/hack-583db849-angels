"""Uvicorn entry point for the internal ML service."""

try:
    from services.ml.app.main import create_app
except ModuleNotFoundError:  # service-only Docker build context
    from app.main import create_app


app = create_app()
