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

**Views** (2026-10-07; engines and values 2026-11-11). The game can
be shown in more than one way, and the player can change it in the middle of
a room. The state, the engine and the world are the same; a view is only how
a frame is drawn. A view is a drawing **engine** with a name and its own
values. `viewParams.ts` (pure) lists the engines and what can be turned on
each (`ENGINES`: numbers with bounds, colours, choices, toggles): `classic`
(the picture described under "Look" in `themes/zelda/DESIGN.md`), `iso`, an
isometric one (a third, `poly`, is archived: below). `views.ts` holds the round: one
built-in view per engine (CLASSIC, ISOMETRIC: named for their picture, with no tag of bits under the name since 2026-11-24; a built-in view may carry values, and the studio's lie over them), and whatever the studio published (below). Some values keep `16-bit` as a value name (`sound`, `windows`): the studio's saved values use them. A stored or published view that names an engine the game no longer has (`zelda.view` = `poly`, `/?view=poly`, a live view with `engine: 'poly'`) is dropped, and the visit starts in the first view. **A visit starts in the
isometric view** (`DEFAULT_VIEW` in `views.ts`), and the turn switch
in the corner turns to the next (V goes classic → isometric → classic). A view the visitor turns to is kept in localStorage
`zelda.view` and is where their next visit starts; the view a visit merely
starts in is not written, so a browser that never chose follows the site's
first view, and one failed fetch of a view's code does not pin it to the
classic picture. `/?view=<id>` asks for one.

- **Finding them.** The **turn switch** (`render/turnSwitch.ts`, drawn into
  a button of `Zelda.vue`) stands in the top-right corner, beside the pause
  chip and under the corner map (see "The map"): `[ carriage ]`, with a notch for each view (a studio view whose tag is `N-BIT` puts its numeral at its end of a two-stop slot). A press turns to the next view, as V
  does. The carriage carries one ground tile, drawn with the picture's own
  `projection`: a square in the classic view, the 2:1 diamond in the turned
  one. Where the carriage stands, the tile's shape and the seam between the
  switch's two dresses are functions of the renderer's `k`, read once a
  frame (`stepTurnSwitch`), so the switch turns with the world and a second
  press in the middle of a turn takes both back in the same frame. When the
  turn has seated, the view's name stands under the switch for a moment. A
  view that is waited for longer than 150 ms shows as three dots counting
  toward its end; a view whose code did not arrive as a bump and NO SIGNAL
  (a press is kept as this browser's choice once its view can be shown).
  For a browser that has never chosen a view the carriage ticks toward the
  other end once, 1.2 s after the first picture, and once more 6 s later
  (not where the view had to be waited for and turned in: the switch has
  been seen at work). The switch steps away
  (by class, never `v-if`) while the game is paused, a dialog or a panel is
  open, or the hero is on the way out of a map, and takes a change made
  meanwhile in silence. With three views or more the slot has a notch for
  each and no numerals, and the name carries the view's place in the round.
  - *Keys and focus.* A pointer press never leaves focus on the switch.
    Reached by Tab, it owns Enter, Space and Tab only: `data-game-keys`
    makes `input.ts` hand every other key back to the game and blur it, so
    arrows walk and V turns at once. (Tab is the swap key once the hero has
    an item; the switch is then reached by V and a screen reader's own
    navigation.) Its name says which view is on and which a press gives, and
    a live region says the view after every change.
  - *What changes dress beside the canvas* (the pause chip, the corner map, the pad icons,
    the page's hint) fades out before the flip at k = 0.5 and in after it
    (`--zelda-chrome-a`), as the canvas HUD cross-fades between its skins.
  - V turns to the next view in play and on the pause screen alike (the
    pause screen names the one that is on), and on touch the MAP page's
    buttons have VIEW beside RESUME, ITEMS and CORNER MAP. The page's first hint names
    no view key. In the world itself there is the **viewfinder** east of the
    fountain (exit `view`, look `scope`, panel `view`, which opens nothing):
    A turns to the next view. The **view strip** (`drawViewStrip` in
    `hud.ts`) is the studio's stage's only; the portal does not raise it.
  - `node scripts/zelda-lab/turn-sheet.mjs <outDir>` draws every state of
    the switch.
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

- **The classic view's shadows** (`render/shade.ts`, 2026-11-18): the
  isometric view's shadows, flat and in hard pixels. Outdoors the low sun
  sweeps the footprint of every mass (the heights of `iso/shape.ts`, the
  same ones the isometric view marches through) along the ground, drawn once
  per map; what stands or walks throws a blob away from whatever lights it
  most, long when lit from one side, so it swings round as the hero passes a
  lamp. One mask, multiplied onto the light map's ambient colour before the
  lamps are added, so a lamp shines into a shadow; a mass's own picture
  takes none. Values on the `classic` engine: `sunAngle`, `shadowLength`,
  `shadow` (0 turns them off), `shadowColor`. The isometric view still
  fades its own shadows in over the turn, so they are gone for a moment at
  the cut from the classic picture.
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
- **The turn** (`render/turn.ts`, pure; `TURN_S` and `HANDOFF` in
  `renderer.ts`). A turn takes 0.7 s at 60 frames a second. Its first tenth
  is the **hand-off**:
  nothing turns yet, the view draws at the classic geometry (`camera.ts`
  has it to the pixel; a test holds it), and the classic picture is laid
  over it, less each frame, because the two light the same scene
  differently (the view's glow lies on the ground, the classic one hangs on
  the screen). After that `k` runs from 0 to 1 and the view turns itself
  in; going back it turns out, and the hand-off is the last tenth. The
  `k` a view draws with, and the one `viewState()` reports, is 0 through
  the hand-off. Nothing in a turn appears in one frame: plants grow out of
  the ground while the classic tiles they replace sink (k 0.15 to 0.75),
  the standing things do the same at the end (k 0.8 to 1, with what lies
  on a counter going up with it), a cabinet's body grows back from its
  front, the HUD's two skins cross-fade (k 0.3 to 0.7), the colours thin
  from eight bits to five (k 0.2 to 0.8), and the smoothed half-steps of
  the art come in over k 0.125 to 0.375. **A long frame does not cut the
  hand-off** (`turnTime`): a picture's first frame is a long one, and the
  first frames of a turn are such frames, so in the hand-off a frame
  counts as a steady one (1/60 s) at most and, on the way out, in the
  stretch a long frame would cross to reach it, as two (1/30 s) at most,
  and the last step before the hand-off lands no deeper in it than a
  steady frame would. The hand-off is
  therefore four frames or more at any frame rate, and a turn is longer where frames are (0.8 s at
  30 a second, about 1 s at 20). A turn's first two frames are steady ones
  too (`createTurnClock`): the press that began it may have done long work
  of its own (the first key of a visit starts the sound). A press in the
  middle of a turn begins one as well, and gets its two steady frames. The classic
  picture a map has not had yet is painted in the second frame of the turn
  out, not at the hand-off.
  **A view that cannot draw yet** (its code has just arrived, its shaders
  compile, its pictures are being painted: `View.ready`) is waited for at
  k = 0, on the classic picture, and turns in when it can
  (`turn.step(dt, ready)`); there is no dark screen in the middle of a
  switch. While it waits on the classic picture the view also paints what
  its first frame on this map needs (the map's two tile pictures, the
  plants: `prepare` in `iso/view.ts`), a piece a frame, so that frame is
  not a halt in the turn. (The canvas fallback, `iso/legacy.ts`, is waited
  for only until its code is here (`legacyView`), and paints nothing while
  it waits: it paints the map in its first frame and casts the map's
  shadows in its second, both under the classic picture in the hand-off,
  not in the frame the shadows first show.) Without a turn (reduced motion, a pause, a panel,
  the ending) it takes over in the frame it is ready, and the dress and the
  switch follow in that same frame (`drawFrame`); under a panel or the
  ending, where the world is drawn five times a second, the picture is
  drawn in that frame too.
  **A visit that starts in the isometric view** stays dark for at most
  450 ms from the first frame the tab is looked at (`renderer.arrive`), and
  its first picture comes up out of the dark over 320 ms (`dawn`); a device
  or a network that needs longer gets the classic picture up first, and the
  view turns in from it. In the dark only the view itself is waited for
  (its code, shaders and own pictures): its first frame is drawn under the
  dark and may be long, so the map's pictures are not waited for there.
  **A view that throws** (in `ready` or in `draw`) is put away and the
  classic view draws on; `viewState().failed` counts them, and the shell
  follows to the classic view in the same frame, with a bump and NO SIGNAL
  (`viewFailed`); one that throws on its way out ends the turn there, and
  that is no refusal. A
  later press makes the view again; once a view has failed three times
  while it was the one shown, a press for it is refused for the rest of
  the visit. `View.turn` is how far the picture is rotated
  at k = 1; the shell turns the stick by the same angle (`turnMove`), so up
  on the stick is up on the screen in every view. A dialog gets the stick
  unturned: there a direction picks YES or NO by its sign. Reduced motion, a
  paused game and an open panel switch at once, and a pause in the middle of
  a turn finishes it.
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
     walks, and what stands alone, throws a blob (a firm core, a short soft
     rim) away from whatever lights it most (the sun outdoors, the nearest
     lamps anywhere), so a shadow swings round as the hero passes a lamp. A
     thing with a body (a stall, a cabinet) throws one as wide as the side
     it turns to the light. On the ground it lies on, a blob takes the
     sun's own light and over half of the lamps' as well as the sky's:
     with less it is lit out of sight, as it was.
  3. *Lit*: the G-buffer shaded. A surface takes a lamp's light by how it
     faces it, per colour, so a figure between a pink and a cyan lamp has a
     pink side and a cyan side; on figures the light falls in steps, the way
     a pixel artist shades. Outdoors the low sun has a light of its own (below)
     and adds side shading, long
     shadows (marched through the tile heights, with a dithered edge), a warm
     rim, drifting cloud shadows; corner shade where a wall meets the floor;
     and a little of every lamp's light hangs in the air over the ground it
     falls on (the classic view's glow, lying down; what stands well above
     the ground is out of it). Whoever stands with the sun or a lamp behind
     them has a line of light down that side (the geometry pass marks a
     card's outermost px).
  4. *Composite*: water (crests running across the screen, the dusk lying
     on it, what stands by it mirrored from the picture itself, lamps
     glittering on the crests, foam where it meets land), wet pavement and
     polished floors that show the lamps and signs above them as streaks,
     haze in bands, low
     mist and shafts of the sun in the Wildwood, a mood's colour cast, the
     effects layer (shots, sparks, dust, leaves, the flash) at full
     brightness, and every colour the screen has (value `colors`; `15-bit`
     brings back five bits a channel with an ordered dither between them).
  5. *Bloom and the finish* at the screen's own resolution: the whole-number
     upscale, the glow, vignette, scanlines if a view asks for them, and the
     machine's own tricks: a door is a mosaic on the way out and in, death
     closes an iris on the hero, the Other Side waves down its scanlines.
- **Its own picture, not the classic one turned** (2026-11-21). Five
  things the classic view does not have, each a value the studio can turn
  down to nothing:
  - *The sun's own light* (`sunLight`, `sunStrength`; `LIT_FS`). The classic
    view lights everything outdoors with one colour. Here what faces the low
    sun and stands in no shade takes the sun's warm light on top (a little
    of it comes back off any colour, so a lawn in the sun is gold on top and
    not grey), what the sun does not reach is lit by the sky, cooler and
    dimmer (`skyFill` in `view.ts`), and while the sun is up the lamps are
    only just lit (`lampGain`). By day the sun whitens as it climbs; at
    night it is the moon's, faint and blue; in the blue hours, when nothing
    throws a shadow, there is none.
  - *Materials* (`materials`; `iso/materials.ts`, pure). The classic ground
    is a flat colour with marks on it, and smoothing it makes a smoother
    flat colour. Here every kind of ground is painted at the view's own
    density, 32 texels to the tile, repeating every four tiles, with a ramp
    of its own and a height the light catches: `grass` (three greens,
    blades, a blossom now and then), `cobbles`, `sand` (combed by the wind),
    `flags` and `boards` (the Shrine's and a room's floor), `moss` and
    `lane` (the Wildwood's lawn and paths). What stands has them too:
    `shingles` on a roof, `siding` on a house's wall, `rockface` in a
    cliff's face (with turf on its top), `bricks` and `blocks` in the
    Shrine's walls, `panel` and `slab` indoors, `plates` and `steel` in
    the labs. The tile data's alpha says
    which material a tile's ground is (`groundKindOf` in `tiles.ts`, which
    follows `paintBase` case for case; a test holds the two together); a
    roof or a wall carries its material in its quads' meta (picture + 8 ×
    material). A px takes the material only where the classic art has that
    ground's own colours (`fits` / `fitsBuilt` in the shaders), so a rug, a
    door, a window, a sign and every neon line stay the classic art's.
    Where two grounds meet the border wanders and frays a texel at a time
    instead of stepping, and the lawn the classic art rings a lamp on the
    square with is paving. Open water is one deep colour without the
    classic grid. At k = 1 every scene px is exactly one texel (the ground
    is read half a texel south of the grid: `texelAt` in `materials.ts` is
    the same rule, tested), and the scene shows a row's texels in pairs, so
    a material's slope is read across the scene's own px (`matSlope`) and a
    mark that runs across the screen is painted through `pairU`; read any
    other way, a line one texel wide comes out dotted.
    `node scripts/zelda-lab/materials-sheet.mjs <outDir>` draws them all.
  - *Standing things in the round* (`props`; `iso/props.ts`, pure). Lamp
    posts, graves, pots, rocks, boulders, signposts, pillars, bar stools, counters, chests (shut and open), the Shrine's crystal blocks and fences are each built once
    as a few solids (boxes, posts, balls) and drawn the way the view sees
    the world, from the south-east and from above: a signboard runs away to
    the right, a gravestone has a side, a lantern has a lid and four panes
    that glow by themselves. They are pixel art by construction (flat steps
    of a ramp from an artist's light, a line round the lower right only, a
    step of shade under what stands in front) and carry a normal for every
    pixel, so the lamps and the sun light them like the figure (picture 4 in
    the geometry pass). `view.ts` stands one where the classic art has that
    card (`stand`); a brazier and everything not built or drawn for this view
    (*Things drawn by hand* below) is still the classic card. A counter is one part to the tile, each running
    to the tile's edge where the counter goes on, so a long one stands as
    one piece, and a fence is a post with rails out to wherever it goes on
    (sixteen parts, `fence0`–`fence15`), so one that runs north stands
    instead of lying on the ground as its card did; what the classic art puts on a counter's picture (a ware and
    its price) stands on its top at the front edge (`tops`). So that a long
    solid is not a card, every pixel says how far toward the viewer its
    surface lies from the sprite's anchor (the colour picture's alpha,
    `depthCode`), and these quads are drawn last with a program that writes
    that depth (`GEOM_DEEP_FS`, `FrameIn.deep`): a counter stands in the
    floor and behind whoever stands in front of it. Only they use that
    program, because one that writes its depth cannot be culled early. `node scripts/zelda-lab/props-sheet.mjs <outDir>`
    draws them all.
  - *Things drawn by hand* (`things`, on by default; `iso/things.ts`, `iso/thingArt.ts`; part 23,
    2026-11-25). The things of the world that were flat cards or drawn side-on are drawn in the round as
    hand-made pixel art, as the people are: the Horizon van, the tents, Luna's fort, the campfire, the
    beach bonfire, the bikes, the radio mast (its lamp lit in turn), the labs' specimen tanks (in the
    Wildwood and on the lab tiles `I`), the tiki torches on the beach (the flame leaning with the breeze in
    three frames), the DJ booths (a speaker each side, the table with the DJ's kit, the poles and the
    fairy lights, whose bulbs dim in turn; the DJ stays a figure, a card stood a little back along the line
    of sight so it is behind the table), the furniture (bookshelves, the sofa, the desk, the glass table,
    the potted plants, the screen machines `M` in a room, and the hut's two boxes as a bed and a table,
    `FURNISHED`), the labs' consoles, terminals and workbenches, and a fountain standing in the square's
    pool (`LANDMARKS`; the pool is still the square classic water). Each was built as a guide from a few
    solids seen exactly as this view sees the world, and Codex `image_gen` drew it over the guide at ten
    sheet px to a scene px; the drawing is cut at the grid it was drawn on and every colour is the
    drawing's (frames are drawn on one sheet or are pixel edits of one drawing). From the guide each px
    takes its normal (the lamps and the sun light it) and its depth (`depthCode`), so they are packed under
    the built things in the same atlas (`withThings`) and stood the same way (`stand`, `thing:<id>`): the
    van and the booths stand in the floor, the hero walks behind and in front of them. Where the classic
    painter queues an item the item names its pieces (`Item.things`, with `bare` for what stays a card,
    and `shade` for the blob shadow); furniture is found from the tiles (`furnitureAt`: a run of shelves,
    a sofa three long, a desk two long, a bench two at a time in a lab). A thing drawn from a classic
    sprite the studio has changed since is its classic card again (`src`, `thingFresh`). Off, every one is
    the classic card again, pixel for pixel. The job's tools, sheets and archive are in
    `tmp/iso-figures-23/` on the Mac (`REPORT.md`).
  - *Cabinets and booths with a body.* An item whose drawing is the front
    of a box says so (`Item.box` in `wild.ts`: the front's width and height
    in the drawing, and how deep the body is; the arcade's cabinets, the
    terminals, the login console, the newsstand and the stalls in
    `exits.ts`). The classic view ignores it. This view stands the drawing
    along the wall it faces, as it does a board on a wall, and closes a
    body behind it on top and to the east with a plain patch of the
    drawing's own edge, so a cabinet is a cabinet seen from the corner,
    its screen running away to the right, and not a card.
  - *Roofs that rise* (`roofPitch`). A house's roof is one plane rising
    from its eaves toward the back (kind 5 in the geometry), with a gable
    over its east wall, so what is painted on it stays whole. The sun's
    shadow of the house stays that of a flat roof.
