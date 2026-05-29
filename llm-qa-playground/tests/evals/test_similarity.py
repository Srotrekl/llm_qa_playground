from evals.similarity import check_consistency, similarity_score
from models.eval_result import Verdict


def test_identical_strings_score_1() -> None:
    assert similarity_score("hello world", "hello world") == 1.0


def test_empty_string_score() -> None:
    assert similarity_score("", "") == 1.0


def test_different_strings_low_score() -> None:
    score = similarity_score("the quick brown fox", "completely different text here")
    assert score < 0.5


def test_consistency_pass() -> None:
    responses = [
        "The capital of France is Paris.",
        "Paris is the capital of France.",
        "France's capital city is Paris.",
    ]
    result = check_consistency(responses, threshold=0.3)
    assert result.verdict == Verdict.PASS


def test_consistency_fail() -> None:
    responses = [
        "The capital of France is Paris.",
        "I love eating pizza on Tuesdays while watching football.",
    ]
    result = check_consistency(responses, threshold=0.6)
    assert result.verdict == Verdict.FAIL


def test_consistency_single_item() -> None:
    result = check_consistency(["Only one response here."])
    assert result.verdict == Verdict.INCONCLUSIVE


def test_consistency_empty() -> None:
    result = check_consistency([])
    assert result.verdict == Verdict.INCONCLUSIVE
