# Space Voyagers: the engine

Written 2026-10-13. The simulation of *Rex & Nova: Space Voyagers I*: no DOM, no canvas, no Vue,
no `Math.random`, no clock. `DESIGN.md` one folder up says what the game is; this says how to
drive the code. Every tunable number is in `balance.ts`.

## Stepping it

```ts
import { createWorld, step, makeInput } from './engine/index.ts'
import { createDirector, listen } from './story/director.ts'
import { rand } from './engine/rng.ts'

const world = createWorld({ seed, height, pilot: 'rex', voyage: 1 }) // height 320..432, clamped
const radio = createDirector({ random: () => rand(world.talkRng) })
const input = makeInput()

// once per 1/60 s of game time (keep the old fixed clock: accumulate real time, step whole ticks)
step(world, input)
for (const e of world.events) { /* sounds, flashes, cards: see Events */ }
const monitor = listen(radio, world.events, world.tick)
```

- A tick is 1/60 s; `world.tick` is the game clock. Pause is: do not call `step`.
- Same seed, same inputs, same run, tick for tick. `hashWorld(world)` proves it; record the
  inputs and a run can be replayed for pictures.
- `Input`: `dx, dy` (-1..1, keys) or `hasTarget, tx, ty` (touch: put the target above the finger),
  `fire` held, `duet` pressed. Both ways fly at `PLAYER.speed`.
- After GAME OVER (`world.over`) `step` does nothing. Start again with a new world; call
  `radio.resetRun()`.
- The page asks for five cues itself with `radio.cue(id, world.tick)`: `briefing`, `retry`,
  `best`, `gameover`, `ending`. The engine asks for all the others through `cue` events.

## The world

`state.ts` has `World`; `types.ts` the things in it. Field: `world.w` = 240, `world.h`, y down.

| Field | What |
|---|---|
| `stage`, `stageT`, `sector` (1..5), `wave` (1..4), `voyage`, `gang` | Where the run is. Stages: `card`, `wave`, `bonus`, `boss`, `clear`, `ending`, `over` (`idle` is the lab's) |
| `player` | `x, y, hull` (0..5), `invuln` (blink ticks), `weapon`, `level`, `bubble` (hits left), `magnet`, `quarter` (ticks left), `tows` (left), `towing` (ticks of tow under way) |
| `partner` | `state`: `fly`, `limp`, `beamed` (being lifted), `hanging`, `docking`, `docked`; `dock` ticks left; `hits` |
| `enemies[]` | `kind` (`enemy-<gang>-<role>`), `x, y`, `px, py` (last tick), `hp/maxHp`, `state`, `flash` (ticks since hit), `frozen` (>0 in the hairspray), `carrying` (a captor with the partner), `bonus` |
| `shots[]` | Ours: `kind` `bolt`, `disc`, `bass` (half-width `hw` grows), `wing`; `owner` 0 player, 1 partner, 2 friend |
| `bolts[]` | Theirs: `kind` `bolt`, `aimed`, `mine`, `note`, `ring`; `r`; `frozen` |
| `aims[]` | A line shown before something goes along it: from `(x, y)` through `(tx, ty)`, `warn` ticks left; `kind` `sniper`, `diver`, `boss` |
| `zones[]` | A patch that hurts when live: `x, y, w, h` (top-left), `warn` ticks of showing, then `live` ticks; `kind` `ray`, `tile`, `key`, `ram`, `wall`, `note`, `squeeze` |
| `barriers[0]` | CAL's doors: `y, hh`, `gapX, gapW`, `shut` 0..1. Panels cover `x < (gapX - gapW/2) * shut` and the mirror of it on the right |
| `pickups[]` | `id`, `kind` (`pick-<id>`), `age` (name it for the first seconds) |
| `rigs[]` | `kind` (`rig-marge`, `rig-duckie`, `rig-barton`), `job` `convoy`, `cb`, `pass`; centre and half sizes; `unhooked` |
| `convoy` | `active`, `id`, `cargo` 1..0 (the bar) |
| `wing` | The stranded ship, then the third ship: `state` `off`, `drift`, `stalled`, `flying`; `kind` `stranded-<id>`; `bar` 0..1 (the cables; draw them when `bar > 0` and she is `stalled`) |
| `boss` | `kind` (`boss-<id>`), `x, y`, body `hw, hh`, weak spot at `(x + wx, y + wy)` half `whw, whh`, `hp/maxHp`, `phase`, `state` `enter`, `fight`, `ram`, `dying`, `attack` (name), `flash` |
| `duo`, `pass` | Hans Duo (`kind` `duo`) crossing; a rescued friend's strafing run (`kind` `stranded-<id>`) |
| `cloud` | The hairspray: `x, y, r`, `t` ticks left |
| `duetMeter` 0..1, `duet` (ticks left), `slow` (TRACKING ticks left), `score`, `chain`, `chainMul`, `friends[]` | The console |
| `formation` | `off`, `dx`, `dy`, `top`: where the slots are (`waves.ts`, `slotX/slotY`) |

A captor's beam is not a zone: it is a captor with `state === 'hover'`; `t < CAPTOR.warn` it is
warming, after that it is on, a cone `CAPTOR.beamHalf` either side, down from the captor.

## Events

`world.events` is one array, emptied at the start of each `step`; its records are pooled, so read
them in the same tick. Every record is `{ type, x, y, kind, n, alt }`.

| type | x, y | kind | n |
|---|---|---|---|
| `cue` | | cue id (`alt`: a cue to fall back on) | |
| `card` | | `sector`, `bonus`, `perfect`, `boss`, `clear`, `ending`, `voyage`, `gameover` | sector, bonus points, voyage or score |
| `wave` | | gang | wave 1..4 |
| `shot` | muzzle | weapon, or `wing` | 0 player, 1 partner, 2 friend |
| `bolt` | origin | bolt kind | |
| `aim` | origin | `sniper`, `diver`, `boss` | ticks of warning |
| `zone`, `zoneLive` | centre | zone kind | ticks of warning |
| `hit` | where | `enemy`, `boss`, `armor`, `door` | |
| `pop` | where | the entity's kind | points given (0: not the player's) |
| `split`, `peel`, `freeze` | where | the entity's kind | |
| `drop`, `pick` | where | pick-up id | |
| `power`, `powerOff` | where | `bubble`, `mirrorball`, `tracking`, `hairspray`, `magnet`, `quarter` | ticks, or hits |
| `valve`, `mend` | player | | hull now |
| `bubble` | player | | hits it still takes |
| `tow`, `towed` | player | | tows left; hull |
| `gameover` | player | | |
| `partnerHit`, `limp`, `back` | partner | | hits taken |
| `beam`, `beamOn` | captor | captor's kind | ticks |
| `capture`, `freed`, `docked`, `undocked`, `loose` | partner | | dock ticks |
| `duetReady`, `duetOn`, `duetOff` | player | | |
| `cancel` | the shot | | points it turned into |
| `chain` | where | | the new multiplier |
| `bossIn`, `bossPhase`, `bossDown` | boss | boss id | hull, phase, sector |
| `bossAttack` | boss | attack name (`attacks.ts`) | phase |
| `door` | gap | | 1 closing, 0 opening |
| `convoyIn`, `convoySafe`, `convoyLost`, `cargo` | | `marge`, `duckie` | cargo left |
| `latch` | raider | `rig`, `stranded` | |
| `rescueIn`, `cables`, `rescued`, `rescueLost` | ship | `babs`, `ridley`, `lena` | |
| `friend` | | friend id | friends so far |
| `pass` | | friend id | |
| `duoIn`, `duoOut`, `rig` | where | bitmap name | |
| `sectorClear`, `ending`, `voyage` | | sector name | sector, voyage |

