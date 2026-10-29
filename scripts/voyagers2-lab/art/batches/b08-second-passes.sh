#!/bin/sh
# Batch 2's second passes (layouts2.py second_passes): the lost ending with the costume's head
# made this game's bear (flight helmet and goggles under the bowler; it came back too close to
# a famous animatronic bear) and the costume closed; the second act card squeezed into its
# 240 x 120 window and redrawn; the large buoy shrunk and redrawn. Run from the repo root after
# make.sh endings acts sky2 (the canvases read tmp/voyagers2-art/snap).
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/voyagers2-lab/art/gen.py"
P=scripts/voyagers2-lab/art/prompts
R=tmp/voyagers2-art/ref
$PY scripts/voyagers2-lab/art/layouts2.py card-ending-lost-2 card-act-2-2 sky-b2-fix cast-lost
$G card-ending-lost-b --prompt-file $P/card-ending-lost-2.txt --format 1:1 --images $R/card-ending-lost-2.png $R/cast-lost.png &
$G card-act-2-b --prompt-file $P/card-act-2-2.txt --format 16:9 --images $R/card-act-2-2.png tmp/voyagers2-art/raw/card-act-2-a.png &
$G sky-b2-fix --prompt-file $P/sky-b2-fix.txt --format 1:1 --images $R/sky-b2-fix.png &
wait
