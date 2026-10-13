#!/bin/sh
# From the raw generations (tmp/galaga-art/raw, git-ignored) to the bitmaps the game ships
# (public/galaga). Run from the repo root:   sh scripts/galaga-lab/art/make.sh [set ...]
# sets: ships picks gangs bosses friends portraits console sky cards   (none: all of them)
# Needs nova's tools/art and its Python environment (README.md here).
set -e
PY="$HOME/.cache/nova-art-venv/bin/python"
A="$PY $HOME/github/nova/tools/art/art.py"
L=scripts/galaga-lab/art
R=tmp/galaga-art/raw
S=tmp/galaga-art/snap
P=tmp/galaga-art/parts
ST=tmp/galaga-art/stage
PAL=tmp/galaga-art/pal
K="--key magenta --key-tol 0.12 --fringe 3"
ROLES=grunt,flanker,tank,diver,sniper,splitter,mite,captor,raider
mkdir -p $S $P $ST $PAL public/galaga
SETS="${*:-ships picks gangs bosses friends portraits console sky cards}"
want() { case " $SETS " in *" $1 "*) return 0;; esac; return 1; }
quiet() { grep -v "^      " || true; }

# The two ships, straight and banked: a packed sheet, six columns, 4 px cells on 256.
if want ships; then
  $A snap $R/ships-d.png -o $S/ships-d.png --across 256 $K --colors 48 | quiet
  $PY $L/cut.py $S/ships-d.png -o $P/ships-d --slots 6,6,42,42,2,2 --by-col --names ship-rex,ship-nova,ship-rex-bank,ship-nova-bank,ship-rex,ship-nova | cut -c1-90
fi

# The pick-ups (twelve columns, nine rows) and under them the valves, lit and unlit in turn.
if want picks; then
  $A snap $R/picks-e.png -o $S/picks-e.png --across 256 $K --colors 64 | quiet
  $PY $L/cut.py $S/picks-e.png -o $P/picks-e --slots 12,9,21,21,2,4 --by-col --names pick-tube,pick-blaster,pick-disc,pick-boombox,pick-pizza,pick-bubble,pick-cb,pick-mirrorball,pick-tracking,pick-hairspray,pick-magnet,pick-quarter | cut -c1-90
  $PY $L/cut.py $S/picks-e.png -o $P/valves-e --slots 12,2,21,28,2,197 --by-col --names valve-on,valve-off | cut -c1-90
fi
# Three pick-ups that did not read on that sheet (the CB handset, the quarter, the VHS tape)
# and the Glitterati's mite, which was 18 x 19: again on a sheet of their own, a column each.
if want picks || want gangs; then
  $A snap $R/picks-f.png -o $S/picks-f.png --across 256 $K --colors 48 | quiet
  $PY $L/cut.py $S/picks-f.png -o $P/picks-f --slots 12,12,21,21,2,2 --by-col --names pick-cb,pick-quarter,pick-tracking,mite | cut -c1-90
fi

# The five gangs: packed sheets. The Glitterati kept the slots they were laid in (six by six,
# each role four times). The other four the model sorted into a column for each role, five
# rows: cut on the clear bands. The Road Hogs' sheet lost its sniper: it was ordered again
# with the friends (three columns of friends-d).
if want gangs; then
  for g in glitterati hogs lovemachines chromons noise; do
    $A snap $R/gang-$g-d.png -o $S/gang-$g-d.png --across 256 $K --colors 48 | quiet
  done
  $PY $L/cut.py $S/gang-glitterati-d.png -o $P/glitterati-d --slots 6,6,42,42,2,2 --names $ROLES | cut -c1-90
  $PY $L/cut.py $S/gang-hogs-d.png -o $P/hogs-d2 --bands --names grunt,flanker,tank,diver,splitter,mite,captor,raider | cut -c1-90
  for g in lovemachines chromons noise; do
    $PY $L/cut.py $S/gang-$g-d.png -o $P/$g-d2 --bands --names $ROLES | cut -c1-90
  done
fi

