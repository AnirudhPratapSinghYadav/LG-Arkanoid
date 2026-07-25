#!/bin/bash
# LG Arkanoid Launcher Script
# Usage: bash open-arkanoid.sh <number_of_screens>

NUM_SCREENS=$1

if [ -z "$NUM_SCREENS" ]; then
  echo "Error: please provide the number of screens as the first argument."
  echo "Usage: bash open-arkanoid.sh <number_of_screens>"
  exit 1
fi

if ! [[ "$NUM_SCREENS" =~ ^[0-9]+$ ]]; then
  echo "Error: <number_of_screens> must be numeric."
  exit 1
fi

if [ "$NUM_SCREENS" -lt 1 ] || [ "$NUM_SCREENS" -gt 9 ]; then
  echo "Error: number_of_screens must be in range 1..9."
  exit 1
fi

if [ -z "$LG_PASSWORD" ]; then
  echo "Error: LG_PASSWORD environment variable is not set."
  echo "Set it first: export LG_PASSWORD='your_password'"
  exit 1
fi

# Start pm2 server if not running
export NUM_SCREENS="$NUM_SCREENS"
if pm2 describe lg-arkanoid > /dev/null 2>&1; then
  echo "Server already running under pm2."
else
  echo "Starting game server with $NUM_SCREENS screens..."
  pm2 start ~/projects/LG-Arkanoid/server/index.js --name lg-arkanoid
fi

sleep 2

# Open Chromium across rig displays
for i in $(seq 1 "$NUM_SCREENS"); do
  if [ "$i" -eq 1 ]; then
    echo "Opening Chromium on master (screen 1)..."
    chromium-browser \
      --window-position=0,0 \
      --window-size=1920,1080 \
      --kiosk \
      --no-first-run \
      --disable-infobars \
      "http://localhost:8128/1" &
  else
    echo "Opening Chromium on slave lg$i (screen $i)..."
    sshpass -p "$LG_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      lg@lg"$i" \
      "DISPLAY=:0 chromium-browser \
        --window-position=0,0 \
        --window-size=1920,1080 \
        --kiosk \
        --no-first-run \
        --disable-infobars \
        'http://lg1:8128/$i' &" &
  fi
done

echo "Launched $NUM_SCREENS screens successfully."
