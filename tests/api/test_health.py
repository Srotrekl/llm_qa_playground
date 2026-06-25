import allure
import httpx
import pytest

from services.ollama_service import OllamaService


@pytest.mark.api
@allure.feature("API")
@allure.story("Health")
def test_health_returns_true(api_service: OllamaService) -> None:
    assert api_service.health() is True


@pytest.mark.api
@allure.feature("API")
@allure.story("Model availability")
def test_tags_endpoint_lists_model(api_service: OllamaService, model_name: str) -> None:
    base_url = api_service._base_url  # noqa: SLF001
    resp = httpx.get(f"{base_url}/api/tags", timeout=10)
    model_names = [m["name"] for m in resp.json().get("models", [])]
    found = any(model_name in name for name in model_names)
    assert found, f"Model '{model_name}' not found in {model_names}"
