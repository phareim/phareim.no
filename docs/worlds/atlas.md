# The atlas: Neon Shrine's greater world, planned by hand

The world beyond the coast is seven hand-made lands around the old coast and
the Wildwood, on one grid. Every outdoor map has a fixed place on that grid,
so a road that leaves one map at its north edge comes out of the next map's
south edge at the same spot, and the MAP page can draw the whole world as it
is. This replaces the generated frontier (89 regions from a seed).

How the lands grow out of the old world:

- The coast is a strip along the sea. Inland (north) the land climbs: the
  pastures of **Seter Fell** above the town and Whisper Woods, and above them
  the dark winter coast of **Yule Fjord**.
- North of the Night Market the woods turn to giant glowing fungus: **the
  Sporelight**. The Night Market's glowshrooms come from there.
- Behind the Hollow Graves' east wall the ground dries out into **Stillsand**,
  a pastel desert; the Sporelight's roots end where its white sand begins.
- The coast road past Mirror Lake runs on into the suburb of **Rerun
  Estates**, down to the sea.
- North of the Wildwood's Riddle Grove rise the quarry hills of **Lumenby**,
  where the coast's neon was dug; under them, **the Underglow**.
- West of the Wildwood's Deep Woods lies the fog lowland of **Fogstage**,
  down to the western shore.
- The ferry on the town's pier sails west round the cape and north up the
  coast to **Yule Fjord**'s harbour: the one way by sea.

## The grid

Tile coordinates, x east, y south. The overworld's top-left is (0, 0). A
land's place is its top-left on the grid; local = global − origin.

```
        x -172      -84   -40  0        48  72      104     152     192
 y -104                   ┌────────────┐
                          │ YULE FJORD │   (sea west of x -40)
  -52           ┌─────────┼─────┬──────┴──┬─────────┐
                │ LUMENBY │     │ SETER   │ SPORE-  │
  -12   ┌───────┼─────────┤     │  FELL   │  LIGHT  │
        │ FOG-  │ WILD-   │     │         │         │
    0   │ STAGE │  WOOD   ├─────┴───────┬─┴──────┬──┴──────┐
        │       │         │  OVERWORLD  │        │STILLSAND│
   32   │       │         │ (town+coast)│        ├─────────┤
        │       │         │             │        │ RERUN   │
   48   └───────┴─────────┴─────────────┘        └─────────┘ (sea south)
```

| Map id | Banner | Origin | Size | Look | Realm (kit + mood) | Extra kits | Track | Special | Views |
|---|---|---|---|---|---|---|---|---|---|
| `overworld` | THE NEON COAST | (0, 0) | 104×48 | coast | | coast | overworld | | all |
| `wildwood` | THE WILDWOOD | (−84, −12) | 84×52 | wild | | coast | forest | | all |
| `seterfell` | SETER FELL | (0, −52) | 72×52 | wild | seterfell | meadow | forest | | iso, classic |
| `yulefjord` | YULE FJORD | (−40, −104) | 88×52 | snow | yulefjord | | static | puzzles | iso |
| `sporelight` | THE SPORELIGHT | (72, −52) | 80×52 | spore | sporelight | | lab | | iso, classic |
| `stillsand` | STILLSAND | (104, 0) | 88×32 | dune | stillsand | | beach | puzzles | iso |
| `rerun` | RERUN ESTATES | (104, 32) | 80×40 | suburb | rerun | | village | | iso, classic |
| `lumenby` | LUMENBY QUARRY | (−84, −52) | 84×40 | quarry | lumenby | | static | terrain, the sign | iso |
| `fogstage` | FOGSTAGE | (−172, −12) | 88×52 | fog | fogstage | | indoor | | iso |

The overworld's and the Wildwood's rows never change size: blown boulders,
doors and explored tiles are saved by tile index.

## Ways between maps

**Gates** (from the hand-made world; warps, ids never change: saves continue
at `gate-<id>` on either side). The hand-made side keeps its warp, warden,
lamps and sign. The land side has a warp tile on its rim at the gate's grid
spot and the entry `gate-<id>` one or two tiles inside, with the realm's arch.

