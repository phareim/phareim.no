# Parked and classic themes

Breakout and Tetris are live, older arcade themes that didn't have their own
doc yet. Scandinavian Glass, Space and Tufte Desk are parked (`disabled:
true` in `themes/index.ts`): no way in from the portal, still
reachable with `?theme=<id>`.

## Breakout

`?theme=breakout` — the arcade classic, added 2026-09-04. Same
canvas-behind-the-card pattern as Galaga; plays itself (autopilot) until
Enter.

**Look (2026-09-24): Neon Shrine's pixels** (`docs/games/pixel-look.md`).
A shrine chamber seen from above, on the shared pixel stage: dungeon floor
tiles with a faint inlaid sigil, thin walls with a pink neon strip,
braziers on the side walls (orange and cyan fire) that light the room
through the light map, and a dark pit under the paddle. Armoured bricks are
shrine stone with a gold neon strip (pink for the 3-hit top row) that
cracks with each hit; the rest are crystals, pink, violet and teal by row
band. The ball is a glowing orb that lights what it passes, the paddle the
hero's cyan shield bar with a gold gem; powerups are gold capsules with
their letter in the 5×7 font. Braziers flare on paddle and brick hits and
on a level clear; the LEVEL banner is in big pixel letters. The HTML text
uses `.px-*`. The stage shows at least 360×225 logical pixels (128 across
on phones), about 3 CSS px per pixel on laptops and phones. Code:
`themes/breakout/pixel.ts` (chamber, brick/paddle/orb/capsule painters)
and the draw section of `Breakout.vue`. Rules unchanged.

## Tetris

`?theme=tetris` — playable Tetris, ported from `tetris-theme-legacy`. Drag
sideways to move, tap to rotate, fast down flick to hard drop, slow down
drag to lower, up swipe or HOLD to stash. ROTATE/DROP, pause/resume and
exit buttons work on touch and mouse. A gesture stops controlling pieces
once its original piece locks or swaps. The board sizes to its actual
remaining container space with ResizeObserver; landscape phones use two
columns. The cabinet is the whole theme; the portal carries the person.

**Look (2026-09-24): Neon Shrine's pixels** (`docs/games/pixel-look.md`).
The well is a stone shaft on its own pixel stage: a brick back wall with
grout on the cell lines, a violet stone rim with a pink neon strip, lit
from above by two flickering torches and from the floor by a cool glow
through the light map. Pieces are carved bevelled tiles, one palette family
each (I cyan, O gold, T violet, S lime, Z pink, J blue, L orange); the
falling piece is at full brightness with a pool of its own colour, the
ghost is a dotted outline, cleared rows flash white and throw pixel sparks.
A cell is a T×T tile (T 6–10) scaled by a whole number, chosen in
`Game.vue` so T·scale device px is as close as it gets to the layout's cell
size; the rim adds 3 px each side, which `Arcade.vue` allows for. Behind
the cabinet the town at dusk (`Horizon.vue`, its own full-screen stage):
sky, stars, the striped sun, ridges, houses with lit windows, lamps, a
cobbled plaza; a lock pulses the horizon, a clear flares the sun, and the
near layers lean with the falling piece. The chrome (score strip, NEXT/HOLD,
buttons, board overlays) is in the 5×7 font with Neon Shrine dialog boxes;
NEXT/HOLD show the same carved tiles in CSS. Code: `themes/tetris/pixel.ts`.

Tests: `npm run test:tetris` (gesture regression: tap, direction lock, drop,
soft drop, hold); CI runs it before typecheck.

## Scandinavian Glass

`?theme=scandi` — parked. `themes/scandi/Bubbles.vue` is the one Options
API component in the codebase (moved verbatim rather than ported to
Composition API).

## Space

`?theme=space` — parked. Starfield backdrop (`themes/space/Starfield.vue`).

## Tufte Desk

`?theme=desk` — parked. The tactile paper-on-desk layer from the tufte-viz
design system; it replaced an earlier flat Tufte theme. Carries the ET Book
`@font-face`.
