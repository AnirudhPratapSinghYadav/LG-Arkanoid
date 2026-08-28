#!/bin/bash
# Master Chromium is local (galaxy-asteroids/scripts/open.sh).
# Slaves: Pacman ssh -Xnf lg@$frame first, then Asteroids sshpass in background.
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
  extra="--autoplay-policy=no-user-gesture-required"

  # Asteroids opens lg1 Chromium on DISPLAY=:0 in this shell — no ssh to self.
  if [ "$frame" = "lg1" ]; then
    echo "Opening master lg1 → /$screen_number  (local Chromium, Asteroids pattern)"
    if command -v chromium-browser >/dev/null 2>&1; then
      DISPLAY=:0 nohup chromium-browser --start-fullscreen \
        --autoplay-policy=no-user-gesture-required "$url" \
        >/tmp/lg-arkanoid-chrome-lg1.log 2>&1 &
      disown || true
      return 0
    fi
    if command -v chromium >/dev/null 2>&1; then
      DISPLAY=:0 nohup chromium --start-fullscreen \
        --autoplay-policy=no-user-gesture-required "$url" \
        >/tmp/lg-arkanoid-chrome-lg1.log 2>&1 &
      disown || true
      return 0
    fi
    echo "Warning: chromium-browser is not on lg1 PATH. Sit at lg1 and paste:"
    echo "    chromium-browser --start-fullscreen '$url'"
    return 1
  fi

  remote="$(pacman_chrome_cmd "$url" "$extra")"
  echo "Opening $frame → /$screen_number  (ssh -Xnf lg@$frame)"
  if ssh_pacman "$frame" "$remote"; then
    return 0
  fi

  remote="$(asteroids_chrome_cmd "$url" "$extra")"
  if ssh_asteroids "$frame" "$remote" "${LG_PASSWORD:-}"; then
    echo "  Pacman ssh failed — Asteroids sshpass used (ssh -tXn lg@$frame)."
    return 0
  fi

  echo "Warning: failed to open Chromium on $frame"
  echo "  From lg1 this must work with no password:"
  echo "    ssh -Xnf lg@$frame 'echo ok'"
  return 1
}
