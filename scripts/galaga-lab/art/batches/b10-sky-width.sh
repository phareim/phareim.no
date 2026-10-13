#!/bin/sh
# Four sky pieces again, 180 wide, three to a canvas.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
$PY scripts/galaga-lab/art/layouts.py sky-fix-a sky-fix-b
$G sky-fix-a --prompt-file $P/sky-fix-a.txt --format 1:1 --images $R/sky-fix-a.png &
$G sky-fix-b --prompt-file $P/sky-fix-b.txt --format 1:1 --images $R/sky-fix-b.png &
wait