| Gate | Hand-made side (map, tile) | Grid | Land, rim tile (local) | Arrival faces |
|---|---|---|---|---|
| `fell` | overworld (45, 0) | (45, −1) | `seterfell` (45, 51) | up |
| `spore` | overworld (81, 0) | (81, −1) | `sporelight` (9, 51) | up |
| `sand` | overworld (103, 12) | (104, 12) | `stillsand` (0, 12) | right |
| `lawns` | overworld (103, 37) | (104, 37) | `rerun` (0, 5) | right |
| `quarry` | wildwood (39, 0) | (−45, −13) | `lumenby` (39, 39) | up |
| `fog` | wildwood (0, 20) | (−85, 8) | `fogstage` (87, 20) | left |

**Seams** between lands: walking off an edge where the ground is open carries
the hero into whichever map holds the next tile on the grid (`World.atlas`).
Each seam is one pass of three tiles, open on both sides; everywhere else the
rims are cliff, sea or forest.

| Seam | Grid | Side A (local) | Side B (local) |
|---|---|---|---|
| Fell ↔ Lumenby | x −1 \| 0, y −36…−34 | `seterfell` west (0, 16…18) | `lumenby` east (83, 16…18) |
| Fell ↔ Sporelight | x 71 \| 72, y −30…−28 | `seterfell` east (71, 22…24) | `sporelight` west (0, 22…24) |
| Fell ↔ Fjord | y −53 \| −52, x 22…24 | `seterfell` north (22…24, 0) | `yulefjord` south (62…64, 51) |
| Lumenby ↔ Fjord | y −53 \| −52, x −30…−28 | `lumenby` north (54…56, 0) | `yulefjord` south (10…12, 51) |
| Sporelight ↔ Stillsand | y −1 \| 0, x 130…132 | `sporelight` south (58…60, 51) | `stillsand` north (26…28, 0) |
| Stillsand ↔ Rerun | y 31 \| 32, x 150…152 | `stillsand` south (46…48, 31) | `rerun` north (46…48, 0) |

**The ferry**: the pier's warp (overworld (20, 38)) sails to `yulefjord`
entry `ferry` (the harbour); the harbour's warp sails back to overworld
`ferry`. The ferryman stands aside for the blade, as before.

**Stairs** lead to the hand-made teaching map, a place with a reason: THE PUZZLE LAB (`puzzlelab`), inside
Stillsand's gold pyramid. A **door** in the north wall of its first room, the Weigh House, leads on to THE TURN
ROOM (`turnroom`), a dungeon of one room off the grid that teaches the view as a rule (square blocks solid in the
8-bit view, diamond blocks in the isometric one; `docs/games/neon-shrine.md`, "The view as a rule"), and back.
A stair in the Lab's last room leads to THE EXAMINATION (`examination`, `examtop`), Stillsand's dungeon of scored
rounds, off the grid: `docs/games/neon-shrine-examination.md`.

## Loops

- Town → Whisper Woods → Seter Fell → Lumenby → the Wildwood → town.
- Night Market → the Sporelight → Seter Fell → Whisper Woods.
- Hollow Graves → Stillsand → Rerun Estates → Mirror Lake.
- Night Market → the Sporelight → Stillsand → Hollow Graves.
- Seter Fell or Lumenby → Yule Fjord → the ferry home.

## The stories start in the old world

Every questline's first step stands in a hand-made place, so the old coast
sends you out and the new lands send you back. Bearings are true on the grid.

