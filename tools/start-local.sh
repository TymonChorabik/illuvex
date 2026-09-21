#!/bin/bash
# One-shot local startup for Illudesk.
#
# First run: installs dependencies, creates .env.local with a generated
# AUTH_SECRET, and sets up the local database (migrate + seed).
# Every run: starts the database and dev server (skipping whichever is
# already up) and opens the site + admin panel in the browser.
#
# Safe to run repeatedly — every step it takes is idempotent.

set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR" || { echo "Can't find the project at $PROJECT_DIR"; read -r -p "Press Enter to close..." _; exit 1; }

echo "Illudesk — local startup"
echo "========================"

# --- Node version -----------------------------------------------------------
REQUIRED_NODE="$(cat .nvmrc 2>/dev/null | tr -d '[:space:]')"

if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --shell bash)"
  fnm use --install-if-missing >/dev/null 2>&1
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  [ -n "$REQUIRED_NODE" ] && nvm install "$REQUIRED_NODE" >/dev/null 2>&1
  [ -n "$REQUIRED_NODE" ] && nvm use "$REQUIRED_NODE" >/dev/null 2>&1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found on PATH."
  echo "Install Node $REQUIRED_NODE (https://nodejs.org) or fnm (https://github.com/Schniz/fnm), then try again."
  read -r -p "Press Enter to close..." _
  exit 1
fi

CURRENT_NODE="$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)"
if [ -n "$REQUIRED_NODE" ] && [ "$CURRENT_NODE" != "$REQUIRED_NODE" ]; then
  echo "Warning: this project expects Node $REQUIRED_NODE, found $(node -v). Continuing anyway."
fi

# --- Environment file ---------------------------------------------------------
# Created before `npm install`: the postinstall step runs `prisma generate`,
# which reads DATABASE_URL from `.env` (via prisma.config.ts) and fails
# without it.
NEED_ENV=false
[ -f .env ] || NEED_ENV=true
[ -f .env.local ] || NEED_ENV=true

if [ "$NEED_ENV" = true ]; then
  echo "Setting up environment files..."
  [ -f .env ] || cp .env.example .env
  if [ ! -f .env.local ]; then
    cp .env.example .env.local
    SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" 2>/dev/null)"
    if [ -n "$SECRET" ]; then
      if sed --version >/dev/null 2>&1; then
        sed -i "s#^AUTH_SECRET=.*#AUTH_SECRET=$SECRET#" .env.local
      else
        sed -i '' "s#^AUTH_SECRET=.*#AUTH_SECRET=$SECRET#" .env.local
      fi
    fi
    echo "Generated a signing secret in .env.local."
    echo "(Optional: add ANTHROPIC_API_KEY / RESEND_API_KEY there later for the"
    echo " chat assistant and real emails — everything works without them.)"
  fi
fi

# --- Dependencies ------------------------------------------------------------
if [ ! -d node_modules ]; then
  echo ""
  echo "First run — installing dependencies (this can take a minute)..."
  npm install || { echo "npm install failed."; read -r -p "Press Enter to close..." _; exit 1; }
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

# --- Database ------------------------------------------------------------
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
    read -r -p "Press Enter to close..." _
    exit 1
  fi
fi

# --- Migrate + seed (idempotent — safe every run) ---------------------------
echo "Checking database schema..."
npm run db:migrate --silent
echo "Checking admin account..."
npm run db:seed --silent

# --- Dev server ------------------------------------------------------------
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
