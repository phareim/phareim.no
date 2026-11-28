## Neon Shrine — The Balance and the Supply Room

Under the Neon Shrine's pedestal: a balance with seven empty pans, three store
rooms, and the hall at the far end. Its place in the larger design:
`docs/worlds/sacred-weights.md`. Code: `world/balance.ts` (the maps),
`engine/balance.ts` (the pans and the level), `engine/bossMaximizer.ts` (the
boss), `engine/clips.ts` (hearts turned to clips), `render/balance.ts` (both
painters' pictures), `render/clipHearts.ts` (the HUD's clips),
`render/spritesMaximizer.ts`. Test: `tests/zelda-balance.test.mjs`.

**What is built:** the lid, the Balance, the three store rooms, and in the
Supply Room THE PAPERCLIP MAXIMIZER up to its last question. The question is not
asked yet, the machine does not fall, and the second ending is not built. Not
every Weight can be won yet, so the Balance's floor cannot be opened by playing.

## The lid

The tile south of the pedestal in the Shrine (25,9) is a warp with
`when: { item: 'prism' }`. A **warp that waits** is floor and does nothing until
its condition holds; then its tile becomes the stair its mark names, with the
secret's jingle, as soon as the hero stands on none of its tiles
(`engine/objects.ts`; the tiles to the same place on the same condition open
together), and from then it works. The condition is read live and nothing is
saved: a save that already holds the prism finds the lid open. The validator
takes a `flag`, `notFlag`, `item` or `flags` condition there.

## The maps

Three maps, each `kind: 'dungeon'`, cells of 16×12, keyring `supply`, both
views, the Shrine's own walls and floor. All carry `resume: true`: a reload of
the tab continues at the last stair or door used, with its opened doors.

| Map | Rooms | Reload lands |
|---|---|---|
| `balance` | THE BALANCE | at the lid's stair (`lid`), or `hole` after coming back up |
| `supply` (16×36) | south to north: THE COUNTING ROOM, THE DARK STORE, THE LOADING BAY | `in`, the Counting Room's stair (from the Supply Room: `fromhall`) |
| `supplyroom` | THE SUPPLY ROOM (track `boss`) | `in` |

One small key (the Dark Store's hidden chest), one locked door (the Dark Store's
west door), no big key. One heart piece (`supply.heart`).

## The Balance

Seven brass pans on the floor (`PANS`), each with two painted rows under it: the
word stamped on its Weight and the Assessor that had it (greyed once the Weight
is back). A hero who walks in holding Weights does nothing: each goes down onto
its pan by itself, 0.4 s apart, in `WEIGHTS` order, with a chime, and sets
`balance.<word>`. The Weights stay held; one won later goes down on the next
visit. The counter `N/7` stands on the north wall over the SURPRISE pan, under a
brass beam that hangs tilted; the HUD shows `WEIGHTS N/7` under the counters
while the hero is there. One second after the seventh pan: `balance.level`, the
beam comes level, a shake, the line, and the middle of the floor (2×2) opens
into the Counting Room. Open for good. The stair back up is always there.

## The store rooms

Each has two ways; every B item is a tap.

- **The Counting Room.** The north gate opens for good on its two plates held at
  once (brass corners). All five plates are light plates (`θ`), which the hero,
  the echo and a resting iron crate (it weighs as a block does) all hold.
  - *Echo:* stand on one, tap B, walk to the other.
  - *Magnet:* from the tile before the far plate, facing the crate in line with
    it, tap B: the crate rests on the plate. A hero leaning over the plate from
    that tile is stepped back off it as the crate comes (`engine/magnet.ts`).
  - *The heart piece:* a closet in the north-west with a two-tile doorway, behind
    three plates (lilac corners) held at once: hero, echo and crate.
- **The Dark Store** (dim with the lamp, lit once `supply.lit` is set; the view
  is a rule here). A wall of square blocks across the middle, open at both
  sides; a receiver straight behind it.
  - *Lamp:* set it down facing north in line with the receiver. From above the
    blocks stop the beam; turned to the isometric view it passes, lights the
    room and opens the east gate.
  - *Lens:* a hidden chest in the west part holds the small key for the west
    door. Both doors lead into the Loading Bay.
