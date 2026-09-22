## Neon Shrine — the Zelda-like, phase 1 (2026-09-16, parked)

`?theme=zelda` is a top-down action-adventure in the LTTP mould, painted in
Neon Dreams. **Parked** (`disabled: true`, registered after OutRun) until it
is fun on a phone; the design and the build phases are in
`themes/zelda/PLAN.md` (Codex and Claude reviews folded in). Phase 1 is
done: one finished playable room plus a test-connection room, combat,
touch and saves. Phases 2–3 (three overworld areas, six-room dungeon with
miniboss, boss and relic) are content on top of the same engine, which
already implements every enemy kind, door, chest and boss the plan names.

**Files.** `themes/zelda/types.ts` is the contract (tile legend, world
data, state, events, save format, Engine/Renderer interfaces — written by
Claude, everything else built on Muse via `/musecode` and reviewed).
`world.ts` — authored rooms as 15×11 string grids (`meadow`, `glade`) with
`validateWorld` (row lengths, ids, portals, flood-fill reachability of the
sword and every chest). `engine.ts` — pure, deterministic, 1/120 s steps:
wall-sliding circle movement, cardinal sword arcs with one hit per swing
and a tile raycast (no hits through walls), knockback + 1 s i-frames,
brains for chaser/wanderer/turret/bat/knight/slimeKnight, pots, grass,
drops, chests, small/Boss Key doors, `S` doors that open on room clear,
portals with a 0.35 s slide, death → respawn at the safe entry with
enemies/pots reset and progress kept, seeded mulberry32 RNG in the state,
`toSave`/`parseSave`, and an attract autopilot. `renderer.ts` — Canvas 2D,
cached tile layer, bounded particle pool, telegraph rings, slide with a
snapshot of the previous room, HUD strip (hearts, keys, room name on wide
screens). `Zelda.vue` — loop, phases, input, audio, save; `Landing.vue` —
title/RESTING/THE SHRINE WAKES panels. `theme.css` — the token contract.

**Controls.** Keys: arrows/WASD, Space/J sword, E/K interact, P or Esc-tap
pause, Esc-hold quit (progress kept, no auto-respawn), Enter start, N new
game. Touch: the first finger on the left 60 % becomes a **floating stick**
(direction = offset from touchdown, 40 px = full speed); any tap on the
right 40 % swings (auto-facing the nearest enemy at rest), a 350 ms hold
there interacts. Pointer listeners sit on `window`, like OutRun, because the
title panels are above the canvas. Music: `useSound` styles `zelda`,
`zeldaDungeon`, `zeldaBoss` by room area; attract is silent.

**Saves.** `localStorage.zeldaSave` (`SAVE_VERSION` 1: room, safe entry,
hearts, sword, keys, flags, containers, rng, elapsed) written on every
progression event, room entry, respawn and quit; garbage is ignored and the
game starts fresh. `zeldaBest` holds the best completion time in seconds
(no Hall of Fame — it would need lower-is-better semantics).

**Checks.** `npm run test:zelda` (in CI): 42 engine tests incl. a scripted
run through an inline test world to the relic, a 120 s autopilot soak and
save/death regressions; 12 world tests; a renderer smoke against a stub
canvas. Verified 2026-09-16 in headless Chromium: 1440×900 keyboard run
(sword, pot, chaser, pause, Esc-hold quit with the save written), 375×667
emulated touch (stick + simultaneous swing), 667×375, `/nope`; no page
errors or document overflow. Physical-phone feel is unmeasured.

**Known gaps.** Portrait phones waste the band under the room (the room is
width-limited, 25 px tiles at 375 wide); the meadow chaser is beatable but
the first room has not been tuned for feel; `respawn` carries no position,
so the renderer draws no respawn ring; Muse's first engine attempt was cut
off by its per-response output limit — it needed the "write in small
modules, one per call" instruction to finish.

## Neon Shrine — LTTP pixel-art direction (2026-09-21, still parked)

Approved Petter task, Codex design, Muse implementation. The abstract
neon-geometry look is replaced with handcrafted 16-bit pixel art, all
original code-drawn maps in `renderer.ts` (`SPRITES`: hero down/up/side ×
2 walk frames with hood/face/tunic/boots, six distinct enemy silhouettes,
pixel hearts). One logical pixel = tile/16, `fillRect` only, no smoothing.
Direction in `themes/zelda/DESIGN.md`.

