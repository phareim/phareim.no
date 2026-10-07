#!/usr/bin/env bash
# Sleeper builds a committed branch; Cloudflare serves the site.
#
#   deploy-site.sh [--auto] [--branch <name>] [commit]
#
# master (the default) is production: phareim.no. Any other branch becomes a
# Pages preview under <branch>.phareim-no.pages.dev; `beta` is also served at
# beta.phareim.no. A preview runs the same tests, typecheck and build, shares
# production's database, and never applies migrations: a branch that needs a
# new table waits for master to get it.
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
branch=master
while [ $# -gt 0 ]; do
  case "$1" in
    --auto) automatic=1; shift ;;
    --branch) branch="${2:?--branch needs a name}"; shift 2 ;;
    *) break ;;
  esac
done
case "$branch" in *[!A-Za-z0-9._-]*) echo "bad branch name: $branch" >&2; exit 2 ;; esac
if [ "$branch" = master ]; then site=phareim.no; mark="$state/site"; else site="phareim.no ($branch)"; mark="$state/site-$branch"; fi
repo=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
# Name the ref on both sides: a checkout that tracks only master would not get origin/<branch> otherwise.
fetch_branch() { git -C "$repo" fetch origin "+refs/heads/$branch:refs/remotes/origin/$branch"; }
fetch_branch
revision=$(git -C "$repo" rev-parse "${1:-origin/$branch}^{commit}")
if [ "$automatic" = 1 ] && [ -f "$mark" ] && [ "$(cat "$mark")" = "$revision" ]; then
  echo "$site already deployed from $revision"; exit 0
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
echo "Building $site from $revision"
heavy_run npm ci --include=dev --no-audit --no-fund
# Discover every test:* script so new games automatically join the deploy checks.
test_suites=$(node -e 'const p=require("./package.json"); console.log(Object.keys(p.scripts).filter(s=>s.startsWith("test:")).sort().join("\n"))')
while IFS= read -r suite; do
  [ -z "$suite" ] || heavy_run env -u pm_id NODE_ENV=test npm run "$suite"
done <<< "$test_suites"
heavy_run npm run typecheck
heavy_run npm run build
if [ "$automatic" = 1 ]; then
  fetch_branch
  if [ "$(git -C "$repo" rev-parse "origin/$branch")" != "$revision" ]; then
    echo "A newer $branch is available; leaving publication to the queued deploy"; exit 0
  fi
fi
# Preserve the schema-before-code ordering from the retired Actions workflow.
# Production only: a preview shares the database and must not change it.
if [ "$branch" = master ]; then
  npx --yes wrangler@4.128.0 d1 migrations apply phareim-leaderboard --remote
fi
npx --yes wrangler@4.128.0 pages deploy dist --project-name=phareim-no --branch="$branch" --commit-hash="$revision"
printf '%s\n' "$revision" > "$mark"
echo "$site deployed from $revision"
