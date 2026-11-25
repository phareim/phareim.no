# The frontier's questlines

Five stories that cross realms. Data: `themes/zelda/world/gen/quests.ts` (sites set down in named
regions, folk whose talk branches on flags). Every line starts at the Landing (`fr:6,8`) or the
crossroads camp straight north of it (`fr:6,7`), so a new arrival meets a story within a minute.
Rules: people say where to go and what is wrong, never how to win; jokes stay. Every step names the
next place by its banner name and a true bearing on the macro map below. Everyone speaks under their
own name ("GUNN: …"); nobody borrows a hand-made character's, whatever sprite they wear (the bell-ringer
in the Keeper's coat is ASLAK). Quest items are flags (`q.<line>.<step>`); a reward is an ordinary item
given once per person (`got:<npc>:<item>`). **[later]** marks a step that will need a system not built
yet; until then talking does it.

Macro map (12 × 9 regions, north up; `fr:<x>,<y>`):

```
     x 0123456789AB
y 0    ··YYYYYYYY··     Y YULE FJORD        S SETER FELL      Q LUMENBY QUARRY (+ the Underglow)
  1    ·QSSSSSSPPP·     P THE SPORELIGHT    D STILLSAND       F FOGSTAGE
  2    QQQSSSGPPPPD     R RERUN ESTATES     G THE GREEN MILES L THE LANDING (the ferry)
  3    QQQGSGGGPPDD
  4    ·QGGGGGGGDDD
  5    FFFGGGGGRDDD
  6    FFFFGGGRRRDD
  7    ·FFFGGGRRRR·
  8    ···F··L·····
```

From the crossroads camp: Seter Fell and Yule Fjord north, Lumenby Quarry north-west, the Sporelight
north-east, Rerun Estates and then Stillsand east, Fogstage west, the Landing south. Its sign says so.

## 1. The cracked bell (`q.bell.*`): Green Miles → Yule Fjord → Sporelight → Lumenby → back

Something carried a seter girl off in the night (the Wild Hunt; it has no name in the game yet); the
stave church's bell would call her home, but it cracked in the cold. The fire that can recast it burns
at the Clinker, and the Clinker will not fell more trees for it.

| # | Where | Who | What they say (gist) | Sets | Reward |
|---|---|---|---|---|---|
| 1 | Green Miles, crossroads `fr:6,7` | SIGRID, seter girl | Something carried me off; my cows are on Seter Fell; the bell on Yule Fjord would call me home, but it is cracked; the church is far north | `heard` | |
| 2 | Yule Fjord, the stave church `fr:5,0` | ASLAK, bell-ringer | A bell that cannot ring calls nobody home; take it to a fire big enough; then: the Clinker, in the Sporelight, south-east | `crack` | |
| 3 | Sporelight, the Clinker `fr:8,3` | RAGNA, forewoman | I can recast it, but not by burning more forest; bring chrome; the quarry out west has it | `ore` | |
| 4 | Lumenby, union hall `fr:2,3` | GUNN | Take a shift's worth; tell Ragna: not one tree. **[later: dig 4 chrome]** | `chrome` | bits20 (not bombs: the bomb bag is optional) |
| 5 | Clinker | RAGNA | Recast, still warm; back to the church, north-west | `cast` | bits50 |
| 6 | Stave church | ASLAK | (DONG.) Whoever was carried off can hear the way home; try the seters, south | `rung` | heartPiece |
| 7 | Seter Fell, big seter `fr:4,1` | SIGRID, home; SOLVEIG, the tail-neighbour | The bell rang and there I was; now I can be wed under it (something swishes) | | bits50 |

Sigrid leaves the crossroads once the bell rings and stands at her seter after (`hide`); she wears the
dairymaid look in both places.

## 2. The surveyor's pages (`q.map.*`): Landing → Stillsand → Fogstage, Seter Fell, Rerun

Stillsand's dune surveyor redraws his map every wind; this time the wind took four pages.

| # | Where | Who | What they say | Sets | Reward |
|---|---|---|---|---|---|
| 1 | The Landing `fr:6,8` | TUVA, dock kid | A map page blew in; it says STILLSAND; after: the map man must be north-east, where the grass runs out | `p1` | |
| 2 | Stillsand `fr:9,4` (first desert region) | ARNE, surveyor | The wind took four pages: one to the ferry, one west to Fogstage, one north-west to Seter Fell, one south to Rerun Estates | `asked` | bits20 |
| 3 | Fogstage `fr:2,7` | PIA, program seller | Act three is torn out, so I glued in a map page | `p2` | |
| 4 | Seter Fell `fr:3,2` | STEINAR, cairn-keeper | A page blew into my cairn; it has dunes on it; after: it belongs in Stillsand, far east | `p3` | |
| 5 | Rerun `fr:9,7` | OTTO, paperboy | A map page fell out of the sky; folded into today's paper | `p4` | |
| 6 | Stillsand | ARNE (all four pages) | The map is whole, and right, for now | `done` | heartPiece |