# The bosses: two to a picture, at the picture's 4 px cells; all colours kept (they are
# reduced once, each on its own, below). The Knight and the organ are taken from a packed
# sheet (K D K over D K K) that brought them down to size.
if want bosses; then
  mkdir -p $P/bosses
  for b in a b c d; do
    $A snap $R/boss-$b.png -o $S/boss-$b.png --across 256 $K --colors 200 | quiet
  done
  $A split $S/boss-a.png -o $P/bosses --dir --names=-,boss-fader | quiet
  $A split $S/boss-b.png -o $P/bosses --dir --names boss-humdinger,boss-cal | quiet
  $A split $S/boss-c.png -o $P/bosses --dir --names=boss-deafstar,- | quiet
  $PY $L/cut.py $S/boss-d.png -o $P/bosses-d --bands --row 0 --names boss-knight,boss-durant,-
  cp $P/bosses-d/boss-knight~0.png $P/bosses/boss-knight.png
  cp $P/bosses-d/boss-durant~0.png $P/bosses/boss-durant.png
fi

# The friends: the stranded ships and the Pigeon, packed, four rows; with them the Road Hogs'
# sniper. The rigs: a row of cabs, the row of six rigs, a row of cabs: the middle row.
if want friends || want gangs; then
  $A snap $R/friends-d.png -o $S/friends-d.png --across 256 $K --colors 200 | quiet
  $PY $L/cut.py $S/friends-d.png -o $P/friends-d --bands --names stranded-babs,stranded-ridley,stranded-lena,duo,sniper,sniper,sniper | cut -c1-90
  mkdir -p $P/hogs-fix $P/friends
  for i in 0 1 2 3 4 5 6 7 8 9 10 11; do cp $P/friends-d/sniper~$i.png $P/hogs-fix/; done
fi
if want friends; then
  $A snap $R/rigs-d.png -o $S/rigs-d.png --across 256 $K --colors 200 | quiet
  $PY $L/cut.py $S/rigs-d.png -o $P/rigs-d --bands --row 1 --names rig-marge,rig-duckie,rig-barton,rig-marge,rig-duckie,rig-barton
  for n in stranded-babs stranded-ridley stranded-lena duo; do cp $P/friends-d/$n~0.png $P/friends/$n.png; done
  for n in rig-marge rig-duckie rig-barton; do cp $P/rigs-d/$n~0.png $P/friends/$n.png; done
fi

# The portraits: four sheets of nine, a person to a row. Every sheet comes back 256 cells
# across (4 px a cell); portraits.py cuts a 64 x 64 window out of each 85 px tile, 32 colours.
if want portraits; then
  for i in 1 2 3 4; do
    $A snap $R/portraits-${i}a.png -o $S/portraits-${i}a.png --cell 4.0 --colors 200 | quiet
  done
  $PY $L/portraits.py
fi

# The console: the second passes, snapped with no key (windows.py clears the magenta itself
# and squares the windows; see its opening lines).
if want console; then
  # The first pictures, and from them the second passes' canvases (tmp/galaga-art/ref) and
  # the record of where each window was painted (tmp/galaga-art/console-*-2.json), which
  # windows.py needs to name the windows that came back.
  mkdir -p tmp/galaga-art/ref
  $A snap $R/console-left-a.png -o $S/console-left-a.png --across 256 --key none --colors 64 | quiet
  $A snap $R/console-right-a.png -o $S/console-right-a.png --across 256 --key none --colors 64 | quiet
  $A snap $R/console-band-a.png -o $S/console-band-a.png --across 340 --key none --colors 64 | quiet
  $PY $L/windows.py second | quiet
  $A snap $R/console-left-b.png -o $S/console-left-b.png --across 256 --key none --colors 64 | quiet
  $A snap $R/console-right-b.png -o $S/console-right-b.png --across 256 --key none --colors 64 | quiet
  $A snap $R/console-band-b.png -o $S/console-band-b.png --across 340 --key none --colors 64 | quiet
fi

