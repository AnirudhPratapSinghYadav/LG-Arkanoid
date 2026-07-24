#!/bin/bash
# LG Arkanoid Shutdown Script
# Usage: bash close-arkanoid.sh

# Kill Chromium on slaves
for i in $(seq 2 9); do
  echo "Killing Chromium on slave lg$i..."
  sshpass -p "$LG_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null lg@lg"$i" \
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
