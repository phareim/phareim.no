# voyagers2-lab/art: the bitmaps of Space Voyagers II

The lab that makes the pixel art in `public/voyagers2/` (29 files, 60 KB as of 2026-10-16):
talk portraits, the title card, sky pieces for the 3D backdrop, mascot decals and heads on
springs. It is Space Voyagers I's lab (`scripts/galaga-lab/art/README.md`) cut down to these
sets. The recipe is nova's (`~/github/nova/tools/art/README.md`): draw over a canvas
(`gpt-image-2.5` edit on WaveSpeed through `wave`), snap at the canvas's cells, reduce once,
gate, then look. What the game is: `themes/voyagers2/DESIGN.md`.

## Rebuild

    sh scripts/voyagers2-lab/art/make.sh             # everything from tmp/voyagers2-art/raw (about a minute)
    sh scripts/voyagers2-lab/art/make.sh sky         # one set: portraits card sky sprites
    sh scripts/voyagers2-lab/art/gate.sh             # nova's gate over public/voyagers2
    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/stray.py   # leftover key pixels
    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/proof.py   # tmp/voyagers2-art/proof/batch1.png, 3x

The raw generations are in `tmp/voyagers2-art/raw` (git-ignored). Without them a picture has
to be ordered again: `log.jsonl` has every order with its full prompt and inputs, `batches/`
the scripts that ran them, in order (b01 to b05). The style images are built by
`layouts.py` from Space Voyagers I's shipped bitmaps in `public/galaga/`.

## Files

| File | What it is |
|---|---|
| `gen.py` | Orders one picture (`flare-edit` with `--images`), logs it to `log.jsonl`, refuses past 45 orders (failed ones count) |
| `layouts.py` | The canvases and style images, to `tmp/voyagers2-art/ref/` |
| `prompts/`, `prompts/blocks/` | One prompt an order; `{name}` is a block. `style`, `leave`, `world`, `woman`, `face`, `far` and the rest are Space Voyagers I's, word for word; new here: `mascot`, `leave-sign` (the leave-out list for the one picture with lettering), `finer-sky` |
| `make.sh` | Raw generations to `public/voyagers2` |
| `portraits.py` | Cuts the 64 x 64 portraits out of the sheets; `WINDOW` sets each row's window, `SHIP` which tile ships |
| `cut.py`, `choose.py`, `pick.json`, `copies.py` | The packed sprite sheets: cut by slot, a copy chosen (by eye, in `choose.py`'s `EYE`), every copy on one sheet for looking |
| `finish.py` | Clears leftover key colour, mends key-cast edges, trims, darkens the sky (`night`, 0.34), cuts the card, writes indexed PNGs |
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
