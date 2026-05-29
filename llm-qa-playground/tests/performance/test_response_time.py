"""Performance tests — response time, TTFT, throughput, variance."""

import json
import math
import time

import allure
import pytest

from services.ollama_service import OllamaService

# ---------------------------------------------------------------------------
# SLA constants
# ---------------------------------------------------------------------------
SLA_AVG_RESPONSE_TIME_S: float = 10.0
SLA_TTFT_S: float = 5.0
SLA_MIN_TOKENS_PER_SEC: float = 5.0

_SIMPLE_PROMPT = "Hello"
_CONSISTENCY_PROMPT = "What is the capital of France?"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mean(values: list[float]) -> float:
    return sum(values) / len(values)


def _p95(values: list[float]) -> float:
    sorted_vals = sorted(values)
    idx = math.ceil(0.95 * len(sorted_vals)) - 1
    return sorted_vals[max(idx, 0)]


def _std_dev(values: list[float]) -> float:
    m = _mean(values)
    variance = sum((v - m) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@allure.feature("Performance")
@allure.story("Response time")
@pytest.mark.performance
@pytest.mark.slow
def test_single_response_time_under_sla(perf_service: OllamaService) -> None:
    """Average response time across 5 calls must stay under SLA."""
    times: list[float] = []

    for _ in range(5):
        start = time.perf_counter()
        perf_service.generate(_SIMPLE_PROMPT)
        elapsed = time.perf_counter() - start
        times.append(elapsed)

    avg = _mean(times)
    metrics = {
        "calls": len(times),
        "min_s": round(min(times), 3),
        "max_s": round(max(times), 3),
        "avg_s": round(avg, 3),
        "p95_s": round(_p95(times), 3),
        "sla_avg_s": SLA_AVG_RESPONSE_TIME_S,
        "passed": avg < SLA_AVG_RESPONSE_TIME_S,
    }
    allure.attach(
        json.dumps(metrics, indent=2),
        name="response_time_metrics",
        attachment_type=allure.attachment_type.JSON,
    )

    assert avg < SLA_AVG_RESPONSE_TIME_S, (
        f"Average response time {avg:.2f}s exceeds SLA {SLA_AVG_RESPONSE_TIME_S}s"
    )


@allure.feature("Performance")
@allure.story("Streaming")
@pytest.mark.performance
@pytest.mark.slow
def test_time_to_first_token_streaming(perf_service: OllamaService) -> None:
    """Time-to-first-token for streaming calls must stay under SLA."""
    from models.chat import ChatMessage

    ttfts: list[float] = []

    for _ in range(3):
        messages = [ChatMessage(role="user", content=_SIMPLE_PROMPT)]
        start = time.perf_counter()
        stream = perf_service.chat(messages, stream=True)
        ttft: float | None = None
        for chunk in stream:  # type: ignore[union-attr]
            if chunk.message.content and ttft is None:
                ttft = time.perf_counter() - start
                break
        if ttft is not None:
            ttfts.append(ttft)

    avg_ttft = _mean(ttfts) if ttfts else float("inf")
    metrics = {
        "calls": len(ttfts),
        "ttft_per_call_s": [round(t, 3) for t in ttfts],
        "avg_ttft_s": round(avg_ttft, 3),
        "sla_ttft_s": SLA_TTFT_S,
        "passed": avg_ttft < SLA_TTFT_S,
    }
    allure.attach(
        json.dumps(metrics, indent=2),
        name="ttft_metrics",
        attachment_type=allure.attachment_type.JSON,
    )

    assert ttfts, "No TTFT measurements collected — stream produced no content chunks"
    assert avg_ttft < SLA_TTFT_S, (
        f"Average TTFT {avg_ttft:.2f}s exceeds SLA {SLA_TTFT_S}s"
    )


@allure.feature("Performance")
@allure.story("Throughput")
@pytest.mark.performance
@pytest.mark.slow
def test_token_throughput(perf_service: OllamaService) -> None:
    """Token throughput must exceed SLA minimum tokens/sec."""
    from models.chat import ChatMessage, ChatRequest

    messages = [ChatMessage(role="user", content="Write a short poem about mountains.")]
    payload = ChatRequest(model=perf_service._default_model, messages=messages)
    response = perf_service._blocking_chat(payload)

    eval_count = response.eval_count
    total_duration_ns = response.total_duration

    tokens_per_sec: float | None = None
    if eval_count and total_duration_ns and total_duration_ns > 0:
        tokens_per_sec = eval_count / (total_duration_ns / 1e9)

    metrics = {
        "eval_count": eval_count,
        "total_duration_ns": total_duration_ns,
        "tokens_per_sec": round(tokens_per_sec, 2) if tokens_per_sec is not None else None,
        "sla_min_tokens_per_sec": SLA_MIN_TOKENS_PER_SEC,
        "passed": tokens_per_sec is not None and tokens_per_sec > SLA_MIN_TOKENS_PER_SEC,
    }
    allure.attach(
        json.dumps(metrics, indent=2),
        name="throughput_metrics",
        attachment_type=allure.attachment_type.JSON,
    )

    assert tokens_per_sec is not None, (
        "Could not compute tokens/sec — eval_count or total_duration missing in response"
    )
    assert tokens_per_sec > SLA_MIN_TOKENS_PER_SEC, (
        f"Throughput {tokens_per_sec:.2f} tok/s is below SLA {SLA_MIN_TOKENS_PER_SEC} tok/s"
    )


@allure.feature("Performance")
@allure.story("Consistency")
@pytest.mark.performance
@pytest.mark.slow
def test_consistency_of_response_time(perf_service: OllamaService) -> None:
    """Response time std deviation must stay below 50% of the mean."""
    times: list[float] = []

    for _ in range(10):
        start = time.perf_counter()
        perf_service.generate(_CONSISTENCY_PROMPT)
        times.append(time.perf_counter() - start)

    avg = _mean(times)
    std = _std_dev(times)
    threshold = avg * 0.5

    metrics = {
        "calls": len(times),
        "times_s": [round(t, 3) for t in times],
        "mean_s": round(avg, 3),
        "std_dev_s": round(std, 3),
        "threshold_s": round(threshold, 3),
        "cv_pct": round((std / avg) * 100, 1) if avg > 0 else None,
        "passed": std < threshold,
    }
    allure.attach(
        json.dumps(metrics, indent=2),
        name="consistency_metrics",
        attachment_type=allure.attachment_type.JSON,
    )

    assert std < threshold, (
        f"Std dev {std:.2f}s exceeds 50% of mean {avg:.2f}s (threshold {threshold:.2f}s)"
    )
