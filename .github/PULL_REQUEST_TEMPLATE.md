## Summary
<!-- What does this PR do? -->

## Checklist
- [ ] New or updated tests added
- [ ] Every LLM test has `@allure.tag("LLM0X")` matching OWASP category
- [ ] Every LLM test produces and attaches `EvalResult` to Allure
- [ ] `make lint` passes — `ruff check .` returns 0 errors
- [ ] `make test-llm` green locally
