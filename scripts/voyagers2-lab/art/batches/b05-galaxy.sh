#!/bin/sh
# The galaxy again: sky-fix-a's still failed `doubled` once darkened and reduced. Redrawn finer,
# alone, three copies (layouts.py sky-fix-d). Run from the repo root, after make.sh sky
# (the canvas reads parts/sky-second).
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/voyagers2-lab/art/gen.py"
P=scripts/voyagers2-lab/art/prompts
R=tmp/voyagers2-art/ref
$PY scripts/voyagers2-lab/art/layouts.py sky-fix-d
$G sky-fix-d --prompt-file $P/sky-fix-d.txt --format 1:1 --images $R/sky-fix-d.png
