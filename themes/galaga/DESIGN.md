# Rex & Nova: Space Voyagers I — design

The game in the Galaga cabinet, written again from nothing on 2026-10-13 from Petter's brief.
This file is what the game is; it wins where code or another doc disagrees with it.
`docs/games/galaga.md` says what is built and where. The lines people say are in `story/`.

## The brief, in Petter's words (translated)

- New title: **Rex & Nova: Space Voyagers I**. `(C) Sleepy Productions, 2Q89` on the title
  screen, exactly so.
- Art direction: what would the space future look like if everything had stayed analog 80s
  tech?
- A top-down Galaga that is fun, full of fat power-ups and good mood. Somewhat larger ships,
  so the pixel art has room. Art in the comic-book style of `~/github/nova`, with banter
  between the two pilots, radio talk, and play with the other pilot and with enemies.
- They meet long-haul truckers they protect, and women in distress in space. Outré enemies
  and bosses. Badly hidden pop-culture references. A little Barbarella energy on the monitor
  along the way. Fast, but friendly to a casual player.

## The world

The world of Nova's Solo Rescue (`~/github/nova/docs/story.md`, "The world: how it stopped"),
taken off the ground. Every digital chip died at the Big Zero, so space is flown the way the
street is run: on **tubes** (valve computers that hum and glow orange), **tape** (the
navigator is a reel-to-reel), **air** (the Up Tube fires a rocket out of Boston the way it
fires a train to Neo York), **the Dial** (nobody logs on, you tune in: CB for truckers, pirate
stations for everyone else), **glass and light** (cathode tubes, split-flap boards, nixie
counters) and **clockwork**. Rockets are riveted and finned, dashboards are wood grain and
bakelite, switches are toggles, gauges have needles, the carpet is shag.

Slop's Pizza has gone orbital. Rex and Nova deliver.

**The order.** Mei (dispatch, Radio Free Southie) has a call on tape: "HELP ME, SLOP'S
PIZZA. YOU'RE MY ONLY HOPE. ONE LARGE PEPPERONI." It came from the far end of the Dial, five
sectors out. Thirty minutes or it's free. Nobody at Slop's has ever given a pizza away.

**Tone**, as in the other two games: an 80s action cartoon that knows it is silly. No blood,
nobody dies (a beaten enemy pops and its pilot drifts off in a bubble or on a parachute), no
word stronger than "crap". The jokes are on gimmicks and on films everybody has seen, never
on a real group. Everything the player reads is English.

## The two pilots

The player picks **Rex** or **Nova** on the title screen (left/right, or a tap on the
portrait; kept in `localStorage` as `voyagers.pilot`, Rex first time). The other flies a
second ship as the **partner**. Both talk the whole time, whoever is flown.

| | Ship | Voice (`nova/docs/story.md`, "Voice") |
|---|---|---|
| Rex | **The Wagon**: a stubby white-and-red delivery rocket with wood-panel sides and a roof rack of pizza boxes | Cheerful, hungry, not worried. Rates the food of every sector |
| Nova | **The Scooter**: a lean red dart, two fins, a headlamp, the Slop's slice on the nose | Dry, fast, present tense, unimpressed by space on principle |

Nova's rule from the last game holds for every woman in this one, in every image prompt and
every line: the camera treats her exactly as it treats him. Practical gear, a head-and-
shoulders portrait like everybody else's. The people who get rescued are good at their jobs
and funny; they are stuck, not helpless.

**The partner** (the other pilot, in the field):

- Flies to one side of the player, drifts to cover the other half of the field, fires at
  what is in front of it at about half the player's rate. Cannot die.
