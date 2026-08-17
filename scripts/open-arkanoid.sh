#!/bin/bash
# LG Arkanoid launcher (galaxy-pacman / galaxy-asteroids pattern).
#
# Usage: bash open-arkanoid.sh [<number_of_screens>|<lg_password>]
#        bash open-arkanoid.sh --screens <n> [--password <pw>]
#        bash open-arkanoid.sh --frames <n>    # print the frame map, launch nothing
#
# Supports 1..12 (typical LG: 3,5,7,9,12). With no argument the screen count is
# read from the rig personality.
#
# The first positional argument is overloaded on purpose. lg-retro-gaming's
# launcher runs `bash <openScript> lq`, i.e. it passes the LG *password* as $1
# (see lg-retro-gaming/server/index.js and galaxy-asteroids/scripts/open.sh,
# which does PW="$1"). A numeric $1 is therefore a screen count from a human or
# from the phone app, and a non-numeric $1 is LGRG handing us the password.
#
# Do not `wait` on Chromium — SSH from the phone app must return after launch.

ARG_SCREENS=""
ARG_PASSWORD=""
DRY_RUN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --frames)
      DRY_RUN=1
      if [[ "$2" =~ ^[0-9]+$ ]]; then ARG_SCREENS="$2"; shift; fi
      ;;
    --screens)
      ARG_SCREENS="$2"; shift
      ;;
    --password)
      ARG_PASSWORD="$2"; shift
      ;;
    -h|--help)
      sed -n '3,9p' "$0"; exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        ARG_SCREENS="$1"
      elif [ -n "$1" ]; then
        # LGRG contract: `bash open-arkanoid.sh <password>`.
        ARG_PASSWORD="$1"
      fi
      ;;
  esac
  shift
done
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

# Liquid Galaxy rig personality. DHCP drops /lg/personavars.txt on every frame
# (DHCP_LG_FRAMES, DHCP_LG_FRAMES_MAX, DHCP_RANDR); ${HOME}/etc/shell.conf then
# derives LG_FRAMES / LG_FRAMES_MAX from it. Same contract every LG game uses.
for persona in /lg/personavars.txt /home/lg/personavars.txt; do
  if [ -r "$persona" ]; then
    # shellcheck disable=SC1090
    . "$persona"
    echo "Loaded rig personality from $persona"
    break
  fi
done
if [ -f "${HOME}/etc/shell.conf" ]; then
  # shellcheck disable=SC1090
  . "${HOME}/etc/shell.conf"
fi

# Explicit argument wins, then the rig's own screen count, then server/.env.
if [ -n "$ARG_SCREENS" ]; then
  NUM_SCREENS="$ARG_SCREENS"
elif [ -n "$DHCP_LG_FRAMES_MAX" ]; then
  NUM_SCREENS="$DHCP_LG_FRAMES_MAX"
  echo "Screen count $NUM_SCREENS detected from rig personality."
fi

if [ -z "$NUM_SCREENS" ]; then
  echo "Error: could not determine the number of screens."
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

# Physical left→right hostname order on a Liquid Galaxy wall.
#
# The canonical mapping is documented by the rig itself: liquid-galaxy's
# home/lg/etc/shell.conf ships
#   LG_FRAMES=${DHCP_LG_FRAMES:-"lg6 lg7 lg8 lg1 lg2 lg3 lg4 lg5"}
# for an 8-frame rig. Generalised, left→right is
#   lg(n/2+2) .. lg(n)   (left wing, ascending toward the centre)
#   lg1 .. lg(n/2+1)     (lg1 is the centre frame on odd walls)
# so 3 screens are "lg3 lg1 lg2" and 5 screens are "lg4 lg5 lg1 lg2 lg3".
# Arkanoid's court is one continuous world, so this order is what keeps the
# ball travelling in a straight line across the wall.
lg_frame_order() {
  local n=$1 i
  FRAMES=()
  for i in $(seq $((n / 2 + 2)) "$n"); do FRAMES+=("lg$i"); done
  for i in $(seq 1 $((n / 2 + 1))); do FRAMES+=("lg$i"); done
}

