"""Performance test fixtures — higher timeout, session-scoped service."""

import os
from collections.abc import Iterator

import pytest

from services.ollama_service import OllamaService


@pytest.fixture(scope="session")
def perf_service() -> Iterator[OllamaService]:
    """OllamaService with extended timeout for performance measurements."""
    url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    model = os.environ.get("MODEL_NAME", "llama3.2:1b")
    with OllamaService(base_url=url, default_model=model, timeout=120.0) as svc:
        yield svc
