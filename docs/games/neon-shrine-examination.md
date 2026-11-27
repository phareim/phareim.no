## Neon Shrine — The Examination

The test behind the Puzzle Lab in Stillsand's gold pyramid. A dungeon with no
keys: rounds, each with a rule, a score and a pass mark, and a pass is what
opens the way on. Its place in the larger design: `docs/worlds/sacred-weights.md`.
Code: `world/examination.ts` (the maps), `engine/exam.ts` (rounds, stands, the
room that waits), `engine/duck.ts` (the Duck), `engine/bossFalcon.ts` (Falcon),
`render/examination.ts` (pads, strip, card, stencil shapes, the Duck, the pale
wash), `render/spritesExamination.ts` (pictures). Test:
`tests/zelda-examination.test.mjs`.

**What is built:** from the Lab's stair to the Perch's west door: the Front Desk,
rounds one to three, the Staff Room, the Duck and Falcon. Round four, the Marking
Room and the Titan's hall are walled floors with their doors.

## The place

The way in is a stair in the Puzzle Lab's last room, beside a sign (the Lab's
own way to that room is unchanged; the test needs only the blade). Two maps,
both `kind: 'dungeon'`, cells of 16×12, keyring `examination` (no key, no
locked door), `realm: 'stillsand'`, look `dune`, ambient `sandstone`, isometric
(`views: ['iso']`; the 8-bit painter draws it where that engine does not load),
`physics`.

