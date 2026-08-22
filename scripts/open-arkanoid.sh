#!/bin/bash
# Open the wall the way Galaxy Pacman does, then Asteroids if keys fail.
#
# Pacman (every frame, including lg1):
#   ssh -Xnf lg@$lg " export DISPLAY=:0 ; chromium-browser <url> --start-fullscreen … &"
# Asteroids (slaves only):
#   sshpass … ssh -tXn $lg "export DISPLAY=:0 ; chromium-browser … &"
#
# Slice URLs stay /1 left … /N right (not Pacman's hostname digit).
#
# Usage: bash open-arkanoid.sh [screens|password] [--screens N] [--password pw] [--frames [N]]

set -u

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/parse-open-args.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/load-rig.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/frames.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/ssh-pacman.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/ssh-asteroids.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/chrome-remote.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/wait-health.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/pm2-game.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/open-one-frame.sh"

parse_open_args "$@"
if [ "$?" -eq 2 ]; then
  sed -n '3,12p' "$0"
  exit 0
fi

export NODE_ENV=production
load_nvm_node16
load_server_env "$PROJECT_DIR/server/.env"
load_lg_personality

if [ -n "${ARG_SCREENS:-}" ]; then
  NUM_SCREENS="$ARG_SCREENS"
elif [ -n "${DHCP_LG_FRAMES_MAX:-}" ]; then
  NUM_SCREENS="$DHCP_LG_FRAMES_MAX"
  echo "Screen count $NUM_SCREENS detected from rig personality."
fi

if [ -z "${NUM_SCREENS:-}" ] || ! [[ "$NUM_SCREENS" =~ ^[0-9]+$ ]]; then
  echo "Usage: bash open-arkanoid.sh <number_of_screens>"
  exit 1
fi
if [ "$NUM_SCREENS" -lt 1 ] || [ "$NUM_SCREENS" -gt 12 ]; then
  echo "Error: number_of_screens must be 1..12"
  exit 1
fi

resolve_lg_frames "$NUM_SCREENS"

if [ -n "${DRY_RUN:-}" ]; then
  n=0
  for frame in "${FRAMES[@]:0:$NUM_SCREENS}"; do
    n=$((n + 1))
    echo "  slice /$n -> $frame"
  done
  exit 0
fi

SERVER_PATH="$PROJECT_DIR/server/index.js"
if [ ! -f "$SERVER_PATH" ]; then
  echo "Error: missing $SERVER_PATH"
  exit 1
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Error: pm2 not in PATH. On this rig: npm i -g pm2@5.4.3"
  exit 1
fi

port=${PORT:-8130}
if [ -n "${ARG_PASSWORD:-}" ]; then
  LG_PASSWORD="$ARG_PASSWORD"
fi

export NUM_SCREENS PORT="$port"
LG_RANDR="${LG_RANDR:-}"
if [ -z "${LG_FRAME_ASPECT:-}" ]; then
  export LG_RANDR="${DHCP_RANDR:-right}"
  echo "Frame rotation: $LG_RANDR"
else
  echo "Frame aspect pinned by server/.env: $LG_FRAME_ASPECT"
fi
export LG_FRAME_ASPECT="${LG_FRAME_ASPECT:-}"
export LG_RANDR

if command -v npm >/dev/null 2>&1; then
  echo "Building wall client (dist/)…"
  (cd "$PROJECT_DIR" && npm run build) || echo "WARNING: npm run build failed — dist/ may be stale."
fi
if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
  export NODE_ENV=development
  echo "dist/ missing — serving web-client directly."
fi

start_or_restart_pm2 "$SERVER_PATH" "$port"
if ! wait_for_health "$port"; then
  echo "Server did not answer /health on port $port."
  echo "Not opening Chromium — that is how a wall stays dark after a false launch."
  exit 1
fi

failed=0
screenNumber=0
for frame in "${FRAMES[@]:0:$NUM_SCREENS}"; do
  screenNumber=$((screenNumber + 1))
  if ! open_one_frame "$frame" "$screenNumber" "$port"; then
    failed=1
  fi
  sleep 1
done

echo "Launched $NUM_SCREENS screens on port $port."
if [ "$failed" = 1 ]; then
  echo "Some slaves did not open. Fix SSH, then run this script again."
  exit 1
fi
