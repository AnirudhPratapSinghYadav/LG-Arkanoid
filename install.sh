#!/bin/bash
# LG Arkanoid Rig Installer Script
#
# Usage: bash install.sh [<lg_password>]
#
# Installs on the LG master (lg1). Prefer Node 16 via nvm on older Ubuntu/glibc rigs.
#
# Every published LG wall app takes the rig password as $1 and never prompts,
# so an installer triggered over SSH from a phone is not left waiting on stdin.
# We accept the same argument and only prompt when it is absent.

set -e

PW="$1"

echo "Updating package lists..."
sudo apt-get update -y

echo "Installing system packages..."
# speech-dispatcher + espeak-ng: Chromium speechSynthesis on Ubuntu LG masters.
# Without them the wall commentary panel updates but no audio leaves HDMI.
sudo apt-get install -y curl chromium-browser sshpass build-essential speech-dispatcher espeak-ng

# Unmute the default ALSA/Pulse path when present. Stock LG images often leave
# system audio muted.
if command -v amixer >/dev/null 2>&1; then
  amixer -q set Master unmute 80% 2>/dev/null || true
  amixer -q set PCM unmute 80% 2>/dev/null || true
fi
if command -v pactl >/dev/null 2>&1; then
  pactl set-sink-mute @DEFAULT_SINK@ 0 2>/dev/null || true
  pactl set-sink-volume @DEFAULT_SINK@ 80% 2>/dev/null || true
fi
if command -v spd-conf >/dev/null 2>&1 || command -v speech-dispatcher >/dev/null 2>&1; then
  echo "speech-dispatcher present — wall TTS can use espeak-ng."
fi

# Prefer nvm + Node 16 (glibc-safe on Ubuntu 16.04 LG images). Fall back to apt nodejs.
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt 16 ]]; then
  if [ ! -d "$HOME/.nvm" ]; then
    echo "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  # shellcheck disable=SC1090
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  echo "Installing Node.js 16 via nvm..."
  nvm install 16
  nvm alias default 16
  nvm use 16
else
  echo "Using existing Node $(node -v)"
fi

# pm2 6+/7 need Node >=18. Ubuntu 16.04 LG images run Node 16.20.2, so pin
# the last 5.x line that still supports Node 16 (EBADENGINE otherwise).
echo "Installing pm2@5.4.3 (Node 16 / Ubuntu 16.04)..."
npm install -g pm2@5.4.3

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -f "$SCRIPT_DIR/server/index.js" ]; then
  PROJECT_DIR="$SCRIPT_DIR"
  echo "Using existing checkout at $PROJECT_DIR"
else
  PROJECT_DIR="$HOME/projects/LG-Arkanoid"
  if [ -d "$PROJECT_DIR" ]; then
    echo "Repository exists at $PROJECT_DIR."
  else
    echo "Cloning LG-Arkanoid repository..."
    mkdir -p "$HOME/projects"
    git clone https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid.git "$PROJECT_DIR"
  fi
fi

if [ -d "$PROJECT_DIR/.git" ]; then
  echo "Pulling latest main from GitHub…"
  git -C "$PROJECT_DIR" fetch origin 2>/dev/null || true
  git -C "$PROJECT_DIR" pull --ff-only origin main 2>/dev/null \
    || git -C "$PROJECT_DIR" pull --ff-only 2>/dev/null \
    || echo "Note: git pull did not fast-forward. Using the files already in $PROJECT_DIR."
fi

# The Flutter app always launches
#   bash ~/projects/LG-Arkanoid/scripts/open-arkanoid.sh
# If this checkout lives
# anywhere else, point that canonical path at it so CONNECT LG → LAUNCH
# does not fail with "No such file" on a Lleida clone that is not named
# LG-Arkanoid.
CANONICAL_DIR="$HOME/projects/LG-Arkanoid"
mkdir -p "$HOME/projects"
if [ "$PROJECT_DIR" != "$CANONICAL_DIR" ]; then
  if [ -e "$CANONICAL_DIR" ] && [ ! -L "$CANONICAL_DIR" ]; then
    echo "Note: $CANONICAL_DIR already exists as a real directory. Phone LAUNCH uses that path."
  else
    ln -sfn "$PROJECT_DIR" "$CANONICAL_DIR"
    echo "Linked $CANONICAL_DIR -> $PROJECT_DIR so the phone launcher finds the scripts."
  fi
fi

# Skip downloading optional native toolchains; the rig only needs Node 16 + the
# workspace lockfile. helmet is 7.x on purpose (8.x needs Node 18).
echo "Installing npm workspace packages..."
cd "$PROJECT_DIR"
npm install
echo "Building web client for production..."
npm run build

ENV_FILE="$PROJECT_DIR/server/.env"
touch "$ENV_FILE"
# Default match port.
grep -q '^PORT=' "$ENV_FILE" || echo "PORT=8130" >> "$ENV_FILE"
grep -q 'LG_HOST_IP' "$ENV_FILE" || echo "# LG_HOST_IP=   # pin lg1 Wi-Fi IPv4 for the wall QR if getLanIp picks the wrong NIC" >> "$ENV_FILE"

