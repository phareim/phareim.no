#!/bin/sh
# The friends (what each is), the rigs, the two bosses again at their size, and the four
# sheets of portraits. Four at a time.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
$PY scripts/galaga-lab/art/layouts.py friends rigs boss-fix portraits style-portraits
$G friends-a --prompt-file $P/friends.txt --format 1:1 --images $R/friends.png tmp/galaga-art/raw/ships-b.png &
$G rigs-a --prompt-file $P/rigs.txt --format 1:1 --images $R/rigs.png tmp/galaga-art/raw/ships-b.png &
$G boss-fix --prompt-file $P/boss-fix.txt --format 1:1 --images $R/boss-fix.png &
$G portraits-1a --prompt-file $P/portraits-1.txt --format 1:1 --images $R/portraits.png $R/style-portraits.png &
wait
$G portraits-2a --prompt-file $P/portraits-2.txt --format 1:1 --images $R/portraits.png $R/style-portraits.png &
$G portraits-3a --prompt-file $P/portraits-3.txt --format 1:1 --images $R/portraits.png $R/style-portraits.png &
$G portraits-4a --prompt-file $P/portraits-4.txt --format 1:1 --images $R/portraits.png $R/style-portraits.png &
wait
