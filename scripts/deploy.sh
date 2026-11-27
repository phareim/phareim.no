#!/usr/bin/env bash
# Signed push handler, called by sleeper-deploy.
# The body is in a function so bash has read all of it before a pull rewrites this file.
set -uo pipefail

main() {
  local repo result=0 before
  repo=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
  before=$(git -C "$repo" rev-parse HEAD)
  bash "$repo/servers/mw-world/deploy.sh" || result=$?
  bash "$repo/servers/feedback/deploy.sh" "$before" || result=$?
  bash "$repo/scripts/deploy-site.sh" --auto || result=$?
  return "$result"
}

main "$@"
exit
