#!/bin/bash
# LG Arkanoid Shutdown Script
# Usage: bash close-arkanoid.sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
if [ -f "$SCRIPT_DIR/../server/.env" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/../server/.env"
fi

if [ -z "$LG_PASSWORD" ]; then
  echo "Warning: LG_PASSWORD not set. Assuming passwordless SSH keys."
  SSH_CMD="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
else
  export SSHPASS="$LG_PASSWORD"
  SSH_CMD="sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
fi

FRAMES=()
if [ -f "${HOME}/etc/shell.conf" ]; then
  # shellcheck disable=SC1090
  . "${HOME}/etc/shell.conf"
fi

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
  echo "Killing Chromium on $frame..."
  $SSH_CMD "lg@$frame" "pkill -f chromium-browser" 2>/dev/null &
done

echo "Killing Chromium on master..."
pkill -f chromium-browser 2>/dev/null

echo "Stopping game server..."
pm2 stop lg-arkanoid 2>/dev/null
pm2 delete lg-arkanoid 2>/dev/null

wait
echo "Stopped all game components successfully."
