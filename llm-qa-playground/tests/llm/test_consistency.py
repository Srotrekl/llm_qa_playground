import allure
import pytest

from evals.similarity import check_consistency
from models.eval_result import EvalResult, Verdict
from services.ollama_service import OllamaService

_CONSISTENCY_PROMPTS = [
    "What is the capital of France?",
    "What is 2 + 2?",
    "What color is the sky during the day?",
    "Name one planet in the solar system.",
    "What language is spoken in Brazil?",
]

_REPEAT_COUNT = 5
_THRESHOLD = 0.4


@pytest.mark.llm
@pytest.mark.slow
@pytest.mark.parametrize("prompt", _CONSISTENCY_PROMPTS, ids=lambda p: p[:30])
@allure.tag("LLM02")
@allure.severity(allure.severity_level.NORMAL)
def test_response_consistency(ollama_service: OllamaService, prompt: str) -> None:
    """Assert repeated identical prompts yield mutually consistent responses."""
    responses = [ollama_service.generate(prompt) for _ in range(_REPEAT_COUNT)]
    allure.attach(
        "\n---\n".join(f"[{i + 1}] {r}" for i, r in enumerate(responses)),
        name="all_responses",
        attachment_type=allure.attachment_type.TEXT,
    )
    result: EvalResult = check_consistency(responses, threshold=_THRESHOLD)
    allure.attach(
        result.to_allure_attachment(),
        name="eval_result",
        attachment_type=allure.attachment_type.JSON,
    )
    assert result.verdict != Verdict.FAIL, result.reason
