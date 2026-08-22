#!/bin/bash
# nvm Node 16 + pm2 are missing from the PATH when the phone SSHes in.

load_nvm_node16() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    nvm use 16 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
  fi
  if command -v npm >/dev/null 2>&1; then
    local prefix
    prefix="$(npm config get prefix 2>/dev/null || true)"
    if [ -n "$prefix" ] && [ -d "$prefix/bin" ]; then
      export PATH="$prefix/bin:$PATH"
    fi
  fi
}

load_server_env() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    # shellcheck disable=SC1090
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
  fi
}

# Same files Pacman/Asteroids source: personavars then ~/etc/shell.conf
load_lg_personality() {
  local persona
  for persona in /lg/personavars.txt /home/lg/personavars.txt; do
    if [ -r "$persona" ]; then
      # shellcheck disable=SC1090
      . "$persona"
      echo "Loaded rig personality from $persona"
      break
    fi
  done
  if [ -f "${HOME}/etc/shell.conf" ]; then
    # shellcheck disable=SC1090
    . "${HOME}/etc/shell.conf"
  fi
}
