# Rex & Nova: Space Voyagers II — Heart of the Oven

The game in the SPACE VOYAGERS cabinet from 2026-10-16, at `/?theme=voyagers2`. This file is
what the game is; it wins where code or another doc disagrees with it. `docs/games/voyagers2.md`
says what is built and where. The research it stands on: Wing Commander III's manual, its 3DO
playguide, CGW's review (February 1995), Wing Commander CIC's mission guides, and what mobile
space games learned about thumbs (summary under "Why it is built this way").

## The brief, in Petter's words (2026-10-16)

"The Galaga port fell short gameplay-wise. Do some deep research and create a properly cool
space game with our slacker heroes. Put them together in one space ship. Perhaps something
closer to the absolute banger Wing Commander 3. Still in the retro-future 80s."

So: a cockpit space-combat game in 3D, with a carrier to come home to, a crew to talk to,
nav points and an autopilot, wingmen on the radio, an ace who taunts you, a capital ship to
torpedo and a campaign that branches on what you win and lose. Rex and Nova fly **one** ship
together. The world is Space Voyagers I's and Solo Rescue's: everything stayed analog 80s.

## The world

`~/github/nova/docs/story.md` ("The world: how it stopped") and Space Voyagers I's
`themes/galaga/DESIGN.md`. Every digital chip died at the Big Zero; space is flown on valves
that glow orange, tape, CB radio, wood-grain dashboards, needles, nixie counters and toggles.
Slop's Pizza went orbital in the first game and delivered.

**The trouble.** The **Franchise** — PIZZA THE HUT's chain, the one Hans Duo delivered for —
is buying every orbit on the Dial. Where it opens an outlet, the independents close. Slop's new
orbital oven-ship, the **Deep Dish** (an ore carrier with Nonna's brick oven in the middle,
the flight deck through the oven door), is the last independent kitchen in space. The
Franchise wants it, the recipe in it and the two delivery pilots who keep it in business.

**The Calzone.** After the first game Tiny welded Rex's Wagon and Nova's Scooter nose to tail
to save on fuel. Two halves folded together: Nonna named it. It is a fat two-seater with a
wood-panelled front cockpit, a bubble turret in the back and the Slop's slice on the nose.

**Tone**, as in the other games: an 80s action cartoon that knows it is silly. No blood,
nobody dies: the Franchise's pilots are **animatronic mascots** (the restaurants' singing
band robots, now flying fighters), and a beaten mascot's head pops off on a spring and drifts
away singing. Our people eject in pizza-box pods. Nothing stronger than "crap". Jokes on
gimmicks and films everybody has seen, never on a real group. Everything the player reads is
English.

## One ship, two seats

The heart of the game. The player picks who they are (Rex or Nova) on the title; the other
is in the other seat. Both talk the whole time.

- **Front seat**: flies. Nose guns, missiles, the afterburner, the comms orders.
- **Back seat**: the bubble turret, which covers everything behind (a cone of 105° round the
  tail), and the decoys.
- **Whoever the player is not does the other job**, well enough to matter:
  - Player in front: the partner works the turret on their own. They pick what comes up
    behind, shoot in bursts, call it out ("BANDIT ON OUR SIX!"), and drop a decoy a moment
    after a missile comes in. Nova is the better shot and quicker with the decoys; Rex fires
    more and talks about food.
  - Player in the back: the partner flies. Never straight on (that was the Broadsword's fault
    in Wing Commander II, where the turret seat made the ship a clay pigeon): they fly away
    from what chases, weaving, so it stays in the turret's arc; they take the nose-gun shot
    when something crosses in front; they fly on to the nav point when the sky is clear.
