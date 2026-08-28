#!/bin/bash
# Remote Chromium strings for Liquid Galaxy slaves.
# Pattern used on LG walls: DISPLAY=:0, --start-fullscreen, ssh -Xnf lg@host.
# Stock images ship chromium-browser; some slaves only have chromium.

_remote_chrome_body() {
  local url="$1"
  local extra="${2:-}"
  printf 'export DISPLAY=:0 ; BIN=$(command -v chromium-browser || command -v chromium); [ -n "$BIN" ] && "$BIN" %s --start-fullscreen %s 2>&1 &' "$url" "$extra"
}

key_chrome_cmd() {
  local url="$1"
  local extra="${2:-}"
  printf ' %s' "$(_remote_chrome_body "$url" "$extra")"
}

password_chrome_cmd() {
  local url="$1"
  local extra="${2:-}"
  _remote_chrome_body "$url" "$extra"
}

# ssh -Xnf returns 0 as soon as the remote shell backgrounds Chromium.
# Check the slave actually has a Chromium process on this slice URL.
slave_chromium_up() {
  local host="$1"
  local pw="${2:-}"
  local port="${3:-8130}"
  local slice="${4:-}"
  local needle=":${port}/"
  if [ -n "$slice" ]; then
    needle=":${port}/${slice}"
  fi
  local check="pgrep -f 'chromium.*${needle}' >/dev/null 2>&1"
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

local_chromium_up() {
  local port="${1:-8130}"
  local slice="${2:-}"
  local needle=":${port}/"
  if [ -n "$slice" ]; then
    needle=":${port}/${slice}"
  fi
  pgrep -f "chromium.*${needle}" >/dev/null 2>&1
}

ssh_pkill() {
  local host="$1"
  local remote="$2"
  ssh -n lg@"$host" "$remote"
}
