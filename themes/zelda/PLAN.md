# PLAN: Zelda-clone theme (`zelda`) — LTTP loop in Neon Dreams paint

Status 2026-09-16: plan only, no code. Parked-first rollout. External review
requested from Codex/Astra (agora #phareim-no post #10) — no reply yet as of
writing; re-check the channel before building.

Decided with Petter: **big v1** (multi-area overworld + full dungeon),
**loot in** (pots/keys/chests on top of sword+hearts), **Neon reskin**.

## Concept

Top-down action-adventure, LTTP structure: 3 overworld areas → dungeon mouth
→ 6-room dungeon → boss → Triforce-style pickup → win screen. Room-locked
camera (one room per screen, slide transition on exits). This is the key
simplification: it fits the no-scroll viewport rule, kills camera math, and
makes expansion trivial (a room is just data).

Neon Dreams mapping: violet-black ground with faint grid, cyan
player/sword/HUD, pink enemies/projectiles, gold loot/chests/boss.
Striped-sun motif on title and win screens only — never in the playfield
sightline (same lesson as the OutRun rebuild: HUD out of the vanishing point).

Working title: **Neon Shrine** (theme id `zelda`; avoids bare "Zelda" branding).

## Architecture (OutRun/Galaga split: pure logic + thin wiring)

`themes/zelda/`, five files:

- **`world.ts`** — pure data, the expansion joint. Tile legend (`#` wall,
  `T` tree, `W` water, `P` pot, `G` grass, `D` door, …), rooms as string
  arrays, portals (`{from room+edge → to room+spawn}`), enemy/loot placements,
  chest/key/door wiring. Adding content later = append a room + one portal
  line. No Vue, no canvas.
- **`engine.ts`** — pure deterministic logic, no DOM: `createGame` /
  `stepGame` (fixed timestep), movement + wall slide, sword arc hit test +
  knockback + i-frames, enemy brains (chaser, wanderer, turret, bat), drops
  (hearts/rupees), pots/grass smash, chests/keys/locked doors, room
  transitions, boss phases, hearts/death/respawn at room entry, win condition.
  Imports only `world.ts` types.
- **`renderer.ts`** — Canvas 2D only, reads state. Neon tile painter
  (pre-rendered tile cache for phones), sprite-shatter kills, screen shake,
  hit-stop — all gated on `reducedMotion`. No game logic.
- **`Zelda.vue`** — loop/input/phases/sound wiring (copy
  `outrun/OutRun.vue`'s phase machine as template):
  `attract → title → play ⇄ pause → dead → win`. Owns `navigationLocked`,
  EscHold, touch controls.
- **`Landing.vue`** — thin DOM shell (title card, HUD overlay, game-over/win
  panels). Plus `theme.css` (ten `--theme-*` tokens; `--zelda-*` privates on
  `:root`, never `--theme-*` on `:root`).

## V1 content

- **Overworld (3 areas):** meadow spawn (tutorial signs, first sword pickup —
  start unarmed like LTTP), forest maze (dense trees, hidden chest), graveyard
  approach (turret enemies, dungeon mouth). Portals stitch the three.
- **Dungeon (6 rooms):** entry → pot/grass loot room → key room (locked door
  teaches keys) → **miniboss** (armoured knight, 3 HP; chest holds heart
  container) → boss door (needs Boss Key from miniboss chest) → **boss**
  (big slime-knight, 2 phases: slam + spawns) → Triforce wedge → win.
- **Systems:** sword swing (Space/J/tap button, cooldown, arc), 3→5 hearts,
  contact damage + 1 s blink invuln, knockback, enemy drops, pots/grass →
  hearts/rupees, chests/keys/locked doors, death → respawn at room entry with
  enemies reset.

## Site contracts (must-follow, from repo survey 2026-09-16)

- Register in `themes/index.ts` as **parked** (`disabled: true`; reachable via
  `?theme=zelda`) until the loop is fun; then unpark into rotation (proposed
  slot: after OutRun, before Tetris).
- Viewport: root fills `100dvh`, `overflow: hidden`, `touch-action: none`;
  canvas sized from `getBoundingClientRect` + DPR capped at 2;
  `ResizeObserver` + `resize` listener; keep pager chevrons/dots clear (46 px
  pad, `safe-area-inset`); verify at 375×667.
- `navigationLocked = true` only during a run; start on **tap**, not
  touchstart, so idle swipes still change theme; 3 s post-unlock cooldown is
  already in the shell (`useThemeNavigation`).
- `<EscHold>`: tap = pause/resume, 3 s hold = quit into game over via the
  natural death path; `P` also pauses; idle ignores Escape. Framework-free
  `EscHoldTracker` in `themes/base/escHold.ts` (already tested).
- Audio: park the global radio during runs (`radio.suspend(true)` → resume on
  stop); SFX + one 16-tone loop via `useSound` (`composables/useSound.ts`);
  attract mode silent; suspend on hidden tab; never override mute; nothing
  plays before the first Enter/tap gesture. Per-game `playTrack/stopTrack`
  must NOT come back (retired 2026-09-12).
- Touch: left-half drag-to-move (analog), right-side A (sword) / B (interact)
  buttons, pointer-captured, initiating touch owns control; `hint()` copy says
  ENTER or TAP, never both (`useInputMode`).
- Reduced motion: no shake/hit-stop/backdrop wandering; draw once when idle.
- Fonts: `--font-person` / `--font-machine` only; canvas imports
  `MACHINE_FONT` from `themes/base/fonts.ts`. No Google Fonts, no page-scroll
  containers, no theme-switch cinematics (reverted 2026-05-28, stays reverted).
- Progress in `localStorage.zeldaSave` (room + hearts + flags); best
  completion time in `zeldaBest`. **Hall of Fame: skip for v1** — adventure
  completion isn't a score. Optional phase 2: submit completion time as a new
  `zelda` entry in `themes/leaderboard/games.ts` with a plausibility cap
  (server enforces; needs matching `maxScore` + migration-free since `game`
  is a free column — check `server/utils/store.ts` validation first).

## Tests + verification

- `tests/zelda-engine.test.mjs` + `test:zelda` script (CI runs all
  `test:*` + typecheck + build): wall collision/slide, sword arc hits +
  knockback, enemy brains, drops bounded, key/door/chest flow, portal
  transitions, boss phases, death/respawn, soak autoplay (reach boss, rooms
  visited > N, entities bounded). Pure-module pattern like `outrun-engine`
  (`node --test`, no deps).
- `npm run typecheck`, production build, headless Chromium at 1440×900 /
  375×667 / 667×375 + `/nope`: no page errors, no document overflow.
  Physical-phone feel unmeasured (standard caveat).

## Build phases

1. Engine + world + 1 test room (move + swing + 1 enemy, green suite).
2. Overworld (3 areas, portals, sword pickup, pots/grass/drops).
3. Dungeon (6 rooms, keys/doors, miniboss, boss, win).
4. Renderer neon pass + HUD + title/win + SFX/music + touch + reduced motion.
5. Parked preview → playtest → unpark into rotation.
6. (Optional) Hall of Fame completion-time entry; second overworld region /
   second dungeon through the same `world.ts` joint.

## Open questions for Astra review (agora #phareim-no #10)

1. Fit with theme contracts — anything missed?
2. Over/under-scoping of the big v1?
3. Anything in the engine/world/renderer split that hurts expandability?
4. Risks: touch controls, room transitions, audio, save shape?
