#!/bin/bash
# Remote command strings copied from the published LG games, then one URL only.
#
# galaxy-pacman/Bash/open-pacman.sh  (lg1):
#   ssh -Xnf lg@$lg " export DISPLAY=:0 ; chromium-browser URL --start-fullscreen --autoplay-policy=no-user-gesture-required /dev/null 2>&1 &"
# galaxy-pacman (slave):
#   ssh -Xnf lg@$lg " export DISPLAY=:0 ; chromium-browser URL --start-fullscreen /dev/null 2>&1 &"
# galaxy-asteroids/scripts/open.sh (slave):
#   sshpass -p $PW ssh -tXn $lg "export DISPLAY=:0 ; chromium-browser URL --start-fullscreen &" &
#
# /dev/null is a second Chromium URL. Pacman opens a junk tab. We omit it.
# Flags and spacing around DISPLAY stay as in those scripts.

pacman_chrome_cmd() {
  local url="$1"
  local extra="${2:-}"
  if [ -n "$extra" ]; then
    printf ' export DISPLAY=:0 ; chromium-browser %s --start-fullscreen %s 2>&1 &' "$url" "$extra"
  else
    printf ' export DISPLAY=:0 ; chromium-browser %s --start-fullscreen 2>&1 &' "$url"
  fi
}

asteroids_chrome_cmd() {
  local url="$1"
  local extra="${2:-}"
  if [ -n "$extra" ]; then
    printf 'export DISPLAY=:0 ; chromium-browser %s --start-fullscreen %s &' "$url" "$extra"
  else
    printf 'export DISPLAY=:0 ; chromium-browser %s --start-fullscreen &' "$url"
  fi
}

# close-arkanoid: wait for pkill (no -f on ssh itself).
ssh_pkill() {
  local host="$1"
  local remote="$2"
  ssh -n lg@"$host" "$remote"
}