- **Changing seats** (X, or a tap on the partner's face) takes a moment: both climb over,
  nobody shoots, the ship flies straight. It is the game's one risky button.
- The back seat is never needed to finish anything: a phone player can fly every sortie from
  the front and let the partner have the turret. It is there for the fight that sits on your
  tail, for a breather, and because gunning from a bubble is fun.

## Flying

Wing Commander's model, which is arcade: the ship goes where its nose points, at the speed
it is set to. No drift.

- **Cruise** is the ship's own speed. **Afterburner** (held) is about 3.5 times that on a fuel
  bar that refills slowly; empty, it coasts at cruise. **Brake** (held) drops to a crawl.
- **Slower turns tighter**: at a crawl the ship turns a quarter faster than at cruise, under
  afterburner about half as fast. Brake to turn inside someone; burn to get away.
- Turn rates chase the stick with a tenth of a second of weight, so short taps of a key aim
  finely. Held keys lean in over a quarter second, like a stick pushed over.
- Pitch, yaw and roll. A turn banks a little on its own; roll keys exist for those who want
  them. Touch needs no roll at all.
- Numbers (`engine/balance.ts`): the Calzone cruises at 260 m/s, burns at 900, turns 78°/s in
  pitch; enemy fighters from the nimble RAT (96°/s, 300 m/s) to the HOUND bomber (46°/s).
  Wing Commander III's own ratios: light fighters 90°/s, bombers 30–40°/s, afterburner 2.2 to
  2.9 times max speed.

## Guns, the lead diamond, missiles

- **Guns** draw on one capacitor that refills (about eight seconds of steady fire from full).
  Two guns alternate. Bolts carry the ship's speed.
- **The lead diamond** (Wing Commander's ITTS) is always shown on the target: aim at the
  diamond, not the ship. Bolts bend onto the diamond when the nose is within 1.5° of it
  (keys) or 4° (touch).
- **Touch fires by itself** when the diamond is inside the gunsight and the target is in range
  (as Galaxy on Fire 3 does); the FIRE button is for spraying.
- **Missiles**, two kinds, six on the rack:
  - **BREADSTICK** (dumbfire): fired with no lock, flies straight, hits hard.
  - **SNAPSHOT** (an instant camera on a rocket: it takes the target's picture and chases it):
    hold the target within 14° of the nose for 1.2 s; the brackets close and the tone rises,
    then sings. Fired locked, it seeks. It is slower than an afterburner and turns slower
    than a braking fighter: burn or turn hard, and a decoy pulls it off three times in four.
- **Torpedoes** (bombers, and the Calzone on strike sorties): a long lock (5 s on the Calzone,
  where Wing Commander had 12), slow, huge damage, and they can be shot down.

## Damage

Wing Commander's: a **shield** front and back that comes back after 2.5 s without a hit,
then **armour** on four sides (front, back, left, right) that does not, then the **core**.
A side's armour gone, every hit on that side goes to the core; the core gone, the ship is
lost. Shields flash where they are hit. The damage display draws the four armour sides and
the two shields round the ship's outline.

**Systems** (later sorties): a core hit may crack a part, shown as a line on the left screen
in colour (yellow, orange, red): VALVE CRACKED (guns recharge slower), TAPE DECK JAMMED (no
autopilot until Tiny fixes it: fly home by hand), CB DEAD (no orders, no talk), TURRET STUCK.

The Calzone lost: both eject in pizza-box pods, the sortie is lost, the story goes on (the
losing track). Nonna gives a speech. Nobody replays a sortie unless they want to.

## Who you fight

The Franchise's fighters, flown by mascots. All of them die in two to four seconds of steady
fire, as Wing Commander III did it ("instead of fighting two Kilrathi that are hard to kill,
you are wrapped up in a furball with ten enemy fighters that are pretty easy to kill", CGW):

| Kind | Is | Plays |
|---|---|---|
| RAT | light fighter, a wedge with round ears | swarms, fast, flimsy, jousts |
| BEAR | medium fighter, a round pan with ears and a bowler | the standard: passes, breaks, two SNAPSHOTs |
| GORILLA | heavy fighter, fists for gun pods | slow, hard, a tail gun: go at it from the side |
| HOUND | torpedo bomber, long, droopy ear fins | goes for the Deep Dish; the first to kill |
| GOLDEN GRATER | PRINCE PARMESAN's own fighter | the ace: quick, tough, taunts |
| OUTLET | a corvette: a drive-through on an engine | turrets, a strike target |
| THE BUFFET | the Franchise's carrier | the big strike target |

**The AI** (`engine/ai.ts`): attack (chase the lead, fire in bursts when on), break (after a
pass or before a ram: turn away hard, then come round — the joust that keeps a fight
moving), evade (jink when someone on its tail is hitting it), flee (wrecked and out of nerve:
run, and it is gone; "let him go"), strike (a bomber's run, torpedo, U-turn, burn out, again).
Each pilot has a skill (reaction, aim) and a nerve (how long it stays and fights).

## The wing and the comms

Wingmen fly the sortie the briefing gives them, one or two. They form on the Calzone, go for
what comes near, and take five orders on the CB (C then 1–5, or the comms screen on touch):

1. BREAK AND ATTACK — free hunting
2. FORM ON MY WING — break off and come back
3. HELP ME OUT — go for whatever is chasing the Calzone
4. TAUNT — the back seat insults the targeted fighter on the open band; it comes for the
   Calzone (pulls a bomber off the Deep Dish)
5. REQUEST LANDING — near the Deep Dish, when the sky is clear

| Wingman | Ship | Is |
|---|---|---|
| DOUGIE | MOPED | the delivery boy, a rookie: eager, fragile, gets in trouble and calls for help |
| BIG MARGE | TALL TALE (her rig, armed) | the veteran: slow, tough, a tail gun, a ghost story for every nav point |
| ELLEN RIDLEY | NOSTALGIA (her tug) | flat, careful, the best shot; the cat outranks you |
| HANS DUO | CENTURY PIGEON | the hotshot: steals kills, ignores orders — then takes the Franchise's contract |

## A sortie

- **Launch** out of the oven door (a short cut with the deck crew), the wing forming up.
- **Nav points**: two to four, then home. At each a fight waits (one to three waves, a second
  wave a few seconds after the first, sometimes from behind). The nav display points the way.
- **Autopilot**: the AUTO lamp lights when nothing hostile is within 4.5 km; N (or the lamp)
  flies the trip as a short cut with the radio talking, and drops the Calzone 2 km short of
  the next point. Once or twice a campaign the autopilot is ambushed.
- **Home**: the Deep Dish is nav 0. Something is usually waiting there (a bomber on the
  carrier). When it is clear, REQUEST LANDING: the deck takes over and the Calzone flies in
  through the oven door.
- **Won or lost**: every nav point met and the sortie's own goal (the convoy home, the target
  dead, the carrier whole) is a win. The Calzone lost, the carrier lost, or the goal missed
  is a loss. The debrief says which, and the campaign takes the branch.
- Three to five minutes of flying a sortie; six to ten fighters in a nav's fight, in waves.

## The campaign

Eight sorties in a run, ten written, three acts. Each act has one deciding sortie; losing
takes the short losing track, which has its own scenes and comes back to the spine. One
sortie is unlocked by a talk choice. The run's score is the Hall of Fame score.

| Act | Sortie | Kind | Twist |
|---|---|---|---|
| 1 THE PARKING BELT | 1 FIRST SHIFT | patrol, three navs | a bomber on the Deep Dish at home |
| | 2 CONVOY | escort Big Marge's rig and two haulers | raiders go for the haulers, not you |
| | 3 OVEN UNDER SIEGE (decides) | defend the Deep Dish | hounds in waves; TAUNT pulls them off |
| 2 THE LONG HAUL | 4a TAKE-OUT (won) | strike an OUTLET corvette | turrets first, then the torpedo |
| | 4b SPILLED SAUCE (lost) | escort Ridley's tug with the spare parts | ambush on autopilot |
| | 5 HANS SHOT FIRST | patrol with Hans Duo | at nav 2 he takes the contract and turns his guns on you |
| | 6 THE DARE (decides) | Prince Parmesan dares you to a duel; take it or fly home | taking it is the sortie; the Deep Dish leaves without you if you lose |
| 3 THE DELIVERY | 7a THE BUFFET (won) | strike the Franchise's carrier | its fighters launch while you work |
| | 7b LAST SLICE (lost) | defend the Deep Dish until help comes | the help is Big Marge's whole convoy |
| | 8 HEART OF THE OVEN | the finale: deliver Nonna's VOLCANO (a pizza so hot it is a bomb) into THE HUT | a run along the Hut's crust; Hans comes back: "YOU'RE ALL CLEAR, KIDS" |

Endings: won (Slop's on every orbit, everyone at the counter) and lost (Slop's is a Franchise;
Rex in a mascot suit; "TRY AGAIN"). The SUGAR CRASH (Wing Commander's drunk flight): if Rex
eats the whole test VOLCANO in the kitchen before sortie 5, his hands shake: the stick flips
every half minute for the first nav point.

## The Deep Dish (between sorties)

A tiny hub: three rooms, each a still picture with people in it (Wing Commander's rooms with
hotspots), no walking.

- **THE KITCHEN** (Nonna, the briefing at the counter, the map on a chalkboard).
- **THE HANGAR** (Tiny and the Calzone; launch from here).
- **THE BREAK ROOM** (the wingmen; the killboard is the EMPLOYEE OF THE MONTH chalkboard;
  Babs Arella on the television with the horoscope).

Talk is portraits and a box of lines; some talks stop on a choice of two answers. Choices move
**morale** (one number for the crew, one for the partner), which moves how well the wing
and the back seat shoot and what they say. At least one answer in each pair is neither a jerk's
nor a crawler's. The game saves at the hub (localStorage `voyagers2.save`).

## Who talks

Everything in flight is on the comms screen, a portrait and a line that types out, and never
stops the game. Space Voyagers I's radio director, kept: priority (story cuts in, events
queue, banter waits for silence), cooldowns, exchanges of several speakers.

| Id | Who | Voice |
|---|---|---|
| `rex`, `nova` | the two in the Calzone | `nova/docs/story.md` "Voice". Rex rates the food; Nova is unimpressed by space on principle |
| `nonna` | NONNA ROSA, captain of the Deep Dish | "You eat. Then you fly." |
| `mei` | dispatch, Radio Free Southie | knows things, says them in one breath |
| `tiny` | the mechanic | four words at most |
| `dougie`, `marge`, `ridley`, `duo` | the wing | above |
| `babs` | LOVE BAND 96.9 | the horoscope for each sortie |
| `parmesan` | PRINCE PARMESAN, heir of the Hut: a golden animatronic lion in a cape | grand, tinny, bad lip-sync. Calls the Calzone "THE HEART OF THE OVEN" |
| `mascot` | any Franchise pilot | sings the jingle, badly |

## The picture

Space Voyagers I's rules hold (`nova/docs/design.md` "Leave out" binds the 3D too): one
logical pixel is one square, nothing is smoothed, nothing glows.

- **3D at a low resolution**: three.js draws the view into a buffer about 240 logical pixels
  across on a phone held upright and 400 to 480 on a wide screen, which goes onto the screen
  at a whole number of pixels a pixel, nearest neighbour (Star Fox's idea, without its
  bloom, scanlines and vignette).
- **Models are made in code**, low-poly and flat, each material in **four tones** picked by
  the light (shadows lean blue-violet, lights warm), and every ship has a one-pixel ink
  outline from the depth. No textures but the decals (the Slop's slice, a mascot's face).
- **Space is dark blue-brown, never black**: a painted backdrop per sortie (a planet, a
  nebula in brown and rust, the Hut on its moon), stars as single pixels, and **speed dust**
  near the camera that streaks with speed (Elite's trick).
- **Bolts** are short lines of two tones; **hits** are pixel sparks on armour and a flash of
  the shield's shell on shields; **explosions** a flash drawn as a lighter silhouette, a
  pixel ring and eight to twelve tumbling chunks; a mascot's head on its spring.
- **Leave out**: bloom, glow, additive blending, lens flares, scan lines, a CRT filter, a neon
  grid, a striped sunset sun, palm trees, chrome lettering, a picture that is all magenta and
  teal, pure black.
- Lettering is the 5×7 pixel font (`themes/base/pixel/font.ts`), drawn by code.

## The cockpit

The front seat's dashboard is wood grain and bakelite with two cathode screens and a round
radar between them (Wing Commander III's Hellcat layout), drawn by code over a painted frame.

- **Left screen**: the comms (the speaker's portrait, name plate, channel, the line typing) or,
  when nobody talks, the damage display (outline, shields, four armour sides, systems).
- **Radar**: Wing Commander's: the centre circle is ahead, the outer ring behind; red
  fighters, orange big ships, blue ours, yellow missiles, a white cross for the nav point.
- **Right screen**: the target (its outline, name, range, its shields and armour) or the nav
  point when nothing is targeted.
- **Gauges**: speed (needle), the gun capacitor (a VU meter), afterburner fuel (a bar of
  valves), missiles (nixie digits), the AUTO lamp, the MISSILE lamp (something has locked on).
- **On the view**: the gunsight, the target's brackets and its lead diamond, the lock closing,
  arrows at the edge to an off-screen target, the nav cross.
- **The back seat** sees through the bubble: the tail, the ship's fins in view, a ring sight.
  The dashboard shows the same screens.

**Layouts.**

- **Phone, upright**: the view on top, the dashboard under it filling the width (about a
  third of the height), above the site's bottom band. The dashboard is also where the thumbs
  sit: the left thumb's stick floats wherever it lands on the left half of the screen; the
  right thumb has FIRE (hold), MSL and BURN (hold) on the right of the view's bottom.
  Never black bars: the picture fills the width (`canvas-game-phone-checks`).
- **Wide screens**: the view fills the screen, the dashboard along the bottom (about a fifth
  of the height), as in Wing Commander.

## Controls

| | Keys | Touch |
|---|---|---|
| Steer | arrows or WASD (up is nose up; the pause menu flips it) | the stick: drag from where the finger lands, springs back |
| Roll | Q / E | — (turns bank by themselves) |
| Guns | Space (held) | by themselves on the diamond; FIRE held sprays |
| Missile | Enter or F | MSL |
| Afterburner | Tab or Shift (held) | BURN (held) |
| Brake | Z (held) | — |
| Target | T next, R the nearest attacker | tap a ship; tap the right screen for the next |
| Change seats | X | tap the partner's face |
| Comms | C, then 1–5 | tap the left screen: five buttons |
| Autopilot / land | N | tap the AUTO lamp |
| Pause, quit | P or an Escape tap; a 3 s Escape hold ends the run | the ⏸ chip |

## Tuning

`scripts/voyagers2-lab/tune.mjs` flies each sortie with three bot pilots on several seeds:
CLUMSY (keys, looks at the fight every 0.4 s, 2.2° off), CASUAL (stick, 0.25 s, 1.1°) and
SHARP. The bot never sees more than a person would and is never perfect. Targets:

- FIRST SHIFT: everyone wins, with most of the hull left.
- From sortie 3 on: CLUMSY loses one sortie in three, CASUAL one in six, SHARP rarely.
- A nav point's fight lasts 30 to 90 seconds; a sortie three to five minutes of flying.

Nobody building this can feel it. The first version goes live as a parked theme and Petter
plays it on his phone before the campaign is built round it.

## Sound

The site's radio is the music, and the fight sets its intensity (quiet on autopilot, the band
when the fight starts, the lift when the ace or a big ship is in it). One-shots through
`audio.ts`: the nose guns (a valve's thump), the turret (higher), hits on the shield (a ring)
and armour (a crunch), the lock tone rising and singing, a missile away, MISSILE LOCK (a
klaxon), the decoy (a thunk), the afterburner's roar, the CB click and squelch when someone
talks, the autopilot (a tape rewinding), explosions, the mascot's spring.

## What counts as built

- **The slice** (first, live as a parked theme): title, pilot choice, FIRST SHIFT from launch
  to landing, the two seats, five orders, Dougie on the wing, the cockpit on a phone and a wide
  screen, touch and keys, sounds, the debrief.
- **The game**: the Deep Dish's three rooms, the ten sorties and the tree, the four wingmen,
  every enemy, the duel, the strikes, both endings, the save, the Hall of Fame board, the
  cabinet (it takes the SPACE VOYAGERS cabinet; Space Voyagers I stays at `?theme=galaga`,
  parked).
- Tests pass, the docs say what is there, and the report says what nobody has judged.

## Why it is built this way

From the research (2026-10-16): Wing Commander III's fights were close and many, not long
duels (CGW); its lead indicator was on every ship; the Broadsword's turret seat in WC II
stopped the ship flying, and the Longbow's auto-turret in WC III was weak, so the seat the
player is not in must fly and shoot well on its own; each star system had one deciding
mission and a short losing track; the memorable sorties each had a twist (the scramble with
bombers on the carrier, the booby-trapped convoy, the dare, the drunk flight); Galaxy on
Fire's players aimed better with fire-on-alignment than with a fire button.
