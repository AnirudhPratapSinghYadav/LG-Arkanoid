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
  echo "Warning: LG_PASSWORD environment variable is not set."
  echo "Assuming SSH keys are configured for passwordless access."
  echo "Highly recommended: Set up SSH keys for better security."
  SSH_CMD="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
else
  SSH_CMD="sshpass -p $LG_PASSWORD ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
fi

# Start pm2 server if not running
export NUM_SCREENS="$NUM_SCREENS"
if pm2 describe lg-arkanoid > /dev/null 2>&1; then
  echo "Restarting with $NUM_SCREENS screens..."
  pm2 restart lg-arkanoid --update-env
else
  echo "Starting game server with $NUM_SCREENS screens..."
  SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
  SERVER_PATH="$SCRIPT_DIR/../server/index.js"
  pm2 start "$SERVER_PATH" --name lg-arkanoid
fi

sleep 2

# Open Chromium across rig displays
# Source LG shell configuration for frame list
if [ -f "${HOME}/etc/shell.conf" ]; then
  . "${HOME}/etc/shell.conf"
fi

# Determine the frame order to use
if [ -n "$LG_FRAMES" ]; then
  echo "Using LG_FRAMES from shell.conf: $LG_FRAMES"
  FRAMES=($LG_FRAMES)
else
  echo "LG_FRAMES not found – falling back to sequential lg1..lg$NUM_SCREENS"
  FRAMES=()
  for i in $(seq 1 "$NUM_SCREENS"); do FRAMES+=("lg$i"); done
fi

port=3000
screenNumber=0
for frame in "${FRAMES[@]:0:$NUM_SCREENS}"; do
  screenNumber=$((screenNumber + 1))
  if [ "$frame" = "lg1" ]; then
    echo "Opening Chromium on master ($frame, screen $screenNumber)..."
    chromium-browser \
      --window-position=0,0 \
      --window-size=1920,1080 \
      --kiosk \
      --no-first-run \
      --disable-infobars \
      --incognito \
      --disable-session-crashed-bubble \
      --disable-pinch \
      --overscroll-history-navigation=0 \
      "http://localhost:${port}/${screenNumber}" &
  else
    echo "Opening Chromium on $frame (screen $screenNumber)..."
    $SSH_CMD \
      lg@"$frame" \
      "DISPLAY=:0 chromium-browser \
        --window-position=0,0 \
        --window-size=1920,1080 \
        --kiosk \
        --no-first-run \
        --disable-infobars \
        --incognito \
        --disable-session-crashed-bubble \
        --disable-pinch \
        --overscroll-history-navigation=0 \
        'http://lg1:${port}/${screenNumber}' &" &
  fi
done


echo "Launched $NUM_SCREENS screens successfully."
