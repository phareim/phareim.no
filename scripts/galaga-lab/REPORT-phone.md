# Space Voyagers — the narrow-screen layout

2026-10-13. Status: DONE. Tests, typecheck and build pass. Nobody on this job held a phone or
heard the game: everything below is what a program measured in headless Chrome on a Mac and
what its pictures show. Nothing here says how it feels or sounds.

## The rule as built

Written into `themes/galaga/DESIGN.md`, "The picture", in place of the old one; the arithmetic
is `narrow()` in `themes/galaga/render/layout.ts`.

- **Wide or narrow** is decided as it always was (the largest whole number of device pixels
  at which 240 × 320 fits; 560 logical px across there is wide). Wide is untouched: whole
  device pixels, `pixelated`.
- **Narrow**: the frame is 240 logical px wide and fills the screen's width;
  rows = round(CSS height × 240 / CSS width). It goes onto the canvas's backing store at
  *n* = ceil(device px across / frame width) backing pixels a logical pixel, nearest
  neighbour; the backing store is frame width × *n* by rows × *n*; CSS sizes the canvas to the
  viewport. The renderer takes `image-rendering: pixelated` off the canvas in this mode
  (`resize` in `render/index.ts`; the page reports `auto` narrow and `pixelated` wide).
- **Down the screen**: bare wood for the rows the radio widget lies over (the widget's bottom
  edge in rows, less the 8 rows of the band it may cover: the caption window begins 10 down),
  the band (96 rows), the field (320 to 432, what fits), the site's bottom band (backdrop).
- **A screen too short** for that with a 320-row field: the frame is widened two columns at a
  time until the rows are enough. Band and field stay 240 wide in the middle. Either side:
  beside the band, the band bitmap's own rows carried on (its last column for the wood, its
  first for the rail and the steel); beside the field, the sector's sky and stars, none of the
  large things. The colour that used to fill the frame's unused parts is covered everywhere.
- **Touch**: `toField()` in `layout.ts`: field x = CSS x × frame width / CSS width − field
  left; y the same with the frame's rows over the CSS height (the canvas is stretched over the
  screen, so this is the exact inverse of what is shown; it differs from "by the width" by
  under half a row at the bottom).
- **A run keeps its field height**: `computeLayout(screen, fieldH)`. Narrow, the frame widens
  as for a short screen. The pause on a turn is as it was.

## The screens

Measured in the page (`frameReport` in `shot.mjs`), built site, radio widget as the lab has
it (bottom edge at 48 CSS px, no notch).

| Screen | Frame (logical) | n | Backing store | CSS fit | Wood | Band rows | Field | Either side of the field | Under | Console |
|---|---|---|---|---|---|---|---|---|---|---|
| 390 × 844 @3, installed (band 48) | 240 × 519 | 5 | 1200 × 2595 | −2.5 % | 22 | 22–118 | 240 × 371 | nothing: edge to edge | 30 (the bottom band) | 22.7 % |
| 390 × 664 @3 | 260 × 443 | 5 | 1300 × 2215 | −10.0 % | 25 | 25–121 | 240 × 322 | 10 columns of dashboard and sky | 0 | 27.3 % |
| 430 × 932 @3 | 240 × 520 | 6 | 1440 × 3120 | −10.4 % | 19 | 19–115 | 240 × 405 | nothing | 0 | 22.1 % |
| 393 × 852 @3 | 240 × 520 | 5 | 1200 × 2600 | −1.8 % | 22 | 22–118 | 240 × 402 | nothing | 0 | 22.7 % |
| 375 × 667 @2 | 248 × 441 | 4 | 992 × 1764 | −24.4 % | 24 | 24–120 | 240 × 321 | 4 columns | 0 | 27.2 % |
| 375 × 553 @2 | 304 × 448 | 3 | 912 × 1344 | −17.8 % | 31 | 31–127 | 240 × 321 | 32 columns | 0 | 28.3 % |
| 360 × 740 @3 | 240 × 493 | 5 | 1200 × 2465 | −10.0 % | 24 | 24–120 | 240 × 373 | nothing | 0 | 24.3 % |
| 320 × 568 @2 | 252 × 447 | 3 | 756 × 1341 | −15.3 % | 30 | 30–126 | 240 × 321 | 6 columns | 0 | 28.2 % |
| 768 × 1024 @2 | 322 × 429 | 5 | 1610 × 2145 | −4.6 % | 13 | 13–109 | 240 × 320 | 41 columns | 0 | 25.4 % |
| 1280 × 800 @1 (wide) | 640 × 400 | 2 | 1280 × 800 | none, `pixelated` | – | – | 240 × 400 at x 200 | a 200-wide panel | 0 | – |

