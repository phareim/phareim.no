#!/bin/sh
# The title card's second pass (card-title-a taken apart and laid again under a plain top
# quarter: layouts.py card_collage) and the packed sheet of small sprites, a column each.
# Run from the repo root, after make.sh has snapped card-c348 and split sprites-a.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/voyagers2-lab/art/gen.py"
P=scripts/voyagers2-lab/art/prompts
R=tmp/voyagers2-art/ref
$PY scripts/voyagers2-lab/art/layouts.py card-title-2 style-faces sprites-d
$G card-title-b --prompt-file $P/card-title-2.txt --format 3:4 --images $R/card-title-2.png $R/style-faces.png &
$G sprites-d --prompt-file $P/sprites-d.txt --format 1:1 --images $R/sprites-d.png &
wait
