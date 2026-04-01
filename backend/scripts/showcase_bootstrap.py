from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "frontend"
FRONTEND_DIST_INDEX = FRONTEND_DIR / "dist" / "index.html"
FRONTEND_NODE_MODULES = FRONTEND_DIR / "node_modules"
DATABASE_PATH = ROOT_DIR / "data" / "app.db"
SEED_SCRIPT = ROOT_DIR / "demo-data" / "seed.py"


def _run(command: list[str], cwd: Path) -> None:
    try:
        subprocess.run(command, cwd=str(cwd), check=True)
    except FileNotFoundError as exc:
        missing = command[0] if command else "command"
        raise RuntimeError(
            f"Required executable '{missing}' was not found on PATH."
        ) from exc


def _resolve_npm_executable() -> str:
    if os.name == "nt":
        candidates = ("npm.cmd", "npm")
    else:
        candidates = ("npm", "npm.cmd")

    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved

    raise RuntimeError("Required executable 'npm' was not found on PATH.")


def _backend_runtime_ready() -> bool:
    probe = subprocess.run(
        [
            sys.executable,
            "-c",
            "import fastapi, sqlalchemy, alembic, uvicorn, networkx, pandas",
        ],
        cwd=str(ROOT_DIR),
        check=False,
        capture_output=True,
        text=True,
    )
    return probe.returncode == 0


def _bootstrap_backend_dependencies() -> None:
    if _backend_runtime_ready():
        print("[showcase] Reusing existing backend runtime dependencies.")
        return

    print("[showcase] Backend dependencies missing, installing backend package.")
    _run([sys.executable, "-m", "pip", "install", "-e", "./backend"], ROOT_DIR)


def _bootstrap_node_modules(*, npm_executable: str) -> None:
    if FRONTEND_NODE_MODULES.exists():
        print("[showcase] Reusing existing frontend dependencies (frontend/node_modules).")
        return

    print("[showcase] frontend/node_modules not found, running npm install.")
    _run([npm_executable, "install"], FRONTEND_DIR)


def _bootstrap_frontend_build(*, npm_executable: str, force_rebuild: bool) -> None:
    if force_rebuild:
        print("[showcase] Frontend rebuild forced by flag.")
        _run([npm_executable, "run", "build"], FRONTEND_DIR)
        return

    if FRONTEND_DIST_INDEX.exists():
        print(
            "[showcase] Reusing existing frontend build (frontend/dist). "
            "Use --force-rebuild-frontend to rebuild."
        )
        return

    print("[showcase] frontend/dist not found, running npm run build.")
    _run([npm_executable, "run", "build"], FRONTEND_DIR)


def _bootstrap_demo_data(*, force_reseed: bool) -> None:
    if force_reseed:
        print("[showcase] Demo data reseed forced by flag.")
        _run([sys.executable, str(SEED_SCRIPT), "--reset", "--run-matching"], ROOT_DIR)
        return

    if DATABASE_PATH.exists():
        print(
            "[showcase] Reusing existing local database (data/app.db). "
            "Use --force-reseed-data to reset and reseed."
        )
        return

    print("[showcase] data/app.db not found, running demo-data seed.")
    _run([sys.executable, str(SEED_SCRIPT), "--reset", "--run-matching"], ROOT_DIR)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Prepare frontend build artifacts and local demo data for showcase mode."
    )
    parser.add_argument(
        "--force-rebuild-frontend",
        action="store_true",
        help="Always run frontend build, even when frontend/dist already exists.",
    )
    parser.add_argument(
        "--force-reseed-data",
        action="store_true",
        help="Always reset and reseed demo data, even when data/app.db already exists.",
    )
    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()

    _bootstrap_backend_dependencies()
    npm_executable = _resolve_npm_executable()
    _bootstrap_node_modules(npm_executable=npm_executable)
    _bootstrap_frontend_build(npm_executable=npm_executable, force_rebuild=args.force_rebuild_frontend)
    _bootstrap_demo_data(force_reseed=args.force_reseed_data)

    print("[showcase] Bootstrap complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
