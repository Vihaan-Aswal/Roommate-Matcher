from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def _run_evaluate(*args: str) -> subprocess.CompletedProcess[str]:
    backend_root = Path(__file__).resolve().parents[2]
    script_path = backend_root / "scripts" / "evaluate.py"
    command = [sys.executable, str(script_path), *args]
    return subprocess.run(
        command,
        cwd=backend_root,
        capture_output=True,
        text=True,
        check=False,
    )


def test_evaluate_smoke_text_output_contains_required_sections() -> None:
    result = _run_evaluate("--scenario", "all", "--output", "text", "--seed", "7")

    assert result.returncode == 0, result.stderr
    assert "Scenario:" in result.stdout
    assert "Room" in result.stdout
    assert "Explanations for" in result.stdout
    assert "Fairness Summary:" in result.stdout
    assert "Privacy Check: PASS" in result.stdout


def test_evaluate_smoke_json_output_is_parseable() -> None:
    result = _run_evaluate("--scenario", "all", "--output", "json", "--seed", "7")

    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)

    assert "scenarios" in payload
    assert "fairness" in payload
    assert payload["privacy_check"] == "PASS"
    assert payload["scenarios"]
