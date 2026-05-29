"""Smoke test — verifies end-to-end connectivity with Ollama.

Usage:
    python scripts/smoke_test.py

Exits with code 0 on success, 1 on failure.
"""

import os
import sys

from services.ollama_service import OllamaService

BASE_URL = os.environ.get("OLLAMA_URL", os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"))
MODEL = os.environ.get("MODEL_NAME", "llama3.2:1b")


def main() -> None:
    with OllamaService(base_url=BASE_URL, default_model=MODEL) as service:
        if not service.health():
            print(f"ERROR: Ollama not reachable at {BASE_URL}")
            sys.exit(1)

        response = service.generate("Hello")

        assert response != "", "Response content must not be empty"
        print(f"OK: {response[:120]}")


if __name__ == "__main__":
    main()
