"""Enforce the quality gates from docs/quality/GOAL.md against coverage.json.

Usage: python scripts/check_coverage.py
Exit code 0 only when every gate passes. Run after pytest --cov --cov-report=json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

CORE_PACKAGES = (
    "app/services/matching/",
    "app/services/scoring/",
    "app/services/fairness/",
    "app/services/ingestion/",
)
MIN_LINE = 90.0
MIN_BRANCH = 85.0


def percent(covered: int, total: int) -> float:
    return 100.0 if total == 0 else round(100.0 * covered / total, 2)


def main() -> int:
    coverage_path = Path(__file__).resolve().parents[1] / "coverage.json"
    if not coverage_path.exists():
        print(f"missing {coverage_path}; run pytest --cov --cov-report=json first", file=sys.stderr)
        return 1

    data = json.loads(coverage_path.read_text(encoding="utf-8"))
    files = data["files"]
    statements = sum(item["summary"]["num_statements"] for item in files.values())
    covered_lines = sum(item["summary"]["covered_lines"] for item in files.values())
    branches = sum(item["summary"]["num_branches"] for item in files.values())
    covered_branches = sum(item["summary"]["covered_branches"] for item in files.values())

    line = percent(covered_lines, statements)
    branch = percent(covered_branches, branches)
    failures: list[str] = []

    print(f"overall line   {line:6.2f}%  (gate {MIN_LINE:.0f}%)")
    print(f"overall branch {branch:6.2f}%  (gate {MIN_BRANCH:.0f}%)")
    if line < MIN_LINE:
        failures.append(f"overall line {line}% < {MIN_LINE}%")
    if branch < MIN_BRANCH:
        failures.append(f"overall branch {branch}% < {MIN_BRANCH}%")

    for package in CORE_PACKAGES:
        package_files = {k: v for k, v in files.items() if k.replace("\\", "/").startswith(package)}
        package_statements = sum(v["summary"]["num_statements"] for v in package_files.values())
        package_covered = sum(v["summary"]["covered_lines"] for v in package_files.values())
        package_line = percent(package_covered, package_statements)
        print(f"{package:32s} {package_line:6.2f}%  (gate 100%)")
        if package_line < 100.0:
            missing = package_statements - package_covered
            failures.append(f"{package} {package_line}% < 100% ({missing} lines)")

    if failures:
        print("\nFAILED:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print("\ncoverage gates passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
