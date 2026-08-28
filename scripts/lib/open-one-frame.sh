#!/bin/bash
# Master Chromium is local on DISPLAY=:0 (no SSH to self).
# Slaves: key SSH first (ssh -Xnf lg@$frame), then password SSH.
# Slice URL is left→right /N. One master: lg1.

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

  if [ "$frame" = "lg1" ]; then
    echo "Opening master lg1 → /$screen_number  (local Chromium)"
    if command -v chromium-browser >/dev/null 2>&1; then
      DISPLAY=:0 nohup chromium-browser --start-fullscreen \
        --autoplay-policy=no-user-gesture-required "$url" \
        >/tmp/lg-arkanoid-chrome-lg1.log 2>&1 &
      disown || true
    elif command -v chromium >/dev/null 2>&1; then
      DISPLAY=:0 nohup chromium --start-fullscreen \
        --autoplay-policy=no-user-gesture-required "$url" \
        >/tmp/lg-arkanoid-chrome-lg1.log 2>&1 &
      disown || true
    else
      echo "Warning: chromium-browser is not on lg1 PATH. Sit at lg1 and paste:"
      echo "    chromium-browser --start-fullscreen '$url'"
      return 1
    fi
    sleep 1
    for _try in 1 2 3 4 5 6 7 8; do
      if local_chromium_up "$port" "$screen_number"; then
        return 0
      fi
      sleep 0.5
    done
    echo "Warning: Chromium did not stay up on lg1 for /$screen_number"
    echo "  Sit at lg1 and paste:"
    echo "    chromium-browser --start-fullscreen '$url'"
    return 1
  fi

  echo "Opening $frame → /$screen_number  (ssh -Xnf lg@$frame)"
  remote="$(key_chrome_cmd "$url" "$extra")"
  ssh_key_slave "$frame" "$remote" || true
  sleep 1
  if slave_chromium_up "$frame" "${LG_PASSWORD:-}" "$port" "$screen_number"; then
    return 0
  fi

  remote="$(password_chrome_cmd "$url" "$extra")"
  if ssh_password_slave "$frame" "$remote" "${LG_PASSWORD:-}"; then
    echo "  Key SSH did not start Chromium — password SSH used (ssh -Xnf lg@$frame)."
    sleep 1
    if slave_chromium_up "$frame" "${LG_PASSWORD:-}" "$port" "$screen_number"; then
      return 0
    fi
  fi

  echo "Warning: failed to open Chromium on $frame"
  echo "  From lg1 this must work with no password:"
  echo "    ssh -Xnf lg@$frame 'echo ok'"
  echo "  Sit at $frame and paste:"
  echo "    chromium-browser --start-fullscreen '$url'"
  return 1
}