**Warm sandstone.** A dungeon with look `dune` is painted in browns with gold
strips where the Shrine has violet stone and neon (`render/tiles.ts` `DG_SAND`).
The isometric view tells its floor and wall materials by those browns
(`render/iso/shaders.ts`, `uSand`) and has them in sandstone
(`render/iso/materials.ts`, the dune look's `flags`, `bricks`, `blocks`), so the
rooms stay sand with the materials off too. Its wall strips one tile deep are
closed on top and at the east end, and its pillars are plain stone.

```
 (0,0) THE MARKING ROOM  (1,0) ROUND FOUR  (2,0) THE PERCH  (3,0) ROUND THREE
 (0,1) THE FRONT DESK    (1,1) ROUND ONE   (2,1) ROUND TWO  (3,1) THE STAFF ROOM
```

`examtop` is one room, THE TITAN'S HALL.

The path is a snake from the Desk east, up and back west. Every door back the
way the hero came is open. A round's exit is a gate on its pass flag
(`exam.<id>`), saved as every gate is: a round is never passed twice. The
perch's west door is a trap gate. The stair to the hall opens on all four pass
flags; the Marking Room's south gate, down into the Desk, on its lever
(`examination.back`).

`MapDef.resume` marks both maps: a reload of the tab continues at the last
stair or door (`awayMap`), and nothing else of a land comes with it.

**What `realm: 'stillsand'` brings:** the realm's art pack in the isometric
view (no landmark of it stands here), its foe skins (a spitter is a cactus
that walks). The chart is inked by the look (`dune`). None of the realm's
critters live indoors.

## A round

A camera room with `CellDef.round`: `{ id, entry, pass, max, rule?, foeWorth?,
penalty? }`. Its state is live and never saved (`MapState.exam`); what lasts is
`exam.<id>` (passed) and `exam.<id>.full` (every mark). Nothing clears them.
`stepExam` runs on the hero's clock, from `play()`.

- **Begins** when the hero is in the room and it is not passed, on a reload too.
  Coming into a round's room makes its entry the continue point, passed or not.
- **The strip**, two rows centred under the hearts: the rule's short name, then
  `MARKS n   PASS n`, lime once there are enough. It drops under the counters
  and the item box where it would lie on them, and under the corner chart on an
  upright phone.
- **Marks:** the worth of every pad latched, plus `foeWorth` for each foe of the
  room that is down (killed, fallen into a pit, crushed), less penalties (a
  heart lost, `penalty.hurt`; half a heart, half of it). The strip may show
  less than nothing; a result is never below 0.
- **Ends** on the HAND IN pad. A round with no mark pad also ends as its last
  foe falls.
- **The result:** `pass` marks set the pass flag, `max` the full one. The room's
  foes, shots and thrown pots are gone at once, and the card plays.
- **The card:** a corner of an exam paper over the top third of the screen for
  2.2 s (`EXAM.card`): the round, a box for every two marks with a line at the
  pass mark, and a stamp, PASSED or RESIT. Play goes on under it; it cannot be
  skipped, and it is no ending.
- **The resit:** after a RESIT card a fade back to the same map at the round's
  entry, loaded afresh: foes, pots, panes. No heart is lost and nothing is taken.
  A hero who walked out while the card played stays where they are.
- **Walking out** of a running round abandons it; coming back begins it afresh.
  A death does the same through the continue point.
- **Quiet:** a passed round has no strip, no rule and no foes.

**Pads** (`{ t: 'pad', id?, worth?, size?, hold?, when?, pic?, handin? }`): `size`
tiles square from the mark; a cactus is worth 2, any other picture −2. One
latches when the hero has stood in it `hold` s (0.35) at no more than 1 tile a
second, not rolling or in the air; `hold: 0` on touch; with `when`, as soon as
that holds. A ring fills as the hero stands, then a tick (cyan) or a cross
(pink), laid on the floor so that they read in either view. A `handin` pad is a
gold plate with HAND IN standing over it, in a niche by the way out, a desk
beside it. The validator refuses a pad with no picture, worth or hand-in, and a
pad outside a round.

**`noBlade`:** the swing, the spin, the flip, the comet and the tempest do not
start. A still lifts, throws and talks; the roll and the hop work.

**Pot stands of their own** (`{ t: 'stand', wait }` on a pot or rock tile): `wait`
s after its pot went, a stand gets one back, as soon as nothing is on the tile
(the hero, a foe, a thrown pot, a block, a bomb). Live only
(`MapState.stands`). A stand with no `wait` follows the room's rule instead
(`docs/games/neon-shrine.md`, "Dungeon pieces").

## The rooms

**The Front Desk.** The stair back to the Lab, and the INVIGILATOR, who says
once that rules are on the doors and is silent after.

**Round one: NO BLADE** (pass 6 of 10). Two blobs, a skull, a sentry, a dasher,
2 marks each. Six pots and three stones on stands (5 s), three short pits. A
thrown pot takes 2 hit points: a blob or a dasher falls to one, a skull or a
sentry needs two, or one that knocks it into a pit. Three foes pass. Bombs,
the disc and the hook are not the blade and work.

**Round two: PROVE YOU ARE NOT A MACHINE** (pass 10 of 12). Eleven panes of 2×2
on the floor, five of them a cactus, one-tile aisles between. The sixth cactus
walks: a spitter whose home is the bare sand in the middle of the board; it is
worth 2. Five right panes and none wrong pass; the walking one and four panes
pass; all six cactus and nothing wrong is full. The blade works.

**The Staff Room.** The chest with the Duck (appears on `exam.r2`), a 3×3 pond
that nothing drains, and the north gate on the plate `exam.pond`: the float
plate in the pond's middle. From the pond's west edge, facing east, the Duck set
down two tiles ahead is on it; the gate opens for good. The way back west stays
open, and the chest's condition is a flag nothing clears, so nobody is locked in.

**Round three: TIME MOVES WHEN YOU DO** (pass 6 of 10; a heart lost costs 2).
Five mark pads (2 each, latched on touch, gold ticks) among aisles of low walls,
two drones and two sentries (the engine's own, 2 hit points a drone, 4 a
sentry). The HAND IN pad is in a niche by the west door. The Duck draws a guard
off its lane, which makes full marks easy; the blade alone passes.

**The Perch.** Falcon, behind a trap gate on the west door. A death here goes
back to round three's door (a quiet room by then).

## Time waits (`rule: 'still'`)

`stillK(s)` (`engine/exam.ts`) is the world's share of the hero's clock, 1
everywhere but in such a round while it runs. `play()` multiplies it into the
time `stepEnemies` and `stepObjects` get: foes and their brains, shots, thrown
pots, bomb fuses, boulders, blocks, the disc, gates and plates. The hero, the
hook, Luna, the round's clock, the pads, the card and the strip keep their own.

- The hero **does** while the stick is held past 0.2 (and until it falls under
  0.1), or during a swing, spin, roll, air move, lift, throw, item use, hook,
  push or shove. `k` runs to 1 at 20 a second; otherwise to 0 at 12 a second
  (`STILL`). At 0 nothing of a foe moves or decides.
- Below `k` 0.5 the room shows it: the world one step paler with the hero clear
  of the wash, a pale outline on the foes, a small clock with still hands on the
  strip, and a pulsing cyan outline on the hero (steady under reduced motion; in
  isometric with the modelled figure, none). When `k` reaches 0, one lowered
  `select` (`hush`).

## The Duck (`engine/duck.ts`)

A B item (`duck`), given by the chest and put in the hand at once. Its picture is
the B icon, on the HUD and on the floor.

- **B** sets it on the farthest of the tile two ahead, the tile one ahead and the
  hero's own that will take it: open ground, a plate or pan, sluice water or its
  bed. Not a pit, spikes, anything solid, a door, stair, warp or gate (open or
  shut), nor a tile with a foe, a pot, a block, a boulder, someone or the hero on
  it (the hero's own tile excepted, of course). It goes over water or a pit to
  the second tile, never through a wall or a shut gate. With nowhere, a buzz.
- With it down, B within 1.2 tiles takes it up; B anywhere else moves it.
- It is not solid, nothing hurts it, and it is gone with the room, on a death or
  a warp. `GameState.duck` is never saved: after a reload it is in the hand.
- It **weighs one** (light plates; heavy ones with the hero; scale pans; not the
  push-block plates `_`) and it **floats**.
- **Foes look at it** (`lured`, asked before a foe's own brain): one that is no
  boss (nor PHI), that can be hurt, is not calm, stunned or reeling, nor (a tough
  one) mid strike, within 7 tiles with a clear line, walks to 1.4 tiles and
  stands facing it for 8 s, then is bored for 4. Its touch still hurts. A blow
  ends the look (3 s before the next); taking the Duck away ends it too, and the
  foe is bored; moving the Duck within sight keeps it looking.
- No fight and no round needs it. Only the Staff Room's gate does.

## Falcon (`engine/bossFalcon.ts`, `FALCON`)

10 hit points, radius 0.8, flies. A card on first entry. Once on its perch
(1.6 s), then in turn:

- **fly** 2.4 s round the room's edge;
- **tell** 0.9 s: it hovers; a pink lane (0.5 wide) to a ring (1.1) on the Duck if
  it is down and in sight, else on the hero's tile. Aimed once;
- **dive** at 12 tiles a second. The lane hurts as it passes, the ring where it
  lands (a heart, once). A Duck in the ring hops aside;
- **stuck** 2.4 s (3.6 s if it dived at the Duck): open (gold bar), harmless to
  touch. The blade takes 6 at most an opening; thrown pots and blasts hurt too.

In every other state every blow clanks off it, and its touch costs a heart (in
the dive, only the lane and ring do). The disc and the hook never hurt it. At
half its hit points the tell is 0.65 s and it dives twice, aiming again 0.5 s
after it lands, stuck only after the second. Two openings fell it. It falls once
(`examination.falcon`): the gate opens and a line is said.

## Drawing

Pads and stencils lie on the floor under everything that stands
(`floorMarks.ts`, both painters). The strip is in the HUD (`hud.ts`), the card
over it (`renderer.ts`). `Stencil` (`engine/stencils.ts`) has three shapes of
the examination's beside the lane: `disc`, `box` and `path` (any angle), each
with a fill `k` and a `dim` copy (`drawShape`); Falcon shows a `path` and a
`disc`. Falcon's pictures are the frontier's (`falcon_*`), at twice their size in
8-bit as the other heavy ones; the isometric view has its own.

Stand-ins until drawn: the Duck on the floor (its B icon), the five pane pictures (`pane_cactus`, `pane_palm`,
`pane_stone`, `pane_cloud`, `pane_bones`, 32×32) and the walking cactus
(`BEASTS.cactus` and its `popped` pose, which the isometric view shows as the
classic sprite until the frontier's folk are baked again).
