## Neon Shrine — the Lighthouse

Yule Fjord's dungeon: a tower at the fjord's mouth, climbed with one light, the **Storm Lamp**. Its beam "goes out
to sea and comes back with a hiss", and something up in the lamp room now answers it. Code: `world/lighthouse.ts`
(four maps), `engine/lamp.ts`, `engine/bossOrca.ts`, `engine/bossBlackBox.ts`, `render/lighthouse.ts`,
`render/spritesLighthouse.ts`; tests: `tests/zelda-lighthouse.test.mjs`. The design
and its Weight (REASONS): `docs/worlds/sacred-weights.md`, section 2. This page says what is built.

### The tower

Four maps of two rooms, each 32×12 (two cells of 16×12), `kind: 'dungeon'`, one keyring `lighthouse`, `realm:
'yulefjord'` (the skulls are draugs; the land's art kit loads), `look: 'snow'`, `views: ['iso']` (the 8-bit painter is
the fallback and draws every room), track `dungeon`. The cellar counts as a floor.

```
 FLOOR 3  lighthouse3   (0,0) THE GALLERY (dark)       (1,0) THE LAMP ROOM (dark, boss track)
 FLOOR 2  lighthouse2   (0,0) THE QUARTERS (dark)      (1,0) THE OIL STORE (dark, the dark hound)
 FLOOR 1  lighthouse1   (0,0) THE FOOT (entry, hub)    (1,0) THE PARLOUR (the lamp)
 CELLAR   lighthouse0   (0,0) THE ICE STORE            (1,0) THE FLOODED CELLAR (Orca)
```

**The door.** One tile of `yulefjord`, the middle of the lighthouse's foot (4,31), is a door (mark `Q`, tile `D`,
warp to `lighthouse1:door`); the way out lands on the path before it (entry `lighthousedoor`, 4.5, 32.5). The land
keeps its size. The tile lies inside the landmark's `cover`, as the Stillsand pyramid's door does. The isometric
picture stands at (4.5, 31.15), south of its footprint's middle, so that its painted door is at that tile; the 8-bit
fallback shows the footprint's own tiles with their door.

**Reload.** `MapDef.resume` (on all four maps): a tab reloaded in the tower continues at its last stair or door
with its opened doors as saved (`awayMap`: `!!def.away || !!def.resume`). The tower is not `away`: no `seen:<id>`
flag, no area words, no world on the MAP page. The lamp is not saved and is back in the hand.

**Rooms.** Each is a plain tile room; the rooms are in `world/lighthouse.ts`, with their reasoning.

