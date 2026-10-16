#!/bin/sh
# nova's gate over everything in public/voyagers2, by kind. Run from the repo root:
#   sh scripts/voyagers2-lab/art/gate.sh
PY="$HOME/.cache/nova-art-venv/bin/python"
A="$PY $HOME/github/nova/tools/art/art.py"
G=public/voyagers2
echo "== things (under about 40 px): mascot faces, the slice, heads on springs"
ls $G/face-*.png $G/head-*.png > /dev/null 2>&1 && { $A gate $G/face-*.png $G/head-*.png --kind thing || true; }
echo "== figures: portraits"
ls $G/portrait-*.png > /dev/null 2>&1 && { $A gate $G/portrait-*.png --kind figure || true; }
echo "== places: the cards, the rooms, sky pieces"
places=$(ls $G/card-*.png $G/room-*.png $G/sky-*.png 2>/dev/null)   # whichever of them exist
[ -n "$places" ] && { $A gate $places --kind place || true; }
exit 0
