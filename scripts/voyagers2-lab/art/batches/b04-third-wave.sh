#!/bin/sh
# The third portrait sheet (the gorilla, the hound, and a second bear further from any famous
# one), the small sprites again pasted smaller (they came back a third large), and the sky's
# second passes: the planet with the galaxy and the nebula redrawn at twice the fineness
# (they came back in 8 px cells), the billboard's board shrunk to 128 wide and redrawn.
# Run from the repo root.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/voyagers2-lab/art/gen.py"
P=scripts/voyagers2-lab/art/prompts
R=tmp/voyagers2-art/ref
$PY scripts/voyagers2-lab/art/layouts.py portraits style-portraits-mech sprites-e sky-fix-a sky-fix-b sky-fix-c
$G portraits-3a --prompt-file $P/portraits-3.txt --format 1:1 --images $R/portraits.png $R/style-portraits-mech.png &
$G sprites-e --prompt-file $P/sprites-e.txt --format 1:1 --images $R/sprites-e.png &
$G sky-fix-c --prompt-file $P/sky-fix-c.txt --format 1:1 --images $R/sky-fix-c.png &
wait
$G sky-fix-a --prompt-file $P/sky-fix-a.txt --format 1:1 --images $R/sky-fix-a.png &
$G sky-fix-b --prompt-file $P/sky-fix-b.txt --format 1:1 --images $R/sky-fix-b.png &
wait
