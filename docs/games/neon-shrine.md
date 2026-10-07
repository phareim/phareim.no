## Neon Shrine — the Zelda-like, and phareim.no's world (rebuilt 2026-09-22, one world with the portal 2026-09-24)

Neon Shrine is a full A Link to the Past–style adventure in 80s neon paint:
scrolling overworld, the Keeper's hut, shop, cave, a ten-room dungeon with
keys, a block puzzle, crystal switches, a miniboss and a two-phase boss.
Since 2026-09-24 the Wildwood west of town is the quest's other road (the Shrine and the Wildwood Gate can be done in either order since 2026-10-01):
a second overworld and two two-floor labs with the hook, Luna, the Arc
Blade and four bosses (`docs/games/wildwood.md`). An hour or more to
finish. Since 2026-09-24 it is not a theme of its
own: its overworld begins in the town on `/` (the portal,
`docs/games/portal.md`), and the coast road east out of town leads to the
Keeper's hut. `?theme=zelda` is a legacy id and shows the portal. The
sword, items, pause menu and saves work the same in the town and out on
the coast. Design (story, maps, progression, enemies, look):
`themes/zelda/DESIGN.md`.

**Dialogue** (2026-09-26): people, signs and the pause screen's QUEST line
say where to go and what is wrong, never how to win. No boss tactics, no
"the item you just found works here", no secret spots. Boss cards are one
line of character. Item pickups say what the item does, once. The rest is
for the player to find out; the jokes stay.

