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
isometric one, and `poly`, a polygon one (below). `views.ts` holds the round: one
built-in view per engine (CLASSIC · 8-BIT, ISOMETRIC · 16-BIT, POLYGON · 32-BIT) and a second look of the polygon engine with values of its own (THIRD PERSON · 64-BIT; a built-in view may carry values, and the studio's lie over them), and whatever the studio published (below). **A visit starts in the
isometric 16-bit view** (`DEFAULT_VIEW` in `views.ts`), and the turn switch
in the corner turns to the next (V goes classic → isometric → polygon → third person → classic). A view the visitor turns to is kept in localStorage
`zelda.view` and is where their next visit starts; the view a visit merely
starts in is not written, so a browser that never chose follows the site's
first view, and one failed fetch of a view's code does not pin it to the
classic picture. `/?view=<id>` asks for one.

- **Finding them.** The **turn switch** (`render/turnSwitch.ts`, drawn into
  a button of `Zelda.vue`) stands in the top-right corner, under the pause
  chip on touch: `8 [ carriage ] 16`. A press turns to the next view, as V
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
  - *What changes dress beside the canvas* (the pause chip, the pad icons,
    the page's hint) fades out before the flip at k = 0.5 and in after it
    (`--zelda-chrome-a`), as the canvas HUD cross-fades between its skins.
  - V turns to the next view in play and on the pause screen alike (the
    pause screen names the one that is on), and on touch the pause buttons
    have VIEW beside RESUME, SOUND and TO TOWN. The page's first hint names
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
  **A visit that starts in the 16-bit view** stays dark for at most
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
     brightness, and the machine's colours: five bits a channel with an
     ordered dither between them.
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
    card (`stand`); a torch on the beach, a brazier and everything else are
    still the classic card. A counter is one part to the tile, each running
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
- **The hero** (`figure.ts`). In this view the hero is the classic
  four-way sprite, smoothed (value `figure: 'classic'`, the default). Value
  `figure: 'modelled'` swaps it for a small figure built in the round (ellipsoids and capsules:
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
  (`kit.setHeroBare`). During the turn from another view the sprite stands
  until the turn is half done. `node scripts/zelda-lab/figure-sheet.mjs <outDir>` draws
  the figure's sheets (every yaw, the walk, the acts, the swings, the looks,
  lit, and beside the classic frames) without a browser;
  `tests/zelda-figure.test.mjs` holds it to its cell, its projection and its
  looks.
- **Where a swing is aimed** (`aimOf` in `engine/hero.ts`, every view). The
  hero keeps the exact way the stick last pushed (`hero.aim`; on touch with
  the stick at rest, the way to the foe the blade turned to). A swing
  sweeps its 171° across that and the Arc Blade's beam flies along it, so
  walking on a diagonal (which is every single key in the turned view)
  strikes along the diagonal. `dir`, the nearest of the four ways, is still
  what everything else goes by; once something else turns the hero (a
  door, a talk) the old aim no longer counts.
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
  wind, standing plants, the modelled hero, things in the air, the land
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
  size), `HIRES_WINDOW_SKIN` (`hud16.ts`: the 16-bit view's, drawn at two px
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
- **Known rough edges of the isometric view** (2026-11-12): the art under
  it is still the 16 px art, treated on its way up, so everyone but the hero
  is a classic figure with a 16-bit finish, not a redrawn one; the modelled
  hero (off by default) stands out beside them, the studio's live sprites
  do not reach it, and its sword arm has no elbow and its tails no memory;
  dungeon rooms are wider
  than the screen, so the camera follows the hero instead of showing the
  whole room; furniture is flat cards; the eight keyboard directions are the
  eight world directions, so walking along a wall takes two keys. Not
  measured on a phone: the lab's GPU is software.
- **Looking at it.** `VIEW=iso node scripts/zelda-lab/shot.mjs <outDir>
  [scenes]` renders the isometric view;
  `FRAMES=23` stops halfway through the turn (42 frames, the first four the hand-off), `PARAMS='{"bloom":0.5}'`
  sets the engine's values and `TAG=dim` names the pictures. The page keeps
  `window.__lab` (`{ r, s, ui, world, step }`) for a script that wants to go
  on drawing. `scripts/zelda-lab/flora-sheet.mjs`, `materials-sheet.mjs`, `props-sheet.mjs` and `backdrop-sheet.mjs`
  render the plants, the materials, the standing things and the backdrop alone.

**The 32-bit look moves toward the 16-bit one** (part 14, 2026-11-24). Petter's
direction: the 64-bit look is out of the round (`views.ts`, `RETIRED_VIEWS`: a
browser or an address that names `third` starts in `poly`; `THIRD_PERSON`, the
shoulder pose and the code stay, and one line brings it back), and the 32-bit
look is the 16-bit world's own art in the polygon engine's land and light:
  - *the camera* looks as the 16-bit one does, nearer and with depth (`CRANE`
    above);
  - *the hero and every figure* (part 16, Petter: «alle figurene kan få samme
    32-bit-oppskalering»): the 16-bit look's hero is the classic four-way
    sprite (its value `figure` is `classic`), and so is the 32-bit look's now
    (value `figure` `classic`, the default). Every person and thing in the
    32-bit look (the hero, people, Luna and the followers, foes, bosses,
    animals, what is carried, pickups) is its classic picture at four fine px
    a texel, four times the 16-bit view's pixels, made in the card shader as it
    is read, never on the CPU (`fineAt` in `engine.ts`, value `fineFigures`):
    Scale4x (Scale2x on Scale2x's picture: the stairs get quarter-steps, every
    px one of the drawing's colours), then the 16-bit view's own blend of one
    material's shades (`art` in `iso/shaders.ts`). The 16-bit view's smoothing
    alone at four steps (`smooth`) is the runner-up, faithful but hardly finer.
    The card stands as the 16-bit view stands it (half of its px a classic px
    across, a px up the screen a px tall, what is below the foot lying toward
    the eye), on the same foot point, facing the classic way round, so at the
    16-bit end of the direct turn the two heroes are one drawing in one place;
    its height and lie follow the camera from the 16-bit projection to the
    crane. Before part 16 the cards were 16 classic px to a tile across, about
    1.4 times too wide against the 16-bit look, and turned with the camera;
  - *the modelled hero* (value `figure` `16-bit`, a choice for the studio) is
    the 16-bit figure (`iso/figure.ts` `renderFigure`, every
    look and act and the blade), drawn each frame and stood up at the hero's
    feet: what is above the foot upright, facing the camera, what is below it
    (the ground in front, the blade's sweep) lying on the ground toward the
    eye, so the picture lies as the 16-bit look drew it (value `figure`
    `16-bit`). Since part 15 it is drawn at twice that look's density
    (`renderFigure`'s `density` 2: four times the pixels at the same size,
    the body snapped to whole fine px, the face drawn at the finer px, the
    outline two fine px and the line between parts one), its card the same
    size in the world, read texel by texel; the governor's lowest step draws
    it at the 16-bit density (`Spend.fig`). It stands on the hero's foot
    point, as the 16-bit view stands its figure. It is lit per pixel from its normal picture (sky, sun with its
    shadow, every lamp, the spill), never under 0.42 of its own colours, and
    sorts in the depth buffer against walls, trees and figures. The hero model
    (`hero.ts`, `public/zelda/poly/hero-*`) is no longer fetched;
  - *the plants* are the 16-bit look's (`iso/flora.ts`): trees, a wood's
    crowns, palms by the sand, bushes and tall grass, where that look plants
    them, by the same hashes, stood up the same way, swaying in the wind
    (`wind`) and lit from their normal pictures (value `plants` `16-bit`; the
    built cones are value `built`, the 64-bit look's). Woods hide what is
    behind them; the hero shows through a wood in front of them by the
    see-through stipple. The atlas is made a slice at a time while the view
    waits, as the 16-bit view makes it;
  - *the land* lies flat within three tiles of a road, a path, paving, a
    house, a door or whatever must be level (`FLAT_MARGIN` 3 in `terrain.ts`,
    rising over the next 2.5, `RISE_OVER`), and its knolls are half as tall
    (`landScale` 0.5);
  - *the turn between the 16-bit and the 32-bit look* goes straight, never
    through the classic picture (`turn.ts`: a pair named direct, `via`). The
    32-bit look draws first with the 16-bit view's own projection (that view
    says where its camera is each frame: `Kit.setIsoCam`; `isoMatrix` in
    `camera.ts`), so its picture lies on the 16-bit one; the two are
    cross-faded there over the first 30 % of the turn (both engines draw in
    those frames), and then the camera eases from that projection to the
    crane. Back the same way, reversed. Turns to and from the classic look are
    as they were: V goes classic → 16 → 32 → classic.

**The polygon view** (`render/poly/`, 2026-11-23). The third way of drawing the
world, the 32-bit look: the world as low polygons in perspective, seen from a
crane behind and above the hero, with a horizon, drawn the way a 1996 console
drew. It is engine `poly` and the third built-in view (POLYGON · 32-BIT, after
the isometric one; a visit still starts in the isometric one), so the corner
switch has three stops, the polygon one in its glass dress; `/?view=poly`
starts in it. It plays the 16-bit sound (a 32-bit sound of its own is not
built: value `sound`) and wears windows of its own (`GLASS_SKIN` in `hud.ts`:
dark glass the world shows through, a soft gradient, a thin bright edge, a hard
drop shadow; value `windows`, cross-faded through the turn as the isometric
view does); the shell's HTML keeps its classic dress. A 64-bit look is meant to
be the same engine with other values (camera at the shoulder, smooth shading,
filtered textures, fog).

- **The machine** (`engine.ts`, raw WebGL2 on `iso/gl.ts`). The scene is drawn
  at the classic scene's own size (`kit.size()`: one px to the classic px) into
  a canvas of its own, laid on `kit.scene()` over the sky, and finished by the
  renderer's own `present` (the whole-number upscale, bloom, scanlines,
  vignette, flash and fade) and `hudLayer`. What makes it that machine is in
  one program, each part a value: textures read texel by texel, no mipmaps;
  texture coordinates run straight across the screen between a triangle's
  corners (affine, `affine`: uv·w and w go down the pipe and are divided again;
  people and things, which that machine drew as sprites, are read straight);
  every corner pulled onto a whole px in the vertex shader (`wobble`); the
  light worked out at the corners from one normal a triangle, so the facets
  show; 15-bit colour with a 4 × 4 ordered dither (`colors`); and a short draw
  distance (`drawDistance`): from 62 % of it the world hazes toward the
  distance's colour and dissolves in five dithered steps, and below the
  horizon that colour stands where it has gone. No anti-aliasing.
- **The camera** (`camera.ts`, pure, tested). A rig between poses: the classic
  picture is a matrix (`classicMatrix`: height straight up the screen, depth
  the classic painters' sort), a pose is a perspective aimed at the focus from
  `dist` tiles at `pitch` with a lens shift that puts the focus `focusY` down
  the screen, so what stands upright stays upright. `poseMatrix` divides by the
  focus's distance (w is 1 there, as everywhere in the classic picture) and
  `rigMatrix` mixes the two element by element under the turn's ease, so the
  turn needs no camera of its own. `CRANE` (part 14) looks the 16-bit look's
  way: it stands south-east of the hero looking north-west, 32° down, through a
  22° lens from far back, the hero a little below the middle; its distance is
  set from the screen (`craneDist`, value `zoom` 1.4), so a tile is 1.4 times
  the 16-bit look's at the same screen size (the 16-bit look's own px rounded
  as it rounds them). It sees no sky on a wide screen or an upright phone.
  `View.turn` is a quarter of π, as in the 16-bit look, so a press goes where
  it goes there. Indoors the camera has a pose of
  its own (`roomPitch` 32°, `roomDist` 9): on a wide screen it stands back as
  far as the room's width needs, so the whole width is in the picture, and
  follows the hero in depth; on a tall one it follows sideways and comes as
  near as the room's depth needs to fill the picture, the back wall's top at
  the top edge. A room's north and side walls stand two tiles tall: the lowest
  course is the tile's own picture (its letters, signs, screens, shelves,
  doors), the one over it the map's plain wall material (`bricks`, `panel`,
  `steel`), in two steps darker toward the top. The south wall is a kerb on
  its own row. Outside the room everything is dark: a wall has no floor of its
  own, an interior's room ends at its south wall (the last row that is mostly
  wall and door), and what has gone wholly into the ground is not drawn. On a screen taller than wide the lens is the horizontal one, and
  `fitPose` tips the camera down and a little nearer by as much as the screen is
  tall, so a phone sees ground, not sky. The view holds a pose and eases toward
  the one its values ask for (`mixPose`), so a change of values (the `pose`
  choice: `crane` or `shoulder`) is a camera move, never a cut.
