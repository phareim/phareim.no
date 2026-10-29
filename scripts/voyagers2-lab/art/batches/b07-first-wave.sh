#!/bin/sh
# Batch 2's first wave, after the kitchen pilot held: the hangar and the break room, both
# endings, the three act cards and the sky pieces of acts 2 and 3 (three on green). Three at a
# time. Run from the repo root.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/voyagers2-lab/art/gen.py"
P=scripts/voyagers2-lab/art/prompts
R=tmp/voyagers2-art/ref
$PY scripts/voyagers2-lab/art/layouts2.py
$G room-hangar-a --prompt-file $P/room-hangar.txt --format 4:3 --images $R/room-hangar.png $R/style-room.png $R/cast-hangar.png &
$G room-breakroom-a --prompt-file $P/room-breakroom.txt --format 4:3 --images $R/room-breakroom.png $R/style-room.png $R/cast-breakroom.png &
$G card-ending-won-a --prompt-file $P/card-ending-won.txt --format 1:1 --images $R/card-ending-won.png $R/style-ending.png $R/cast-won.png &
wait
$G card-ending-lost-a --prompt-file $P/card-ending-lost.txt --format 1:1 --images $R/card-ending-lost.png $R/style-ending.png $R/cast-lost.png &
$G card-act-1-a --prompt-file $P/card-act-1.txt --format 16:9 --images $R/card-act-1.png $R/style-act.png &
$G card-act-2-a --prompt-file $P/card-act-2.txt --format 16:9 --images $R/card-act-2.png $R/style-act.png &
wait
$G card-act-3-a --prompt-file $P/card-act-3.txt --format 16:9 --images $R/card-act-3.png $R/style-act.png &
$G sky-b2-a --prompt-file $P/sky-b2.txt --format 1:1 --images $R/sky-b2.png $R/style-sky.png &
wait
