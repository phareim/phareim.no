# Space Voyagers — engine job report

2026-10-13. Status: DONE. `npm run test:galaga` passes (139 tests, 12 files, about 50 s) and
`npm run typecheck` is clean. Nobody on this job saw or heard the game: every number below is
what a program measured, and says nothing about feel.

## What is built

**`themes/galaga/engine/`** (22 TypeScript files, the longest 375 lines): a pure simulation. One seeded Rng,
time in ticks of 1/60 s, fixed pools for everything in the field, a reused event array.
`createWorld({ seed, height, pilot, voyage })`, then `step(world, input)` once a tick.
`README.md` there is the guide for the next job.

- The player: five valves, 1.5 s blink, a 3 px hit box, a hit costs a weapon level (never below
  1), two tows (field cleared, back with three valves), GAME OVER on the third.
- The partner: flies on the far side, fires at what is in front of it at half rate with the
  player's weapon and level, three hits and it limps off for 10 s, cannot die. Capture by the
  captor's beam, hanging, freed on the dive and docked for 12 s (double guns), loose without a
  dock when the captor is shot in formation.
- DUET: kills fill the needle; 6 s at level 5, twice as fast, enemy shots turn into points.
- Three weapons at five levels as pure tables (`weapons.ts`): BLASTER fan, DISC that goes
  through and turns to the next, BOOMBOX arcs.
- Twelve power-ups with drop rules (first is a tube, at most three falling, a pizza owed on the
  last valve after 20 s, never more than 11 kills without a drop).
- Eight roles and five gangs. The gangs are one row of numbers each (`GANGS`): dive style
  (arc, charge, wobble, rail), a formation that glides or steps, speed, fire rate, shot speed,
  tank hull, shots per dive, how often two dive together.
- Galaga's waves: strings along curves into a formation that sways and breathes, dives alone
  and in pairs, back round from the top. 20 waves as rows of letters in `SECTORS`.
- The bonus run and PERFECT. The convoy (cargo bar, cover from enemy shots, crate of two,
  cab unhooks when lost) and the rescue (cables bar, 2 s, drains, third ship with a bigger gun,
  dragged off the top when lost), with raiders that go for them and not for the player.
- Friends and their passes in the last fight, one per phase change, everyone left at the
  last. Hans Duo in sectors 2 and 4.
- Five bosses and the Deaf Star, 23 attacks, none shared (`bosses.ts` head comment). Every
  aimed attack shows first: a line (aims) or a lit patch (zones) for at least half a second.
- Sectors 1 to 5, the ending, VOYAGE II (difficulty +2.5 sectors, bosses +35 % hull, score
  runs on, friends made again). Scoring with a kill chain (x1 to x5).

**`themes/galaga/story/director.ts`**: the old director's rules on the game clock, plus
exchanges, once-a-sector, unheard variants first, and `listen()`, the glue that feeds a tick's
events to it and returns the monitor (speaker, plate, channel, mood, text typed so far,
`cutsIn`).

**`engine/autopilot.ts`**: sees positions, velocities and warnings, returns an `Input`. Three
profiles: full, `CASUAL` (looks 5 times a second, 0.8 s ahead), `CLUMSY` (3 times, 0.5 s, no
margin). **`engine/debug.ts`**: jump to any stage or boss, a sandbox, force a boss attack.

## Tests (new: 7 files, 86 tests; with the old game's 53 that is the 139)

