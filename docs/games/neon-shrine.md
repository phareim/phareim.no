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
`tiles.ts`, `sprites.ts` + `sheet.ts` (+ `spritesWild*.ts`), `heroFrames.ts` +
`heroLook.ts` (the hero's frames per shape and the look from the NEW LOOK
stall), `tones.ts` (the
world's named colours as hex), `hud.ts`, `labTiles.ts` (the labs' look and
the new tiles), `wild.ts` (props, Luna, the hook's chain, moods). The 5×7
font and the shared palette are `themes/base/pixel/font.ts` and
`palette.ts`. `views.ts` — the list of views. `keys.ts` — the button names
in dialog lines. `audio.ts` —
music, jingles, SFX. `Zelda.vue` — the world shell (loop, input, touch
deck, audio, saves, pause menu, exits, navigation lock), mounted by
`themes/portal/Landing.vue`. `LookBooth.vue` — the NEW LOOK stall's mirror.
`profileSync.ts` — the profile pull.
`progress.ts` — quest steps and the save merge. `hiscore.ts` — a real top
three on the arcade's HIGH SCORES sign (one Hall of Fame game at random,
`/api/leaderboard` without a player id; offline it keeps the KNG joke).

**Views** (2026-10-07; engines, values and the pencil view 2026-11-11). The game can
be shown in more than one way, and the player can change it in the middle of
a room. The state, the engine and the world are the same; a view is only how
a frame is drawn. A view is a drawing **engine** with a name and its own
values. `viewParams.ts` (pure) lists the engines and what can be turned on
each (`ENGINES`: numbers with bounds, colours, choices, toggles): `classic`
(the picture described under "Look" in `themes/zelda/DESIGN.md`), `iso`, an
isometric one, and `blyant`, a pencil sketch. `views.ts` holds the round: one
built-in view per engine (CLASSIC · 8-BIT, ISOMETRIC · 16-BIT, PENCIL ·
SKETCH), and whatever the studio published (below). **A visit starts in the
16-bit view** (`DEFAULT_VIEW` in `views.ts`, since 2026-11-12): it is the
world's look, and the other views are a choice on the pause screen. A view the visitor turns to is kept in localStorage
`zelda.view` and is where their next visit starts; the view a visit merely
starts in is not written, so a browser that never chose follows the site's
first view, and one failed fetch of a view's code does not pin it to the
classic picture. `/?view=<id>` asks for one.

- **Finding them** (2026-11-12). The views are behind the pause: on the
  pause screen V turns to the next view (the screen names the one that is
  on), and on touch the pause buttons have VIEW beside RESUME, SOUND and TO
  TOWN. Nothing beside the world turns the view: there is no view button in
  the corner, V does nothing in play, and the page's first hint names no
  view key (`tests/zelda-views.test.mjs` holds it to that). The one thing in
  the world that does is the **viewfinder** east of the fountain (exit
  `view`, look `scope`, panel `view`, which opens nothing): A turns to the
  next view and brings up the **view strip** (`drawViewStrip` in `hud.ts`),
  the whole round side by side for 2.6 s, the one in use lit.
- **Values** (`viewParams.ts`). `renderer.setParams(engine, values)` hands an
  engine a view's values; `kit.params(id)` reads them, `kit.finish(id)` is the
  part every engine has (scanlines, neon bloom, vignette; `present` takes it).
  `resolveParams` clamps and drops what it does not know, `paramDiff` keeps
  only what differs from the engine's own.
- **The studio's views** (`render/live.ts`, `parseViews` / `mergeViews` in
  `views.ts`). The live file may carry `views: { <id>: { engine?, name?, tag?,
  params?, order?, hidden? } }`: new values for a built-in view, or a view of
  the studio's own (an engine, a name in the pixel font's letters, values).
  They join the round at once, eight at most; the classic view cannot be
  hidden; a stored view the round no longer has falls back to the classic one.

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
  classic view takes over. The isometric view's first frame has the classic
  picture's geometry to the pixel (`camera.ts`; a test holds it) and its
  effects at nothing; the light is near the classic one but not the same
  (its glow lies on the ground instead of hanging on the screen), a small
  step in brightness at the cut. Whatever the classic art never drew, like a
  wall's side or a tree's crown, comes in with k. `View.turn` is how far the picture is rotated
  at k = 1; the shell turns the stick by the same angle (`turnMove`), so up
  on the stick is up on the screen in every view. A dialog gets the stick
  unturned: there a direction picks YES or NO by its sign. Reduced motion, a
  paused game and an open panel switch at once, and a pause in the middle of
  a turn finishes it. A browser that left in another view holds its first
  frames until that view's code is there (1.5 s at most).
