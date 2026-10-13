#!/bin/sh
# The console's second passes (the first pictures scaled back, windows painted exact), the
# sky pieces two to a picture, and the two cards. Four at a time.
PY="$HOME/.cache/nova-art-venv/bin/python"
G="$PY scripts/galaga-lab/art/gen.py"
P=scripts/galaga-lab/art/prompts
R=tmp/galaga-art/ref
NS=$HOME/github/nova/docs/shots/art
$PY scripts/galaga-lab/art/windows.py second
$PY scripts/galaga-lab/art/layouts.py sky-1 sky-2 sky-3 sky-4 sky-5 card-title card-ending style-faces
$G console-left-b --prompt-file $P/console-left-2.txt --format 9:16 --images $R/console-left-2.png &
$G console-right-b --prompt-file $P/console-right-2.txt --format 9:16 --images $R/console-right-2.png &
$G console-band-b --prompt-file $P/console-band-2.txt --format 16:9 --images $R/console-band-2.png &
$G sky-1a --prompt-file $P/sky-1.txt --format 1:1 --images $R/sky-1.png tmp/galaga-art/raw/boss-c.png &
wait
$G sky-2a --prompt-file $P/sky-2.txt --format 1:1 --images $R/sky-2.png tmp/galaga-art/raw/boss-c.png &
$G sky-3a --prompt-file $P/sky-3.txt --format 1:1 --images $R/sky-3.png tmp/galaga-art/raw/boss-c.png &
$G sky-4a --prompt-file $P/sky-4.txt --format 1:1 --images $R/sky-4.png tmp/galaga-art/raw/boss-c.png &
$G sky-5a --prompt-file $P/sky-5.txt --format 1:1 --images $R/sky-5.png tmp/galaga-art/raw/boss-c.png &
wait
$G card-title-a --prompt-file $P/card-title.txt --format 3:4 --images $R/card-title.png $NS/card-title@4x.png $R/style-faces.png &
$G card-ending-a --prompt-file $P/card-ending.txt --format 1:1 --images $R/card-ending.png $NS/card-title@4x.png $R/style-faces.png &
wait
