import allure
import pytest

from models.chat import ChatMessage, ChatResponse, StreamChunk
from services.ollama_service import OllamaService

_HELLO = [ChatMessage(role="user", content="Hello")]


@pytest.mark.api
@allure.feature("API")
@allure.story("Model availability")
def test_model_responds_to_hello(api_service: OllamaService) -> None:
    response = api_service.chat(_HELLO)
    assert isinstance(response, ChatResponse)
    assert response.message.content.strip()


@pytest.mark.api
@allure.feature("API")
@allure.story("Model availability")
def test_response_has_timing_metadata(api_service: OllamaService) -> None:
    response = api_service.chat(_HELLO)
    assert isinstance(response, ChatResponse)
    assert isinstance(response.total_duration, int) and response.total_duration > 0, (
        f"total_duration={response.total_duration!r}"
    )


@pytest.mark.api
@allure.feature("API")
@allure.story("Model availability")
def test_response_has_eval_count(api_service: OllamaService) -> None:
    response = api_service.chat(_HELLO)
    assert isinstance(response, ChatResponse)
    assert isinstance(response.eval_count, int) and response.eval_count > 0, (
        f"eval_count={response.eval_count!r}"
    )


@pytest.mark.api
@pytest.mark.slow
@allure.feature("API")
@allure.story("Streaming")
def test_streaming_yields_chunks(api_service: OllamaService) -> None:
    stream = api_service.chat(_HELLO, stream=True)
    chunks = list(stream)  # type: ignore[arg-type]
    assert len(chunks) >= 1
    assert all(isinstance(c, StreamChunk) for c in chunks)


@pytest.mark.api
@pytest.mark.slow
@allure.feature("API")
@allure.story("Streaming")
def test_streaming_last_chunk_done(api_service: OllamaService) -> None:
    stream = api_service.chat(_HELLO, stream=True)
    chunks = list(stream)  # type: ignore[arg-type]
    assert chunks, "No chunks received"
    assert chunks[-1].done is True
