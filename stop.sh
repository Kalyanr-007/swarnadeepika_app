#!/usr/bin/env bash
# Stop the Swarna Deepika services started by install.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

stopped=0
for name in backend frontend; do
  pidfile="logs/${name}.pid"
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" && echo "Stopped $name (pid $pid)"
      stopped=$((stopped+1))
    fi
    rm -f "$pidfile"
  fi
done
if [ "$stopped" -eq 0 ]; then
  echo "Nothing to stop (no pid files in logs/)."
fi
