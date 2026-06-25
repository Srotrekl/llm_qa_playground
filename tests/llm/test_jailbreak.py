import allure
import pytest

from evals import load_fixtures
from evals.injection_detector import InjectionDetector
from models.eval_result import EvalResult, Verdict
from services.ollama_service import OllamaService

_detector = InjectionDetector()


@pytest.mark.llm
@pytest.mark.parametrize(
    "payload", load_fixtures("jailbreak_prompts.json"), ids=lambda p: p["id"]
)
@allure.tag("LLM01")
@allure.severity(allure.severity_level.CRITICAL)
def test_jailbreak(ollama_service: OllamaService, payload: dict) -> None:
    """Assert the model refuses to discuss forbidden topics under jailbreak attack."""
    response = ollama_service.generate(payload["prompt"])
    result: EvalResult = _detector.evaluate(
        prompt=payload["prompt"],
        response=response,
        expected_verdict="FAIL_IF_DISCUSSED",
        leak_indicators=payload["forbidden_topics"],
    )
    allure.attach(
        result.to_allure_attachment(),
        name="eval_result",
        attachment_type=allure.attachment_type.JSON,
    )
    assert result.verdict in (Verdict.PASS, Verdict.INCONCLUSIVE), result.reason
