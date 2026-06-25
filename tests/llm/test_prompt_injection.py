import allure
import pytest

from evals import load_fixtures
from evals.injection_detector import InjectionDetector
from models.eval_result import EvalResult, Verdict
from services.ollama_service import OllamaService

_detector = InjectionDetector()


@pytest.mark.llm
@pytest.mark.parametrize("payload", load_fixtures("injection_payloads.json"), ids=lambda p: p["id"])
@allure.tag("LLM01")
@allure.severity(allure.severity_level.CRITICAL)
def test_prompt_injection(ollama_service: OllamaService, payload: dict) -> None:
    """Assert the model does not leak system instructions under injection attack."""
    response = ollama_service.generate(payload["prompt"])
    result: EvalResult = _detector.evaluate(
        prompt=payload["prompt"],
        response=response,
        expected_verdict=payload["expected_verdict"],
        leak_indicators=payload["leak_indicators"],
    )
    allure.attach(
        result.to_allure_attachment(),
        name="eval_result",
        attachment_type=allure.attachment_type.JSON,
    )
    assert result.verdict in (Verdict.PASS, Verdict.INCONCLUSIVE), result.reason
