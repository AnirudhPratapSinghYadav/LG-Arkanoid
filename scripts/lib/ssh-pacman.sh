#!/bin/bash
# Copied from galaxy-pacman/Bash/open-pacman.sh:
#   ssh -Xnf lg@$lg " export DISPLAY=:0 ; chromium-browser … &"
#
# liquid-galaxy already put lg-id_rsa + config + known_hosts on lg1.
# Pacman appends `|| true` so a dark slave still looks launched. We do not.

ssh_pacman() {
  local host="$1"
  local remote="$2"
  ssh -Xnf lg@"$host" "$remote"
}