Pages 3–5 can be found in any order, before or after meeting him. **[later]** the whole map fills in the
frontier's map screen.

## 3. The stolen last act (`q.act.*`): Green Miles → Fogstage → Rerun → Fogstage

The RAINCHECK, a touring blimp and flying theatre, plays the same musical every night and it stops
before the end: something came up the stage trap and stole act three, and the act went out on the air.
The busker, the Fogstage ticket-takers and a camp sign say what the RAINCHECK is before anyone needs it.

| # | Where | Who | What they say | Sets | Reward |
|---|---|---|---|---|---|
| 1 | Crossroads `fr:6,7` | BO, busker of the cast | The RAINCHECK is a blimp; someone stole act three; she is moored in Fogstage, west; our old prompter saw everything | `heard` | |
| 2 | Fogstage `fr:2,6` | BIRGER, old prompter (in a bucket) | Psst: down the trap, out on the air; some TV in Rerun Estates caught it, east | `trap` | |
| 3 | Rerun, the TV van `fr:8,6` | RALF, TV repairman | I taped it off the air; take the tape back to the RAINCHECK, Fogstage, west. **[later: a Mailbox battle on his lawn]** | `tape` | |
| 4 | Fogstage, the RAINCHECK's mast `fr:1,6` | VEGA, director (FINGERS of the cast beside her) | The last act, on tape; tonight the show ends. Before the tape: ask our old prompter, east of the mast. **[later: BARD's battle, the tape gives its last verse]** | `done` | heartPiece |

## 4. The clean seed (`q.seed.*`): Green Miles → Sporelight → Stillsand → Green Miles

A wandered-off Tender waters a dead patch by the crossroads: its last bed in Stillsand wants a seed
from clean soil, and the only clean soil is under the Sporelight's roots.

| # | Where | Who | What they say | Sets | Reward |
|---|---|---|---|---|---|
| 1 | Crossroads `fr:6,7` | TENDER (robot) | Water. Water. Nothing grows; my last bed wants a clean seed; the windmill keeper in the Sporelight, north-east, knows where clean soil is | `heard` | |
| 2 | Sporelight, windmill `fr:8,2` | OLA, windmill keeper | Clean soil only under the roots; a spirit keeps a clean well, north-east | `well` | |
| 3 | Sporelight, a clean well `fr:9,1` | lost bathhouse spirit (silent) | (Holds out a seed; it is not fungus at all; points south, toward Stillsand.) **[later: in the Under, below the well]** | `got` | |
| 4 | Stillsand, the Tender's bed `fr:10,3` | BED TENDER | A clean seed. Planting. (A shoot. Then a leaf.) Tell my partner at the crossroads, south-west | `planted` | heartPiece |
| 5 | Crossroads | TENDER | The seed took? I will walk home now. Slowly. | | bits50 |

This line is the test's end-to-end walk (`tests/zelda-frontier.test.mjs`).

## 5. Bror's lamp (`q.lamp.*`): Landing → Lumenby → the Underglow → Lumenby

Gunn's brother Bror went down the deep drift and never came up. He is fine; he likes it down there.

| # | Where | Who | What they say | Sets | Reward |
|---|---|---|---|---|---|
| 1 | The Landing | KNUT, old miner | My mate Bror went down the deep drift; his sister Gunn waits at the union hall, Lumenby Quarry, north-west | `heard` | |
| 2 | Lumenby, union hall `fr:2,3` | GUNN | The last forewoman; my brother went down the deep drift, west of here; bring me word | `ask` | |
| 3 | Underglow layer 1 (deep drift at `fr:0,3`) | BROR | Tell my sister the rails hold; take her my lamp; I like it here, it's warm | `got` | |
| 4 | Union hall | GUNN | Then he stays down by choice; stubborn, like our mother | `done` | heartPiece |

**[later]** climbing back up costs the Pull (a greyed heart a layer); the sketch's eighth letter lights
on the Lumenby sign. Neither is in the lines until it exists.

## The landmarks' and the deep's people

ABEL, the caravan cook, at the gold pyramid (`fr:10,4`); MS. B, the Steamhouse clerk who shortens every
name, and PUFFER, its tired boiler spirit (`fr:9,2`); MOTHER MAG of the Delvers' Club at the deep drift
(`fr:0,3`); LENNY of the Overdue Four and ROSE at the drive-in (`fr:8,7`); TRIXIE the bellows dancer and
NEON NILS beside the quest-givers; in the deep, SIGGE (layer 2), HANNA (3), ECHO (4) and the HERDSMAN (5).

## Not yet (for the systems that come)

- The Wild Hunt as transport (Yule Fjord's Ride sweeping the hero to another realm) is how Sigrid of
  line 1 arrived; the Ride itself waits for its event system, and only then gets its name in her lines.
- Lumenby's lots and letters, Seter Fell's Moving Day, Yule Fjord's chalk and tide, the Sporelight's
  calm-not-kill: each realm sketch's own hooks, for when dig, puzzles and battles land. The folk only
  hint at them as mood (Moving Day is "soon", the chalk girl worries about doors).
