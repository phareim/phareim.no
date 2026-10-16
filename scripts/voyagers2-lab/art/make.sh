#!/bin/sh
# From the raw generations (tmp/voyagers2-art/raw, git-ignored) to the bitmaps the game ships
# (public/voyagers2). Run from the repo root:   sh scripts/voyagers2-lab/art/make.sh [set ...]
# sets: portraits card sky sprites (batch 1), rooms endings acts sky2 (batch 2)   (none: all)
# Needs nova's tools/art and its Python environment (README.md here).
set -e
PY="$HOME/.cache/nova-art-venv/bin/python"
A="$PY $HOME/github/nova/tools/art/art.py"
L=scripts/voyagers2-lab/art
R=tmp/voyagers2-art/raw
S=tmp/voyagers2-art/snap
P=tmp/voyagers2-art/parts
ST=tmp/voyagers2-art/stage
PAL=tmp/voyagers2-art/pal
mkdir -p $S $P $ST $PAL public/voyagers2
SETS="${*:-portraits card sky sprites rooms endings acts sky2}"
want() { case " $SETS " in *" $1 "*) return 0;; esac; return 1; }
quiet() { grep -v "^      " || true; }

# The portraits: sheets of nine, a person to a row. Every sheet comes back 256 cells across
# (4 px a cell); portraits.py cuts a 64 x 64 window out of each 85 px tile.
if want portraits; then
  for s in portraits-1a portraits-2a portraits-3a; do
    $A snap $R/$s.png -o $S/$s.png --cell 4.0 --colors 200 | quiet
  done
  $PY $L/portraits.py
fi

# The title card: the second pass (card-title-b), 240 cells across as its canvas (243 x 329;
# at 3.48 px, the cell the model drew in, it is 260 x 347 and its middle 240 cuts a fighter in
# half: the purity of the two is the same). card-title-a is snapped at 3.48 px:
# layouts.py builds the second pass's collage from it (card-c348).
if want card; then
  $A snap $R/card-title-a.png -o $S/card-c348.png --cell 3.48 --colors 64 | quiet
  $A snap $R/card-title-b.png -o $S/card-title-b.png --across 240 --colors 64 | quiet
fi

# The sky: two pieces to a picture, all on green (rust, brown and violet are too near
# magenta to cut cleanly), at the canvas's 4 px cells. The Hut and the moon ship from the
# first pictures. The first planet, galaxy and nebula were drawn in cells of 8 px and the
# first billboard was 166 x 116: those go to parts/sky-first, the canvases of the second
# passes (sky-fix-a, -b, -c: layouts.py), and the second passes ship (the first of each pair).
if want sky; then
  mkdir -p $P/sky $P/sky-first
  KG="--key green --key-tol 0.12 --fringe 3"
  for s in sky-a sky-b sky-c sky-fix-a sky-fix-b sky-fix-c; do
    $A snap $R/$s.png -o $S/$s.png --across 256 $KG --colors 200 | quiet
  done
  $A split $S/sky-a.png -o $P/sky-first --dir --names sky-planet,sky-galaxy | quiet
  $A split $S/sky-c.png -o $P/sky-first --dir --names sky-nebula,sky-billboard | quiet
  $A split $S/sky-b.png -o $P/sky --dir --names sky-hut,sky-moon | quiet
  $A split $S/sky-fix-a.png -o $P/sky --dir --names sky-planet,sky-galaxy | quiet
  mkdir -p $P/sky-second      # sky-fix-a's galaxy: the canvas of sky-fix-d
  $A split $S/sky-fix-a.png -o $P/sky-second --dir --names=-,sky-galaxy | quiet
  $A split $S/sky-fix-b.png -o $P/sky --dir --names=sky-nebula,- | quiet
  $A split $S/sky-fix-c.png -o $P/sky --dir --names=sky-billboard,- | quiet
  # the galaxy a third time (sky-fix-a's failed `doubled` once darkened): the first of three
  $A snap $R/sky-fix-d.png -o $S/sky-fix-d.png --across 256 $KG --colors 200 | quiet
  $A split $S/sky-fix-d.png -o $P/sky --dir --names=sky-galaxy,-,- | quiet
fi

# The small sprites: the first sheet (what each thing is, about 45 px) split; the packed
# sheet (ten columns, eight rows, 4 px cells) cut by its slots. choose.py picks a copy.
if want sprites; then
  K="--key magenta --key-tol 0.12 --fringe 3"
  $A snap $R/sprites-a.png -o $S/sprites-a.png --across 256 $K --colors 64 | quiet
  $A split $S/sprites-a.png -o $P/sprites-a --dir --names face-rat,face-bear,face-gorilla,face-hound,face-lion,face-slice,head-rat,head-bear,head-gorilla,head-hound | quiet
  $A snap $R/sprites-d.png -o $S/sprites-d.png --across 256 $K --colors 48 | quiet
  $PY $L/cut.py $S/sprites-d.png -o $P/sprites-d --slots 10,8,25,30,3,8 --by-col --names face-rat,face-bear,face-gorilla,face-hound,face-lion,face-slice,head-rat,head-bear,head-gorilla,head-hound | cut -c1-90
  # the second packed sheet: the same ten laid smaller (they came back a third large);
  # the faces ship from it (finish.py SPRITE_DIR)
  $A snap $R/sprites-e.png -o $S/sprites-e.png --across 256 $K --colors 48 | quiet
  $PY $L/cut.py $S/sprites-e.png -o $P/sprites-e --slots 10,10,21,24,23,8 --by-col --names face-rat,face-bear,face-gorilla,face-hound,face-lion,face-slice,head-rat,head-bear,head-gorilla,head-hound | cut -c1-90
  $PY $L/choose.py
