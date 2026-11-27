"""Fail only when mypy errors exceed the recorded baseline."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASELINE_PATH = Path(__file__).resolve().parents[1] / "mypy-baseline.json"


def _error_count(output_path: str) -> int:
    raw = Path(output_path).read_bytes()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = raw.decode("utf-16")
    else:
        text = raw.decode("utf-8", errors="replace")
    return sum(": error:" in line for line in text.splitlines())


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(
            "usage: check_mypy_baseline.py <strict_output> <all_output>",
            file=sys.stderr,
        )
        return 2

    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    counts = {
        "strict": _error_count(argv[1]),
        "total": _error_count(argv[2]),
    }
    exceeded = [
        f"{name}: {count} > {baseline[name]} (baseline)"
        for name, count in counts.items()
        if count > baseline[name]
    ]
    if exceeded:
        print("mypy baseline exceeded:\n" + "\n".join(exceeded), file=sys.stderr)
        return 1

    print(
        "mypy baseline OK: "
        f"strict {counts['strict']}/{baseline['strict']}, "
        f"total {counts['total']}/{baseline['total']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
