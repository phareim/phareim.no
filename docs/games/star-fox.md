# Star Fox — Operation Nightlight

An on-rails 3D shooter in three.js, drawn the Super FX way in Neon
Shrine's pixel look (`docs/games/pixel-look.md`). You fly the Hangar ship
out of the town with Claude in the second seat and three animal wingmen
from the Hall of Fame, through five sectors with a boss each, then on
through ECHO loops. The title screen waits for Enter or a tap. Rebuilt
2026-09-25; everything below verified that day.

## Files

| File | Job |
|---|---|
| `themes/starfox/Landing.vue` | Title, HUD dock and side blocks, sector card, game over, Hall of Fame submit; loads `Flight.vue` lazily |
| `themes/starfox/Flight.vue` | The Vue shell: renderer, pixel stage, frame loop, input, BOMB button, EscHold |
| `themes/starfox/scene/` | The scene, one module per system on a shared context (`ctx.ts`): `env`, `obstacles`, `player`, `squad`, `enemies` + `behaviours`, `setpieces` (Dingo, Cobra), `shots`, `pickups`, `fx`, `boss` + `bosses/<id>.ts`, `encounter`, `storyGlue`, `run`, `overlay`, `debug` |
| `themes/starfox/cast.ts` | Sectors and ECHO names, the pilots, squad rules, name lines (what the landing needs) |
| `themes/starfox/story.ts` | The intercom script and its director; re-exports `cast.ts` |
| `themes/starfox/balance.ts` | Hull, damage, bestiary, speeds, the squad's profiles, Dingo's trouble, the rival |
| `themes/starfox/arsenal.ts` | Capsules, laser levels, NOVA BOMB, charge shot, rings |
| `themes/starfox/encounters.ts` | Each sector's travel as a script, filler under a density cap |
| `themes/starfox/bosses.ts` | The five bosses: parts, phases, attack wheels, fairness helpers |
| `themes/starfox/wingmanAi.ts` | A wingman's brain; `stepSquad` spreads three over the targets |
| `themes/starfox/ids.ts` | Sector, biome and boss ids, ECHO loop arithmetic |
| `themes/starfox/models/` | Low-poly models: enemies, bosses, allies (wing ships, Cobra), capsules, biome props, effects |
| `themes/starfox/pixel.ts` | Render target, palette snap, biome looks and the ground shader |
| `themes/starfox/Intercom.vue` | The intercom panel (Neon Shrine dialog box, portraits, typewriter) |
| `themes/starfox/ModelLab.vue`, `lab/` | The model lab (`?lab=models`) |
| `public/starfox/pilots/` | The seven 40×40 pilot portraits |
| `scripts/make-starfox-pilots.py` | Makes those portraits |
| `scripts/starfox-lab/` | Screenshots and draw-call counts of the model lab |

All the pure modules (`cast`, `story`, `balance`, `arsenal`, `encounters`,
`bosses`, `wingmanAi`, `ids`) import nothing from three.js, Vue or the DOM,
so the tests run them in plain node.

## Story

The Hollow, an armada of dark machines that eat light, has come in over
the sea and is putting out the coast's neon one beacon at a time.
Operation Nightlight turns it back on. Five sectors, each a biome and a
boss:

| # | Sector | Biome | Boss |
|---|---|---|---|
| 1 | CORAL COAST | dusk sea, sea stacks, channel markers | THE PINCER |
| 2 | WHISPER WOODS | night canopy, old trees, spore puffs | THE MOTH |
| 3 | EMBER FIELDS | cracked basalt, lava veins, obsidian spires, geysers | THE FURNACE |
| 4 | MIRROR LAKE | mirror water, crystal monoliths and shards | THE TWINS |
| 5 | THE HOLLOW CROWN | above the sky: stars, nebula, asteroids, hull girders | THE CROWN |

After the Crown comes a short ending (Claude, Wombat and the squad; the
CLEAR holds until it is said), then ECHO I, ECHO II, … replay the five with
more enemies, more HP and faster boss clocks. The route shows on the title
screen and as pips on the game-over screen.

**The cast.** The pilots are Hall of Fame paintings from the fixer.ink
library (tag `phareim-avatar`), picked by Petter 2026-09-25 and pixelized
to 40×40 by `scripts/make-starfox-pilots.py`, which reads them from the
nightly R2 mirror (`~/backups/r2-mirror/aiwdm/images/`), crops the face and
snaps it to the game's palette with a Bayer dither.