| Line | Starts | Then |
|---|---|---|
| The cracked bell (`q.bell.*`) | SIGRID, lost in the NIGHT MARKET | ASLAK, Yule Fjord's stave church → RAGNA, the Clinker (Sporelight) → GUNN, Lumenby's union hall → RAGNA → ASLAK → SIGRID home at the Big Seter (Seter Fell), with SOLVEIG |
| The surveyor's pages (`q.map.*`) | TUVA, by the town's pier | ARNE, Stillsand's survey camp → PIA (Fogstage), STEINAR (Seter Fell's Cairn Ridge), OTTO (Rerun) in any order → ARNE |
| The stolen last act (`q.act.*`) | BO the busker, on THE BEACH | BIRGER in his bucket (Fogstage) → RALF's TV van (Rerun) → VEGA at the RAINCHECK's mast (Fogstage) |
| The clean seed (`q.seed.*`) | TENDER, at THE CROSSROADS | OLA's windmill (Sporelight) → the clean well's spirit (Sporelight) → the BED TENDER (Stillsand) → TENDER |
| Bror's lamp (`q.lamp.*`) | KNUT, on WILDWOOD SHORE by Mossa's cottage | GUNN (Lumenby) → BROR in the Underglow → GUNN |

The flags keep their names, so a save that got halfway keeps its place.

## The lands

Each land is about the Wildwood's size, with five to eight named areas, one
landmark you can see from far off, a settlement where its people live, the
realm's system in a place built for it, one cave or stair, one heart piece
reached by thinking, and a shortcut that loops back. Foes keep away from
gates, seams and settlements. People and lines come from the realm sketches
(`realm-*.md`) and `gen/realms.ts`, placed, not drawn from pools.

### SETER FELL (`seterfell`)
High summer pasture over the town. THE FELL ROAD climbs from the woods gate
through birches; LOWER PASTURE has hay meadows, a mill and fenced fields; THE
BIG SETER is the hub (huts round a meadow, churns, the byre, Sigrid's home,
Solveig, the barn nisse); TROLL HUMPS in the east are sleeping trolls as hills
(the old herder, the pass down to the Sporelight); CAIRN RIDGE in the north
carries the path to Yule Fjord past STEINAR's cairns; THE MOUNDS in the west
(the mound elder and the barrows) lead to Lumenby. UNDER THE
FELL is a cave behind a cracked boulder. South of the small mound by the stream
a flight of stairs with a sign goes down to THE ECHO BARROW (below; tile
(20, 26), back up at the entry `echobarrow`); while the Weight of MEANING is not
held the mound elder speaks of the hall under them and of the pantry the boulder covers, and once it is, says: QUIET
DOWN THERE NOW. I ASKED IT THE TIME. IT SAID NOTHING. LOVELY. The heart piece sits on a ledge seen
from the Big Seter and reached from Cairn Ridge.
Fights: blobs, bats, hounds and a sentry about the paths, and a tough sentry
guarding the spur to the heart piece's chute.

### YULE FJORD (`yulefjord`)
The dark time on a fjord that opens to the western sea. THE PASS comes down
from the fell and the quarry hills; THE STILTS is the sleeping village on
stilts (the lamp warden, a sleeper, the chalk girl); THE STAVE CHURCH stands on
a rise (ASLAK and the cracked bell); THE HARBOUR is the ferry's dock
(boathouses, the fishwife); THE LIGHTHOUSE watches the fjord mouth; THE ICE
FLATS hold the realm's puzzles (ice, beams). A sea cave under the cliffs. The
lighthouse's door (tile (4, 31), back out at the entry `lighthousedoor`) leads
into THE LIGHTHOUSE, a four-floor dungeon (`lighthouse0`…`lighthouse3`,
`docs/games/neon-shrine-lighthouse.md`) with the Storm Lamp.

### THE SPORELIGHT (`sporelight`)
Giant glowing fungus over clean white roots. From the market gate THE CAPS
rise; THE STEAMHOUSE is the spirit bathhouse on its pond (MS. B, PUFFER); THE
CLINKER is the smelter camp of the people the town turned away (RAGNA,
TRIXIE); OLA's WINDMILL; THE SHELLYARD with grazers; THE CLEAN WELL, whose
stair goes down to THE UNDER (the silent spirit and the seed); THE ROOT HOLLOW
in the south, with the grazers' pool to its east.
A door in the Steamhouse's south face (tile (39, 24), back out at the entry
`steamhouse`) leads into THE STEAMHOUSE, a dungeon with no keys (*The
Steamhouse* below). Once its first offer has been made, MS. B sends the hero
in; once the Weight of NO is held, MS. B has no form for that.
Fights: two slag hounds stalk the grazers' pool, on the road to the Clean
Well; in the Shellyard's pen three calm grazers patrol and leave the hero be
until struck, and a pink one, a tough foe, guards the shells chest: it stalks
and charges whoever it sees.

