from typing import Literal

from pydantic import BaseModel

OptionValue = str | int | float | bool


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = False
    options: dict[str, OptionValue] | None = None


class ChatResponse(BaseModel):
    model: str
    message: ChatMessage
    done: bool
    total_duration: int | None = None
    eval_count: int | None = None


class StreamChunk(BaseModel):
    model: str
    message: ChatMessage
    done: bool
