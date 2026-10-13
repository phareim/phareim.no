#!/bin/sh
# The four gangs packed at their size, and the six bosses, two to a picture. Four at a time.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
$PY scripts/galaga-lab/art/layouts.py gang-hogs-d gang-lovemachines-d gang-chromons-d gang-noise-d boss-a boss-b boss-c style-nova4
for g in hogs lovemachines chromons noise; do
  $G gang-$g-d --prompt-file $P/gang-$g-d.txt --format 1:1 --images $R/gang-$g-d.png &
done
wait
$G boss-a --prompt-file $P/boss-a.txt --format 1:1 --images $R/boss-a.png $R/style-nova4.png &
$G boss-b --prompt-file $P/boss-b.txt --format 1:1 --images $R/boss-b.png tmp/galaga-art/raw/ships-b.png &
$G boss-c --prompt-file $P/boss-c.txt --format 1:1 --images $R/boss-c.png tmp/galaga-art/raw/ships-b.png &
wait
