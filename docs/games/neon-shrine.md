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

Around the hand-made maps lie seven lands drawn by hand, all on one grid
with the coast and the Wildwood (`docs/worlds/atlas.md`, how they are built:
`docs/worlds/README.md`): Seter Fell above the town, Yule Fjord beyond it, the
Sporelight north of the Night Market, Stillsand behind the Hollow Graves,
Rerun Estates past Mirror Lake, Lumenby Quarry above the Wildwood with the
Underglow under it, and Fogstage west of the Deep Woods. Six gates lead into
them on foot, four from the old coast's edges (north out of Whisper Woods past
a boulder, north out of the Night Market, east out of the Hollow Graves
through a cracked wall, east along Mirror Lake) and two from the Wildwood
(north out of the Riddle Grove, west out of the Deep Woods); the ferry at the
end of the pier sails north to Yule Fjord. Each gate is a short road between
two lamp posts with a sign at the junction, and a warden who stands aside
only for the blade: the bomb bag can be found first, and a bomb also cuts the
town's thicket. Neighbouring lands join at passes: walking off an edge leads
into the map that lies there on the grid.

**Dialogue** (2026-09-26): people, signs and the pause screen's QUEST line
say where to go and what is wrong, never how to win. No boss tactics, no
"the item you just found works here", no secret spots. Boss cards are one
line of character. Item pickups say what the item does, once. The rest is
for the player to find out; the jokes stay. A page is one or more whole
sentences, never a clause cut by the box; whoever talks opens with their name
("GUNN: …", the name plate); a place has one name everywhere, the one on its
banner. Out in the lands a page is at most three rows of the narrowest box
(180 px, touch key names), which `tests/zelda-world.test.mjs` checks. A sign
may carry a second text (`alt: { when, lines }`), read instead of its lines
while the condition holds (Rerun's phone booth once the Gate is shut). How the
lands use their words: `docs/worlds/README.md`, "How the lands speak".

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
(`game.ts` modes/saves/camera/exits/area intros, `hero.ts`, `action.ts` (what a press of A does), `moves.ts` (the acrobatics and the hop), `enemies.ts`,
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
deck, audio, saves, pause menu, exits, navigation lock; `aPad.ts` the A pad's pictures), mounted by
`themes/portal/Landing.vue`. `LookBooth.vue` — the NEW LOOK stall's mirror.
`profileSync.ts` — the profile pull.
`progress.ts` — quest steps and the save merge. `hiscore.ts` — a real top
three on the arcade's HIGH SCORES sign (one Hall of Fame game at random,
`/api/leaderboard` without a player id; offline it keeps the KNG joke).

**Combat art.** Both views quantise the sword sweep to sixteen angles
(`render/bladeAngles.ts`). The small foes have dedicated hurt frames in both
atlases, with a separate back frame for the knight. Cyan and gold impact
stars and fading slash marks are registered for the combat effects. Small
animals appear around nearby water, flowers, trees and lights. The combo,
roll, six-frame run, held charge and stagger have classic and isometric
frames for the combat rework. The modelled figure also supports backhand,
lunge and roll. Generate a contact sheet with
`node scripts/zelda-lab/hero-poses.mjs sheet /tmp/hero-poses.png`.

**Views** (2026-10-07; engines and values 2026-11-11). The game can
be shown in more than one way, and the player can change it in the middle of
a room. The state, the engine and the world are the same; a view is how
a frame is drawn, and on a map with view blocks it is also a rule of play
(below, "The view as a rule"). A view is a drawing **engine** with a name and its own
values. `viewParams.ts` (pure) lists the engines and what can be turned on
each (`ENGINES`: numbers with bounds, colours, choices, toggles): `classic`
(the picture described under "Look" in `themes/zelda/DESIGN.md`), `iso`, an
isometric one (a third, `poly`, is archived: below). `views.ts` holds the round: one
built-in view per engine (CLASSIC, ISOMETRIC: named for their picture, with no tag of bits under the name since 2026-11-24; a built-in view may carry values, and the studio's lie over them), and whatever the studio published (below). Some values keep `16-bit` as a value name (`sound`, `windows`): the studio's saved values use them. A stored or published view that names an engine the game no longer has (`zelda.view` = `poly`, `/?view=poly`, a live view with `engine: 'poly'`) is dropped, and the visit starts in the first view. **A visit starts in the
isometric view** (`DEFAULT_VIEW` in `views.ts`), and the Sun Prism
in the corner turns to the next (V goes classic → isometric → classic). A view the visitor turns to is kept in localStorage
`zelda.view` and is where their next visit starts; the view a visit merely
starts in is not written, so a browser that never chose follows the site's
first view, and one failed fetch of a view's code does not pin it to the
classic picture. `/?view=<id>` asks for one.

- **Finding them.** The **Sun Prism** on the corner's frame (see "The
  corner" under "The map") is the view switch: a press turns to the next view,
  as V does. Its face is a square in the classic view and a diamond in the
  isometric one, and the frame it sits on turns with the world: the frame's
  shape is a function of the renderer's turn, read once a frame
  (`stepCorner`, `turnAmount(viewState().turn)`), so a second press in the
  middle of a turn takes both back in the same frame. When the turn has
  seated, the view's name stands on the corner's tag for 1.6 s and a live
  region says it. A view that is waited for longer than 150 ms has its name
  on the tag while it comes; a view whose code did not arrive sinks the
  Prism a step, says VIEW NOT LOADED on the tag and in the live region, and
  plays the refusal's sound (a press is kept as this browser's choice once
  its view can be shown). **Where the round holds only one view this map
  allows** (`pinName` over its `MapDef.views` and the live round: with the
  two built-in views, Yule Fjord, Stillsand, Lumenby, Fogstage and the
  Underglow; a studio's second isometric view would give them a view to turn
  to), the Prism is pinned: dull, and where it hangs free of the glass (the
  diamond's tip, beside the stub) on a chain over a plate with the view's
  name (ISO), its target reaching over the plate; a press bumps it and says
  ISO ONLY HERE on the tag for 1.6 s ("Isometric only here" in the live
  region, said again at every press, and in the Prism's own name), with the
  refusal's sound. A round of one view (the studio may take all but one out)
  has no Prism at all: no gem, no plate, no V, no button. The first time a touch player stands where both views
  are allowed, the Prism wears a pink ring and the tag says TAP GEM: TURN
  (once per browser, see "The corner").
  - *Keys and focus.* A pointer press never leaves focus on the Prism.
    Reached by Tab, it owns Enter, Space and Tab only: `data-game-keys`
    makes `input.ts` hand every other key back to the game and blur it, so
    arrows walk and V turns at once. (In play Tab is the swap key once the hero
    has an item; the Prism is then reached by V and a screen reader's own
    navigation. While the menu is open Tab moves the focus, to the MAP page's
    Prism among others.) Its name says which view is on and which a press gives (on
    a pinned Prism, that this is the only one here), and a live region says
    the view after every change. Focused, it wears a gold ring (read from
    the page each frame, so the ring goes with the focus, whatever takes
    it); beside a keyboard a V key cap stands under it, or under the frame
    where the gem sits on the glass.
  - *What changes dress beside the canvas* (the touch deck's pictures, the
    page's hint) fades out before the flip at k = 0.5 and in after it
    (`--zelda-chrome-a`), as the canvas HUD cross-fades between its skins.
    The corner wears one dress in both views and does not fade.
  - V turns to the next view in play and on the pause screen alike (the
    pause screen names the one that is on), and on touch the MAP page's
    buttons have VIEW beside RESUME and ITEMS. The page's first hint names
    no view key. In the world itself there is the **viewfinder** east of the
    fountain (exit `view`, look `scope`, panel `view`, which opens nothing):
    A turns to the next view. The **view strip** (`drawViewStrip` in
    `hud.ts`) is the studio's stage's only; the portal does not raise it.
  - The Prism and the frame in every state are drawn by the corner's lab
    sheet: see "The corner" under "The map".
- **The view as a rule.** **Square blocks (`□`) are solid only in the 8-bit
  view, diamond blocks (`◇`) only in the isometric view.** In the other view a
  block is an outline on the floor, so what a turn will do shows before the
  turn.
  - *The rule.* `GameState.view` (`'flat'` or `'iso'`, the view's **engine**,
    never its id, so a studio's view inherits it; never saved; a game opens in
    `'iso'`). One function says whether a block is up (`blockUp`,
    `world/tiles.ts`), and one read takes it to everything that moves or looks
    (`solidTile`, `engine/map.ts`): the hero (walking, rolling, the air moves,
    ice), shots, thrown pots, the disc, the hook, beams, lines of sight and
    foes' sight. An up block is a wall to them (a bomb's blast reaches past it,
    as past any wall); a down one is floor. **Creatures and pushed things stand
    on neither kind in either view**: walking and flying foes, people, push
    blocks, mirrors, psi blocks, boulders and set bombs are refused both, so
    nothing but the hero can be where a block rises. (Luna follows without
    collision, on the hero's trail: a turn drops the trail's points that now
    lie in a block, and where her straight way to her next point crosses one
    she is brought to the hero's heels. A boss that places itself, as the King
    does, ignores walls and these alike, so no boss room has them.)
  - *The moment.* The rule turns once, halfway through the picture's turn,
    with the HUD's dress (`turnSide`, `render/turn.ts`; `stepRule` in the
    shell). The world holds still for that frame, so no step runs between the
    old rule and the new. The stick is the picture's business, not the rule's:
    it turns smoothly with the picture, so a held direction stays the same on
    the screen. **The rule never runs ahead of the picture.** A visit starts
    with the 8-bit rule, on the 8-bit picture that draws until the view asked
    for is here, and while any view is being fetched the rule is the side the
    picture shows. The turn a map forces on the way in goes the same way
    (`forceView`; on a map with view blocks the picture takes the view at once,
    behind the door's fade, so the rule is on it before the hero can leave the
    entry). Turns of the picture, instant ones (a paused game, an open panel,
    reduced motion), a reload and the rule turned alone all go through one call
    (`turnRule` → `setViewRule`).
  - **STAND CLEAR.** A turn that would raise a block under the hero (their
    circle touches it, or the hook's chain crosses it) does not happen: the
    tag says STAND CLEAR, the live region "Stand clear", with the refusal's
    sound; on the pause screen the VIEW button says it for 1.6 s. It is asked
    at the press and again until the half, so a hero who walks onto a block
    while the picture is turning sends the picture back (the visitor's kept
    choice with it, where the press had set it). A view that arrives late onto
    a hero who has walked on in the meantime does not set out at all.
  - *Without the isometric picture* (its code refused, a view that threw, or a
    round the studio left without an isometric view): on a map with view blocks
    V and the Prism turn **the rule alone**. The picture stays 8-bit and draws
    both kinds in their state, a **badge** left of the corner's frame says
    which rule is on (8-BIT or ISO; on the MAP page the Prism's plate), and the
    Prism's name says it too. A turn back to ISO asks for the picture once
    more, quietly. Only here does the rule turn without the picture. No room
    can lock a player out.
  - *A condition.* `{ view: 'flat' | 'iso' }` is a `Cond`: a gate's `open`, a
    chest's `appear`, a person's `when`, a sign's `alt`. A gate or a chest it
    opens stays open, as with any condition.
  - *Pictures* (`render/viewBlocks.ts`). Up: a low block of the dungeon's wall
    stone with a square or a diamond cut into its top in cyan. Down: the same
    shape as a dim cyan outline on the floor. The shape is the one on screen: a
    square looks square and a diamond a diamond in both views. The charts draw
    an up block as wall and a down one as floor.
  - *The validator* (`world/validate.ts`) walks a map with view blocks in both
    states, a turn allowed on any tile free in both; wants every entry, the
    step out of a door and every landing on such a tile; and wants both views
    allowed (`views` unset or both).
- **The Turn Room** (`turnroom`, `world/turnroom.ts`) teaches the rule in one
  room of 16 × 12, through a door in the north wall of the Puzzle Lab's Weigh
  House (`docs/games/neon-shrine-puzzles.md`). From the door northwards: a row
  of diamond blocks (passed in the 8-bit view, so a hero who arrives in the
  isometric one, as a game opens, turns at the door), a row of square blocks
  (passed in the isometric view, so they turn back between the rows, and meet
  STAND CLEAR in either row's line), then a stagger to the chest: turn, cross
  the diamonds, turn again on the ground between them and the squares, cross
  those. Four turns at the fewest from the isometric view, three from the
  8-bit one. The chest holds 20 bits (`turnroom.prize`); two signs; no foes.
- **The side view** (`MapDef.kind` 'side'; `engine/side.ts`, `render/side.ts`;
  2026-11-27, no map of the world uses it yet). A dungeon seen from the side:
  rows run down the room, camera rooms, room activation, foe clamping and
  checkpoints as in a dungeon (`roomed`), and a room may be several cells high
  (`CellDef.tall`; it scrolls up and down only). It is not a view: the map is the
  classic engine's (`viewsOf`), V and the Prism are pinned, the stick is not
  turned, the picture cuts over behind the warp's fade and the visitor's view
  comes back on the way out. The corner shows its stub, the MAP page the room's
  name.
  - **Moving.** Gravity and a jump (B, or up on keys; the B pad on touch, which
    says JUMP whatever is owned): 3.2 tiles held, 1.6 tapped, 0.36 s to the top,
    falls faster (capped at 15 tiles/s), coyote time and a jump buffer of 0.1 s
    (0.13 under a thumb), a little air control. The stick is all or nothing
    sideways. The jump is not the HOP: it can be hit.
  - **Tiles.** `Ħ` a ladder (up takes it within half a tile, down from its top;
    B or a push to the side leaves it; it ends on a platform), `¯` a platform
    solid from above only (down drops through). The mark `ledge` is a safe ledge:
    a fall off a room's bottom costs half a heart and puts the hero on the last
    one stood by, else on their first footing in that room. A room is left upward
    only by a ladder.
  - **The blade.** The three-cut chain ahead with its step, up + A upward, the
    spin; touch turns a cut left or right only. The roll is a ground dash and
    stops at an edge unless the stick holds on. The air's combos, the HOP, the B
    items and block pushing rest. Luna is not along.
  - **Foes** on foot fall, stand and stop at edges (a blow throws them off);
    flyers fly. Only the blob, the sentry and the bat have been tried.
  - **Trying it.** The trial room is a fixture (`scripts/zelda-lab/side-trial.ts`),
    played by `tests/zelda-side.test.mjs`, measured by
    `node scripts/zelda-lab/side-measure.mjs` and shot in the running shell by
    `node scripts/zelda-lab/side-shot.mjs <local url> <outDir>`.
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
  follows to the classic view in the same frame, with VIEW NOT LOADED on
  the corner's tag (`viewFailed`); one that throws on its way out ends the turn there, and
  that is no refusal. A
  later press makes the view again; once a view has failed three times
  while it was the one shown, a press for it is refused for the rest of
  the visit. (On a map with view blocks a press then turns the rule alone:
  "The view as a rule".) `View.turn` is how far the picture is rotated
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
  - *Machines drawn by hand* (`machines`, on by default, needs `things`; `iso/machines.ts`,
    the `machines` art pack, `iso/machineGlass.ts`; part 25, 2026-11-26). The arcade cabinets (all nineteen
    placed: fourteen in the arcade, four in the VIP hall, NEW GAME in Petter's house), Petter's three
    terminals and the LOGIN console stand in the round as hand-made pixel art. The NEW GAME cabinet is the
    master, drawn by Codex over a guide from solids (a tall box, a marquee hood, the screen set back between
    the side panels, the control panel jutting, the coin door) with its glass a flat key colour; every other
    cabinet is a Codex edit of that drawing on its grid (its body colours, trim and glow, its marquee logo),
    so the styles share the master's silhouette, normals and depth (`like`; `paintThing` finds the drawing
    in the kit). The terminal and the console are one sheet of their own. **The screens stay live:** the
    exit's item names the regions of its classic drawing that are screens (`Item.screens`: a cabinet's
    attract loop, a terminal's screen, the console's screen and its status lights), the classic painter
    draws the item into its cell every frame as before, and `view.ts` stands those regions over the dark
    glass of the drawing (`machineScreens`): the glass was measured per drawing (`MACHINE_SCREENS`: the
    largest box inside it that runs down half a px a column with the front), and `screenFit` puts the
    classic picture at the largest whole scale that fits with no more than a px off each edge (2: the
    classic's px at the view's density, as the people's cards), in the middle, sheared with the front and
    risen with the drawing, on the drawing's own card brought forward along the line of sight: each side a px
    nearer than the glass behind it, its depth read from the drawing at that column (one depth for the whole
    card left the nearer, right-hand side of the glass over the screen). It glows as the box's front did
    (picture 1's neon), and the drawn marquee, buttons and coin slots glow by their own (`glow`); the lights
    and the CRT flicker are the classic painter's, as before. The art (the `machines` art pack, about 92 KB of
    PNG; *The art packs* below) is fetched the first time the view is in a room with a machine (`hasMachines`, `machineArt`) and packed
    beside the realm's kit, and kept packed while no realm's kit comes in (a door out of the arcade does not
    pack the atlas again); until it is here, with the value off, and for a cabinet whose style has no
    drawing (`galaga`, `default`, a new game's cabinet), the box below stands. Each cabinet records the
    hash of the classic style it was drawn from (`MACHINE_FROM`, against `CAB_STYLES` in `exits.ts`):
    `tests/zelda-machines.test.mjs` fails when a style changes, so it is redrawn. The job's tools, sheets
    and archive are in `tmp/iso-figures-25/` on the Mac (`REPORT.md`).
    **The square's stalls** (part 26, 2026-11-26; the `stalls` art pack, behind the same value): the SLEEPER
    NEWS newsstand, the NEW LOOK stall and the KODING KATA stand are drawn the same way, each by Codex over
    its own guide from solids. Codex draws about 150 × 100 art px on a sheet, so a stall is several
    drawings that stand together, each piece a thing of the item with its own anchor (`things`): NEW LOOK
    a back wall with the mirror, a side wall at each end, the counter, and the roof (the board and a short
    awning, so the mirror and the people stay in view from above); KODING KATA a back wall with its shelf,
    the side walls, the desk, the desk computer, the board, the awning and the two junk piles; the
    newsstand is one drawing. What moves stays the classic painter's, live: the lit NEWS, NEW LOOK and
    KODING KATA, NEW LOOK's mirror (bulbs, glass, shine), the desk computer's code and the amber prompt
    stand in the drawings' key areas as the screens do (a region may name the drawing and key area it
    stands in, `ThingScreen.part`, `box`); the junk pile's disk light, too small for a key area, is a lit
    and an unlit drawing (one px apart). The people behind the counters (the stylist, the mannequin and
    its changing look, Linus and Ada with their glasses) are the classic painter's too, each a card of its
    own (`ThingScreen.stand`) standing behind the drawn counter with its foot just under the counter's top,
    so they show waist up and bob and hop as before; for such an item the cell holds only what lives
    (`Item.bare`). Their art (about 60 KB of PNG) is a second pack, so the town fetches only it, and a map
    packs only the drawings its looks bring (`machineLooks`, `machineKit`): the square's atlas holds no
    cabinet. The tools, sheets and archive: `tmp/iso-figures-26/` on the Mac (`REPORT.md`).
  - *Cabinets and booths with a body.* An item whose drawing is the front
    of a box says so (`Item.box` in `wild.ts`: the front's width and height
    in the drawing, and how deep the body is; the arcade's cabinets, the
    terminals, the login console, the newsstand and the stalls in
    `exits.ts`). The classic view ignores it. This view stands the drawing
    along the wall it faces, as it does a board on a wall, and closes a
    body behind it on top and to the east with a plain patch of the
    drawing's own edge, so a cabinet is a cabinet seen from the corner,
    its screen running away to the right, and not a card. Since part 25 the machines stand drawn
    (above) and the box is their fallback and their first part of the turn; since part 26 the newsstand
    and the two stalls too.
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
  Everyone is redrawn for this view
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

  The bosses are `bossArt.ts`'s (parts 22 and 24, *The bosses* below). A family
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
    oss i en ekte piksel-følelse.»; the llama redrawn and the mistral drawn in
    part 24, «Ja, tegn dem»). All six are drawn in the same art as the people:
    the king (and its shards), the troll, the gemini twins, the llama, the
    deepseek and the mistral, rotoscoped: each was built in 3D (the king and the twins from
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
    tag; the deepseek's glowing cyan lure, its grin and its bite; the
    mistral's icy cyan spiral round the orb with its calm face.
    - *The llama* (part 24). Part 22's drawing was held back (`BOSSES_HELD` in
      `folk.ts`): seen side-on from the mesh it became a fluffy four-legged
      animal that read as a dog or a squirrel, without the classic's upright
      stance and L badge, and partly doubled px. It was redrawn face-on: the
      mesh turned to face the camera and tipped back 25° (stretched 1.2 in
      height) so the head stands high on the short neck with its two tall
      ears, about as wide as it is tall; the violet visor of eyes and the
      grumpy mouth, the pink harness across the chest with the big yellow L
      tag, the lavender wool and violet legs. Front, walk step and spit on one
      sheet, the back's two steps on another (from behind: the harness across
      the back with its centre strap, the tail). `BOSSES_HELD` is empty now;
      the mechanism and its test stay for the next drawing that misses.
    - *The mistral* (part 24). Its classic turns its spiral in the picture's
      own plane, the face upright and the tail below, at 7 frames a second (14
      while it blows), never mirrored. So frame 0 is the mesh face-on (tipped
      back 30°), and frames 1–3 are the same drawing with the ribbons turned an
      eighth, a quarter and three eighths of a turn clockwise round the orb:
      Codex edits of frame 0, each given frame 0's drawing and a guide with the
      render's ribbons turned (the orb and the tail kept), placed by the orb so
      the face stays put while the wind turns. `down` (the slumped heap, the
      orb on top with dizzy eyes, three yellow stars) is an edit of frame 0 as
      well.
    - *Size.* Codex draws pixel art on a grid of its own, about 10 px of its
      1536-px sheet to a pixel whatever it is asked; a figure drawn smaller on
      the sheet comes out in 2 × 2 blocks once cut at the view's density (the
      first king and troll did; they were redrawn). So a boss is guided at 10
      px a pixel (the king one frame to a sheet, the troll's pair, the
      deepseek's two poses and fin, the llama's front and back) or at 5 where
      the figure is small enough that the drawing still lands on whole px (the
      twins), and every sheet is cut at the grid it was actually drawn on. The
      grid is Codex's choice, not the prompt's: the llama's sheets came out at
      9.7 and 10.45 px, the mistral at about 12 (a portrait sheet drew it 66 px
      wide; guided at 12 px a pixel, filling the sheet's height, it drew 72 ×
      76). The edits of a drawing keep its grid when told to; one `down` edit
      copied the classic's own coarse blocks instead (2 × 2 px) and was
      redrawn. A boss drawn in the round is about the classic's size in the
      world, not its shape: the troll is 39 × 39 (the classic 22 × 24 doubled
      is 44 × 48), the llama's front 42 × 57 and its back 41 × 62 (the classic
      21 × 26 doubled is 42 × 52), the deepseek 58 × 41, the mistral 72 × 76 (the
      classic 39 × 39 doubled is 78 × 78).
    - *Frames.* The king's second frame is its first with the pupil 2 px aside,
      the fists 2 px lower and the glitch streaks moved (a script's edit); its
      hurt frame is a Codex edit of the first (the stone flashing pale pink, the
      eye shut). The troll's blink is the first with only the eyes taken from
      the second drawing; the deepseek's second frame is its first a px higher.
      The twins' and the llama's steps are drawn on one sheet, placed by their
      best px match on the first; the mistral's turned frames by their orb.
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
      `tools/`: `guide.py`, Codex, `cut2.py`, `edit.py`, `build.py`, `emit.py`;
      the llama's redraw and the mistral in `tmp/iso-figures-24/`, with
      `pose_glb.py`'s `pitch`, `spin.py` for the turned guides, `orbalign.py`
      and `splice.py`, which replaces one family in `bossArt.ts` and leaves the
      others byte for byte);
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
  `types.ts`): the one combat, in every map.
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
    hit's end goes on with the chain; later, it starts over. Every swing is
    a hit of the chain (`swing.n`), and `swingDur(swing)` is its time.
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
  - *Calm sentries* (`calm` on the enemy mark). A sentry that only patrols: it
    never goes alert and its touch does no harm, until a blow or a stun lands
    on it (`ai.angry`); from then on it is a sentry like any other, and goes
    for the hero. Loading the map again leaves it calm.
  - *Tough foes* (`tough` on the enemy mark; every number in `TOUGH`,
    `types.ts`). A sentry or a hound with more hit points (12 and 10), a bar
    over its head and *poise*; any other kind, or a calm one, is refused by
    `validate.ts`. They are small foes, not in `BIG`: five stand in the lands
    (`docs/worlds/atlas.md`; Yule Fjord and Lumenby have none, no sentry or
    hound lives there).
    - *Poise and the opening* (`toughOpen`). While it is not open, the blade
      (`sword`, `spin`: every move of it, the Arc Blade and a critical too)
      only clanks off it: no damage, no flash, no shove, no mercy time, and a
      SLIP's critical edge is kept for a blow that lands. It goes on with
      what it was doing and harms at a touch. Bombs, pots and batted shots
      hurt, shove and reel it as any small foe (a warning it has announced
      stays up). It is open while stunned, and while it stands spent after
      its strike (1 s): then it is a small foe in every way and its touch
      does no harm. So the bar moves only while it is gold. One opening
      gives the blade 5 hit points in all (`take`), whatever the blade or the
      combo (the Arc Blade only gets there sooner); with that taken it shakes
      itself shut and starts over with a fresh `pause`. A bomb is not counted.
      A stun and the spent time run out on time however it is hit, and its
      poise is back at once.
    - *Stun.* The disc stuns it 1.2 s, the hook 1 s. While stunned, and for
      4 s after (`shrug`), both clank off it. When a stun ends it starts
      over: back to its stalk (the hound to its prowl) with a fresh `pause`,
      whatever it was doing when caught, so it never strikes without a full
      tell.
    - *The tough sentry* stalks a hero it sees within 7 tiles at 1.6 tiles/s
      (else it patrols). After 1.2 s of that, with him in sight within 4.5
      tiles, it stands and tells for 0.6 s, then charges at 9 tiles/s along
      the line to where he stood as the tell ended, without steering, to 1.2
      tiles past that point or to a wall; then it is spent.
    - *The tough hound* prowls as a hound does, tells (0.5 s) and lunges (10
      tiles/s), then tells again for 0.25 s and lunges a second time, each
      lunge ending 2.2 tiles past its mark (`houndPast`: far enough off that
      the second can be answered) or at a wall; then it rests, spent.
    - *The fight* is played by scripted players in
      `tests/zelda-tough.test.mjs`, over eight setups for each kind: one who
      stands still is hurt; one who hammers A is hurt at least twice, with
      the Arc Blade too; one who only throws the disc is hurt; one who rolls
      off the strike 0.1 s after it starts and cuts while the bar is gold
      wins untouched in 8 to 20 s (0.15 s after it starts: still untouched,
      a little slower); one who rolls before the tell is
      over is hit, because the foe aims when the tell ends.
    - *The bar, the outline and the light* (`render/renderer.ts`, every view;
      no art of its own). The foe's silhouette a px out on four sides: pink,
      gold while open, white and pink by turns at 8 Hz while it tells (steady
      white under reduced motion); no `!`. While it tells a small white light
      (1.4 tiles) stands on it, while it is open a gold one, so dusk and night
      do not dull the outline. The bar is 12 × 3 px, 3 px over the top of the
      figure as the view draws it (read off the art's rows, `folkTop` for the
      isometric figures), drawn with the effects, so unlit and above
      everything in the world; what is left is pink, gold while open. A
      stunned one's stars turn between its head and the bar.
    - *Falling.* It always drops a heart and five bits. It cannot be knocked
      into a pit, water or spikes. Like any field foe it is back when the map
      is entered again.
    - *Day and night.* It stands where it is at every hour: no rank, no twin
      (`settleFoes`).
    - *The fight is tested* (`tests/zelda-tough.test.mjs`): scripted players
      who stand, hammer A or lean on the disc are hurt; one who rolls off the
      strike and cuts in the opening wins untouched, in 6 to 20 s. Tune
      `TOUGH` against it.
  - *The bosses' bar* (`BIG`: the knight, the king, the llama, Mistral,
    DeepSeek, the twins, Mixtral). The tough foes' bar over each of their heads, in
    every view, as wide as twice the foe's radius in classic px (20 for a twin,
    36 for the king): what is left is pink, gold while the boss is open
    (`bossOpen`, beside `toughOpen`: the state in which the blade takes hit
    points off it). The knight dazed or stunned (its unguarded back is open to
    the blade too, but depends on where the hero stands, so the bar stays
    pink); the king down; Mistral down; DeepSeek up or hauled (under the floor
    the bar rides over the fin); a twin on its feet, so always, except while it
    lies fallen; Mixtral dazed, while that daze still has blows to give; the
    llama never, its wool turns the blade. A stunned or dazed
    boss's stars turn between its head and the bar. A new boss adds its case to
    `bossOpen`.
  - *A heavy foe's fall* clears the small foes of its room with it; another
    heavy foe there stays on its feet (the Echo Barrow's pair of knights).
  - *Mixtral* (`mixtral`, the Echo Barrow's miniboss; hp 10, radius 0.8;
    `engine/bosses.ts`, every number in `MIXTRAL`). Its card, the first time
    in its room: MIXTRAL. EIGHT OPINIONS AND ONE HEADACHE. It walks at 1.8
    tiles/s to get the hero into line (within 0.8 tiles of a row or a column
    through it, in sight), then stands and tells for 0.7 s with a pink lane
    stencilled on the floor from it to the wall it will hit, and charges
    straight down the lane at 9 tiles/s, without steering. The lane is as wide
    as the charge's touch: a hero whose middle is outside the paint is not hit.
    The wall dazes it for 2.2 s: open (gold bar), its touch harmless, and the
    blade takes at most 5 hit points a daze (`TOUGH.take`). At every other
    time the blade clanks off it, and the disc and the hook too (nothing stuns
    it). Bombs, thrown pots and batted shots hurt it at any time. It then
    rouses for 0.5 s, harmless, and walks at least 1.1 s before it tells again.
    From half its hit points (`bossPhase`) it tells for 0.5 s and charges
    twice, turning once toward the hero between, each lane stencilled. Both
    views draw its three-headed pictures (`mixtral_left`, `_middle`, `_right`:
    the heads take turns as it walks and spin while it is dazed); the 8-bit
    view draws them at twice their size (`doubledSprite`), the isometric one
    its own art for them (`render/iso/frontierArt/`).
  - *Stencils* (`engine/stencils.ts` `stencilsOf`, painted by
    `render/floorMarks.ts`): what a foe's blow will hit, as shapes in tiles
    read off its brain's state, painted flat on the floor under everything that
    stands, in every view (`Kit.floorMarks`: each view lays them on its ground
    picture once the standing things are off it), and never up a room's walls.
  - *The lands' foes* are ordinary foe marks, drawn in the realm's own skins
    (`FRONTIER_FOE_LOOKS` in `render/renderer.ts`): which stand where is in
    `docs/worlds/atlas.md`, "The lands". The Sporelight's sentries are
    grazers, cyan-eyed while calm and pink otherwise (three calm ones and a
    pink one are the Shellyard's pen).
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
    its edge, so the ice's lanes hold. A press of A in it is the FLIP CUT (below; on the
    edge of ice, where the air may not start, the strike waits for the roll's end).
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
    itself behind it. Foes
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
  - *The poses* (drawn by Codex: `heroFrames.ts`, `iso/heroPoses.ts`, `ART_EXTRA_POSES` in `iso/hero.ts`).
    A chain swing shows the wind-up (`atk_wind`) for its first `WINDUP`,
    then the forehand (`atk`), the backhand (`atk_back`) or the finisher's
    lunge and landing (`atk_lunge`, then `atk_land` from 70 % through).
    The roll plays `roll_0..3` over its time; at full stride the hero runs
    (`run_0..5` at 12 a second), slower it walks; standing it breathes
    (`idle_1` every other 0.7 s, none under reduced motion), and holding a
    charge it braces (`charge`); hurt shows the side it faces (`hero_hurt`
    from the front). A pose a shape lacks falls back to the swing or to
    standing (`extraFallback`), never to the classic hero. The lab's
    `swing1`, `swing2`, `swing3`, `roll`, `hit` and `kill` scenes show each
    moment.
- **Combos and the hop** (`engine/moves.ts`, the numbers in `types.ts`: `AIR`, `MOVES`,
  `ARTS`, `HOP`; 2026-11-25, the hop in place of the four arts 2026-11-26). The hero fights the way a small old
  master would: off the ground as much as on it.
  - *In the air* (`Hero.air`, `heroZ`). No foe harms the hero there (a blow, a shot:
    `hurtHero`'s `foe`); a rolling stone or a blast still does, and throws him clear,
    as on the ground. The arc's height
    lifts the figure off its shadow in every view (the classic painter draws it
    higher; the isometric card carries it; the modelled hero stands its quad up).
    The air never crosses a pit, spikes or ice (the tiles' `pit` and `hurt` flags),
    flown head on or along a wall, and in a dungeon never leaves the
    room: it stops at their edge, as the chain's lunge does, so no gap the hook is
    for and no ice lane is skipped. It never starts on ice. A shove (a shield, a gust)
    brings the hero down. A press of A in the air (but the
    comet's) strikes as soon as the landing lets the blade go.
  - *The combos* (`MOVES`): TRIPLE CUT (A A A, the chain), WHIRL (hold A, let go:
    the spin), FLIP CUT (R, then A in the roll: a somersault along the roll that
    comes down in an overhead chop across 216°, turned to the nearest foe wherever
    it landed, behind included, and a shock all round, `FLIP_CHOP`), BACKFLIP (R
    during the chain, or just after a hit of it, with the stick at rest or pulled
    back: a flip away from the blow, still facing it; pushed forward or across it is
    the ordinary roll), COMET (A in a back flip or a wall spring, or `COMET_WINDOW`
    after either lands: a thrust that rockets blade first along the stick, drawn to
    the nearest foe in a 54° cone, through everything in its way), TEMPEST (A from
    `TEMPEST_FROM` into the finisher, or `TEMPEST_WINDOW` after it: an aerial double
    whirl, each half turn a fresh blow all round), WALL SPRING (a roll that runs into
    a wall, met head on: it kicks off it, the way it came reflected; water and the
    map's own rim are no wall), SLIP (a foe's blow or shot through the roll's first moments: the world
    runs at `SLIP_SCALE` of its pace for `SLIP_TIME`, the hero at full pace, the
    screen tinted cool, and the next blow is critical, `Hero.edge`; once a roll,
    `SLIP_COOL` between; spikes, a fall, a stone, the hero's own bomb and any harm
    its caller does not mark a foe's are no blow).
  - *Mastery* (`Inventory.moves`, saved). A combo counts when it lands on a foe
    (BACKFLIP and WALL SPRING when done with one near, SLIP when it slips); `need` of
    them masters it, and a mastered one hits one harder (the finisher, the spin, the
    chop, the thrust, each of the tempest's turns), flies farther (BACKFLIP, WALL
    SPRING) or slows longer (SLIP). Its name is called out over the hero's head as it
    lands (`drawCallout`; the chain and the spin only their first and the mastering
    one), NEW MOVE the first time, MASTERED! with what it gives the last.
  - *The hop* (`ARTS`: HOP, the one art; it replaced PULSE, FLASH STEP, STARFALL and
    HALO on 2026-11-26). It sits on B among the items (`UseItem`, after them in the
    swap round; learning it puts it in hand, and the bomb bag found after goes in hand
    over it). The Keeper teaches it once the blade is in hand (`give: 'artHop'`). B: a
    quick low hop (`AIR.hop`, about two tiles) away from the nearest foe within
    `HOP.seek`, or along the stick when it is pushed, or straight back with no foe
    near; the hero turns to face the foe and stays facing it. In the air no foe's
    blow lands (the air's rule); it rests `cool` s (the B box and the B button dim and
    fill), each landed blow of the blade taking `ART_FEED` off it. It may cut a hit of
    the chain short from 35 % in, come out of a roll's second half, or out of a held
    charge (the charge is kept: let go once down and the spin comes). *Combined with
    the blade:* the chain keeps its count through the hop (`Hero.combo`, for the hop's
    time and `HOP.window` after), and A in the hop or within `HOP.window` of its landing
    is the **HOP CUT** (`hopCut`, a combo of its own, `B A`): the chain's next hit,
    sprung back in at the nearest foe within `HOP.reach` and `HOP.cone` of the aim (the
    stick turns it), `HOP.spring` tiles at most at `HOP.speed`, stopping short of the
    foe, a wall, a pit, spikes, ice and the room's edge; the cut sweeps once it stops
    (`Hero.swing.spring`, its clock below 0 while it springs). Out of the finisher the
    chain starts over (no tempest out of a hop). A foe's blow or shot that passed under
    the hop makes the HOP CUT critical (`hopDodge`, +1). Mastered, the cut bites one
    harder. A save from the four arts' days knows the hop, in hand where an art was
    (`parseSave`'s `OLD_ARTS`), with `item:artHop` set so the Keeper does not teach it
    twice; no boss teaches anything now.
  - *The MOVES page* (N, the second of the menu's three pages; on touch the deck's
    page button goes round ITEMS, MOVES, MAP): every combo with its buttons (A the
    blade in the hot colour, R the roll in the cool one) and a bar to its mastery,
    MASTER in gold once it is (a full gold bar where the word would run into the
    buttons; B, the hop, in gold); under them the hop in its slot (dim while resting,
    underlined in hand) with what it does, or `?` and where to find it (where to go,
    never how). No window: it lies on `PAGE_VEIL` with the tabs at the top, like
    the menu's other pages. It fits a phone on its side, and upright indoors (lab:
    `moves-hut`, `moves-new`).
  - *What it looks like* (`render/renderer.ts`, all views alike). In the air the
    roll's ball turns a quarter at a time (lossless turns, `putRot`) the way the hero
    flies, tucked going up and crouched coming down; the FLIP CUT raises the blade
    overhead before the chop, whose pose and whole-arc smear hold a moment after it
    lands (`chopAt`); the COMET is the finisher's lunge with a white streak of
    afterimages; the TEMPEST turns the swing round twice with the spin's smear. The
    HOP is the run's own frames (low, both feet off the ground, low again) facing the
    foe, lifted off its shadow, a short cyan trail and a small puff where it lands
    (the modelled hero: a stride of the walk held off the ground); the HOP CUT springs
    in with the blade drawn back, a white streak of afterimages and one long cut along
    the way (`Fx` `line`), and cuts where it stops. SLIP tints the screen and frames
    it. Sounds: `flip`, `comet`, `hop`, `slip` (the hop's short rest has no chime).
    The lab's `m-*` scenes catch each move (`m-hop`, `m-hopcut`, `m-hopcut-hit`),
    `moves` the page, `m-hud` the B box resting and a call-out.
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
  draws in the DOM (the touch deck's pictures, the
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
  it is still the 16 px art, treated on its way up, beside the redrawn
  people, hero and bosses (above); the bosses' crisp art shimmers a little more
  than the smoothed classic did as the king hovers (`steady.mjs` `king-stand`:
  1.40 against 1.20), and the deepseek and the troll are a little smaller than
  their classic sprites; the mistral's frames 1–3 turn the ribbons Codex's own
  way rather than the turned guides' (the face holds still within a px), its
  `down` heap shows the floor in small gaps between the coils, and the llama's
  two back steps differ little, so its walk away shows less than its walk
  toward the viewer; the hero's walk steps and arm swings are generic
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
  beside the drawn things but plainer; the machines' screens are the classic
  pictures doubled in their glass, a px off a cabinet's top and bottom edge, and their art arrives a moment
  after the view enters a room with them (the boxes stand until then); the square's stalls are several
  drawings each (a sheet holds no more), so their pieces were drawn apart and meet where the guide put
  them, the people behind their counters are the classic cards (head and shoulders over the counter, as in
  the classic), the long boards' and awnings' far ends are a few px nearer in depth than they are (the
  depth byte holds ±32 px), and the town now fetches their pack (about 60 KB); the eight keyboard directions are the
  eight world directions, so walking along a wall takes two keys. Not
  measured on a phone: the lab's GPU is software.
- **The art packs** (`iso/artPack.ts`, `iso/artPng.ts`, `iso/artIndex.ts`; ART-PLAN phase 3b, 2026-11-26).
  The stalls, the machines and every realm's kit (with its realm's gate arches) are not TS: each is an art
  pack in the fixer art library (project `neon-shrine`, asset `neon-shrine-pack-<group>`), thirteen in all
  (`stalls`, `machines`, `coast`, `fjord`, `fogstage`, `landing`, `meadow`, `quarry` for Lumenby, `rerun`,
  `seter`, `sporelight`, `stillsand`, `underglow`). A pack is two RGBA8 PNGs: `albedo.png` (the colour, and
  the px's depth in the alpha: at least 1 where drawn, 0 where clear) and `normal.png` (which way the px
  faces, and its glow in the alpha), pieces shelf-packed in sorted-id order, a `like` frame expanded to its
  own px; and an index file (rects, anchors, `src`, `drawn`) for the tools. The files are named by their
  content (`https://media.fixer.ink/art/neon-shrine/neon-shrine-pack-<group>/<role>-<sha8>.png`,
  immutable, CORS `*`), and `iso/artIndex.ts` pins each pack's URLs with their sha256 (`PACKS`) and every
  piece's rect and anchor (`ART_INDEX`), so the geometry is in the bundle and only the pixels are fetched.
  `loadPack` fetches a pack the first time the view needs it, checks both hashes, and decodes the PNGs
  itself (`artPng.ts`: fflate and the five row filters, 8-bit RGBA only), never through a canvas or
  `createImageBitmap`, which would premultiply the colour by the depth; a failed fetch is tried again after
  10 s (`RETRY_MS`). `things.ts` copies each piece's rect into the atlas (`paintPacked`); the classic view
  fetches none. All thirteen are 1.58 MB of PNG, against 1.68 MB for the gzip of the TS tables they replace
  (0.94×). Still TS, each until its phase moves it: the base things (`thingArt.ts`, `ferryArt.ts`,
  `roadsideData.ts`), the folk, the bosses, the frontier people and the foes' hurt frames, and the hero.
  **The bake step is `scripts/zelda-lab/art-pack.mjs`**; nothing writes art TS for these any more
  (`tests/zelda-no-art-ts.test.mjs` fails on a restored or new table):
  - a realm kit or the arches: `node scripts/zelda-lab/frontier-art.mjs <kit>` (re-bake from the solids,
    the drawn pieces kept) or `node scripts/zelda-lab/codex/kit-bake.mjs <kit>` (Codex's drawings in); both
    read the kit back from its pinned pack (`art-pack.mjs unpack --kit <kit>`) and hand the new table to
    `art-pack.mjs --kit <kit> --from-json`, which packs, uploads and rewrites `artIndex.ts`. `gates` goes
    into the six realms' packs. `--check` writes nothing and says which pieces would change; `--no-upload`
    writes the pack to `tmp/art-packs/<group>/` only.
  - a redrawn stall or machine piece: `node scripts/zelda-lab/art-pack.mjs --splice stalls <id>.json
    [--upload]` (each file a `ThingArt` record named by its id): the pinned pack is unpacked, the piece
    replaced or added, and every other piece keeps its px.
  - any pack whole from a table: `art-pack.mjs <group> --from-json <table.json> --upload`; a pack back to a
    table: `art-pack.mjs unpack <group> [out.json]`.
  `--upload` needs `FIXER_ART_KEY` (the environment or `~/.config/fixer-art/env`, on Sleeper and the Mac).
  Commit the rewritten `artIndex.ts` with the change: an old commit keeps loading its own pinned packs, and a
  bad pack is undone by the next pin. The tests read the packs from `.art-cache/` (git-ignored, every file
  hash-checked; `npm run art:pull`, also run before `npm test`), so they run offline once it is filled:
  `tests/zelda-artpack-parity.test.mjs` (the packs pinned at the move hold the TS tables' px, from git
  `c41be83`; the game's loader paints each pinned pack as `paintThing` paints it unpacked) and
  `tests/zelda-artpack-roundtrip.test.mjs` (the PNG writer and decoder).
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
- **Ambient life** (`render/life/`): fairies, owls, wisps and other small critters
  round the hero, gated by map, realm and hour. `docs/games/neon-shrine-life.md`.
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
  evening it comes back fresh. Only outdoor maps and only placed foes, the
  lands' among them: the town has none, dungeons, bosses, key carriers and
  tough foes are untouched. A sentry (a grazer too) leaves at noon and has no
  night twin.
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
last used) with the save's items. A save's own continue point is for death
during a session, and for a reload out in a land past the coast: while the
continue point is out there the shell keeps a per-tab flag (`zelda.out` in
sessionStorage), and a reload in that tab continues at it (`loadSpot`). A new
visit starts in town.

**The map** (`render/worldMap.ts`, `engine/explore.ts`, 2026-11-25; the
corner, `render/corner.ts`, and the MAP page, `render/mapPage.ts`,
2026-11-27). Every map but the rooms indoors is
cut into squares of 8 × 8 tiles, and a square is seen once the hero has been
within 10 tiles of it; a dungeon room is seen whole on walking in. What is
seen is kept per map as a string of six-bit digits, one bit a square
(`SaveData.explored`, at most 200 maps; the whole world seen is well under
6 KB). The map shows that as a **chart**, one ink a tile, in the land's own
inks (`CHART_INKS`, one table per look: the coast, the Wildwood, Seter Fell,
the snow, the dunes, the spores, the suburb, the quarry, the fog, the
Shrine's stone, the labs, the Underglow; keyed by the map's realm, else its
`look`, else the palette its kind is painted in): ground and its speckle,
low ground, roads, bridges, sand, water with its coastline in a lighter
blue, ice, two inks of trees, bushes, walls with their lit face and the dark
mass behind, roofs (never pink: pink is the hero), fences, doors, pits. Each
table is a step darker and flatter than the world, so the marks stand out. A
square not seen is **fog** in the land's two darkest inks; out of doors the
fog keeps a faint ghost of where water lies and where cliffs and pits run, so
a land just arrived in is already a map with a shape (a dungeon's fog has no
ghost: its plan is for finding). After the Sun Prism, a chart out of doors
dims toward navy with the hour (`nightLevel`): a step in the blue hours, two
at night, none by day, at dusk and dawn, and none before the Prism. The
**marks** are drawn over the chart at screen resolution, never into it
(`chartMarks`, `drawChartMarks`): the hero (pink, a pale nose the way they
face, blinking in steps, steady under reduced motion); chests (gold, dim
once opened, not at all while an appearing chest has not appeared);
heart pieces lying about (red, dim once taken); doors, stairs and warps (a
pale arch); the ways to other lands (a cyan gate where it lies in view, else
a tab on the rim toward it, filled with that land's colour once it has been
walked into, empty before); and in Lumenby the hill sign's seven sockets,
let into the rim, gold as each letter is lit. Marks appear only on seen
squares. Two of it:

- **The corner** (`render/corner.ts`, painted by `stepCorner` in
  `Zelda.vue` on one canvas that takes no pointer). The chart is its body and
  its frame says the view: a window of 40 × 40 tiles about the hero's tile (kept
  inside the land; one smaller is centred), one corner px a tile, in a
  square screen-aligned frame in the classic view and a 2:1 diamond with
  stepped edges in the isometric one, turning with the world through four
  shapes between (`frameMask`). Its edge is cyan with a ring of ink outside
  it, so it holds on bright sand and on the neon town. The Sun Prism sits
  on the corner that becomes the diamond's right tip: the view switch (see
  "Views"), and the day clock: in its window the sun hangs half sunk on a
  pink sky before the Prism is won, and after it follows the day (dawn, the
  day's arc, dusk, night with two stars; `sunPhase`). Where there is no chart
  (a room indoors, a cabinet's demo) a **stub** stands in its place: a small
  pane of glass with a door and the hero in it, the Prism beside it. Under
  the frame a **tag** stands 1.6 s: the view's name after a turn, a pinned
  Prism's refusal, a lesson. The area's own name is not on it: the HUD's
  banner says that. Three real buttons lie over the picture, placed from
  `cornerLayout` 14 px from the top and the right inside the safe area: the
  **chart** (`.zelda-mini`) opens the menu on its MAP page, as M does; its
  hit shape is the frame (a `clip-path` from the layout's polygon for the
  current shape), so a tap in the empty triangles beside the diamond falls
  through to the world, where it swings. The **Prism** (`.zelda-turn`)
  lies above the chart and wins where they overlap; its target is 44 × 44 px,
  down over its plate when pinned. The **pause chip** (`.zelda-chip`) opens
  the menu's ITEMS page, as P does: where there is a chart it is there for
  Tab and a screen reader only (a gold ring round the chart while it has
  the focus); where there is none it is the stub, on screen. So the menu is
  always a touch away, through a target of 44 × 44 px or more (in every shape
  of the turn; `tests/zelda-corner.test.mjs`). The chart can no longer be
  hidden (the old corner-map key, C on the MAP page, is gone; C is the roll).
  Beside a keyboard, key caps stand under the chart (M; P under the stub)
  and under the Prism (V). On touch, two lessons, once per browser
  (`zelda.cornerLessons`): about 1.2 s after the first picture in a place
  with a chart, a pink ring round the chart and TAP MAP: MENU; later, the
  first time the hero stands where both views are allowed, a ring on the
  Prism and TAP GEM: TURN. Each stands 3.6 s, and a tap on what it points
  at ends it for good; never while talking or away. A press shows: the
  chart's edge goes white for 90 ms, the Prism sinks a step. The corner
  steps away (by class, never `v-if`) while the menu, a dialog, a panel or
  a way out has the screen: its picture thins out in three dither steps
  (75, 50, 25 %) and is gone, and comes back the same way (at once under
  reduced motion). Its unit is one fine px of the canvas HUD, whole device
  px and never under one CSS px; `stepCorner` is its one writer
  (`--zelda-corner-u`), and the Escape pill, on a screen 640 px wide or less,
  stands below the corner by it (`.zelda-esc`). `node
  scripts/zelda-lab/corner-sheet.mjs [outDir] [sheet,…]` draws the corner
  from the real painter and the real world's data, in headless Chrome
  without the game's page (`CHROME_BIN` for another browser): a sheet per
  charted map (square and diamond, arrived, half and fully walked), every
  state (the turn's six shapes, the gem's sun, pinned, the stub, press,
  focus and key caps, the lessons, away, the tag, Lumenby's sockets, chests,
  pass tabs), the object over real pictures of the game, and the charts
  whole.
- **The ITEMS page** of the menu (P, Escape; `render/itemsPage.ts`) is in the
  MAP page's manner: no window, no HUD behind it, the corner's colours on the
  page's own veil (`PAGE_VEIL`), the menu's tabs at the top. Top to bottom on an
  upright phone:
  - **ON B**: a grid of 3 × 3 cells, one for each thing of `B_ITEMS` in its order,
    44 × 44 CSS px or more. An owned one shows its icon (bombs with their count);
    one not owned, and every cell after the last, is an empty socket with a dim
    outline and no hint. The one in hand has a gold frame. The cursor, cyan
    corners, stands on one cell; the page opens with it on the thing in hand.
  - **The line**: the name of what is under the cursor and one line of what it
    does (`B_WORDS`, beside `B_ITEMS` in `types.ts`); nothing on an empty socket.
    It keeps the room of the longest, so the page does not move with the cursor.
  - **ALWAYS**: what needs no slot, each shown once owned (`ALWAYS`): the blade or
    the Arc Blade, the big bomb bag, the Sun Prism, and THE NO, THE STOMP and
    THE LENS, which nothing grants yet (their flags: `item:no`, `item:stomp`,
    `item:lens`).
  - **The Weights**: a beam with seven hooks; a Weight held hangs in its pan with
    its own icon, an empty pan is a dim ring, `n/7` beside it. Not drawn until
    the first is held.
  - **HEART PIECES** (the four-part heart), in a place with a keyring (and in the
    Shrine) its small keys and its Big Key, and what is carried for someone.
  - **QUEST**: the pause screen's hint (`objective`).
  - Beside a keyboard, the last lines: `ESC RESUME`, `ARROWS PICK`, `ENTER TAKE`,
    then `T TOWN`, `O SOUND ON`, `V VIEW …`.

  Wider than tall, the grid and its line stand at the left and the rest in a
  column at the right. Where room is short the parts stand closer and the cells
  shrink (never under 44 CSS px), then they give way in this order
  (`ITEMS_GIVE_WAY`): the ALWAYS row, the quest's lines after the first (a cut
  one ends in `...`), the hearts' row. The grid, its line and the Weights stay.
  `itemsPageLayout` says where everything goes; it is pure, as are the pictures.
  - **Picking.** While the menu is open on ITEMS the arrows and WASD move the
    cursor (it stops at the edges) and Enter, Space, J or Z put what is under it
    on B (an empty socket does nothing); Q and Tab keep their meaning in play,
    and in the menu Tab moves the focus. On touch and with a mouse a tap on an
    owned cell does the same: the shell lays a bare `<button>` over each cell
    (`.zelda-page-cell`, under the deck, none under the start-over question;
    `aria-label` the name, `aria-pressed` for the one in hand, disabled on an
    empty socket), and the cursor follows the keyboard's focus. The pick sets
    `inv.selected` and nothing else; it is saved with the next save.
- **The MAP page** of the menu (M; `render/mapPage.ts`) is the corner's
  chart unfolded, in the corner's five colours in both dresses, with no window:
  it lies on the stopped world under a veil of its own, the same in both dresses
  (the corner's ink at 0.86, `PAGE_VEIL`). It has the whole screen from the
  menu's tabs (`P ITEMS`, `N MOVES`, `M MAP`), at the top with a small margin,
  to the touch deck, or the line `ESC RESUME` beside a keyboard: on every page
  of the menu the HUD's hearts, counters and item box are not drawn (they are
  back as soon as the menu closes, and stand behind the start-over question),
  and no banner, exit label or talk box stands behind it. What is under the tabs takes the middle of the
  rows that are left. A paused game is painted once, so nothing on it moves. Top
  to bottom on an upright phone:
  - **The title**: the map's name in gold, and under it in lilac the area the
    hero is in, where the map has named ones.
  - **The land**: the whole map, never cropped to what has been seen: the
    unseen squares are the chart's fog with its ghost. North up and square in
    the classic view, lying as the ground does in the isometric one, every px
    of the finest grid sampling the tile under it; as many whole px a tile as
    its box holds, never under one L (the HUD's logical px, the unit of the
    chart's own art). Round it the corner's frame (an L of cyan and an L of
    ink), the corner's marks on the seen squares (a pass is a gate at its own
    tile; Lumenby's sockets stand where they are, as tall lamps of 2 × 4 L,
    gold once lit), and the night tint. **The hero** is the corner's pink mark
    in a wider ring of ink; nothing lies on it, no pin and not the Prism.
  - **Pins**: each area whose middle square has been seen (and the one the
    hero is in, on the seen tile nearest its middle until then) wears its
    number on a small ink plate, lilac, gold where the hero is; a pin moves
    off whatever mark it would cover, never over the hero. No name is written
    on the land.
  - **The Sun Prism** on the square's top right corner or the diamond's right
    tip, its window showing the hour, with the view's name on a plate (`8-BIT`
    beside it on the square; under the diamond's tip `ISO`, or where the land
    allows one view dull facets and `ISO ONLY`, by the corner's own rule),
    and, beside a keyboard, a `V` cap by the plate (none where the view is
    pinned, since V does nothing there). Under the tip the plate
    hangs 3 L at most (`PLATE_HANG`), on a chain when pinned; `ISO ONLY` goes
    on two rows where one would lie on the land. **It is a button**, as in the
    corner: the shell lays a bare `<button>` over it (`.zelda-page-prism`,
    44 × 44 CSS px or more, from the layout's `gemHit`, under the deck) which
    does what the deck's `VIEW:` button and V do, refusal and live region and
    all; the keyboard's focus puts the corner's gold ring round the Prism. Tab
    moves the focus while the menu is open.
  - **The places**: the areas by number, in two columns where both fit, each as
    wide as what it shows; a seen one by name, the hero's in gold, one not
    seen `???`.
  - **The legend**, every glyph in words: `YOU`, `CHESTS 0/3` (opened of the
    map's chests), `HEARTS 0/1` (heart pieces taken of those lying about),
    `DOORS`, `PASSES`, and in Lumenby `SIGN 3/7`; on two rows where one does
    not hold. `chartTally` counts the whole map, seen or not, and never a
    chest or heart piece whose condition is unmet; a kind the map has none of
    is left out.
  - **THE WORLD**, on and under the maps of the grid once the blade is in
    hand: the nine maps where they lie, north up, as many tiles a fine px as
    the width needs (one on a 390 px phone in the 16-bit dress, two in the
    classic one: 182 logical px wide either way). All are drawn from the start:
    one not walked into is two-tone fog with a `?`; one walked into (the coast
    and the Wildwood always) is a plate of its ground with what has been seen
    in its chart inks, its name (without THE, else a short form from
    `WORLD_SHORT`: COAST, WOOD, FELL, FJORD, SPORE, SAND, RERUN, LUMENBY, FOG)
    and a cyan notch at each pass. The hero's land has a gold frame and the
    hero is a pink pip; that land is drawn from the live tiles, and the night
    tint is the land chart's. A chart too small to name three in four of the
    lands walked into names none (a 360 px phone in the 16-bit dress, where
    the grid's 364 tiles miss the screen by four). A land too low for it goes
    without its `?`, and on a very low one the pip is 2 L of pink with no ring,
    so neither leaves its box or the gold frame.

  Off the grid (the Shrine, the labs, the sea cave, the Underglow) there is the
  title, the land and the legend, in the middle of the page. **Indoors** the
  corner's stub (the door with the hero in it) stands large in the middle under
  the room's name and `OUTSIDE: <land>`, the one map its ways out lead to
  (`outsideOf`), with the world under it, the gold frame on that land and the
  pip at the door.

  A screen wider than it is tall puts the title, the land and the legend at the
  left and the world and the places in a column at the right. When room is
  short, parts give way in this order (`GIVE_WAY`): the list of places (the
  pins stay), the legend's words (glyphs and tallies stay), the world's size
  and with it its names, the world. The land and the title never go; the land
  gives up at most a quarter of its size before a part does, and more only to
  keep the world. On a wide screen the world is held at the size that names it
  wherever giving up the list, and up to a third of the land, makes room. The
  shell hands the renderer the top of the deck's buttons (`FrameUI.deckTop`,
  measured while paused). `mapPageLayout`, `landPicture` and `worldPicture` are
  pure (`tests/zelda-map-page.test.mjs`); `node scripts/zelda-lab/map-sheet.mjs
  [outDir] [name,…]` draws the page with the real painter and the real world's
  data on the real grids, in headless Chrome without the game's page
  (`CHROME_BIN` for another browser).

**Controls.** Keys: arrows/WASD move; Space/J/Z/Enter = A (sword, talk,
open, lift, throw, use an exit; pressed again, the next hit of the chain;
hold after a swing, release to spin; in a roll, a flip; see "Combos and the hop");
K/X/Shift = B (the item or art in hand); L or C rolls
(once the hero has the blade); Q, or Tab when there is an item, swaps (in the
menu Tab moves the focus); P or an
Escape tap pauses on the menu's ITEMS page (what B holds, to pick from with
the arrows or WASD and Enter, Space, J or Z; the Weights, heart pieces, the
current quest), N on its MOVES page (the combos, their mastery, the hop), M on
its MAP page (see "The map"); the key of the open page or Escape closes it, another
page's key turns to it. In the menu O turns the
sound on or off, T goes to town; V
turns to the next view anywhere (see "Views"). Holding Escape saves and
goes to town. Starting over
is the NEW GAME machine in Petter's house (see "Saves" below). Touch:
floating stick on the left 60 %; round buttons with pictures and no
letters: A always (its picture says what a press would do now, below), the roll (the hero curled up, a small green
ring over B, beside A while there is no item) once there is the blade, B
(the chosen item or the hop; the hop resting dims and fills from the bottom) and swap (two arrows) once there is an item or the hop, and the
lines call them THE SWORD BUTTON, THE ROLL BUTTON, THE ITEM BUTTON and THE
SWAP BUTTON (`keys.ts`, `{ROLL}` in a line: the blade's own lines name
the chain and the roll); on a phone lying on its side
they sit lower and more side by side, the roll a size smaller over B, so
the row stays out of the stick's 60 %; in the top-right corner a tap on the chart (or the stub indoors) opens the menu and a tap on the Sun Prism turns the view (paused, the deck holds the menu's buttons: RESUME and the next page round (ITEMS, MOVES, MAP); on ITEMS SOUND ON/OFF and TO TOWN, and a tap on a cell of the grid puts it on B; on MOVES ITEMS; on MAP VIEW); any tap moves a dialog on (a thumb that lands on the stick's side and stays down is the stick once the lines close);
a tap on the right of the world also swings. The world fills the whole
screen in portrait and landscape; the buttons float half see-through over
it. Installed as a web app the page runs under the notch and the status
bar: the shell measures the safe-area insets and the renderer keeps the HUD
and the dialog box clear of them (`resize(w, h, dpr, safe)`). The bottom
inset it measures is the site's bottom band, `--app-safe-bottom` (see
AGENTS.md), so the dialog box and the button deck stay above it.

**The A button says what it will do** (touch only; keys get no hint). One pure
function decides what a press does: `aPlan` (`engine/action.ts`), which
`stepHero` asks and then acts on; the deck asks the same thing through `aWould`,
once a frame (a few tile and flag look-ups: about 1 µs).

| The pad | `aria-label` | In front of the hero (or in his hands) |
| --- | --- | --- |
| sword, pink ring | Sword | nothing to use: a swing, or what the blade does in his state (the chain, the TEMPEST, the COMET, a shove, the air, a roll); also a locked door without its key (A only says it is locked: no promise), and the rest after a talk (`TALK_REST`) |
| speech bubble | Talk | a person, also across a counter; Luna when no foe is near |
| board on a post | Read | a sign, a tap or a socket of the tubes, a moon block without Luna, the newsstand, the NEW GAME machine |
| up arrow | Lift | a pot or a rock |
| arc | Throw | something is carried |
| chest | Open | a chest not yet opened and within reach; the login console, the NEW LOOK stall |
| arch with an arrow | Go in | an exit A uses: a cabinet, a terminal, a booth or a stall that leads away |
| key | Unlock | a locked door, with the key that opens it |
| lever | Pull | a lever not yet thrown; a mirror, a valve, a lumen tube; a moon block Luna can push; the viewfinder |
| coins | Buy | a shop's ware |

Every answer but the sword has a **cyan ring** (the second cue, for a thumb over
the picture). The button follows an answer once it has held 150 ms
(`A_PAD_HOLD`, `aPad.ts`), so walking past a row of pots does not flicker it,
and falls back to the sword at once when it is no longer true; a change pops from
85 % to full size in 120 ms (not with reduced motion). The picture is never
anything but what the press does (`aWould` is `aPlan`'s picture), in a fight
too: a pot can be lifted and a lever pulled with a foe at arm's length, and the
button says so. Pictures:
`render/spritesPad.ts` (coins: `item_bits`), in the 16-bit dress through EPX as
the sword is.

A talk branch can end in a two-way question (`ask` on `TalkBranch`: two labels, a reply each; left/right or a tap picks, B closes). The town cat uses it: TALK or PET (2026-10-01).
After lines close, A only swings until it has rested `TALK_REST` (0.35 s, restarted by each press), so mashing through someone's lines never starts them over (2026-10-06).

**Dungeon pieces: gates, keys, the Weights.** A gate is an `X` run with one
`gate` mark; it opens for good once its condition holds (`open`: a flag,
plates, `clear`), saved as `gate:<map>.<x>,<y>`. A **held gate** (a `latch`
beside `open`) is open only while `open` holds and shuts again when it does
not, never onto the hero, a walking foe, a block or the echo; once `latch`
holds it is open for good and saved as the others are (the Echo Barrow's
Answering Room: a plate, latched by the chest behind the gate, so a hero who
moves the echo from inside is not shut in for ever). A **pot stand**
(`{ t: 'stand' }`, tile `o`, in a dungeon's rooms) gives its pot back: once
the hero's room holds no pot at all (none standing, carried or in the air) for
1.2 s (`STAND_WAIT`), every stand of the room that is free gets one, all
together. A **trap gate**
(`{ t: 'gate', trap: true }`, in a dungeon's rooms only, no condition of its
own) is a room that locks: it is open, drawn and walked as floor, until the
hero is in its room and clear of its tiles while a foe that counts for
`clear` lives there (every kind but the `eye` and the `blade`); then it shuts,
with the gate's sound and a shake, and is a wall to walkers, rolls, the air
moves, the hook, the disc, shots and pushed blocks (a bomb's blast reaches
past walls, this one too). It opens for good when the room is clear. It waits
to shut while the hook's chain is out, or while a walking foe or a block is in
the doorway. A death, a warp out or entering any room puts an unbeaten one
back to open, the room's foes reset as always; with no such foe left it never
shuts. A beaten trap gate does not count as a solved puzzle: the room's push
blocks still go home. The Echo Barrow's two fight rooms have them. Small keys and the big key are per
keyring (`MapDef.keyring`, `docs/games/wildwood.md`); the big key says it
opens the great door to the King in the Shrine's ring and the great door
"here" in every other. A foe that `carries` a key needs a `once` flag
(`validate.ts`), or it would come back with another; none is placed. The
seven **Sacred Weights** (`WEIGHTS` in `types.ts`, one a land:
MEANING, REASONS, NO, SURPRISE, FINGERS, CREDIT, SOURCES) are items whose
grant sets only the flag `item:<id>` (`hasWeight`, `weightCount`), with the
heart container's jingle and a picture of its own
(`item_weight_meaning` … `item_weight_sources`: the brass weight, each with
its band; `item_weight` is the plain one), and the ITEMS page hangs each on
its beam with the same picture. No map gives one yet
(`docs/worlds/sacred-weights.md` is the plan).

**The Echo** (`engine/echo.ts`; item `echo`, a B item; the Echo Barrow's
treasure). Its words: YOU GOT THE ECHO! / {B} LEAVES ONE WHERE YOU STAND. WHEN
YOU CUT, IT CUTS.
- *Leaving one.* B leaves an echo where the hero stands, facing as the hero
  faces; B again moves it. It cannot be left on a pit or water, on or against a
  crystal block or a view block (nothing may stand where one rises), or in a
  door's tile (a doorway, stairs, an opened lock, a shutter's tiles): B there
  buzzes and the one before stays. It is gone when the hero leaves the room,
  dies or warps, when something solid takes its tile (a chest appearing), and
  out in a land once the hero is a screen away. `GameState.echo`, never saved.
- *Weight.* It weighs one, as the hero does: it holds a light plate, is half of
  a heavy one, balances a scale pan, and holds a plain plate `_` down as a
  block does. Nothing is pushed onto it.
- *The blade.* Every blow of the hero's blade is struck by the echo too, at the
  same moment, from where it stands: each hit of the chain, the spin, the
  comet, the tempest, the flip's chop and its ring. Same reach, arc and damage,
  centred on the nearest thing a blade can hit within that reach (a foe, a
  lever not yet thrown, a crystal switch, a pot), else along its own facing. It
  shatters the pots it sweeps, which the hero's own blade does not.
- *Its blows* carry `HitSource` `'echo'`. To armour it is the blade (a shield,
  a tough foe's poise and its opening's five, Mixtral's daze), but it keeps its
  own mercy on a foe (`Enemy.echoInvuln`), so its blow and the hero's both
  land. It never hurts or shoves the hero (no shield's shove, no zapper's
  shock), spends no SLIP's edge, feeds no art and counts for no combo.
- *Foes* neither see it nor strike it. A walker goes round it as round a pot;
  a charge goes through it.
- *The picture.* The hero's own frames in two tones of cyan at about 60 %
  (`echoSprite`; the isometric view two-tones its own hero art, `folkPic`), its
  swing frames and blade while it cuts, a soft ring on the floor under it. A
  call and its echo when it is left (`echo`), the blade's swish a little lower
  when it cuts (`echoCut`).

**Saves (on the profile since 2026-09-23).** The save belongs to the
browser's Hall of Fame player — the same pilot as the scores and the Hangar
ship. Nothing is written before the hero has the blade, so a visitor who
only walks round the town never becomes a player. `localStorage.zeldaSave`
(`SAVE_VERSION` 2: continue point, max hearts, inventory, flags, rng, play
time, `savedAt`) is the instant copy; every write also goes to the
player's slot `zelda` through `POST /api/save` (`composables/useGameSave.ts`,
one request in flight, keepalive). Written on every map entry, item,
secret, door, gate, boss, respawn, exit, TO TOWN and when the tab is
hidden. The server takes up to 32 KB of JSON (`SAVE_GAMES`; a bigger write is
refused and the client says nothing): a save with everything in the world done
is about 9 KB. What B holds is one of `B_ITEMS` (`types.ts`: the hook, the
disc, bombs, the echo, the arts); a save naming anything else loads with nothing in
hand. On load the shell starts on the local copy and pulls the slot in
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
key, gate, crystal, push block and appear-chest is wired. The dungeon pieces
(the Weights, trap gates, `bossOpen`, the B items, the save cap, key carriers)
are `tests/zelda-kit.test.mjs`; `SAVE_SIZE=1` prints what a full save holds.
The view rule and the Turn Room are `tests/zelda-view-rule.test.mjs` (every
mover in both views, the refusals, a scripted solve, the validator's failures,
the shell's wiring). The Echo Barrow is `tests/zelda-echo-barrow.test.mjs`
(the map and its order, the echo, the two rooms only it solves, Mixtral and the
Shield Hall fought by scripted players, the way from the door to the great
lock; `ECHO_LOG=1` prints each fight's time and blows taken).
The town's own
checks are `test:portal`. `node scripts/zelda-lab/shot.mjs <outDir>
[scenes]` renders the real renderer for named scenes without Nuxt (`r-*`
are the town, `r-road` the coast road); `scripts/zelda-lab/cdp.mjs` is a
small DevTools driver (no puppeteer on Sleeper) for headless play in the
dev server, which exposes `window.__zelda` (and `__portal`) in dev only.
Headless play verified 2026-09-24 (see `docs/games/portal.md`). **Not
yet:** physical-phone feel, music heard by a person, full manual
play-through.
