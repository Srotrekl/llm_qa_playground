.PHONY: test test-llm test-api test-fast test-perf lint format docker-up docker-down clean allure-serve

DOCKER_RUN = docker compose run --rm test-runner

test:
	$(DOCKER_RUN) pytest --alluredir=allure-results

test-llm:
	$(DOCKER_RUN) pytest -m llm --alluredir=allure-results

test-api:
	$(DOCKER_RUN) pytest -m api --alluredir=allure-results

test-fast:
	$(DOCKER_RUN) pytest -m "not slow" --alluredir=allure-results

test-perf:
	$(DOCKER_RUN) pytest tests/performance/ -m performance -v --alluredir=allure-results

lint:
	$(DOCKER_RUN) ruff check .

format:
	$(DOCKER_RUN) ruff format .

docker-up:
	docker compose up -d ollama
	docker compose up ollama-init

docker-down:
	docker compose down

clean:
	rm -rf allure-results allure-report .pytest_cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

allure-serve:
	allure serve allure-results
