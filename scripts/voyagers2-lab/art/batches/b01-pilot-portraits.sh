#!/bin/sh
# The pilot: the first sheet of portraits (Nonna, Tiny, Dougie), taken all the way through
# before anything else is ordered. Run from the repo root.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/voyagers2-lab/art/gen.py"
P=scripts/voyagers2-lab/art/prompts
R=tmp/voyagers2-art/ref
$PY scripts/voyagers2-lab/art/layouts.py portraits style-portraits
$G portraits-1a --prompt-file $P/portraits-1.txt --format 1:1 --images $R/portraits.png $R/style-portraits.png
