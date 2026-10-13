#!/bin/sh
# nova's gate over everything in public/galaga, by kind. Prints only the lines that matter:
# every file's verdict and the checks that failed.
#   sh scripts/galaga-lab/art/gate.sh
PY="$HOME/.cache/nova-art-venv/bin/python"
A="$PY $HOME/github/nova/tools/art/art.py"
G=public/galaga
echo "== things (under about 40 px): ships, pick-ups, valves, enemies"
$A gate $G/ship-*.png $G/pick-*.png $G/valve-*.png $G/enemy-*.png --kind thing || true
echo "== figures: bosses, friends, portraits"
$A gate $G/boss-*.png $G/rig-*.png $G/stranded-*.png $G/duo.png $G/portrait-*.png --kind figure || true
echo "== places: console, cards, sky pieces"
$A gate $G/console-*.png $G/card-*.png $G/bg-*.png --kind place || true
