# galaga-lab/art: the bitmaps of Rex & Nova: Space Voyagers I

Every picture the game ships in `public/galaga/` (126 files, 254 KB) is generated as pixel art
(`gpt-image-2.5` on WaveSpeed through `wave`) and put through the art tool of Nova's Solo
Rescue (`~/github/nova/tools/art`, whose README is the recipe: draw over a canvas, snap at
the canvas's cells, reduce once, gate, then look). This folder is the lab that does it.
What the game is: `themes/galaga/DESIGN.md`. State as of 2026-10-13; 48 pictures ordered of
a cap of 110.

## Rebuild

    sh scripts/galaga-lab/art/make.sh            # everything, from tmp/galaga-art/raw (about 3 min)
    sh scripts/galaga-lab/art/make.sh gangs      # one set: ships picks gangs bosses friends
                                                 # portraits console sky cards
    sh scripts/galaga-lab/art/gate.sh            # nova's gate over public/galaga
    ~/.cache/nova-art-venv/bin/python scripts/galaga-lab/art/proof.py   # the proof sheets
    ~/.cache/nova-art-venv/bin/python scripts/galaga-lab/art/sizes.py   # sizes, windows checked

The raw generations are in `tmp/galaga-art/raw` (git-ignored). Without them a picture has to
be ordered again: `log.jsonl` has every order with its full prompt and its input images, and
`batches/` the scripts that ran them, in order. The style images come from
`~/github/nova/public/art` and `~/github/nova/docs/shots/art`.

## Files

| File | What it is |
|---|---|
| `gen.py` | Orders one picture from `wave` (`flare`, or `flare-edit` with `--images`), `--no-upload`, logs it to `log.jsonl`, refuses past 110 pictures. The key comes from the environment and is never printed |
| `layouts.py` | The canvases shown to the model: block layouts, packed sheets, second passes, style images. Writes `tmp/galaga-art/ref/<name>.png` |
| `prompts/` | One file an order; `{name}` is replaced by `prompts/blocks/name.txt` |
| `batches/` | The orders as they were run, b01 to b11 |
| `make.sh` | Raw generations to `public/galaga`: snap, cut, choose, finish, reduce |
| `cut.py` | Takes a packed sheet apart, by the slots it was laid in (`--slots`) or by the clear bands between its rows and things (`--bands`) |
| `choose.py`, `pick.json` | Which of a thing's copies ships: the first that nova's gate passes |
| `finish.py` | Takes that copy, clears leftover key colour, mends magenta-cast outline pixels, trims, writes indexed PNGs; copies Rex's, Nova's and Mei's portraits from nova unchanged; darkens the sky pieces; moves the cover's picture down |
| `portraits.py` | Cuts the 64 x 64 portraits out of their sheets, each row's window set on the face |
| `windows.py`, `windows.json` | The console: builds the second-pass canvases, squares the windows, measures them |
| `reduce.py` | Halves a sprite by choosing one pixel in four. Tried in the pilot, used for nothing that ships; the other scripts use its PNG writer |
| `gate.sh`, `stray.py`, `sizes.py`, `proof.py`, `proof/` | The checks (nova's gate, leftover key pixels, sizes and windows) and the sheets for the eye |

## How a small sprite is got

The edit model draws in cells of about 4 px on a 1024 px picture whatever the canvas's blocks
are (an 8 px canvas came back at twice the size), and it will not draw a thing much smaller
than 28 cells when there is room round it: a pick-up laid at 14 came back at 28, a ship laid
at 29 x 33 came back at 40 x 54 in cells half as large, and a second pass with room grew a
boss back from 110 to 141. So a size takes two orders:

1. **A sheet of blocks** (`grid` in `layouts.py`; blocks `{gang}`, `{sheet}`, `{pair}`), with
   a finished top-down sprite sheet as the style image. It settles what each thing is. It
   comes back two to four times too large, in whatever cells: snap it at its own cell and
   `art split` it.
2. **A packed sheet** (`dense`, `packed`; block `{dense}`): every thing of the first sheet
   shrunk with nearest neighbour to its size and repeated until the 256-cell canvas is full,
   8 to 16 cells of magenta between them. With no room to grow, the model redraws each at its
   size in clean 4 px cells: within 2 px for things of 16 to 30, within a tenth for larger.

Lay a column for each thing (`by_col`): given rows that wrap, the model sorts them into
columns itself and may merge or drop a thing while it does (the pick-ups lost two, the Road
Hogs their sniper). When it has sorted a sheet, `cut.py --bands`; when it kept the slots,
`cut.py --slots`. Bosses of about 110 px came out right from the first sheet, two to a
picture; only the two tallest needed packing.

Other things found:

- `snap --key magenta` takes the colour of a picture's border for the key when that is
  anywhere near the key asked for. On a full-bleed console panel the border is wood and it
  cut the wood: such a picture is snapped with `--key none` and keyed in `windows.py`.
- The model fills a frame with the detailed part of a layout: both console panels came back
  with everything a quarter too large. The second pass (the first picture scaled back, the
  windows painted over as exact rectangles) held every window within 5 px.
- Orange, coral and violet things are ordered on green (`{keyg}`, sky sectors 3 and 5).
- A cloud comes back in cells of 8 px: the storm is snapped at its own cell.

## Prompt blocks

| Block | Says |
|---|---|
| `style` | The style block of `nova/docs/design.md`, word for word, plus: light from the upper left, four tones and a dark outline, one grid, hard edges, no anti-aliasing |
| `leave` | The leave-out list of `nova/docs/design.md`, word for word, plus: no border, watermark, interface, lettering or real logo |
| `world` | This game's question: a space future that stayed analog 80s technology, and what that looks like |
| `clusters` | Flat patches, no speckle, wear as shapes |
| `key`, `keyg` | A flat magenta (or green) background and none of it on the subject |
| `above`, `up`, `down` | A vertical shooter's point of view: straight down on the roof; a friend's nose up, an enemy's down |
| `sheet`, `gang`, `pair`, `skypair`, `layout` | Things drawn over the blocks of a layout: a sheet of them, a gang of nine, two bosses, two sky pieces, one subject |
| `dense` | A packed sprite sheet redrawn exactly: nothing enlarged, one block is one pixel |
| `redraw`, `resheet` | The second pass of a coarse layout at its size (`resheet`: the pilot's, superseded by `dense`) |
| `boss` | A boss fills the top of the screen, faces down, head-on |
| `woman` | The rule for every woman in a picture: fully dressed for her job, framed exactly like the men, nothing posed to be leered at. **In every prompt with a woman in it** |
| `nova`, `rex` | Who the two pilots are and how they are drawn (`nova` carries the rule) |
| `face` | Every face is invented: no real actor, no copied costume, mask, logo or ship |
| `portraits` | A sheet of nine talk portraits in the framing of nova's |
| `panel`, `window`, `redraw-panel` | A flat control panel; its windows stay empty flat magenta rectangles |
| `far` | Backdrop pieces: dark, low in contrast, night blue and brown, never black |

## Console windows

Measured from the shipped files by `sizes.py` (the boxes of the clear regions; each is a whole
rectangle and there is no other clear pixel). `x, y` is the top left corner in the bitmap;
the same numbers are in `windows.json`.

| File | Window | x | y | w | h |
|---|---|---|---|---|---|
| `console-left.png` 200 x 432 | portrait | 42 | 16 | 64 | 64 |
| | name plate | 29 | 92 | 120 | 9 |
| | channel | 33 | 111 | 80 | 9 |
| | caption | 19 | 146 | 172 | 30 |
| `console-right.png` 200 x 432 | score | 48 | 12 | 104 | 13 |
| | valves | 46 | 42 | 110 | 26 |
| | weapon | 24 | 94 | 48 | 48 |
| | lamps | 50 | 162 | 100 | 12 |
| | chart | 26 | 195 | 150 | 40 |
| `console-band.png` 240 x 96 | portrait | 6 | 4 | 40 | 40 |
| | caption | 56 | 10 | 178 | 30 |
| | score | 8 | 64 | 80 | 9 |
| | valves | 98 | 63 | 60 | 12 |
| | weapon | 168 | 62 | 40 | 9 |
| | duet | 168 | 79 | 40 | 6 |

Not windows: on `console-right` the **VU meter's face** is painted (cream, a scale of ticks
along its top, the last ones red, no needle): 71 x 40 at 104, 99. The needle's pivot belongs
under the middle of its bottom edge, about 139, 138. On the left panel the drawing ends at
row 359 (tape deck to about 291, sticker and CB handset to 359) and rows 360 to 431 are plain
wood; on the right the windows end at row 234, the toggle strip at about 319, sticker and
vent at about 413, with plain steel under them.

Every window was made exact in `windows.py`: it came back within 5 px of the size asked and
is cut to that size on the middle of what came back, so a frame's inner edge may be a pixel
thin or thick. The left panel's screen bezel has rounded corners which the square window
cuts into.

## Sizes

`sizes.py` prints all 126. What differs from what was asked:

| Bitmaps | Asked | Came out |
|---|---|---|
| `ship-rex`, `-bank` | 32 x 36 | 31 x 38, 31 x 37 |
| `ship-nova`, `-bank` | 32 x 36 | 20 x 38 both (a lean dart) |
| `pick-<id>` | 16 x 16 | 9 to 18 wide, 11 to 20 tall (`pick-hairspray` 9 x 19, `pick-tracking` 18 x 11) |
| `valve-on`, `valve-off` | 18 x 24 | 12 x 24, on one canvas: swap in place |
| enemies, small roles | 24 x 24 | 8 to 31 wide, 15 to 33 tall; divers and snipers are narrow (8 to 15 wide) |
| enemies, tank and captor | 32 x 32 | tanks 28 to 39 wide, 30 to 38 tall; captors 21 to 30 wide, 29 to 34 tall, `enemy-hogs-captor` 24 x 41 |
| enemies, mite | 14 x 14 | 9 x 9 to 14 x 14 |
| `boss-knight` | 112 x 96 | 56 x 113 (a standing figure under his mirror ball) |
| `boss-humdinger` | 112 x 96 | 97 x 117 |
| `boss-durant` | 112 x 96 | 104 x 106 |
| `boss-cal` | 112 x 96 | 120 x 77 |
| `boss-fader` | 112 x 96 | 140 x 95 |
| `boss-deafstar` | 200 x 110 | 193 x 96, flat along its top edge |
| `rig-*` | 36 x 150 | 34 or 35 x 147; cab rows 0 to 39, coupling bar from row 40 |
| `stranded-*`, `duo` | 40 x 48, 44 x 44 | 39 x 52, 43 x 51, 43 x 54; `duo` 47 x 53 |
| `bg-3-a` | 96 to 200 across | 88 x 120 (the lava-lamp planet is tall) |
| other `bg-*` | 96 to 200 across | 100 to 197 across, 40 to 118 tall |

Portraits are 64 x 64, opaque, 32 colours or fewer; cards 240 x 320 and 240 x 200, opaque;
console panels 200 x 432 and 240 x 96.

## What the game should know

- Enemies face down, friends up. `ship-*-bank` is the ship rolled to its left: mirror it for
  the right.
- A rig's top 40 rows are its cab, whole; rows 40 and 41 (to 43 on `rig-duckie`) hold only
  the coupling bar, 4 px wide.
- `boss-knight` is not symmetrical (one arm up); `boss-deafstar` has its woofer left of the
  middle and its tweeter, the weak spot, right of it: the red dome is about 14 px across in
  a chrome ring of about 24, centred near 136, 38 in the bitmap.
- The cover's rows 0 to 78 are one flat night blue, with no stars, for the title; the two
  rockets begin at row 82.
- Sky pieces were darkened in `finish.py` (`night`: every colour times 0.30 plus 14, 18, 38):
  no channel in them is above 106. Change the two numbers there to make them lighter or
  darker.
- Portraits: the face is inside the middle 40 x 40 on all of them. On `portrait-ridley-*`
  the cat is at the left edge and only half of it is inside the 40 x 40.
- The bosses are drawn head-on, the way a shooter's bosses are, not from above: the Knight
  standing, Dark Fader as head and shoulders, the organ, CAL's wall and the Deaf Star as
  fronts. Only Humdinger's rig is seen from above, nose down.
- On `console-left` the pizza sticker and the CB handset lie across row 320 (about rows 297
  to 359): a console 320 rows tall cuts through them. On `console-right` the sticker and the
  vent are wholly below row 320.
- The band's valve window is 12 px tall and `valve-on` and `valve-off` are 24: the band needs
  the valves drawn smaller, or by code.
- No file has a key-coloured or half-clear pixel (`stray.py`).

## Weak, and not judged

- Gate: 122 of 126 pass. `enemy-glitterati-mite` (a spark of 10 x 10), `enemy-glitterati-raider`
  and `enemy-lovemachines-raider` fail `noise` (51 to 78 against 45): thin arms and sparkles
  are one-pixel clusters. `bg-3-b` fails `doubled` (56 against 50) though snap finds its cell
  at 4 px. All four were looked at and kept.
- `pick-cb`, `pick-quarter`, `pick-tracking` and the Glitterati's mite were ordered a second
  time (`picks-f`) because the first ones did not read (a cream blob, a plain disc, a dark
  box) or were too large. The second ones are better: a black microphone with a yellow
  coiled cord, a coin with a rim and a star, a cassette with a white label and two reels.
  The star on the coin is still faint at 1x.
- The Road Hogs are rust and dark iron on a dark field: lower in contrast than the other
  gangs. `enemy-hogs-splitter` (bike and sidecar) is muddy at its size.
- Banked ships differ from the straight ones in shading more than in outline.
- `bg-5-b`, the storm, is very faint after darkening and half the size of the others.
- Nods that sit close to their films, by the brief: Princess Lena's hair is wound round two
  tape reels at the sides of her head (the portrait's window cuts most of them off); Dark
  Fader is a flared helmet with a fader for a face; Ellen Ridley has curls, a jumpsuit and a
  cat; Jack Barton a mullet and an undershirt; the Century Pigeon is a round patched
  saucer with two prongs in front and its cockpit out at one side. The faces are invented.
- Nobody has seen any of this in the game: sizes against hit boxes, the console beside the
  field, the sky's darkness against the real backdrop colour.
