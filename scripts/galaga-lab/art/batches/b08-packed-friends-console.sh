#!/bin/sh
# The friends, the rigs and two bosses packed at their size; the three console panels.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
$PY scripts/galaga-lab/art/layouts.py friends-d rigs-d boss-d console-left console-right console-band style-console
$G friends-d --prompt-file $P/friends-d.txt --format 1:1 --images $R/friends-d.png &
$G rigs-d --prompt-file $P/rigs-d.txt --format 1:1 --images $R/rigs-d.png &
$G boss-d --prompt-file $P/boss-d.txt --format 1:1 --images $R/boss-d.png &
$G console-left-a --prompt-file $P/console-left.txt --format 9:16 --images $R/console-left.png $R/style-console.png &
wait
$G console-right-a --prompt-file $P/console-right.txt --format 9:16 --images $R/console-right.png $R/style-console.png &
$G console-band-a --prompt-file $P/console-band.txt --format 16:9 --images $R/console-band.png $R/style-console.png &
wait