| Room | What is there |
|---|---|
| THE FOOT | the entry and the hub: a door south to the land, a way east, the stair down in a west alcove, in the north an alcove shut by `L` (a run of two) with the stair up behind it. A sign, WICK the cat. No foe |
| THE PARLOUR | the lamp in a big chest, taught in the light. A wall of pillars with a gap in row 6; the receiver (`lighthouse.parlour`) east of it. Lit, it shows the chest of small key A. The keeper's log. No foe |
| THE ICE STORE | salt ice from the rim to the east wall; two mirrors on the rim; in the east wall the sluice's eye (`lighthouse.drained`); the east doorway is sluice water. A sign. No foe |
| THE FLOODED CELLAR | the basin, drained when the hero is in it, and a rim; two pillars for cover; a trap gate on the west edge; ORCA (`lighthouse.orca`), at home on the dry rim. Its card on the way in; its fall opens the gate, says its line and shows the chest of small key B |
| THE QUARTERS | dark; the stair down beside the arrival; a column of rotten boards (holes, `below: 'lighthouse1'`: a fall lands unhurt on the Foot, the quick way back) with a way across at rows 5 and 6, and a run of them along row 3 out to the west wall. The receiver in that wall (`lighthouse.quarters`) lights the room for good: no lamp can stand beside it, so the beam is sent from east of the boards. The keeper's bed lies past them. The heart's receiver (`lighthouse.heart`) in the south-east corner opens the gate of the heart piece's closet. East, `L` to the Oil Store. Three bats |
| THE OIL STORE | dark, never lit; a trap gate on its west edge; the dark hound (`lighthouse.hound`); pots and crates; a line on the way in. Its fall shows the Big Key and opens the gate over the stair up |
| THE GALLERY | dark until its receiver is lit (`lighthouse.gallery`, also the cell's `lit`); a walkway two tiles wide round a block of wall; three mirrors on three corners; the receiver in the west wall by the stair, behind the third mirror, with a pillar closing the way up to it from below; a gate in front of the Big-Key door that opens on the receiver; two draugs on the ring |
| THE LAMP ROOM | dark until the Box falls (`lighthouse.box`, also the cell's `lit`); open floor with rock corners; THE BLACK BOX on its pedestal `Ξ` (3×3, solid, low) with four lanes out of its faces laid as path; three receivers (`lighthouse.box.n/.e/.w`). Its fall leaves the Weight on the south pad |

Keys: two small (`lighthouse1.keyA`, `lighthouse0.keyB`), two `L` runs (the Foot's, the Quarters'), one Big
(`lighthouse2.bigkey`), one `K` run (the Gallery's). Keys are fungible; both small-key chests are reachable without
any `L`, so no order locks. A death comes back to the last stair used: the Foot's stair for the cellar, the
Quarters' arrival for the Oil Store, the Gallery's arrival for the Lamp Room.

### The Storm Lamp

`ItemId` `lamp`, a B item (`B_TOOLS`, `TOOL_USE`, icon `item_lamp`). Its words: YOU GOT THE STORM LAMP! / {B} SETS
IT DOWN WHERE YOU FACE. {B} AGAIN TAKES IT UP.

- *Setting down.* B sets it on the tile the hero faces, shining the way the hero faces; a hero whose shoulder is over
  that tile's line steps back off it. It has a body: the tile `Φ`
  (solid; shots and sight pass), the floor under it remembered in `GameState.lamp = { idx, dir, under }` and put back
  when it is taken up. Walkers, foes, pushed mirrors, rolling stones and beams meet it as a solid tile. It never
  breaks and never slides, and weighs nothing on a plate.
- *Refusals* (B buzzes and the lamp stays in the hand): anything but plain floor (`. , : ; -` and drained `ψ`), a pit,
  water, ice, a plate, a door, `L`, `K`, a stair, a chest, a sign, any tile of a gate run (shut or open), a mark that
  takes the tile (a chest or item that appears there; not the Weight's spot in the Lamp Room), another room, and any
  tile a block, a mirror, a pot, a person, a foe (not the Black Box, whose body is its pedestal here), the echo, a
  rolling stone or the hero's own circle covers.
- *Taking up.* B again within 1.6 tiles takes it up; farther away it moves it (up and down in one press; if that tile
  is refused it stays in the hand). One lamp at a time.
- *The beam* is one more emitter (`traceBeams` reads `lampEmitters`; the entries of `PhysState.beams` carry `src:
  'lamp'`): straight from the lamp, stopped by solids, crossing pits and water, turned by mirrors, split by prisms,
  ending in a receiver (which stays lit for good), and in the lamp's own room. It never hurts the hero. On a map
  with no puzzle tile, a lamp set down runs the beam alone (`stepPhysics`).
- *The burn* (`stepLamp`): a foe the beam crosses takes 1 hit point on touching and 1 a second after, on a clock of
  its own (`HitSource` `'beam'`, `burnFoe`: no mercy window, no shove, no poise). The first touch stuns it for
  `TOUGH.stunHook` s (a tough foe is open then, gold bar), then it shrugs the next stun off for `TOUGH.shrug` s; the
  burn goes on. The shrug is the lamp's own clock (`ai.lampShrug`), the same for every kind of foe. A `BIG` foe is
  left alone unless it is named in `LAMP_BURNS` (`engine/combat.ts`): ORCA only.
- *Its life.* In the hand whenever the hero leaves the room, dies, falls, warps or the game is loaded (`lampHome`, from
  `enterCell` and `enterMap`), and when the Black Box falls. Never saved. A room that needs it can always be left, and a
  lamp can always be taken up by standing next to it.
- *Its pictures.* Standing on the floor it is `lamp_down` and `lamp_down_1` (two frames of flicker) in the 8-bit view
  and the canvas-drawn isometric one; the WebGL isometric view builds a brass lantern that shows which way it faces.

### The dark

`CellDef.dark` has three levels, decided in the renderer's one `ambient()` (`render/renderer.ts`; both painters call
it): **black** (no lamp owned: as it was; the hero's ring 5.2 tiles), **dim** (the lamp owned: ambient `#4d4274`,
halfway between the black and a dungeon's own light, the hero's ring 6.2 tiles) and **lit** (the cell's `lit` flag
set by a receiver: not dark at all, for good). A lamp set down adds a light of 3.2 tiles at its tile in any room.

### The puzzle rooms, proved

Each room was searched by a breadth-first search with the engine's own rules at tile resolution (the hero walks and
slides on ice, pushes, turns a mirror with the blade, sets and takes up the lamp; walking is free, the hero faces any
way at no cost); the search is not committed. The fewest actions (setting down, pushes, blade turns):

| Room | Fewest | Notes |
|---|---|---|
| Parlour | 1 | the teaching room: the lamp in row 6, or past the pillars facing down the receiver's column |
| Ice Store | 6 | both mirrors are needed: with either removed the receiver cannot be reached. Mirrors rest only at the ends of a slide; the lamp can stand only on the rim |
| Quarters, across the boards | 1 | the lamp anywhere in row 3 east of the boards, facing west |
| Quarters, the heart | 4 | a lamp set in the nook shines east into the wall, and no beam but one turned south in the nook reaches the receiver |
| Gallery | 2 | the lamp in the west walkway facing down and the third mirror turned; the way round the ring takes four (three turns and the lamp) |

Leaving a room puts its mirrors home (`enterCell`), so no push is a dead end.

### Tells on the floor

What hurts in the tower is one stencil shape, a plain pink rectangle at any angle (`{ t: 'strip' }`,
`engine/stencils.ts` `stencilsOf`; painted by `drawStrip` in `render/lighthouse.ts`, from `drawFloorMarks`): flat on
the floor under everything that stands, in every view. A hero whose middle is outside it is not touched (`hot`: a beam
burning, painted solid). The Black Box adds two shapes that hurt nothing: `face` (a numbered strip) and `dash` (the way
of a beam to come). Light lies along all of them (`stripLights`), so they read in the dim. The Lamp Room's lanes are
edged faintly (`drawLanes`).

### ORCA

`engine/bossOrca.ts`, the numbers in `ORCA` (`types.ts`). `BIG` and a boss (fanfare, a save on its fall), 10 hit
points, radius 0.9; its touch does no harm. Card on the way in: ORCA. NOT A WHALE. NEVER WAS.

- *Rowing* (`idle`, 0.9 s at least): 1.2 tiles a second, keeping 3.5 off the hero and coming into line with him. Cover
  in the way, it rows round it to a place from which a lane runs to him (`berth`).
- *Drag*, further off than 2.6: the lane (2 wide, up to 5 long, along the longer axis toward where he stood) for
  0.8 s, then a dash at 10 tiles a second until its bow reaches the lane's end (a wall or a lamp ends it sooner); one
  heart, once. The oar planted: **open 2.2 s**. It holds the drag up to 1.2 s to get him near the lane's line.
- *Sweep*, nearer: the box (3 wide, from its middle to two tiles beyond its bow) for 0.7 s, the oar through it for
  0.25 s, one heart; **off balance, open 1.6 s**.
- *Open* the blade takes 5 hit points an opening at most (the echo is the blade); otherwise it clanks. Bombs and
  thrown pots hurt it at any time. The disc and the hook clank. Nothing shoves it.
- *The lamp*: a hit point a second, and the first touch stuns it 1.0 s (open), which ends a drag or a sweep announced
  or under way (`orcaStunned`); then 4 s in which no stun lands.
- It falls: `lighthouse.orca`, the gate opens for good, the chest appears, and a line.

Its pictures are the drawn frontier creature (`orca_row`, `orca_strand`, at twice their size in the 8-bit painter)
and its baked isometric family (`halfBoat`); burning, it is washed pink with flecks of flame.

### The dark hound

The tough hound with the mark's `dark: true` (allowed on a tough hound only, `validate.ts`): its hit points, poise,
two lunges and 1 s spent are the tough hound's (`TOUGH`). Different (`DARK_HOUND`): each lunge is aimed as its tell
**begins**, both tells are 0.7 s, and the lane (2 wide, to where the lunge and its bite end) lies on the floor all the
while, in every light. Its body is drawn only in the lamp's beam, in a lit room or within 0.9 tiles of the lamp's tile
(`unseen`, `engine/lamp.ts`); else two pink eyes at head height and its bar. The beam stuns it as any tough foe.

### THE BLACK BOX

`engine/bossBlackBox.ts`, the numbers in `BOX`. `BIG` and a boss, 14 hit points, radius 1.6. It never moves and nothing
shoves it; its touch does no harm. Card on the way in: THE BLACK BOX. NOBODY KNOWS WHAT IT THINKS. IT IS NOT SURE
EITHER.

**The faces.** A lamp's beam that meets the pedestal enters a face, told by the way it was going (south into it is the N
face). Only a lamp's beam does. Each face has a strip on its pad row, three tiles by one, with as many large squares as
its number: **N 1, E 2, S 3, W 4**. A face is told by its number, never by a colour. The numbers are painted again
over the lit picture (`drawNumbers`), so they can be counted in the dim and past the Box.

**The three receivers** take the Box's own beam and no other: a lamp's beam ends in one and lights nothing. Their flags
(`lighthouse.box.n/.e/.w`) are put out as a visit begins and at every rewire.

**The loop** (`e.ai.mode`):

| State | What happens |
|---|---|
| `idle` listening | shut, bobbing. A beam must be in a face 0.6 s unbroken |
| `think` 1.2 s | the face it will answer from glows cyan and a dashed line shows the way, to the first solid thing (a lamp too). The beam taken away: nothing happens |
| `answer` 2.2 s at most | its beam leaves that face, harmless; a receiver it reaches takes a panel off. The beam taken away ends it. After an answer the face asked is not heard until its beam has been off 0.4 s |
| `open` 6 s at most | with all three lit: gold bar. The blade (the echo is the blade), a bomb or a pot (3) take **6 an opening at most**, whatever strikes; its share taken, it shuts early. The disc, the hook, the stomp and the lamp do nothing |
| `rewire` 1.8 s | the strips spin, the panels close, the receivers go dark, the next wiring. A lamp left standing on the face last asked is still not heard: its beam must go off first |

**The wirings** (the face a beam enters → the face the answer leaves):

| Round | Name | N | E | S | W | To light N, E, W shine into |
|---|---|---|---|---|---|---|
| 1 | TURN | E | S | W | N | W, N, S (E is a dud) |
| 2 | FUNNEL | W | W | N | E | S, W, N or E |
| 3 | TWO FACES | E, pink S | S, pink W | W, pink N | N, pink E | W, N, S |

Three placements a round. In round three a pink beam (one tile wide, 0.5 s, one heart) leaves the face opposite the one
asked as the answer starts; its strip glows pink and its dashed line lies beside the cyan one through the think. After
the third round its wiring repeats.

**The blurt**, its only other attack, comes only while it hears nothing: 8 s after the hero comes in, 5.5 s after a
rewire, 5 s after an answer, and every 5.5 s after that. It takes the lane the hero stands in (from between the lanes,
any but the last): the strip glows pink and the whole lane is painted for 1.8 s, then filled for 0.5 s: one heart. The
floor between the lanes is in none. A pink beam never shoves, so nobody is thrown out through the great door.

**The fall:** `lighthouse.box`, the room lights for good, the Weight REASONS (`weightReasons`) lies on the south pad,
the lamp comes home, and a line: (THE BEAM GOES OUT TO SEA. THIS TIME IT COMES BACK THE SAME.) A hero who dies comes
back at the Gallery's stair; the Box begins again at round one.

14 hit points against 6 an opening: round three is always reached. Three openings kill it if one of them gives 6 and
the others 4 (one chain); three of 4 leave 2, for a fourth opening on the third wiring.

**On the screen.** While the Box is in the hero's room the camera rests on it (`boxFocus`: half a tile west of it along
the isometric screen's width) and gives way only as far as keeps the hero in the picture, so that on a phone every
face, its dashed line and the hero are seen together. (A slow phone in the isometric view's larger pixels shows a third
less width: there a hero at a lane's far end pushes the far strip partly off.) Its pictures are the drawn `box_0`, `box_1`, `box_think`,
`box_p1`, `box_p2`, `box_open`, `box_hurt` (48×48), at their own size in every view; its bar lies under it.

### Grandad

Two branches in Yule Fjord after his `gateShut` one, each said once: with REASONS held, "THE BEAM COMES BACK AS IT
WENT. I'LL MISS WORRYING."; without it, "THE LIGHT USED TO WORRY ABOUT THE BOATS. NOW I WORRY ABOUT THE LIGHT."

### Views

The four maps are `views: ['iso']`. The isometric view draws with WebGL2, and with a canvas painter (`render/iso/
legacy.ts`) where there is none; the 8-bit picture shows only if the isometric module never arrives. All three draw
every room, tell and number of the tower.
