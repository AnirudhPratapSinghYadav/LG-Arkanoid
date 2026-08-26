#!/bin/bash
# Copied from galaxy-asteroids/scripts/open.sh:
#   sshpass -p $PW ssh -tXn $lg "export DISPLAY=:0 ; chromium-browser … &" &
#
# Always lg@$host (Pacman does). Asteroids relies on ~/.ssh/config User lg;
# without it, `ssh -tXn lg2` tries the phone/operator user and the glass stays dark.
# Background the ssh like Asteroids. Do NOT timeout-kill — that SIGHUPs Chromium.

ssh_asteroids() {
  local host="$1"
  local remote="$2"
  local pw="$3"
  if [ -z "$pw" ] || ! command -v sshpass >/dev/null 2>&1; then
    return 1
  fi
  export SSHPASS="$pw"
  sshpass -e ssh -tXn "lg@$host" "$remote" >/tmp/lg-arkanoid-ssh-${host}.log 2>&1 &
  sleep 1
  return 0
}
