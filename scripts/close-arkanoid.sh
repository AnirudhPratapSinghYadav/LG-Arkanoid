#!/bin/bash
# Stop this game only: Chromium on this port, then pm2.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/load-rig.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/ssh-key.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/chrome-remote.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/ssh-password.sh"

load_nvm_node16
load_server_env "$SCRIPT_DIR/../server/.env"
load_lg_personality

port=${PORT:-8130}
LG_FRAMES="${LG_FRAMES:-${DHCP_LG_FRAMES:-}}"
FRAMES=()
if [ -n "$LG_FRAMES" ]; then
  # shellcheck disable=SC2206
  FRAMES=($LG_FRAMES)
else
  for i in $(seq 2 12); do FRAMES+=("lg$i"); done
fi

kill_remote="pkill -f 'chromium.*:${port}/' 2>/dev/null || true"

for frame in "${FRAMES[@]}"; do
  if [ "$frame" = "lg1" ]; then
    continue
  fi
  echo "Killing Chromium on $frame (port $port)…"
  if ! ssh_pkill "$frame" "$kill_remote"; then
    ssh_password_slave "$frame" "$kill_remote" "${LG_PASSWORD:-}" || true
  fi
done

echo "Killing Chromium on master…"
pkill -f "chromium.*localhost:${port}/" 2>/dev/null || true
pkill -f "chromium.*lg1:${port}/" 2>/dev/null || true
pkill -f "lg-arkanoid-chrome" 2>/dev/null || true

if command -v pm2 >/dev/null 2>&1; then
  pm2 stop lg-arkanoid 2>/dev/null || true
  pm2 delete lg-arkanoid 2>/dev/null || true
fi

echo "Stopped LG Arkanoid."
