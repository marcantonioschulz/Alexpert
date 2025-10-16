#!/usr/bin/env bash
set -euo pipefail

trap 'echo "[codex] Setup failed" >&2' ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE_DIR="${NPM_CONFIG_CACHE:-$HOME/.cache/codex/npm}"
NODE_PROJECTS_INPUT=${CODEX_NODE_PROJECTS:-"backend frontend my-project"}

IFS=' ' read -r -a NODE_PROJECTS <<<"$NODE_PROJECTS_INPUT"

mkdir -p "$CACHE_DIR"
export NPM_CONFIG_CACHE="$CACHE_DIR"
export NPM_CONFIG_FUND=false
export NPM_CONFIG_AUDIT=false
export NPM_CONFIG_PREFER_OFFLINE=true
export NPM_CONFIG_PROGRESS=false

if ! command -v npm >/dev/null 2>&1; then
  echo "[codex] npm is required but was not found on PATH" >&2
  exit 1
fi

run_install() {
  local package_dir="$1"
  local label="$2"

  if [ ! -d "$package_dir" ]; then
    echo "[codex] Skipping $label – directory not found"
    return 0
  fi

  if [ ! -f "$package_dir/package.json" ]; then
    echo "[codex] Skipping $label – no package.json"
    return 0
  fi

  if [ -d "$package_dir/node_modules" ]; then
    echo "[codex] Skipping $label – node_modules already present"
    return 0
  fi

  pushd "$package_dir" >/dev/null

  if [ -f package-lock.json ]; then
    echo "[codex] Installing $label dependencies with npm ci"
    npm ci --no-audit --no-fund --no-progress
  elif [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
    echo "[codex] Installing $label dependencies with pnpm install --frozen-lockfile"
    pnpm install --frozen-lockfile --ignore-scripts
  elif [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then
    echo "[codex] Installing $label dependencies with yarn install --frozen-lockfile"
    yarn install --frozen-lockfile --ignore-scripts
  else
    echo "[codex] Installing $label dependencies with npm install"
    npm install --no-audit --no-fund --no-progress
  fi

  popd >/dev/null
}

pids=()
labels=()

for project in "${NODE_PROJECTS[@]}"; do
  project_dir="$ROOT_DIR/$project"
  label="$project"

  run_install "$project_dir" "$label" &
  pids+=($!)
  labels+=("$label")
done

for idx in "${!pids[@]}"; do
  pid=${pids[$idx]}
  label=${labels[$idx]}
  if ! wait "$pid"; then
    echo "[codex] Dependency installation failed for $label" >&2
    exit 1
  fi
done

echo "[codex] Node dependencies ready"

setup_python_env() {
  local project_root="$1"
  local venv_dir="$project_root/.venv"
  local requirements_file=""

  if [ -f "$project_root/requirements.txt" ]; then
    requirements_file="$project_root/requirements.txt"
  elif [ -f "$project_root/pyproject.toml" ]; then
    requirements_file=""
  fi

  if [ -n "$requirements_file" ]; then
    if [ ! -d "$venv_dir" ]; then
      echo "[codex] Creating Python virtual environment"
      python3 -m venv "$venv_dir"
    fi

    # shellcheck disable=SC1091
    source "$venv_dir/bin/activate"
    python -m pip install --upgrade pip >/dev/null
    echo "[codex] Installing Python dependencies from $(basename "$requirements_file")"
    python -m pip install -r "$requirements_file"
    deactivate
  fi
}

if command -v python3 >/dev/null 2>&1; then
  setup_python_env "$ROOT_DIR"
fi

echo "[codex] Setup complete."