# Keep the court centred on the master when the rig is wider than the match.
lg_center_window() {
  local n=$1 total=${#RIG_FRAMES[@]} master=0 start i
  for i in $(seq 0 $((total - 1))); do
    if [ "${RIG_FRAMES[$i]}" = "lg1" ]; then master=$i; break; fi
  done
  start=$((master - (n - 1) / 2))
  if [ "$start" -lt 0 ]; then start=0; fi
  if [ "$start" -gt $((total - n)) ]; then start=$((total - n)); fi
  FRAMES=("${RIG_FRAMES[@]:$start:$n}")
}

RIG_FRAMES=()
if [ -n "$LG_FRAMES" ]; then
  # shellcheck disable=SC2206
  RIG_FRAMES=($LG_FRAMES)
fi

if [ "${#RIG_FRAMES[@]}" -eq "$NUM_SCREENS" ]; then
  FRAMES=("${RIG_FRAMES[@]}")
  echo "Frame order taken from the rig's LG_FRAMES."
elif [ "${#RIG_FRAMES[@]}" -gt "$NUM_SCREENS" ]; then
  echo "Rig reports ${#RIG_FRAMES[@]} frames but launching $NUM_SCREENS — centring the court on lg1."
  lg_center_window "$NUM_SCREENS"
else
  echo "LG_FRAMES unusable for $NUM_SCREENS screens — using the standard LG order."
  lg_frame_order "$NUM_SCREENS"
fi
echo "Frame map L→R: ${FRAMES[*]}"

if [ -n "$DRY_RUN" ]; then
  screenNumber=0
  for frame in "${FRAMES[@]:0:$NUM_SCREENS}"; do
    screenNumber=$((screenNumber + 1))
    echo "  slice /$screenNumber -> $frame"
  done
  exit 0
fi

if [ ! -f "$SERVER_PATH" ]; then
  echo "Error: server entry not found at $SERVER_PATH"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Error: pm2 not found in PATH. Install with: npm i -g pm2"
  exit 1
fi

# 8130 keeps Arkanoid inside the LG game port family and out of the way of the
# ports the other games already claim: pong 8112, snake 8114, pacman 8128,
# asteroids 8129, and the lg-retro-gaming launcher itself on 3123.
port=${PORT:-8130}

# An explicit password (LGRG or --password) beats whatever server/.env carries.
if [ -n "$ARG_PASSWORD" ]; then
  LG_PASSWORD="$ARG_PASSWORD"
fi

if [ -z "$LG_PASSWORD" ]; then
  echo "LG_PASSWORD not set — using SSH keys (BatchMode)."
  SSH_CMD="ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
else
  export SSHPASS="$LG_PASSWORD"
  SSH_CMD="sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"
fi

export NUM_SCREENS="$NUM_SCREENS"
export PORT="$port"

# The court's aspect must match the frames. DHCP_RANDR is the rig's own rotation
# ("right" on a stock install = portrait frames), and server/.env may override it
# with LG_FRAME_ASPECT for unrotated panels or desk testing.
if [ -z "$LG_FRAME_ASPECT" ]; then
  export LG_RANDR="${DHCP_RANDR:-right}"
  echo "Frame rotation: $LG_RANDR (portrait unless 'normal'/'inverted')"
else
  echo "Frame aspect pinned by server/.env: $LG_FRAME_ASPECT"
fi
export LG_FRAME_ASPECT="${LG_FRAME_ASPECT:-}"

# Serve source tree if dist was never built (Pacman-style fallback).
if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
  export NODE_ENV=development
  echo "dist/ missing — serving web-client directly."
fi

PM2_ENV="NUM_SCREENS=$NUM_SCREENS PORT=$port NODE_ENV=$NODE_ENV LG_RANDR=$LG_RANDR LG_FRAME_ASPECT=$LG_FRAME_ASPECT"
if pm2 describe lg-arkanoid > /dev/null 2>&1; then
  echo "Restarting lg-arkanoid with $PM2_ENV..."
  NUM_SCREENS="$NUM_SCREENS" PORT="$port" NODE_ENV="$NODE_ENV" \
    LG_RANDR="$LG_RANDR" LG_FRAME_ASPECT="$LG_FRAME_ASPECT" \
    pm2 restart lg-arkanoid --update-env
else
  echo "Starting lg-arkanoid with $PM2_ENV..."
  NUM_SCREENS="$NUM_SCREENS" PORT="$port" NODE_ENV="$NODE_ENV" \
    LG_RANDR="$LG_RANDR" LG_FRAME_ASPECT="$LG_FRAME_ASPECT" \
    pm2 start "$SERVER_PATH" --name lg-arkanoid
fi

sleep 2

# --autoplay-policy is required or Chromium mutes the game until someone clicks
# the wall, which never happens on a rig. Window geometry is left to kiosk so
# portrait frames (DHCP_RANDR defaults to "right") are filled correctly.
CHROME_FLAGS="--kiosk --start-fullscreen --no-first-run --noerrdialogs --disable-infobars --incognito --disable-session-crashed-bubble --disable-pinch --overscroll-history-navigation=0 --autoplay-policy=no-user-gesture-required"

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
