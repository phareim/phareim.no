## OutRun — five stages and a fork in the road (rebuilt 2026-09-11, third pass 2026-09-23)

`?theme=outrun` is the eighth live theme, between Star Fox and Tetris: the
1986 cabinet as a pseudo-3D road racer. The first version (2026-09-10,
commit `fde2e30`) was replaced from scratch the next day; see the lessons
at the end of this section. The third pass (2026-09-23) added the
convertible with its two passengers, tunnels, the sea, start lights, the
close-pass chain, stage times and endings.

**Look (2026-09-24): Neon Shrine's pixels, as a SNES-era sprite-scaler**
(`docs/games/pixel-look.md`). The picture is drawn at a low logical
resolution on the shared pixel stage — about 320×200 on a monitor, 234×506
on a portrait phone — and scaled up by a whole number, lit by a light map,
bloomed and scanlined like the town on `/`. The road is drawn one scanline
at a time, so stripes, rumble strips and ground bands are chunky pixels;
mountains, tunnel walls and signs are polygons rasterised into whole-pixel
spans (`pixel.ts`, no antialiasing). The ground wears Neon Shrine's terrain
colours per biome (teal grass on the coast, rose sand on the mesa, violet
shrine floor in the city, clay in the canyon; the grid stage keeps its
grid); the sea is blue water with ripples, foam and sun glitter beside a
rose beach. The palms are Neon Shrine's round teal (or moonlit violet)
canopies with a magenta rim; beach huts are its shingle-roofed houses;
tunnel mouths outside the city are shrine gates of dungeon stone. Signs and
gantries are dark boards with a neon frame and the 5×7 font when they are
near enough to read. The cars are the vector painters of `cars.ts`
pixelized (palette-snapped, outlined, top-lit) at width steps and cached;
a frame bakes at most three new sizes and scales the nearest one
(nearest-neighbour) until then. Lamps, tail lights, brake lights, the
backfire, tunnel lamps, start lights and fireworks light the scene; in a
tunnel the ambient drops, so the roof lamps pass over the car. The HUD and
SELECT MUSIC are drawn in the 5×7 font on the stage's HUD layer (the clock
sits under the score on a portrait phone, clear of the site's radio chip);
the title and result panels are HTML in `.px-*` with Neon Shrine dialog
boxes.

**The run.** Title (autopilot drives behind it) → SELECT MUSIC (three tracks,
←/→ or tap, 10 s timer) → 3-2-1-GO → five stages. Every stage ends in a Y:
left leads to the easier stage, right to the harder, fifteen stages in a
pyramid (1+2+3+4+5), a direction board over the road before each split and a
sign in the gore. The START gantry carries four lamps: three reds light
with the countdown, all go green on GO. The checkpoint after the fork
extends the clock (75 s start, +63/62/61/60). The fifth stage ends at a
GOAL gantry that pays 20000 per second left; fireworks go up over the road,
and the result panel shows one line of ending per final road and the lap
table (stage times as `1'04"37`). TIME UP rolls the car to a stop; an Esc
hold quits. Score is km/h × 10 per second, +50000 per stage, and close
passes in a chain: a pass within 0.62 half-widths at over 60 % speed pays
1000 × its place in the chain, the chain holds for 3.5 s after each pass
(up to ×8), and a crash or a wall scrape breaks it (HUD: CHAIN ×n under
the score, with a draining bar).

**Tunnels.** City stages bore two, canyon and peaks stages one, at even
fractions of the stage (`TUNNELS`, `addTunnel` in `engine.ts`): a straight
approach, a gentle bend under a roof, a straight out. Tunnel segments carry
`tunnel: true` and no props. The walls stand at 1.2 half-widths
(`TUNNEL_WALL`): they hold the car on the asphalt, and leaning on one
scrapes speed off (`SCRAPE_DECEL`), throws sparks and grinds instead of
wrecking the car. The renderer draws stone walls, roof, a neon strip and
gold roof lamps per segment in the far-to-near sprite pass, so nearer wall
covers farther wall in a bend, and a face with a lit portal at the mouth
(a building in the city, a shrine gate elsewhere). Inside, the light map
darkens and each roof lamp lights the car as it passes; the engine gets a
slap-back echo.

**Driving model** (`engine.ts`, 1/120 s substeps): five-speed automatic
(torque dip at each upshift, heard as the note dropping), gravity along the
slope, smoothed steering whose authority grows with speed, centrifugal push
with speed², tyre load that squeals and scrubs speed in hard bends (a full-lock
lane change on a straight does not), dirt that caps speed at 42 %. Traffic is
sparse (a new car every 1–3 s, halved 2026-09-23), always slower than you,
and only changes lanes well ahead of you: a soft hit is
a BUMP, a hard one a SPIN, a roadside prop at speed a TUMBLE (barrel roll,
restart from standstill on the nearest lane). The car body leaves the road
over sharp crests (visual only).