The 2026-09-16/21 version (two 15×11 rooms, Muse-built engine) was replaced
wholesale on 2026-09-22; it is in git history up to `a110530`. The separate
theme page (title screen, attract mode, the hut's back door THE WAY HOME)
is in git history before the one-world merge.

**Files.** `types.ts` is the contract. `world/` — maps as string grids with
marker chars: `overworld.ts` (town + coast, 104×48), `town.ts` (the arcade
and Petter's house, `HIGH_SCORE_SIGN`), `interiors.ts` (hut, shop, cave),
`shrine.ts`, `intro.ts` (the Keeper's story), tile behaviour (`tiles.ts`),
`validate.ts`; the Wildwood: `wildwood.ts`, `lab1.ts`, `lab2.ts`, `luna.ts`,
`cells.ts`. `index.ts` holds `WORLD` (start: the plaza), `worldExits()`
and `worldStartingAt()`. `engine/` — pure simulation split by concern
(`game.ts` modes/saves/camera/exits/area intros, `hero.ts`, `enemies.ts`,
`objects.ts`, `combat.ts`, `map.ts`; the Wildwood's `hook.ts`, `luna.ts`,
`bosses.ts`). `render/` — `renderer.ts` (the frame's shared parts, the
classic view, and the turn between views), `iso/` (the isometric view),
`tiles.ts`, `sprites.ts` + `sheet.ts` (+ `spritesWild*.ts`), `tones.ts` (the
world's named colours as hex), `hud.ts`, `labTiles.ts` (the labs' look and
the new tiles), `wild.ts` (props, Luna, the hook's chain, moods). The 5×7
font and the shared palette are `themes/base/pixel/font.ts` and
`palette.ts`. `views.ts` — the list of views. `keys.ts` — the button names
in dialog lines. `audio.ts` —
music, jingles, SFX. `Zelda.vue` — the world shell (loop, input, touch
deck, audio, saves, pause menu, exits, navigation lock), mounted by
`themes/portal/Landing.vue`. `profileSync.ts` — the profile pull.
`progress.ts` — quest steps and the save merge. `hiscore.ts` — a real top
three on the arcade's HIGH SCORES sign (one Hall of Fame game at random,
`/api/leaderboard` without a player id; offline it keeps the KNG joke).

**Views** (2026-10-07, on the `beta` branch: beta.phareim.no). The game can
be shown in more than one way, and the player can change it in the middle of
a room: V, the VIEW chip on a phone, or the pause screen. The state, the
engine and the world are the same; a view is only how a frame is drawn.
`views.ts` lists them: `classic` (the picture described under "Look" in
`themes/zelda/DESIGN.md`) and `iso`, an isometric one. The choice is kept in
localStorage `zelda.view`; `/?view=iso` asks for one.

- **Three layers, kept apart.** The engine and `world/` never import from
  `render/`, and world data names tones (`Tone` in `types.ts`), never a hex
  colour; `test:portal` fails on either. A second look for the same world
  brings its own `tones.ts` and painters and touches nothing else.
- **The frame in parts** (`render/renderer.ts`). `queue()` returns everything
  that stands in the world as items that draw themselves the classic way and
  say where they stand (`Item` in `wild.ts`: x, the sort row, `foot`, `ay`,
  `wall` for what hangs on a wall, `tile` for what belongs to its tile's
  picture, like goods on a counter); `ambient()`, `projectiles()`, `fx`, `flashFade()`, `present()`
  (upscale, bloom, scanlines, vignette) and `hudLayer()` are the rest. The
  classic view is one way of putting them together, a `View` another: it gets
  the parts as a `Kit` and draws `draw(state, ui, dt, k)`.
- **The turn** (`render/turn.ts`, pure). `k` runs from 0 to 1 over 0.6 s. A
  view must look like the classic one as k nears 0, so the renderer cuts to
  it there and lets it turn itself in; going back it turns out and the
  classic view takes over. For the isometric view the first frame differs
  from the classic one in under half a percent of the pixels (measured
  2026-10-07, seven scenes): whatever the classic art never drew, like a
  wall's side, fades in with k. `View.turn` is how far the picture is rotated
  at k = 1; the shell turns the stick by the same angle (`turnMove`), so up
  on the stick is up on the screen in every view. A dialog gets the stick
  unturned: there a direction picks YES or NO by its sign. Reduced motion, a
  paused game and an open panel switch at once, and a pause in the middle of
  a turn finishes it. A browser that left in another view holds its first
  frames until that view's code is there (1.5 s at most).
- **The isometric view** (`render/iso/`). No new art: each frame the classic
  painters draw the map around the camera into hidden top-down buffers
  (ground, and what stands on it, on a clear canvas: `createTileLayer(…,
  'base' | 'objects')`), and the view rebuilds the picture with depth.
  `shape.ts` says how a tile stands, reading the three-quarter art at its
  word: a wall's top is lifted and belongs one row south of where it is
  drawn, its southern row is a face standing on the south edge, a house has
  two face rows under its roof, pots, lamps and lone trees are cards facing
  the viewer, a row of fence along x stands up as a strip. Sides nobody drew
  are the face picture again, in shadow. A wall with floor to its west stays
  down so a room is never hidden behind its own wall. People, enemies,
  cabinets and the hero are the classic drawings, moved to where their feet
  land; a board on a wall leans along it. Painted lettering's light and bloom
  are drawn top-down too and follow the tiles they lie on, so a name on a
  roof glows on the roof. In a dungeon only the hero's room is drawn, and
  during a scroll the two rooms it runs between. What stands between the
  viewer and the hero thins out. `project.ts` is the geometry: `projection(k)` turns
  the ground 45° and tips it back, 16 px per tile to a 32 × 16 diamond.
- **Adding a view.** A module whose default export is a `ViewFactory`, one
  line in `VIEWS` with its loader. A view's code is fetched on the first turn
  to it and must stay out of the entry (`tests/zelda-views.test.mjs` checks
  that nothing imports `iso/view` statically).
- **Known rough edges of the isometric view** (2026-10-07): woods are blocks
  of canopy; dungeon rooms are wider than the screen, so the camera follows
  the hero instead of showing the whole room; furniture is flat cards; the
  eight keyboard directions are the eight world directions, so walking along
  a wall takes two keys; an exit's label can jump a few px while it fades
  after the hero steps away. Outdoors a frame costs two to four times a
  classic one in software rendering (not measured on a phone).
- **Looking at it.** `VIEW=iso node scripts/zelda-lab/shot.mjs <outDir>
  [scenes]` renders the isometric view; `FRAMES=18` stops halfway through
  the turn.

**How it starts.** A visitor stands on the plaza with nothing. Walking
into Home Glade without the blade, the Keeper tells the story once (the
area's `intro`, flag `intro`); the blade's chest is beside the hut door.
Before the blade there is no HUD, no swing, no B buzz, and the play clock
(`state.elapsed`) stands still; it starts with the blade. `createGame(world,
{ save, at })` puts the hero at `at` (the plaza, or in front of the exit
last used) with the save's items; a save's own continue point only matters
for death during a session.

**Controls.** Keys: arrows/WASD move; Space/J/Z/Enter = A (sword, talk,
open, lift, throw, use an exit; hold after a swing, release to spin);
K/X/Shift = B (item); Q, or Tab when there is an item, swaps; V turns to
the next view (see "Views"); P or an
Escape tap pauses (items, heart pieces, the current quest); on the pause
screen M turns the sound on or off and T goes to town. Holding Escape saves and goes to town. Starting over
is the NEW GAME machine in Petter's house (see "Saves" below). Touch:
floating stick on the left 60 %, A always, B and SWAP once there is an
item, a pause chip (paused: RESUME, SOUND ON/OFF, TO TOWN); any tap moves a dialog on (a thumb that lands on the stick's side and stays down is the stick once the lines close);
a tap on the right of the world also swings. The world fills the whole
screen in portrait and landscape; the buttons float half see-through over
it. Installed as a web app the page runs under the notch and the status
bar: the shell measures the safe-area insets and the renderer keeps the HUD
and the dialog box clear of them (`resize(w, h, dpr, safe)`). The bottom
inset it measures is the site's bottom band, `--app-safe-bottom` (see
AGENTS.md), so the dialog box and the button deck stay above it.

A talk branch can end in a two-way question (`ask` on `TalkBranch`: two labels, a reply each; left/right or a tap picks, B closes). The town cat uses it: TALK or PET (2026-10-01).
After lines close, A only swings until it has rested `TALK_REST` (0.35 s, restarted by each press), so mashing through someone's lines never starts them over (2026-10-06).

**Saves (on the profile since 2026-09-23).** The save belongs to the
browser's Hall of Fame player — the same pilot as the scores and the Hangar
ship. Nothing is written before the hero has the blade, so a visitor who
only walks round the town never becomes a player. `localStorage.zeldaSave`
(`SAVE_VERSION` 2: continue point, max hearts, inventory, flags, rng, play
time, `savedAt`) is the instant copy; every write also goes to the
player's slot `zelda` through `POST /api/save` (`composables/useGameSave.ts`,
one request in flight, keepalive). Written on every map entry, item,
secret, door, gate, boss, respawn, exit, TO TOWN and when the tab is
hidden. On load the shell starts on the local copy and pulls the slot in
the background; `reconcile` in `progress.ts` keeps the newer write, and a
newer profile save replaces the run at the next calm frame only if this
session has not saved yet. A new game (a cleared slot, remembered locally
as `zeldaClearedAt`) is not undone by an older copy. Winning keeps the run
(since 2026-09-24): the save is written with the prism taken, the win is
counted and the best time sent; after the ending the hero plays on where
the prism was, and only the NEW GAME machine clears the save. Best
times meet at the lower (`zeldaBest` locally, `best_seconds` on the slot,
which also counts clears). The Hangar shows QUEST n/12 from the slot. A player is
still one browser, so the save does not follow a person to another device.

**Bits are the site wallet** (2026-09-26). The bits the hero finds and
spends are the same bits Mini World uses (`composables/useWallet.ts`,
localStorage `phareim.wallet` plus the player's server balance). The
engine still just counts `inv.bits`; the shell bridges it
(`themes/zelda/wallet.ts`, tested in `tests/zelda-wallet.test.mjs`): every
new game state takes the wallet's balance, each frame's change in
`inv.bits` becomes a wallet op (reason `shrine`), and a change from
elsewhere (another tab, Mini World, the server) lands in the purse. The
hero carries at most `MAX_BITS` 9999 (the HUD counter grows to four
digits); a bigger wallet shows 9999 here and stays exact in the wallet.
The save still writes `bits`, but the wallet is the truth. Once per
browser (flag `zelda.bitsInWallet`) the bits of a save from before the
wallet move into it. One-time bits (a chest, a floor item, an NPC's gift)
pay once per browser, not once per run (localStorage `zelda.paidBits`,
seeded from the flags of every save the shell loads): after START OVER, or
on a visit before the sword when nothing is saved yet, the chest opens
again but the wallet stays where it was. Enemy drops always pay.

**A made figure's clothes** (2026-09-26). When localStorage
`figur.heroColors` holds Lag Din Figur's active figure, or else
`miniworld.heroColors` the active Mini World person's colours (both
`HeroColors`; the figure wins, Petter's call), the hero wears them: `render/heroColors.ts` maps them onto
the hero's palette letters (hair, headband, skin, shirt and its stripe,
belt, trousers; shoes are `E` and the open mouth `M`, so they recolour
apart from the white and pink they share) and `setHeroColors` in
`render/sheet.ts` rebuilds only the `hero_*` canvases. Re-read on the
`storage` event and when the tab comes back. No colours: the hero as drawn.
`HERO_COLORS='<json>' node scripts/zelda-lab/shot.mjs <dir> r-sword`
renders a dressed hero.

**Exits.** An `exit` marker (`ExitDef` in `types.ts`) is a way out of the
game: walk onto a door exit, or press A at a solid one and read its lines,
and the door fade runs; at full dark the engine emits `{ type: 'exit', id,
to }` and stays in mode `exit`. All exits are in the town (cabinets, board,
HANGAR door, kiosk, signpost, terminals); the shell saves and navigates.

**Checks.** `npm run test:zelda` (in CI, 40 tests with the audio and
Wildwood suites, green 2026-09-24; the Wildwood's own checks are in
`docs/games/wildwood.md`): world
validation (everything reachable from the plaza), the first minute (the
coast road from the town, the Keeper's story once, no clock before the
blade, the blade chest; out of the hut door in ~0.22 s with input ignored;
a save continuing at the plaza or a cabinet with its items;
swing/cut/spin, lift/throw), the hut (one door, in and out), exits on a
small fixture world (cabinet with lines, solid exit without, door, the
entries beside them, validator errors), the rules before the blade, saves
and death, and a **full scripted run** from the hut to the Sun Prism with
a path-finding walker (god mode, bosses killed directly) — it proves every
key, gate, crystal, push block and appear-chest is wired. The town's own
checks are `test:portal`. `node scripts/zelda-lab/shot.mjs <outDir>
[scenes]` renders the real renderer for named scenes without Nuxt (`r-*`
are the town, `r-road` the coast road); `scripts/zelda-lab/cdp.mjs` is a
small DevTools driver (no puppeteer on Sleeper) for headless play in the
dev server, which exposes `window.__zelda` (and `__portal`) in dev only.
Headless play verified 2026-09-24 (see `docs/games/portal.md`). **Not
yet:** physical-phone feel, music heard by a person, full manual
play-through.
