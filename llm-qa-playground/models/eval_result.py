from enum import Enum

from pydantic import BaseModel, field_validator


class Verdict(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    INCONCLUSIVE = "INCONCLUSIVE"


class EvalResult(BaseModel):
    verdict: Verdict
    reason: str
    test_name: str
    prompt: str
    response: str
    metadata: dict[str, str] | None = None

    @field_validator("prompt", "response", mode="before")
    @classmethod
    def truncate_to_500(cls, v: str) -> str:
        """Truncate prompt/response fields to 500 characters."""
        return v[:500] if len(v) > 500 else v

    def to_allure_attachment(self) -> str:
        """Return a JSON string suitable for attaching to an Allure report.

        Returns:
            Indented JSON string of the full EvalResult.
        """
        return self.model_dump_json(indent=2)