- Three hits and it **limps off** the bottom for 10 s to fix the ship, then comes back.
- **Capture** (Galaga's own trick): each sector has a *captor* enemy with a tractor beam.
  It takes the partner, never the player. The partner hangs under the captor in formation
  and complains on the radio. Shoot the captor while it dives and the partner is freed and
  **docks**: the two ships fly side by side as one for 12 s, double guns.
- **DUET** (the overdrive; SOLO was Nova's alone). Kills fill the meter. Full: Shift, or a
  second finger. For 6 s both ships fire at top level, twice as fast, and every enemy shot
  on screen turns into points. The meter is a VU needle.

## The picture

One logical pixel is one sprite pixel, put on the screen at a whole number of device pixels,
unsmoothed. No bloom, no glow, no scanlines, no vignette, no light map, no blending: a fade
is a stipple, light is a lighter tone (`nova/docs/design.md`, "Leave out", binds every
bitmap and every line of drawing code here too).

- **The field** is always **240 wide** and **320 to 432 tall** (set by the screen, fixed
  for a run). The scale is the largest whole number of device pixels at which 240 × 320 fits.
- **The console** is everything round the field: the ship's dashboard.
  - Wide screens (560 logical px across or more): the field in the middle, a panel on
    either side. Left: **the monitor**, a wood-grain television set with a 64 × 64 portrait
    of whoever is on the radio, a name plate, the channel (`CB 19`, `LOVE BAND 96.9`), and
    under it the line being said. Right: the instruments: score on a mechanical counter,
    hull as five valves, the weapon dial and its level, the DUET needle, timed power-ups
    as lamps, the voyage as a strip chart with a pen at the sector.
  - Narrow screens: a console band above the field with the same things, small: score,
    valves, weapon, DUET, and the monitor as a strip (portrait cropped to its middle
    40 × 40, three rows of text). Rows the field cannot use (a tall phone) go to the band.
- Sizes of things in the field (bitmaps; hit boxes are smaller and belong to the engine):
  player and partner ship about 32 × 36; small enemies 24 × 24; heavy ones 32 × 32; bosses
  about 112 × 96; a trucker's rig about 36 × 150; a stranded ship about 40 × 48; a pick-up
  16 × 16; a portrait 64 × 64.
- Lettering is the site's 5×7 pixel font (`themes/base/pixel/font.ts`, capitals only),
  drawn by code. No generated picture carries text that is not a sign in the world.
- Backdrop: per sector, a dark field (blue-brown, never black) with stars in three slow
  layers and two or three large bitmaps drifting by (a planet, a station, a nebula band),
  all behind the action and darker than it.

## A run

A voyage is five sectors. A sector is: a card and a station break on the monitor, **wave 1**,
**wave 2**, a **bonus run** (targets fly through in patterns, nothing shoots; all of them is
PERFECT and a big bonus), **wave 3** and **wave 4** with the sector's **event** running
through them, then **the boss**. After sector 5: the ending card, then VOYAGE II, the same
five sectors harder, the score running on. The Hall of Fame score is the run's score.

Waves are Galaga's: strings of enemies fly in along curves, take their places in a formation
that sways, then peel off and dive at the player, alone or in pairs, and loop back up.

**Friendly to a casual player:**

- The hull is five valves. A hit pops one and gives 1.5 s of blinking safety. A hit never
  takes a weapon level below 1.
- Hull empty: the partner **tows** you (enemy fire cleared, back with three valves). Two
  tows a run. The third time is GAME OVER.
- Enemy shots are few, slow and bright in sector 1 and ramp gently. Every shot that needs
  aiming shows where it will go first.
- The player's hit box is the cockpit, about 6 px across.
- Hull at 1 and no pizza for 20 s: the next pop drops one.

**Controls.** Arrows or WASD move, Space fires (held), Shift is DUET, Esc tap or P pauses,
a 3 s Esc hold quits. Touch: drag to fly (the ship sits above the finger and fires while
touched), a second finger is DUET. M cycles the site's radio, which is the music.

## Power-ups

Things from the decade, dropped by enemies, drawn as the thing itself with its name under it
the first seconds. At most three fall at once.

| Id | Thing | Does |
|---|---|---|
| `tube` | Vacuum tube | Weapon level +1 (1 to 5) |
| `blaster` | Toy ray gun | Weapon: BLASTER, a fan of bolts (the start weapon) |
| `disc` | LaserDisc | Weapon: DISC, discs that go through a target and turn to the next |
| `boombox` | Boom box | Weapon: BOOMBOX, wide arcs of bass, short reach, hit everything they cross |
| `pizza` | Pizza slice | Mends a valve; hull full: a 1-hit bubble |
| `bubble` | Soap-bubble wand | A bubble round the ship that takes two hits |
| `cb` | CB handset | Calls a trucker: a rig comes up one lane from the bottom and flattens it |
| `mirrorball` | Mirror ball | Light in every direction: all enemy shots gone, every enemy hurt |
| `tracking` | VHS tape | TRACKING: enemies and their shots run slow for 5 s, the field tears in bands |
| `hairspray` | Hairspray can | EXTRA HOLD: a cloud in front of the ship; what flies into it stands still for 4 s |
| `magnet` | Horseshoe magnet | Pick-ups come to you for 10 s |
| `quarter` | Arcade quarter | Double score for 10 s |

Picking up the weapon you already carry raises its level. The same three weapons at the same
level also arm the partner.

## Sectors

Each sector has its own gang, built from the same eight **roles**:

| Role | Behaviour |
|---|---|
| `grunt` | Formation, dives alone |
| `flanker` | Comes in from the side in a string, swoops |
| `tank` | 3 to 5 hits, slow, a three-way shot |
| `diver` | Aims itself at the player and goes |
| `sniper` | Shows a line for half a second, then fires along it. Two alive at most |
| `splitter` | Pops into two small ones |
| `captor` | The tractor beam (see the partner). One alive at most |
| `raider` | Goes for the rig or the stranded ship, not for the player |

| # | Sector | Gang (what the roles look like) | Event | Boss |
|---|---|---|---|---|
| 1 | LOW ORBIT: the Parking Belt, junk and parked satellites over a blue Earth | **The Glitterati**, disco raiders: mirror-ball drones, saucers on roller skates, platform-boot stompers, gold-medallion flankers | Convoy: BIG MARGE and the rig *Tall Tale* | **SATURDAY KNIGHT**: a suit of white disco armour with one arm up, under a mirror ball the size of a house. Sweeping rays; the floor of light squares he throws down |
| 2 | THE LONG HAUL: the freight lane, mile markers, a truck stop with a neon sign | **The Road Hogs**, scrap bandits: pig-snouted choppers with ape-hanger bars, spiked buggies, harpoon raiders, a tank that is half a school bus | Convoy of three: RUBBER DUCKIE in front, JACK BARTON's *Pork Rind Express* last | **LORD HUMDINGER**: a chrome mask on a V8 war rig. "JUST FLY AWAY." Rams, drops spike mines, sends hogs from the trailer |
| 3 | THE SHAG NEBULA: pink and orange gas, op-art rings, a planet that is a lava lamp | **The Love Machines**: lava-lamp blobs, wind-up dolls that bite, feathered gliders, eyes in op-art rings | Rescue: BABS ARELLA, off the air, her fur-lined rocket out of gas | **DOCTOR DURANT DURANT** at **THE EXCESS MACHINE**, an organ the size of a church. Keys fire columns; it is beaten by being overplayed until it smokes |
| 4 | THE DEAD BAND: no stations, grey hulks, a field of dishes all pointing one way | **The Chromons**: chrome toaster heads with a red light sweeping side to side, pepper-pot machines with a plunger ("ELIMINATE"), flying toasters | Rescue: ELLEN RIDLEY, warrant officer of the tug *Nostalgia*, and the cat | **CAL 9000**: a wall of valves with one red lens. "I'M SORRY, REX. I'M AFRAID I CAN'T LET YOU DELIVER THAT." Closes pod-bay doors across the field; its lens is the target |
| 5 | THE DEEP END: the far end of the Dial, black-violet, a moon that is a loudspeaker | **The Empire of Noise**: bow-tie fighters (they are bow ties), static troopers, fader drones on rails | Rescue: PRINCESS LENA ORGANZA, who ordered the pizza | **DARK FADER** (a helmet with a mixing-desk fader down its face), then **THE DEAF STAR**, a moon-sized speaker cabinet. Its weak spot is a tweeter two metres wide |

**A convoy.** A rig comes up a side lane, slowly, for about 40 s, through waves 3 and 4.
It blocks enemy shots (cover) and lets the player's through. Raiders go for it; its cargo
has a bar. Home safe: a crate of two pick-ups, a bonus, and the trucker is a friend. Cargo
gone: the cab unhooks and drives on, no bonus, a rueful line. The trucker talks on CB 19
the whole way.

**A rescue.** A stalled ship drifts in with a beacon, raiders round it. Clear them, fly up
beside it and stay within reach for 2 s (the jumper cables show; the bar fills; it drains
slowly when you leave). Started: she flies with you as a third ship until the boss is down,
with a weapon of her own that is bigger than yours, and she is a friend. Lost (raiders drag
it off the top): she is fine and says so, no friend this run.

**Friends come back.** In the last fight every friend made this run makes a pass when the
boss changes phase: a rig through its guns, a strafing run, with a line. No friends, no
passes. This is the pay-off for the events and the reason to care about them.

**HANS DUO** of the *Century Pigeon* (and CHOMPY, who is large and says "RRRAWR") delivers
for a rival, Pizza the Hut. He turns up once in sector 2 and once in sector 4, clears half a
wave, takes the credit and leaves.

## Who talks

Everything is on the radio, on the monitor, and never stops the game. A line types out; the
portrait is the speaker's, in the mood the line asks for.

| Id | Who | Channel | Voice |
|---|---|---|---|
| `rex`, `nova` | The pilots | SHIP | Above |
| `mei` | Dispatch, Radio Free Southie | RFS 88.9 | Knows things, says them in one breath |
| `babs` | BABS ARELLA, the voice of pirate station LOVE BAND 96.9 | LOVE BAND 96.9 | The Barbarella of the monitor: a sixties space-queen doing the weather, the horoscope and the traffic for each sector in a purr, in front of op-art. Camp, grand, kind. Then she is the one in the stalled rocket, and good in a fight |
| `marge` | BIG MARGE, *Tall Tale* | CB 19 | Tells a ghost story about every sector, eyes wide |
| `duckie` | RUBBER DUCKIE, convoy leader | CB 19 | All CB slang, ten-four, never his own name |
| `barton` | JACK BARTON, *Pork Rind Express* | CB 19 | Talks about himself to nobody in particular. "IT'S ALL IN THE REFLEXES." |
| `ridley` | ELLEN RIDLEY, tug *Nostalgia* | DISTRESS | Flat, tired, has seen worse. The cat outranks you |
| `lena` | PRINCESS LENA ORGANZA | DISTRESS | In charge from her first line. "AREN'T YOU A LITTLE LATE FOR A DELIVERY BOY?" |
| `duo` | HANS DUO | OPEN | Sure of himself, wrong |
| `knight`, `humdinger`, `durant`, `cal`, `fader` | The bosses | they cut in on every band | Each talks like his film |

The **director** keeps the old game's rules, which are tested and worked: lines have a
priority (3 story, interrupts; 2 teaching and events; 1 banter, only after 9 s of silence),
a cue can be once a page load, once a run, or on a cooldown, a teaching line cut off is said
again, and everything runs on the game clock so pause freezes it. New: a cue's answer is an
**exchange**, several lines by different speakers, played one after another (a boss taunts,
Nova answers, Rex is thinking about lunch). The cues are listed in `story/cues.ts`; the
words are in `story/lines.ts`. A line is at most 84 characters and three rows of 28.

## Sound

The site's radio is the music, as before (`docs/games/global-radio.md`; this game's three
tracks stay in `audio.ts`). One-shots through `audio.ts`, with new ones for the radio
opening and closing (a CB click and squelch), the tractor beam, a tow, the DUET, a rig's
horn. Nobody building this can hear: every report says so, and Petter listens.

## What counts as built

- Title to ending by hand and by the autopilot, on a phone and on a wide screen, under the
  theme id `galaga` (the Hall of Fame board, the cabinet in the portal and the high-score key
  stay; only the names change).
- Two pilots, five gangs, five bosses, three truckers, three rescues, twelve power-ups, the
  partner with capture, dock and DUET, the console with the monitor.
- Every bitmap from `scripts/galaga-lab/art` (the recipe of `~/github/nova/tools/art`), in
  `public/galaga/`, and every one of them used.
- Tests pass, the docs say what is there, and the report says what nobody has judged: feel,
  balance by hand, sound, a real phone.