fi

# ---- batch 2 ----
# The rooms of the Deep Dish: 4:3 over a canvas of 240 x 180 cells; the model draws finer
# (about 4.7 px for the canvas's 4.93), so each comes back about 253 x 186 and finish.py takes
# a 240 x 180 window (ROOMS) and paints the boards and the television screen flat.
if want rooms; then
  for s in room-kitchen-a room-hangar-a room-breakroom-a; do
    $A snap $R/$s.png -o $S/$s.png --across 240 --colors 64 | quiet
  done
fi
# The endings: 1:1 at 256 cells, a 240 x 200 window each (finish.py ENDINGS). The lost one
# ships from its second pass (b: the costume's head made this game's bear, the costume closed);
# the first is the canvas of that pass.
if want endings; then
  for s in card-ending-won-a card-ending-lost-a card-ending-lost-b; do
    $A snap $R/$s.png -o $S/$s.png --across 256 --colors 64 | quiet
  done
fi
# The act cards: 16:9 at 256 x 144 cells, a 240 x 120 window each (finish.py ACTS); act 2 ships
# from its second pass (b: the first squeezed into the window and redrawn); colours
# no closer than 0.034 (act 3's sky failed `banding` at the default 0.022).
if want acts; then
  for s in card-act-1-a card-act-2-a card-act-2-b card-act-3-a; do
    $A snap $R/$s.png -o $S/$s.png --across 256 --colors 64 --min-sep 0.034 | quiet
  done
fi
# The sky pieces of acts 2 and 3: three on green, cut by region (finish.py SKY2: the four mile
# markers stand apart and ship as one piece). make.sh endings acts sky2 must run before
# batches/b08 is run again: its canvases read these snaps.
if want sky2; then
  $A snap $R/sky-b2-a.png -o $S/sky-b2-a.png --across 256 --key green --key-tol 0.12 --fringe 3 --colors 200 | quiet
  # the large buoy again, shrunk and redrawn (it came back 63 x 92): the first of two copies
  $A snap $R/sky-b2-fix.png -o $S/sky-b2-fix.png --across 256 --key green --key-tol 0.12 --fringe 3 --colors 200 | quiet
fi

$PY $L/finish.py $SETS

# Each portrait is reduced once, to its own 32 colours.
figure() {
  $A palette build $ST/$1.png -o $PAL/$1.json --colors 32 --min-sep 0.034 > /dev/null
  $A palette apply $ST/$1.png --palette $PAL/$1.json --out-dir $PAL | cut -c1-110
  cp $PAL/$1.png public/voyagers2/$1.png
}
if want portraits; then
  for n in nonna-calm nonna-stern tiny-calm tiny-grin dougie-eager dougie-scared parmesan-calm parmesan-angry \
           mascot-rat mascot-bear mascot-gorilla mascot-hound; do
    figure portrait-$n
  done
fi
# The sky pieces: one palette of 24 for all six, no two colours close (they were darkened in
# finish.py, and close tones would band).
if want sky; then
  # the six by name: stage/ also holds batch 2's sky pieces, which have their own palette
  $A palette build $ST/sky-planet.png $ST/sky-galaxy.png $ST/sky-hut.png $ST/sky-moon.png \
    $ST/sky-nebula.png $ST/sky-billboard.png -o $PAL/sky.json --colors 24 --min-sep 0.034 | cut -c1-110
  for n in planet galaxy hut moon nebula billboard; do
    $A palette apply $ST/sky-$n.png --palette $PAL/sky.json --out-dir $PAL | cut -c1-110
    cp $PAL/sky-$n.png public/voyagers2/sky-$n.png
  done
fi
# The sky pieces of batch 2: their own palette of 24 (batch 1's six keep theirs untouched).
if want sky2; then
  $A palette build $ST/sky-truckstop.png $ST/sky-markers.png $ST/sky-buoy.png -o $PAL/sky2.json --colors 24 --min-sep 0.034 | cut -c1-110
  for n in truckstop markers buoy; do
    $A palette apply $ST/sky-$n.png --palette $PAL/sky2.json --out-dir $PAL | cut -c1-110
    cp $PAL/sky-$n.png public/voyagers2/sky-$n.png
  done
fi
