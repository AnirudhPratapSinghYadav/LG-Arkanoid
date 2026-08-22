#!/bin/bash
# Flags for open-arkanoid.sh. LGRG calls: bash open-arkanoid.sh <password>

parse_open_args() {
  ARG_SCREENS=""
  ARG_PASSWORD=""
  DRY_RUN=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --frames)
        DRY_RUN=1
        if [[ "$2" =~ ^[0-9]+$ ]]; then ARG_SCREENS="$2"; shift; fi
        ;;
      --screens)
        ARG_SCREENS="$2"; shift
        ;;
      --password)
        ARG_PASSWORD="$2"; shift
        ;;
      -h|--help)
        return 2
        ;;
      *)
        if [[ "$1" =~ ^[0-9]+$ ]]; then
          ARG_SCREENS="$1"
        elif [ -n "$1" ]; then
          ARG_PASSWORD="$1"
        fi
        ;;
    esac
    shift
  done
}
