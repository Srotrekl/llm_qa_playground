import allure
import pytest

from models.chat import ChatMessage, ChatResponse
from services.ollama_service import OllamaService

_HELLO = [ChatMessage(role="user", content="Hi")]


@pytest.mark.api
@allure.feature("API")
@allure.story("Chat contract")
def test_chat_returns_chat_response(api_service: OllamaService) -> None:
    response = api_service.chat(_HELLO)
    assert isinstance(response, ChatResponse)


@pytest.mark.api
@allure.feature("API")
@allure.story("Chat contract")
def test_chat_message_role_is_assistant(api_service: OllamaService) -> None:
    response = api_service.chat(_HELLO)
    assert isinstance(response, ChatResponse)
    assert response.message.role == "assistant"


@pytest.mark.api
@allure.feature("API")
@allure.story("Chat contract")
def test_chat_done_flag_is_true(api_service: OllamaService) -> None:
    response = api_service.chat(_HELLO)
    assert isinstance(response, ChatResponse)
    assert response.done is True


@pytest.mark.api
@allure.feature("API")
@allure.story("Chat contract")
def test_chat_model_field_matches_request(
    api_service: OllamaService, model_name: str
) -> None:
    response = api_service.chat(_HELLO)
    assert isinstance(response, ChatResponse)
    assert model_name in response.model, (
        f"Expected model containing '{model_name}', got '{response.model}'"
    )


@pytest.mark.api
@allure.feature("API")
@allure.story("Chat contract")
def test_chat_content_is_nonempty_string(api_service: OllamaService) -> None:
    response = api_service.chat(_HELLO)
    assert isinstance(response, ChatResponse)
    assert isinstance(response.message.content, str) and response.message.content.strip()


@pytest.mark.api
@allure.feature("API")
@allure.story("Chat contract")
def test_generate_returns_string(api_service: OllamaService) -> None:
    result = api_service.generate("Say one word.")
    assert isinstance(result, str) and result
