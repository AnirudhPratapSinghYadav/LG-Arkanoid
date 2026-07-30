#!/bin/bash
# LG Arkanoid Rig Installer Script
# Usage: sudo bash install.sh

set -e

echo "Updating package lists..."
sudo apt-get update -y

echo "Installing system packages..."
sudo apt-get install -y nodejs npm chromium-browser sshpass

echo "Installing pm2..."
sudo npm install -g pm2

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

read -p "Enter your Gemini API key (blank = offline commentary only): " geminiKey
if [ -n "$geminiKey" ]; then echo "GEMINI_API_KEY=$geminiKey" >> "$HOME/projects/LG-Arkanoid/server/.env"; fi

echo "Setting up pm2 autostart..."
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash
pm2 save

echo "Installation complete."
echo "Launch with: bash ~/projects/LG-Arkanoid/scripts/open-arkanoid.sh <number_of_screens>"
