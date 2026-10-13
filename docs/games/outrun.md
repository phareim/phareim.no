## Nova & Rex' Drive to the Mountains (the theme `outrun`, rewritten 2026-10-13)

`?theme=outrun` is a pseudo-3D road racer in the manner of the 1986 cabinet:
Nova and Rex, of Nova's Solo Rescue (`~/github/nova`, nova.phareim.no), drive a
red convertible from Neo Boston to the mountains in one night. Nova drives; Rex
holds the pizza. © 1Q89 Sleepy Productions, on the title.

Until 2026-10-13 this theme was OutRun in Neon Shrine's paint. The rules, the
theme id, the Hall of Fame board (`outrun`) and the keys kept in the browser are
the same; the look, the names, the car, the stages, the endings and the talk are
new. Petter's brief: stay close to the art of Nova's Solo Rescue, let the two of
them banter as they drive, and have their bodies in the car look like that
game's key art.

**The run.** Title (the autopilot drives behind it) → PICK A TAPE (three
tracks, ←/→ or tap, 10 s timer) → 3-2-1-GO → five stages. Every stage ends in a
Y: left leads to the easier stage, right to the higher and harder, fifteen
stages in a pyramid (1+2+3+4+5), a direction board over the road before each
split and a sign in the gore. A column is an hour of the night and a step nearer
the mountains:

| Column | Hour | Stages, left to right |
|---|---|---|
| 1 | dusk | NEO BOSTON |
| 2 | night | NORTH SHORE · MILL TOWNS |
| 3 | midnight | BARN COUNTRY · MOOSE WOODS · GRANITE NOTCH |
| 4 | dawn | COVERED BRIDGE · LOON LAKE · LOGGING ROAD · FROST HOLLOW |
| 5 | sunrise | MAPLE VALLEY · CABIN ROAD · THE NOTCH · SNOW LINE · SUMMIT ROAD |

Six kinds of land (`Biome` in `engine.ts`): `city` (lamps down both kerbs,
triple-deckers and mills, two tunnels), `shore` (the sea on one side, a
lighthouse on the sand), `farms` (telephone poles, maples, barns, a diner),
`woods` (pines, deer signs, a cabin), `pass` (pines and granite, one tunnel) and
`peaks` (snow, one tunnel). The START gantry carries four lamps: three reds
light with the countdown, all go green on GO. The checkpoint after the fork
extends the clock (75 s start, +63/62/61/60). The fifth stage ends at a GOAL
gantry that pays 20000 per second left; the ending card comes up over the road
in a stipple (the car parked at an overlook, the two of them on the wall with
the pizza), and the result panel follows with one line of ending per final road
and the lap table (stage times as `1'04"37`). TIME UP rolls the car to a stop;
an Esc hold quits. Score is km/h × 10 per second, +50000 per stage, and close
passes in a chain: a pass within 0.62 half-widths at over 60 % speed pays
1000 × its place in the chain, the chain holds for 3.5 s after each pass (up to
×8), and a crash or a wall scrape breaks it.

**The look** is the one of Nova's Solo Rescue (`~/github/nova/docs/design.md`):
a late-1990s arcade board that scales sprites. Nothing is blended: no light
map, no bloom, no scanlines, no fog, no glow on the lettering. The shared pixel
stage is asked for bare pixels (`present({ ambient: null, bloom: 0, overlay:
false })`).

- **Bitmaps for every thing.** The car with the two of them in it (three
  frames: straight, swung left, swung right), four cars of traffic (a Checker
  cab, an 8-Tracks removal truck, a small round car, a station wagon), twenty
  roadside things, three backdrop bands (the skyline of Neo Boston, wooded
  hills, the range), six clouds and the ending card are indexed PNGs in
  `public/outrun/` (50 files, 185 KB), drawn at their own size or scaled with
  nearest neighbour. The talk portraits are copied from nova. How they are made:
  `scripts/outrun-lab/art/README.md`.
