#!/bin/bash
# Copied from galaxy-asteroids/scripts/open.sh:
#   sshpass -p $PW ssh -tXn $lg "export DISPLAY=:0 ; chromium-browser … &" &
#
# Keep Asteroids flags: -tXn, hostname (User lg comes from ~/.ssh/config).
# Use sshpass -e so `ps` does not show the password (Asteroids uses -p).
# Asteroids backgrounds the whole ssh. We wait for the SSH exit code so a
# failed slave is not reported as launched (that was the Lleida dark-glass bug).

ssh_asteroids() {
  local host="$1"
  local remote="$2"
  local pw="$3"
  if [ -z "$pw" ] || ! command -v sshpass >/dev/null 2>&1; then
    return 1
  fi
  export SSHPASS="$pw"
  # Asteroids backgrounds the whole ssh. We wait (with a cap) for the exit
  # code so a failed slave is not reported as launched.
  if command -v timeout >/dev/null 2>&1; then
    timeout 12 sshpass -e ssh -tXn "$host" "$remote"
  else
    sshpass -e ssh -tXn "$host" "$remote"
  fi
}
