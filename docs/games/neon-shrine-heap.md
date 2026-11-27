# Neon Shrine: THE HEAP

The Underglow's own missing end: the scrapyard where the Delvers' Union tipped everything it could not sell. Two maps
in `themes/zelda/world/heap.ts` (`heap1`, `heap2`), on the Underglow's keyring, isometric like the three floors above
(the classic painter draws them when the isometric view's code does not load). Its treasure is the Magnet, its
minibosses GROK and PHI, its boss the Scrape Golem, and where that falls lies the Sacred Weight CREDIT. It needs the
bomb bag (the door); no fight needs bombs, the hook or anything that runs out.

## The door

A hollow wall at the east of THE RAILS (`underglow1`, tile 27,11) opens to a bomb. The hole is a warp to the Heap's
first room; `underglow1:heap` is the way back. A sign stands beside it, and Sigge has a line about the knocking (and
another once the Weight CREDIT is held).

## The rooms

A line of rooms: one main line east, a siding to the key, a drawbridge for the way back, a stair down.

| Room | What it is for |
|---|---|
| The Hollow | the way in, the stair back up, no foe |
| The Sorting Floor | the Magnet, and the whole lesson with no foe: a crate comes over the pit onto a plate (the shutter opens), a bolt takes the hero over, a bolt in the rim brings the hero home |
| The Strongroom | a cart on a rail, sent to the plate in two taps from two pads; the small key behind bars |
| The Line | two bats, a pit crossed by a pillar's bolt, a lever that lets the drawbridge down, a piece of heart on an islet reached and left by two bolts, the locked door |
| The Pump House | GROK behind three trap gates, three loose crates, water, the stair down |
| The Dark Shift | five PHI behind a trap gate, played on the room's chart; then the Big Key's chest, in the light |
| The Foot of the Heap | the stair, the Big Key's door |
| The Heap | the Scrape Golem; two rails with a striped cart each, two pads, four scraps |

A death or a reload goes back to the last stair or door used: the Hollow's `door` until the Pump House's stair is
taken, the Foot's `down` after. `underglow1` keeps its size. The Underglow's ring counts four small keys and four
locked doors with the Heap's (the Line's), one Big Key and its door (the Foot's).

No post, pillar, torch or chest stands where the grappling hook would carry the hero over one of the Magnet's
crossings. The bridge's lever stands behind a stub of wall, out of the hook's line and the disc's reach.

## The Magnet

A B item, a tap (`engine/magnet.ts`): **B latches the nearest metal ahead; loose metal comes to the hero, the hero
goes to bolted metal.**

- Aim: the stick's while it is held, else the way the hero faces. 50 degrees either side, 1.6 to 7.5 tiles centre to
  centre, inside the hero's room, no wall or shut gate on the line (for a bolt or a cart, no other resting iron).
- While the Magnet is in hand, a cyan bracket lies under what a tap would take, and all metal glints. A tap with
  nothing to take fizzles. B rests 0.4 s after a latch, 0.2 s after a fizzle, and 5 s after it has pulled a PHI
  (`MAGNET.phiRest`): the bracket is gone meanwhile, and the B box (or the deck's B pad) shows the rest running out,
  as an art's does (`magnetRest`).
- Gold is metal: a PHI is the one foe it moves. It moves no other foe, no pots, drops, keys or bombs, a blast breaks no
  iron, and none of it is saved.

### Iron

Resting iron is a tile, solid to walkers and foes, open to shots and the blade's sight; none of it can be pushed,
lifted or bitten by the hook.

| Tile | | What it does |
|---|---|---|
| `▣` crate, `▤` scrap | loose | flies to the hero at 11 tiles/s, over pits and water, and rests on the last free floor tile of its line, short of any iron on the way |
| `▥` striped cart, `▦` cart | railed | rolls along its rail at 8 tiles/s to the rail tile level with the hero, and stops short of anyone on the way |
| `▧` bolt | fixed | takes the hero: the hook's pull at 13 tiles/s, untouchable on the way, set down a tile before the bolt (up to 2.5 back if that is no floor) |

Resting iron holds a plain plate down. Iron never comes to rest on a doorway, a gate, a stair, a chest, a pickup,
anyone, or off the floor; and no latch shuts the hero in: iron does not rest, and no bolt sets the hero down, where no
way on foot or from bolt to bolt leads to a doorway, a stair, a lever or a door any more. Such a tap takes a tile
further off, or fizzles. Iron off its home tile goes home when its room is entered again; smashed iron (`smashIron`)
after 5 s.

### Rails and pads

Two entities on marker chars. `rail { len, dir }`: its tile and the `len - 1` after it along `dir`; a cart is written
on one of them. `pad { dir }`: a cyan stencil on a floor tile, facing the metal it is a hint for. The engine never
reads a pad: the Magnet works from anywhere.

The validator (`world/validate.ts`) takes iron tiles as floor and a bolt as a latch: from open floor within 6 tiles
along a row or column in the same room, nothing solid to a shot between, to the tile before it. It checks that every
rail tile and pad is floor inside one room and that every cart stands on a rail.

## GROK

The Pump House's miniboss (`engine/heapFoes.ts`, numbers in `GROK`; hp 12, radius 0.5). Its card: GROK. IT KNOWS THE
WAY THROUGH. IT KNOWS NOTHING ELSE. The room's three trap gates shut with it and open when it falls (`heap.grok`).

- It walks at 2 tiles a second. Seeing the hero in its row or column inside 8 tiles, it tells for 0.7 s (a pink lane
  one tile wide to the first wall or iron in the line), then rolls down it at 8 tiles a second without steering.
  Nothing hurts it while it rolls; the roll costs 2 half hearts.
- A wall dazes it 1.6 s, open: the blade hurts it only then, 5 at most a daze. Iron in the lane is smashed (home after
  5 s), takes 2 at once and dazes it 3.6 s. The hero behind their own crate is safe.
- With half its hit points gone the tell is 0.6 s and it drills: it bores through the first iron of a lane (3 tiles a
  second for 1 s) and the second stops it. Two crates pulled into a stack are the answer.
- Bombs and thrown pots hurt it whenever it is not rolling; the disc, the hook and anything else clank.

In the 8-bit view it is a pale chrome dome ringed in ink over a dark face with two cyan eyes (pink as it tells and
rolls, gold dazed), a drill and two treads (`grokRows` in `render/spritesHeap.ts`; `frontierSprites.ts` takes its
`grok_*` rows from there). The isometric view has its own figure, baked against those rows
(`node scripts/zelda-lab/frontier-people.mjs` after changing them).

## PHI and the chart room

Five PHI hold the Dark Shift (`heapFoes.ts`, numbers in `PHI`; hp 2, radius 0.4, each its own `once` flag
`heap.phi1` to `5`). The room says (THE LAMPS HERE ARE OUT. SOMETHING ON THE CHART MOVES.) and PHI. VERY SMALL. VERY
GOLD. VERY SURE OF ITS PROPORTIONS. The trap gate shuts; when the five are down it opens and the Big Key's chest
appears.

- Each flits along a golden spiral at 1.4 tiles a second. With the hero in its row or column inside 6 tiles for 0.5 s,
  it tells for 0.6 s (a pink lane), darts down it at 7 tiles a second (2 half hearts) and rests 1.4 s, open. Never more
  than two tell or dart at once.
- The blade takes one only while it rests or is stunned; a swing begun within 1.4 tiles of any other sends it off.
- The Magnet pulls one to a tile before the hero, stunned 1.6 s.

**A chart room** (`CellDef.chart`; `render/chartRoom.ts`): while the hero is in it and any foe of it lives, both views
show the room as the Delvers' chart of itself, flat and north up, one ink a tile (`chartPixels`, `chartInks`): the rim
a page's edge, the hero with a cyan ring, each PHI as its own picture, pink lanes, a gold ring round an open one, the
Magnet's bracket and line, five pips along the top edge. The HUD is as ever, the stick is not turned
(`Renderer.charted`), and the corner stands square with no view's name on it (`CornerState.flat`). The page fades over
0.4 s at the last fall or the hero's leaving; with no PHI left the room is drawn as any other.

## The Scrape Golem

The Heap's boss (`engine/bossGolem.ts`, every number in `GOLEM`; hp 18). Its card: THE SCRAPE GOLEM. EVERYTHING IN IT
WAS SOMEBODY'S. It never leaves the middle of its room, the room-local point (8, 6): its mark stands on tile (8,6) and
`spawn.ts` sets its centre to that tile's top left corner. Nothing shoves or stuns it.

| | as it comes | grown |
|---|---|---|
| body radius (touch: 2 half hearts) | 1.2 | 1.6 |
| pull ring | 3.8 | 4.8 |
| a round | rest 1.6, tell 0.8, pull 2.2 | rest 1.0, tell 0.7, pull 2.4, tell 0.6, pull 2.4 |
| the hero is dragged at | 2.2 | 3 tiles a second |

- **The pull.** A pink ring shows how far. Everything loose inside it slides to the Golem at 4 tiles a second: scraps
  and crates, a thrown pot, a laid bomb, and the hero (walking at 5.4 they get away; a roll, a hop and the Magnet's
  flight are not dragged). A swallowed scrap or crate heals it 1 (never past 18) and is gone until the room is entered
  again.
- **The spit.** After a pull that did not choke it (grown: after the second), it tells 0.7 s with a pink lane through
  the spot the hero stands on and on to the wall, and spits a piece down it at 8 tiles a second (2 half hearts). It
  does so whether it ate or not, so that nobody standing outside the ring is safe for ever. A bomb it swallowed lands
  on the hero's tile with 1.2 s of fuse and its blast ringed.
- **The choke.** A striped cart whose tile's middle is inside the ring when a pull opens is swallowed, and nothing is
  eaten: 4.5 s, harmless to touch, the gold core showing, open. The blade (or the echo's) takes 6 hit points at most a
  choke and clanks for the first 0.3 s. After 1 s the cart rolls out to its rail's outer end, under anyone on the way.
  Nothing else ever hurts it.
- **Sending a cart.** From a pad, a tap with the Magnet facing the cart rolls it to the rail's inner end, inside both
  rings. The pads stand 5.15 from its middle, outside both.
- **Growing.** At the end of the choke that takes it to 9 or less it shakes 1.4 s, untouchable, flashes white and swaps
  to the larger heap.
- Three chokes beat it with a cart parked before every pull, four when a pull eats (the two inner scraps in the small
  ring, all four in the large one: 22 hit points in all at most).
- **The fall.** It fades over 1.2 s and leaves the Weight CREDIT where it stood (`heap.golem`; the item mark
  `heap2.weight`, `atFall`). Then the room says, once: (EVERY PIECE HAS A NAME STENCILLED ON IT. THE NAMES WERE ALWAYS
  THERE. NOBODY READ THEM.) (`heap.golem.down`, set when the fade is over). It stays down. Leaving the room before then
  finds it whole again, with its four scraps and both carts at home.

**Pictures** (`render/spritesGolem.ts`, `render/golemPaint.ts`): `golem_m_*` 48 x 48 and `golem_l_*` 64 x 64, four a
size (rest, pull, choke, fallen), the same pictures in both views. A tell shudders the rest frame, growing shakes it and
swaps it at the half behind a white flash, the fallen frame is shifted to sit where the standing ones do. The isometric
view stands it on a floor point a little toward the eye from its middle (`golemStand`), so that it lies on its ring; the
camera leans halfway to it, 3 tiles at most, where the room is wider than the screen (`golemFocus`). The ring, the lanes
and the blast's circle are floor stencils (`golemStencils`, `floorMarks.ts`), the flying piece `heapMarks.ts`'s.

## A reload in the Heap

`MapDef.resume`: a tab reloaded here goes on at the last stair or door used (`awayMap`), with doors, gates, the bridge
and chests as saved and the iron at home. Nothing else of `away` comes with it.

## Stand-in art

The five iron tiles (`heap_crate`, `heap_scrap`, `heap_cart`, `heap_cart_striped`, `heap_bolt`, in
`render/spritesHeap.ts`: the classic tile and the isometric card alike) are stand-ins drawn in code, and so is the rail
strip (`heapMarks.ts`). The Golem has no isometric family of its own and no frames for a tell, growing or spitting.

## Tests

`tests/zelda-heap.test.mjs` (`HEAP_LOG=1` prints its checkpoints): one scripted play-through from the hollow wall to
CREDIT in hand, with a reload on the way and every fight by real input; a hero who stands still before the Golem loses,
and the blade without a cart never hurts it; the Magnet in a save; and the maps against the validator, the key rule and
the door.
