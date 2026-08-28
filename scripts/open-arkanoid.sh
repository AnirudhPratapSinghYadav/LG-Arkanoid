#!/bin/bash
# Open every Liquid Galaxy glass from lg1.
# Master: local Chromium on DISPLAY=:0.
# Slaves: ssh -Xnf lg@$host, then password SSH if needed.
# Slices are /1 left … /N right. Never npm run build here — install.sh already built dist/.
#
# Usage: bash open-arkanoid.sh [screens|password] [--screens N] [--frames N] [--password pw]
#        bash open-arkanoid.sh --map [N]   # print host→slice map, do not open Chromium

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
. "$SCRIPT_DIR/lib/ssh-key.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/ssh-password.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/chrome-remote.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/wait-health.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/pm2-game.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/open-one-frame.sh"

print_backup_urls() {
  local port="$1"
  local n=0 frame url master_slice=0
  echo ""
  echo "============================================================"
  echo "If ANY glass stays dark, sit AT THAT MACHINE and paste ONE line."
  echo "One master: lg1. QR is lg1's slice (ceil(N/2)), not always /2."
  echo "============================================================"
  for frame in "${FRAMES[@]:0:$NUM_SCREENS}"; do
    n=$((n + 1))
    if [ "$frame" = "lg1" ]; then
      master_slice=$n
      url="http://localhost:${port}/${n}"
    else
      url="http://lg1:${port}/${n}"
    fi
    echo "  $frame  slice /$n"
    echo "    chromium-browser --start-fullscreen '$url'"
  done
  if [ "$master_slice" -gt 0 ]; then
    echo "Master lg1 + QR → slice /$master_slice  (ceil($NUM_SCREENS/2) for odd walls)."
  fi
  echo "Laptop with no slaves — all slices on this PC:"
  n=0
  while [ "$n" -lt "$NUM_SCREENS" ]; do
    n=$((n + 1))
    echo "    http://127.0.0.1:${port}/$n"
  done
  echo "============================================================"
}

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
  print_backup_urls "${PORT:-8130}"
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

# Do not rebuild on launch. A phone SSH used to die at 45s while Vite ran.
# install.sh already built dist/.
if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
  export NODE_ENV=development
  echo "dist/ missing — serving web-client (run npm run build on the rig once)."
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

print_backup_urls "$port"
if [ "$failed" = 1 ]; then
  echo "Some slaves did not open. Sit at that machine and paste its Chromium line above, or fix SSH (ssh -Xnf lg@lg2 'echo ok') and run this script again."
  exit 1
fi
echo "Opened Chromium on all $NUM_SCREENS frames on port $port."
