#!/bin/bash
# LG Arkanoid Shutdown Script
# Usage: bash close-arkanoid.sh

if [ -z "$LG_PASSWORD" ]; then
  echo "Error: LG_PASSWORD environment variable is not set."
  echo "Set it first: export LG_PASSWORD='your_password'"
  exit 1
fi

export SSHPASS="$LG_PASSWORD"

# Kill Chromium on slaves
for i in $(seq 2 9); do
  echo "Killing Chromium on slave lg$i..."
  sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 lg@lg"$i" \
    "pkill -f chromium-browser" 2>/dev/null &
done

# Kill Chromium on master
echo "Killing Chromium on master..."
pkill -f chromium-browser 2>/dev/null

# Stop game server
echo "Stopping game server..."
pm2 stop lg-arkanoid 2>/dev/null
pm2 delete lg-arkanoid 2>/dev/null

wait
echo "Stopped all game components successfully."