- **The land** (`terrain.ts`, pure, tested; this view only, the rules stay on
  the grid). One height function a map: a lattice of four points a tile, two
  triangles a cell split from the north-west corner, built in slices
  (`landWork`). Outdoors it is worked out fully only within three tiles of a
  shore; elsewhere its points lie on a coarse lattice's triangles (two a tile),
  and `step` says which, so the mesh draws coarse cells there without a crack.
  Knolls of value noise grow between what must stand level (`levelOf`: walls,
  houses, doors, water's own tiles, bridges, furniture, and a tile and a half
  round houses, doors and an exit's tiles stand at exactly 0), never steeper
  than `SLOPE_MAX` (a min-plus pass over the lattice). The shore is a signed
  distance to the water tiles, averaged over a small disc (so a corner rounds
  and a straight edge stays), set bending in slow curves of about three and
  eight tiles near the line only (up to `SHORE_MAX`, 0.45 tiles off the tile
  edge; at a corner the bends give way to the rounding), and every tile's
  middle is forced to the side the rules say. The water is one
  plane at `waterLevel` (−0.18 tiles) and the land falls under it at the banks:
  the drawn shoreline is where they meet, by the z-buffer. Beyond the map the
  land goes on (rock there is the far hills, not a wall), level at the map's
  edge height (its knolls die away within three tiles; part 14: it no longer
  rises toward the horizon), into the hour's haze. Rooms and
  dungeons are level and their water falls away inside its tiles. The far land
  no longer bends up toward the horizon (part 14: Petter saw the ground bend up
  in an arc); the ground runs out level, and the distance fades into the sky's
  own low colour (the sky
  layer's lower third, averaged across the width: part 13; a sample at the
  painting's left edge had taken the coast's dark lighthouse, and in the middle
  of a turn on an upright phone, with the land's far edge still well under the
  horizon, the haze showed as a dark band between sky and land). `stand` is
  `lift` but never under the water's surface: whatever is placed stands there
  (the hook reels the hero over water). `lift` scales
  every height by the turn's ease: the mesh (a uniform), people and things,
  lamps, shots and sparks (`place`), `setSpan`, shadows and the HUD's idea of
  where the hero is.
- **The world as polygons** (`mesh.ts`, pure, tested). Built in stretches of
  16 × 16 tiles outdoors and a room at a time indoors, kept on the GPU, built
  again when the map, the crystal blocks or a chest change. The ground is the
  lattice. What stands follows `iso/shape.ts` (`polyShape`: a room's wall with
  floor to its west stands, since this camera looks at it): a wall's top a row
  south of its picture with the sides nobody drew as the face picture again and
  darker, its face upright, a card upright on its foot; a house's roof one plane
  from the eaves rising toward the back (`roofPitch`, its rise a part of the
  height only k = 1 has, so the classic end lies on the classic art) with an
  end wall and a gable of boards at either end. Walls, faces and roofs take
  their pictures from the classic painters' tile layers drawn round the camera
  each frame (with the live tiles and the decals, so the neon lettering on a
  roof is there). Trees are built in code: three stacked seven-sided cones on a
  trunk, a faceted blob now and then, a palm by the sand, coloured from the
  classic painter's two canopy moods. Lamp posts, graves, pots, rocks,
  boulders, signs, pillars, stools, counters, chests, crystal blocks and fences
  are the 16-bit view's recipes (`iso/props.ts` `BUILD`, its boxes, posts and
  balls in its own dimensions) built as meshes, each face cut in cells so a
  material can change across it. Bushes are cards. In a room the south rows
  are cut down to a kerb (`roomCut`, by where a mass stands), so the south wall
  never stands between the camera and the room, and what lies outside the
  room is not drawn.
