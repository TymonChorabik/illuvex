#!/bin/bash
# Double-click this file to start Illudesk locally.
#
# First time: installs dependencies, sets up the local database, and creates
# an admin account (the login is printed in this window — save it).
# Every other time: just starts things up and opens your browser.
cd "$(dirname "$0")" || exit 1
exec bash tools/start-local.sh
