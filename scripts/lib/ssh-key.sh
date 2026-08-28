#!/bin/bash
# Key-based SSH to a slave, same flags Liquid Galaxy walls use:
#   ssh -Xnf lg@$host "export DISPLAY=:0 ; chromium … &"

ssh_key_slave() {
  local host="$1"
  local remote="$2"
  ssh -Xnf lg@"$host" "$remote"
}