| File | Covers |
|---|---|
| `galaga-engine` | determinism (hash after 10,000 ticks, a recorded replay), pooled events, weapons, flying and edges, hull, hit box, tows and GAME OVER, partner fire and limp, DUET, chain, roles and gangs as data, splitter, sniper's line, sector 1's numbers, a wave forming and diving at both heights, the bonus run both ways, bitmap names |
| `galaga-pickups` | each of the twelve, the drop rules |
| `galaga-encounters` | capture, dock, loose, pulling the partner clear; convoy safe and lost, cover; rescue saved (all three) and lost, the bar; raiders; Hans Duo; friends' passes and `cavalry.none` |
| `galaga-bosses` | each boss beaten at weapon level 1 with its phases and cues; every attack of every boss avoided for a minute at both heights in the first and last phase (0 hits); nothing aimed without warning; the ram, the cooling organ, CAL's doors and lens, the tweeter |
| `galaga-director` | exchanges, monitor, game clock, priorities, cut-off teaching line said again, banter's silence, once rules, cooldowns, stale lines, variants, `listen` |
| `galaga-script` | every cue has lines, every mood exists, 84 characters, three rows of 28, the font's characters, every cue asked by the engine or on the page's list of five, two voyages listened to |
| `galaga-voyage` | soak (30 game minutes at 320 and at 432), 12 seeds at both heights for three profiles with tables, the ending and VOYAGE II |

Split further than the brief named: `galaga-pickups`, `galaga-encounters` and `galaga-bosses`
exist because one engine file would have been 1,100 lines.

## The voyage table

Printed by `tests/galaga-voyage.test.mjs`. "hits by sector" is hits taken (bubble or valve) in
sectors 1 to 5.

