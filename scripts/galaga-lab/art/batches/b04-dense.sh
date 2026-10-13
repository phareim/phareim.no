#!/bin/sh
# The packed sheets: does the model keep a small thing small when it has no room to grow?
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
$PY scripts/galaga-lab/art/layouts.py picks-d gang-glitterati-d
$G picks-d --prompt-file $P/picks-d.txt --format 1:1 --images $R/picks-d.png &
$G gang-glitterati-d --prompt-file $P/gang-glitterati-d.txt --format 1:1 --images $R/gang-glitterati-d.png &
wait
