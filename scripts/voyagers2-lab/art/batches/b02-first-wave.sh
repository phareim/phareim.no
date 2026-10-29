#!/bin/sh
# The second portrait sheet (Parmesan, the rat, the bear), the title card, the three sky
# pairs on green and the first sheet of small sprites (what each is; it comes back large).
# Three at a time. Run from the repo root.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/voyagers2-lab/art/gen.py"
P=scripts/voyagers2-lab/art/prompts
R=tmp/voyagers2-art/ref
$PY scripts/voyagers2-lab/art/layouts.py portraits style-portraits-mech card-title style-card style-faces sky-a sky-b sky-c style-sky sprites style-things
$G portraits-2a --prompt-file $P/portraits-2.txt --format 1:1 --images $R/portraits.png $R/style-portraits-mech.png &
$G card-title-a --prompt-file $P/card-title.txt --format 3:4 --images $R/card-title.png $R/style-card.png $R/style-faces.png &
$G sprites-a --prompt-file $P/sprites.txt --format 1:1 --images $R/sprites.png $R/style-things.png &
wait
$G sky-a --prompt-file $P/sky-a.txt --format 1:1 --images $R/sky-a.png $R/style-sky.png &
$G sky-b --prompt-file $P/sky-b.txt --format 1:1 --images $R/sky-b.png $R/style-sky.png &
$G sky-c --prompt-file $P/sky-c.txt --format 1:1 --images $R/sky-c.png $R/style-sky.png &
wait