```
AUTOPILOT, field 240 x 320
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card       7.9   527870      0 0 0 0 0     0        5
   2 ENDING        5 1 card       8.7   558840      0 0 0 0 0     0        5
   3 ENDING        5 1 card       8.2   566420      0 0 0 0 0     0        5
   4 ENDING        5 1 card       8.3   500380      0 0 0 0 0     0        5
   5 ENDING        5 1 card       8.3   512800      0 0 0 0 0     0        5
   6 ENDING        5 1 card       8.3   485920      0 0 0 0 0     0        5
   7 ENDING        5 1 card       8.1   600780      0 0 0 0 0     0        5
   8 ENDING        5 1 card       8.5   491940      0 0 0 0 0     0        5
   9 ENDING        5 1 card       8.5   497680      0 0 0 0 0     0        5
  10 ENDING        5 1 card       8.3   468190      0 0 0 0 0     0        5
  11 ENDING        5 1 card       8.9   514920      0 0 0 0 0     0        5
  12 ENDING        5 1 card       8.9   500720      0 0 1 0 0     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.0 0.0 0.1 0.0 0.0
AUTOPILOT, field 240 x 432
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card       9.4   471330      0 0 0 0 0     0        5
   2 ENDING        5 1 card       8.4   512680      0 0 0 0 1     0        5
   3 ENDING        5 1 card       9.8   473860      0 0 0 0 0     0        5
   4 ENDING        5 1 card      10.3   535600      0 0 0 1 0     0        5
   5 ENDING        5 1 card       9.3   470050      0 0 0 0 0     0        5
   6 ENDING        5 1 card       9.0   480150      0 0 0 0 0     0        5
   7 ENDING        5 1 card      10.0   475800      0 0 0 1 0     0        5
   8 ENDING        5 1 card       8.7   495360      1 0 0 0 0     0        5
   9 ENDING        5 1 card       9.4   461980      0 0 0 1 1     0        5
  10 ENDING        5 1 card      10.2   503810      0 0 0 0 0     0        5
  11 ENDING        5 1 card       8.5   549380      0 0 0 0 0     0        5
  12 ENDING        5 1 card      10.3   494490      0 0 0 0 1     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.1 0.0 0.0 0.3 0.3
CASUAL (5 looks a second, 0.8 s ahead), field 240 x 320
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card       8.1   452010      1 1 1 0 5     0        5
   2 ENDING        5 1 card       8.9   489920      0 1 2 1 0     0        5
   3 ENDING        5 1 card       8.1   461660      1 1 0 1 2     0        5
   4 ENDING        5 1 card       8.2   497040      0 1 1 1 1     0        5
   5 ENDING        5 1 card       8.3   461240      0 1 2 1 0     0        5
   6 ENDING        5 1 card       8.8   478980      0 1 1 0 0     0        5
   7 ENDING        5 1 card       8.7   487760      0 1 2 1 2     0        5
   8 ENDING        5 1 card       8.5   505080      0 1 0 0 1     0        5
   9 ENDING        5 1 card       8.4   510660      0 1 1 1 1     0        5
  10 ENDING        5 1 card       9.0   503000      0 0 1 0 1     0        5
  11 ENDING        5 1 card       8.3   474790      0 1 1 3 1     0        5
  12 ENDING        5 1 card       8.1   474760      0 1 0 0 1     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.2 0.9 1.0 0.8 1.3
CASUAL (5 looks a second, 0.8 s ahead), field 240 x 432
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card       8.9   448100      1 0 1 2 2     0        5
   2 ENDING        5 1 card       9.9   529850      0 0 1 1 3     0        5
   3 ENDING        5 1 card       9.0   463320      0 1 2 3 1     0        5
   4 ENDING        5 1 card       9.8   491050      0 2 1 2 0     0        5
   5 ENDING        5 1 card       9.8   522920      1 0 2 1 2     0        5
   6 ENDING        5 1 card       8.6   468220      0 2 1 3 2     0        5
   7 ENDING        5 1 card       8.3   502830      0 1 2 1 2     0        5
   8 ENDING        5 1 card       9.5   464810      0 0 3 2 1     0        5
   9 ENDING        5 1 card       9.3   488510      0 1 0 0 2     0        5
  10 ENDING        5 1 card       9.5   444470      0 1 1 2 4     0        5
  11 ENDING        5 1 card       8.6   509270      0 1 0 1 0     0        5
  12 ENDING        5 1 card       8.6   521910      0 1 1 1 2     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.2 0.8 1.3 1.6 1.8
CLUMSY (3 looks a second, 0.5 s ahead, no margin), field 240 x 320
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card       8.8   451950      2 4 0 2 7     0        5
   2 ENDING        5 1 card       8.8   541750      0 0 1 0 3     0        5
   3 ENDING        5 1 card       8.7   514690      0 2 4 0 1     0        5
   4 ENDING        5 1 card       8.6   488010      0 3 3 1 4     0        5
   5 ENDING        5 1 card       8.8   472650      1 1 2 2 1     0        5
   6 ENDING        5 1 card       8.4   510610      0 1 3 2 5     0        5
   7 ENDING        5 1 card       8.5   489940      0 3 1 2 5     0        5
   8 ENDING        5 1 card       8.7   485630      0 2 4 1 7     0        5
   9 ENDING        5 1 card       8.0   462990      2 3 2 0 2     0        5
  10 ENDING        5 1 card       8.2   521150      0 6 2 0 3     0        5
  11 ENDING        5 1 card       8.8   491690      1 2 0 1 2     0        5
  12 ENDING        5 1 card       8.1   500490      1 1 0 2 3     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.6 2.3 1.8 1.1 3.6
CLUMSY (3 looks a second, 0.5 s ahead, no margin), field 240 x 432
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card       9.4   515740      0 3 1 0 3     0        5
   2 ENDING        5 1 card       9.6   477270      0 4 2 5 6     0        5
   3 ENDING        5 1 card       9.6   459590      1 1 0 1 1     0        5
   4 ENDING        5 1 card       9.4   450830      0 4 4 0 5     0        4
   5 ENDING        5 1 card       9.3   472660      1 4 2 2 6     0        5
   6 ENDING        5 1 card       9.6   453410      1 3 2 1 7     0        5
   7 ENDING        5 1 card       9.5   435440      2 1 1 2 5     0        5
   8 ENDING        5 1 card       9.7   469380      0 4 4 1 4     0        5
   9 ENDING        5 1 card       9.6   469330      1 1 1 5 6     0        5
  10 ENDING        5 1 card       9.7   433240      1 3 2 1 8     0        5
  11 ENDING        5 1 card       8.7   450440      0 1 1 1 5     0        5
  12 ENDING        5 1 card       9.4   439940      0 1 0 1 3     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.6 2.5 1.7 1.7 4.9
```

What it says about the difficulty curve:

