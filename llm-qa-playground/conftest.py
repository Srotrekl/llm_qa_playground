"""Root conftest — shared session-scoped fixtures for all test suites."""

import os
from collections.abc import Iterator

import pytest

from services.ollama_service import OllamaService


@pytest.fixture(scope="session")
def model_name() -> str:
    """Return the Ollama model tag from environment."""
    return os.environ.get("MODEL_NAME", "llama3.2:1b")


@pytest.fixture(scope="session")
def ollama_service(model_name: str) -> Iterator[OllamaService]:
    """Yield a single OllamaService instance shared across the whole test session."""
    url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    with OllamaService(base_url=url, default_model=model_name) as svc:
        yield svc