- **Plants** (`flora.ts`). Trees, bushes, tall grass, flowers, reeds and
  tufts are painted at the hi-res size with normals of their own and stand as
  billboards where the classic tiles had them (a little off the grid), sway
  in the wind, part round the hero, and thin out between the viewer and the
  hero so nobody is lost in the woods. Cutting a bush or grass changes the
  tile, and the plant is gone with it.
- **The hero** (`hero.ts`, `figure.ts`). In this view the hero is drawn in the
  view's own isometric pixel art, as the people are (part 21, 2026-11-25; "The
  people" below, *The hero*), with value `figure: 'classic'` (the default; the
  name is the old one: it is the four-way hero of the classic painter, now in
  that art). It is the classic four-way sprite, smoothed, with `figures:
  'classic'`, for a shape not wholly drawn, and while the studio has redrawn it.
  Value `figure: 'modelled'` swaps it for a small figure built in the round (ellipsoids and capsules:
  head, hair, band, torso, arms, legs) and drawn in software every frame
  into a 160 × 96 px cell, a pixel to the scene's pixel, with a normal and a
  glow for every pixel (`renderFigure(pose, look)`; pure, no canvas). So it
  faces any way, and `heroPose` in `view.ts` turns the body toward where the
  hero is headed at a pace (15 rad/s, 40 into a swing): a change of
  direction is a turn, not a cut between four frames. The walk is a cycle
  of sixteen phases with the whole body in it; lift, carry, push, hurt, get,
  use, fall and dead are poses of the same figure. The blade is part of the
  figure: held in the hand, it sweeps the engine's own arc on the ground
  plane (so it lands where the hits do: 1.2 tiles for the sword, 1.4 for the
  Arc Blade, 1.55 in a spin), passes behind the body where it is behind it,
  and drags a crescent that fades in dithered steps; charged, it glows and
  sparks at the tip. It reads as pixel art because it is made as such: no
  soft edges, an outline in each part's own darkest shade, two or three
  baked steps a colour, eyes that are placed and turn with the head. The
  engine lights it from its normals in steps like any figure (picture 3 in
  the geometry pass; material 3). It wears the hero's look (`kit.heroLook()`:
  the booth's shape and colours, a made figure's colours, or the drawn
  hero), every hair, headwear and bottom. The classic painter still draws
  what the hero holds up (a pot, a found thing) and the blade's light
  (`kit.setHeroBare`). During the turn from another view the drawn hero stands
  until the turn is half done, then the modelled one. `node scripts/zelda-lab/figure-sheet.mjs <outDir>` draws
  the figure's sheets (every yaw, the walk, the acts, the swings, the looks,
  lit, and beside the classic frames) without a browser;
  `tests/zelda-figure.test.mjs` holds it to its cell, its projection and its
  looks.