- **The road in flat colours**, one scanline at a time: asphalt in two tones,
  a gravel shoulder in two tones (what streams past at the edge of the eye),
  painted lines, the land of the biome in two bands with specks. After dark the
  headlamps put a lighter tone on the asphalt ahead of the car, thinning to
  every other row at its far end.
- **The hour is a palette.** Each hour (`HOURS` in `renderer.ts`) has a sky of
  six flat bands, handed to one another over three rows of an ordered pattern,
  and a shade: a tint and how far colours are pulled towards it. Every colour
  the renderer uses and every bitmap goes through it (`shadeRgb` in `color.ts`,
  the shaded copy of a bitmap made once and kept by `art.ts`). Plain colours
  take the shade; lit ones (a window, a lamp, a tail lamp, a cathode screen)
  keep theirs, which is what makes a night. The run-in between two stages mixes
  the sky's bands in eight steps and changes the shade half way.
- **The range grows.** `mountains` is out of sight in town and rises behind the
  horizon by a quarter with every column; among the peaks it is all there. The
  nearer band is the skyline in town and the hills elsewhere.
- **The car is always drawn at its own size** (131 pixels wide). The camera is
  solved from it, and `resize` picks the whole-number scale that puts about 440
  logical pixels across a monitor (the car a little under a third of the width)
  and about 260 across a portrait phone (half of it). Its picture looks down on
  the car, so the horizon sits high (36 % of the height on a monitor) and the
  road ahead shows over their heads. The three frames are pinned at the number
  plate (`CAR_AX`); a second copy of each has the ends of the two headbands and
  of her hair a pixel lower, and the two alternate with speed (`art.flutter`).
  Under a tunnel's roof the car takes a darker shade between the lamps.
- **Tunnels**: concrete walls with a band of cream tile, sodium bars down the
  roof, drawn per segment in the far-to-near sprite pass so nearer wall covers
  farther wall in a bend. The mouth is a brick block with lit windows in town
  and a cut of granite (a tile, `rockTile`) in the hills, in a frame of stone.
- **Signs** are code: green highway boards with a cream line and the 5×7 face,
  on steel posts. The HUD, PICK A TAPE and the talk box are drawn in the 5×7
  face on the stage's HUD layer; the title and result panels are HTML
  (`Landing.vue`) in the same inks with hard shadows.

**The talk** (`banter.ts`, pure and seeded like the engine). The page hands it
cues from the run's events (`talk()` in `OutRun.vue`): GO, a fork taken left or
right, a new stage by its biome, a tunnel, a close pass, a chain of four, a
bump, a spin, a wreck, a wall scrape, the dirt, a backfire, six seconds flat
out, the last ten seconds, TIME UP, the goal. It answers with an exchange of one
to three lines said in turn. Urgent cues cut in on small talk and otherwise wait
for the line on screen; reactions need five quiet seconds; small talk starts by
itself after nine to fifteen; nothing is said twice in a run, and a cue whose
lines are used up is passed over. The renderer shows the line in the talk box of
Nova's Solo Rescue (`drawTalk`): a 42-pixel window of the speaker's portrait,
the name on a tab, the words coming on a letter at a time. It sits in the sky
at the left (centred on a phone), clear of the vanishing point and of the car.
The voices follow `~/github/nova/docs/story.md`: Nova dry and short (nine words
at most, held by a test), Rex cheerful and hungry. Lines are at most 56
characters, which is two rows of the box.

**Driving model** (`engine.ts`, 1/120 s substeps, unchanged by the rewrite):
five-speed automatic (torque dip at each upshift, heard as the note dropping),
gravity along the slope, smoothed steering whose authority grows with speed,
centrifugal push with speed², tyre load that squeals and scrubs speed in hard
bends (a full-lock lane change on a straight does not), dirt that caps speed at
42 %. Traffic is sparse (a new car every 1–3 s), always slower than you, and
only changes lanes well ahead of you: a soft hit is a BUMP, a hard one a SPIN, a
roadside thing at speed a TUMBLE (barrel roll, restart from standstill on the
nearest lane). Tunnel walls stand at 1.2 half-widths: they hold the car on the
asphalt, and leaning on one scrapes speed off and throws sparks instead of
wrecking the car. The car body leaves the road over sharp crests (visual only).

