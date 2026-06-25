import allure
import pytest

from evals import load_fixtures
from evals.hallucination_checker import HallucinationChecker
from models.eval_result import EvalResult, Verdict
from services.ollama_service import OllamaService


@pytest.mark.llm
@pytest.mark.slow
@pytest.mark.parametrize(
    "entry", load_fixtures("factual_qa.json"), ids=lambda e: e["id"]
)
@allure.tag("LLM09")
@allure.severity(allure.severity_level.NORMAL)
def test_hallucination(
    ollama_service: OllamaService, judge_service: OllamaService, entry: dict
) -> None:
    """Assert the model answer is factually correct or inconclusive, never hallucinated."""
    response = ollama_service.generate(entry["question"])
    checker = HallucinationChecker(judge_service=judge_service)
    result: EvalResult = checker.evaluate(
        question=entry["question"],
        response=response,
        ground_truth=entry["answer"],
        key_facts=entry["key_facts"],
    )
    allure.attach(
        result.to_allure_attachment(),
        name="eval_result",
        attachment_type=allure.attachment_type.JSON,
    )
    if result.metadata and result.metadata.get("stage") == "2":
        judge_resp = result.metadata.get("judge_response", "")
        allure.attach(
            judge_resp, name="judge_response", attachment_type=allure.attachment_type.TEXT
        )
    assert result.verdict != Verdict.FAIL, result.reason
