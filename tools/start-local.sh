#!/bin/bash
# Starts the local Illudesk dev environment: Postgres (PGlite) + Next.js dev
# server, then opens the site and admin panel in the browser. Safe to run
# again if things are already up — it detects that and just reopens the tabs.

set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PROJECT_DIR="$HOME/illuvex"
cd "$PROJECT_DIR" || { echo "Can't find $PROJECT_DIR"; read -r -p "Press Enter to close..." _; exit 1; }

echo "Illudesk — local startup"
echo "========================"

# Pick up the pinned Node version (see .nvmrc) via fnm, if installed.
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --shell bash)"
  fnm use --install-if-missing >/dev/null 2>&1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found on PATH. Open a normal terminal and check your Node install."
  read -r -p "Press Enter to close..." _
  exit 1
fi

DB_PID=""
DEV_PID=""

cleanup() {
  echo ""
  echo "Stopping..."
  [ -n "$DEV_PID" ] && kill "$DEV_PID" 2>/dev/null
  [ -n "$DB_PID" ] && kill "$DB_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

port_listening() {
  lsof -i ":$1" -sTCP:LISTEN >/dev/null 2>&1
}

STARTED_ANY=false

if port_listening 5433; then
  echo "Database already running on :5433"
else
  echo "Starting database..."
  npm run db:start >/tmp/illudesk-db.log 2>&1 &
  DB_PID=$!
  STARTED_ANY=true
  for _ in $(seq 1 30); do
    port_listening 5433 && break
    sleep 0.5
  done
  if ! port_listening 5433; then
    echo "Database didn't come up in time — check /tmp/illudesk-db.log"
  fi
fi

if port_listening 3000; then
  echo "Dev server already running on :3000"
else
  echo "Starting dev server..."
  npm run dev >/tmp/illudesk-dev.log 2>&1 &
  DEV_PID=$!
  STARTED_ANY=true
  for _ in $(seq 1 60); do
    port_listening 3000 && break
    sleep 0.5
  done
  if ! port_listening 3000; then
    echo "Dev server didn't come up in time — check /tmp/illudesk-dev.log"
  fi
fi

sleep 1
open "http://localhost:3000" 2>/dev/null
open "http://localhost:3000/admin" 2>/dev/null

echo ""
echo "Site:  http://localhost:3000"
echo "Admin: http://localhost:3000/admin"
echo ""

if [ "$STARTED_ANY" = true ]; then
  echo "Keep this window open while you work."
  echo "Close it (or press Ctrl+C) to stop the server and database."
  wait
else
  read -r -p "Already running. Press Enter to close this window... " _
fi
