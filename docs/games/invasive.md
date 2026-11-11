## Invasive (Invaders Mk II)

`?theme=invasive`, the cabinet at the left end of the arcade's back wall.
Space Invaders with nearly every rule taken out: no rows, no waves, no lives,
no bunkers, and killing invaders one at a time is the slow way to play.

**The idea.** The sky over the town is one organism. A grid of cells
(about 30×45 on a phone, 52×50 on a desk) holds its tissue, and every cell is
a four-pixel invader with two frames. The ceiling is flesh with a heart in
it; tendrils grow from the ceiling down to the roofs, one cell per heartbeat.
Tissue lives only while it is joined to a heart. Three rules follow, and they
are the whole game:

- **Cut.** A bolt takes out the lowest cell in its column. Everything that
  hung from that cell has lost its heart: it flickers white and dies in a
  cascade out from the cut. One bolt in a tendril's neck is worth a hundred
  shot from below, in points (`n × (2 + ⌊n/8⌋)` for `n` severed cells, 1 for
  a cell shot directly) and in gold.
- **The lance.** Severed tissue sheds gold motes (one per four cells; a pod is
  always one). Caught by the cannon they fill the curb along the street,
  which is the gauge. Full, the lance fires by itself for 3.2 s: a beam that
  eats four cells a tick. Bolts glance off a heart; only the lance kills one.
  When the last heart goes, the whole layer dies outward from it, every lit
  house gets a window back, and the next layer comes down.
- **The windows.** There are no lives. A tendril that reaches the roofline
  creeps to the nearest lit house and roots; each root puts out a window
  every few beats until it is cut. The windows light the picture (the light
  map's ambient follows them), so a losing town is a darker screen. When
  every window is out the run ends: THE TOWN IS DARK.

The heart rate is the difficulty. It rises with the amount of tendril in the
sky (the reverse of 1978, where killing made it faster: here pruning calms
it) and with `rage`, which climbs for as long as a layer is left alive, so
sweeping the cannon back and forth holds for a minute and then does not.
Spores from pods snare the cannon for a second (no movement, no fire); a bolt
pops them. The top row of the ceiling cannot be shot (it is the organism's
back, and it goes on above the screen), so the ceiling cannot be cut in two.

**Layers.** Five species, then the cycle repeats harder (`speciesFor`):

| Layer | Species | What is new |
|---|---|---|
| 1 | MOSS (pink) | the basics |
| 2 | VINE (violet) | fast, branching, and the heart walks sideways |
| 3 | CORAL (orange) | stems harden to two hits if left to age; more pods |
| 4 | MYCEL (teal) | two hearts: everything lives until both are dead |
| 5 | CROWN (gold) | two walking hearts and bark |

**Controls.** Keys: ← → / A D move, hold Space (or ↑ / W) to fire, P or an
Escape tap pauses, a 3 s Escape hold quits. Mouse: the cannon follows the
pointer, hold the button to fire. Touch: the cannon is under the finger and
fires while it is down; a tap is one bolt in that column, which is how a
precise cut is made. The street leaves a strip under the cannon for the
finger, above the bottom band.

**Sound** (`audio.ts`). No loop and no samples. The heart is the kick, and
every cell that dies in a cascade is the next note up a minor pentatonic
(the root moves with the species), so a big cut plays a run. Voices come from
`composables/useSound.ts` (`playTone`, `playNoise`: the shared context, buses
and mute). The radio is parked for the run and resumed at game over.

**Code.**

- `themes/invasive/engine.ts`: the rules, pure (no DOM, no clock). Typed
  arrays for the grid, a flood fill from the hearts for what is alive,
  `stepGame(g, dt, input)`, an event list for the view, and `autopilot`, which
  plays the attract mode behind the title and is the player the tests measure
  the rules with.
- `pixel.ts`: the art (cells, heart, pod, cannon, houses, backdrop).
  `Game.vue`: canvas on the shared pixel stage, loop, input, particles,
  hints. `Landing.vue`: title, HUD, pause card, game over.
- A field's size is fixed for a layer; a resize is taken at the next layer
  (`setField`), at once in the attract mode. Tendril count, the lance's
  charge and the key speed scale with the field's width (`cols / 32`).
- Score id `invasive` in the Hall of Fame.

**Tests.** `npm run test:invasive` (23 tests): the organism starts whole and
never stalls (an unplayed run always ends dark), cuts sever exactly what hung
from them, the ceiling cannot be cut in two, bolts do not hurt a heart and
the lance does, two hearts, roots and windows, spores, a field resize, the
same run for the same seed, and whole runs under the autopilot on a phone
field and a desk field.

**Balance, and what is not measured.** The numbers were set against the
autopilot (2026-11-11): a layer takes it about a minute; shooting only what
hangs lowest it loses in 3 to 5 minutes, looking for cuts in 5 to 13. No
person has played it to tune it, and no physical phone has run it. In
headless Chromium with a 4× CPU throttle at 375×667 it draws as fast as
Space Invaders and Space Paddle do under the same throttle; 60 fps on a
desk.

**Lab.** `node scripts/invasive-lab/shot.mjs <devUrl> <outDir> [phone|desk]
[seconds] [every]` screenshots the title and then a run the autopilot plays
(`&bot` on the URL, dev server only).
