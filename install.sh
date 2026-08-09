#!/bin/bash
# LG Arkanoid Rig Installer Script
# Usage: bash install.sh
# Installs on the LG master (lg1). Prefer Node 16 via nvm on older Ubuntu/glibc rigs.

set -e

echo "Updating package lists..."
sudo apt-get update -y

echo "Installing system packages..."
sudo apt-get install -y curl chromium-browser sshpass build-essential

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

echo "Installing pm2..."
npm install -g pm2

PROJECT_DIR="$HOME/projects/LG-Arkanoid"

if [ -d "$PROJECT_DIR" ]; then
  echo "Repository exists at $PROJECT_DIR."
else
  echo "Cloning LG-Arkanoid repository..."
  mkdir -p "$HOME/projects"
  git clone https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid.git "$PROJECT_DIR"
fi

echo "Installing npm workspace packages..."
cd "$PROJECT_DIR"
npm install
echo "Building web client for production..."
npm run build

ENV_FILE="$PROJECT_DIR/server/.env"
touch "$ENV_FILE"
grep -q '^PORT=' "$ENV_FILE" || echo "PORT=3000" >> "$ENV_FILE"
grep -q '^NUM_SCREENS=' "$ENV_FILE" || echo "NUM_SCREENS=3" >> "$ENV_FILE"

read -s -p "Enter your Gemini API key (blank = offline commentary only): " geminiKey
echo ""
if [ -n "$geminiKey" ]; then
  if grep -q '^GEMINI_API_KEY=' "$ENV_FILE"; then
    sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$geminiKey|" "$ENV_FILE"
  else
    echo "GEMINI_API_KEY=$geminiKey" >> "$ENV_FILE"
  fi
fi

read -s -p "Enter the Liquid Galaxy Rig SSH password (default is 'lg'): " lgPass
echo ""
if [ -z "$lgPass" ]; then
  lgPass="lg"
fi
if grep -q '^LG_PASSWORD=' "$ENV_FILE"; then
  sed -i "s|^LG_PASSWORD=.*|LG_PASSWORD=$lgPass|" "$ENV_FILE"
else
  echo "LG_PASSWORD=$lgPass" >> "$ENV_FILE"
fi

if command -v ufw >/dev/null 2>&1; then
  echo "Allowing game port 3000 through ufw..."
  sudo ufw allow 3000/tcp || true
fi

echo "Setting up pm2 autostart..."
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash || true
pm2 save || true

echo "Installation complete."
echo "Launch with: bash ~/projects/LG-Arkanoid/scripts/open-arkanoid.sh <number_of_screens>"
echo "Supported screen counts: 1..12 (typical: 3,5,7,9,12)"
echo "Phone controller connects to master IP on port 3000 with the on-screen session token."