- **Every profile finishes the first voyage on every seed at both heights, and no run ever
  needed a tow.** The assertion "sector 1 cleared on at least 10 of 12" holds at 12 of 12 six
  times over. For a program the game is easy. This is the main open question, not a result
  to be pleased with.
- Sector 1 is the gentlest for all three (0.0 to 0.6 hits a run). Hits rise to sector 5
  (clumsy: 0.6, 2.4, 1.8, 1.4, 4.3 averaged over the heights). Sectors 3 and 4 are not harder
  than 2 for the clumsy profile: the ramp has a flat middle.
- The tall field is slightly harder (more of the field to cross to a gap).
- A voyage takes the autopilot 8 to 10 game minutes. Bosses take it 31 to 60 s in voyage I
  and 42 to 79 s in voyage II (sector 5 is two bosses); started at weapon level 1 with the
  partner alongside, a single boss takes 43 to 131 s.
- Six seeds run on through VOYAGE II: the full profile finishes it with 0 to 2 hits, CASUAL
  with 5 to 13, still without a tow.
- Per voyage the autopilot uses DUET about 12 times, takes about 94 pick-ups, gets PERFECT in
  all five bonus runs, brings both convoys home and makes all three rescues. **The partner is
  never captured in a played voyage** (0 in 36): the autopilot pops the captor before the beam.
  Capture, dock and loose are proven only in scripted worlds.

Why the numbers flatter the game: the autopilot aims perfectly and keeps firing, so most
strings are shot as they fly in and little is left to dive. A person will not do that. The
knobs, all in `balance.ts`: `diveAfter`, `STRING.between` and `enterTicks` (how soon a wave is
dangerous), `fireEvery`, `boltCap`, `boltSpeed`, `veteranHp`, `PICKUP.pityKills` and
`ROLES[*].drop` (94 pick-ups a voyage is a lot), `DUET.perKillHp`, `BOSSES[*].hp` and
`BOSS_SOAK`. I stopped tuning rather than make it hard for a bot and unknown for a person.

## Decisions taken where DESIGN.md left room

1. **A hit costs one weapon level** (`PLAYER.hitLevelLoss`). DESIGN.md says only that a hit
   never takes it below 1. Set it to 0 to switch it off.
2. **Boss hull is soaked** (`BOSS_SOAK`): 14 damage a second in full, the rest at 35 %, so a
   fight is about 3 times shorter at full power than at level 1, not 8 times. Rigs, the mirror
   ball and friends' passes hit whole.
3. **The radio has its own Rng stream** (`world.talkRng`), seeded from the world's seed. What
   has been heard this page load must not change the simulation, or a replay would drift.
4. **The partner carries the player's weapon and level** (my reading of "also arm the partner").
5. **A captor coming down jams the partner's guns.** Without this the partner shot its own
   captor every time and capture never happened. Flying away pulls the partner clear.
6. **DUET turns shots into points at the moment it starts**, not for its whole 6 s. It also
   clears lines and lit patches. With the partner away the player plays it alone.
7. **A tow happens even with the partner captured or mending**; the partner's state is
   untouched.
8. **One friend's pass per phase change** (Fader's half, the Deaf Star's entrance, its 66 %),
   everyone left at its 33 %. Friends are counted per voyage.
9. **The convoy of three** is `rig-duckie`, `rig-duckie`, `rig-barton`: there is no third
   trucker's bitmap, so the middle rig wears the leader's.
10. **The sector's boss waits for the event**: a convoy still rolling or a ship still stalled
    holds wave 4 open.
11. **Small enemies take two hits from sector 3** (`veteranHp`), tanks 3 to 5.
12. **Sector clear mends one valve; a beaten boss drops a pizza and a tube; PERFECT drops a tube.**
13. **Lit patches do not hurt the partner**, and mines cannot be shot.
14. **The Excess Machine** cools 0.12 hull a tick after 2 s without a hit, never back past a
    phase it has reached, and plays faster the more it is hurt (all bosses do).
