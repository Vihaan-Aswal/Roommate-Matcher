#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

print_usage() {
  cat <<'EOF'
Usage: ./start.sh [--rebuild-frontend] [--reseed-data]

Options:
  --rebuild-frontend   Force rebuild frontend/dist before launching.
  --reseed-data        Force reset + reseed data/app.db before launching.
  -h, --help           Show this help message.
EOF
}

FORCE_REBUILD=0
FORCE_RESEED=0

for arg in "$@"; do
  case "$arg" in
    --rebuild-frontend)
      FORCE_REBUILD=1
      ;;
    --reseed-data)
      FORCE_RESEED=1
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "[showcase] Unknown argument: $arg"
      print_usage
      exit 1
      ;;
  esac
done

if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
  PYTHON_EXE="$ROOT_DIR/.venv/bin/python"
elif [ -x "$ROOT_DIR/.venv/Scripts/python.exe" ]; then
  PYTHON_EXE="$ROOT_DIR/.venv/Scripts/python.exe"
else
  if command -v python3 >/dev/null 2>&1; then
    BOOTSTRAP_PYTHON="python3"
  elif command -v python >/dev/null 2>&1; then
    BOOTSTRAP_PYTHON="python"
  else
    echo "[showcase] Python executable not found."
    exit 1
  fi

  echo "[showcase] .venv not found, creating local virtual environment."
  "$BOOTSTRAP_PYTHON" -m venv "$ROOT_DIR/.venv"

  if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
    PYTHON_EXE="$ROOT_DIR/.venv/bin/python"
  elif [ -x "$ROOT_DIR/.venv/Scripts/python.exe" ]; then
    PYTHON_EXE="$ROOT_DIR/.venv/Scripts/python.exe"
  else
    echo "[showcase] Failed to locate Python in newly created .venv."
    exit 1
  fi
fi

echo "[showcase] Using Python runtime: $PYTHON_EXE"

if [ "$FORCE_REBUILD" -eq 1 ] && [ "$FORCE_RESEED" -eq 1 ]; then
  "$PYTHON_EXE" backend/scripts/showcase_bootstrap.py --force-rebuild-frontend --force-reseed-data
elif [ "$FORCE_REBUILD" -eq 1 ]; then
  "$PYTHON_EXE" backend/scripts/showcase_bootstrap.py --force-rebuild-frontend
elif [ "$FORCE_RESEED" -eq 1 ]; then
  "$PYTHON_EXE" backend/scripts/showcase_bootstrap.py --force-reseed-data
else
  "$PYTHON_EXE" backend/scripts/showcase_bootstrap.py
fi

echo "[showcase] Starting FastAPI at http://127.0.0.1:8000"
cd backend
exec "$PYTHON_EXE" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
