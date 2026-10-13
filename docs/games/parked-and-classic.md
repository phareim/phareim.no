# Parked and classic themes

Russian Block Game is a live, older arcade theme with no doc of its own yet. Breakout is
now Space Paddle — The Odyssey (`docs/games/breakout.md`). Scandinavian Glass, Space and Tufte Desk are parked (`disabled:
true` in `themes/index.ts`): no way in from the portal, still
reachable with `?theme=<id>`.

## Russian Block Game

`?theme=russian` — Russian Block Game (renamed 2026-10-06), ported from
`tetris-theme-legacy`. The old `?theme=tetris` link still opens it; local high
scores and Hall of Fame scores keep their existing storage keys. Drag
sideways to move, tap to rotate, fast down flick to hard drop, slow down
drag to lower, up swipe or HOLD to stash. ROTATE/DROP, pause/resume and
exit buttons work on touch and mouse. A gesture stops controlling pieces
once its original piece locks or swaps. The board sizes to its actual
remaining container space with ResizeObserver; landscape phones use two
columns. The cabinet is the whole theme; the portal carries the person.

**Look (2026-10-07): Crystal Garden**, in Neon Shrine's pixels
(`docs/games/pixel-look.md`). The well is an overgrown shrine trellis with
quiet cell markers, teal vines, cool canopy light and rose roots. The seven
piece tints belong to cyan, rose and gold mineral families. Same-colour
neighbors join into one silhouette; their luminous veins meet at the cell
edges. The active piece emits light, the dotted ghost marks its landing,
and rooting a piece sends a short light pulse through it. Complete rows
open four-petal crystal flowers over 280 ms, then dissolve into rising
light seeds. Each harvested row plants another crystal flower around the
cabinet, up to forty plants per run. Starting again resets the garden.
Reduced motion keeps steady light and skips pulses, seeds and the clear
animation.

Cells remain square for collision and placement; rendering changes no
movement, rotation or scoring rules. A T×T cell (T 6–10) scales by a whole
number selected in `Game.vue`; the rim adds 3 logical pixels on each side.
NEXT/HOLD show the same connected mineral motif in CSS. The score strip,
previews, buttons and overlays use the 5×7 font and shrine dialog boxes.
The town at dusk remains behind the cabinet, with garden tendrils and
luminous flowers among the cobbles; a lock pulses the horizon, a clear
flares the sun, and near layers follow the falling piece.
Code: `themes/tetris/pixel.ts`, `Game.vue`, `Horizon.vue`, `Arcade.vue`.

Checks: `npm run test:tetris` covers gestures. The deploy runs it before
typecheck. `heavy -x chrome -- node scripts/russian-lab/garden.mjs <devUrl>
<outDir>` checks a real harvest, movement, hold, Escape pause/resume/quit,
phone portrait and landscape bounds, reduced motion and browser errors;
it captures idle, bloom and garden frames. Its arranged board uses Vue's
dev-only component state, so run it against `npm run dev`.

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
