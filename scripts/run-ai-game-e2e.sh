#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${AI_GAME_VLM_BASE_URL:?Set AI_GAME_VLM_BASE_URL to an OpenAI-compatible vision endpoint}"
: "${AI_GAME_VLM_MODEL:?Set AI_GAME_VLM_MODEL to a vision chat model}"
: "${AI_GAME_VLM_API_KEY:=dummy}"

export AI_GAME_AGENT_OUTPUT_DIR="${AI_GAME_AGENT_OUTPUT_DIR:-$ROOT/artifacts/ai-game-agent}"
if [[ -n "${AI_GAME_URL:-}" ]]; then
  export AI_GAME_EXTERNAL_URL=1
else
  export AI_GAME_URL="http://127.0.0.1:4173/game/"
fi
export DISPLAY="${DISPLAY:-:99}"

mkdir -p "$AI_GAME_AGENT_OUTPUT_DIR"

PYTHON_BIN="${PYTHON:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  else
    echo "python3/python not found" >&2
    exit 127
  fi
fi

VENV_DIR="${AI_GAME_PYTHON_VENV:-$ROOT/.venv-ai-game-e2e}"

if ! "$PYTHON_BIN" - <<'PY' >/dev/null 2>&1
import pyautogui, mss, PIL, requests
PY
then
  if [[ ! -x "$VENV_DIR/bin/python" ]]; then
    "$PYTHON_BIN" -m venv "$VENV_DIR"
  fi
  "$VENV_DIR/bin/python" -m ensurepip --upgrade >/dev/null 2>&1 || true
  if ! "$VENV_DIR/bin/python" -m pip --version >/dev/null 2>&1; then
    echo "pip unavailable in venv. Install python3-venv/python3-full, then retry." >&2
    exit 1
  fi
  "$VENV_DIR/bin/python" -m pip install -r requirements-ai-game-e2e.txt
  PYTHON_BIN="$VENV_DIR/bin/python"
fi

if [[ -z "${AI_GAME_SKIP_BUILD:-}" ]]; then
  npm run build:vercel
fi

XVFB_PID=""
if command -v Xvfb >/dev/null 2>&1 && ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  Xvfb "$DISPLAY" -screen 0 1280x800x24 -ac +extension GLX +render -noreset >/tmp/openpixel-xvfb.log 2>&1 &
  XVFB_PID="$!"
  sleep 1
fi

cleanup() {
  if [[ -n "$XVFB_PID" ]]; then
    kill "$XVFB_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

"$PYTHON_BIN" scripts/ai-game-agent-runner.py
