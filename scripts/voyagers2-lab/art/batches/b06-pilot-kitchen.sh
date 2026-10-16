#!/bin/sh
# Batch 2's pilot: the kitchen of the Deep Dish (240 x 180 on 4:3), taken all the way through
# before anything else is ordered. Run from the repo root.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/voyagers2-lab/art/gen.py"
P=scripts/voyagers2-lab/art/prompts
R=tmp/voyagers2-art/ref
$PY scripts/voyagers2-lab/art/layouts2.py room-kitchen style-room cast-kitchen
$G room-kitchen-a --prompt-file $P/room-kitchen.txt --format 4:3 --images $R/room-kitchen.png $R/style-room.png $R/cast-kitchen.png
