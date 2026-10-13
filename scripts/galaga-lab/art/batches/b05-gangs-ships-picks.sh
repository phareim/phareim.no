#!/bin/sh
# The four other gangs (the sheet that settles what each thing is; it comes back large),
# and the packed sheets of the ships and the pick-ups. Four at a time.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
$PY scripts/galaga-lab/art/layouts.py gang-hogs gang-lovemachines gang-chromons gang-noise picks-e ships-d
for g in hogs lovemachines chromons noise; do
  $G gang-$g-a --prompt-file $P/gang-$g.txt --format 1:1 --images $R/gang-$g.png tmp/galaga-art/raw/ships-b.png &
done
wait
$G picks-e --prompt-file $P/picks-e.txt --format 1:1 --images $R/picks-e.png &
$G ships-d --prompt-file $P/ships-d.txt --format 1:1 --images $R/ships-d.png &
wait
