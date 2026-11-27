## Neon Shrine — The Balance and the Supply Room

Under the Neon Shrine's pedestal: a balance with seven empty pans, three store
rooms, and the hall at the far end. Its place in the larger design:
`docs/worlds/sacred-weights.md`. Code: `world/balance.ts` (the maps),
`engine/balance.ts` (the pans and the level), `render/balance.ts` (both
painters' pictures). Test: `tests/zelda-balance.test.mjs`.

**What is built:** the lid, the Balance, the three store rooms and the way into
the Supply Room, which is an empty hall with its doors. THE PAPERCLIP MAXIMIZER
and the second ending are not built. Not every Weight can be won yet, so the
Balance's floor cannot be opened by playing; and THE DUCK does not exist, so the
Loading Bay is passed with THE NO or the blade.

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
    it, tap B: the crate rests on the plate. Standing in the far third of that
    tile leaves it a tile short; a step back and another tap brings it on.
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
  the gate before the stair out. THE NO refuses a lunge and opens a hound to the
  blade; the lever may also be cut with both of them standing. The south
  doorways stay open.

## The hall

An open floor with a sign, and its way back through a door behind a trap gate,
which shuts only while something in the hall lives.

## THE LENS from above

A chest mark with `hidden` may stand in a top-down dungeon room (the validator
lets it hold a small key there, never a big one). The ordinary painters leave
its tile bare; the glass draws it (`render/balance.ts`), full while it is up and
faint for the rest of the visit once shown, and the ring grows round a still
hero's feet. It is always solid, opens as any chest does, and is not on the MAP
page until opened.
