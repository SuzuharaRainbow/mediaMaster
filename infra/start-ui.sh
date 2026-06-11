#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
else
  echo "[start-ui] docker compose plugin or docker-compose binary is required" >&2
  exit 1
fi

"${DOCKER_COMPOSE[@]}" -f "$COMPOSE_FILE" up mysql -d
"${DOCKER_COMPOSE[@]}" -f "$COMPOSE_FILE" up api -d
"${DOCKER_COMPOSE[@]}" -f "$COMPOSE_FILE" up web