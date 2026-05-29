import pytest

from evals import load_fixtures
from models.fixtures import FactualQA, InjectionPayload, JailbreakPrompt, PIISeed


def test_load_injection_payloads() -> None:
    data = load_fixtures("injection_payloads.json")
    assert len(data) >= 20
    for item in data:
        InjectionPayload.model_validate(item)


def test_load_jailbreak_prompts() -> None:
    data = load_fixtures("jailbreak_prompts.json")
    assert len(data) >= 10
    for item in data:
        JailbreakPrompt.model_validate(item)


def test_load_factual_qa() -> None:
    data = load_fixtures("factual_qa.json")
    assert len(data) >= 15
    for item in data:
        FactualQA.model_validate(item)


def test_load_pii_seeds() -> None:
    data = load_fixtures("pii_seeds.json")
    assert len(data) >= 10
    for item in data:
        PIISeed.model_validate(item)


def test_load_nonexistent_raises() -> None:
    with pytest.raises(FileNotFoundError):
        load_fixtures("nonexistent_file.json")
