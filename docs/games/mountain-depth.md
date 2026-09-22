## Mountain depth and steering (2026-09-07)

The shared Neon Horizon uses `themes/base/mountainTerrain.js`: a deterministic
XYZ heightfield projected into Canvas 2D, with irregular pointed peaks, dark
faces and violet triangle edges (mesh revision 2026-09-07). Geometry and
face/edge colours are built once per theme instance;
resize reprojects the same landscape. `horizon.setView(x, y)` accepts normalized
coordinates from -1 to 1; `update(dt)` smooths the camera response. Near terrain
moves farther than distant ridges, while the sun stays fixed.

Breakout follows the paddle, Invaders the cannon, Tetris the active piece's
occupied-cell centre (a change-only `view` event through Arcade and Landing),
and Player One the pointer. Reduced motion disables this parallax. Star Fox
uses an instanced, lit three.js heightfield with ship-driven parallax; its
mountain travel and parallax stop under reduced motion. These changes cover
the five synthwave mountain backgrounds; Another Shore's authored landscapes
and the other games keep their own renderers.

Verified 2026-09-07 in headless Chromium at 1440×900 and 375×667 for all
five themes: no page errors or document overflow; keyboard start/steering
smoke checks, Player One pointer input, and unchanged canvas under reduced
motion. Star Fox rendering was separately checked with SwiftShader enabled.

The shared sun now frames itself against the highest nearby terrain tips,
placing those tips about one third of the disc height above its bottom
(2026-09-07). Per-load jitter remains; steering does not move the sun.
An explicit `sunY` still overrides the automatic framing. Star Fox keeps its
separate terrain and sun. Verified 2026-09-07: Player One, Breakout, Invaders
and Tetris at 1440×900 and 375×667 in Chromium, no page errors or document
overflow; `npm run typecheck` passes.

