#!/bin/sh
# Second passes of the pilot: each thing pasted at its size on the 8 px canvas.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
$PY scripts/galaga-lab/art/layouts.py ships-2 picks-2
$G ships-b --prompt-file $P/ships-2.txt --format 1:1 --images $R/ships-2.png &
$G picks-b --prompt-file $P/picks-2.txt --format 1:1 --images $R/picks-2.png &
wait
