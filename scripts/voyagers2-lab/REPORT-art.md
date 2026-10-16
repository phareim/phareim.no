# Space Voyagers II: art, batch 1

2026-10-16. Lab: `scripts/voyagers2-lab/art/` (README there). Raw generations in
`tmp/voyagers2-art/raw` (git-ignored). Shipped: `public/voyagers2/`, 29 indexed PNGs, 60 KB.
15 orders of the cap of 45, none failed, about $0.59 (gpt-image-2.5 edit at about $0.039; the
rate is from nova's tools/art README, not checked against a bill). Contact sheet:
`tmp/voyagers2-art/proof/batch1.png` (3x, git-ignored).

Checks: `gate.sh` passes all 29 (portraits as figure, card and sky as place, sprites as
thing); `stray.py` finds no key-coloured or half-clear pixel; two full `make.sh` runs in a
row give identical files. Every file was also looked at at 3x or 4x.

## Orders

| # | Order | What | Kept |
|---|---|---|---|
| 1 | portraits-1a | Nonna, Tiny, Dougie | yes: 6 portraits |
| 2 | card-title-a | title card | no: carrier and fighters in the top quarter. Its snap made the second pass's collage |
| 3 | sprites-a | the ten small things at about 45 px (what each one is) | source only |
| 4 | portraits-2a | Parmesan, rat, bear | yes: 4 portraits |
| 5 | sky-b | Hut and moon | yes |
| 6 | sky-c | nebula and billboard | no: nebula in 8 px cells; billboard 166 x 116 with a stain over the T of THE |
| 7 | sky-a | planet and galaxy | no: 8 px cells (`doubled`) |
| 8 | sprites-d | packed sheet, pasted at 15 | heads yes; faces too large (17 to 21) |
| 9 | card-title-b | the card's second pass (collage under 80 plain rows) | yes |
| 10 | sky-fix-c | billboard board only, at 128 wide | yes |
| 11 | sprites-e | packed sheet, pasted at 12 | faces yes; heads no (spring and face turned to mush at 15 x 20) |
| 12 | portraits-3a | gorilla, hound, a second bear | gorilla and hound yes; second bear spare (bowler cut off) |
| 13 | sky-fix-a | planet and galaxy redrawn finer | planet yes; galaxy still `doubled` once darkened |
| 14 | sky-fix-b | nebula redrawn finer | yes |
| 15 | sky-fix-d | galaxy alone, finer, three copies | yes |

## Shipped

| File | Size |
|---|---|
| portrait-nonna-calm, -nonna-stern, -tiny-calm, -tiny-grin, -dougie-eager, -dougie-scared | 64 x 64 |
| portrait-parmesan-calm, -parmesan-angry, -mascot-rat, -mascot-bear, -mascot-gorilla, -mascot-hound | 64 x 64 |
| card-title | 240 x 320 |
| sky-planet / sky-nebula / sky-hut | 176 x 121 / 242 x 69 / 137 x 156 |
| sky-billboard / sky-galaxy / sky-moon | 146 x 75 / 102 x 43 / 57 x 59 |
| face-rat / -bear / -gorilla / -hound / -lion / -slice | 16x15 / 15x17 / 13x17 / 14x15 / 13x17 / 13x15 |
| head-rat / -bear / -gorilla / -hound | 18x27 / 18x27 / 19x26 / 20x27 |

## Sizes that differ from those asked

| File | Shipped | Asked | Why |
|---|---|---|---|
| sky-billboard | 146 x 75 | about 128 x 64 | pasted at 128 x 61, it came back larger; smaller would cost the second line of lettering |
| sky-hut | 137 x 156 | about 160 x 140 | taller than wide: the sign on its pylon stands above the dome |
| sky-planet | 176 x 121 | about 160 x 160 | the planet is about 120 across; the ring makes the width |
| sky-moon | 57 x 59 | about 64 x 64 | |
| head-* | 18 to 20 x 26 to 27 | about 16 x 22 | the smaller ones did not read |

## Rejected

- Title card, first: the top quarter was busy.
- First planet, galaxy and nebula: drawn in 8 px cells.
- First billboard: too large, with a rust stain over the T of THE.
- Faces from the first packed sheet: a quarter too large.
- Heads from the second packed sheet: mush.
- The honey-gold bear: its bowler is cut off by the sheet's edge. It is a spare.

## For Petter to judge

- The mascot bear (brown, black hat, blue glass eyes, most of all the 15 px decal) sits close to
  Freddy Fazbear; the rat (grey, big round ears, buck teeth) close to Chuck E. Cheese. The prompts
  name neither and ask for original characters; the bear's flight helmet and goggles and the
  bowler set it apart. Spare bear: `tmp/voyagers2-art/parts/portraits/bear2-*.png` (bowler cut off).

## Notes

- Title card: rows 0 to 79 are one flat colour, #022467, no stars: room for the logo. Rex is in
  the front canopy and Nova in the rear bubble turret, both readable; the carrier upper right
  behind the tail fin; two Franchise fighters coming in at the left; the nose is cut by the
  lower and left edges.
- Each mascot ships its singing tile (jaw dropped); calm and angry versions of the rat, bear,
  gorilla and hound are cut in `tmp/voyagers2-art/parts/portraits/`.
- Cut off by the 64 x 64 window: Parmesan's cape collar (a sliver), Nonna's glasses on a chain
  and floury forearms (the flour on her cheek shows), Tiny's rubber gloves; the rat's nose
  touches the right edge; the gorilla's window was moved down so its bow tie shows.
- Sky: darkened in `finish.py` (`night`: every colour times 0.34 plus 14, 18, 38; no channel
  above 96), one shared palette of 11 colours. The Hut's sign is a blank dull-red board. The
  billboard reads "PIZZA THE HUT / NOW ON EVERY ORBIT".
- Sprites: the slice's bite is faint at 13 x 15; faces from `sprites-e`, heads from `sprites-d`.
- Rebuild: `sh scripts/voyagers2-lab/art/make.sh`; run `make.sh sky` before re-running b04 or
  b05 (their canvases read `tmp/voyagers2-art/parts/sky-first` and `sky-second`).

# Batch 2: rooms, endings, act cards, the Long Haul's sky

2026-10-16. 13 orders of the batch's cap of 40, none failed, about $0.51 (same rate, not checked
against a bill). 11 indexed PNGs added to `public/voyagers2/`, all through nova's gate and looked
at at 3–4x; batch 1's 29 files are byte-identical; two `make.sh` runs give identical files. Contact
sheet: `tmp/voyagers2-art/proof/batch2.png` (git-ignored).

