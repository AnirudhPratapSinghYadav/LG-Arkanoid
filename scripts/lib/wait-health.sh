#!/bin/bash
# Wait until the match process answers /health before pointing Chromium at it.

wait_for_health() {
  local port="$1"
  local health_ok=0
  echo "Waiting for http://127.0.0.1:${port}/health …"
  for _i in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      health_ok=1
      break
    fi
    sleep 0.5
  done
  if [ "$health_ok" != 1 ]; then
    echo "Error: server not answering /health after 20s."
    return 1
  fi
  return 0
}