### THE STEAMHOUSE (`steamhouse`, `steamsuite`)
The Sporelight's dungeon, under the bathhouse: two maps in
`world/steamhouse.ts`, both views, no keys, a tab reloaded inside stays inside
(`resume`). Attendants offer a warm towel; a YES (or standing too long after a
NO, or a gift that lands) is a bath: back in the lobby, in a robe, at full
hearts, with nothing else changed. Seven rooms:

| room | what is there |
| --- | --- |
| THE LOBBY | the door, the pool (where a bath ends), the desk, the rack that takes the robe, the first attendant, the barred gate to the boiler |
| THE BATHS | the view rule: folding screens hide the north doorway in the isometric view |
| THE LAUNDRY | hung sheets, two baskets on two plates, an attendant over one of them |
| THE BOILER ROOM | two hounds (one tough), THE NO in its chest, the lever to the lobby, PUFF, and the stair behind a gate that wants THE NO |
| THE GIFT SHOP | optional: two attendants throw souvenirs; four refused open the heart piece |
| THE STAIR | the checkpoint before the boss |
| THE BEST ROOM | THE SYCOPHANT; THE END, which is paper; the Weight of NO; the door out to the lobby's desk |

The way: lobby, baths, laundry, boiler, stair, Best Room; the lobby's north
gate, once the lever is thrown, makes it boiler, stair, Best Room. How the
attendants, THE NO, the gifts and the boss work:
`docs/games/neon-shrine.md`, *The Steamhouse*.

### STILLSAND (`stillsand`)
A pastel desert after sunrise. From the graves gate the BONE ROAD runs east
past THE RIBS; ARNE's SURVEY CAMP; QUARTZ ISLANDS hang over the dunes; THE
GOLD PYRAMID holds the Puzzle Lab; the CARAVAN (ABEL) at the oasis; the
TENDER'S BED with its lens. North the dunes climb to the Sporelight's roots;
south they fall to Rerun's lawns.
Fights: dashers, blobs, drones and a sentry out on the sand, and a tough
sentry, the warden of the chest south of it.

### RERUN ESTATES (`rerun`)
One nice street, over and over, down to the sea. From the lake gate the
avenue runs to THE CUL-DE-SAC; THE DRIVE-IN (LENNY, ROSE); RALF's TV van;
THE HEDGE MAZE; THE PHONE BOOTH on its corner; THE MARINA on the shore.
OTTO delivers the paper. A bomb shelter under a lawn. In the middle of the
drive-in's screen there is a door (a sign below it): the Late Show.
Fights, the lawn answering back along a line: four mailbox spitters along the
north side of the avenue, two flamingo drones between the drive-in's lot and its
screen, two mower hounds by the fountain on the way to the marina, the west
one a tough foe that guards that way down.

