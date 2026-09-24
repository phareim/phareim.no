## Neon Shrine — the Zelda-like (rebuilt 2026-09-22, live 2026-09-23)

`?theme=zelda` is a full A Link to the Past–style adventure in 80s neon
paint: scrolling overworld, the Keeper's hut, shop, arcade, cave, a
ten-room dungeon with keys, a block puzzle, crystal switches, a miniboss and
a two-phase boss. A new game starts with the hero stepping out of the hut
door; the hut's back door, THE WAY HOME, leaves the game for the portal on
phareim.no (engine and world side since 2026-09-24). The arcade's HIGH
SCORES sign shows a real top three from one Hall of Fame game, picked at
random per visit (`hiscore.ts` fetches `/api/leaderboard` without a player
id and rewrites the sign's lines in place; offline it keeps the KNG joke).
About 20–30 minutes to finish. Live since 2026-09-23, when Petter unparked
it. Design (story, maps, progression,
enemies, look): `themes/zelda/DESIGN.md`.

The 2026-09-16/21 version (two 15×11 rooms, Muse-built engine) was replaced
wholesale on 2026-09-22 because it was not fun; it is in git history up to
`a110530`.

**Files.** `types.ts` is the contract. `world/` — maps as string grids with
marker chars (`overworld.ts`, `shrine.ts`, `interiors.ts` with the hut,
shop, arcade and cave), tile behaviour (`tiles.ts`), `validate.ts` (works
for any `World`; the portal uses it too). `index.ts` holds `WORLD`: the
start (`overworld`/`hut`, the hut door) and the Keeper's intro.
`engine/` — pure simulation split by concern (`game.ts`
modes/saves/camera/exits, `hero.ts` incl. the walk out of a door and A on
exits, `enemies.ts`, `objects.ts` bombs, disc, puzzles, `combat.ts`
damage/items, `map.ts` loading/collision, exits and their entries). The
engine is shared with the portal (`themes/portal/`), which brings its own
peaceful world.
`render/` — `renderer.ts` (camera, lighting, bloom, entities, effects),
`tiles.ts` (terrain painter), `sprites.ts` + `sheet.ts` (pixel art),
`font.ts`, `hud.ts`. `audio.ts` — music, jingles, SFX. `Zelda.vue` — loop,
input, touch deck, audio, saves, navigation lock. `Landing.vue` — title and
result panels.

**Controls.** Keys: arrows/WASD move; Space/J/Z/Enter = A (sword, talk,
open, lift, throw; hold after a swing, release to spin); K/X/Shift = B
(item); Q/Tab swap item; P or an Escape tap pause (the pause screen shows
items, heart pieces and the current quest); R on the pause screen asks
START OVER? (Enter/Y yes, Esc/P/N no) and a yes wipes the save here and on
the profile and starts from the intro, best time kept; Escape hold quits
with progress kept; N new game on the title. Touch: floating stick on the left 60 %, A and
B buttons, SWAP and pause chips (paused: RESUME, START OVER with a yes/no step, QUIT); any tap moves a dialog on; a tap on the
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

**Exits and the way home.** An `exit` marker (`ExitDef` in `types.ts`) is a
way out of the game: walk onto a door exit, or press A at a solid one and
read its lines, and the door fade runs; at full dark the engine emits
`{ type: 'exit', id, to }` and stays in mode `exit`. Neon Shrine's only exit
is the hut's back door (`{ home: true }`). The save written on entering the
hut keeps the quest. `World.peaceful` (the portal) turns off all damage.

**Checks.** `npm run test:zelda` (in CI, 21 tests, green 2026-09-24): world
validation, the first minute (out of the hut door in ~0.22 s with input
ignored, then the intro, blade chest beside the door, swing/cut/spin,
lift/throw), the hut (in and out, the sign, the way home emits
`{ home: true }` and holds mode `exit`), exits and peaceful rules on a small
fixture world (cabinet with lines, solid exit without, door, the entries
beside them, validator errors; no damage from spikes, blob, pellet or pit),
saves and death, and a **full scripted run** from the hut to the Sun Prism
with a path-finding walker (god mode, bosses killed directly) — it proves
every key, gate, crystal, push block and appear-chest is wired. `node
scripts/zelda-lab/shot.mjs <outDir> [scenes]` renders the real renderer for
named scenes without Nuxt; `scripts/zelda-lab/cdp.mjs` is a small DevTools
driver (no puppeteer on Sleeper) for headless play in the dev server, which
exposes `window.__zelda` in dev only. Verified 2026-09-22: typecheck,
tests, headless play at 1280×800 (title, intro, chest, combat, pause) and
390×844 touch (tap start, A button, stick), no page errors. **Not yet:**
physical-phone feel, music heard by a person, full manual play-through.
