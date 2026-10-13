#!/bin/sh
# Third passes of the pilot: each thing pasted at its size on the 4 px canvas (256 cells).
# And the first gang, over blocks on the same canvas, with the ships as the style image.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
$PY scripts/galaga-lab/art/layouts.py ships-3 picks-3 gang-glitterati
$G ships-c --prompt-file $P/ships-3.txt --format 1:1 --images $R/ships-3.png &
$G picks-c --prompt-file $P/picks-2.txt --format 1:1 --images $R/picks-3.png &
$G gang-glitterati-a --prompt-file $P/gang-glitterati.txt --format 1:1 --images $R/gang-glitterati.png tmp/galaga-art/raw/ships-b.png &
wait
