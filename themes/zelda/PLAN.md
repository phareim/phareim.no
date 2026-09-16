# PLAN: Zelda-clone theme (`zelda`) — LTTP loop in Neon Dreams paint

Status 2026-09-16: plan only, no code. Parked-first rollout. Codex review
completed with Petter in chat and incorporated on 2026-09-16 (original
request: agora #phareim-no #10). Claude review folded in the same day
(floating stick, the first 30 seconds, three music loops). Big v1 stays;
prove combat, touch and saves in the first playable room before authoring
the rest. Scope estimate: ~4 000–4 500 lines including tests, about OutRun's
size (4 413 on 2026-09-16); the cost is the engine, not the nine rooms.

Decided with Petter: **big v1** (multi-area overworld + full dungeon),
**loot in** (pots/keys/chests on top of sword+hearts), **Neon reskin**.

## Concept

Working title: **Neon Shrine**, theme id `zelda`.
Top-down action-adventure: three overworld areas → six-room dungeon → boss
→ victory relic → win. Room-locked camera, short slide on exits, hard cut
under reduced motion. No scrolling or theme-switch cinematics.

Use a fixed, roughly square logical playfield, controls below in portrait
and beside it in landscape, HUD outside the room. Fit the whole room without
cropping or stretching. Settle tile dimensions in the first phone prototype:
375×667 with HUD above and controls below leaves roughly 375×375, about
25 px tiles at 15 wide — readable, small sprites; landscape 667×375 with
controls beside leaves ~300 px square and is the real constraint. Try 13×11
as well as 15×11.
Rooms are data; new routes still need progression and reachability checks.

Neon Dreams: violet-black ground with faint grid, cyan player/sword/HUD,
pink enemies/projectiles, gold loot/chests/boss. Gold bosses retain hostile
silhouettes and pink attack telegraphs so they cannot read as rewards.
Distinct landmarks and tile silhouettes distinguish areas. Striped-sun
motif on title/win only, never behind combat.

## Architecture

`themes/zelda/`, five main files plus `theme.css`:

- **`world.ts`** — pure authored data: tile legend, rooms as string arrays,
  enemy/loot placements, portals with explicit trigger regions and safe
  arrival points, chest/key/door wiring. Stable IDs for rooms, portals,
  chests, doors and one-time rewards. No Vue/canvas. Validate links, spawn
  collision and required-key reachability when adding content.
- **`engine.ts`** — pure deterministic `createGame` / `stepGame`, fixed
  timestep, authored world passed as input. Movement/wall slide, sword arcs,
  knockback/i-frames, enemy brains, drops, pots/grass, inventory, doors,
  transitions, boss phases, death/respawn and victory. Seeded gameplay RNG
  in simulation state. Emits events such as `swordHit`, `chestOpened` and
  `bossDefeated`; decorative randomness never advances gameplay RNG.
- **`renderer.ts`** — Canvas 2D, reads state without mutation. Cached tile
  painter, bounded particles, sprite shatter and screen shake; effects
  respect reduced motion. No game logic or ownership of simulation time.
- **`Zelda.vue`** — loop/input/phases/audio wiring, using OutRun as reference.
  Title/attract → play; play ⇄ pause; death → room-entry respawn;
  quit → game-over panel; victory pickup → win. Owns navigation lock,
  EscHold and touch pointers. Engine events drive sound and visual effects.
  Hit-stop is a brief presentation-clock hold here: skip engine steps and
  discard elapsed time instead of accumulating catch-up work. Disable it
  under reduced motion.
- **`Landing.vue`** — thin DOM shell: title/Continue, HUD, result panels.
  **`theme.css`** defines the ten `--theme-*` tokens on `.zelda-page`;
  private `--zelda-*` variables may live on `:root`, never `--theme-*`.

## V1 content and progression

- **Three overworld areas:** meadow spawn (signs, safe first sword pickup),
  forest maze (trees, hidden heart-container chest), graveyard approach
  (turrets, dungeon mouth). Portals stitch them together. Mandatory combat
  starts only after the sword is reachable.
- **The first 30 seconds are pinned.** This is a 15–30 minute game in a
  rotation of two-minute arcade games on a landing page that picks a random
  theme; a visitor must learn it is a game before swiping on. The sword is
  within ~3 s of walking from spawn, a pot to smash sits on the way, and the
  first enemy is within ~10 s. Attract mode is the meadow with the hero on
  autopilot circling a pot or two (Another Shore's idle pattern), so the
  theme reads at a glance.
- **Six dungeon rooms:** entry hub, loot room, key room, miniboss room,
  boss antechamber, boss room. The hub shows the locked miniboss door early;
  an open side branch leads through loot to the small key. A shortcut opens
  from the key room back to the hub. The key is reachable without passing
  its own lock. Miniboss → antechamber → Boss Key door → boss.
- **Miniboss:** armoured knight, three HP, frontal guard, readable attack
  wind-up and a recovery window to flank and strike. Its one-time chest
  awards **both** the Boss Key and a heart container. Together with the
  forest container this takes starting health from three to five hearts.
- **Boss:** large slime-knight, two phases: slams, then slams plus bounded
  spawns. Telegraph the impact area and provide a deliberate recovery window.
  Defeat unlocks the victory relic; collecting it wins.
- **Loot:** hearts from enemies/pots/grass, small keys, Boss Key, chests and
  heart containers. Rupees are deferred until they have a concrete use.
- **Enemies:** chaser, wanderer, turret and bat; readable movement and attacks
  matter more than adding further kinds.

## Combat and controls

Arrows/WASD move in eight directions with normalized diagonal speed. Analog
movement has a dead zone and clamped magnitude. Sword facing is cardinal,
selected by the dominant movement axis and retained at rest; freeze facing
through a swing. Initially allow movement during swings and tune in the
first-room playtest. Space/J/A button swings with cooldown and an arc;
each swing hits a target at most once and cannot damage through walls (one
tile raycast from player centre to target centre, never per-pixel).
Contact damage, knockback and one second of blink invulnerability.
E/B button interacts with the nearest eligible object in reach.

**Touch is the biggest risk.** Every game here that feels right on a phone
uses the finger directly (Breakout, Invaders) or relative drag from the
touchdown point (OutRun); a fixed virtual pad does neither. So: a
**floating stick** — it spawns wherever the first finger lands on the left
~60 % of the screen and direction is the offset from that point, with a
dead zone and clamped magnitude. **Attack is any tap on the right side**,
no button to find; on touch, a swing at rest auto-faces the nearest enemy in
sword reach (keyboard keeps strict cardinal facing). Interact is rare, so a
small B button or a hold on the right side is enough; settle it in the
first-room playtest. Separate pointer capture so moving and attacking work
simultaneously; the initiating movement pointer owns the stick. Clear held
input on blur, hidden tab, cancellation and phase changes. Pause simulation
while hidden and discard catch-up time.

## Progress, death and saves

- Keep permanent progression across death/reload: sword, opened chests,
  collected containers, unlocked doors, remaining keys, Boss Key and defeated
  miniboss/boss flags. Reset ordinary enemies, pots/grass and temporary drops
  on room-entry respawn. One-time rewards never respawn. Death restores
  current health to the earned maximum at the safe room entry.
- Version and validate `localStorage.zeldaSave`: room and safe entry ID,
  current/max hearts, inventory, permanent flags, gameplay RNG state and
  active-play elapsed time. Save at safe room entry and after progression
  changes. Key consumption and door unlock are one saved change; likewise
  chest opening and reward. Resume at a safe entry, never inside a wall or
  enemy. Missing/corrupt/unsupported saves and unavailable storage must not
  crash the game; play remains possible in memory.
- Title offers Continue for a valid save and New Game to reset it.
  Escape-hold exits to the game-over panel preserving progress, through an
  explicit quit path that **does not automatically respawn**. Win records
  completion and offers a fresh run. Attract mode uses isolated state and
  cannot write live progress.
- Best completion time lives in `zeldaBest`: active simulation time across
  deaths/reloads, excluding pause, hidden tabs, room slides and hit-stop.
  Hall of Fame is outside v1.

## Site contracts (checked 2026-09-16)

- Register in `themes/index.ts` as parked (`disabled: true`), accessible via
  `?theme=zelda`. Proposed live slot after OutRun, before Tetris, once fun.
- Root fills `100dvh`, `overflow: hidden`, `touch-action: none`. Canvas uses
  measured bounds, DPR capped at two, ResizeObserver and resize handling.
  Reserve HUD/radio/control space; respect safe-area insets and pager
  clearance (46 px where applicable). Check 375×667 and 667×375 early.
- Navigation stays locked throughout a run, including pause, room slides and
  respawn; release on quit/win/unmount. Start on **tap**, not touchstart, so
  idle swipes navigate. The shell supplies the three-second unlock grace.
- `<EscHold>`: tap pauses/resumes, three-second hold quits; P also pauses;
  idle ignores Escape. Reuse the existing tested tracker and progress UI.
- `useSound` supplies SFX and **three** Zelda 16-tone loops — overworld,
  dungeon, boss — so the dungeon does not sound like the meadow; shape the
  style API for three from the start (phase 1 may ship with one). The engine
  emits room-area/boss events and `Zelda.vue` switches the loop.
  `music.start()` already owns radio parking: no independent suspension
  calls. `music.stop(false)` keeps the radio parked during pause;
  `music.stop()` releases ownership on exit/win/unmount. Attract is silent,
  audio suspends while hidden, mute is respected, and first Enter/tap unlocks
  audio. Do not restore retired per-game `playTrack/stopTrack` systems.
- Normal room slides freeze combat and block gameplay input. Safe arrivals
  cannot immediately retrigger portals: require leaving the arrival trigger
  before it can fire again. Reduced motion uses hard cuts, no shake/hit-stop
  or idle wandering; draw idle once and redraw on resize.
- `useInputMode().hint()` says ENTER or TAP, never both. Site fonts only:
  `--font-person`, `--font-machine`, canvas `MACHINE_FONT`. No Google Fonts.
  Check the themed `/nope` fallback as well as the landing.
- A later completion-time leaderboard needs explicit lower-is-better rank
  and best-replacement semantics. Adding a game ID and `maxScore` to the
  existing high-score board is insufficient; review store/API/UI together.

## Tests and verification

Add `tests/zelda-engine.test.mjs` and `test:zelda`, using the existing pure
module `node --test` pattern. Explicitly add `npm run test:zelda` to
`.github/workflows/deploy.yml`: CI lists suites rather than discovering
`test:*` scripts automatically.

Cover movement/collision, sword facing/arcs/one-hit-per-swing/walls,
knockback, enemy brains, bounded entities/drops, key/door/chest flow,
portal safety, boss phases, death/respawn and seeded replay. Include:

- A scripted complete run through the victory pickup, not just boss arrival.
- Save/reload and death after consuming a key, without relocking its door.
- Chests/heart containers that cannot duplicate rewards after death/reload.
- Quit without automatic respawn, invalid saves and bounded soak gameplay.

Run typecheck and production build. Headless Chromium at 1440×900, 375×667
and 667×375 plus `/nope`: no errors/overflow. Exercise simultaneous movement
and attack, cancellation, keyboard facing, pause, hidden-tab recovery,
reduced motion and Continue. Explicitly report whether physical-phone
playtesting occurred; headless checks do not establish control feel.

## Build phases

1. **One finished playable room on a phone:** engine/world/basic renderer,
   HUD, analog movement and simultaneous sword touch, one readable enemy,
   chest, exit/return test connection, death and save/resume. Include keyboard,
   sound feedback and reduced motion. Settle room dimensions and combat feel;
   green progression tests before authoring the remaining rooms.
2. Overworld: three areas, portals, sword pickup, pots/grass/drops and the
   hidden heart-container chest.
3. Dungeon: six rooms with branch/shortcut, keys/doors, miniboss, boss and win.
4. Full neon/audio pass, title/Continue/win, area landmarks, attack telegraphs
   and responsive polish. Touch and persistence already work.
5. Parked preview → playtest → unpark into rotation.
6. Optional later work: completion-time board with proper ranking semantics,
   second region/dungeon through the same world-data structure. No
   `maxScore − ms` hacks on the existing high-score board.

**Execution.** Build in a git worktree. Phase 1's engine + world + tests is
pure TypeScript against a clear spec and suits Muse (`/musecode`) with Claude
reviewing; `Zelda.vue` touch wiring and the renderer stay on a stronger model.

## Review outcome (Codex, 2026-09-16)

Keep the agreed big v1 and pure world/engine/renderer split. Main risks are
phone combat feel, linear room design and inconsistent progression after
death/reload. The first-room milestone, branching six-room dungeon and
explicit persistence rules address these before content expansion.
Exact combat timings, tile dimensions and boss health remain playtest tuning.
