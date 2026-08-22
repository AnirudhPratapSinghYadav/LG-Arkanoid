#!/bin/bash
# One physical frame. SSH is Pacman first, Asteroids second.
# Slice URL is left→right /N — not Pacman's ${lg:2} hostname digit.

open_one_frame() {
  local frame="$1"
  local screen_number="$2"
  local port="$3"
  local url extra remote

  if [ "$frame" = "lg1" ]; then
    url="http://localhost:${port}/${screen_number}"
  else
    url="http://lg1:${port}/${screen_number}"
  fi
  # Autoplay on every frame: center-screen TTS uses speechSynthesis; slaves that
  # become the center slice (odd walls) need the same Chromium flag as lg1.
  extra="--autoplay-policy=no-user-gesture-required"

  remote="$(pacman_chrome_cmd "$url" "$extra")"
  echo "Opening $frame → /$screen_number  (ssh -Xnf lg@$frame)"
  if ssh_pacman "$frame" "$remote"; then
    return 0
  fi

  if [ "$frame" = "lg1" ]; then
    echo "  SSH to lg1 failed — opening Chromium locally (laptop / VM)."
    DISPLAY=:0 nohup chromium-browser --start-fullscreen \
      --autoplay-policy=no-user-gesture-required "$url" \
      >/tmp/lg-arkanoid-chrome-lg1.log 2>&1 &
    disown || true
    return 0
  fi

  remote="$(asteroids_chrome_cmd "$url" "$extra")"
  if ssh_asteroids "$frame" "$remote" "${LG_PASSWORD:-}"; then
    echo "  Pacman ssh failed — Asteroids sshpass used (ssh -tXn $frame)."
    return 0
  fi

  echo "Warning: failed to open Chromium on $frame"
  echo "  From lg1 this must work with no password:"
  echo "    ssh -Xnf lg@$frame 'echo ok'"
  return 1
}
