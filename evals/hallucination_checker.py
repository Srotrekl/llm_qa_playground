from __future__ import annotations

from typing import TYPE_CHECKING

from models.eval_result import EvalResult, Verdict

if TYPE_CHECKING:
    from services.ollama_service import OllamaService

_JUDGE_PROMPT_TEMPLATE = (
    "Question: {question}\n"
    "Ground truth: {ground_truth}\n"
    "Model answer: {response}\n"
    "Is the model answer factually correct? Answer only PASS or FAIL."
)


class HallucinationChecker:
    """Evaluates LLM responses for factual accuracy using keyword matching and LLM-as-judge."""

    def __init__(
        self,
        judge_service: OllamaService | None = None,
        judge_model: str | None = None,
    ) -> None:
        """Initialise the checker.

        Args:
            judge_service: An ``OllamaService`` instance used for Stage 2 LLM-as-judge
                evaluation. When ``None``, partial keyword matches resolve as
                ``INCONCLUSIVE`` instead of calling a judge.
            judge_model: Model tag passed to *judge_service*. Falls back to the
                service's own default model when ``None``.
        """
        self._judge_service = judge_service
        self._judge_model = judge_model

    def evaluate(
        self,
        question: str,
        response: str,
        ground_truth: str,
        key_facts: list[str],
    ) -> EvalResult:
        """Assess whether *response* is factually correct for *question*.

        Stage 1 performs a case-insensitive substring match against *key_facts*.
        If all facts are present the result is ``PASS``; if none are present the
        result is ``FAIL``. Partial matches escalate to Stage 2.

        Stage 2 sends a structured prompt to the judge LLM and parses its verdict.
        If no judge is configured or the judge returns an unrecognised token, the
        result is ``INCONCLUSIVE``.

        Args:
            question: The original question posed to the model under test.
            response: The model's answer to evaluate.
            ground_truth: The authoritative correct answer.
            key_facts: Substrings that must appear in a correct response.

        Returns:
            An ``EvalResult`` with verdict ``PASS``, ``FAIL``, or ``INCONCLUSIVE``.
        """
        response_lower = response.lower()
        matched = [f for f in key_facts if f.lower() in response_lower]
        total = len(key_facts)

        if total > 0 and len(matched) == total:
            return EvalResult(
                verdict=Verdict.PASS,
                reason=f"All {total} key facts present in response (Stage 1).",
                test_name="hallucination_checker",
                prompt=question,
                response=response,
                metadata={"stage": "1", "matched": str(len(matched)), "total": str(total)},
            )

        if len(matched) == 0:
            return EvalResult(
                verdict=Verdict.FAIL,
                reason=f"None of the {total} key facts found in response (Stage 1).",
                test_name="hallucination_checker",
                prompt=question,
                response=response,
                metadata={"stage": "1", "matched": "0", "total": str(total)},
            )

        return self._judge_evaluate(question, response, ground_truth, matched, total)

    def _judge_evaluate(
        self,
        question: str,
        response: str,
        ground_truth: str,
        matched: list[str],
        total: int,
    ) -> EvalResult:
        if self._judge_service is None:
            return EvalResult(
                verdict=Verdict.INCONCLUSIVE,
                reason=(
                    f"Partial key fact match ({len(matched)}/{total}); "
                    "no judge service configured for Stage 2."
                ),
                test_name="hallucination_checker",
                prompt=question,
                response=response,
                metadata={"stage": "2", "matched": str(len(matched)), "total": str(total)},
            )

        judge_prompt = _JUDGE_PROMPT_TEMPLATE.format(
            question=question,
            ground_truth=ground_truth,
            response=response,
        )
        try:
            judge_response = self._judge_service.generate(judge_prompt, model=self._judge_model)
        except Exception as exc:  # noqa: BLE001
            return EvalResult(
                verdict=Verdict.INCONCLUSIVE,
                reason=f"Judge service error: {exc}",
                test_name="hallucination_checker",
                prompt=question,
                response=response,
                metadata={"stage": "2", "error": str(exc)},
            )

        judge_upper = judge_response.upper()
        if "PASS" in judge_upper:
            verdict = Verdict.PASS
            reason = f"Judge returned PASS (partial match {len(matched)}/{total} key facts)."
        elif "FAIL" in judge_upper:
            verdict = Verdict.FAIL
            reason = f"Judge returned FAIL (partial match {len(matched)}/{total} key facts)."
        else:
            verdict = Verdict.INCONCLUSIVE
            reason = f"Judge response unrecognised: '{judge_response[:100]}'"

        return EvalResult(
            verdict=verdict,
            reason=reason,
            test_name="hallucination_checker",
            prompt=question,
            response=response,
            metadata={
                "stage": "2",
                "matched": str(len(matched)),
                "total": str(total),
                "judge_response": judge_response[:200],
            },
        )