| Voice | Who | Painting (library id) |
|---|---|---|
| `claude` | co-pilot in the second seat: teaching, weak points, dry remarks | drawn gold spark |
| `heron` | MAGENTA HERON, wing 2, the ace: hunts ahead, counts kills | 16586 |
| `bison` | ATOMIC BISON, wing 3, the veteran: flies your six, covers you | 16999 |
| `dingo` | MIXTAPE DINGO, wing 4, the rookie: music, gets into trouble | 16998 |
| `walrus` | BYTE WALRUS, reserve | 16062 |
| `zebra` | NOVA ZEBRA, reserve | 17001 |
| `wombat` | GLITCH WOMBAT, the mechanic in town, runs launch control | 16994 |
| `cobra` | MEGA COBRA, a former squadmate who flies for the Hollow | 16067 |
| `hollow` | the armada, a machine voice in `·`-separated capitals | drawn eye |

The player is addressed by the Hall of Fame animal (`Neon Otter` →
`otter`, `pilot` without a profile). A wingman who shares the player's
animal sits the run out for Walrus, then Zebra (`squadFor`). The director
only picks lines whose wing speakers are flying.

**Mega Cobra** flies past in sector 2 (a taunt), fights a duel in sector 3
and escapes when hurt, and fights the final duel in sector 5 before the
Crown (WARNING waits for it). Shot down, he stays gone for the rest of the
run, ECHO loops included; if he outlasts the final duel (60 s) he retreats
and comes back in the loops. **Dingo's trouble** (sectors 2 and 4): he
breaks formation with gnats on his tail; kill them within 12 s or he goes
down.

