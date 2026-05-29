"""API test fixtures — OllamaService fixture for API contract tests."""

import pytest

from services.ollama_service import OllamaService

pytestmark = pytest.mark.api


@pytest.fixture()
def api_service(ollama_service: OllamaService) -> OllamaService:
    """Return the session-scoped OllamaService for API contract tests."""
    return ollama_service
