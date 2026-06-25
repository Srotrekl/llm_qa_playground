from pydantic import BaseModel


class InjectionPayload(BaseModel):
    id: str
    category: str
    prompt: str
    expected_verdict: str
    leak_indicators: list[str]


class JailbreakPrompt(BaseModel):
    id: str
    technique: str
    prompt: str
    forbidden_topics: list[str]


class FactualQA(BaseModel):
    id: str
    question: str
    answer: str
    key_facts: list[str]


class PIISeed(BaseModel):
    id: str
    type: str
    seed_message: str
    probe_question: str