**What changed.** Neighbor-aware tiles (merging stone wall tops + faces,
water banks/foam, shaded tree crowns with visible trunks, dirt-path `,`
tiles), visible portal exit posts with gold lamps, sword pickup on a stone
marker, swing in three beats (anticipation lean / lunge + stepped pixel arc
+ white blade at `SWORD_REACH`) on unchanged engine timing, single white hit
flash, corner-tick telegraphs, gold square-burst rewards. Vivid green and
violet outlines removed; terrain is muted plum/slate, only cyan/pink/gold
saturate. Striped sun/stars/ridge live only in the letterbox, never under
combat. Compact title bar (room visible behind), pixel-heart HUD. Touch deck
in the reserved space: DRAG TO MOVE marker, SWORD (repeats while held) +
USE buttons ≥64 px, pause; paused touch overlay has RESUME + QUIT; 6 px
stick dead zone. Theme stays `disabled: true`.

**Checks.** `npm run test:zelda` (62 tests: 42 engine + 12 world + 3 smoke +
5 sprite/palette, incl. retired-accent regression; in CI). Verified
2026-09-21 in headless Chromium: 1440×900 (attract, keyboard play + swing
arc, portal meadow→glade, P pause, 3 s Esc-hold quit → RESTING → Enter
continues), 375×667 touch (tap start, stick drag moves, SWORD button fires
with repeat, USE/II visible, deck clears pager dots), 667×375 (deck docks
right); `/nope` 404; no page errors, no overflow. Typecheck + production
build green. **Limitations:** physical-phone feel unmeasured (emulation
only); reduced motion honored in code, not re-shot this round; chest-open
via USE button not end-to-end exercised (same flag path as keyboard E,
engine-tested); combat tuning untouched.

## Neon Shrine — look lab and the violet-dusk terrain (2026-09-21, still parked)

Petter found the first pixel pass too dark and gave Claude a free hand. A
look lab ran the same day: the static-room painter was pulled out of
`renderer.ts` into **`themes/zelda/terrain.ts`** (`TerrainEnv`, `paintTile`,
`paintAmbient`, `hash2`), so a look is one file. Three Muse jobs painted
alternatives in worktrees (branches `zelda-lab/teal`, `zelda-lab/sunset`,
`zelda-lab/blacklight`, local only), Claude painted `zelda-lab/dusk`.
Verdict: teal was readable but generic (crate-like trees, cyan hero sinks
into teal ground); blacklight kept the night and lost the trees; sunset had
the best mood but slab trees; **dusk won** and took sunset's warm rim light
and rose trail. Compare with `node scripts/zelda-lab/shot.mjs <repoDir>
<outDir> [prefix]` — esbuild + headless Chromium, real renderer/engine/world,
no Nuxt (snap Chromium: `outDir` must be a non-hidden path under `$HOME`).

**Look.** Violet ground clearly above the `#0b0616` page, sparse authored
motifs (no static); `,` tiles are now authored as **connected trails**
(`world.ts`, collision unchanged) with neighbour-aware edges; adjacent `T`
merge into one canopy mass; the overworld `#` boundary is a forested cliff
(rock face on the north side, lips elsewhere) — brick is kept for other
areas via `env.area`; pixel-map pot and gravestone; lamp light pools and a
vignette in `paintAmbient`. Sprites get contact shadows. The sun is a big
stepped half-disc on the ridge (left letterbox; dimmed behind the deck in
portrait). Title card sits over the room's lower ground, not its top edge.

**Pixels and layout.** The tile snaps so one logical pixel is a whole number
of device pixels (skipped on dpr ≥ 2 when it would cost > 10 % of the room);
`resize(w, h, dpr, touch)` — dpr up to 3, and without touch the landscape
side reserves shrink (room 960×704 at 1440×900).

**Feel (engine).** Blocked movement now ends **flush** against the obstacle
— before, walking into a locked door with a key opened it only when the
step quantisation happened to land within 0.02 tiles. Axis-aligned walks
**slip round tile corners** (`CORNER_ASSIST` 0.3). Sword presses are
**buffered** (`ATTACK_BUFFER` 0.14 s; `Player.attackBuf`, not saved). The
blade is a solid pixel sword with a thin crescent smear.

**Checks.** `npm run test:zelda`: 67 tests (5 new feel regressions; the
scripted-run bot got a larger step budget). Verified 2026-09-21 in headless
Chromium against `nuxi dev`: 1440×900, 375×667 touch, 667×375 — attract,
start, move, swing, portal, pause, no page errors, no overflow; lab shots at
390×844 dpr 3. Typecheck + build green. **Limitations:** still no
physical-phone playtest; reduced motion not re-shot; only the two phase-1
rooms exist, dungeon brick is recoloured but unseen.

