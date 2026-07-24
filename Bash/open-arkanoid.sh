#!/bin/bash
# ---------------------------------------------------------------------------
# open-arkanoid.sh
#
# Launch script for the LG Arkanoid game across a Liquid Galaxy rig.
# This script starts the Node.js game server via pm2 and opens Chromium
# in kiosk mode on each screen of the rig. Screen 1 (the master) is
# opened locally; screens 2+ are opened on their respective slave
# machines via sshpass/SSH.
#
# Usage:
#   bash open-arkanoid.sh <number_of_screens>
#
# Environment:
#   LG_PASSWORD  -- the SSH password for all lg@lgN machines
# ---------------------------------------------------------------------------

# -- Validate arguments -------------------------------------------------------

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
  echo "Set it first, for example: export LG_PASSWORD='your_password'"
  exit 1
fi

# -- Start the game server via pm2 if it is not already running ----------------

# Check whether pm2 already has a process called lg-arkanoid.
# If it does, we skip starting it again to avoid duplicate processes.
if pm2 describe lg-arkanoid > /dev/null 2>&1; then
  echo "Game server is already running under pm2 (lg-arkanoid). Skipping start."
else
  echo "Starting the LG Arkanoid game server via pm2..."
  pm2 start ~/projects/LG-Arkanoid/server/index.js --name lg-arkanoid
fi

# Give the server a moment to bind to its port before we open browsers.
sleep 2

# -- Open Chromium on each screen of the rig -----------------------------------

for i in $(seq 1 "$NUM_SCREENS"); do

  if [ "$i" -eq 1 ]; then
    # Screen 1 is the master machine. Open Chromium locally.
    echo "Opening Chromium on master (screen 1)..."
    chromium-browser \
      --window-position=0,0 \
      --window-size=1920,1080 \
      --kiosk \
      --no-first-run \
      --disable-infobars \
      "http://localhost:8128/1" &

  else
    # Screens 2+ are slave machines named lg2, lg3, etc.
    # We use sshpass to supply the password non-interactively.
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

echo "All $NUM_SCREENS screens launched."
