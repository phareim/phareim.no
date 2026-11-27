# Act Three (Fogstage's dungeon, seen from the side)

The design is section 7 of [sacred-weights.md](sacred-weights.md). This page says what stands in the game. The side
view, the cards and the Lens: [neon-shrine.md](../games/neon-shrine.md) ("The side view", "The Lens", "Cards"). Code:
`themes/zelda/world/actthree.ts`, `engine/lens.ts`, `render/actthreePaint.ts`. One keyring, `actthree`; every map is
`resume: true`, so a reload continues at the last stair used.

**The door** is a stair in the north wall of `understage`, the cellar under Birger's stage. Birger, once asked, says
so. The way back down lands on the cellar's entry `upstairs`.

| Map | Name | Size | What is in it |
|---|---|---|---|
| `actunder` | THE UNDERSIDE | 16×24 | card SCENE ONE; the Crawlspace below, the Prop Room above with **THE LENS** and the prompter's box |
| `actdoors` | THE THREE DOORS | 16×12 | three doors on three platforms, two of them paint; a small key in plain sight |
| `actbard` | THE BOARDS | 16×16 | card SCENE TWO; the stage floor, its ledge and the shaft up. Nobody on it yet |
| `actflats` | THE FLATS | 16×12 | a painted step, two painted chests beside the second small key, a painted door |
| `actwings` | THE WINGS | 16×12 | a heart piece up three hidden platforms; locked door A |
| `actloft` | THE FLY LOFT | 16×24 | its floor and locked door B, with an empty closet behind it |

The climb ends in the Fly Loft's floor today. The ring holds 2 small keys and 2 locked doors.

**The rules the rooms keep:** a step or a platform on the way on is 2 up at most and a gap 2 at most; a lock fills an
opening in a wall that is solid to the ceiling; no foe within 8 tiles of a way in; nothing the way needs is hidden,
and a painted thing is on it only as a wrong guess.

**Stand-ins, drawn in code:** the backdrops (joists and fog, painted flats, ropes and rigging), the stage's colours,
the glass's ring and outlines, the prompter's box (a sign).

**Checking it:** `node --test tests/zelda-act-three.test.mjs` plays it from the cellar's stair to the Fly Loft;
`node scripts/zelda-lab/actthree-measure.mjs` measures every jump;
`node scripts/zelda-lab/actthree-shot.mjs <local url> <outDir>` drives and pictures it in the running shell.