- **The isometric view** (`render/iso/`, rebuilt 2026-11-12): the world
  turned 45° and tipped back, at **twice the pixel density** (two px for
  every px of the classic art, so a tile is 32 px on the ground), drawn by
  the GPU. The art is still the classic painters': each frame they draw the
  map round the camera into top-down pictures (ground, and what stands on it,
  on a clear canvas: `createTileLayer(…, 'base' | 'objects')`), every person
  and thing draws itself into its own cell of an atlas (`Item.big` asks for a
  large cell: cabinets, tents, bosses), and `view.ts` hands all of it to
  `engine.ts` as geometry. `shape.ts` says how a tile stands, reading the
  three-quarter art at its word: a wall's top is lifted and belongs one row
  south of where it is drawn, its southern row is a face standing on the
  south edge, a house has two face rows under its roof, pots, lamps and lone
  trees are billboards facing the viewer, a row of fence along x stands up as
  a strip. Sides nobody drew are the face picture again, darker toward the
  ground in dithered steps. A wall with floor to its west stays down so a
  room is never hidden behind its own wall. People, enemies, cabinets and the
  hero are billboards on their feet; a board on a wall lies on the wall. In a
  dungeon only the hero's room is drawn, and during a scroll the two rooms it
  runs between. `camera.ts` (pure, tested) is the geometry: `projection(k)`
  from `project.ts` turns the ground, height is never foreshortened, and
  depth is the distance along the line of sight, so a z-buffer sorts
  everything and nothing is sorted by hand.