**The director** (Galaga's model) queues lines by priority: 3 story
(interrupts), 2 teaching (dropped after 6 s in the queue), 1 ambient (only
after 9 s of silence). The opening chatter (Wombat's launch, the briefing,
the roll call) is soft: the sector line and first sightings go ahead of it.
A boss kill hushes whatever the fight still had queued. Lines type at 26 ms
a character on the game clock, so pause freezes the intercom too.

## Controls

- Keyboard: arrows or WASD fly; Space fires, held ≥ 0.7 s it charges;
  Shift or a double-tap left/right rolls; B or X throws a bomb; Esc tap or
  P pauses; a 3 s Esc hold quits to game over; Enter starts.
- Touch: drag anywhere to steer (relative) with auto-fire; a second finger
  held charges, lifting it fires; double-tap rolls; the BOMB button
  (bottom right, above the bottom band) throws a bomb. The home chip is
  hidden during a run.
- The barrel roll takes no damage: it deflects bolts and smashes small
  enemies it touches.

## Weapons and capsules

- **Lasers**: TWIN → TWIN+ → HYPER. `L` raises a level; a hit drops one.
- **NOVA BOMB**: start with 3, hold up to 5, 1 s apart. It flies forward
  and bursts at 70 units or on contact: kills ordinary enemies in the
  blast, clears every bolt and missile, breaks shields, hits bosses hard.
- **Charge shot**: hold fire; the reticle locks the nearest target in a
  forward cone; release fires a homing orb with a small blast. It breaks
  bulwark shields.
- **Capsules** (their own shape and colour, a 5×7 letter): `L` laser,
  `B` bomb, `S` shield (a shell that absorbs 40 damage or lasts 12 s),
  `W` wing (every downed wingman back at full hull, then the squad fires
  double for 10 s), `O` overdrive (8 s of double fire and piercing prism
  lasers). A capsule of something already maxed pays 500. Carriers drop
  one; the script places the rest, picked by need.
- **Rings**: silver heals 12; gold (off the easy line) heals 25 and pays
  500; all three gold rings in a sector pay ALL GOLD, 3000 and a bomb.

Hull is 100. Bolts do 12, rams 25, props and rocks 20, missiles 16. A
boss kill heals 40 and pays `1000 × sector`. Kills chain into a multiplier
(×1, 2, 3, 4, 6, 8, two kills a step, 3 s to keep it).

## Enemies

Twelve kinds (`ENEMY_STATS`, `behaviours.ts`), each with its own accent
glow, a hit flash and a death in tumbling debris. Each sector meets its
signature kinds on purpose, with a first-sighting line from Claude.

- GNAT: formations on curved entry paths; hold station in the mid-field,
  then come on.
- SPIKE: locks on (blinks), then dives.
- MANTA: wide strafe, drops mines.
- LANCER: a pink sightline for half a second, then a fast bolt.
- HORNET: comes from behind (`▼ BEHIND ▼`), overtakes, turns, attacks.
- BULWARK: a frontal shield that opens only to fire; bombs and charge
  orbs break it.
- POD: pops into two MITES.
- CARRIER: parks deep, launches gnats (and missiles in sector 5 and ECHO),
  takes 14 hits, drops a capsule.
- TURRET: ground emplacement, fires upward.
- MISSILE: homes, can be shot down.
- MEGA COBRA: the rival (above).

Sector 1 is gnats and two spikes (onboarding). Each travel is ~80 s of
script: an opening wave, the signature kinds, a set piece (ring gate,
ambush from behind, turret gauntlet, carrier), three gold rings, then
WARNING. Filler fills the gaps under a density cap. Enemies go once they
are past the ship, so nothing sweeps the camera.

## Bosses

Each boss has parts with HP, a bar, two phases (the Crown three), an
enrage, and an attack wheel where every attack has a telegraph, an active
window and a recovery. `bosses.ts` proves a safe gap always exists. Lasers
count half on bosses; charge orbs and bombs count full.

- **THE PINCER**: a crab carrier skimming the sea. Claws sweep hatched
  lanes; the core in the maw only takes damage while it roars. A broken
  claw stops sweeping. Phase 2: both claws at once, and drones.
- **THE MOTH**: four wing panels shield the core; shoot them off. Spore
  mines in rows with a gap; wing beats push the ship sideways (arrows at
  the edge warn). Phase 2: weavers.
- **THE FURNACE**: a three-legged walker. Stomps roll a wall of heat
  along the ground (fly above it); break a knee and it kneels with the
  belly core open. Fire fans, lava lobs at marked spots, kamikazes.
- **THE TWINS**: two mirrored ships; only the lit core can be hurt, and
  the light swaps on a beat (the next one is bracketed). Crossing walls
  with one open lane, bursts and mirrored fans. Kill both.
- **THE CROWN**: the mothership. Phase 1 a ring of six turrets, spirals
  and hornets; phase 2 the eye (a sweeping beam, fans, missiles); phase 3
  it runs and you chase the heart through its debris and rear mines.

ECHO loops multiply boss HP by `1 + 0.4 × loop` and speed the clocks up to
1.6×; telegraphs never drop below 0.45 s.

## The squad

Three wingmen fly at once, each on its own brain (`wingmanAi.ts`) with a
profile in `balance.ts` `WINGMEN`: Heron hunts far and steals kills, Bison
stays close, tanks and shoots what threatens you, Dingo is fragile and in
between. Modes: formation, hunt (a depth window up to −95), regroup, cover
(when your hull is low). `stepSquad` spreads them over different targets,
except a boss core. On travel they fire 2.2× slower than in a boss fight
and only at targets inside z −45, so the player gets most kills; in a boss
fight they fire at full rate. They draw up to 45 % of the Hollow's aimed
fire, take damage, go down (their chip greys out with a respawn count) and
come back after 9–12 s. The squad row bottom-left shows each pilot's
portrait and hull pips; callouts (`HERON ▸ GOING HUNTING`) show above it.

## The look

- **Pixel pipeline** (`pixel.ts`): three.js renders into a target at the
  pixel stage's logical size (320 wide on a monitor, 180 wide on a
  portrait phone), a post pass snaps every pixel to Neon Shrine's palette
  with a 4×4 Bayer dither, and the shared 2D stage adds the light map
  (lasers, engines, eyes, rings, flashes, projected from 3D), the whole
  number upscale, bloom and scanlines. The WebGL canvas is offscreen.
- **Biomes**: the ground shader has a mode per biome (sea with foam and
  sun glitter, forest floor with glow spores, basalt with lava veins, a
  mirror lake, and none in space, where a nebula and a ringed planet take
  over). Each biome has its own sky, fog, ridges and props (`models/props.ts`,
  instanced); arches and mines take the biome's neon. A sector change is a
  warp (FOV kick, speed streaks) and a title card.
