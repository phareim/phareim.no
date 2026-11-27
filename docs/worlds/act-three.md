# Act Three (Fogstage's dungeon, seen from the side)

The design is section 7 of [sacred-weights.md](sacred-weights.md). This page says what stands in the game. The side
view, the cards, the Lens and the two bosses: [neon-shrine.md](../games/neon-shrine.md) ("The side view",
"The Lens", "Cards", the bosses). Code: `themes/zelda/world/actthree.ts`, `engine/lens.ts`, `engine/bossBard.ts`,
`engine/bossHallucinator.ts`, `engine/sandbag.ts`, `render/actthreePaint.ts`, `render/spritesHallucinator.ts`. One keyring, `actthree`; every map is `resume: true`, so a reload continues at the last
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
| `actgondola` | THE GONDOLA | 16×16 | **THE HALLUCINATOR**, the glass's plate, the Weight **SOURCES** when it falls, and the stair out behind its gate |

**The way through:** the lens, the first key, BARD, the second key, door A, the loft's Grid and Leg, door B, the Big
Key, back along the Leg, the great door, the cable, the Hallucinator, the Weight, the stair down to the gangway. The
ring holds 2 small keys and 2 locked doors, the Big Key and the great door.

**The gondola** is one room: the stair in at the west (`stair`), the plate at x 6.5 to 8.5, the way out in an alcove at
the east behind a plain gate that opens on the flag `hallucinator`. The three bodies share one mark and one `once`
flag; the upper of the three marks is the real one. Their slots' middles are x 2.8, 7.2 and 11.6, and their middles
stand 1.2 tiles over the floor, so that a standing cut bites from anywhere within about 2.2 tiles of one (nearer
the west wall the stair is in the way, and stepping on it leaves the fight, which then starts over). Each stencil is
also marked along the floor's edge, below every pair of feet, since a body is taller and wider than it. A fall gives
the retry at the stair. The fall of the boss says (THE CRATES GO FLAT. SOMEBODY ACTUALLY WROTE THE REST.), and no
card plays: nothing here is an ending.

**The cable** is the one room where a fall is a fall: off the bottom costs half a heart and puts the hero on the last
safe ledge (the foot, then the rows 18, 14, 12, 8 and 4). No real clamp and no part of the foot lies within 3 tiles,
sideways, of a painted clamp's middle below it, so a painted one always drops to the fog. The pairs are at the third,
sixth and eighth rung; the real side is the right one at the first and the left one at the others. Neighbouring rungs
are 4 tiles apart, middle to middle (a gap of 1).

**The rules the rooms keep:** a step or a platform on the way on is 2 up at most and a gap 2 at most; a lock or a gate
fills an opening in a wall that no jump gets over; no foe within 8 tiles of a way in; nothing the way needs is hidden,
and a painted thing is on it only as a wrong guess.

**Stand-ins, drawn in code:** the backdrops (joists and fog, painted flats, ropes and rigging, night and the cable),
the stage's colours, the glass's ring and outlines, the prompter's box (a sign), BARD's three pieces, the sandbag and
its rope, the gondola's plate with its cone and ring, the gold rail, the white and cyan bars, the claim's arrow. The
Understudy has no costume, and BARD's pictures are drawn from the front only.

**Checking it:** `node --test tests/zelda-act-three.test.mjs` plays it from the cellar's stair to the Weight and
VEGA, and loses it to a hero who stands still (its controllers: `tests/zelda-act-three-bots.mjs`);
`node scripts/zelda-lab/actthree-measure.mjs` measures every jump and lock, the cable, the fights and VEGA's states; `node scripts/zelda-lab/actthree-shot.mjs <local url> <outDir>` drives and pictures it
in the running shell.
