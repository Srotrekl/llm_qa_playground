from collections.abc import Iterator

import httpx

from models.chat import ChatMessage, ChatRequest, ChatResponse, OptionValue, StreamChunk


class OllamaService:
    """Sync HTTP client for the Ollama /api/chat endpoint."""

    def __init__(self, base_url: str, default_model: str, timeout: float = 60.0) -> None:
        """Initialise the service.

        Args:
            base_url: Ollama base URL, e.g. ``http://localhost:11434``.
            default_model: Model tag used when *model* is not passed to a method.
            timeout: Per-request timeout in seconds.
        """
        self._base_url = base_url.rstrip("/")
        self._default_model = default_model
        self._timeout = timeout
        self._client = httpx.Client(base_url=self._base_url, timeout=self._timeout)

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    def __enter__(self) -> "OllamaService":
        self._client.__enter__()
        return self

    def __exit__(self, *args: object) -> None:
        self._client.__exit__(*args)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chat(
        self,
        messages: list[ChatMessage],
        model: str | None = None,
        stream: bool = False,
        options: dict[str, OptionValue] | None = None,
    ) -> ChatResponse | Iterator[StreamChunk]:
        """Send a chat request to Ollama.

        Args:
            messages: Conversation history as a list of ``ChatMessage`` objects.
            model: Model tag; falls back to *default_model* when omitted.
            stream: When ``True``, return a streaming iterator of ``StreamChunk``.
            options: Optional Ollama model parameters (temperature, top_p, …).

        Returns:
            A ``ChatResponse`` for non-streaming requests, or an
            ``Iterator[StreamChunk]`` when *stream* is ``True``.
        """
        payload = ChatRequest(
            model=model or self._default_model,
            messages=messages,
            stream=stream,
            options=options,
        )
        if stream:
            return self._stream_chat(payload)
        return self._blocking_chat(payload)

    def generate(self, prompt: str, model: str | None = None) -> str:
        """Send a single user prompt and return the assistant's text reply.

        Args:
            prompt: Plain-text prompt to send as a user message.
            model: Model tag; falls back to *default_model* when omitted.

        Returns:
            The assistant response as a plain string.
        """
        message = ChatMessage(role="user", content=prompt)
        response = self._blocking_chat(
            ChatRequest(model=model or self._default_model, messages=[message])
        )
        return response.message.content

    def health(self) -> bool:
        """Check whether the Ollama daemon is reachable.

        Returns:
            ``True`` if ``GET /api/tags`` returns HTTP 200, ``False`` otherwise.
        """
        try:
            resp = self._client.get("/api/tags")
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _blocking_chat(self, payload: ChatRequest) -> ChatResponse:
        resp = self._client.post(
            "/api/chat",
            json=payload.model_dump(exclude_none=True),
        )
        resp.raise_for_status()
        return ChatResponse.model_validate(resp.json())

    def _stream_chat(self, payload: ChatRequest) -> Iterator[StreamChunk]:
        with self._client.stream(
            "POST",
            "/api/chat",
            json=payload.model_dump(exclude_none=True),
        ) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if line:
                    yield StreamChunk.model_validate_json(line)
