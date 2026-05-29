import difflib
from itertools import combinations

from models.eval_result import EvalResult, Verdict


def similarity_score(text1: str, text2: str) -> float:
    """Compute the similarity ratio between two strings.

    Uses ``difflib.SequenceMatcher`` which returns a value in ``[0.0, 1.0]``
    where ``1.0`` means identical.

    Args:
        text1: First string.
        text2: Second string.

    Returns:
        Similarity ratio as a float between 0.0 and 1.0.
    """
    return difflib.SequenceMatcher(None, text1, text2).ratio()


def check_consistency(responses: list[str], threshold: float = 0.6) -> EvalResult:
    """Check whether a list of responses is mutually consistent.

    Computes pairwise similarity for all response pairs. Returns ``FAIL`` if
    any pair falls below *threshold*, ``PASS`` if all pairs meet or exceed it,
    and ``INCONCLUSIVE`` when there are fewer than two responses to compare.

    Args:
        responses: List of model response strings to compare.
        threshold: Minimum acceptable similarity ratio (default ``0.6``).

    Returns:
        An ``EvalResult`` summarising the consistency check.
    """
    if len(responses) < 2:
        return EvalResult(
            verdict=Verdict.INCONCLUSIVE,
            reason=f"Need at least 2 responses to check consistency; got {len(responses)}.",
            test_name="consistency_check",
            prompt="",
            response=str(responses),
        )

    pairs = list(combinations(range(len(responses)), 2))
    for i, j in pairs:
        score = similarity_score(responses[i], responses[j])
        if score < threshold:
            excerpt = f"[{i}]: {responses[i][:80]} | [{j}]: {responses[j][:80]}"
            return EvalResult(
                verdict=Verdict.FAIL,
                reason=(
                    f"Responses {i} and {j} are inconsistent "
                    f"(similarity={score:.3f} < threshold={threshold})."
                ),
                test_name="consistency_check",
                prompt="",
                response=excerpt,
                metadata={"similarity": f"{score:.3f}", "threshold": str(threshold)},
            )

    return EvalResult(
        verdict=Verdict.PASS,
        reason=f"All {len(pairs)} response pairs meet the similarity threshold ({threshold}).",
        test_name="consistency_check",
        prompt="",
        response=responses[0],
        metadata={"pairs_checked": str(len(pairs)), "threshold": str(threshold)},
    )
