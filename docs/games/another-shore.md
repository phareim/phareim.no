## Another Shore (rebuilt 2026-09-23)

`?theme=anotherworld` selects **Another Shore**, a homage to *Another
World* in five chapters with a prologue and an ending, one of the live
games. It replaced the one-screen coastal walk of
2026-09-06 (in git history up to `ff0d618`). Story, look and rules:
`themes/anotherworld/DESIGN.md`.

**Tie-ins with the arcade.** The prologue is the shared Neon Dreams
horizon (`themes/base/neonHorizon.js`) with the player's Hangar ship
flying into the sun; the flight log names the Hall of Fame pilot. The
pilot's suit, shots and shield take the ship's hull colour. The palettes
are the Neon Dreams inks on flat Another World polygons. Progress is a save
slot on the pilot profile (`SAVE_GAMES` in `themes/leaderboard/games.ts`),
shown in the Hangar beside Neon Shrine. There is no score and no Hall of
Fame board.

**Files** (`themes/anotherworld/`). `types.ts` — the contract.
`engine/` — `player.ts` (movement, mantle, swim, kick, gun), `actors.ts`
(tide, rockfall, tentacles, leeches, guards, shields, shots, the beast,
lifts), `levels.ts` (the five chapters and their scripts), `game.ts`
(cuts, deaths, chapters, saves), `demo.ts` (the attract autopilot).
`render/` — `core.ts` (palettes, primitives, camera), `scenery.ts`,
`figures.ts`, `things.ts`, `cuts.ts` (prologue, capture, ending, chapter
card), `index.ts`. `audio.ts` — ambience, one-shots, cues. `progress.ts` —
local save, profile reconcile, the Hangar summary. `Landing.vue` — title,
loop, input, touch pad, pause, result, saves.

**Controls.** Keys: ← → / A D move; ↑ / W / Z jump (swim up); ↓ / S
crouch; Space / X / J / Shift kick, or with the gun tap fire · hold shield
· hold longer beam. P or an Escape tap pauses; a 3 s Escape hold leaves
(progress kept); Enter or Space skips a cut. Touch: ◀ ▶ ▼ on the left, ▲
and ◆ (kick / fire) on the right; a tap on the picture skips a cut. The
title offers CONTINUE (chapter) and NEW CROSSING (N).

**Checks.** `npm run test:anotherworld` (in CI): 20 engine tests — jump,
crouch, mantle, the pool and its tentacles, the attract loop crossing
chapter I, a playtester that crosses **each of the five chapters without
dying** with ordinary button presses, the beast, guards and shields, the
beam and the blast door, the cage, cuts and chapter changes, death and
respawn, saves and reconcile, determinism — plus 6 audio tests against a
fake Web Audio. `node scripts/shore-lab/shots.mjs <outDir> <base> <WxH>
[scenes]` screenshots chapters and cuts in the dev server through the
dev-only `window.__shore` hook; `scripts/shore-lab/play.mjs` plays the
title → prologue → pool → bank with the keyboard and checks the save.

Verified 2026-09-23 in headless Chromium at 1440×900, 1280×800, 375×667
and 667×375: title, all five chapters, the three cuts, pause, leave and
continue, no page errors. **Not yet:** a physical phone, the sound heard by
a person, a full manual play-through.

Dev-only gotcha: in a git worktree whose `node_modules` is a symlink, Vite
refuses the @fontsource files (403) unless a local, uncommitted `.nuxtrc`
sets `vite.server.fs.strict=false`.
