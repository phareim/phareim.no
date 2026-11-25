#!/usr/bin/env bash
# Codex draws one critter's frames as palette-letter rows (render/life/).
#   scripts/life-lab/draw.sh <id> <outDir> [extra notes…]
# Reads the idea from docs/art/life-catalog.json; writes <outDir>/<id>.frames.json
# ({ pal: {letter: '#hex'}, frames: {name: [rows]} }) and <outDir>/<id>.codex.log.
# Runs in a temp dir outside the repo (so Codex doesn't read the repo's docs).
set -euo pipefail
id=$1; out=$(realpath -m "$2"); shift 2
notes="${*:-}"
repo=$(cd "$(dirname "$0")/../.." && pwd)
mkdir -p "$out"
work=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/life-draw-$id-XXXX")
idea=$(node -e "const c=require('$repo/docs/art/life-catalog.json').find(x=>x.id==='$id'); if(!c){process.exit(3)} console.log(JSON.stringify(c,null,1))")
cat > "$work/brief.txt" <<BRIEF
You are a pixel artist drawing tiny animated sprites for "Neon Shrine", a top-down neon pixel-art adventure.
The world is mostly at dusk/night: deep blue, teal and violet ground; the neon accents are hot pink #ff2fa0,
cyan #2ff3ff, violet #9a6bff, gold #ffd23f and rose. The hero is 16x16 px; a tree crown is about 16-20 px.

Draw this critter (the design, from our catalogue):
$idea

$notes

Rules:
- Each frame at most 16x16 px; draw it at the size the design says. All frames of one pose set share a size
  where they are steps of the same motion, and the parts that should not move stay pixel-identical.
- Classic hand-drawn pixel art: a dark outline (not pure black: a deep plum or navy) where it helps the shape read
  against dark ground, 2-4 shades per material, a bright highlight; it must read as what it is at 1:1 and at 3x.
  Glowing parts use the brightest, most saturated colours; keep shadows cool.
- Palette: single ASCII letters or digits as keys (not '.'), '#rrggbb' values; any number of colours.
  '.' is transparent.
- Write the file frames.json in the current directory:
  { "pal": { "a": "#rrggbb", ... }, "frames": { "<frame name>": ["row", "row", ...], ... } }
  Frame names exactly as the design lists them (prefix "$id"). Every row of a frame the same length.
- Check your own work: print each frame as text and fix anything that does not read. Then reply DONE.
BRIEF
( cd "$work" && timeout 900 codex exec --skip-git-repo-check -C . -s workspace-write - < brief.txt > "$out/$id.codex.log" 2>&1 ) || true
if [ -f "$work/frames.json" ]; then cp "$work/frames.json" "$out/$id.frames.json"; echo "ok $out/$id.frames.json"; else echo "no frames.json (see $out/$id.codex.log)"; exit 1; fi
