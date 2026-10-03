#!/usr/bin/env bash
# Sleeper builds committed master; Cloudflare continues serving the site.
set -euo pipefail
env_file="${PHAREIM_DEPLOY_ENV:-$HOME/.config/phareim-deploy/env}"
if [ -f "$env_file" ]; then set -a; source "$env_file"; set +a; fi
: "${CLOUDFLARE_API_TOKEN:?Load the Cloudflare token before running this script}"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-bb0db86d8a64a70337bb44f43d00e4e5}"
state="${PHAREIM_DEPLOY_STATE_DIR:-$HOME/.local/state/phareim-deploy}"
mkdir -p "$state"
exec 9>"$state/lock"
flock 9
automatic=0
if [ "${1:-}" = --auto ]; then automatic=1; shift; fi
repo=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
git -C "$repo" fetch origin master
revision=$(git -C "$repo" rev-parse "${1:-origin/master}^{commit}")
if [ "$automatic" = 1 ] && [ -f "$state/site" ] && [ "$(cat "$state/site")" = "$revision" ]; then
  echo "phareim.no already deployed from $revision"; exit 0
fi
workspace=$(mktemp -d /tmp/phareim-site.XXXXXX)
cleanup() {
  git -C "$repo" worktree remove --force "$workspace" 2>/dev/null || true
  rmdir "$workspace" 2>/dev/null || true
}
trap cleanup EXIT
git -C "$repo" worktree add --detach "$workspace" "$revision"
cd "$workspace"
heavy_run() { if command -v heavy >/dev/null 2>&1; then heavy -- "$@"; else "$@"; fi; }
echo "Building phareim.no from $revision"
heavy_run npm ci --include=dev --no-audit --no-fund
# Discover every test:* script so new games automatically join the deploy checks.
test_suites=$(node -e 'const p=require("./package.json"); console.log(Object.keys(p.scripts).filter(s=>s.startsWith("test:")).sort().join("\n"))')
while IFS= read -r suite; do
  [ -z "$suite" ] || heavy_run env -u pm_id NODE_ENV=test npm run "$suite"
done <<< "$test_suites"
heavy_run npm run typecheck
heavy_run npm run build
if [ "$automatic" = 1 ]; then
  git -C "$repo" fetch origin master
  if [ "$(git -C "$repo" rev-parse origin/master)" != "$revision" ]; then
    echo "A newer master is available; leaving publication to the queued deploy"; exit 0
  fi
fi
# Preserve the schema-before-code ordering from the retired Actions workflow.
npx --yes wrangler@4.128.0 d1 migrations apply phareim-leaderboard --remote
npx --yes wrangler@4.128.0 pages deploy dist --project-name=phareim-no --branch=master --commit-hash="$revision"
printf '%s\n' "$revision" > "$state/site"
echo "phareim.no deployed from $revision"
