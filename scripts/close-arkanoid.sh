#!/bin/bash
# LG Arkanoid Shutdown Script
# Usage: bash close-arkanoid.sh
# Only kills Chromium windows that were opened for this game's PORT.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

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

if [ -f "$SCRIPT_DIR/../server/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/../server/.env"
  set +a
fi

port=${PORT:-8130}

if [ -z "$LG_PASSWORD" ]; then
  echo "Warning: LG_PASSWORD not set. Assuming passwordless SSH keys."
  SSH_CMD="ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
else
  export SSHPASS="$LG_PASSWORD"
  SSH_CMD="sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
fi

FRAMES=()
for persona in /lg/personavars.txt /home/lg/personavars.txt; do
  if [ -r "$persona" ]; then
    # shellcheck disable=SC1090
    . "$persona"
    break
  fi
done
if [ -f "${HOME}/etc/shell.conf" ]; then
  # shellcheck disable=SC1090
  . "${HOME}/etc/shell.conf"
fi
LG_FRAMES="${LG_FRAMES:-$DHCP_LG_FRAMES}"

if [ -n "$LG_FRAMES" ]; then
  # shellcheck disable=SC2206
  FRAMES=($LG_FRAMES)
else
  echo "LG_FRAMES not found - falling back to lg2..lg12"
  for i in $(seq 2 12); do FRAMES+=("lg$i"); done
fi

for frame in "${FRAMES[@]}"; do
  if [ "$frame" = "lg1" ]; then
    continue
  fi
  echo "Killing Arkanoid Chromium on $frame (port $port)..."
  $SSH_CMD "lg@$frame" "pkill -f 'chromium-browser.*lg1:${port}/' 2>/dev/null || true" 2>/dev/null || true
done

echo "Killing Arkanoid Chromium on master (port $port)..."
pkill -f "chromium-browser.*localhost:${port}/" 2>/dev/null || true
pkill -f "chromium-browser.*lg1:${port}/" 2>/dev/null || true

echo "Stopping game server..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop lg-arkanoid 2>/dev/null || true
  pm2 delete lg-arkanoid 2>/dev/null || true
else
  echo "Warning: pm2 not in PATH — skip server stop."
fi

echo "Stopped all game components successfully."