- **The Loading Bay.** Two tough hounds. A lever in the north-west alcove opens
  the gate before the stair out.
  - *Duck:* set down in the south of the room, east of the middle, within sight
    of both: they stand looking at it while the hero walks to the lever. (Far in
    the south-east corner it is out of the western hound's sight.)
  - *No:* a cut as a lunge begins refuses it and opens the hound to the blade.

  The lever may also be cut with both of them standing. The south doorways stay
  open.

## The hall

An open floor with a sign, and its way back through a door behind a trap gate:
it shuts behind the hero, since the machine lives there.

## The Paperclip Maximizer

A copier overgrown with giant clips at the north middle (8.5, 3.5). It never
moves, and walking into it does no harm: **every harm is painted on the floor
before it lands**, and what is painted is what hurts (a lane or a circle costs
two half hearts). One bar of 24, notched at the two places a part ends (16 and
8). It opens with its card, once. In the isometric view, where a screen holds less
than the room, the camera leans from the hero toward the lit station, else the
machine. A hero its figure hides is marked by a cyan arrow over it.

It takes harm only while its bar is gold. Anything that strikes counts then (the
blade, the echo, a bomb, the disc, the hook, the lamp's beam, the stomp), and at
any other time clanks, with no shove and no mercy time. Nothing stuns it.

### Parts one and two (24 to 16, 16 to 8)

A cycle of about 7 s:

1. **work** (2.4 s). Part one, **the ring**: the floor is turned into clips from
   the west, east and south, two tiles at a time. It is told 1.4 s in pink, tile
   by tile, while a **cyan lane** stays: every tile within 1.5 of the line from
   the hero's tile to the machine's foot (8.5, 5.5), fixed as the tell begins.
   The tiles flash and stand as **piles**: low walls to the hero, to foes and to
   the machine's lanes; shots and sight pass. The machine's own ground and the
   block before the entry are never taken; an old pile in the cyan lane goes as
   the lane is painted; a hero on a taken tile, or shut off from the machine by
   the new piles, is shoved to the lane, unhurt. The ring comes twice (a narrow
   one, then a wider one); later work is a count and a flash.
   Part two, **the quota**: three circles, on the hero's tile and 3.2 to each
   side. A circle that holds the hero when they land (1.4 s) takes one heart for
   a clip: no hurt, one a volley.
2. **reach** (1 s told, 0.3 s standing). Part one: one lane at the hero's tile,
   10 long. Part two: two, 40° to either side of the hero's line, which stays
   free. **A lane ends at the first pile it would touch.**
3. **ask** (2.4 s, gold). The blade takes 4 hit points at most.
4. A breath of 0.6 s, and `work` again.

A hit never takes the bar past a part's floor. Reaching it starts a **beat**
(2 s, harmless): the floor sweeps clean in a wave, the next part's flag is set
with its line, and the hearts fill.

### Part three (8 to 1)

Four hearts turn to clips, and the seven Weights come down onto **stations**,
one live at a time: a brass disc two tiles across with its word, the Weight's
icon over it, a cyan ring and column. The Weight comes down (1.2 s); then the
machine blows (1.5 s told, 0.25 s landing, 1 s rest, again), until the hero
**stands on the disc**. That cancels a blow still being told, gives one heart
back (once a round), flashes at the machine (0.8 s) and opens it for 3 s: one
blow of any kind takes 1, and the next round begins. An opening left uncut
relights the station, which fires again only after the hero has stood off it
for 0.3 s.

| Round | Weight | Station | Its blow |
|---|---|---|---|
| 1 | MEANING | (3, 4.5) | one lane |
| 2 | REASONS | (13, 4.5) | one lane |
| 3 | NO | (3, 2.5) | the fork |
| 4 | SURPRISE | (13, 2.5) | the fork |
| 5 | FINGERS | (6, 7) | three circles |
| 6 | CREDIT | (13, 7) | three circles |
| 7 | SOURCES | (2.5, 7) | six lanes, one real; the five others hatched with a dotted edge, harmless |

The seventh cut leaves the bar at 1: **the question**. The floor is bare, nothing
can hurt, and the machine stands there.

### Death and reload

Only flags are saved: `maximizer.p2`, `.p3` (a part begun), `.w1` to `.w7` (a
round cut), `.q` (the question). A death or a reload puts the hero at the hall's
entry, and the brain's first step takes from the flags the part, the round, the
hit points (24, 16, 8 less the rounds cut, 1 at the question), and the clips a
first try would hold at that round.

## Hearts turned to clips

`GameState.clips` counts the hearts, from the end of the row, that are paper
clips; `heroCap` is `maxHp - 2 × clips`, and `hp` is held to it. **`maxHp` is
never lowered**, and the count is never saved, so a save made at any moment keeps
every heart. Two hearts can never be clipped. A respawn and any `enterMap` clear
it; a station gives one back. Nothing else of the hero's is touched. The HUD
draws a clipped heart grey-silver (`hud_heart_clip`), and a clip flies from the
hero to its place in the row. The first one brings one line.

## THE LENS from above

A chest mark with `hidden` may stand in a top-down dungeon room (the validator
lets it hold a small key there, never a big one). The ordinary painters leave
its tile bare; the glass draws it (`render/balance.ts`), full while it is up and
faint for the rest of the visit once shown, and the ring grows round a still
hero's feet. It is always solid, opens as any chest does, and is not on the MAP
page until opened.
