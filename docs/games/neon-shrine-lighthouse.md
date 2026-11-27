## Neon Shrine — the Lighthouse

Yule Fjord's dungeon: a tower at the fjord's mouth, climbed with one light, the **Storm Lamp**. Its beam "goes out
to sea and comes back with a hiss", and something up in the lamp room now answers it. Code: `world/lighthouse.ts`
(four maps), `engine/lamp.ts`, `render/spritesLighthouse.ts`; tests: `tests/zelda-lighthouse.test.mjs`. The design
and its Weight (REASONS): `docs/worlds/sacred-weights.md`, section 2. This page says what is built.

### The tower

Four maps of two rooms, each 32×12 (two cells of 16×12), `kind: 'dungeon'`, one keyring `lighthouse`, `realm:
'yulefjord'` (the skulls are draugs; the land's art kit loads), `look: 'snow'`, `views: ['iso']` (the 8-bit painter is
the fallback and draws every room), track `dungeon`. The cellar counts as a floor.

```
 FLOOR 3  lighthouse3   (0,0) THE GALLERY (dark)       (1,0) THE LAMP ROOM (dark, boss track)
 FLOOR 2  lighthouse2   (0,0) THE QUARTERS (dark)      (1,0) THE OIL STORE (dark, a hound)
 FLOOR 1  lighthouse1   (0,0) THE FOOT (entry, hub)    (1,0) THE PARLOUR (the lamp)
 CELLAR   lighthouse0   (0,0) THE ICE STORE            (1,0) THE FLOODED CELLAR (a hound)
```

**The door.** One tile of `yulefjord`, the middle of the lighthouse's foot (4,31), is a door (mark `Q`, tile `D`,
warp to `lighthouse1:door`); the way out lands on the path before it (entry `lighthousedoor`, 4.5, 32.5). The land
keeps its size. The tile lies inside the landmark's `cover`, as the Stillsand pyramid's door does.

**Reload.** `MapDef.resume` (on all four maps): a tab reloaded in the tower continues at its last stair or door
with its opened doors as saved (`awayMap`: `!!def.away || !!def.resume`). The tower is not `away`: no `seen:<id>`
flag, no area words, no world on the MAP page. The lamp is not saved and is back in the hand.

**Rooms.** Each is a plain tile room; the rooms are in `world/lighthouse.ts`, with their reasoning.

| Room | What is there |
|---|---|
| THE FOOT | the entry and the hub: a door south to the land, a way east, the stair down in a west alcove, in the north an alcove shut by `L` (a run of two) with the stair up behind it. A sign, WICK the cat. No foe |
| THE PARLOUR | the lamp in a big chest, taught in the light. A wall of pillars with a gap in row 6; the receiver (`lighthouse.parlour`) east of it. Lit, it shows the chest of small key A. The keeper's log. No foe |
| THE ICE STORE | salt ice from the rim to the east wall; two mirrors on the rim; in the east wall the sluice's eye (`lighthouse.drained`); the east doorway is sluice water. A sign. No foe |
| THE FLOODED CELLAR | the basin, drained when the hero is in it, and a rim; a trap gate on the west edge; a plain tough hound (`lighthouse.orca`) stands where Orca will. Its fall opens the gate and shows the chest of small key B |
| THE QUARTERS | dark; the stair down beside the arrival; a column of rotten boards (holes, `below: 'lighthouse1'`: a fall lands unhurt on the Foot, the quick way back) with a way across at rows 5 and 6. The receiver across them (`lighthouse.quarters`) lights the room for good. The heart's receiver (`lighthouse.heart`) in the south-east corner opens the gate of the heart piece's closet. East, `L` to the Oil Store. Three bats |
| THE OIL STORE | dark, never lit; a trap gate on its west edge; a plain tough hound (`lighthouse.hound`); pots and crates. Its fall shows the Big Key and opens the gate over the stair up |
| THE GALLERY | dark until its receiver is lit (`lighthouse.gallery`, also the cell's `lit`); a walkway two tiles wide round a block of wall; three mirrors on the inner corners; a gate in front of the Big-Key door that opens on the receiver; two draugs on the ring |
| THE LAMP ROOM | open floor with rock corners; the Box's pedestal `Ξ` (3×3, solid) and four lanes out of its faces laid as path; three receivers (`lighthouse.box.n/.e/.w`). No Box yet |

Keys: two small (`lighthouse1.keyA`, `lighthouse0.keyB`), two `L` runs (the Foot's, the Quarters'), one Big
(`lighthouse2.bigkey`), one `K` run (the Gallery's). Keys are fungible; both small-key chests are reachable without
any `L`, so no order locks. A death comes back to the last stair used: the Foot's stair for the cellar, the
Quarters' arrival for the Oil Store, the Gallery's arrival for the Lamp Room.

### The Storm Lamp

`ItemId` `lamp`, a B item (`B_TOOLS`, `TOOL_USE`, icon `item_lamp`). Its words: YOU GOT THE STORM LAMP! / {B} SETS
IT DOWN WHERE YOU FACE. {B} AGAIN TAKES IT UP.

- *Setting down.* B sets it on the tile the hero faces, shining the way the hero faces. It has a body: the tile `Φ`
  (solid; shots and sight pass), the floor under it remembered in `GameState.lamp = { idx, dir, under }` and put back
  when it is taken up. Walkers, foes, pushed mirrors, rolling stones and beams meet it as a solid tile. It never
  breaks and never slides, and weighs nothing on a plate.
- *Refusals* (B buzzes and the lamp stays in the hand): anything but plain floor (`. , : ; -` and drained `ψ`), a pit,
  water, ice, a plate, a door, `L`, `K`, a stair, a chest, a sign, any tile of a gate run (shut or open), a mark that
  takes the tile (a chest or item that appears there), another room, and any tile a block, a mirror, a pot, a person,
  a foe, the echo, a rolling stone or the hero's own circle covers.
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
  left alone unless its own rules say so (none yet).
- *Its life.* In the hand whenever the hero leaves the room, dies, falls, warps or the game is loaded (`lampHome`, from
  `enterCell` and `enterMap`). Never saved. A room that needs it can always be left, and a lamp can always be taken up
  by standing next to it.

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
| Parlour | 1 | the lamp in row 6; any other row ends at a pillar |
| Ice Store | 6 | both mirrors are needed: with either removed the receiver cannot be reached. Mirrors rest only at the ends of a slide; the lamp can stand only on the rim |
| Quarters, across the boards | 1 | the lamp anywhere in row 3 |
| Quarters, the heart | 4 | a lamp set in the nook shines east into the wall, and no beam but one turned south in the nook reaches the receiver |
| Gallery | 1 | the lamp beside the receiver; the way round the ring takes four (three turns and the lamp) |

Leaving a room puts its mirrors home (`enterCell`), so no push is a dead end.

### What parts two and three add

Part two: ORCA (`engine/bossOrca.ts`) and the dark hound (`dark: true` on a tough hound), in place of the two plain
tough hounds. Part three: the Black Box, the Weight REASONS, Grandad's two branches and the Lamp Room's light.
