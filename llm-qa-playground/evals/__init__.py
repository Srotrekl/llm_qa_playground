import json
from pathlib import Path

_FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixtures(filename: str) -> list[dict]:
    """Load a JSON fixture file from the evals/fixtures/ directory.

    Args:
        filename: Bare filename, e.g. ``"injection_payloads.json"``.

    Returns:
        List of fixture dicts parsed from the JSON file.

    Raises:
        FileNotFoundError: If the fixture file does not exist.
    """
    path = _FIXTURES_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Fixture file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))
