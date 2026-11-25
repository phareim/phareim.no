#!/bin/bash
# draw.sh <kit> <sheet> [try=1]: one Codex image_gen drawing of a sheet (laid out by sheet.py), run in a fresh temp
# dir OUTSIDE any repo (codex reads a repo's AGENTS.md and may wander into it), with the sheet's guide and references
# attached in the order its refs.json names them. -> <work>/sheets/<sheet>/raw/out-<try>.png, codex-<try>.log
# PROMPT=<file> overrides the sheet's prompt.txt. Never run more than 4 at once (drawall.sh keeps to that).
set -u
here=$(cd "$(dirname "$0")" && pwd); repo=$(cd "$here/../../.." && pwd)
kit=$1; s=$2; n=${3:-1}
S=${CODEX_WORK:-$repo/tmp/codex-kits}/$kit/sheets/$s
[ -f "$S/guide.png" ] || { echo "no sheet $S (run sheet.py $kit)"; exit 1; }
d=$(mktemp -d "${TMPDIR:-/tmp}/codex-draw-$kit-$s-$n.XXXX")
imgs=(); for r in $(python3 -c "import json,sys; print(' '.join(json.load(open(sys.argv[1]))))" "$S/refs.json"); do cp "$S/$r" "$d/"; imgs+=("$d/$r"); done
start=$(date +%s)
bash "$here/codex.sh" "$d" "${PROMPT:-$S/prompt.txt}" "${imgs[@]}"
cp "$d/codex.log" "$S/raw/codex-$n.log"
if [ -f "$d/out.png" ]; then cp "$d/out.png" "$S/raw/out-$n.png"; echo "$kit/$s try $n: ok in $(( $(date +%s) - start )) s"
else echo "$kit/$s try $n: NO IMAGE after $(( $(date +%s) - start )) s (see raw/codex-$n.log)"; fi
rm -rf "$d"
