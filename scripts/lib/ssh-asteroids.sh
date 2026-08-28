#!/bin/bash
# Password SSH when lg1 has no key to the slave.
# Pacman uses ssh -Xnf (returns after starting the remote command).
# Asteroids used ssh -tXn … & and always continued; that reported success
# on a dark glass. We keep sshpass -e and lg@$host, and return ssh's exit.

ssh_asteroids() {
  local host="$1"
  local remote="$2"
  local pw="$3"
  if [ -z "$pw" ] || ! command -v sshpass >/dev/null 2>&1; then
    return 1
  fi
  export SSHPASS="$pw"
  sshpass -e ssh -Xnf "lg@$host" "$remote" >/tmp/lg-arkanoid-ssh-${host}.log 2>&1
}
