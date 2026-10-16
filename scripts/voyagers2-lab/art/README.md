# voyagers2-lab/art: the bitmaps of Space Voyagers II

The lab that makes the pixel art in `public/voyagers2/` (40 files, 151 KB as of 2026-10-16):
talk portraits, the title card, sky pieces for the 3D backdrop, mascot decals and heads on
springs (batch 1); the three rooms of the Deep Dish, the two endings and the three act cards
(batch 2). It is Space Voyagers I's lab (`scripts/galaga-lab/art/README.md`) cut down to these
sets. The recipe is nova's (`~/github/nova/tools/art/README.md`): draw over a canvas
(`gpt-image-2.5` edit on WaveSpeed through `wave`), snap at the canvas's cells, reduce once,
gate, then look. What the game is: `themes/voyagers2/DESIGN.md`.

## Rebuild

    sh scripts/voyagers2-lab/art/make.sh             # everything from tmp/voyagers2-art/raw (about a minute)
    sh scripts/voyagers2-lab/art/make.sh sky         # one set: portraits card sky sprites rooms endings acts sky2
    sh scripts/voyagers2-lab/art/gate.sh             # nova's gate over public/voyagers2
    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/stray.py   # leftover key pixels
    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/proof.py 3 2   # tmp/voyagers2-art/proof/batch2.png, 3x (batch 1: no second argument)
    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/rooms.py   # rooms.json, and the rooms with their boxes drawn

The raw generations are in `tmp/voyagers2-art/raw` (git-ignored). Without them a picture has
to be ordered again: `log.jsonl` has every order with its full prompt and inputs, `batches/`
the scripts that ran them, in order (b01 to b05 batch 1, b06 to b08 batch 2). The style images
are built by `layouts.py` from Space Voyagers I's shipped bitmaps in `public/galaga/`; batch 2's
canvases by `layouts2.py`, which reuses its helpers.

**`rooms.json`** is what the game reads: for each room the box (x, y, w, h, in the shipped
240 x 180 bitmap) of each person (by speaker id), the chalkboard (`board`), the television
screen (`tv`) and the other things to tap. `rooms.py` holds the boxes and how they were
measured; the board and screen boxes are also in `finish.py`'s `ROOMS`, which paints them flat.
Change one, change both, and run `rooms.py` to look at them.

## Files