- **The passes** (`shaders.ts`, in the order `engine.ts` runs them).
  1. *Geometry* into a G-buffer (colour; normal and height; material and
     how much it shines by itself) with a z-buffer. The art is treated on its
     way up to two px a texel (`ART`): Scale2x gives a staircase its
     half-steps, texels of one material (colours close to each other) run
     into each other so a three-shade ramp becomes a gradient while an
     outline stays a line, the slope of the art's own brightness becomes
     relief for the lamps to catch, a figure's outline says how round it is,
     and a black outline takes the darkened colour of what it surrounds.
     Bright saturated colours are neon: they shine by themselves and feed
     the bloom. Translucent art is a dither. The hero behind a wall or a
     crown is drawn once more through it, every other px.
  2. *Lamps* top-down into a light buffer (half-float where the browser has
     it): for each px of ground how much light of each colour arrives, and
     for each colour channel from which side. A lamp's light stops at walls
     and roofs (a march through the tile heights). Then *blob shadows*: what
     walks, and what stands alone, throws a soft blob away from whatever
     lights it most (the sun outdoors, the nearest lamps indoors), so a
     shadow swings round as the hero passes a lamp.
  3. *Lit*: the G-buffer shaded. A surface takes a lamp's light by how it
     faces it, per colour, so a figure between a pink and a cyan lamp has a
     pink side and a cyan side; on figures the light falls in steps, the way
     a pixel artist shades. Outdoors the low sun adds side shading, long
     shadows (marched through the tile heights, with a dithered edge), a warm
     rim, drifting cloud shadows; corner shade where a wall meets the floor;
     and a little of every lamp's light hangs in the air over the ground it
     falls on (the classic view's glow, lying down).
  4. *Composite*: water (crests running across the screen, the dusk lying
     on it, what stands by it mirrored from the picture itself, lamps
     glittering on the crests, foam where it meets land), wet pavement and
     polished floors that show the lamps and signs above them as streaks,
     haze in bands, low
     mist and shafts of the sun in the Wildwood, a mood's colour cast, the
     effects layer (shots, sparks, dust, leaves, the flash) at full
     brightness, and the machine's colours: five bits a channel with an
     ordered dither between them.
  5. *Bloom and the finish* at the screen's own resolution: the whole-number
     upscale, the glow, vignette, scanlines if a view asks for them, and the
     machine's own tricks: a door is a mosaic on the way out and in, death
     closes an iris on the hero, the Other Side waves down its scanlines.
- **Plants** (`flora.ts`). Trees, bushes, tall grass, flowers, reeds and
  tufts are painted at the hi-res size with normals of their own and stand as
  billboards where the classic tiles had them (a little off the grid), sway
  in the wind, part round the hero, and thin out between the viewer and the
  hero so nobody is lost in the woods. Cutting a bush or grass changes the
  tile, and the plant is gone with it.
- **The backdrop** (`backdrop.ts`). Beyond the map's edge is a dusk in
  layers that slide at different speeds: banded sky, stars, the striped sun,
  ridges, clouds, the sea.
- **Values** are engine `iso` in `viewParams.ts`, all the studio's to turn:
  smoothing, relief, roundness, side light, lamp shadows, light in the air,
  the sun's direction and shadow length, shadow strength and colour, corner
  shade, side shading, rim, haze, mist, sun shafts, sky colours, clouds,
  wind, standing plants, things in the air, the water's mirror, wet ground,
  15-bit or
  full colour, the sound (below), the windows, and the finish. Every effect
  scales with k, and at k = 0 the camera is the classic one, so the turn
  still starts on the classic picture.
- **The 16-bit sound** (`audio.ts`, `setFlavor('16-bit')`). While this view
  is on, the same compositions (not a note, tempo or form changed) play
  through a second chip, in the manner of the SNES's: every melodic
  instrument is a short looped recording made in code at 32 kHz (flute, pan
  pipes, reed, brass, strings, choir, fretless and slap bass, harp, electric
  piano, chime, glass, mallet; `renderSpcSample`), put through a real BRR
  encoder and the chip's gaussian kernel (`spcCodec`), and repitched by at
  most eight semitones (`spcRoot`); a sampled kit; a ping-pong echo with a
  lowpass in its loop and a dark room; a wider stereo picture. Each track has
  its patch (`SPC_PATCHES`). The effects take the same voice, softly, the
  short ones dry. A change of flavour crossfades in 0.4 s and never restarts
  the song; the recordings are made in idle slices after `unlock()`, the
  playing track's first. `flavorForView(engine, params)` is what the shell
  asks: the `iso` engine, unless its `sound` value says `8-bit`. The 8-bit
  path is as it was. Nobody has listened to it yet: it is tuned by
  measurement (`scripts/zelda-lab/audio-render.mjs <outDir> [tracks]
  [seconds]` renders both flavours and a switch to WAV with spectrograms,
  and checks peak, loudness, brightness, width, the echo's tail and the
  compressor; `SFX=1` adds every effect and jingle).
- **What it needs, and what happens without.** WebGL2. Without it, or when
  the context is lost, the canvas view this one replaced draws instead
  (`legacy.ts`, fetched only then; the classic picture until it is here).
  One hi-res px is a whole number of device px: half the classic px where
  that is whole; where it is not (an odd screen scale), a phone gets the
  larger px and a wide screen the smaller.
  Without float render targets the lamps light flat. A device that keeps
  missing frames is stepped down while it plays and stays there (`govern`
  in `view.ts`: first the costly extras go, then the pixels get larger);
  `pinQuality` holds it still for the lab.
- **The pencil view** (`render/blyant/view.ts`). The classic picture, unlit
  and top-down (`kit.classic`: `world`, `light`, `glows`, `rooms`, the classic
  view in parts), handed to Blyant's pencil, `Blyant.Sketch2D` (npm `blyant`,
  pinned; a WebGL pass, the only place the site imports Blyant): the edge
  between two colours is a contour drawn twice, the light map is hatching,
  colour is coloured pencil, every tile a square on squared paper, and the
  hand follows the world (`origin` is the camera) so lines stand still while
  the view scrolls. `paper`: Papir (pencil on a light sheet), Kull (chalk on a
  dark one) or `auto`, which follows the visitor's light or dark mode. `k`
  mixes the sketch in over the classic picture in patches, so the turn needs
  no cut. The HUD is notes on the same paper (`paperSkin`). Without WebGL the
  picture is laid lightly on the sheet.