## The radio

`story/director.ts`. `listen(radio, world.events, world.tick)` once a tick returns the `Monitor`
(one reused object): `speaking`, `who`, `name` (the plate), `channel`, `mood` (portrait
`portrait-<who>-<mood>`), `text`, `shown` (typed so far), `chars`, `cutsIn` (a boss: tear the
monitor), `cue`, `line` (changes with each line: play the CB click on a change). `rows(text)`
breaks a line into the monitor's rows of 28. Variants come from `world.talkRng`, a stream of
its own, so what a visitor has already heard never changes the simulation.

## What a renderer must not assume

- **Pools, not lists.** Every array has a fixed length; skip entries with `active === false`.
  Indices are reused; do not key anything on them (enemies have `id`).
- **No colours, bitmaps or sounds in here.** `kind` is the bitmap's name; everything else
  (bright sector 1 shots, the tear of TRACKING, a pop's puff) is the look's reading of state
  and events.
- **Hit boxes are smaller than bitmaps.** The player's is a 3 px radius at `(x, y)`; draw the
  ship centred there. Rigs and bosses are centre plus half sizes.
- **Things live off the field.** A convoy's rigs queue up to 600 px below it, strings wait at
  (-40, -40) with `state === 'wait'` (do not draw those), a limping partner sits below the
  bottom edge.
- **Telegraphs are state, not events.** Draw every active `aim` and every `zone` with
  `warn > 0` as a warning, every `zone` with `warn === 0` as live. The engine's fairness
  depends on those being visible.
- **Blink** is `player.invuln > 0`; the tow is `player.towing > 0` with the partner flying to
  the player's nose.
- **Do not step with a variable dt.** One `step` is one tick.
- **Events do not persist.** Copy what you need out of a record in the tick it arrives.

## For the lab and the tests

`debug.ts`: `jumpTo(world, { sector, stage, wave, boss })`, `sandbox(world)`, `place(world, role,
col, row)`, `arm(world, weapon, level)`, `run(world, ticks, pilot)`; `world.boss.force = 'rays'`
makes a boss repeat one attack. `autopilot.ts`: `createAutopilot(opts)` and `autopilot(ap, world)`
return an `Input`; `CASUAL` and `CLUMSY` are weaker profiles. The game itself calls neither file.

## Files

`index.ts` (`step`, `hashWorld`), `world.ts` (create, pools, `emit`), `state.ts` / `types.ts` /
`events.ts` (types), `balance.ts` (every number), `weapons.ts` (volleys), `flow.ts` (the run),
`waves.ts` (strings, formation, dives, bonus), `enemies.ts` (roles), `player.ts` (both ships),
`shots.ts`, `combat.ts` (damage, score, chain, DUET), `pickups.ts`, `encounters.ts` (convoy,
rescue, raiders), `friends.ts` (the third ship, Hans Duo, passes), `bosses.ts`, `attacks.ts`,
`cuemap.ts` (which cue when), `rng.ts`, `autopilot.ts`, `debug.ts`.
