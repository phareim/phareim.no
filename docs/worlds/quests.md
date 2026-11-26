# The questlines through the lands

Five stories run through the lands (`atlas.md`). Each starts with someone on the hand-made coast or in the Wildwood
and sends the hero out; the people stand in the lands' maps (`themes/zelda/world/<land>.ts`, `overworld.ts`,
`wildwood.ts`) with talk that branches on flags. `tests/zelda-quests.test.mjs` talks every line through from its first
step to its last in the real maps.

Rules: people say where to go and what is wrong, never how to win; jokes stay. Every step names the next place by
its banner name and a bearing true on the grid. Everyone speaks under their own name (`GUNN: …`); nobody borrows a
hand-made character's. Quest items are flags (`q.<line>.<step>`); a reward is an ordinary item given once per person
(`got:<npc>:<item>`). The flags and the people's ids are the old frontier's, so a save that got halfway keeps its
place.

## 1. The cracked bell (`q.bell.*`)

Something carried a seter girl off in the night; the stave church's bell would call her home, but it cracked in the
cold. The fire that can recast it burns at the Clinker, and the Clinker will not burn more forest for it.

| # | Where | Who | Sets | Reward |
|---|---|---|---|---|
| 1 | NIGHT MARKET (the coast) | SIGRID `q.bell.girl`, lost, hay in her hair | `heard` | |
| 2 | Yule Fjord, THE STAVE CHURCH | ASLAK `q.bell.ringer` | `crack` | |
| 3 | The Sporelight, THE CLINKER | RAGNA `q.bell.forewoman` | `ore` | |
| 4 | Lumenby Quarry, THE UNION HALL | GUNN `q.gunn` | `chrome` | bits20 |
| 5 | THE CLINKER | RAGNA | `cast` | bits50 |
| 6 | THE STAVE CHURCH | ASLAK | `rung` | heartPiece |
| 7 | Seter Fell, THE BIG SETER | SIGRID `q.bell.home` (there once the bell rings), SOLVEIG `q.bell.tail` | | bits50 |

## 2. The surveyor's pages (`q.map.*`)

Stillsand's surveyor redraws his map every wind; this time the wind took four pages.

| # | Where | Who | Sets | Reward |
|---|---|---|---|---|
| 1 | By the town's pier | TUVA `q.map.kid` | `p1` | |
| 2 | Stillsand, ARNE'S SURVEY CAMP | ARNE `q.map.surveyor` | `asked` | bits20 |
| 3 | Fogstage, at the foot of the mast's hill | PIA `q.map.programs` | `p2` | |
| 4 | Seter Fell, CAIRN RIDGE | STEINAR `q.map.cairn` | `p3` | |
| 5 | Rerun Estates, THE AVENUE (he wanders) | OTTO `q.map.paperboy` | `p4` | |
| 6 | ARNE'S SURVEY CAMP | ARNE (all four pages) | `done` | heartPiece |

Pages 3–5 can be found in any order, before or after meeting him.

## 3. The stolen last act (`q.act.*`)

The RAINCHECK, a touring blimp and flying theatre, plays the same musical every night and it stops before the end:
something came up the stage trap and stole act three, and the act went out on the air.

| # | Where | Who | Sets | Reward |
|---|---|---|---|---|
| 1 | THE BEACH (the coast) | BO `q.act.busker` | `heard` | |
| 2 | Fogstage, BIRGER'S BUCKET (the stage trap) | BIRGER `q.act.prompter` | `trap` | |
| 3 | Rerun Estates, RALF'S TV VAN | RALF `q.act.repairman` | `tape` | |
| 4 | Fogstage, THE RAINCHECK'S MAST | VEGA `q.act.director` (FINGERS `q.act.cast` beside her) | `done` | heartPiece |

## 4. The clean seed (`q.seed.*`)

A Tender waters a dead patch at the Crossroads: its last bed in Stillsand wants a seed from clean soil, and the only
clean soil is under the Sporelight's roots.

| # | Where | Who | Sets | Reward |
|---|---|---|---|---|
| 1 | THE CROSSROADS (the coast) | TENDER `q.seed.tender` | `heard` | |
| 2 | The Sporelight, OLA'S WINDMILL | OLA `q.seed.keeper` | `well` | |
| 3 | The Sporelight, THE UNDER (down the clean well) | the silent spirit `q.seed.spirit` | `got` | |
| 4 | Stillsand, THE TENDER'S BED (the lens lights) | BED TENDER `q.seed.bed` | `planted` | heartPiece |
| 5 | THE CROSSROADS | TENDER | | bits50 |

## 5. Bror's lamp (`q.lamp.*`)

Gunn's brother Bror went down the deep drift and never came up. He is fine; he likes it down there.

| # | Where | Who | Sets | Reward |
|---|---|---|---|---|
| 1 | WILDWOOD SHORE, by Mossa's cottage | KNUT `q.lamp.miner` | `heard` | |
| 2 | Lumenby Quarry, THE UNION HALL | GUNN `q.gunn` | `ask` | |
| 3 | The Underglow, its first floor | BROR `q.lamp.bror` | `got` | |
| 4 | THE UNION HALL | GUNN | `done` | heartPiece |

## The lands' other people

Each land's folk are placed where they live, with their own lines (`<land>.<who>` ids): the Steamhouse's MS. B and
PUFFER and the Clinker's TRIXIE in the Sporelight; MOTHER MAG at Lumenby's deep drift and NEON NILS in the union hall;
ABEL at Stillsand's caravan; LENNY and ROSE at Rerun's drive-in, GORDON in its bomb shelter; FINGERS by the
RAINCHECK; SIGGE, HANNA, ECHO and the HERDSMAN in the Underglow.

## Not yet

The realm sketches' own systems (Seter Fell's Moving Day, Yule Fjord's tide and the Ride, Rerun's three eras as a
time switch, the Sporelight's calm-not-kill, Fogstage's fog line, the Underglow's Pull, Lumenby's lots lighting the
hill sign) are not built; the people only hint at them as mood.