Before, 390 × 844 @3 gave a field 293 CSS px wide with 35 CSS px of black either side and 201
rows of console; now the field is 390 CSS px wide and the console 118 rows.

## What the pictures show

Twenty pictures, all opened: `phone-play` (sector 1, wave 1, someone on the monitor) and
`phone-boss` (the Saturday Knight) at the nine narrow screens and wide. They are in
`tmp/phone/shots/` on the Mac (`tmp/` is git-ignored: they do not travel with the patch; the
command under "Checks" makes them again).

- Every narrow picture: wood across the top with the radio widget on it, the band under it
  with portrait, three rows of caption, score, valves, weapon, DUET, and the name plate and
  channel on the steel under the score (`PRINCESS LENA` / `DISTRESS`, `BABS ARELLA` /
  `LOVE BAND 96.9`, the widest pair, ends 6 columns short of the DUET window's glass); the field under
  it to the bottom. A scan of all twenty found no pixel of the old fill colour and no column
  of one tone at either edge.
- 390 × 844 installed, 430 × 932, 393 × 852, 360 × 740: band and field edge to edge. On the
  installed one the two ships stand above the last 30 rows, where only the Earth's limb is.
- 390 × 664, 375 × 667, 320 × 568: 10, 4 and 6 columns either side; wood, rail and steel run
  to the edges beside the band, stars beside the field. They read as one dashboard and one sky.
- 375 × 553 and 768 × 1024: 32 and 41 columns either side, the same way. The boss's warning
  squares and the Earth's limb stop at the field's edge; the stars go on.
- 768 × 1024: the widget is wide there (`STARDUST RUN 1/6`); the caption begins under it.
- Wide: panels, field, widget as before (frame 640 × 400 at 2, `pixelated`).
- `touch-*`: a ring where the finger ended; the ship is straight above it.
- `bars-p844`: an installed run (field 371) shrunk to 390 × 664 mid-run: frame 316 × 538,
  the same 371 rows, 38 columns either side, not paused. `turned-*`: turned on its side, wide,
  paused, the field whole.

## Checks, and what they gave

- `npm run test:galaga`: 114 pass, 0 fail. `tests/galaga-layout.test.mjs` is rewritten to the
  new rule: the nine narrow screens above, an installed phone under a notch, and wide; the frame is the canvas
  (width × n, rows × n, n = ceil), the field 240 wide and 320 to 432 tall and centred, the
  whole band on the field, every band window and the plates inside the frame and clear of the
  radio widget, the field above the bottom band, a short screen no wider than it must be, a
  run's field kept at every phone, a touch mapped by the frame, wide as it was, a sweep of
  11,000 screens. Also: every speaker's name and channel fit the plate row.
- `npm run typecheck`: exit 0. `npm run build`: exit 0.
- Wide did not change: the old arithmetic (copied from the file as it was) against the new at
  203,616 screens and field heights: 147,215 wide, the same mode and the same numbers in
  every one. The two pictures taken earlier today do not match pixel for pixel, mostly in the
  field; they were taken before later jobs, so that comparison says nothing either way.
- The finger (`shot.mjs touch`): identifier −1073741822 (the page saw that number), put
  down, dragged in six moves, held. At all nine screens the ship ended within 0.01 field px of
  the place 42 px above the finger. The lab works that place out with the same formula as the
  page; the ring in the picture is drawn from the CSS point alone and agrees
  (375 × 553: 52 CSS px between ring and ship = 42 logical).

      npm run build && npm run preview     # port 8788
      node scripts/galaga-lab/shot.mjs http://localhost:8788 phone-play,phone-boss,touch,bars,turned tmp/phone/shots

## Decided where the brief left room

- **The name plate and the channel stand on the band**, on the bare steel under the score
  (`BAND_PLATES`), side by side, each as wide as its words, and only while someone speaks.
  Above the band there is room beside the widget for 14 letters at most and two names are
  longer; a row under the widget would cost every phone 13 rows of field. On the band they
  cost none and can never be under the widget or an iPhone's status bar.
- **Rows left over after a 432-row field go under the field** as backdrop, not to the console
  and not shared above: the console stays small and the ship's lowest place is lifted off the
  bottom edge. None of the brief's screens has such rows (the tallest field is 405).
- **The lamps and the voyage chart** no longer have a strip on a tall phone: the lit lamps
  stand in the field's corner on every narrow screen, the chart is not shown.
- **The frame widens two columns at a time**, so the field is exactly in the middle.
- **The widget's left edge is taken at its CSS max-width**, not as measured: it grows with the
  track's name, and the layout is only measured at the start and on a resize.
- **GAME OVER's panel** keeps whole device pixels (`wholePx`): on 390 × 844 @3 it is 320 CSS
  px wide, as before.
- **Sound** (`Game.vue`, `audio.ts`): `wake()` runs at the start of a run and on every
  touchstart, touchend and keydown of it (not while paused: pause suspends the context on
  purpose). `audio.start()` makes one context, asks it to run whenever it is not (iOS's
  `interrupted` too) and never throws; a test holds that. Every audio call in `Game.vue` goes
  through a `try`. **Nobody heard it.**
- `docs/games/galaga.md` described the old rule in four places and is brought up to date; one
  clause in `AGENTS.md` (line 65) said "whole device pixels" of this game and now says both.

## Open

- **An installed iPhone with a notch** is not what the lab drew. There the widget sits under
  the status bar (47 CSS px down), so the band sits lower: by the arithmetic 44 rows of wood,
  a field of 349, the console 27 % of the height, with the status bar over the first 29 rows
  of wood. Moving the widget would win those rows back; that is the site's, not this job's.
- **The console is 22 to 25 % of the height on the tall phones and 27 to 28 % on the short
  ones**, not a fifth: the band alone is 96 rows and the widget needs 13 to 31 above it.
- **375 × 667 @2 is fitted by 24 %**, outside the rule's 2 to 20 %: 750 device px over a 248
  frame is 3.02, and ceil gives 4. Whether that softening shows was not looked at on a phone.
- At a pixel ratio of 1 (a narrow desktop window) the browser's smoothing can be seen.
- On a short screen things are cut at the field's edge with sky beyond it and no line drawn.
- A new speaker whose name and channel together pass 156 px fails the layout test by design.
- The touch check runs in Chrome's touch emulation, not in Safari.

## Files

Changed:

- `themes/galaga/DESIGN.md`
- `themes/galaga/Game.vue`
- `themes/galaga/audio.ts`
- `themes/galaga/render/layout.ts`
- `themes/galaga/render/index.ts`
- `themes/galaga/render/console.ts`
- `themes/galaga/render/field.ts` (one flag: the sky beside the field without the large things)
- `tests/galaga-layout.test.mjs`
- `tests/galaga-audio.test.mjs`
- `scripts/galaga-lab/shot.mjs`
- `docs/games/galaga.md`
- `AGENTS.md` (one clause)

Created: `scripts/galaga-lab/REPORT-phone.md`; pictures in `tmp/phone/shots/` (git-ignored).

Deleted: none.
