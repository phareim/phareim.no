#!/usr/bin/env bash
# Deploys mw-world on Sleeper after a push to phareim/phareim.no's master.
# Called by sleeper-deploy (~/github/sleeper/deploy-hook, scriptRepos).
# The site itself deploys to Cloudflare from GitHub Actions; this only pulls
# the checkout and restarts the realtime service when its code changed.
# The body is in a function so bash has read all of it before the pull
# rewrites this file.
set -euo pipefail

main() {
  local repo=/home/petter/github/phareim.no
  cd "$repo"
  local old new
  old=$(git rev-parse HEAD)
  git pull --ff-only --quiet
  new=$(git rev-parse HEAD)
  if [ "$old" = "$new" ]; then echo "mw-world: nothing new"; return 0; fi
  if git diff --quiet "$old" "$new" -- servers/mw-world themes/miniworld/net/protocol.ts; then
    echo "mw-world: unchanged in ${old:0:7}..${new:0:7}"
    return 0
  fi
  cd servers/mw-world
  npm ci --omit=dev --no-audit --no-fund
  # A restart drops everyone for a moment; the clients reconnect by themselves.
  pm2 restart mw-world
  echo "mw-world: restarted at ${new:0:7}"
}

main "$@"
exit