**Files.** `engine.ts`: pure and deterministic; the stage table, road
generation per biome, forks, traffic, collisions, clock, autopilot.
`banter.ts`: the lines and the rules for saying them. `renderer.ts`: the frame
(hours, sky, backdrop bands, the road, sprites far to near, tunnels, signs, the
car, particles, the ending card, HUD, talk box, PICK A TAPE). `art.ts`: the
list of pictures, loading, shaded copies, repeating bands, the flutter frame.
`color.ts`: the inks and the shade. `pixel.ts`: whole-pixel shapes, the talk
box, the rock tile, the stipple. `audio.ts`: Web Audio only: engine, tyres,
wind, one-shots, and the three tapes (FOR NOVA, SOUTHIE NIGHTS, SIDE B SUNRISE;
the same three loops as before under new names, also stations 4 to 6 of the
site's radio). `OutRun.vue`: loop, input, phases, messages, the cues.
`Landing.vue`: title and result panels (DOM).

**Controls.** Keys: ↑/W/Space gas, ↓/S brake, ←→/AD steer, M cycles the
tapes (three tracks, then off), P or an Esc tap pauses (audio suspends).
Touch: throttle is open, drag anywhere to steer (analog, relative to the
touchdown), a second finger brakes, tap the tape readout to change track.
The tape choice is kept in `localStorage.outrunRadio`, the best score in
`outrunHighScore`.

**Checks.** `npm run test:outrun` (55 tests, run before every deploy): the
engine (34: road determinism, fork structure, things off the asphalt,
countdown, gears, steering, skid, bump/spin/close pass, the chain, tunnels per
biome, the backfire, tumble and restart, both fork branches, the clock, the
goal, the autopilot through the first fork), the talk (14: every cue and biome
has lines, faces exist, lines fit the box and the font, Nova's nine words,
nothing said twice, the cooldowns and priorities, the same talk for the same
seed) and the pictures (7: `public/outrun` holds exactly the pictures `art.ts`
lists, all indexed, a portrait for every face, under 260 KB; the shade leaves
lit colours alone).

`node scripts/outrun-lab/shot.mjs ~/oshots/x [scene,…]` renders the real engine
and renderer to PNGs in headless Chromium without Nuxt (every biome, both
tunnels, the fork, the countdown, the goal, the card, the talk box, PICK A
TAPE, at 1280, 1920, phone portrait and phone landscape; the out dir must be a
non-hidden path under `$HOME` for snap Chromium; on Sleeper through `heavy -x
chrome --`). The lab reports eight cores to the page, because Sleeper's four
make the site render at a lower ratio than a phone does. In dev,
`window.__outrun` exposes `state`, `phase`, `drawMs`, `ff(seconds)` and
`jump(col, node)`.

**Not judged** (2026-10-13): nobody has played this build by hand, heard it, or
held it on a phone. The pictures were looked at as stills from the lab at 1280
and at a phone's size. The driving feels as it did, since the rules are
untouched but for the widths of the traffic (the cab 0.20, the truck 0.25, the
wagon 0.22 half-widths, to match their pictures); how the larger car on screen,
the higher horizon and the talk box sit with that is Petter's to say. A frame's
cost has not been measured on a phone.

The Hall of Fame lists `outrun` between starfox and tetris as Drive to the
Mountains, with `maxScore: 5_000_000` (a full run scores about 1.1 million);
scores from before the rewrite stay on the board.

**Lessons kept from the first version of the racer** (2026-09-10):
- The HUD belongs in the corners, never on the vanishing point.
- Solve the camera from the car's size, or the road ends up two screens wide.
- Speed comes from things streaming past: shoulder bands, dashes, posts, trees.
- Steering is analog and smoothed.
- Road near to far, sprites far to near.
- Stages, forks and a goal give a run an arc and a reason to choose.
- An engine note that follows the gearbox is half the feel.
