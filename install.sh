#!/bin/bash
# ---------------------------------------------------------------------------
# install.sh
#
# One-time installation script for the LG Arkanoid game on a Liquid Galaxy
# master machine running Ubuntu. This script installs all system-level
# dependencies, clones the repository, installs Node.js packages, and
# configures pm2 to autostart the game server on reboot.
#
# Usage:
#   sudo bash install.sh
#
# This script must be run with root privileges (sudo) because it uses
# apt-get to install system packages.
# ---------------------------------------------------------------------------

set -e

# -- Install system-level dependencies ----------------------------------------

echo "Updating package lists..."
sudo apt-get update -y

echo "Installing nodejs, npm, chromium-browser, and sshpass..."
sudo apt-get install -y nodejs npm chromium-browser sshpass

# pm2 is a Node.js process manager. We install it globally so it can be
# invoked from any directory and can manage the game server process.
echo "Installing pm2 globally..."
sudo npm install -g pm2

# -- Clone the repository if it does not already exist -------------------------

PROJECT_DIR="$HOME/projects/LG-Arkanoid"

if [ -d "$PROJECT_DIR" ]; then
  echo "Project directory already exists at $PROJECT_DIR. Skipping clone."
else
  echo "Cloning the LG-Arkanoid repository..."
  mkdir -p "$HOME/projects"
  git clone https://github.com/AnirudhPratapSinghYadav/LG-Arkanoid.git "$PROJECT_DIR"
fi

# -- Install Node.js dependencies for the game server -------------------------

echo "Installing npm dependencies in the server directory..."
cd "$PROJECT_DIR/server"
npm install

# -- Configure pm2 to autostart on reboot -------------------------------------

# pm2 startup generates a system-level init script so that pm2 (and any
# processes it manages) will automatically restart after a machine reboot.
echo "Setting up pm2 autostart on reboot..."
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash

# Save the current pm2 process list so it can be restored on reboot.
pm2 save

echo ""
echo "Installation complete."
echo "To launch the game on the rig, run:"
echo "  bash ~/projects/LG-Arkanoid/Bash/open-arkanoid.sh <number_of_screens>"