# The rig knows how wide it is: DHCP writes DHCP_LG_FRAMES_MAX into
# /lg/personavars.txt on every frame. Prefer that over asking the installer.
RIG_SCREENS=""
for persona in /lg/personavars.txt /home/lg/personavars.txt; do
  if [ -r "$persona" ]; then
    RIG_SCREENS="$(grep -oP '(?<=DHCP_LG_FRAMES_MAX=).*' "$persona" | tr -d '"' | tr -d "'" || true)"
    [ -n "$RIG_SCREENS" ] && echo "Detected $RIG_SCREENS screens from $persona" && break
  fi
done
grep -q '^NUM_SCREENS=' "$ENV_FILE" || echo "NUM_SCREENS=${RIG_SCREENS:-3}" >> "$ENV_FILE"

# Skip the prompt entirely for a non-interactive install (password given as $1),
# otherwise an SSH-triggered install would hang here forever. GEMINI_API_KEY can
# still be set in server/.env afterwards; without it the game uses its offline
# commentary lines.
geminiKey=""
if [ -z "$PW" ]; then
  read -s -p "Enter your Gemini API key (blank = offline commentary only): " geminiKey
  echo ""
fi
if [ -n "$geminiKey" ]; then
  if grep -q '^GEMINI_API_KEY=' "$ENV_FILE"; then
    sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$geminiKey|" "$ENV_FILE"
  else
    echo "GEMINI_API_KEY=$geminiKey" >> "$ENV_FILE"
  fi
fi

# Stock Liquid Galaxy images use password lq for the lg user.
if [ -n "$PW" ]; then
  lgPass="$PW"
  echo "Using the LG password passed as an argument."
else
  read -s -p "Enter the Liquid Galaxy Rig SSH password (stock rigs use 'lq'): " lgPass
  echo ""
fi
if [ -z "$lgPass" ]; then
  lgPass="lq"
fi
if grep -q '^LG_PASSWORD=' "$ENV_FILE"; then
  sed -i "s|^LG_PASSWORD=.*|LG_PASSWORD=$lgPass|" "$ENV_FILE"
else
  echo "LG_PASSWORD=$lgPass" >> "$ENV_FILE"
fi

# Liquid Galaxy frames restore /etc/iptables.conf on every ifup
# (etc/network/if-pre-up.d/iptables), so a port that is not listed there is
# unreachable from the phones and the slave frames after the next reboot.
# Every LG game patches the same "tcp" line that already carries port 8111.
GAME_PORT="$(grep '^PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
GAME_PORT="${GAME_PORT:-8130}"
if [ -f /etc/iptables.conf ]; then
  if grep "tcp" /etc/iptables.conf | grep -q "8111" ; then
    if grep "tcp" /etc/iptables.conf | grep "8111" | grep -q "$GAME_PORT"; then
      echo "Port $GAME_PORT already open in /etc/iptables.conf."
    else
      echo "Opening port $GAME_PORT in /etc/iptables.conf..."
      LINE="$(grep "tcp" /etc/iptables.conf | grep "8111" | awk -F " -j" '{print $1}')"
      sudo sed -i "s/$LINE/$LINE,$GAME_PORT/g" /etc/iptables.conf || true
    fi
  else
    echo "Warning: no 8111 tcp rule in /etc/iptables.conf — open port $GAME_PORT manually."
  fi
fi
if command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "Allowing game port $GAME_PORT through ufw..."
  sudo ufw allow "$GAME_PORT"/tcp || true
fi

# Optional: register with the rig's game launcher (games.json) if it is installed.
LAUNCHER_GAMES=""
for candidate in /home/lg/lg-retro-gaming/server/games.json "$HOME/lg-retro-gaming/server/games.json"; do
  if [ -f "$candidate" ]; then LAUNCHER_GAMES="$candidate"; break; fi
done
if [ -n "$LAUNCHER_GAMES" ]; then
  echo "Registering Arkanoid with the rig launcher ($LAUNCHER_GAMES)..."
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const dir = process.argv[2];
    let games = {};
    try { games = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { games = {}; }
    games.arkanoid = {
      openScript: dir + "/scripts/open-arkanoid.sh",
      closeScript: dir + "/scripts/close-arkanoid.sh",
    };
    fs.writeFileSync(file, JSON.stringify(games, null, 2) + "\n");
  ' "$LAUNCHER_GAMES" "$PROJECT_DIR" && echo "Registered as game id \"arkanoid\"." \
    || echo "Warning: could not update $LAUNCHER_GAMES — add the arkanoid entry manually."
else
  echo "No rig game launcher found — skipping optional registration."
fi

echo "Setting up pm2 autostart..."
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash || true
# Empty dump is fine on a fresh install ("PM2 is not managing any process").
pm2 save --force || true

echo "Installation complete."
echo "Launch with: bash $PROJECT_DIR/scripts/open-arkanoid.sh <number_of_screens>"
echo "Phone CONNECT LG / LAUNCH uses: bash $HOME/projects/LG-Arkanoid/scripts/open-arkanoid.sh"
echo "Supported screen counts: 1..12 (typical: 3,5,7,9,12)"
echo "Before launch, from lg1:  ssh -Xnf lg@lg2 'echo ok'   (must not ask for a password)"
echo "Phone (same Wi-Fi as lg1): install the APK and scan the wall QR"
echo "  or open http://<lg1-ipv4>:$GAME_PORT/controller"
echo "Node must stay v16.x on this OS. Do not npm audit fix --force (that pulls pm2 7 / Node 18)."