# The sky: two pieces to a picture. Sectors 3 and 5 are on green (their pieces are orange and
# violet, too near magenta to cut cleanly).
if want sky; then
  mkdir -p $P/sky
  for n in 1 2 4; do
    $A snap $R/sky-${n}a.png -o $S/sky-${n}a.png --across 256 $K --colors 200 | quiet
  done
  for n in 3 5; do
    $A snap $R/sky-${n}a.png -o $S/sky-${n}a.png --across 256 --key green --key-tol 0.12 --fringe 3 --colors 200 | quiet
  done
  for n in 1 2 3 4 5; do
    $A split $S/sky-${n}a.png -o $P/sky --dir --names bg-$n-a,bg-$n-b | quiet
  done
  # The storm was drawn in cells of 8 px (the model draws clouds coarse): at the canvas's
  # 4 px it is doubled. It is taken at its own cell, half as large: 116 x 42.
  $A snap $R/sky-5a.png -o $S/sky-5a-coarse.png --cell 8 --key green --key-tol 0.12 --fringe 3 --colors 200 | quiet
  $A split $S/sky-5a-coarse.png -o $P/sky --dir --names=-,bg-5-b | quiet
  # Four pieces came back wider than 200 and were ordered again, pasted 180 wide (three to a
  # canvas: the first of each pair is taken): they replace the first ones.
  $A snap $R/sky-fix-a.png -o $S/sky-fix-a.png --across 256 $K --colors 200 | quiet
  $A snap $R/sky-fix-b.png -o $S/sky-fix-b.png --across 256 $K --colors 200 | quiet
  $A split $S/sky-fix-a.png -o $P/sky --dir --names=bg-1-a,bg-2-b,- | quiet
  $A split $S/sky-fix-b.png -o $P/sky --dir --names=bg-4-a,bg-4-b,- | quiet
fi

# The cards: whole pictures. The cover at its own cell; the ending 256 across, of which
# finish.py takes the middle 240 x 200.
if want cards; then
  $A snap $R/card-title-a.png -o $S/card-title-a.png --across 240 --colors 64 | quiet
  $A snap $R/card-ending-a.png -o $S/card-ending-a.png --across 256 --colors 64 | quiet
fi

# Which copy of each small sprite ships (the gate decides; pick.json), then everything out.
if want ships || want picks || want gangs; then
  $PY $L/choose.py
fi
$PY $L/finish.py $SETS

# Figures are reduced once, each to its own 32 colours; the sky pieces to one palette of 24
# with no two colours close (they were darkened in finish.py, and close tones would band).
figure() {
  $A palette build $ST/$1.png -o $PAL/$1.json --colors 32 --min-sep 0.034 > /dev/null
  $A palette apply $ST/$1.png --palette $PAL/$1.json --out-dir $PAL | cut -c1-110
  cp $PAL/$1.png public/galaga/$1.png
}
if want bosses; then
  for n in boss-knight boss-fader boss-humdinger boss-cal boss-deafstar boss-durant; do figure $n; done
fi
if want friends; then
  for n in rig-marge rig-duckie rig-barton stranded-babs stranded-ridley stranded-lena duo; do figure $n; done
fi
if want portraits; then
  for n in babs-purr babs-wink babs-alarm marge-calm marge-spooky duckie-calm duckie-shout barton-calm barton-shout \
           ridley-calm ridley-grim lena-calm lena-stern duo-grin duo-sweat knight-calm knight-angry humdinger-calm \
           humdinger-angry durant-calm durant-angry cal-calm cal-angry fader-calm fader-angry; do
    figure portrait-$n
  done
fi
if want sky; then
  $A palette build $ST/bg-*.png -o $PAL/sky.json --colors 24 --min-sep 0.034 | cut -c1-110
  for n in 1 2 3 4 5; do for s in a b; do
    $A palette apply $ST/bg-$n-$s.png --palette $PAL/sky.json --out-dir $PAL | cut -c1-110
    cp $PAL/bg-$n-$s.png public/galaga/bg-$n-$s.png
  done; done
fi
