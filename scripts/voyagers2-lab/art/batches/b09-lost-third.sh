#!/bin/sh
# The lost ending once more, over its second pass (card-ending-lost-b), with the `rex` and `nova`
# blocks that the second pass's prompt lacked and Nova's crew neck said outright. Run from the
# repo root after make.sh endings (the canvas reads tmp/voyagers2-art/snap/card-ending-lost-b).
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/voyagers2-lab/art/gen.py"
P=scripts/voyagers2-lab/art/prompts
R=tmp/voyagers2-art/ref
$PY scripts/voyagers2-lab/art/layouts2.py card-ending-lost-3 cast-lost
$G card-ending-lost-c --prompt-file $P/card-ending-lost-3.txt --format 1:1 --images $R/card-ending-lost-3.png $R/cast-lost.png
