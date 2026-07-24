#!/bin/bash
# ---------------------------------------------------------------------------
# close-arkanoid.sh
#
# Shutdown script for the LG Arkanoid game across a Liquid Galaxy rig.
# This script kills all Chromium browser instances on the master machine
# and on every slave machine (lg2 through lg9) via sshpass/SSH. It also
# stops the pm2-managed game server process.
#
# Usage:
#   bash close-arkanoid.sh
#
# Environment:
#   LG_PASSWORD  -- the SSH password for all lg@lgN machines
# ---------------------------------------------------------------------------

# -- Kill Chromium on all slave machines (lg2 through lg9) ---------------------

for i in $(seq 2 9); do
  echo "Killing Chromium on slave lg$i..."
  sshpass -p "$LG_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null lg@lg"$i" \
    "pkill -f chromium-browser" 2>/dev/null &
done

# -- Kill Chromium on the master machine (lg1) ---------------------------------

echo "Killing Chromium on master (lg1)..."
pkill -f chromium-browser 2>/dev/null

# -- Stop the pm2-managed game server -----------------------------------------

echo "Stopping the LG Arkanoid game server..."
pm2 stop lg-arkanoid 2>/dev/null
pm2 delete lg-arkanoid 2>/dev/null

# Wait briefly for all background SSH kill commands to finish.
wait

echo "All Chromium instances and the game server have been stopped."
