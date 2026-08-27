#!/bin/bash
# Left→right hostnames. Must match server/lgFrameOrder.js.
# Do NOT copy Pacman's ${lg:2} slice number (lg5 → /5).
# One master: lg1 always runs the server. It is the center slice ceil(N/2).
#   3: lg3 lg1 lg2           QR /2
#   5: lg4 lg5 lg1 lg2 lg3     QR /3
#   7: lg5 lg6 lg7 lg1 … lg4   QR /4
#   9: lg6…lg9 lg1 … lg5       QR /5
#  12: lg8…lg12 lg1 … lg7      QR /6

lg_frame_order() {
  local n=$1 i
  FRAMES=()
  for i in $(seq $((n / 2 + 2)) "$n"); do FRAMES+=("lg$i"); done
  for i in $(seq 1 $((n / 2 + 1))); do FRAMES+=("lg$i"); done
}

lg_center_window() {
  local n=$1 total=${#RIG_FRAMES[@]} master=0 start i
  for i in $(seq 0 $((total - 1))); do
    if [ "${RIG_FRAMES[$i]}" = "lg1" ]; then master=$i; break; fi
  done
  start=$((master - (n - 1) / 2))
  if [ "$start" -lt 0 ]; then start=0; fi
  if [ "$start" -gt $((total - n)) ]; then start=$((total - n)); fi
  FRAMES=("${RIG_FRAMES[@]:$start:$n}")
}

resolve_lg_frames() {
  local n="$1"
  local listed="${LG_FRAMES:-}"
  RIG_FRAMES=()
  if [ -n "$listed" ]; then
    # shellcheck disable=SC2206
    RIG_FRAMES=($listed)
  fi
  if [ "${#RIG_FRAMES[@]}" -eq "$n" ]; then
    FRAMES=("${RIG_FRAMES[@]}")
    echo "Frame order taken from the rig's LG_FRAMES."
  elif [ "${#RIG_FRAMES[@]}" -gt "$n" ]; then
    echo "Rig reports ${#RIG_FRAMES[@]} frames but launching $n — centring on lg1."
    lg_center_window "$n"
  else
    echo "LG_FRAMES unusable for $n screens — using the standard LG order."
    lg_frame_order "$n"
  fi
  echo "Frame map L→R: ${FRAMES[*]}"
}
