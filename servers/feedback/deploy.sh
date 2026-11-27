#!/usr/bin/env bash
# Deploys phareim-feedback on Sleeper after a push to phareim/phareim.no's master.
# Called by scripts/deploy.sh once the checkout is pulled; $1 is the sha before
# the pull. Restarts the service only when its code (or the shared session
# check) changed. The body is in a function so bash has read all of it before
# anything rewrites this file.
set -euo pipefail

main() {
  local repo=/home/petter/github/phareim.no
  cd "$repo"
  pm2 describe phareim-feedback >/dev/null 2>&1 || { echo "feedback: not started"; return 0; }
  if git diff --quiet "$1" HEAD -- servers/feedback server/utils/sessionCheck.ts themes/zelda/account.ts; then
    echo "feedback: unchanged"
    return 0
  fi
  cd servers/feedback
  npm ci --omit=dev --no-audit --no-fund
  pm2 restart phareim-feedback
  echo "feedback: restarted"
}

main "$@"
exit
