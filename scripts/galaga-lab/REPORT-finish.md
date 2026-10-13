# Space Voyagers — finishing job report

2026-10-13. Status: DONE, with part C's difficulty targets NOT met (said plainly below). Every
check asked for passes. Nobody on this job heard the game or held a phone, and every picture
is a still: nothing here says how it feels, sounds or moves.

## A. The bosses against their bitmaps

Done. Every number was measured in the bitmap (`scripts/galaga-lab/png.mjs`, a PNG reader written
for this job) and is in `BOSSES` in `engine/balance.ts`: body half sizes, weak spot, `muzzle`
(where its shots leave from), `top` (rows above it), `round` (the Deaf Star is half a disc, not
a box). A boss's bitmap is drawn centred on the boss; all offsets are from that centre.

| Boss | Bitmap | Body (hw, hh) was → is | Weak spot | Shots leave from |
|---|---|---|---|---|
| knight | 56 x 113 | 34, 30 → 24, 55 | the whole figure | the mirror ball (-1, -37): the glint's fan and the head of each ray, with a thread of light from the ball to the ray |
| humdinger | 97 x 117 | 36, 34 → 44, 56 | the whole rig | the trailer (0, -38): mines roll off it to either side and slide to their places, hogs come out either side of it and from under the rig. The ram's lane is 92 wide (was 68): the rig with its wheels |
| durant | 104 x 106 | 52, 26 → 50, 51 | the whole organ | the pipes' mouths (0, -12): the notes; the key columns begin on the console's bottom edge |
| cal | 120 x 77 | 112, 22 → 120, 38 | the lens: (1, -1), 20 x 20 (was at the wall's bottom edge, 14 below the middle) | the lens |
| fader | 140 x 95 | 30, 30 → 46, 46 (helmet and chest; the cape's hem is outside) | the whole body | the chest panel (0, 28): the choke's line; the treble ring from the helmet's vents |
| deafstar | 193 x 96 | 120, 44 box → 96, 48 half disc, flat along y 0 | the red dome: (40, -11), 14 x 14 (was the port at the bottom: 0, 40) | the woofer (-18, -10): the rings |

- **A shot under a weak spot flies up to it.** A wall used to stop a shot at its bottom edge; the
  lens and the dome are now on the face of the body, so armour stops only what is outside the
  weak spot's column (`shots.ts`), and the Deaf Star's armour is the half disc (`inBody`).
- **CAL** hangs 9 rows from the top; the wall either side of the unit is the bitmap's own valve
  banks laid end to end (30 columns each), so the unit (which slides 60 either way, was 70, and
  now stays inside the field) reads as part of one wall. The doors are 22 rows under the wall's
  bottom edge and no longer cross the bitmap.
- **The ship's upper limit** is 24 rows under a standing boss's feet (`BOSS_CLEAR`, `playerTop`):
  the bitmaps are up to 117 tall and at 320 rows the ship could fly into Humdinger's mask.
- **Dark Fader** follows the ship but keeps his 140-wide shoulders in the field (`FADER_MARGIN`).
- **The far moon** (`bg-5-a`) is taken out by a stipple while the Deaf Star flies in, and stays
  out until the next sector (`render/index.ts`, `hideBg`).
- **The lab's switch**: `window.__voyagers.boxes(true)` draws the body (green), the weak spot
  (magenta), the muzzle (cyan cross), the line the columns begin on, the ship's upper limit and
  every hit box. Scenes `boxes-<boss>` in `shot.mjs`. Not reachable without `?debug=galaga`.

Pictures opened (field cut out and enlarged, `tmp/galaga-shots/a/crop/`): knight (rays, glint;
phone and wide), humdinger (mines, ram, hogs), durant (notes, chord), cal (eye; phone and wide,
with and without boxes), fader (choke, sliders), deafstar (rings, squeeze). In each the boxes lie
on what is painted. What the pictures also show: live patches are still a loud orange checker
(not changed); a boss that is being hit is a white silhouette in some frames (the two-in-eight
flash).

`tests/galaga-bosses.test.mjs`: 19 pass. One number changed: the Deaf Star's body is at least 90
half-wide (was 100; the bitmap is 193 across). The hogs' places were spread (one either side, the
rest from under the rig) after the dodging autopilot was caught once between two in one column
by the field's edge.

## B. The page

Done. Pictures in `tmp/galaga-shots/b/` (while working, against dev) and the whole set again in
`tmp/galaga-shots/final/` against the built site (`npm run build`, `npm run preview`: wrangler on
port 8788): 105 PNGs, no page error in any picture of the game.

| Item | What changed | What the picture shows |
|---|---|---|
| The band's portrait | `render/crops.ts`: an origin for each of the 35 files (28 entries: per speaker, per mood where the head sits elsewhere); `console.ts` blits that 40 x 40 | `b/portraits-crops-0.png`, all 35 opened: eyes and mouth in every window. Mei, Nova and Rex needed 20 to 24 px to the right; Ridley's window starts 3 px in, so the cat's face and both her eyes are in it. Two were moved after the first look (`knight-calm`, `rex-eating`) |
| The wide title | One unit `--u` for the whole title: card, portraits, every letter and gap; `fit()` picks the largest whole number of device pixels at which card and column fit above the bottom band | 1280 x 800: 2 px a pixel, card 480 x 640 and a 480-wide column (portraits 128, hint, controls in two rows, the copyright on the card's bottom line). 1920 x 1080: 3. 375 x 667: 2 device px, pilots under the card, the last line ends at y 578 of 667. Also 390 x 844, 1180 x 700, 667 x 375 |
| The ending on a phone | `drawEnding`: in stage `ending` nothing of the run is drawn, the field is flat, the card and its words stand in it; the engine holds the guns | `ending-phone`, `ending-wide`: picture, DELIVERED, no ships |
| Resize and turn mid-run | `computeLayout(screen, fieldH)`: the largest scale at which the run's own field fits; `Game.vue` lays out again on resize and pauses when wide becomes tall or back | `turned-phone` (324 rows at 2 device px in 667 x 375, PAUSED), `turned-tall` (432 rows at 2 in 844 x 390), `shrunk-wide` (400 rows at 1 in 700 x 430): the whole field in each. New test in `galaga-layout` |
| Score words | Looked: `words-wide`, two mirror balls on a full formation with a quarter running | Eight point words and two X5 stand clear of each other; three pick-up names stack. Nothing changed. Points show from 120 up (was 300, with the scores) |
| TRACKING | `tearField` rewritten: four tear lines roll down the field, each band between two is pulled 2 to 5 px sideways as a whole, blank tape at the uncovered edge, a line of snow and a thinner one where a band ends; 30 rows round the ship are left alone | `tracking-wide`, `tracking-phone`: the hairspray cloud, the backdrop and a banner are cut and offset at the lines. A still cannot show the roll |
| A tow | Nothing wrong | `tow-wide`: the partner at the ship's nose, TOW, 1 LEFT. The towed ship blinks for 1.5 s (the first frame taken was a blink) |
| GAME OVER after a voyage | The panel is lettered in the game's pixels (`--vg`); the ending picture stands beside the words on a wide screen and over them on a phone; the reached line is two rows | `gameover-delivered-phone` and `-wide`. Weak: on the phone the radio widget lies over the picture's top right corner |
| VOYAGE II's card | Was never seen: the sector card replaced it one tick later. A later voyage's first sector now opens under VOYAGE II, SAME ORDER. HOTTER. | `voyage-2-wide` |
| Hans Duo | (see C: he never arrived in a played voyage) | `duo-wide`: the Century Pigeon under the formation |
| A friend's pass | Nothing wrong in the picture | `pass-rig-wide` (a rig through Fader), `pass-strafe` (Babs under him, firing) |
| A lost convoy, a lost rescue | Nothing wrong | `convoy-lost` (CARGO LOST, the cab alone), `rescue-lost` (TOWED AWAY) |
| Reduced motion in play | Nothing wrong | `reduced-wide` beside `tracking-wide`: no tear, a still backdrop |
| The board | The tagline wrapped with one word on its second row; now `Rex & Nova · one large pepperoni` | `board-wide`. The Hall of Fame page logs "Hydration completed but contains mismatches" on the built site (not this game's page; not looked into) |
| The cabinet | Nothing wrong | `cabinet-wide`, enlarged: blue cabinet, gold trim, the red dart and the white wagon on the marquee |

**The canvas ratio.** `scripts/galaga-lab/perf.mjs`, built site, 390 x 844, 4x CPU throttle,
headless Chrome on the Mac (three scenes in order: a busy wave in DUET, the Deaf Star's rings,
TRACKING):

```
ratio 3 (the device's own), CPU x4: canvas 1170 x 2532, 4 device px a pixel, buffer 293 x 633
  busy wave (sector 5, wave 3, DUET)
    draw            mean 0.94  p50 0.30  p95 3.30  max 3.70 ms
    tick and draw   mean 2.48  p50 2.30  p95 5.90  max 6.80 ms
    frame gaps      mean 56.31  p50 50.00  p95 116.70  max 116.70 ms  (66 frames in 4 s, 51 over 25 ms)
  boss (the Deaf Star, rings)
    draw            mean 0.42  p50 0.10  p95 3.10  max 3.20 ms
    tick and draw   mean 0.46  p50 0.20  p95 3.10  max 3.30 ms
    frame gaps      mean 60.84  p50 50.00  p95 133.30  max 133.30 ms  (63 frames in 4 s, 47 over 25 ms)
  TRACKING (the tear)
    draw            mean 0.90  p50 0.30  p95 3.30  max 3.40 ms
    tick and draw   mean 1.04  p50 0.40  p95 3.40  max 3.70 ms
    frame gaps      mean 67.27  p50 66.60  p95 133.30  max 150.00 ms  (55 frames in 4 s, 47 over 25 ms)
ratio 2, CPU x4: canvas 780 x 1688, 3 device px a pixel, buffer 260 x 563
  busy wave (sector 5, wave 3, DUET)
    draw            mean 0.82  p50 0.30  p95 3.30  max 3.50 ms
    tick and draw   mean 2.42  p50 2.60  p95 5.90  max 6.30 ms
    frame gaps      mean 70.74  p50 66.60  p95 133.30  max 133.40 ms  (49 frames in 4 s, 42 over 25 ms)
  boss (the Deaf Star, rings)
    draw            mean 0.33  p50 0.10  p95 2.30  max 3.20 ms
    tick and draw   mean 0.38  p50 0.10  p95 3.10  max 3.20 ms
    frame gaps      mean 67.59  p50 66.60  p95 133.20  max 133.40 ms  (54 frames in 4 s, 50 over 25 ms)
  TRACKING (the tear)
    draw            mean 0.82  p50 0.30  p95 3.30  max 3.40 ms
    tick and draw   mean 0.90  p50 0.30  p95 3.30  max 3.50 ms
    frame gaps      mean 60.11  p50 50.00  p95 116.70  max 133.30 ms  (61 frames in 4 s, 52 over 25 ms)
ratio 1, CPU x4: canvas 390 x 844, 1 device px a pixel, buffer 390 x 844
  busy wave (sector 5, wave 3, DUET)
    draw            mean 0.95  p50 0.30  p95 3.30  max 3.50 ms
    tick and draw   mean 2.45  p50 2.50  p95 6.00  max 6.20 ms
    frame gaps      mean 38.59  p50 33.30  p95 116.60  max 133.30 ms  (92 frames in 4 s, 73 over 25 ms)
  boss (the Deaf Star, rings)
    draw            mean 0.43  p50 0.20  p95 3.10  max 3.30 ms
    tick and draw   mean 0.50  p50 0.20  p95 3.10  max 3.20 ms
    frame gaps      mean 61.78  p50 50.10  p95 116.70  max 133.40 ms  (58 frames in 4 s, 46 over 25 ms)
  TRACKING (the tear)
    draw            mean 0.83  p50 0.30  p95 3.30  max 3.40 ms
    tick and draw   mean 0.89  p50 0.30  p95 3.40  max 3.50 ms
    frame gaps      mean 65.49  p50 50.10  p95 116.70  max 133.30 ms  (57 frames in 4 s, 51 over 25 ms)
```

The main thread's cost of a frame does not depend on the ratio: a draw is 0.1 to 0.3 ms in the
middle and 3.3 ms at the 95th percentile at 3, at 2 and at 1. The gaps between frames (50 to
70 ms) are the same at ratio 1 as at 3, so they measure the lab's headless browser, not the
canvas. Decision: keep the real `devicePixelRatio`. Why is in `docs/games/galaga.md` ("The
picture") and in one clause on the `useDeviceCapability.ts` line of AGENTS.md: a lower backing
ratio puts a logical pixel on one and a half device pixels, and the frame is one small buffer
and one blit. What this does not measure: the GPU's side of that blit on a real phone.

## C. The play

Partly done. Capture, gifts, DUET, scores, the partner, Hans Duo, Lena and the radio are done
and measured. **The difficulty targets are not met**: the game is still easy for all three
profiles.

Measured with `node scripts/galaga-lab/tune.mjs` (12 seeds, a first voyage, both heights).
Before is this job's first run of it, after part A; hits are the mean per run in sectors 1 to 5.

| | Before, 320 | After, 320 | After, 432 |
|---|---|---|---|
| AUTOPILOT finished | 12 of 12 | 12 of 12 | 12 of 12 |
| AUTOPILOT hits | 0.0 0.0 0.2 0.0 0.1 | 0.0 0.1 0.3 0.0 0.2 | 0.0 0.0 0.0 0.2 0.3 |
| CASUAL finished, a tow on | 12, 0 | 12, 0 | 12, 0 |
| CASUAL hits | 0.2 1.2 0.9 1.3 1.1 | 0.0 1.3 0.7 0.7 0.8 | 0.5 0.5 1.8 2.1 2.5 |
| CLUMSY finished, a tow on | 12, 2 | 12, 0 | 12, 3 |
| CLUMSY hits | 0.6 5.0 1.4 1.7 5.1 | 0.1 3.3 2.6 1.1 4.5 | 0.2 2.8 2.9 2.6 4.8 |
| Partner captured at least once (full, CASUAL, CLUMSY) | 0, 0, 0 | 8, 8, 4 | 6, 9, 10 |
| A dock at least once | 0, 0, 0 | 3, 7, 3 | 4, 7, 10 |
| Partner limps a run | 5.3, 4.5, 4.4 | 2.8, 2.8, 2.9 | 4.0, 4.2, 3.8 |
| Pick-ups a voyage | 95, 94, 92 | 50, 52, 51 | 53, 51, 51 |
| DUETs a voyage | 11.9, 11.9, 11.6 | 8.3, 8.3, 8.4 | 8.6, 8.8, 8.6 |
| Score, autopilot | 463k to 566k | 169k to 201k | 170k to 189k |
| Hans Duo arrives | never | every voyage, twice | every voyage, twice |
| Last fight: story lines dropped, passes made | 4 kinds (below), 120 of 120 | none, 120 of 120 | none, 120 of 120 |

Against each target:

- **Sector 1 gentle**: met. CLUMSY 12 of 12, no tow, 0.1 to 0.2 hits. Nothing in sector 1 was
  touched (difficulty 0).
- **The curve rises every sector**: not met. CASUAL rises at 432 (0.5 0.5 1.8 2.1 2.5) and is
  flat at 320; CLUMSY still dips in sector 4. What hurts the profiles was counted: bodies on a
  dive and lit patches, almost never a shot. Lord Humdinger's lane (now the rig's 92 px) is the
  largest single cause for CLUMSY, which reads half a second ahead and cannot leave a lane that
  wide in time; he rams once a cycle now (was twice in phase 2) with 80 ticks of notice (was 65).
- **CASUAL a tow on half, CLUMSY finishing on few**: not met. All finish 12 of 12. Tried, with
  little effect on these numbers: more and faster dives (`diveEvery`, `maxDivers`, `diveTicks`,
  `pairChance`, `diverSpeed`), quicker entries, dives from two formed up (sector 3 on), more
  shots (`fireEvery`, `boltCap`, `enterFire`), the later gangs faster and firing more, the
  Chromons charging, small enemies with three hits from sector 4, fewer tubes. All of it is in
  `balance.ts` and makes the game harder for a person; by how much nobody knows. The profiles
  aim perfectly and never stop firing, so most of a wave is shot as it flies in. I stopped
  rather than make it brutal for a person to move a program's numbers.
- **Capture in ordinary play**: met. The captor arrives with a shield (shots glance off, an
  `armor` spark), sits 50 ticks in its place, comes down to hover 104 above the partner; there
  the shield drops and the beam warms for 30 ticks (the cone's dotted edges), then lifts at 3.4
  a tick. Its hull is 7. The player can shoot it in that window or fly the partner out of the
  cone. A later dive by the same captor raises the shield again on the way down. The autopilot
  was taught what a person would do: go for a hovering captor, leave one that carries the
  partner until it dives. Not pictured: the shield has no drawing of its own, only the sparks.
- **Fewer gifts**: about 51 pick-ups (asked: near 45) and 8.3 to 8.8 DUETs (asked: 6 to 8, at
  the top of it). Drop chances a third of what they were, the dry spell 24 kills (was 11), a
  tube's weight 16 (was 30), the needle 0.0085 a hit point (was 0.014). The pity rules stand:
  the first drop a tube, three falling at most, a pizza owed on the last valve after 20 s,
  never more than 24 kills without a drop.
- **The partner dodges**: `dodge()` in `player.ts`: it steps 24 px aside from a shot or a body
  that will reach its row within 40 ticks. Limps a run fell from between 4.4 and 5.3 to between 2.8
  and 2.9 at 320. It cannot die (unchanged).
- **Hans Duo**: he never arrived in a played voyage (he waited for six formed up with none
  still flying in, and the autopilot never left six). He now comes when six have formed up or
  half the wave has flown in, and pops what he passes under until he has had half of what was
  left. With the fire held (the test) that is half the wave, give or take two; in a played
  wave 18 to 32 % of it falls to him, because the player is shooting the same wave.
- **Lena twice**: a rescued friend who is flying along leaves the formation for her own pass
  (it starts where she is) and comes back to it after. One of her in the field.
- **The last fight's radio**: measured before: the fight took the autopilot about 40 s and its
  story lines 95 s. Dropped in 24 voyages: `boss.deafstar.enter` in 18, `cavalry.duckie` in 15,
  `cavalry.marge` in 14, `cavalry.babs` in 3. Now the engine books each story line's time on the
  air (`TALK.air`, held to the lines by a new test in `galaga-script`): a friend waits for a
  clear channel before her pass, gunfire on the two bosses counts for less while the talk is
  more than 4 s behind (down to 15 % at 16 s), and the Deaf Star stays at one point of hull
  while a friend is still owed a pass, so the last pass finishes it. After: no story line
  dropped and every friend's pass made in 24 of 24 voyages, for the full profile and for CASUAL.
  The last fight is about 80 s for the autopilot now. Unjudged: whether a boss that will not
  go down until the friends have passed feels right.
- **Scores**: every point value times 0.4 (`ROLES`, `SCORE`, `BONUS`, `CAPTOR.freedScore`,
  `DUET.cancelScore`). `maxScore` 2,500,000. **Undone by the orchestrator before this was
  merged** (Petter, 2026-10-13: new scores may pass the old game's; scores that cannot be
  beaten would be worse, and the first version was already live at the higher scale): the
  values are back as they were, `SCORE.pick` 50 and `spareTube` 450, `maxScore` 5,000,000.
  The score columns in the tables below are therefore 0.4 of what the game gives.

The voyage table after (`tests/galaga-voyage.test.mjs`); the table before is in
`REPORT-engine.md`:

```
AUTOPILOT, field 240 x 320
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card       9.6   200680      0 0 0 0 0     0        5
   2 ENDING        5 1 card       8.9   193650      0 0 0 0 1     0        5
   3 ENDING        5 1 card       9.5   181880      0 0 1 0 0     0        5
   4 ENDING        5 1 card       9.4   172490      0 0 0 0 0     0        5
   5 ENDING        5 1 card       9.6   175430      0 0 0 0 0     0        5
   6 ENDING        5 1 card       9.2   171360      0 1 0 0 0     0        5
   7 ENDING        5 1 card       9.6   169010      0 0 0 0 0     0        5
   8 ENDING        5 1 card       9.2   176620      0 0 0 0 1     0        5
   9 ENDING        5 1 card       9.7   190420      0 0 1 0 0     0        5
  10 ENDING        5 1 card       9.4   182120      0 0 1 0 0     0        5
  11 ENDING        5 1 card       9.4   175760      0 0 0 0 0     0        5
  12 ENDING        5 1 card       8.7   178750      0 0 0 0 0     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.0 0.1 0.3 0.0 0.2
AUTOPILOT, field 240 x 432
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card      10.2   174250      0 0 0 0 0     0        5
   2 ENDING        5 1 card      10.4   184790      0 0 0 1 0     0        5
   3 ENDING        5 1 card       9.9   188930      0 0 0 0 0     0        5
   4 ENDING        5 1 card      10.3   181970      0 0 0 0 1     0        5
   5 ENDING        5 1 card      10.2   171180      0 0 0 0 0     0        5
   6 ENDING        5 1 card       9.4   176350      0 0 0 0 1     0        5
   7 ENDING        5 1 card       9.4   175650      0 0 0 1 1     0        5
   8 ENDING        5 1 card       9.7   170200      0 0 0 0 0     0        5
   9 ENDING        5 1 card       9.3   184610      0 0 0 0 1     0        5
  10 ENDING        5 1 card       9.9   183120      0 0 0 0 0     0        5
  11 ENDING        5 1 card       9.8   173300      0 0 0 0 0     0        5
  12 ENDING        5 1 card      11.1   181270      0 0 0 0 0     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.0 0.0 0.0 0.2 0.3
CASUAL (5 looks a second, 0.8 s ahead), field 240 x 320
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card       8.8   185310      0 2 1 1 0     0        5
   2 ENDING        5 1 card       9.1   198900      0 2 0 1 0     0        5
   3 ENDING        5 1 card       9.0   172750      0 2 0 0 0     0        5
   4 ENDING        5 1 card       9.2   180020      0 1 1 0 3     0        5
   5 ENDING        5 1 card       9.6   167910      0 1 1 0 0     0        5
   6 ENDING        5 1 card       9.8   178160      0 1 1 2 2     0        5
   7 ENDING        5 1 card       9.4   167210      0 1 0 1 1     0        5
   8 ENDING        5 1 card       8.9   203060      0 1 1 1 2     0        5
   9 ENDING        5 1 card       9.3   190190      0 1 1 1 2     0        5
  10 ENDING        5 1 card       9.6   170250      0 1 0 0 0     0        5
  11 ENDING        5 1 card       8.8   176660      0 1 2 0 0     0        5
  12 ENDING        5 1 card       9.1   174430      0 1 0 1 0     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.0 1.3 0.7 0.7 0.8
CASUAL (5 looks a second, 0.8 s ahead), field 240 x 432
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card      11.2   171420      0 0 4 1 2     0        5
   2 ENDING        5 1 card      10.3   180900      1 1 0 1 1     0        5
   3 ENDING        5 1 card       9.9   178780      0 1 1 1 1     0        5
   4 ENDING        5 1 card       9.6   179320      0 0 2 2 4     0        5
   5 ENDING        5 1 card       8.7   162430      0 1 3 3 4     0        5
   6 ENDING        5 1 card      10.1   154750      1 0 2 3 3     0        5
   7 ENDING        5 1 card       9.9   163960      1 1 3 2 3     0        5
   8 ENDING        5 1 card      10.0   172310      1 0 2 2 2     0        5
   9 ENDING        5 1 card      10.3   167600      0 0 3 1 2     0        5
  10 ENDING        5 1 card       9.8   189570      0 0 0 2 2     0        5
  11 ENDING        5 1 card       9.8   167840      1 0 1 2 3     0        5
  12 ENDING        5 1 card       9.9   184620      1 2 1 5 3     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.5 0.5 1.8 2.1 2.5
CLUMSY (3 looks a second, 0.5 s ahead, no margin), field 240 x 320
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card      11.4   179340      0 6 5 1 5     0        5
   2 ENDING        5 1 card       9.7   179220      0 4 2 2 6     0        5
   3 ENDING        5 1 card      10.6   169950      1 5 1 1 6     0        5
   4 ENDING        5 1 card       9.0   169040      0 2 3 0 1     0        5
   5 ENDING        5 1 card      10.7   170200      0 2 3 3 5     0        5
   6 ENDING        5 1 card       9.3   160810      0 3 1 1 6     0        5
   7 ENDING        5 1 card       9.1   177160      0 3 1 0 5     0        5
   8 ENDING        5 1 card      10.1   180340      0 6 2 0 2     0        5
   9 ENDING        5 1 card       9.4   185100      0 2 2 3 4     0        5
  10 ENDING        5 1 card       9.6   161910      0 1 4 1 7     0        5
  11 ENDING        5 1 card       9.7   162500      0 1 5 1 2     0        5
  12 ENDING        5 1 card       9.0   175310      0 4 2 0 5     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.1 3.3 2.6 1.1 4.5
CLUMSY (3 looks a second, 0.5 s ahead, no margin), field 240 x 432
seed result  sectors stopped     min    score   hits by sector  tows  friends
   1 ENDING        5 1 card       9.8   183180      0 3 2 2 3     0        5
   2 ENDING        5 1 card       9.3   161940      0 4 1 2 5     0        5
   3 ENDING        5 1 card      10.5   177520      1 3 3 5 4     0        5
   4 ENDING        5 1 card      10.6   157890      0 2 3 4 7     1        5
   5 ENDING        5 1 card       9.9   174650      0 3 1 4 4     0        5
   6 ENDING        5 1 card      10.8   161200      0 1 3 3 6     0        5
   7 ENDING        5 1 card      10.7   178950      1 3 2 1 5     0        5
   8 ENDING        5 1 card       9.4   173010      0 4 3 1 5     0        5
   9 ENDING        5 1 card      10.9   169120      0 2 7 3 6     1        5
  10 ENDING        5 1 card      10.9   181110      0 5 3 1 5     0        5
  11 ENDING        5 1 card       9.6   161680      0 0 3 3 6     1        5
  12 ENDING        5 1 card       9.2   159880      0 3 4 2 2     0        5
      sector 1 cleared 12/12, voyage finished 12/12, mean hits by sector 0.2 2.8 2.9 2.6 4.8
```

## D. Small things

- **`boss.deafstar.taunt`**: in `cues.ts` (banter, 16 s), four exchanges in `lines.ts` (Mei and
  Nova, Rex and Nova, Mei and Rex, Nova and Rex; the moon says nothing), asked through
  `BOSS_CUE`. `galaga-script` holds them to 84 characters and three rows; the boss test now
  asks for the taunt of all six.
- **Comments**: `Breakout.vue` points at `rtype/Shooter.vue`, `Shooter.vue` at
  `breakout/Breakout.vue` and `invaders/Invaders.vue`, `DefaultLanding.vue` names breakout and
  invaders for slots and galaga and battery for a page of their own.
- **`docs/games/galaga.md`**: files, the run on resize, the cap, GAME OVER, the ending, the
  title, the canvas ratio with its numbers, the fixed-field layout, the crops, a section on the
  bosses' boxes, a section on the play as tuned with the table's date, the hook's `boxes`, the
  scenes, the test count, what is open. Also `engine/README.md` (the new fields), one clause
  in AGENTS.md, and one phrase in DESIGN.md (the band's portrait is cropped to the face, not
  to its middle).
- **The valves**: both files are one 12 x 24 canvas (the page report's 11 x 24 and 12 x 23 are
  their painted boxes). They were centred on that canvas, so they did not in fact jump; they
  are now blitted from one corner taken from `valve-on`, so they cannot.

## Checks, all run after the last code change

| Check | Result |
|---|---|
| `npm run test:galaga` | 110 pass (108 before; new: the fixed-field layout, the last fight's air time) |
| `npm run test:portal` | 38 pass |
| `npm run test:zelda` | 98 pass |
| `npm run test:leaderboard` | 11 pass |
| `node --test tests/radio-catalog.test.mjs` | 5 pass |
| `npm run typecheck` | clean |
| `npm run build` | complete |
| The picture set | 105 PNGs against the built site, no page error in the game |

Test numbers changed, and why: the Deaf Star's half width at least 90 (was 100; the bitmap);
a boss's score from `SCORE.boss` (the scale); Hans Duo's half is of the wave left, not of
those formed up (he no longer waits for the whole wave); the taunt is asked of all six bosses.

## Open, by weight

1. **Difficulty.** Too easy for the profiles, unknown for a person. Nobody has played it.
2. **Feel, sound, a real phone, touch.** Unjudged, as before.
3. **`engine/combat.ts` was rewritten whole.** A script of mine emptied the file; I wrote it
   back from the text I had read plus this job's edits. The tests pass. With git on Sleeper,
   read its diff: it should show only `inBody`, `bodyBottom`, the shield, the last fight's
   air rules and the imports.
4. **The last fight is held open for the friends** (above): right on paper, unjudged in play.
5. **The captor's shield is not drawn**, only its sparks.
6. **CLUMSY and Humdinger's lane**; the dip in sector 4.
7. **Pick-ups are 51, not 45.**
8. Live patches are a loud orange checker; the radio widget over the ending picture on a
   small phone; the Hall of Fame page's hydration warning on the built site.

## What Petter should try first

1. A first voyage by hand, both pilots, and say where it is too soft: sector 3 on is where
   the numbers were raised.
2. Wave 2 of any sector: the captor. Does the shield, the half second of warming and the lift
   read as fair? Then shoot it on its next dive for the dock.
3. Sector 5 to the end with friends made: do the passes wait well, and is the Deaf Star's
   last point of hull a good ending or a stall?
4. A TRACKING tape, on a phone: does the tear read, and can the play still be read?
5. Turn the phone mid-run.

## Files

Created: `themes/galaga/render/crops.ts`; `scripts/galaga-lab/png.mjs`, `crops.mjs`,
`tune.mjs`, `perf.mjs`, `REPORT-finish.md`.

Changed: `themes/galaga/engine/` `attacks.ts`, `autopilot.ts`, `balance.ts`, `bosses.ts`,
`combat.ts`, `cuemap.ts`, `enemies.ts`, `friends.ts`, `pickups.ts`, `player.ts`, `shots.ts`,
`state.ts`, `types.ts`, `waves.ts`, `world.ts`, `README.md`; `themes/galaga/render/`
`console.ts`, `field.ts`, `fx.ts`, `index.ts`, `layout.ts`; `themes/galaga/story/` `cues.ts`,
`lines.ts`; `themes/galaga/Game.vue`, `Landing.vue`, `theme.css`, `DESIGN.md`;
`themes/leaderboard/games.ts`; `themes/breakout/Breakout.vue`, `themes/rtype/Shooter.vue`,
`themes/base/DefaultLanding.vue` (comments only); `tests/galaga-bosses.test.mjs`,
`galaga-encounters.test.mjs`, `galaga-layout.test.mjs`, `galaga-script.test.mjs`;
`scripts/galaga-lab/shot.mjs`; `docs/games/galaga.md`; `AGENTS.md` (one clause).

Deleted: none. Not in the patch: `tmp/galaga-shots/` (git-ignored). The dev server and the
preview started for the pictures were stopped by PID; nothing was committed.
