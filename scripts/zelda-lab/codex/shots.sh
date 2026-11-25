#!/bin/bash
# shots.sh <outDir> <repo> [extra PARAMS json for iso]: part 23's stills, by dusk and by day: classic, iso, iso with things:'classic'.
OUT=$(mkdir -p "$1" && cd "$1" && pwd); REPO=$2; XP=${3:-}
export CHROME_BIN=${CHROME_BIN:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
export LIVE=${LIVE:-$(cd "$(dirname "$0")/../../.." && pwd)/tmp/codex-kits/things/live/neon-shrine.json}
SC=${SC:-r-beach-1280,w-camp-390,w-camp-1280,w-lab-1280,r-home-1280,hut-1280,l-llama-1280,r-plaza-1280}
cd "$REPO"
run() { mkdir -p "$OUT/$1"; env "${@:2}" node scripts/zelda-lab/shot.mjs "$OUT/$1" $SC > /dev/null 2>"$OUT/$1/err.txt"; }
run classic X=1 &
run classic-sun DAY=sun &
run iso VIEW=iso &
wait
run iso-sun VIEW=iso DAY=sun &
if [ -n "$XP" ]; then run isooff VIEW=iso "PARAMS=$XP" & run isooff-sun VIEW=iso DAY=sun "PARAMS=$XP" & fi
wait
