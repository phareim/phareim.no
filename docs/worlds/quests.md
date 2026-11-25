# The frontier's questlines

Five stories that cross realms. Data: `themes/zelda/world/gen/quests.ts` (sites set down in named
regions, folk whose talk branches on flags). Every line starts at the Landing (`fr:6,8`) or the
crossroads camp straight north of it (`fr:6,7`), so a new arrival meets a story within a minute.
Rules: people say where to go and what is wrong, never how to win; jokes stay. Quest items are flags
(`q.<line>.<step>`); a reward is an ordinary item given once per person (`got:<npc>:<item>`).
**[later]** marks a step that will need a system not built yet; until then talking does it.

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

## 1. The cracked bell (`q.bell.*`): Green Miles → Yule Fjord → Sporelight → Lumenby → back

The Wild Hunt dropped a seter girl far from home; the stave church's bell would call her back, but
it cracked in the cold. The fire that can recast it burns at the Clinker, and the Clinker will not
fell more trees for it.

| # | Where | Who | What they say (gist) | Sets | Reward |
|---|---|---|---|---|---|
| 1 | Green Miles, crossroads `fr:6,7` | seter girl | The Ride dropped me here; the fjord bell would call me home; it is cracked | `heard` | |
| 2 | Yule Fjord, the stave church `fr:5,0` | bell-ringer | A bell that cannot ring calls nobody home; take it to a great fire | `crack` | |
| 3 | Sporelight, the Clinker `fr:8,3` | forewoman | Chrome, not more trees; the quarry west has chrome | `ore` | |
| 4 | Lumenby, union hall `fr:2,3` | Gunn | Take a shift's worth; tell her: no trees. **[later: dig 4 chrome]** | `chrome` | bits20 (not bombs: the bomb bag is optional) |
| 5 | Clinker | forewoman | Recast, still warm; now the fjord | `cast` | bits50 |
| 6 | Stave church | bell-ringer | (DONG.) Whoever was taken hears the way home | `rung` | heartPiece |
| 7 | Seter Fell, big seter `fr:4,1` | the girl, home; the tail-neighbour | The bell rang and here I was; now I can be wed under it (a tail swishes) | | bits50 |

The girl leaves the crossroads once the bell rings and stands at her seter after (`hide`).

## 2. The surveyor's pages (`q.map.*`): Landing → Stillsand → Fogstage, Seter Fell, Rerun

Stillsand's dune surveyor redraws his map every wind; this time the wind took four pages.

| # | Where | Who | What they say | Sets | Reward |
|---|---|---|---|---|---|
| 1 | The Landing `fr:6,8` | kid | This page blew in from the east; it says STILLSAND | `p1` | |
| 2 | Stillsand `fr:9,4` (first desert region) | surveyor | One page to the ferry, one to the fog, fell and lawns | `asked` | bits20 |
| 3 | Fogstage `fr:2,7` | program kid | Act three is torn out, so I glued in a map page | `p2` | |
| 4 | Seter Fell `fr:3,2` | cairn-keeper | A page blew into my cairn; it has dunes on it | `p3` | |
| 5 | Rerun `fr:9,7` | paperboy | A map page fell out of the sky; folded into today's paper | `p4` | |
| 6 | Stillsand | surveyor (all four pages) | The map is whole, and right, for now | `done` | heartPiece |

Pages 3–5 can be found in any order, before or after meeting him. **[later]** the whole map fills in the
frontier's map screen (there is none yet).

## 3. The stolen last act (`q.act.*`): Green Miles → Fogstage → Rerun → Fogstage

The RAINCHECK plays the same musical every night and it stops before the end: something came up the
stage trap and stole act three, and the act went out on the air.

| # | Where | Who | What they say | Sets | Reward |
|---|---|---|---|---|---|
| 1 | Crossroads `fr:6,7` | busker of the cast | Our show has no ending; the blimp is in the fog, south-west | `heard` | |
| 2 | Fogstage `fr:2,6` | old prompter (in a bucket) | Psst: down the trap, out on the air; some TV got it; the lawns, east | `trap` | |
| 3 | Rerun, the TV van `fr:8,6` | TV repairman | I taped it off the air; the sets show it anyway. **[later: a Mailbox battle on his lawn]** | `tape` | |
| 4 | Fogstage, the RAINCHECK's mast `fr:1,6` | director | The last act, on tape! Tonight we end. **[later: BARD's battle, the tape gives its last verse]** | `done` | heartPiece |

## 4. The clean seed (`q.seed.*`): Green Miles → Sporelight → Stillsand → Green Miles

A wandered-off Tender waters a dead patch by the crossroads: its last bed in Stillsand wants a seed
from clean soil, and the only clean soil is under the Sporelight's roots.

| # | Where | Who | What they say | Sets | Reward |
|---|---|---|---|---|---|
| 1 | Crossroads `fr:6,7` | Tender (robot) | Water. Water. Nothing grows; my last bed wants a clean seed | `heard` | |
| 2 | Sporelight, windmill `fr:8,2` | windmill keeper | Clean soil only under the roots; a spirit sits by the well, north-east | `well` | |
| 3 | Sporelight, a clean well `fr:9,1` | lost bathhouse spirit | (Holds out a seed. It is not fungus at all.) **[later: in the Under, below the well]** | `got` | |
| 4 | Stillsand, the Tender's bed `fr:10,3` | the bed's Tender | A clean seed. Planting. (A shoot. Then a leaf.) | `planted` | heartPiece |
| 5 | Crossroads | the wandered Tender | The seed took? I will walk home. Slowly. | | bits50 |

This line is the test's end-to-end walk (`tests/zelda-frontier.test.mjs`).

## 5. The eighth letter (`q.lamp.*`): Landing → Lumenby → the Underglow → Lumenby

Gunn's brother Bror went down the deep drift and never came up. He is fine; he likes it down there.

| # | Where | Who | What they say | Sets | Reward |
|---|---|---|---|---|---|
| 1 | The Landing | old miner | My mate Bror went down the deep drift; Lumenby, out west | `heard` | |
| 2 | Lumenby, union hall `fr:2,3` | Gunn | Seven lots, seven letters; my brother went down the deep drift, west | `ask` | |
| 3 | Underglow layer 1 (deep drift at `fr:0,3`) | Bror Gunn | Tell my sister the rails hold; take my lamp up | `got` | |
| 4 | Union hall | Gunn | Then he stays down by choice; the hill gets an eighth letter | `done` | heartPiece |

**[later]** climbing back up costs the Pull (a greyed heart a layer); the eighth letter lights on the sign.

## Not yet (for the systems that come)

- The Wild Hunt as transport (Yule Fjord's Ride sweeping the hero to another realm) is how the girl of
  line 1 arrived; the Ride itself waits for its event system.
- Lumenby's lots and letters, Seter Fell's Moving Day, Yule Fjord's chalk and tide, the Sporelight's
  calm-not-kill: each realm sketch's own hooks, for when dig, puzzles and battles land.
