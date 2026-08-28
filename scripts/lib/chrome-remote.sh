#!/bin/bash
# Remote command strings from published LG games, then one URL only.
#
# galaxy-pacman/Bash/open-pacman.sh (slave):
#   ssh -Xnf lg@$lg " export DISPLAY=:0 ; chromium-browser URL --start-fullscreen /dev/null 2>&1 &"
# galaxy-asteroids/scripts/open.sh (slave):
#   sshpass … ssh -tXn $lg "export DISPLAY=:0 ; chromium-browser URL --start-fullscreen &" &
#
# /dev/null is a second Chromium URL. Pacman opens a junk tab. We omit it.
# DISPLAY=:0 and --start-fullscreen stay as in those scripts.
# Stock LG images ship chromium-browser; some slaves only have chromium.

_remote_chrome_body() {
  local url="$1"
  local extra="${2:-}"
  printf 'export DISPLAY=:0 ; BIN=$(command -v chromium-browser || command -v chromium); [ -n "$BIN" ] && "$BIN" %s --start-fullscreen %s 2>&1 &' "$url" "$extra"
}

pacman_chrome_cmd() {
  local url="$1"
  local extra="${2:-}"
  printf ' %s' "$(_remote_chrome_body "$url" "$extra")"
}

asteroids_chrome_cmd() {
  local url="$1"
  local extra="${2:-}"
  _remote_chrome_body "$url" "$extra"
}

# ssh -Xnf returns 0 as soon as the remote shell backgrounds Chromium.
# Check the slave actually has a Chromium process before calling it launched.
slave_chromium_up() {
  local host="$1"
  local pw="${2:-}"
  local port="${3:-8130}"
  local check="pgrep -f 'chromium-browser.*:${port}/' >/dev/null 2>&1 || pgrep -f 'chromium.*:${port}/' >/dev/null 2>&1"
  if ssh -n -o ConnectTimeout=5 lg@"$host" "$check" 2>/dev/null; then
    return 0
  fi
  if [ -n "$pw" ] && command -v sshpass >/dev/null 2>&1; then
    export SSHPASS="$pw"
    sshpass -e ssh -n -o ConnectTimeout=5 "lg@$host" "$check" 2>/dev/null
    return $?
  fi
  return 1
}

# close-arkanoid: wait for pkill (no -f on ssh itself).
ssh_pkill() {
  local host="$1"
  local remote="$2"
  ssh -n lg@"$host" "$remote"
}