- **The studio's stage** (`themes/stage/`, `/?theme=stage`, 2026-11-11). The
  world with nothing around it, for the studio's frame: `ViewStage.vue` runs
  the engine and the renderer on a fresh state and takes messages from
  studio.phareim.no (and a local dev studio) only, after the studio's
  `docs/stage-protocol.md`: `hello` → `ready { scenes, engines }`; `show {
  view: { engine, params, name }, scene, gear, hud: play | dialog | pause |
  strip, reduced, turn }` → `shown`; `replay` plays the turn from the classic
  picture; `shot` answers with a PNG. `scenes.ts` lists the places (twenty,
  from the square to Horizon Lab; a test stands the hero on open ground in
  each). Nothing is kept there: no save, profile, wallet, score or sound, and
  the hero cannot die. Arrows and Space work once the frame has the focus.
  `scripts/export-sprites.mjs` writes `views` into the base the studio reads
  (`/studio/neon-shrine.json`): the engines with their values' bounds, the
  built-in views, the cap on the round and the scenes.
- **HUD skins** (`HudSkin` in `hud.ts`). The layout is one; a view may dress
  it: `NEON_SKIN` (classic), `WINDOW_SKIN` (gradient windows at the classic
  size), `HIRES_WINDOW_SKIN` (`hud16.ts`: the 16-bit view's, drawn at two px
  to the classic px, with its own proportional font `base/pixel/font16.ts`,
  banded SNES windows with a bevel, redrawn hearts and icons, a name plate
  on the dialog box), `paperSkin(...)`. `kit.hudLayer(..., skin)`;
  `kit.hudSpace(skin)` says where a skin's grid lies on the screen (an odd
  screen scale gives the hi-res HUD an even scale of its own).
  `scripts/zelda-lab/hud-sheet.mjs` renders every skin in every state.
- **The shell's HTML in the 16-bit dress** (2026-11-12). What the shell
  draws in the DOM (the pause chip, the touch deck's pictures, the
  pause buttons, the Escape pill, the three panels, and the page's first
  hint and ending panel) wears the same dress as the canvas HUD while that
  HUD is `HIRES_WINDOW_SKIN`: the class `px16` on every root of `Zelda.vue`
  (the canvas too, so the page's hint beside it can be reached). `wears16`
  decides it from the view, exactly as `iso/view.ts` picks its skin: the
  `iso` engine with its `windows` value at `'16-bit'`; it follows V, the
  studio's live values and the first frame, and changes halfway through a
  turn, when the canvas does (`stepDress`). The dress itself is
  `themes/base/pixel/pixel16.css` (banded windows, bevel frames and letter
  colours copied from `hud16.ts`; `tests/zelda-chrome16.test.mjs` holds the
  two together) in the font `--font-pixel16`, `font16.ts` as a webfont
  (`docs/games/pixel-look.md`). What stands beside the canvas HUD is sized by
  that HUD's own pixel: `Renderer.fineUnit()` (CSS px to one fine HUD pixel
  on this screen and in this map), snapped to whole device px and written as
  `--px16-fine` on the element the shell sits in by `syncUnit` (after a
  resize, and on the frame it changes), so letters in the HTML and on the
  canvas are one size; the panels and the ending keep 1 CSS px, because they
  must fit a phone. The deck's pictures are the skin's own icons
  (`HIRES_WINDOW_SKIN.icon`, EPX). The canvas also carries
  `zelda-canvas--paused`, which takes the page's hint away while the game is
  paused, in every view. Classic and pencil views are untouched: without the
  class none of it applies.
- **Adding an engine.** A module whose default export is a `ViewFactory`, a
  loader in `ENGINE_LOADERS`, its values in `viewParams.ts`, a built-in view
  in `VIEWS`. An engine's code is fetched on the first turn to it and must
  stay out of the entry (`tests/zelda-views.test.mjs` checks that nothing
  imports `iso/view` or `blyant/view` statically, and that only the pencil
  view imports Blyant). A view of an engine that exists needs no code: the
  studio publishes it.
- **Known rough edges of the isometric view** (2026-11-12): the art under
  it is still the 16 px art, treated on its way up, so a figure is a classic
  figure with a 16-bit finish, not a redrawn one; dungeon rooms are wider
  than the screen, so the camera follows the hero instead of showing the
  whole room; furniture is flat cards; the eight keyboard directions are the
  eight world directions, so walking along a wall takes two keys. Not
  measured on a phone: the lab's GPU is software.
