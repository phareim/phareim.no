# Neon Shrine: THE HEAP

The Underglow's own missing end: the scrapyard where the Delvers' Union tipped everything it could not sell. Two maps
in `themes/zelda/world/heap.ts` (`heap1`, `heap2`), on the Underglow's keyring, isometric like the three floors above
(the classic painter draws them when the isometric view's code does not load). Its treasure is the Magnet.

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
| The Pump House | three loose crates, water, the stair down |
| The Dark Shift | the Big Key's chest |
| The Foot of the Heap | the stair, the Big Key's door |
| The Heap | two rails with a striped cart each, two pads, four scraps |

No post, pillar, torch or chest stands where the grappling hook would carry the hero over one of the Magnet's
crossings. The bridge's lever stands behind a stub of wall, out of the hook's line and the disc's reach.

## The Magnet

A B item, a tap (`engine/magnet.ts`): **B latches the nearest metal ahead; loose metal comes to the hero, the hero
goes to bolted metal.**

- Aim: the stick's while it is held, else the way the hero faces. 50 degrees either side, 1.6 to 7.5 tiles centre to
  centre, inside the hero's room, no wall or shut gate on the line (for a bolt or a cart, no other resting iron).
- While the Magnet is in hand, a cyan bracket lies under what a tap would take, and all metal glints. A tap with
  nothing to take fizzles. B rests 0.4 s after a latch, 0.2 s after a fizzle.
- It moves no foes, pots, drops, keys or bombs, a blast breaks no iron, and none of it is saved.

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

## A reload in the Heap

`MapDef.resume`: a tab reloaded here goes on at the last stair or door used (`awayMap`), with doors, gates, the bridge
and chests as saved and the iron at home. Nothing else of `away` comes with it.