15. **Staleness**: a teaching or event line that has waited 15 s is dropped and can be asked
    for again; time spent behind a story line that cut in does not count. At most four
    exchanges wait.
16. A stage `idle` exists for the lab and the tests: a field in which nothing is scheduled.

## Missing or thin against DESIGN.md, in order of weight

1. **Difficulty is unjudged and probably too low**: see the table. No run needed a tow.
2. **Capture has not happened in a played run**, only in scripted tests.
3. **The middle of the ramp is flat** (sectors 3 and 4 no harder than 2 for the weak profile).
4. **Pick-ups and DUET are frequent**: about 94 and 12 a voyage.
5. **The last fight's radio is crowded**: five passes, two entrances and two deaths are all
   story lines; with more than four waiting the oldest is dropped. Not measured which.
6. **The partner's flying is simple**: the far side of the player, leaning to the nearest
   enemy. It does not dodge.
7. **Hans Duo** pops every other enemy he passes under, up to half: often fewer than half.
8. **Lena can be seen twice** in sector 5: flying along and making her pass.
9. **The Deaf Star has no taunt cue**; it is silent between its phases apart from the passes.
10. **A boss's body does not ram** (only Humdinger's lane hurts); boss helpers are grunts.
11. **Not allocation-free in three rare places**: a weapon pick-up returns a small object, the
    pass queue shifts an array, and the director allocates when a cue is taken.

## cues.ts and lines.ts

Not changed. All 118 cues are asked for: 113 by the engine, 5 by the page (`briefing`,
`retry`, `best`, `gameover`, `ending`; `PAGE_CUES` in `engine/cuemap.ts`).

## What the renderer job must know

- Read `themes/galaga/engine/README.md` first: the world's fields, the event table, the list
  of what not to assume.
- Pools: skip `active === false`; do not draw enemies with `state === 'wait'`.
- Telegraphs are state: draw every active aim and every zone with `warn > 0`. The captor's
  beam is a captor in `hover` (`t < CAPTOR.warn` warming, then on).
- The page asks the director for `briefing`, `retry`, `best`, `gameover`, `ending`; everything
  else arrives as `cue` events through `listen()`. Call `radio.resetRun()` on a new run.
- `world.talkRng` is the director's random; do not give it `world.rng`.
- Keep the fixed 60 Hz clock: one `step` per tick, no variable dt.
- Touch: `input.hasTarget` with the target above the finger; the ship flies there at 2.6 px a
  tick, it does not jump.
- For pictures: `debug.ts` jumps to any stage, `world.boss.force` repeats one attack, and the
  autopilot plays; a seed and a tick number name a frame exactly.
- The old game is untouched: `Galaga.vue`, `balance.ts`, `weapons.ts`, `story.ts` and its five
  tests still pass and are still in `test:galaga`. The new `engine/balance.ts` and
  `engine/weapons.ts` share names with the old files one folder up.

## Files

Created:

- `themes/galaga/engine/`: `README.md`, `attacks.ts`, `autopilot.ts`, `balance.ts`, `bosses.ts`,
  `combat.ts`, `cuemap.ts`, `debug.ts`, `encounters.ts`, `enemies.ts`, `events.ts`, `flow.ts`,
  `friends.ts`, `index.ts`, `pickups.ts`, `player.ts`, `rng.ts`, `shots.ts`, `state.ts`,
  `types.ts`, `waves.ts`, `weapons.ts`, `world.ts`
- `themes/galaga/story/director.ts`
- `tests/galaga-engine.test.mjs`, `tests/galaga-pickups.test.mjs`,
  `tests/galaga-encounters.test.mjs`, `tests/galaga-bosses.test.mjs`,
  `tests/galaga-director.test.mjs`, `tests/galaga-script.test.mjs`,
  `tests/galaga-voyage.test.mjs`
- `scripts/galaga-lab/REPORT-engine.md` (this file)

Changed: `package.json` (the `test:galaga` line only).

Deleted: none. `node_modules` and `.nuxt` were installed in the mirror for the typecheck
(git-ignored). Nothing was committed.
