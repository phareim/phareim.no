#!/bin/sh
# The pilot: do small sprites hold on a canvas of 128 cells (8 px a cell)?
# Run from the repo root.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
$PY scripts/galaga-lab/art/layouts.py ships picks style-nova8 style-things8
$G ships-a --prompt-file $P/ships.txt --format 1:1 --images $R/ships.png $R/style-nova8.png &
$G picks-a --prompt-file $P/picks.txt --format 1:1 --images $R/picks.png $R/style-things8.png &
wait
