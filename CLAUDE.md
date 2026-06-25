# llm-qa-playground — Claude Code Context

## Project context
Portfolio project demonstrating production-grade LLM testing patterns for a QA Automation Engineer.
Tests Ollama (llama3.2:1b) directly via API — no UI layer. OWASP LLM Top 10 coverage via Allure tags.

## Tech stack
- Python 3.12, pytest 8.3.4, pytest-asyncio 0.24.0
- httpx 0.28.1 (HTTP client), pydantic 2.10.4 (data models)
- allure-pytest 2.13.5 (reporting), ruff 0.9.1 (linting)
- Ollama docker (llama3.2:1b on localhost:11434)

## Make commands
```
make docker-up      # start Ollama + pull model
make docker-down    # stop all containers
make test           # full suite in Docker
make test-llm       # only LLM behaviour tests
make test-api       # only API contract tests
make test-fast      # skip slow tests
make lint           # ruff check .
make format         # ruff format .
make clean          # wipe allure-results, caches
make allure-serve   # open Allure report in browser
```

## Windows users
`make` requires Git Bash or WSL. Alternatively run targets directly:
```
docker compose run --rm test-runner pytest -m llm --alluredir=allure-results
docker compose run --rm test-runner ruff check .
```

## Coding conventions
- Type hints on every function signature
- Pydantic v2 models for all data structures — never `dict[str, Any]`
- `ruff` strict: line-length 100, rules E/F/W/I/B/UP
- No `print()` anywhere in test or service code

## Where things go
| What | Where |
|---|---|
| New injection vector | `evals/fixtures/injection_payloads.json` |
| New jailbreak prompt | `evals/fixtures/jailbreak_prompts.json` |
| New factual QA item | `evals/fixtures/factual_qa.json` |
| New PII seed | `evals/fixtures/pii_seeds.json` |
| HTTP calls to Ollama | `services/ollama_service.py` only |
| Response data models | `models/` |

## Mandatory rules
1. Every test in `tests/llm/` MUST have `@allure.tag("LLM0X")` matching OWASP category
2. Every test in `tests/llm/` MUST produce `EvalResult` + attach as JSON to Allure on failure
3. All HTTP calls via `services/ollama_service.py` — no inline httpx in tests
4. All data models = Pydantic v2 — no `dict[str, Any]` returns
5. New attack vectors → `evals/fixtures/*.json`, NOT hardcoded in test files
6. Tests parametrized from JSON fixtures, never hardcoded payloads inline
7. No `print()` — use `allure.attach()` for all test evidence
8. API and performance tests (`tests/api/`, `tests/performance/`) use standard pytest asserts + `@allure.feature`/`@allure.story` — NOT `@allure.tag` or EvalResult