- **The people** (`iso/folk.ts`, `iso/folkArt.ts`; parts 19 and 20, 2026-11-24).
  Everyone but the mistral is redrawn for this view
  as isometric pixel art (the hero since part 21, its own way: *The hero* below; the bosses since part 22,
  rotoscoped: *The bosses* below): two px of theirs to the classic px (a 16 × 16 sprite
  becomes about 20–34 × 17–35, the 24 × 24 knight about 38 × 48), chunky like
  the hero, an outline in each part's darkest shade, at most 24 colours a
  figure in the dusk-neon family (near-identical dark shades merged into one),
  shaded by form only, never from a side. The drawn families (32):
  - *town:* `keeper`, `vendor`, `kid`, `barmaid`, `guard`, `petter`, `robot`,
    `cat`, `ghost`;
  - *beach:* `hippie`, `smoker`, `guitar`, `sleeper`, `twirler`;
  - *Wildwood:* `luna` (her four-way walk, her two standing frames as a person
    in the camp, `luna_psi`), `mossa`, `dusty`, `toby`, `max`, `owl`;
  - *foes:* `blob`, `spitter`, `sentry`, `bat`, `dasher`, `zapper`, `skull`
    (with `skull_jump`), `eye`, `blade` (in no room yet), `knight`, and the
    labs' `hound` (four ways and `hound_open`) and `drone`.

  The bosses are `bossArt.ts`'s (part 22, *The bosses* below); only the
  `mistral` is still classic. A family
  carries one drawn three-quarter front (turned to the viewer's lower left)
  and, for a foe that walks four ways, one three-quarter back (turned to the
  upper left); mirroring gives the other two. The engine's four ways go
  through the view's 45°: south is the front, east the front mirrored, north
  the back mirrored, west the back. Townsfolk, whose classic sprite is one
  front mirrored for `left`, keep their front and its mirror. Every other
  frame is made from the drawing by pixel edits, never drawn again, and as
  small as the classic frame's own change (two to six px): a blink for the
  townsfolk and the cat (the vendor's two live frames are the same, so his are; the
  robot's antenna light goes from yellow to cyan), a bob for the beach folk, a
  step for the spitter, a squash for the blob, the other arm for the twirler.
  Part 20's: a blink (`mossa`, `dusty`, `toby`, `max`, the owl, the skull, Luna
  standing; the keeper's eyes were set by hand on whole px for it), the
  ghost's float (its pixels the same, its foot point two px lower or higher,
  as the classic frames shift), a step each way for walking (Luna's three
  walking frames, the sentry, the hound, the knight), the wings down for the
  bat, the flame's or the sparks' top mirrored for the dasher and the zapper,
  the rotors for the drone. The poses of their own are edits too: the
  skull's jaw drops for its jump, a pink-ringed eye opens on the hound for
  its tell, Luna shuts her eyes under a pink spark for her psi. They are
  keyed `front_<pose>` (`front_jump`, `front_open`, `front_psi`); a sprite of
  one picture (`eye`, `blade`) is its own family with `front_0`; Luna's
  standing frames are `idle_0`, `idle_1`, apart from her walk.
  The knight is a big foe, drawn in a big cell of the atlas: the figures'
  atlas covers all of it (part 20; it covered the small cells only).
  The townsfolk still have no back: the classic painter shows a person's front
  or its mirror whichever way they face (`n.dir === 'left'` only), so there is
  no turn away for the art to carry. The ghost is drawn opaque, as its classic
  sprite is: there is no translucency to carry yet (were it given an alpha,
  the router would carry it dithered, as any alpha).
  A larger edit (the whole head a px lower) measured as shimmer beside a
  standing figure; these do not (`steady.mjs` case `folk-still`).
  - *How it gets in.* The classic painter still draws every person into the
    atlas exactly as before; the view watches what it draws (`spriteTag` in
    `sheet.ts` names a sprite's canvas) and draws a sprite that has art into a
    second atlas at twice the size, cell for cell, with the same transform,
    alpha and clip (`folkRouter`). So whatever the painter does carries over
    by itself: the hurt flash is the art's own silhouette in white, a blink is
    a frame not drawn, a translucent figure is the same alpha (dithered), a
    hop is the same lift, and what is drawn round a figure (the smoker's
    smoke, a foe's tell, stunned stars) stays classic, on the same card, a
    hair in front. The art is picture 5 in the geometry pass: a texel to the
    scene px, no Scale2x and no blend of shades, round from its outline (read
    over twice the px), lit in steps like every figure (material 3), with the
    rim where light is behind it. It stands on the same foot point at the same
    size and throws the same blob.
  - *The studio's newest edit wins.* Each family records the hash of every
    classic sprite it was drawn from, as the game showed it with the live pack
    applied (`src`; the cat, for one, is the studio's three frames). If the
    rows the game draws now (`spriteRows`) differ, or the studio has added a
    frame the family lacks (`frameCount`), the whole family is its classic
    sprites again until it is redrawn: whole families, so an animation never
    steps between two kinds of drawing (`tests/zelda-folk.test.mjs`).
  - *The turn.* The figures go from classic to their art through the middle
    of the turn (`folkMix`: from k 0.35 to 0.65), the two crossing in
    complementary halves of the dither, about when the modelled hero takes
    over.
  - *Value* `figures`: `isometric` (the default) or `classic`, today's
    picture pixel for pixel.
  - *Format.* Palette letters, as the classic sprites are, in `folkArt.ts`,
    which only the isometric view's chunk imports
    (about 123 KB, 20 KB gzipped for the 32 families; the entry does not
    grow). How they were made (Codex image generation over a guide sheet of
    the classic sprites, cut by the green key at one pitch per sheet, cleaned
    and re-quantised by script, a few eyes and lights set by hand) is in the
    jobs' evidence on the Mac (`tmp/iso-figures/`, `tmp/iso-figures-20/`,
    whose `tools/` is the whole pipeline for all 32).
  - *The hero* (`iso/hero.ts`, `iso/heroArt.ts`; part 21, 2026-11-25; Petter:
    «tegn helten i samme stil som resten!»). The same art at the same density
    and proportions as the townsfolk (`kid` and `petter` were the guide's style
    references), the brightest figure on the screen, with what makes it the
    hero: the cyan jacket over the white stripe, the pink headband with its
    tails, the yellow buckle. Unlike a family it is composed and recoloured, as
    the classic hero is (`heroFrames`, `heroLook`):
    - *Roles, not colours.* Each px is one of the look's eight colours (skin,
      hair, what is on the head, shirt, stripe, belt, below the belt, shoes) at
      a slot: the role's outline (its darkest), then its shades, 2–4 a role, or
      a fixed colour (the eyes, the open mouth). One slot is the look's colour
      itself (`HERO_BASE`); every other is mixed from it toward the dark (for
      skin the rose `#5a1a3a` that `lookPalette` shades skin with) or toward
      white, by the amount the drawing has it (`HERO_MIX`, fitted to the
      drawing). A colour left at the drawn one keeps the drawing's own shades
      (`HERO_DRAWN`), so `DRAWN_LOOK` is the hero as drawn, as in `lookPalette`.
      A dress is the skirt in the shirt's colours.
    - *Composed.* A frame is a body (torso and legs, per pose and facing and
      what is worn below), the head (hair and what is on it) set on the body's
      neck point, the hair that falls past the chin laid over the torso, and
      raised arms (carry, get) over that. The parts are drawn once: four hair
      styles with the band, the short hair bare and with the bow; the bow is
      set on the other bare heads, and a bare head is the band's px as hair,
      slot for slot (the short hair's flying tails go with the band, so its
      bare head is a drawing of its own). Shorts are the trousers with the
      lower leg as skin; the skirt is a drawn piece over bare legs, with a hem
      and pleats in shade. `heroArtCovers(shape)` says whether every part of a
      shape is there; one that is not is the classic hero, every frame of it,
      never a drawn head on classic legs. All 48 shapes are covered.
    - *Frames.* Front and back for standing, the walk, the swing, carrying (two)
      and pushing, mirrored for the other two facings and mapped from the
      classic sprite's name as the folk's are (south the front, east the front
      mirrored, north the back mirrored, west the back); the classic side
      frames are not needed. The walk's two steps are pixel edits of standing
      (one leg lifted two px under the jacket's hem, the other hand swung two px
      forward); the second carrying frame is the step's legs. Facing the viewer
      only: holding up a find (the arms up, the mouth open), hurt (the arms
      flung out, the eyes squeezed to lines), the three falling frames (the
      standing front shrunk as the classic shrinks it) and lying (it turned on
      its side as the classic is).
    - *How it gets in.* Through the folk's router, unless the modelled hero is
      drawn: everything the classic painter does round the hero carries over (a
      blink frame not drawn, the hurt flash as the art's silhouette, the shadow,
      what it holds up, the blade's light, the cross in a stipple at the turn
      with the folk). Seen through a wall, both cards are drawn every other px.
    - *The blades.* `sword_v`, `sword_h`, `sword_d` and the Arc Blade's
      `sword2_*` at twice their size (EPX, so a diagonal keeps one clean step;
      then a lit edge, a light line and the white core to a deep edge, the guard
      lit on top, the grip wrapped), in fixed colours. They land exactly where
      the classic ones do, so the swing and the hits are unchanged; the canvases
      `spriteT` mirrors upside down are tagged too (`flipV`), so the router knows
      them.
    - *The studio.* The studio can still redraw the classic hero: while its rows
      for a `hero_*` sprite are worn (no look from the booth), the hero is
      classic (`heroStudioEdited`).
    - *Made* by Codex image generation over three guide sheets of the classic
      frames (poses; the hair and the bow; get, hurt and the bottoms), cut as
      the folk were, then sorted into roles and parts by script
      (`tmp/iso-figures-21/tools/build.py` on the Mac); `tests/zelda-hero-art.test.mjs`
      holds the coverage, the recolouring and the fallback.
  - *The bosses* (`iso/bossArt.ts`; part 22, 2026-11-25; Petter: «Kjør på med
    rotoskopering, både av sjefer og greier rundt i verden. Viktig at vi holder
    oss i en ekte piksel-følelse.»). The king (and its shards), the troll, the gemini twins, the llama and the deepseek are drawn in the same art as the
    people, rotoscoped: each was built in 3D (the king and the twins from
    Blender primitives, the others a Pixal3D mesh of a Codex reference picture),
    posed for its classic frames (a bob, a tilt, a part moved, the eye or the
    mouth changed, the whirlwind turned) and rendered from this view's own
    angle (orthographic, the ground turned 45° and seen as a 2:1 diamond,
    height not foreshortened); then Codex drew every frame of the boss by hand
    on one sheet over that render, with the redrawn folk beside it as the style
    and the classic frames as the identity. The 3D model is only the guide: it
    never ships, and every px is the drawing's, cut at one pitch per sheet with
    a hard alpha. What makes each one readable is kept: the king's big pink
    eye, its crown with the yellow studs and its glitch streaks; the twins
    clearly cyan and clearly pink, the split mask and the gold stripe; the
    troll's moss, sprout, tusks and nose; the llama's pink harness and yellow
    tag; the deepseek's glowing cyan lure, its grin and its bite. The mistral is
    still the classic sprite (its reference and mesh are made; part 22 stopped
    before drawing it). The llama is drawn but held back (`BOSSES_HELD` in
    `folk.ts`), so the game shows its classic sprite: the drawing became a
    fluffy four-legged animal that reads as a dog or a squirrel, without the
    classic's upright stance and L badge, and parts of it are doubled px. It
    waits for a redraw at the 10 px guide that keeps the classic identity.
    - *Size.* Codex draws pixel art on a grid of its own, about 10 px of its
      1536-px sheet to a pixel whatever it is asked; a figure drawn smaller on
      the sheet comes out in 2 × 2 blocks once cut at the view's density (the
      first king and troll did; they were redrawn). So a boss is guided at 10
      px a pixel (the king one frame to a sheet, the troll's pair, the
      deepseek's two poses and fin) or at 5 where the figure is small enough
      that the drawing still lands on whole px (the twins, the llama), and every
      sheet is cut at the grid it was actually drawn on. A boss drawn in the
      round is about the classic's size in the world, not its shape: the troll is
      39 × 39 (the classic 22 × 24 doubled is 44 × 48), the llama's front 44 × 38,
      its back 35 × 51, the deepseek 58 × 41.
    - *Frames.* The king's second frame is its first with the pupil 2 px aside,
      the fists 2 px lower and the glitch streaks moved (a script's edit); its
      hurt frame is a Codex edit of the first (the stone flashing pale pink, the
      eye shut). The troll's blink is the first with only the eyes taken from
      the second drawing; the deepseek's second frame is its first a px higher.
      The twins' and the llama's steps are drawn on one sheet, placed by their
      best px match on the first.
    - *Colours.* Many: a family keeps the drawing's colours (64–110), merged only
      where they are one colour under the image's noise (none off by more than
      24 of 255). The letters run past the ASCII ones into Latin-1 (`À`…`ÿ`), still
      one character a px.
    - *How it gets in.* They are families as the folk are (`familyOf`,
      `facingOf`, `familyFresh`, the same router and big cells): the hurt flash
      is the art's silhouette, the king's tell line, its shards' lights and the
      twins' tether stay the classic painter's, the turn crosses them in the
      stipple with the folk, and the studio's newer edit of a boss's classic
      rows makes that boss classic again. They face the viewer as the classic
      ones do: `king_hurt` is `front_hurt`, and a pair drawn apart is keyed by
      the rest of its name (`gemini_b_1` is `front_b_1`). The troll is a figure
      like the townsfolk: one front, mirrored as the classic one is. The king's
      shards (`shard`) are a family of one picture, drawn on the king's sheet.
    - *Made* in `tmp/iso-figures-22/` on the Mac (`blender/`, `sheets/`,
      `tools/`: `guide.py`, Codex, `cut2.py`, `edit.py`, `build.py`, `emit.py`);
      `tests/zelda-boss-art.test.mjs` holds the families, the hashes, the
      facings and the identity colours.
  - *What the studio would need* to edit them: a second kind of entry in the
    pack (`folk`: a family's palette, frames as rows at twice the classic
    size, anchors, the `src` hashes), exported by `export-sprites.mjs` beside
    `SPRITES`; an editor showing a family's facings beside the classic frames
    they stand for, its canvas at the larger size with a palette of its own
    (24 colours, not `PAL`); on publish, the hashes of the classic rows as
    they are then (so a later edit of the classic sprite marks the art stale,
    as here); and `live.ts` handing the `folk` entry to `folk.ts` (a setter
    beside `setSpriteOverrides`, with the same checks of size and run).
- **Real-time combat** (`engine/hero.ts`, `engine/combat.ts`, the numbers in
  `types.ts`; field battles are their own, see `neon-shrine-battle.md`).
  - *Aim* (`aimOf`). The hero keeps the exact way the stick last pushed
    (`hero.aim`; on touch with the stick at rest, the way to the foe the
    blade turned to), so walking on a diagonal (every single key in the
    turned view) strikes along the diagonal. `dir`, the nearest of the four
    ways, is what everything else goes by; once something else turns the hero
    (a door, a talk) the old aim no longer counts. The stick is read afresh
    for every hit, and a stick that lands in a swing's first 0.05 s still
    turns it.
  - *The chain* (`COMBO`). Presses of A make three hits: two quick sweeps of
    162° (0.17 s, the second back the other way, `swing.side`), then a
    finisher of 207° (0.25 s, double damage, a hard shove, 0.2 s of rest
    after it). Each chain hit draws the blade back over its first 15 %
    (`WINDUP`, it cuts nothing there), then cuts fast and settles
    (`swingAngle`), and steps forward (`LUNGE_TIME` 0.07 s: 0.22 tiles,
    the finisher 0.5) unless a foe is already within half the reach ahead
    or a pit or spikes are, or the hero is on ice or about to step onto it
    (there the hit lands in place and only a slide moves him). A press within `COMBO_WINDOW` (0.32 s) of a
    hit's end goes on with the chain; later, it starts over. A swing outside
    the chain (a field battle's) has no `n` and is the plain 171° sweep of
    `SWING_TIME`; `swingDur(swing)` is either length.
  - *The buffer.* A press that cannot act yet (mid-swing, in a roll, while
    shoved) waits `BUFFER_A` (0.18 s) and starts the next hit as soon as it
    may: from 60 % into a chain hit (`CHAIN_CANCEL`, never cutting the
    finisher short), or when the blade is free. Only a fresh press talks,
    reads or opens; a waiting one only swings.
  - *Foes hit* (`hitEnemy`'s `HitOpts`). A chain hit shoves a small foe
    about half a tile, so the next one still reaches it, and its mercy is
    0.1 s instead of 0.28; the finisher throws it about two tiles (into a
    pit on a `MapDef.physics` map). A struck small foe reels (`stagger`:
    0.22 s from a chain hit, 0.4 from the finisher, 0.12 from anything
    else): it does nothing, and neither reeling nor being shoved does it
    harm the hero. A plain chain deals 1 + 1 + 2 (twice that with the Arc
    Blade). The finisher is critical (+1, `crit`) on a foe stunned (the
    disc, the hook) or reeling from some other blow (a pot, a bomb, the
    spin), not on one reeling only from the chain's own hits (`reelChain`).
    Bosses and the knight (`BIG`) neither reel nor stop harming.
  - *Hitstop* (the shell's freeze, none under reduced motion): chain hit 35
    ms, finisher 85, spin 55, any other hit 40, a boss hit 60, a kill 90,
    a boss's second phase 120, the hero hurt 70. A struck foe is solid white
    for its first 60 ms and shivers a pixel either way while the world is
    held (`FrameUI.hitStop`).
  - *The roll* (L or C, the roll pad; once the hero has the blade, so the
    town stays quiet). 2.2 tiles in 0.3 s the way the stick points (else the
    way the hero faces), slowing as it goes, a little steering; nothing
    harms the hero for its first 0.2 s (`ROLL_IFRAMES`); 0.15 s of rest
    after it. It may cut a swing from 35 % in, a press of it in the last
    moments of a shove waits, a pit still takes the hero. It never starts
    on ice, sliding or standing (`iceUnder`), and a roll onto ice ends at
    its edge, so the ice's lanes hold. A press of A in its last moments strikes as it ends.
  - *Moving.* Up to speed in about 0.07 s from a stand (`HERO_ACCEL`);
    turning keeps the pace and stopping is at once, so nothing slides past
    a ledge. The walk steps at 8.5 a second.
  - *What it looks like* (`render/renderer.ts`, so the classic view and
    both turned views have it alike). The blade's smear is a crescent of
    hard pixels over the arc just swept, on the circle the blade's sprite
    goes round the hand (white at the head, then cyan, gold for the Arc
    Blade, then a dithered tail); the finisher's is wider and stays 60 ms
    as a thinning rim, the spin's goes round. The hero squashes into a windup and stretches
    into the blow, crouches into a roll and leaves three cyan shapes of
    itself behind it; the backhand shows the swing frame mirrored. Foes
    squash flat under a blow and spring back; a fallen foe bursts white and
    flat along the blow before its poof. A blow throws sparks along it with
    a four-ray star and a ring (a heavy one a gold ring and a cut across);
    blows, kills, rolls, clanks, booms, chests and levers flash light on the
    ground (`ambient`); the blade lights the ground where it is in the world
    (not where the view turns its picture), with two lights trailing the
    sweep; the camera leans 2 px along a blow (more for the finisher and a
    kill; `Kit.nudge`, none under reduced motion); dust rises off a roll, a
    lunge and a run turned round. The chain's hits sound a step higher each,
    the finisher heavy (`sword`, `sword2`, `swordHeavy`; `hitHeavy`, `roll`).
  - *Art to come.* Until the roll is drawn, `hero_*_roll_0..3` are the
    standing frame tucked, turned a quarter forward, tucked smaller, turned
    a quarter back (`ROLL_TUCKS` in `heroFrames.ts`; never upside down, and
    mirrored for the left it still turns forward), and the isometric
    art makes the same of its own standing body (`ART_EXTRA_POSES` in
    `iso/hero.ts`: a pose the art does not draw yet falls back to a drawn
    one, so it never turns the hero classic). The lab's `swing1`, `swing2`,
    `swing3`, `roll`, `hit` and `kill` scenes show each moment.
- **The land beyond the edge** (`render/beyond.ts`, `iso/lands.ts`,
  2026-11-12). A turned map is a diamond, and outdoors the world goes on
  round it for 24 tiles (`BEYOND`), so the land is never a board on a table.
  `beyondTile` is the rule, pure: sea stays sea out to the horizon, a road
  that leaves the map runs straight on, rock behind the map (north and west
  of it, as the view sees the land) is a massif that rises in wooded steps
  up to three tiles (`massifHeight`), rock in front of it ends in a cliff
  with the sea under it (a tabletop there would stand between the viewer
  and the walking), and everything else is woods; the borders between them
  wander more the further out they lie. `lands.ts` paints it with the
  classic painters (`paintField` in `tiles.ts`) a block of 16 × 16 tiles at
  a time, the first time a block is seen, and keeps the 28 last seen. The
  map's own layers ask the same rule for a neighbour across the edge, so
  the last row is drawn for what lies next to it (the classic view never
  shows more than that row). The field the view works on (`outer`, the
  shapes, the tile data the light reads) is the map with that margin round
  it, and what lies outside the map sinks into the backdrop in dithered
  steps the further out it is (`uFar`). Value `beyond` turns it off: the
  map is then the board it was, with the backdrop round it. Interiors and
  dungeons have none; they stand in the dark as before.
- **The backdrop** (`backdrop.ts`). Where the land ends or fades is a dusk
  in layers that slide at different speeds: banded sky, stars, the striped
  sun, ridges, clouds, the sea.
- **Values** are engine `iso` in `viewParams.ts`, all the studio's to turn:
  smoothing, ground materials, standing things, roof pitch, relief, roundness, side light, lamp shadows, light in the air,
  the sun's direction and shadow length, shadow strength and colour, the
  sun's own light and its strength, corner
  shade, side shading, rim, haze, mist, sun shafts, sky colours, clouds,
  wind, standing plants, the modelled hero, the people in their own art (`figures`), things in the air, the land
  beyond the edge, the water's mirror, wet ground, 15-bit or
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
  in `view.ts`: first the costly extras go, then the pixels get larger and
  the materials go too); `pinQuality` holds it still for the lab.
  The materials and the standing things are painted a few milliseconds a
  frame while the shaders compile (`paint` in `view.ts`, `stepMaterials`,
  `stepProps`), so asking for the view does not stall the page; the lab
  paints them in one go.
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
  size), `HIRES_WINDOW_SKIN` (`hud16.ts`: the isometric view's, drawn at two px
  to the classic px, with its own proportional font `base/pixel/font16.ts`,
  banded SNES windows with a bevel, redrawn hearts and icons, a name plate
  on the dialog box). `kit.hudLayer(..., skin)`;
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
  paused, in every view. The classic view is untouched: without the
  class none of it applies.
- **Adding an engine.** A module whose default export is a `ViewFactory`, a
  loader in `ENGINE_LOADERS`, its values in `viewParams.ts`, a built-in view
  in `VIEWS`. An engine's code is fetched on the first turn to it and must
  stay out of the entry (`tests/zelda-views.test.mjs` checks that nothing
  imports `iso/view` statically). A view of an engine that exists needs no code: the
  studio publishes it.
- **Known rough edges of the isometric view** (2026-11-12; figures 2026-11-24): the art under
  it is still the 16 px art, treated on its way up, so the mistral is a classic figure with a 16-bit finish beside the redrawn
  people, hero and bosses (above); the bosses' crisp art shimmers a little more
  than the smoothed classic did as the king hovers (`steady.mjs` `king-stand`:
  1.40 against 1.20), and the deepseek and the troll are a little smaller than
  their classic sprites; the hero's walk steps and arm swings are generic
  edits, and its heads from the larger guide sheet (the bare short hair, the
  bow, get and hurt) are a px or two bigger than the rest; the townsfolk turn to
  no back, a figure the studio has changed since it was drawn is classic until
  it is redrawn, and the drawings have been cleaned by script and only touched
  by hand where something was lost (the robot's screen, the smoker's
  cigarette, the keeper's, the ghost's and the skull's eyes); the
  frames are generic edits (a blink, a step) where the classic ones do more
  (the drone's rotors, the bat's flap are near enough; the skull walks on
  two stubs the classic skull does not have); the modelled
  hero (off by default) stands out beside them, the studio's live sprites
  do not reach it, and its sword arm has no elbow and its tails no memory;
  dungeon rooms are wider
  than the screen, so the camera follows the hero instead of showing the
  whole room; furniture a room has in another length than was drawn (a sofa of one tile, a bench of
  three) and the pictures on the walls are still flat cards; the things drawn by hand (part 23) are a
  little off their classic size where Codex drew on a coarser or finer grid than the guide (the DJ tables
  and the hut's table smaller, the van and the speakers larger), the fountain stands in a square pool
  (round water would need the water pass changed), the booths' speakers no longer pump on the beat
  (the cone is drawn still), the desk's screen and lamp and the consoles' lights are drawn frames rather
  than the classic live pixels, and the art adds about 490 KB to the view’s lazy chunk (148 KB gzipped together); the built things (lamps,
  counters, chests: *Standing things in the round*) are crisp flat-stepped solids, which reads as pixel art
  beside the drawn things but plainer; the eight keyboard directions are the
  eight world directions, so walking along a wall takes two keys. Not
  measured on a phone: the lab's GPU is software.
- **Looking at it.** `VIEW=iso node scripts/zelda-lab/shot.mjs <outDir>
  [scenes]` renders the isometric view (`LIVE=<pack.json>` applies the
  studio's live sprites first, as the site does; `DAY=sun` a solved save's
  hour; `r-cast` stands the redrawn people in rows on the square, `r-foes`
  and `r-foehit` a blob and spitters by the hero, mid-hit in the second);
  `FRAMES=23` stops halfway through the turn (42 frames, the first four the hand-off), `PARAMS='{"bloom":0.5}'`
  sets the engine's values and `TAG=dim` names the pictures. The page keeps
  `window.__lab` (`{ r, s, ui, world, step }`) for a script that wants to go
  on drawing. `scripts/zelda-lab/flora-sheet.mjs`, `materials-sheet.mjs`, `props-sheet.mjs` and `backdrop-sheet.mjs`
  render the plants, the materials, the standing things and the backdrop alone.
  `scripts/zelda-lab/steady.mjs <outDir> <cases> [--views] [--day dusk|sun|noon|night|dawn] [--size 1280|390]`
  measures steadiness; `transit.mjs <outDir> round|pairs|hard|control` the turns between the views;
  `walk-flicker.mjs` and `page-flicker.mjs` the walk's and the page's flicker; `throttle.mjs` a view on a slow phone.

**The polygon engine** (engine `poly`: the POLYGON view and its second look, THIRD PERSON, parked since 2026-11-24)
was archived on the branch `parked/polygon-engine` on 2026-11-25 and removed from master.

**Day and night** (after the Sun Prism). Until the prism is home the sun
hangs on the horizon and `GameState.daytime` is null. Taking it starts a
12-minute day at that same dusk (the first frame after the win is the
dusk before it, to the pixel), so the first thing the sun does is set.
The day is mostly dusk and dawn: dusk 0–170 s (blue hour from 100), night
170–290, the blue morning and dawn 290–480, noon 520–640 and the golden
afternoon back to dusk at 720 (`DAY` in `engine/day.ts`). It runs only in
play, is saved as `day` (old saves of a winner start at dusk) and covers
every outdoor map; interiors and dungeons keep their own light.

- **The light** (`render/daylight.ts`, pure). A view's own values stay the
  dusk, and the studio turns them as before; the other hours are keyframes
  laid over them. The sun rises in the east, stands in the south at noon and
  sets at the view's own `sunAngle`; shadows grow long at dawn and dusk and
  short at noon; at night the moon throws faint ones along the same path,
  and the two hand over in the blue hours, when nothing throws a shadow, so
  shadows never swing round in sight. The light outdoors and the sky blend
  the view's dusk with its night, dawn and noon colours, the haze follows
  the horizon, and by day the lit picture is brightened past the art
  (`noonBright`: the art is painted for the dusk). The isometric view keeps its
  backdrop painted in the dusk and grades it in the shader (`skyGrade`), so
  no hour repaints it; its sun sinks under the horizon at nightfall, rises
  at dawn and fades out towards noon, and the stars go out by day. Fireflies
  thicken at night and are gone at noon; the sun's glitter on Mirror Lake
  shows at dusk and dawn. The classic view casts the sun's shadows only
  round the view while the sun moves (`shade.ts`, `moving`; a whole map is
  about 25 ms) and turns them in steps of 3°.
- **Values** (both engines, the iso view's under "Day and night"):
  `daytime` (`cycle`, or hold the light at `dusk`, `night`, `dawn`, `noon`
  for trying a look; it holds the light only, not the woods), `nightLight`,
  `dawnLight`, `noonLight`, `noonBright`, and on the iso view the top and
  horizon of the night, dawn and noon skies.
- **The woods by the hour** (`engine/day.ts`). At dusk and dawn the woods
  hold the foes placed in them, at midnight about twice as many (each
  placed foe gets a night twin a tile or two off), and the two noon minutes
  none (`foeLevel`). Each foe has its own point on that level (`rank`, from
  a hash of where it stands: no randomness is drawn, so seeded runs stay
  the same), so they come and go one at a time. None appears in sight: a
  foe whose home is on screen walks in from past the screen's edge
  (`trek`, `wayOut`), turning to fight when the hero comes within 3.5
  tiles, and one that leaves in view walks out of it. The shell tells the
  engine what the screen shows (`GameState.sight`: the classic view's
  rectangle, or the turned view's diamond of ground round the hero). A foe killed stays down until it has left for the day; next
  evening it comes back fresh. Only outdoor maps and only placed foes: the
  town has none, dungeons, bosses and key carriers are untouched.
- **Trying it.** `/?daytime=dusk|night|dawn|noon|<seconds>` starts the
  clock at that hour (light and woods): after the prism, and before it only
  in development. Lab and live checks used `scripts/zelda-lab/cdp.mjs` on the
  dev server with `__zelda.state.daytime` set by hand. In the lab,
  `PARAMS='{"daytime":"noon"}'` holds the light. `tests/zelda-day.test.mjs`
  covers the clock, its save, the woods by the hour and the light.

**How it starts.** A visitor stands on the plaza with nothing. Walking
into Home Glade without the blade, the Keeper tells the story once (the
area's `intro`, flag `intro`); the blade's chest is beside the hut door.
Before the blade there is no HUD, no swing, no B buzz, and the play clock
(`state.elapsed`) stands still; it starts with the blade. `createGame(world,
{ save, at })` puts the hero at `at` (the plaza, or in front of the exit
last used) with the save's items; a save's own continue point only matters
for death during a session.

**The map** (`render/worldMap.ts`, `engine/explore.ts`, 2026-11-25). Every
map but the rooms indoors is cut into squares of 8 × 8 tiles, and a square
is seen once the hero has been within 10 tiles of it; a dungeon room is seen
whole on walking in. What is seen is kept per map as a string of six-bit
digits, one bit a square (`SaveData.explored`, at most 200 maps; the whole
frontier with its caves is about 2 KB). The map shows only that, as a plan
in a few flat colours (floor, road, sand, water, ice, trees, walls, houses,
pits; doors and stairs lit), and it turns with the world: north up in the
classic view, a diamond lying as the ground does in the isometric one
(`projection(turn)`), so up the screen is up the map. Two of it:

- **The corner map**: a window round the hero in the top-right corner, in
  the view's own dress (its panel, the HUD's pixel), the hero a blinking
  mark with a pixel the way they face; its dress changes with the canvas
  HUD's, half way through a turn. Not indoors, not in a field battle.
  A press opens the MAP page, as M does. C on the MAP page (or its button
  on touch) turns it off and on, kept in localStorage `zelda.cornerMap`.
- **The MAP page** of the menu (M): the name of the place, what has been
  seen of the map fitted to the panel, the names of the areas seen, and out
  in the frontier its regions beside it (walked into lit, the Landing in the
  prize colour, here in the hot one). The menu's two pages stand as tabs
  over it: `P ITEMS` and `M MAP`.

The corner is one cluster: the pause chip and the turn switch, and under
them, right edges in line, the map (it comes and goes with nothing under it
to move, so the chip stays put), sized in the HUD's fine pixel
(`--zelda-turn-u`). All three hand the game its keys back once reached by
Tab (`data-game-keys`). It steps away while the menu, a dialog, a panel or a way
out has the screen.

**Controls.** Keys: arrows/WASD move; Space/J/Z/Enter = A (sword, talk,
open, lift, throw, use an exit; pressed again, the next hit of the chain;
hold after a swing, release to spin); K/X/Shift = B (item); L or C rolls
(once the hero has the blade); Q, or Tab when there is an item, swaps; P or an
Escape tap pauses on the menu's ITEMS page (items, heart pieces, the
current quest), M on its MAP page (see "The map"); the key of the open page
or Escape closes it, the other key turns the page. In the menu O turns the
sound on or off, T goes to town, C (on the MAP page) the corner map; V
turns to the next view anywhere (see "Views"). Holding Escape saves and
goes to town. Starting over
is the NEW GAME machine in Petter's house (see "Saves" below). Touch:
floating stick on the left 60 %; round buttons with pictures and no
letters: A always (a sword), the roll (the hero curled up, a small green
ring over B, beside A while there is no item) once there is the blade, B
(the chosen item) and swap (two arrows) once there is an item, and the
lines call them THE SWORD BUTTON, THE ROLL BUTTON, THE ITEM BUTTON and THE
SWAP BUTTON (`keys.ts`, `{ROLL}` in a line: the blade's own lines name
the chain and the roll); on a phone lying on its side
they sit lower and more side by side, the roll a size smaller over B, so
the row stays out of the stick's 60 %; the top-right corner holds the corner map, the pause chip and the turn switch (paused, the deck holds the menu's buttons, four to a page: RESUME and the other page; on ITEMS SOUND ON/OFF and TO TOWN; on MAP CORNER MAP ON/OFF and VIEW); any tap moves a dialog on (a thumb that lands on the stick's side and stays down is the stick once the lines close);
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
