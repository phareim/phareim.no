#!/usr/bin/env bash
# Signed push handler, called by sleeper-deploy.
set -uo pipefail
repo=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
result=0
bash "$repo/servers/mw-world/deploy.sh" || result=$?
bash "$repo/scripts/deploy-site.sh" --auto || result=$?
exit "$result"