- **The ground's texture.** The open ground is painted by kind (`groundKindOf`),
  from the 16-bit view's materials at half their density: 16 texels a tile, a
  texture repeating every four, so its texels are squares near the camera.
  The kind of each tile is a small texture the shader reads; the border
  between two kinds frays a texel at a time (`fray`); a water tile's ground is
  its shore's kind, so land that rounds into it is lawn or sand, not water art.
  Tiles without a kind of their own (a rug, a bridge, a pit, a plate) are the
  classic art, and what the classic art lays on the ground (marks, mats, neon,
  letter stones, the hook's chain) is laid over every tile, except where
  something stands in its place.
- **People and things** are upright cards of their classic drawing on their
  feet at the land's height, sized by perspective, in an atlas of cells as in
  the 16-bit view; a cabinet or a booth (`Item.box`) has a body behind its
  front. Whatever may stand between the camera and the hero (a wall, a roof, a
  tree, a thing) is stippled every other px in an oval round the hero.
- **Light.** Per corner: the kit's ambient for the dusk, lifted to a floor in
  rooms so a dark room is dim, not black; the sky's light by how a facet turns
  (so a knoll's facets differ); outdoors the low sun's own colour by the
  facet's normal, and its shadow: each corner marches toward the sun through
  the tile masses (walls, houses with their roofs, woods) and the land itself,
  hard. Lamps (the kit's `Light[]`, a lamp post's at its head) light the
  corners round them in pools and walls and things by which side faces them.
  A blob of shadow lies under whoever walks and whatever stands alone, the
  ground under it darkened (multiplied), never lit away.
- **Sky and water.** Outdoors the backdrop is the 16-bit view's
  (`iso/backdrop.ts`, painted at the scene's size), laid so its horizon meets
  the camera's. The water is deep indigo with crests that run and glints; at
  the shore (read from the land's distance, uploaded as a small texture) foam,
  and round a pool the town built (a small water most of whose shore is
  paving) a neon rim instead, so the fountain's rim follows its rounded shore.
- **Without WebGL2**, or when the context is lost (more than three times), or
  when the shaders do not link, the classic picture draws on.
- **Resolution by generation** (2026-11-24). Each generation draws finer than
  the one before: the classic picture one px to the classic px, the 16-bit view
  two, the polygon view's own picture `density` px (POLYGON 4, THIRD PERSON
  `screen`, the screen's own px). A picture px is always a whole number of
  device px: `densityOf` takes the finest at or under the value, never under 2
  (on a dpr-1 monitor both looks are at the screen's px; on a retina one the
  32-bit look is at 4 and the 64-bit at 8; on a phone at dpr 3, 2.5 and 5). The
  sky is painted at the scene's size and brought up; the polygons are drawn at
  the density; `kit.present` takes the finished picture (its `picture`
  argument), so the bloom, scanlines, vignette, flash, fade and HUD are still
  the renderer's. The 32-bit machine keeps its grain at the finer picture: the
  vertex snap, the dither and the stipple keep to a grid of `grain` classic px
  (0.5). The 64-bit look draws through a 4× multisampled framebuffer
  (`smoothEdges`), its textures filtered, the old sideways smear off. Both
  dresses are fine (`hud32.ts`: `GLASS_FINE_SKIN`, `ROUND_FINE_SKIN` at density
  2, the 16-bit view's lettering and icons), and the round dress has bigger,
  softer hearts of its own. The governor steps the density down first.
- **The painted textures** (2026-11-24). Sixteen textures painted for these
  views (by Codex, from the 16-bit materials, in the whole colour range), one
  per material of `iso/materials.ts`, 128 texels a side, 32 to the tile:
  `public/zelda/poly/materials.webp` (86 KB, written by
  `scripts/zelda-lab/poly-pack.mjs` from the painted page), fetched the first
  time a polygon look wants it; the 16-bit materials draw until it is here, and
  if it fails (value `textures`: `painted` or `materials`). The 32-bit look reads
  them texel by texel, the 64-bit one filtered. Under the game's dusk some were
  too loud or too dim and are tuned as they are decoded (`PAINTED_TUNE` in
  `poly/view.ts`: a gain and a saturation a material): grass and the Wildwood's
  moss and lanes lifted, the sand calmed, the cobbles kept rose-violet, the
  interior panelling and the labs' plates calmed.
- **The hero as a model** (2026-11-24, `poly/hero.ts`). The hero is a mesh made
  from the drawn hero: 6,000 triangles in the 32-bit look, 20,000 in the 64-bit
  one (`public/zelda/poly/hero-32.bin` 90 KB with `hero-32.webp` 58 KB,
  `hero-64.bin` 283 KB with `hero-64.webp` 150 KB), fetched only when a polygon
  look first needs the hero; the sprite card stands in until then and if it
  fails (value `figure`: `model` or `classic`). The mesh has no rig: it is split
  into stiff parts by where its vertices lie in its A-pose (the legs, the torso,
  the arms, the head), with soft weights across each joint, and driven by the
  16-bit view's modelled figure's own poses (`solvePose` in `iso/figure.ts`: the
  walk of sixteen phases, lift, carry, push, hurt, get, use, fall, dead, the
  swing). Its arms are turned so the hand reaches where that figure puts it and
  its legs so the foot lands where it does; the body turns toward the heading
  at a pace. Its mesh is sent to the GPU once, in the engine's own vertex
  layout with two bones and a weight a corner (`heroVerts`), and skinned in the
  vertex shader by six bone matrices a frame (`poseHero`, `uBones`), so it is
  lit, snapped, filtered and fogged like everything else, flat-faceted in the
  32-bit look and smooth in the 64-bit one, and the CPU does next to nothing
  for it (part 6; it was skinned on the CPU, 3 to 6.5 ms a frame on the Mac).
  Its smooth normals are made from its facets by place (a few of the model's
  own pointed inward at the back of the head); seen from inside, through the
  small hole at the back of its hair, it is the hair's dark, so the face's
  eyes never show through the back of the head; `poly-pack.mjs` also mends the
  texels there. A rim of the sky's and the lamps' light round its edges keeps
  a dark jacket apart from dark ground, in both looks. The blade is a small mesh in the
  right hand along the engine's swing angle. Every look from the NEW LOOK stall
  wears the model (part 7): its shirt, band, hair, trousers and skin recoloured
  from the model's own painted colours (`MODEL_COLORS`, `recolour`); nothing on
  the head is the band in the hair's colour, a dress the trousers in the shirt's;
  another hair style, a bow or a skirt keep the model's own shape for now.
  Everyone else is still a card. In the 64-bit look the cards face the camera
  fully; whatever stands between the eye and the hero is seen through a
  soft-edged window the hero's size, what stands near the eye fades out, and a
  paper figure nearer than the hero fades over its last tile, all with real
  transparency (an opaque pass leaves out what is partly faded, a second pass
  blends it in, no depth written): the 64-bit look draws no dither anywhere, its
  shore foam a soft band. What lies flat on the ground is never faded. A paper
  figure that covers the hero on the screen while standing nearer the eye or at
  their heels (Luna, a dancer just before them) fades to a tenth, as a whole, by
  how much of the hero's box it covers and how much nearer it stands (worked out
  per figure in `view.ts`, carried to the shader in its flags' bits 5–9).
- **Two looks on one engine** (2026-11-23). The engine's values are its
  look, and the round has two of them: POLYGON (32-bit, the engine's own
  values) and THIRD PERSON (64-bit, `THIRD_PERSON` in `views.ts`), every trait
  turned the other way:
  - *the camera* at the hero's shoulder (`SHOULDER`: pitch 17°, 5 tiles,
    lens 56°, the hero 74 % down: low enough that the sky and the sun are in
    the picture over the land in the open; the sky's painting reaches the top
    edge at any pose and screen, its own top row drawn up where the camera
    looks higher than it was painted). Its yaw follows the
    hero lazily: it swings in behind them while they walk, not while they walk
    toward the camera, and drifts behind them after they have stood a moment.
    It rises over whatever stands behind the hero (the land, a wall, a house, a
    wood: the line from the eye to the hero's chest must clear them) and is
    pulled in only where rising is not enough. On a slope it also sees the
    hero's feet and two tiles of ground before them (tilting at most 0.3 rad
    for them, then coming nearer, both eased slowly so walking over knolls does
    not bob it), and the whole camera stands higher where the land rises right
    before the eye, so a hill never fills the bottom of the picture. Walls' faces between the eye and
    the hero are stippled as well as tops and things. Indoors it stands lower and
    nearer and follows the hero, still looking north (so a block goes where the
    stick says and the south wall stays a kerb). `View.turn` is the camera's
    nearest quarter turn, held while the hero walks, so up on the stick is away
    from the camera and the keys walk along the world's grid; a dialog gets the
    stick unturned. Figures with four ways show the side the camera sees
    (`Kit.setFacing`; `facingDir` in `wild.ts`): a hero walking away shows
    their back. (The 16-bit view's modelled figure, value `figure: 'modelled'`,
    was tried; drawn for that view's camera, it shows three-quarters from
    behind, so the sprite stays the default.)
  - *the machine*: the ground and walls through the GPU's own trilinear,
    16× anisotropic filter (a layered copy of the painted page, `uMatArr`), half
    a level soft (`groundSoft`, in both looks: steadier walking), sharp near the
    eye and steady far off, and on a slope stretched by the slope's own
    steepness so a bank seen head-on does not squeeze it into streaks; the
    paper figures filtered with a clean edge (each
    texel smoothed over a pixel of the screen, mixed premultiplied, no dark
    fringe) and the hero's shadow a soft round pool (`filter`), perspective-correct, steady
    corners (`affine` and `wobble` at 0), normals shared at the corners so
    knolls roll and trees are round (`smoothShade`), full colour stretched up
    softly with a little sideways smear (`stretch`: `Finish.smooth` in
    `renderer.ts`'s `present`), thick fog in the hour's colour over a short draw
    distance (`fog`) and before it the air itself, each layer of a wood further
    off a little more in the hour's colour so it steps back row by row; light
    over 0.75 rolling off toward white instead of clipping; stronger lamps
    (`lampGain` 2.3) so their pools show from the shoulder; soft halos round the
    lamps and a lens flare from the sun (`halos`, `flare`), land a little
    hillier than the 32-bit look's (`landScale` 1.05: 1.5 shimmered walking
    over the camp's knolls); paper figures nearer the eye than the hero not
    drawn (dithered, their enlarged texels showed as squares); round soft windows
    (`ROUND_SKIN`: rounded panels with soft shadows, a round frame round an
    item slot).
  - *between them* there is no turn (the renderer turns only between engines):
    when the engine's values change on screen the view eases from the old look
    to the new over a second, the pose through `mixPose` (the crane sinks to the
    shoulder, or climbs back), the numbers eased, the switches changed in the
    middle under the move (`lookNow` in `view.ts`).
  - *sight*: the shoulder reports a square the fog's radius round the hero, so
    the woods' foes come out of the fog whichever way the camera turns.
  - *sound*: the 16-bit flavour (`flavorForView`: the `poly` engine); no sound
    of its own.
- **The turn.** Through the hand-off the picture lies on the classic one:
  the facet light, the knolls' crowns, a room's second course of wall, a roof's
  pitch and what rises over a house's eaves are all light or height only k = 1
  has. This view's own things come up out of the ground and the classic
  stand-ins go down into it (moved, never squashed), staggered as the 16-bit
  view staggers: crowns go down k 0.4–0.72, trees come up 0.42–0.85, the things'
  cards go 0.62–0.86 while the things in the round come up 0.78–1 (each tree
  a little before or after its neighbours, by a hash in its role's fraction, so
  a wood never breaks through the classic crowns in one frame). The land
  swells as the camera tips, the sky comes down from the top edge with the
  horizon, the water gives way from the classic picture's over k 0.1–0.5.
- **The day** (after the Sun Prism, `kit.day('poly')`): the hour's sun (it
  whitens as it climbs; at night the moon's faint blue), lamps only half lit
  while the sun is up, the hour's exposure; the backdrop is painted in the
  view's own dusk and the hour sinks its sun, dims its stars and grades the rest
  (`skyGrade`), and the distance fades into the graded sky's low colour.
- **What the screen shows.** The view says what it sees (`View.sight`): north
  to the end of the draw distance, a trapezoid widening with the lens. The
  shell hands it to the engine (`state.sight.ahead`, `spread`), and the woods'
  foes walk in from beyond the dissolve (`engine/day.ts`).
- **A slow device** goes down a stated ladder (`LADDER` in `view.ts`), one
  step at a time, the same for both looks: 1 the bloom's own pass and the
  64-bit look's multisampling to 2×; 2 the 64-bit look's per-pixel lamps and
  its 20,000-triangle hero (for the 6,000 one), half the halos; 3 a draw
  distance of 70 %, coarse cells, no multisampling; 4 the picture's density a
  step down; 5 another, and the hero's card for the model. The governor
  (`createGovernor`) judges the median gap between frames over three quarters
  of a second against 18.5 ms, steps, waits a second while the cheaper picture
  is built, and steps back up only after eight seconds well under the budget,
  never to a step it has left twice (no flapping); each step dissolves in.
  `governorTrace` records what it did; `pinQuality` holds the top for the lab.
  A phone (`smallScreen`: under 600 CSS px across at a dpr over 2) draws at
  most two device px a CSS px and with 2× multisampling from the start. Like
  every view, it keeps its GL context until the page goes.
- **Entering a map**: the land is built in slices of a few milliseconds
  (`landWork`): while the view waits to be shown, over a door's fade toward the
  map behind it, and kept per map. The mesh is built a stretch of 16 tiles at a
  time within a budget of 7 ms a frame; a stretch that changed (a bush cut) is
  drawn as it was until it is built again.
- **Steady, seamless, lit** (2026-11-24). The polygon looks are judged by
  numbers over consecutive frames (`scripts/zelda-lab/steady.mjs`: the share of
  pixels changed a frame and the temporal second difference, `shimmer`;
  `scripts/zelda-lab/transit.mjs`: every frame of the turns between the views,
  mean light and change; the 16-bit view is the control). What keeps them still:
  - *the lamps* go through a keeper (`lamps.ts`): the painters' flickering
    lights matched from frame to frame, smoothed twice (0.35 s), held in slots
    and faded in and out (0.3 s) rather than swapped, at most 16, chosen by
    nearness; `freezeLamps` holds them for the meter.
  - *the hour's light* comes in steps of a tenth of a second; each light value
    (ambient, the sun's colour and place, the haze, the lamps' gain) is held
    smooth (`holdLight`, 0.4 s; a jump over 0.06, a map or a door, is taken at
    once). The sun's shadows are marched on the GPU through a heightfield of the
    land and the masses (`uHeights`), not baked into the mesh, so the running
    hour rebuilds nothing. The moon takes over from the sun across a stretch of
    its sinking (`nightShare`), not at a line, in this view and the 16-bit one.
  - *the textures'* smaller levels are mip maps of the painted page; the
    filtered look reads between two levels by the fraction, so the look's
    easing never switches the ground's level in one frame. The ground and the
    walls glide in the 32-bit look too (`groundFilter`, 1: filtered half a level
    softer; the 64-bit look a level and a half): read texel by texel, as the
    period's machine read them, they swam and shimmered more than the 16-bit
    view walking over the camp's grass, and steadiness wins over the period.
    Figures and the classic art stay texel by texel in the 32-bit look.
  - *changes without a move* dissolve (`Kit.crossFade`, the renderer lays the
    last finished frame over the next ones): the look's change under reduced
    motion, the governor's step down, the hero model arriving after its card.
    A painted page that arrives while the plain materials are on screen fades
    in over them in the shader (0.6 s). Lamps' glows on the bloom fade with the
    fog instead of being cut at its edge. The dialog box keeps the side it opened
    on through a turn.
  - *the light*: the painted materials are brought to the 16-bit view's mean
    light per material (`toAlbedo`, a gamma solved for the mean, the hue kept;
    `ALBEDO`, `PAINTED_TUNE`). The 64-bit look lights per pixel (`lampsAt`;
    `smoothShade` eases it in). Light in the air over what a lamp reaches
    saturates as the classic glow does, and toward the turn's flat end it is
    the classic share (0.6) and the light stops at 1 as the classic light map
    does, so the hand-off meets the classic picture beside a strong lamp too.
    The day's exposure is added as the classic picture adds it in the 16-bit
    view's flat end (`expose`). Lamps show halos as additive billboards that
    keep the picture's coverage (no dark disc over the sky), in the lamp's
    own hue (a strong light's halo does not add up to white). What shines by
    itself (a flame, neon, a screen, a lantern's pane) keeps its own colour:
    light round it brightens it only until its brightest part is full, and
    its glow, the bloom, is what is bright (part 12). Figures' blob
    shadows fall away from what lights their spot most (the sun outdoors, the
    lamps in reach), as in the 16-bit view.
  - *light from what shines* (part 9): lit windows, neon signs and screens and
    a town's fountain spill their colour round them. A spill map per map
    (`sendSpill` in `view.ts`) is built once from the classic art's own bright
    pixels (saturated neon, the warm window yellow) and the fountain's paved
    rim, blurred over about two tiles, and read like a lamp: per corner
    in the 32-bit look, per pixel in the 64-bit one (`uSpill`). On what shines
    by itself (a roof round its sign's letters) the spill's colour is added
    on top (part 12). Its strength is
    the hour's lamp light, held smooth like the rest, so it comes up with the
    lamps at sunset and is all but gone at noon.
  - *pools of light* (part 11): every lamp lays a round pool of its colour,
    bright under it and falling to nothing over about three tiles, so
    neighbouring pools meet with dusk between them (`lampFall` in `engine.ts`,
    shared by the per-corner and per-pixel light). A light on a house's own
    tile is a window or a sign's letter: it shines from just before the wall's
    face (the painters put it a row behind it) and throws a patch longer than
    wide out before the wall (about two tiles), brightest at its foot, and
    lights the wall round it. A fire (the camp's bonfire, a tiki torch) reaches half again as far as
    a lamp and burns brighter. A room's torches shine from a little out into
    the room and reach twice as far, so they light its floor, side walls and
    whoever stands there; a room's other lights reach half again as far
    (`FIRE_FIT`, `TORCH_FIT`, `INDOOR_FIT` in `view.ts`). While the sun is up
    the lamps go down to a fifth (`lampGain` 1.7 in the 32-bit look, 2.3 in
    the 64-bit one).
  - *a path of light on the water* (part 12): under the backdrop's sun, a
    column of crests that catch it, widening toward the eye and moving with
    the waves, warm at sunset and pale blue at night (`glint`, `glintSun` in
    `view.ts`; it shines by itself, so it blooms).
  - *what is drawn* (part 9, 10): a stretch of geometry (8 tiles a side) the
    camera cannot see (all its corners outside one side of the picture, or past
    the draw distance) is not drawn; what is shaded is capped at 2.9 megapixels
    (`PIXEL_CAP`; the 64-bit look stretched the rest of the way to the screen
    with a smooth filter, the 32-bit look in whole steps of the screen's own
    px), with 4x multisampling under it (`MSAA4_MAX`; a phone 2x); the translucent pass draws only the stretches near enough to
    the eye to fade, and decides a pixel's fade before its light; the bloom's
    own pass is drawn at the glow canvas's size and works out no light at its
    corners.
- **Known rough edges**: everyone but the hero is a classic card (in the 64-bit
  look paper figures facing the camera; Luna, who follows behind the hero, is
  the one most seen, and fades while she covers the hero); a
  look's other hair style, bow or skirt is not modelled; neither look has a
  sound of its own. Where the hero stands with a house's wall a tile
  ahead, the house still fills the top of the 64-bit picture. Seen from close behind, two dark
  eye-shaped marks show just over the band: the model has two openings in the
  back of its hair there, so deep their walls reach past the head's middle, and
  their walls, facing away from the eye, are drawn as the inside (part 13). In the 32-bit look lamp light is
  per corner, so a pool on a long wall is coarse. The sky backdrop moves in whole pixels, so a
  settling camera steps its stripes a pixel at a time. On a phone a room's camera comes near enough
  that the room's depth fills the picture, so the room is seen closer than on a
  monitor. Rooms' water corners are a hair short of the tile edge. Not measured
  on a real phone; the lab draws on the Mac's GPU, a phone's size with Chrome's
  CPU throttled 4× and 6× (`scripts/zelda-lab/throttle.mjs`).
- **Looking at it.** `CHROME_BIN=<chrome> VIEW=poly node
  scripts/zelda-lab/shot.mjs <outDir> [scenes]` (PNGs end in `-poly`;
  `PARAMS` and `FRAMES` as for the isometric view);
  `scripts/zelda-lab/poly-strip.mjs <outDir> walk|turn|crane` writes eight frames of
  the hero walking north-east across the square, or of the turn in (`VIEW=third`
  for the 64-bit look). The lab reads the fetched art from `public/zelda/poly/`
  and waits for it (`preloadArt`); `poly-pack.mjs <source>` writes that art.
  `scripts/zelda-lab/steady.mjs <outDir> <cases> [--views] [--day dusk|sun|noon|night|dawn]
  [--freeze] [--size 1280|390]` measures steadiness; `scripts/zelda-lab/transit.mjs <outDir>
  round|pairs|hard|yaw [--day] [--scene] [--reduced] [--keep a-b]` the turns between the views;
  `walk-flicker.mjs` and `page-flicker.mjs` the walk's and the page's flicker. The lab page takes
  `cold=1` (no art fetched before the first frame) and `late=1` (the art's address wrong until
  `__setAssetBase` gives it back). `tests/zelda-poly.test.mjs` holds the camera, the land, the
  mesher, the lamps' keeper, the held light, the looks' easing and the painted page's light.

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
  (`noonBright`: the art is painted for the dusk). The 16-bit view keeps its
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