### LUMENBY QUARRY (`lumenby`)
The town that dug every neon tube on the coast. From the grove gate the road
climbs to LUMENBY under the dark hill sign (seven letters, `quarry_letter_*`,
lit by the sockets' flags, `q.lumenby.sign1..7`); THE UNION HALL (GUNN); THE PIT, terraced, with the
heart piece on its stack (bombs, then the hook); THE DEEP DRIFT under its
headframe (MOTHER MAG) down to THE UNDERGLOW; chalk lots waiting for houses.
The ground has heights (`terrain`), and the realm's system is relighting the
hill sign letter by letter (`docs/games/neon-shrine-sign.md`).

### FOGSTAGE (`fogstage`)
A lowland drowned in pink stage fog, hill towns standing out of it like
islands. From the deep woods gate: THE TICKET HILL; THE FLATS (painted
scenery); BIRGER's bucket; THE RAINCHECK's MAST, where the blimp is moored
(VEGA, FINGERS); the GHOST LIGHTS; UNDER THE STAGE, the trap where act three
was stolen, with a stair in its north wall up into Act Three
([act-three.md](act-three.md)); the western shore.
Fights, by the water (`physics`): two blobs on the cut-grass bank of the Flats
pond and two skulls on the western shore, which drown when knocked in; two
bats by the ghost lights' nook, where the water is no help; a tough sentry on
the Flats meadow stands in the open west of the reeds chest.

### ACT THREE (`actunder` … `actgondola`)
Nine side maps under and above Fogstage's stage, on one keyring (`actthree`),
from the stair in `understage` to the RAINCHECK's gondola: the Underside (THE
LENS), the Three Doors, the Boards (BARD), the Flats, the Wings, the Fly Loft
(sandbags), the Dressing Room (the Understudy, the Big Key), the Cable and the
Gondola, where THE HALLUCINATOR sits on the Weight SOURCES and whose stair out,
open once it falls, comes down at the mast's gangway beside VEGA. Room by room:
[act-three.md](act-three.md).

### THE UNDERGLOW (`underglow1`…`underglow3`)
Three hand-made floors under the deep drift, two of the old six layers on
each: ECHO LEDGES and THE UPSIDE GROVE; THE GLASS SEA and BROADCAST; THE
FOSSIL ARCADE and THE CORE, whose Geyser goes home. BROR, SIGGE, HANNA, ECHO
and the HERDSMAN live down there. A bomb at the east of THE RAILS opens THE
HEAP (`heap1`, `heap2`): the scrapyard dungeon on the Underglow's keyring, with
THE MAGNET, GROK, PHI, the Scrape Golem and the Weight CREDIT
(`docs/games/neon-shrine-heap.md`).