| File | What it is |
|---|---|
| `gen.py` | Orders one picture (`flare-edit` with `--images`), logs it to `log.jsonl` with its batch, refuses past the batch's cap (45 for batch 1, 40 for batch 2; failed orders count) |
| `layouts.py` | The canvases and style images, to `tmp/voyagers2-art/ref/` |
| `layouts2.py` | Batch 2's: the rooms (4:3, 240 x 180 cells), the endings (1:1, 256), the act cards (16:9, 256 x 144), the sky pieces on green, the cast strips (the people's talk portraits side by side) and the second passes built from the first pictures' snaps |
| `rooms.py`, `rooms.json`, `measure.py`, `grid.py` | The rooms' tappable boxes; a flat region's box by colour; a bitmap enlarged with a grid and boxes |
| `prompts/`, `prompts/blocks/` | One prompt an order; `{name}` is a block. `style`, `leave`, `world`, `woman`, `face`, `far` and the rest are Space Voyagers I's, word for word; new here: `mascot`, `leave-sign` (the leave-out list for the one picture with lettering), `finer-sky` |
| `make.sh` | Raw generations to `public/voyagers2` |
| `portraits.py` | Cuts the 64 x 64 portraits out of the sheets; `WINDOW` sets each row's window, `SHIP` which tile ships |
| `cut.py`, `choose.py`, `pick.json`, `copies.py` | The packed sprite sheets: cut by slot, a copy chosen (by eye, in `choose.py`'s `EYE`), every copy on one sheet for looking |
| `finish.py` | Clears leftover key colour, mends key-cast edges, trims, darkens the sky (`night`, 0.34), cuts the card, writes indexed PNGs; batch 2: takes each room, ending and act card as a window of its snap (`ROOMS`, `ENDINGS`, `ACTS`), paints the boards and screen flat, mends Nova's neckline (`MEND`), cuts the sky pieces by region (`SKY2`) |
| `reduce.py` | Its `save_indexed` is the PNG writer |
| `gate.sh`, `stray.py`, `proof.py` | The checks and the contact sheet |

## What was found

- **Portraits** come back as Space Voyagers I's did: three people to a sheet, one to a row,
  the same face across the row; 256 cells at 4 px, a 64 x 64 window out of each 85 px tile.
  The mascots fill their tiles: their windows sit further right and higher.
- **The title card** came back right in what it shows but with the carrier and fighters in
  its top quarter. The second pass is a collage (`layouts.py` `card_collage`): the first
  picture taken apart, scaled and laid again under 80 plain rows, then redrawn at that size.
  It came back 243 x 329 at 240 across; `finish.py` takes the middle 240, moves it 10 rows
  down, and paints out one leftover shard (`PAINT`).
- **Sky**: everything on green. The planet, the galaxy and the nebula came back drawn in
  8 px cells (the gate's `doubled`); a second pass with `finer-sky` redrew them at 4 px at the
  same size. The galaxy still failed `doubled` once darkened and reduced (its broad flat
  patches merged): a third pass, alone and three times over, asking for clusters of two to
  four blocks (`sky-fix-d`), passes. The billboard grew to 166 x 116 with a catwalk and a
  stain over the T of THE: its board alone, shrunk to 128 x 61, was redrawn clean at
  146 x 75. One palette for all six, `--min-sep 0.034` (0.026 failed `banding`).
  `make.sh sky` must run before `batches/b04` and `b05` are run again: their canvases read
  the first passes from `parts/sky-first` and `parts/sky-second`.
- **Small sprites** came back a third larger than pasted on a packed sheet (15 to 20, 14 x 22
  to 18 x 27). Pasted at 12 the faces came back 13 to 16 and still read; the heads on springs
  turned to mush at 15 x 20, so the larger ones ship.

Batch 2 (12 orders, none failed):

- **Scenes with people** hold in one order with three images: a block canvas, a style image
  at the canvas's cell size (Space Voyagers I's ending card) and a cast strip of the people's
  talk portraits named left to right in the prompt. Every face came back matching its
  portrait, at heads of 12 to 30 px; nine people in one 240 x 200 ending held too. 4:3 works
  (1184 x 880). The model draws a little finer than the canvas: the rooms came back 243 to
  253 wide for 240 (cells of 4.7 to 4.9 px for 4.93), the endings 259 to 261 for 256; each
  ships as a window of its snap, placed where nothing that matters is cut.
- **Chalkboards and the screen** came back blank as asked; `finish.py` paints the part clear
  of heads flat anyway, so the boxes in `rooms.json` hold one colour.
- **The sign** "EMPLOYEE / OF THE MONTH" came back spelled right the first time (`leave-sign`).
- **The act cards** (16:9 at 256 x 144 cells) are wider than their 240 x 120: act 2's sign and
  rig sat at opposite corners, so its second pass is the first squeezed into the window and
  redrawn (`layouts2.py` `second_passes`); it came back re-expanded a little, and its window
  cuts the rig's wheels. Act 3's sky failed `banding` (9 %): the act cards are snapped with
  `--min-sep 0.034`.
- **The lost ending's costume head** came back as a brown bear with a black hat and blue eyes
  and no flight helmet, too close to a famous animatronic bear; a second pass over the
  picture gave it this game's bear (flight helmet and goggles under the bowler, a rubbed
  patch, the jaw on bolts) and closed the costume over Rex's chest.
- **Nova's t-shirt** came back as a low scoop in both endings; `finish.py` `MEND` raises it to
  a crew neck (skin in an exact box under her neck becomes the shirt's colours).
- **Sky pieces of acts 2 and 3**: three on green, cut by region (the four mile markers stand
  apart and ship as one piece). The large buoy came back 63 x 92 for about 48 x 64; shrunk
  to 42 x 61 and redrawn, it came back 53 x 80. Their own palette (`pal/sky2.json`): the
  `stage/sky-*.png` glob of batch 1's palette was replaced by the six names, so batch 1's sky
  stays as it was. Darkened, the truck stop's neon coffee cup is faint (its amber becomes a
  dull brown, as the Hut's lit windows do).
- `make.sh endings acts sky2` must run before `batches/b08` is run again: its canvases read
  the first pictures' snaps.