- **Looking at it.** `VIEW=iso node scripts/zelda-lab/shot.mjs <outDir>
  [scenes]` renders the isometric view, `VIEW=blyant` the pencil one;
  `FRAMES=18` stops halfway through the turn, `PARAMS='{"paper":"kull"}'`
  sets the engine's values and `TAG=kull` names the pictures. The page keeps
  `window.__lab` (`{ r, s, ui, world, step }`) for a script that wants to go
  on drawing. `scripts/zelda-lab/flora-sheet.mjs` and `backdrop-sheet.mjs`
  render the plants and the backdrop alone.

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
K/X/Shift = B (item); Q, or Tab when there is an item, swaps; P or an
Escape tap pauses (items, heart pieces, the current quest); on the pause
screen M turns the sound on or off, T goes to town and V turns to the next
view (see "Views"). Holding Escape saves and goes to town. Starting over
is the NEW GAME machine in Petter's house (see "Saves" below). Touch:
floating stick on the left 60 %; three round buttons with pictures and no
letters: A always (a sword), B (the chosen item) and swap (two arrows) once
there is an item, and the lines call them THE SWORD BUTTON, THE ITEM BUTTON
and THE SWAP BUTTON (`keys.ts`); on a phone lying on its side they sit lower and more side by side; a pause chip in the top-right corner (paused: RESUME, SOUND ON/OFF, VIEW, TO TOWN); any tap moves a dialog on (a thumb that lands on the stick's side and stays down is the stick once the lines close);
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

**Never resize an existing map.** Bombed walls and opened doors are save
flags keyed by tile index (`bomb:<map>:<idx>`, `door:<map>:<idx>`,
`engine/map.ts`), so a map whose width or height changes opens the wrong
tiles in every old save. New land goes in a new map behind a warp, the way
the Wildwood did.

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

**The hero's look** (the NEW LOOK stall, 2026-10-13). East of the fountain,
where the town's copy of the Keeper's hut stood until the one-world merge,
is a stall: a mirror, a stylist behind the counter and a mannequin that goes
through looks. A at the counter opens the mirror (`LookBooth.vue`, the
shell's `look` panel, opened like the login console's). Every part of the
hero is a row there: hair (short, long, ponytail, pigtails) and its colour,
what is on the head (headband, bow, nothing) and its colour, skin, shirt,
stripe, belt, what is worn below (trousers, shorts, skirt, dress) and its
colour, shoes. BOY is the hero as first drawn, GIRL the same hero with long
hair, a bow and a skirt, RANDOM rolls one, and MY FIGURE (only when a made
figure dresses the hero, see below) goes back to wearing that. The mirror
shows the real frames walking in three directions and holding a find up.
Nothing is worn before WEAR IT; NEVER MIND, Escape or a tap beside the box
leave the hero as they were.

- **The shape** (`render/heroFrames.ts`). The hero's 27 frames are no longer
  written out: `heroFrames(shape)` composes them from a head per direction
  for the hair style, what is worn on the head drawn over it, a torso and the
  legs for what is worn below. Hair that falls past the chin is laid over the
  finished frame; the frames that redraw arms or legs (attack, carry, push,
  hurt, the find held up) take the shape into account one by one. A dress is
  the skirt's cut in the shirt's colour. `DRAWN_SHAPE` gives the hero as
  first drawn, and `tests/zelda-look.test.mjs` holds those frames to
  `tests/zelda-hero-drawn.json` pixel for pixel: change a drawn frame on
  purpose and that file changes with it.
- **The colours** (`render/heroLook.ts`). A `HeroLook` is the shape and eight
  colours; `lookPalette` maps them onto the hero's palette letters (listed in
  `render/heroColors.ts`). A colour left at the drawn one keeps the drawn
  shade beside it, any other gets its shade mixed from it, so a choice can
  never get a shade that does not belong to it. `LOOK_OPTIONS` is the list
  the booth shows (curated names, no free colour picker); a new hair style
  or garment is a new entry in `heroFrames.ts` and one name there.