| File | Size | Note |
|---|---|---|
| room-kitchen, room-hangar, room-breakroom | 240 x 180 | the crew in them; boxes in `art/rooms.json` (copied to `themes/voyagers2/roomSpots.json`) |
| card-ending-won, card-ending-lost | 240 x 200 | |
| card-act-1, card-act-2, card-act-3 | 240 x 120 | no lettering (titles are drawn by code) |
| sky-truckstop / sky-markers / sky-buoy | 159 x 77 / 138 x 54 / 53 x 80 | asked about 140 x 80, 160 x 50, 48 x 64 |

Orders: room-kitchen-a (pilot, kept), card-ending-won-a (kept), room-breakroom-a (kept),
room-hangar-a (kept), card-act-1-a (kept), card-act-2-a (no 240 x 120 crop held both sign and
rig), card-ending-lost-a (a Freddy-like head and a bare chest under the costume: not shipped),
sky-b2-a (truck stop and markers kept, buoy too big), card-act-3-a (kept after re-snapping with
`--min-sep 0.034`), card-act-2-b (kept), card-ending-lost-b (its prompt lacked the `rex` and
`nova` blocks), sky-b2-fix (the smaller buoy), card-ending-lost-c (ships).

## For Petter to judge (batch 2)

- The bear costume head in the lost ending: the second pass gave it this game's bear (flight
  helmet and goggles under the bowler, a rubbed patch, the jaw on bolts), but it is still a brown
  bear with blue glass eyes and a black nose.
- Nova's neckline in both endings was drawn as a low scoop even when a crew neck was asked for;
  `finish.py` (`MEND`) recolours 68 and 44 skin pixels to the shirt's colours so it reads as a crew neck.
- The won ending's soda bottles are dark with red-and-white labels, no letters, cola-like.
- The Calzone in the hangar is longer and slimmer than the title card's; act 1's Deep Dish is
  mid-size; the truck-stop signs are a coffee cup and an arrow; the big buoy carries a "52"-like
  smudge; act 2's rig loses a few rows of its wheels at the bottom edge.
- The oven fire, the hangar lamps and act 3's soft band look like flat clusters at 8x, not halos.

## Notes (batch 2)

- Taps resolve people first, then the smallest thing. The `board` boxes are only the part of each
  chalkboard no head covers; whole boards are (52, 12, 75, 44) and (81, 26, 81, 38). Boards and
  the TV screen are one flat colour so code can draw on them.
- Lab changes: `gen.py` caps per batch, `gate.sh` gates the rooms, `make.sh` has the sets
  `rooms endings acts sky2`, `finish.py` the sections `ROOMS ENDINGS ACTS MEND SKY2`, `proof.py 3 2`
  makes the batch-2 sheet.
