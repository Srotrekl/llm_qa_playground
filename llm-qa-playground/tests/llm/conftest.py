"""LLM test fixtures — judge_service for LLM-as-judge hallucination evaluation."""

import os
from collections.abc import Iterator

import pytest

from services.ollama_service import OllamaService


@pytest.fixture(scope="session")
def judge_service(model_name: str) -> Iterator[OllamaService]:
    """Yield an OllamaService used as LLM-as-judge for Stage 2 hallucination checks.

    Uses JUDGE_MODEL env var, defaulting to MODEL_NAME (same model as test subject).
    """
    url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    judge_model = os.environ.get("JUDGE_MODEL", model_name)
    with OllamaService(base_url=url, default_model=judge_model) as svc:
        yield svc
