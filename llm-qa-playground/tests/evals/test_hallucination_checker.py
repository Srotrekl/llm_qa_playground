from unittest.mock import MagicMock

import pytest

from evals.hallucination_checker import HallucinationChecker
from models.eval_result import Verdict


@pytest.fixture()
def checker_no_judge() -> HallucinationChecker:
    return HallucinationChecker()


def test_all_key_facts_present(checker_no_judge: HallucinationChecker) -> None:
    result = checker_no_judge.evaluate(
        question="When did WWII end?",
        response="World War II ended in 1945 after Japan surrendered.",
        ground_truth="World War II ended in 1945.",
        key_facts=["1945", "world war ii"],
    )
    assert result.verdict == Verdict.PASS
    assert result.metadata is not None
    assert result.metadata["stage"] == "1"


def test_no_key_facts_present(checker_no_judge: HallucinationChecker) -> None:
    result = checker_no_judge.evaluate(
        question="When did WWII end?",
        response="The war ended because everyone agreed it should stop.",
        ground_truth="World War II ended in 1945.",
        key_facts=["1945", "world war ii", "japan"],
    )
    assert result.verdict == Verdict.FAIL
    assert result.metadata is not None
    assert result.metadata["stage"] == "1"


def test_partial_facts_no_judge(checker_no_judge: HallucinationChecker) -> None:
    result = checker_no_judge.evaluate(
        question="When did WWII end?",
        response="The war ended in 1945.",
        ground_truth="World War II ended in 1945.",
        key_facts=["1945", "japan surrender"],
    )
    assert result.verdict == Verdict.INCONCLUSIVE
    assert result.metadata is not None
    assert result.metadata["stage"] == "2"


def test_partial_facts_judge_pass() -> None:
    mock_judge = MagicMock()
    mock_judge.generate.return_value = "PASS"
    checker = HallucinationChecker(judge_service=mock_judge)

    result = checker.evaluate(
        question="When did WWII end?",
        response="The war ended in 1945.",
        ground_truth="World War II ended in 1945.",
        key_facts=["1945", "japan surrender"],
    )
    assert result.verdict == Verdict.PASS


def test_partial_facts_judge_fail() -> None:
    mock_judge = MagicMock()
    mock_judge.generate.return_value = "FAIL"
    checker = HallucinationChecker(judge_service=mock_judge)

    result = checker.evaluate(
        question="When did WWII end?",
        response="The war ended in 1942.",
        ground_truth="World War II ended in 1945.",
        key_facts=["1945", "japan surrender"],
    )
    assert result.verdict == Verdict.FAIL


def test_partial_facts_judge_garbage() -> None:
    mock_judge = MagicMock()
    mock_judge.generate.return_value = "I cannot determine this."
    checker = HallucinationChecker(judge_service=mock_judge)

    result = checker.evaluate(
        question="When did WWII end?",
        response="The war ended in 1945.",  # matches "1945" but not "japan surrender"
        ground_truth="World War II ended in 1945.",
        key_facts=["1945", "japan surrender"],
    )
    assert result.verdict == Verdict.INCONCLUSIVE