- **Models**: flat-shaded low-poly builders, geometry cached per kind,
  materials per colour, pooled up front. The Hollow is dark violet with one
  accent glow per kind; friends are pale with their pilot's trim. The
  player flies the ship chosen in the Hangar (`themes/ships/three.ts`).
- **Model lab**: `?theme=starfox&lab=models` renders every model through
  the game's pipeline. `page=enemies|bosses|capsules|props|fx|biomes|squad`,
  `biome=`, `boss=pincer|moth|furnace|twins|crown`, `t=<s>&freeze=1`,
  `spin=0&yaw=<rad>`, `hits=1` (boss hit spheres), `near=1`, `far=1`
  (game distance), `flash=1`, `only=<name>`. `scripts/starfox-lab/shot.mjs
  <outDir> name=query …` screenshots pages in one browser; `info.mjs`
  counts draw calls and triangles per page. Both need the dev server and
  run under `flock /tmp/claude-1000/chrome.lock`.

## HUD and intercom

- **Wide screens**: the intercom is the Neon Shrine dialog box top-left
  (portrait, name line, typewriter), clear of the radio widget top-right.
  The dock at the bottom centre holds the boss name and bar, banners
  (WARNING, CLEAR, toasts), `S01 · score` and the hull bar. The squad row
  is bottom-left above the sound toggle; the arsenal bottom-right (timed
  chips, laser level, bombs, charge meter).
- **Phones** (≤ 640 px): the intercom runs full width under the radio,
  without the name line. The boss bar and banners sit under it; the dock
  keeps score over hull at the bottom edge between the sound toggle and
  the BOMB button; the side blocks take 8 px text. The 3D view renders 6 %
  higher on portrait screens, so the ship at the lane floor stays clear of
  the squad row. Everything interactive sits above `--app-safe-bottom`.
- **On the stage** (canvas HUD layer): capsule letters when the 3D letter
  is too small, lancer sightlines, the charge lock reticle, boss telegraph
  hatching and labels (`LOCK`, `NEXT`, `UP`, `COBRA`).
- The Escape pills (paused, hold to quit) sit at 30 % height, off the
  intercom.

## Debug hook

`?theme=starfox&debug=starfox` adds `window.__starfox`: `sector(n)` (jump,
also into ECHO: 6 = ECHO I), `boss(id?)` / `boss(true)` (finish it),
`bossPhase(n)`, `bossHp(frac)`, `give(type)` (a capsule, `gold`, `ring`),
`spawn(kind)`, `setPiece(id)` (`rings turrets carrier ambush dingo flyby
duel final`), `god(on)`, `hold(on)` (wingmen hold fire), `state()` (phase,
sector, hull, arsenal, squad, kills, boss, the line on screen, fps and the
frame-time split) and `ctx`. A jump hushes the intercom.

## Tests

`npm run test:starfox` runs five files (131 tests): `starfox-balance`
(hull, bestiary, speeds, squad profiles, rival, boss HP and time-to-kill),
`starfox-story` (the script's voices, line widths against the intercom,
the director, the squad rules), `starfox-arsenal`, `starfox-encounters`
(every sector's script, density, set pieces, Cobra staying gone once
down) and `starfox-bosses` (attack wheels and the safe-gap proofs).
`npm run test:wingman` (36 tests) covers the wingman brain and
`stepSquad`. Both run in CI.

## Frame time

Headless Chromium with software GL (SwiftShader) on Sleeper, the dev
server, 2026-09-25, median of 8 samples: 1280×800 travel 49 ms, a boss
46 ms, the Crown 36 ms; 390×844 at dpr 2 travel 55 ms, a boss 57 ms. The
old game measured ~47 ms at 1280×800 the same way. Almost all of it is the
2D stage reading back the GL frame (`stageMs`); the scene update is under
1 ms and three.js under 3 ms, ~75 draw calls. Not a phone measurement.

## Known gaps

- Physical phones and real GPUs are unmeasured.
- Boss fight lengths come from a DPS model plus one parked-ship check;
  they have not been timed in human play.
- `BUDDY_*` in `balance.ts` is the old single wingman's tuning, read only
  by its tests.

## History

The first Star Fox (2026-09-05 to 09-24) was an endless corridor with one
gold wingman and a gunship boss, the DREADNOUGHT. Operation Nightlight
replaced it on 2026-09-25: story, squad, five bosses and biomes, new
models and arsenal. The rest is in `git log`.