- **Where it is kept.** localStorage `zelda.heroLook` (the look, and under
  `over` the made figure's colours it was chosen over), on this browser only:
  it does not follow the account to another device (the save and the bits
  do). `render/sheet.ts` `setHeroLook` swaps the rows and the palette of the
  `hero_*` canvases and nothing else. Another account signing in on the
  browser clears it with the other local copies.
- **Looking at it.** `node scripts/zelda-lab/hero-sheet.mjs <out.png>
  [look …]` draws every frame of some looks without a browser;
  `HERO_LOOK=girl node scripts/zelda-lab/shot.mjs <dir> r-look` renders the
  stall with a dressed hero; `scripts/zelda-lab/look-shot.mjs <devUrl>
  <outDir>` opens the mirror in the dev server on a desktop and a phone and
  checks WEAR IT, NEVER MIND and Escape.

**A made figure's clothes** (2026-09-26). With no look chosen at the stall,
the hero wears a made figure's colours: when localStorage
`figur.heroColors` holds Lag Din Figur's active figure, or else
`miniworld.heroColors` the active Mini World person's colours (both
`HeroColors`; the figure wins, Petter's call), `render/heroColors.ts` maps
them onto the hero's palette letters (hair, headband, skin, shirt and its
stripe, belt, trousers; shoes are `E` and the open mouth `M`, so they
recolour apart from the white and pink they share) and `setHeroColors` in
`render/sheet.ts` rebuilds only the `hero_*` canvases. The newest choice is
worn (`wornLook` in `render/heroLook.ts`): a look from the stall, until the
figure is changed or made after it; then the figure's colours again, and the
shell forgets the look. The stall's MY FIGURE does the same by hand. Both are
re-read on the `storage` event and when the tab comes back. Neither: the hero
as drawn.
`HERO_COLORS='<json>' node scripts/zelda-lab/shot.mjs <dir> r-sword`
renders a hero in a figure's colours.

**Live art from the studio** (2026-10-20). Sprites can be redrawn at
studio.phareim.no (repo `phareim/studio-web`) and published without a deploy.
- **What the studio edits.** `scripts/export-sprites.mjs` runs first in
  `npm run build` and writes `public/studio/neon-shrine.json` (gitignored):
  the palette and every sprite in `SPRITES` as rows, plus the commit. The
  studio fetches it from the live site, so it always edits against what is
  deployed.
- **How the game takes it.** `render/live.ts` (`startLiveSprites`, called first
  in `Zelda.vue`'s `onMounted`) applies the copy kept in localStorage
  `studio.live.neon-shrine` before the first frame. It then asks
  `https://studio.phareim.no/live/neon-shrine.json` (public, no cookie, 4 s
  timeout), and again when the page comes back to the foreground, at most once
  a minute. The rows go through `setSpriteOverrides()` in `render/sheet.ts`,
  the one place sprites are built: registry names at their drawn size only,
  and only the changed names' canvases are rebuilt. The deck's button icons
  are made again when new art arrives. Any failure keeps the drawn art.
- **Drafts in the game.** `?sprites=draft` asks the studio for the unpublished
  drafts with the Reader cookie instead (only Petter gets them), and never
  keeps that copy.
- **Added frames** (2026-10-20). The studio may give an animation more frames
  than were drawn (`blob_2` after `blob_0`, `blob_1`; up to 8). The renderer
  steps through `frameCount(prefix, own)` from `render/sheet.ts` instead of a
  fixed `% 2`: the foes, the folk and beach people, the bomb, the disc, the
  poof and boom effects, the campfire and the tank. An added frame needs the
  size of the animation's frame 0 and an unbroken run; anything else is
  skipped. Each frame plays as long as before, so the loop gets longer (the
  effects' lifetime grows with their frames). Poses that hold one frame (a
  blob's hop, a bat at rest, a knight's charge speed) keep theirs. The studio
  lists the animations that may grow in its adapter (`packs/neonShrine.ts`
  `grow`); a call site added here needs a line there too.
- **What it does not reach.** The hero's frames while a look or a made figure
  is worn: those come from `heroFrames()` (the studio keeps the hero
  read-only). Canvases other modules build from sprites and cache themselves.
  Other new sprite names: the renderer chooses names in code.
- **Checks.** `tests/zelda-live.test.mjs` (in `test:zelda`): the format check,
  the size rule, the kept copy before the fetch, draft mode, a dead studio.

**Exits.** An `exit` marker (`ExitDef` in `types.ts`) is a way out of the
game: walk onto a door exit, or press A at a solid one and read its lines,
and the door fade runs; at full dark the engine emits `{ type: 'exit', id,
to }` and stays in mode `exit`. All exits are in the town (cabinets, board,
HANGAR door, kiosk, DJ booths, terminals); the shell saves and navigates.

**Checks.** `npm run test:zelda` (run by the deploy; 114 tests with the audio,
Wildwood, wallet, views and look suites, green 2026-10-13; the Wildwood's own checks are in
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
