#!/bin/sh
# Three pick-ups that did not read and one mite that was too large, packed, a column each.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
$PY scripts/galaga-lab/art/layouts.py picks-f
$G picks-f --prompt-file scripts/galaga-lab/art/prompts/picks-f.txt --format 1:1 --images tmp/galaga-art/ref/picks-f.png