**Files.** `engine.ts` — pure and deterministic; road generation per biome,
forks, traffic, collisions, clock, autopilot (attract loop, goal cruise,
balance sims). `renderer.ts` — the pixel stage: camera solved per screen so the car
keeps its share of the width (bigger on phones), near-to-far segment
projection with crest occlusion, the road one scanline at a time,
sprites far-to-near clipped at their slice, five sky palettes (dithered,
cached per palette) blended across the run-in to the next stage, six
backdrops (peaks, mesas, skyline, canyon, coast with a far tree line,
grid), the sea beside coast stages (beach, water, ripples, foam, sun
glints; left on even nodes, right on odd), pixel props,
tunnels, sun reflection on the wet road, speed streaks from the vanishing
point above 70 % speed, fireworks at the goal, canvas HUD (score + chain,
time, stage + route map, speed + tacho + gear, radio). Traffic that drops
behind the player dithers out before it can fill a corner of the screen.
`pixel.ts` — the pixel kit: whole-pixel polygon/line/disc fills, the
dialog box, the dungeon-stone tile, and the car-sprite bakes (a fast
typed-array pixelize with a colour memo, width steps, the per-frame bake
budget).
`cars.ts` — the cars, drawn from behind: traffic (sedan, truck, bug, coupe,
a flank shows when turned) and the player's Testarossa Spider in Neon
Dreams pink: wide hips, the slatted rear panel with the lamps glowing
through it, the top down, the driver on the left and a passenger whose gold
hair streams harder with speed (six baked frames); both heads lean out of
the bends, the pipes flame on a backfire. `color.ts` — the three inks and the mix/rgba helpers. `audio.ts` — Web Audio only: engine
(detuned saws + square sub, clipper, low-pass on throttle/revs, firing LFO),
tyre squeal, wind, dirt, one-shots, and a step sequencer for the three
original tracks (MIDNIGHT SHOWER, PASSING NEON, SPLASH GRID; bass, pad, arp,
lead through a dotted-eighth delay, drums through a gated reverb), a panned whoosh for each car
passed, exhaust pops (lifting off fast, and upshifts from third), the
close-pass chime climbing a scale with the chain, the tunnel echo on
engine and wind, and a grinding band while a wall scrapes. Nothing
plays before the Enter/tap that opens SELECT MUSIC. `OutRun.vue` — loop,
input, phases, messages. `Landing.vue` — title and result panels (DOM).

**Controls.** Keys: ↑/W/Space gas, ↓/S brake, ←→/AD steer, M cycles the
radio (three tracks, then off), P or an Esc tap pauses (audio suspends).
Touch: throttle is open, drag anywhere to steer (analog, relative to the
touchdown), a second finger brakes, tap the radio readout to change track.
The radio choice is kept in `localStorage.outrunRadio`, the best score in
`outrunHighScore`.

**Checks.** `npm run test:outrun` (34 engine tests, in CI): road
determinism, fork structure, props off the asphalt, countdown, gears and
acceleration, coasting/braking, dirt cap, steering, centrifugal push, skid,
bump/spin/close pass, the chain (rising pay, window running out, a pass
event per car), tunnels (right count per biome, empty inside, walls hold
and scrape), the lift-off backfire, tumble and restart, both fork branches
with checkpoint, clock extension and stage time, TIME UP, warnings, demo
mode, goal bonus and last stage time, autopilot through the first fork.
Balance, verified 2026-09-23 with the autopilot over 30 seeds: it reaches
stage 4 or 5 every time and finishes 7 of 30, the same rate as before the
tunnels (they are gentler than the bends they replace, hence the 2 s cut
per checkpoint), so a clean human run makes the goal with seconds to spare.
In dev, `window.__outrun` exposes `state`, `phase`, `drawMs`, `ff(seconds)`
and `jump(col, node)`. `node scripts/outrun-lab/shot.mjs ~/oshots/x
[scene,…]` renders the real engine and renderer to PNGs in headless
Chromium without Nuxt (coast, peaks, city, tunnel, mouth, countdown, goal,
phone sizes; the out dir must be a non-hidden path under `$HOME` for snap
Chromium). The backing store stops at 2× the CSS size (the canvas has
`image-rendering: pixelated` for the last step on a 3× screen). Measured
2026-09-24 in headless Chromium without a GPU: a car bake 1.5–9 ms; the
renderer's own drawing (sky, road, sprites, car, HUD) ≤ 20 ms per frame and
about 9 ms median at 390×844; the shared stage's full-screen upscale and
bloom spike to ~200 ms in that software-rendered setup (p95), which a phone
with a GPU canvas should not see. Not measured on a physical phone.

The Hall of Fame lists `outrun` between starfox and tetris with
`maxScore: 5_000_000` (raised from 500_000 with the rebuild; a full run scores
about 1.1 million).

**Lessons from the first version** (what the rebuild fixed):
- The HUD sat on the horizon, over the vanishing point — the one place the
  driver must see. HUD belongs in the corners.
- The car covered 44 % of the width and was a flat box; the camera math put
  the road two screens wide at the car. Solve the camera from the car size.
- The ground had no pattern that moved (two near-identical band colours), so
  300 km/h felt like 60. Speed comes from things streaming past: rumble
  strips, grid lines, dashes, props.
- Binary steering (touch drag turned into left/right at a threshold) and no
  steering inertia: no feel. Steering is analog and smoothed now.
- Sprites were drawn in the road pass, near to far, so far palms painted over
  near cars. Road near-to-far, sprites far-to-near.
- An endless random road has no shape. Stages, forks and a goal give a run
  an arc and a reason to choose.
- No sound. An engine note that follows the gearbox is half the feel.

