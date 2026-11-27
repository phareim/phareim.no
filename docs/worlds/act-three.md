# Act Three (Fogstage's dungeon, seen from the side)

The design is section 7 of [sacred-weights.md](sacred-weights.md). This page says what stands in the game. The side
view, the cards and the Lens: [neon-shrine.md](../games/neon-shrine.md) ("The side view", "The Lens", "Cards"). Code:
`themes/zelda/world/actthree.ts`, `engine/lens.ts`, `engine/bossBard.ts`, `engine/sandbag.ts`,
`render/actthreePaint.ts`. One keyring, `actthree`; every map is `resume: true`, so a reload continues at the last
stair used.

**The door** is a stair in the north wall of `understage`, the cellar under Birger's stage. Birger, once asked, says
so. The way back down lands on the cellar's entry `upstairs`.

| Map | Name | Size | What is in it |
|---|---|---|---|
| `actunder` | THE UNDERSIDE | 16×24 | card SCENE ONE; the Crawlspace below, the Prop Room above with **THE LENS** and the prompter's box |
| `actdoors` | THE THREE DOORS | 16×12 | three doors on three platforms, two of them paint; a small key in plain sight |
| `actbard` | THE BOARDS | 16×16 | card SCENE TWO; **BARD**, who holds the gate to the shaft shut until it falls |
| `actflats` | THE FLATS | 16×12 | a painted step, two painted chests beside the second small key, a painted door |
| `actwings` | THE WINGS | 16×12 | a heart piece up three hidden platforms; locked door A |
| `actloft` | THE FLY LOFT | 16×24 | card SCENE THREE; below, the Grid: catwalks zigzagging up under bags to a ladder; above, the Leg: a catwalk under three bags, the great door west, locked door B east |
| `actstudy` | THE DRESSING ROOM | 16×12 | **the Understudy**, a tough sentry; the Big Key in a chest that comes when it falls |
| `actcable` | THE CABLE | 16×24 | card SCENE FOUR; eight clamps over the fog, three of them offered twice, one of each pair paint |
| `actgondola` | THE GONDOLA | 16×16 | the floor, the glass's plate, and the stair out behind a shut gate; no one in it |

**The way through:** the lens, the first key, BARD, the second key, door A, the loft's Grid and Leg, door B, the Big
Key, back along the Leg, the great door, the cable. The ring holds 2 small keys and 2 locked doors, the Big Key and
the great door. The gondola's gate waits on the flag `hallucinator`, which nothing sets: the climb ends in front of it.

**The cable** is the one room where a fall is a fall: off the bottom costs half a heart and puts the hero on the last
safe ledge (the foot, then the rows 18, 14, 12, 8 and 4). No real clamp and no part of the foot lies within 3 tiles,
sideways, of a painted clamp's middle below it, so a painted one always drops to the fog. The pairs are at the third,
sixth and eighth rung; the real side is the right one at the first and the left one at the others.

**The rules the rooms keep:** a step or a platform on the way on is 2 up at most and a gap 2 at most; a lock or a gate
fills an opening in a wall that no jump gets over; no foe within 8 tiles of a way in; nothing the way needs is hidden,
and a painted thing is on it only as a wrong guess.

**Stand-ins, drawn in code:** the backdrops (joists and fog, painted flats, ropes and rigging, night and the cable),
the stage's colours, the glass's ring and outlines, the prompter's box (a sign), BARD's three pieces, the sandbag and
its rope, the gondola's plate. The Understudy has no costume, and BARD's pictures are drawn from the front only.

**Checking it:** `node --test tests/zelda-act-three.test.mjs` plays it from the cellar's stair to the gondola's (its
controllers: `tests/zelda-act-three-bots.mjs`); `node scripts/zelda-lab/actthree-measure.mjs` measures every jump and
lock, the cable and the fights; `node scripts/zelda-lab/actthree-shot.mjs <local url> <outDir>` drives and pictures it
in the running shell.
