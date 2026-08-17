#!/bin/bash
# LG Arkanoid launcher (galaxy-pacman pattern).
# Usage: bash open-arkanoid.sh <number_of_screens>
# Supports 1..12 (typical LG: 3,5,7,9,12).
#
# Do not `wait` on Chromium — SSH from the phone app must return after launch.

NUM_SCREENS=$1
export NODE_ENV=production

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
SERVER_PATH="$PROJECT_DIR/server/index.js"

# nvm Node/pm2 are not on the default SSH PATH used by the Flutter app.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use 16 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi
if command -v npm >/dev/null 2>&1; then
  NPM_PREFIX="$(npm config get prefix 2>/dev/null || true)"
  if [ -n "$NPM_PREFIX" ] && [ -d "$NPM_PREFIX/bin" ]; then
    export PATH="$NPM_PREFIX/bin:$PATH"
  fi
fi

if [ -f "$PROJECT_DIR/server/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/server/.env"
  set +a
fi

if [ -z "$NUM_SCREENS" ]; then
  echo "Error: please provide the number of screens as the first argument."
  echo "Usage: bash open-arkanoid.sh <number_of_screens>"
  exit 1
fi

if ! [[ "$NUM_SCREENS" =~ ^[0-9]+$ ]]; then
  echo "Error: <number_of_screens> must be numeric."
  exit 1
fi

if [ "$NUM_SCREENS" -lt 1 ] || [ "$NUM_SCREENS" -gt 12 ]; then
  echo "Error: number_of_screens must be in range 1..12."
  exit 1
fi

if [ ! -f "$SERVER_PATH" ]; then
  echo "Error: server entry not found at $SERVER_PATH"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Error: pm2 not found in PATH. Install with: npm i -g pm2"
  exit 1
fi

port=${PORT:-3000}

if [ -z "$LG_PASSWORD" ]; then
  echo "LG_PASSWORD not set — using SSH keys (BatchMode)."
  SSH_CMD="ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
else
  export SSHPASS="$LG_PASSWORD"
  SSH_CMD="sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
fi

export NUM_SCREENS="$NUM_SCREENS"
export PORT="$port"

# Serve source tree if dist was never built (Pacman-style fallback).
if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
  export NODE_ENV=development
  echo "dist/ missing — serving web-client directly."
fi

if pm2 describe lg-arkanoid > /dev/null 2>&1; then
  echo "Restarting lg-arkanoid with NUM_SCREENS=$NUM_SCREENS PORT=$port NODE_ENV=$NODE_ENV..."
  NUM_SCREENS="$NUM_SCREENS" PORT="$port" NODE_ENV="$NODE_ENV" pm2 restart lg-arkanoid --update-env
else
  echo "Starting lg-arkanoid with NUM_SCREENS=$NUM_SCREENS PORT=$port NODE_ENV=$NODE_ENV..."
  NUM_SCREENS="$NUM_SCREENS" PORT="$port" NODE_ENV="$NODE_ENV" pm2 start "$SERVER_PATH" --name lg-arkanoid
fi

sleep 2

if [ -f "${HOME}/etc/shell.conf" ]; then
  # shellcheck disable=SC1090
  . "${HOME}/etc/shell.conf"
fi

if [ -n "$LG_FRAMES" ]; then
  echo "Using LG_FRAMES: $LG_FRAMES"
  # shellcheck disable=SC2206
  FRAMES=($LG_FRAMES)
else
  echo "LG_FRAMES not set — falling back to lg1..lg$NUM_SCREENS"
  FRAMES=()
  for i in $(seq 1 "$NUM_SCREENS"); do FRAMES+=("lg$i"); done
fi

CHROME_FLAGS="--window-position=0,0 --window-size=1920,1080 --kiosk --no-first-run --disable-infobars --incognito --disable-session-crashed-bubble --disable-pinch --overscroll-history-navigation=0"

screenNumber=0
for frame in "${FRAMES[@]:0:$NUM_SCREENS}"; do
  screenNumber=$((screenNumber + 1))
  if [ "$frame" = "lg1" ]; then
    echo "Opening Chromium on master ($frame → /$screenNumber)..."
    pkill -f "chromium-browser.*:${port}/${screenNumber}" 2>/dev/null || true
    DISPLAY=:0 nohup chromium-browser $CHROME_FLAGS \
      "http://localhost:${port}/${screenNumber}" \
      >/tmp/lg-arkanoid-chrome-lg1.log 2>&1 &
    disown || true
  else
    echo "Opening Chromium on $frame → /$screenNumber..."
    REMOTE_CMD="pkill -f 'chromium-browser.*lg1:${port}/${screenNumber}' 2>/dev/null || true; DISPLAY=:0 nohup chromium-browser ${CHROME_FLAGS} 'http://lg1:${port}/${screenNumber}' >/tmp/lg-arkanoid-chrome.log 2>&1 &"
    $SSH_CMD lg@"$frame" "$REMOTE_CMD" || echo "Warning: failed to open Chromium on $frame"
  fi
done

echo "Launched $NUM_SCREENS screens on port $port."
