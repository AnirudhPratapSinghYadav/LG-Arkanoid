#!/bin/bash
# Start or restart the Node match process. Pin pm2@5.4.3 on Node 16.

start_or_restart_pm2() {
  local server_path="$1"
  local port="$2"
  if pm2 describe lg-arkanoid > /dev/null 2>&1; then
    NUM_SCREENS="$NUM_SCREENS" PORT="$port" NODE_ENV="$NODE_ENV" \
      LG_RANDR="$LG_RANDR" LG_FRAME_ASPECT="$LG_FRAME_ASPECT" \
      pm2 restart lg-arkanoid --update-env
  else
    NUM_SCREENS="$NUM_SCREENS" PORT="$port" NODE_ENV="$NODE_ENV" \
      LG_RANDR="$LG_RANDR" LG_FRAME_ASPECT="$LG_FRAME_ASPECT" \
      pm2 start "$server_path" --name lg-arkanoid
  fi
}
