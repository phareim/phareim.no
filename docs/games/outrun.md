## OutRun — five stages and a fork in the road (rebuilt 2026-09-11)

`?theme=outrun` is the eighth live theme, between Star Fox and Tetris: the
1986 cabinet as a pseudo-3D road racer in Neon Dreams paint. The first
version (2026-09-10, commit `fde2e30`) was replaced from scratch the next
day; see the lessons at the end of this section.

**The run.** Title (autopilot drives behind it) → SELECT MUSIC (three tracks,
←/→ or tap, 10 s timer) → 3-2-1-GO → five stages. Every stage ends in a Y:
left leads to the easier stage, right to the harder, fifteen stages in a
pyramid (1+2+3+4+5), a direction board over the road before each split and a
sign in the gore. The checkpoint after the fork extends the clock
(75 s start, +65/64/63/62). The fifth stage ends at a GOAL gantry that pays
20000 per second left. TIME UP rolls the car to a stop; an Esc hold quits.
Score is km/h × 10 per second, +1000 per close pass, +50000 per stage.

**Driving model** (`engine.ts`, 1/120 s substeps): five-speed automatic
(torque dip at each upshift, heard as the note dropping), gravity along the
slope, smoothed steering whose authority grows with speed, centrifugal push
with speed², tyre load that squeals and scrubs speed in hard bends (a full-lock
lane change on a straight does not), dirt that caps speed at 42 %. Traffic is
always slower than you and only changes lanes well ahead of you: a soft hit is
a BUMP, a hard one a SPIN, a roadside prop at speed a TUMBLE (barrel roll,
restart from standstill on the nearest lane). The car body leaves the road
over sharp crests (visual only).

**Files.** `engine.ts` — pure and deterministic; road generation per biome,
forks, traffic, collisions, clock, autopilot (attract loop, goal cruise,
balance sims). `renderer.ts` — Canvas 2D: camera solved per screen so the car
keeps its share of the width (bigger on phones), near-to-far segment
projection with crest occlusion, road batched into one Path2D per colour,
sprites far-to-near clipped at their slice, five sky palettes blended across
the run-in to the next stage, six backdrops (wire peaks, mesas, skyline,
canyon, coast, grid), vector props, rear-view cars that show a flank when
turned, sun reflection on the wet road, canvas HUD (score, time, stage +
route map, speed + tacho + gear, radio). `audio.ts` — Web Audio only: engine
(detuned saws + square sub, clipper, low-pass on throttle/revs, firing LFO),
tyre squeal, wind, dirt, one-shots, and a step sequencer for the three
original tracks (MIDNIGHT SHOWER, PASSING NEON, SPLASH GRID; bass, pad, arp,
lead through a dotted-eighth delay, drums through a gated reverb). Nothing
plays before the Enter/tap that opens SELECT MUSIC. `OutRun.vue` — loop,
input, phases, messages. `Landing.vue` — title and result panels (DOM).

**Controls.** Keys: ↑/W/Space gas, ↓/S brake, ←→/AD steer, M cycles the
radio (three tracks, then off), P or an Esc tap pauses (audio suspends).
Touch: throttle is open, drag anywhere to steer (analog, relative to the
touchdown), a second finger brakes, tap the radio readout to change track.
The radio choice is kept in `localStorage.outrunRadio`, the best score in
`outrunHighScore`.

**Checks.** `npm run test:outrun` (28 engine tests, in CI): road
determinism, fork structure, props off the asphalt, countdown, gears and
acceleration, coasting/braking, dirt cap, steering, centrifugal push, skid,
bump/spin/close pass, tumble and restart, both fork branches with checkpoint
and clock extension, TIME UP, warnings, demo mode, goal bonus, autopilot
through the first fork. Balance, verified 2026-09-11 with the autopilot over
five seeds: it reaches stage 5 every time and finishes about one run in
five, so a clean human run makes the goal with seconds to spare. In dev,
`window.__outrun` exposes `state`, `phase`, `drawMs`, `ff(seconds)` and
`jump(col, node)` for headless screenshots (headless Chromium runs at ~4 fps
on Sleeper, so fast-forward instead of waiting). Draw cost ~3.5 ms per frame
of JavaScript at 1280×720; the backing store is capped at 3.2 megapixels.

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

