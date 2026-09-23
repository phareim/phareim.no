## Neon Shrine — the Zelda-like (rebuilt 2026-09-22, live 2026-09-23)

`?theme=zelda` is a full A Link to the Past–style adventure in 80s neon
paint: scrolling overworld, shop, arcade, cave, a ten-room dungeon with
keys, a block puzzle, crystal switches, a miniboss and a two-phase boss.
About 20–30 minutes to finish. Live in the swipe rotation after OutRun
since 2026-09-23, when Petter unparked it. Design (story, maps, progression,
enemies, look): `themes/zelda/DESIGN.md`.

The 2026-09-16/21 version (two 15×11 rooms, Muse-built engine) was replaced
wholesale on 2026-09-22 because it was not fun; it is in git history up to
`a110530`.

**Files.** `types.ts` is the contract. `world/` — maps as string grids with
marker chars (`overworld.ts`, `shrine.ts`, `interiors.ts`), tile behaviour
(`tiles.ts`), `validate.ts`. `engine/` — pure simulation split by concern
(`game.ts` modes/saves/camera, `hero.ts`, `enemies.ts`, `objects.ts` bombs,
disc, puzzles, `combat.ts` damage/items, `map.ts` loading/collision).
`render/` — `renderer.ts` (camera, lighting, bloom, entities, effects),
`tiles.ts` (terrain painter), `sprites.ts` + `sheet.ts` (pixel art),
`font.ts`, `hud.ts`. `audio.ts` — music, jingles, SFX. `Zelda.vue` — loop,
input, touch deck, audio, saves, navigation lock. `Landing.vue` — title and
result panels.

**Controls.** Keys: arrows/WASD move; Space/J/Z/Enter = A (sword, talk,
open, lift, throw; hold after a swing, release to spin); K/X/Shift = B
(item); Q/Tab swap item; P or an Escape tap pause (the pause screen shows
items, heart pieces and the current quest); Escape hold quits with progress
kept; N new game on the title. Touch: floating stick on the left 60 %, A and
B buttons, SWAP and pause chips; any tap moves a dialog on; a tap on the
right of the world also swings. Portrait phones get a console band under the
view; landscape keeps buttons over the world.

**Saves (on the profile since 2026-09-23).** The save belongs to the
browser's Hall of Fame player — the same pilot as the scores and the Hangar
ship. `localStorage.zeldaSave` (`SAVE_VERSION` 2: continue point, max
hearts, inventory, flags, rng, play time, `savedAt`) is the instant copy;
every write also goes to the player's slot through `POST /api/save`
(`composables/useGameSave.ts`, one request in flight, keepalive). Written
on every map entry, item, secret, door, gate, boss, respawn, quit and when
the tab is hidden. The first save creates the player if the browser has
none, as a first score does. On the title the landing pulls the slot and
`reconcile` in `progress.ts` keeps the newer write: a lost local copy comes
back, and a new game or a win (a cleared slot, remembered locally as
`zeldaClearedAt`) is not undone by an older copy. Best times meet at the
lower (`zeldaBest` locally, `best_seconds` on the slot, which also counts
clears). The title shows QUEST n/7 · next goal · play time and SAVED TO
<PILOT>; the Hangar shows the same quest row. `progress.ts` also owns the
seven quest steps behind the pause screen's QUEST line. A player is still
one browser, so the save does not follow a person to another device.

**Checks.** `npm run test:zelda` (in CI): world validation, the first
minute (blade in one step, swing/cut/spin, lift/throw), saves and death, and
a **full scripted run** from the hut to the Sun Prism with a path-finding
walker (god mode, bosses killed directly) — it proves every key, gate,
crystal, push block and appear-chest is wired. `node
scripts/zelda-lab/shot.mjs <outDir> [scenes]` renders the real renderer for
named scenes without Nuxt; `scripts/zelda-lab/cdp.mjs` is a small DevTools
driver (no puppeteer on Sleeper) for headless play in the dev server, which
exposes `window.__zelda` in dev only. Verified 2026-09-22: typecheck,
tests, headless play at 1280×800 (title, intro, chest, combat, pause) and
390×844 touch (tap start, A button, stick), no page errors. **Not yet:**
physical-phone feel, music heard by a person, full manual play-through.