### THE ECHO BARROW (`echobarrow`)
The hidden folk's hall under the Mounds, where every call comes back: a dungeon
(48×36, eight rooms of 16×12 on a 3×3 grid, the ninth rock), both views, on a
keyring and a crystal group of its own. It needs the blade and nothing else. A
tab reloaded inside it continues at the last stair or door used (`resume`): the porch, north of the Crossing once the Shield Hall's door has been walked in from the south, or in the great lock's doorway once the Parrot's room has.
Its look is `wild` (the chart's inks, the fireflies); the turf is laid as tiles
(`в`) round the Shrine's stone and pillars, since no look repaints a dungeon.

| Room (cell) | What is there |
|---|---|
| THE PORCH (1,2) | the entry; a sign; north to the hall, east to the Turning Stones. A death comes back here |
| THE TURNING STONES (2,2) | the view as a rule: a wall of square blocks, one of diamond blocks, the chest with small key A. Below it three rows in turn hide the heart piece (`echobarrow.heart`). A bat and a skull |
| THE HALL (1,1) | the hub, with pots. West a locked door; east a shutter that gives way to whoever holds the echo, and a locked door behind it; north the great lock |
| MIXTRAL'S ROOM (0,1) | both ways shut behind the hero; MIXTRAL; when it falls, a big chest with THE ECHO |
| THE ANSWERING ROOM (0,0) | a light plate holds a gate open only while something stands on it; behind it the chest with small key B. A sign. The echo stands on the plate |
| THE CROSSING (2,1) | a row of cyan blocks, ground, a row of pink ones, and one crystal switch south of both, out of reach past the first row. Leave the echo by the switch, cross the first row, cut. East of a wall, the short way down from the Shield Hall |
| THE SHIELD HALL (2,0) | the way shuts; two knights; then a big chest with the Big Key. A lever opens the short way down (once both are down) |
| THE PARROT (1,0) | behind the great lock: two pot stands and THE STOCHASTIC PARROT; where it falls, the Weight of MEANING |

The east shutter keeps key A for the west door: spent east, it would leave key B
behind a door with no key. The disc, the hook's owner or a bomb may cut the
Crossing's switch from afar; the echo is needed to get there all the same.

### THE LATE SHOW (`showbooth`, `reel1958`, `reel1986`, `chase1986`, `reel2086`, `weaver`)
Under the drive-in screen, which has shown the same picture for three nights: a
dungeon on a keyring of its own (`world/lateshow.ts`). It needs the blade and the
Stomp found in it. A projection booth seen from above, in both views, and reels of
film played from the side (the 8-bit picture), each opened by an intertitle card
and dressed in its year. A reload comes back at the last door or lens.

| Room (map, cell) | Year | What is there |
|---|---|---|
| THE SCAFFOLD (`showbooth` 0,0) | | the catwalk behind the screen over the dark; the stair back out; its line, once (`lateshow.seen`) |
| THE BOOTH (`showbooth` 1,0) | | the hub: a lens in the north wall for 1958 and for 1986, the second behind a locked door; the PROJECTIONIST; pots; east a gate COPILOT's fall opens; south the great door over the stair to the Screen |
| THE SNACK BAR (`showbooth` 2,0) | | THE USHER behind a trap gate; the lens of 2086 behind a locked door and a gate that opens when the Usher falls |
| MAIN STREET (`reel1958` 0,0) | 1958 | the porch the door opens on, a gutter (a hero who walks off the porch lands clear of everything), a blob on the curb, a sentry in the gutter, a manhole, and a ladder up the shop and down its far side, with a small key on the roof |
| THE BACKLOT (`reel1958` 1,0) | 1958 | a bat; a cracked floor over a nook with 20 bits; a platform up to the alcove ledge and THE STOMP; a blob below the ledge, to try it on |
| THE VIDEO STORE (`reel1986` 0,0) | 1986 | a spring pad up onto the shelves, a heart piece in the nook under their cracked top (closed on every side; only the stomp opens it, from above), a second pad up to the balcony and the way to the Road; two blobs and a ladder behind the shelves |
| THE ROAD (`chase1986` 0,0, 64 wide) | 1986 | the chase: the screen scrolls by itself over three pits and three parked wagons; COPILOT; the second key; the way back to the booth |
| THE OVERGROWN LOT (`reel2086` 0,0) | 2086 | two spring pads to the high slab, with the third key on it; two bats below, and a ladder |
| THE LAST REEL (`reel2086` 1,0) | 2086 | down from the slab; a pad either side of a block; the third locked door and the Big Key behind it; a bat, a blob; the way out |
| THE SCREEN (`weaver` 0,0) | blank | THE UNCANNY WEAVER: its stair on a landing two steps high, three pencilled outlines where its hands will land and leave three ledges up to its face; where it falls, the Weight of FINGERS |

The route: the screen, the Scaffold, the Booth, the 1958 lens, Main Street's key,
the Backlot's Stomp, back to the booth, the locked lens; the Video Store, the Road,
COPILOT and the second key; the booth's gate, the Usher, the locked lens in the
Snack Bar; the Lot's key, the Last Reel's door and the Big Key; the great door,
the Screen: the Weaver and the Weight. One small key a reel, and the Snack Bar's gate holds the order: when a
key is in hand, one locked door can be reached
(`node scripts/zelda-lab/lateshow-keys.mjs`). Without the Stomp a reel's own door
is the way out. LENNY speaks of the door until the Scaffold has been seen, and of
the picture once the Weight is held. No reel has a tune of its own: they play the
game's tracks.

## Rules for every land

- Ids: map id as above; chests `<map>.<name>`, never reusing a chest id from
  another map.
- Dialogue: whole sentences, at most three rows of the 180 px box, a name
  plate first, the pixel font's letters, one name per place (its banner).
- No new systems in this pass; a sketch's hook is only placed where the art
  and engine already carry it.
- Critters gated to a realm keep showing: `hayteacup` and `moonbloom`
  (once the Green Miles) live in Seter Fell's Lower Pasture.
