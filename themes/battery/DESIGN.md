# Night of the Dead Battery — design

A point-and-click adventure in the spirit of LucasArts' *Day of the Tentacle*
(1993): three playable friends in three parts of one house, a SCUMM verb
panel, items passed between them, cartoon logic, crooked architecture, and a
finale where all three act together. Theme id `battery`, reached from its
cabinet in the town's arcade. Drawn in the site's pixel look
(`docs/games/pixel-look.md`), but DOTT-coloured: warmer and brighter inside
the house, with storm light through every window.

Started 2026-09-25 (built overnight on Petter's request: "three stranded guys
looking for a new car battery in a spooky and whimsical house… ridiculously
ambitious… heavily inspired by Day of the Tentacle"). Petter's addition: the
three wear worn white bunny suits, in varying states of disarray.

## The story

Friday night, late September, a storm on the coast road. Kjell, Dag and Espen
are driving home from what Espen said was a costume party. It was a quiz
night. They are still in the rabbit suits. Kjell's 1987 Volvo 240 estate,
**Brunhilde**, coughs and dies at the gate of **Villa Voltvik**, a crooked
house on the cliff. Turning the key goes *click-click-click*: a dead battery,
and a cracked one.

Espen knows the place from his podcast (*Spøkelsesjegerne*, eleven
listeners): Professor Ottilie Voltvik lived here, an inventor who
disappeared in 1987, the night she tried to bottle lightning. Dag wants to
know if there's food. Kjell wants a battery. They knock, the door opens by
itself, and the house decides to keep them: a loose tile tips Dag down a
chute into the cellar, the chandelier cord yanks Espen up through a hatch to
the attic, and the staircase folds itself into the ceiling like a sulky
accordion. Kjell is alone in the foyer. From a little hatch in the kitchen
wall comes Dag's voice: "There's a lot of jam down here."

The hatch is a **dumbwaiter** (a tiny lift for food) that runs from the
cellar pantry through the kitchen to the attic storeroom. It carries small
things between the three of them. That is the Chron-o-John of this game.

**The twist.** The Professor did not disappear. Her 1987 experiment, a
"transmogrifier" she tried on herself with "something with nine lives, just
in case" as the target, turned her into the house cat, **Mrs Whiskers**, who
has a white streak and a ring round one eye exactly like the Professor's
monocle in the foyer portrait. The house has been stuck at 11:59 ever since,
waiting for midnight and the lightning that would run the machine backwards.

**The ending.** The friends raise the lightning rod, bridge the cut cable,
put the cat in the booth, arm the machine and wind the grandfather clock to
midnight. The strike runs down through all three floors (a DOTT split screen,
three panels at once), charges the car battery bolted into the machine and
turns Mrs Whiskers back into the Professor. She unbolts the battery for them,
the house lets the stairs down, the three meet again in the foyer, and
Brunhilde starts in the rain. Dag leaves with a jar of jam. The Professor
keeps the monocle. Credits.

## The cast

Heroes (playable, switched with their portraits in the panel):

| Hero | Where | Looks (bunny suit) | Voice |
|---|---|---|---|
| **Kjell** | ground floor | Thin, tall, anxious owner of the Volvo. Glasses. Suit zipper broken halfway, one ear bent at a right angle, tail hanging by a thread. Carries the Volvo owner's manual. | Precise, fretful, loves his car too much. "Brunhilde has never let me down. Except tonight. And in 2019. And twice in 2021." |
| **Dag** | cellar | Huge, round, calm, beard. Hood down so the ears hang on his back like a cape, belly seam split, muddy knees from pushing the car. | Slow, content, food-first, surprisingly wise. "I've been in worse cellars. Actually I haven't." |
| **Espen** | attic | Small, wiry, excitable, messy hair out of the hood. Ears kept upright with coat-hanger wire (so they work as a "spirit antenna"), a ghost-hunter's EMF meter on a strap, grass stains. | Fast, credulous, podcaster. "This is going to be episode twelve. EPISODE TWELVE, Kjell." |

The house's people:

| Who | Where | What |
|---|---|---|
| **Mr Bones** | boiler room | Skeleton butler in a tail coat. Painfully formal. Freezing: his teeth chatter so hard his jaw keeps falling off. Keeps the lab key. "Will the gentlemen be staying for dinner? I'm afraid we are out of carrots." |
| **Aunt Hedvig** | parlour | Green, see-through ghost of the Professor's aunt, 1920s pearls, holding an endless séance to contact "the spirits of the living". Guards her fireplace poker. |
| **Gustav** | conservatory | Carnivorous plant the size of a wardrobe. Says only "HRRMM". Snaps at Kjell because Kjell looks like a rabbit. Swallowed the clock key years ago. |
| **Mrs Whiskers** | kitchen, on the fridge | The cat. White streak, monocle-shaped ring round one eye. Hisses at rabbits. Secretly the Professor. |
| **Count Flapula** | study | Small, theatrical vampire bat in a cape, hanging from the dormer window's latch. Wants blood. Is, privately, a vegetarian. Thinks Espen is a very large rabbit. |
| **Professor Ottilie Voltvik** | the ending | Wild white hair with one dark streak, lab coat, monocle. Brisk and delighted. |

## The house

Crooked everywhere, DOTT-style: walls lean, door frames tilt, portraits hang
askew, stairs curl. Storm outside every window (rain streaks, lightning that
lights the room). Warm candle, lamp and fire light inside (the pixel stage's
light map does this: a dim ambient plus glow pools).

Eleven rooms. The scene is 144 logical pixels tall; rooms are 320–480 wide
and the camera scrolls sideways when the room is wider than the view.

```
             ROOF (Espen)
               |  dormer window
 ATTIC:  STOREROOM ---- STUDY
            [dw]
 GROUND: KITCHEN ---- FOYER ---- PARLOUR
            [dw]        |
                   CONSERVATORY
 CELLAR: PANTRY ---- BOILER ROOM ---- LAB (locked)
            [dw]
 OUTSIDE: DRIVEWAY (intro and ending only)
 [dw] = the dumbwaiter hatch
```

### Ground floor (Kjell)

**Foyer** (440 wide). Chequered floor tilted like a ship's deck. The
grandfather clock, stopped at 11:59, with a winding keyhole. The portrait of
the Professor with her monocle and white streak. The staircase folded up into
the ceiling (its bottom step dangling out of reach). A suit of armour
(empty; talks back only as an echo). A coat rack with an umbrella. A
telephone table (the phone plays a 1987 radio jingle). The front door (won't
open: "It growled at me"). Doors: parlour (right), kitchen (left),
conservatory (back, glass door).

**Parlour** (360). Aunt Hedvig at a round séance table with a crystal ball
and four teacups. A fireplace with a poker on a hook (the chimney runs up to
the roof), a piano, a gramophone, a moose head wearing a party hat.

**Kitchen** (380). Mrs Whiskers asleep on top of a humming fridge. The
freezer door is frozen shut (ice block with rubber gloves and a note inside).
A drawer (matches, one match). A cupboard (a bottle of cooking oil; a tin of
sardines that is a gag). A cold stove. The dumbwaiter hatch with a little bell.

**Conservatory** (400). Glass roof leaking rain into buckets. Gustav in a
huge pot. A junction box on the wall where the lightning cable comes down
from the roof and goes on to the cellar: the cable is chewed through. Wet
leather gardening gloves (red herring). A watering can.

### Cellar (Dag)

**Pantry** (380). Shelves of jam jars ("LINGON 1987"). A barrel of pickled
herring. The dumbwaiter hatch. The coal chute, rain dripping in (too narrow
for Dag). The stairs up, the door nailed shut from the other side.

**Boiler room** (360). A cold iron furnace with a coal pile, pipes running
up into the house, a pressure gauge. Mr Bones sitting on a stool, shivering.
The iron door to the lab, locked.

**Lab** (440). The Lightning Machine: brass, glass tubes, a car battery
bolted into its heart. The transmogrifier booth (glass, a door, a cat-sized
seat and a human-sized one). The big lever (ARM). A blackboard: "MIDNIGHT =
MAXIMUM VOLTAGE", "TO UNDO: SAME SUBJECT, SAME BOOTH, REVERSE POLARITY". The
lightning cable coming down through the ceiling. A brain in a jar (it is a
cauliflower).

### Attic (Espen)

**Storeroom** (400). The dumbwaiter hatch. A trunk of letters (Torvald's
letters to Hedvig). A costume trunk. A dress mannequin Espen interviews for
his podcast. An old radio with no antenna. A rocking horse. The study door,
blocked by a heavy trunk on castors (PUSH fails, PULL works).

**Study** (360). The Professor's desk: a drawer with her spare monocle, her
diary on top. A telescope. Bookshelves. A bust of Alessandro Volta wearing
a scarf. Count Flapula hanging from the dormer window's latch. The dormer
window out to the roof.

**Roof** (440). Slates, rain, lightning. The chimney (sound carries down to
the parlour). The lightning rod lying in its rusted socket, its cable running
down the wall. A rooster weather vane. Far below: Brunhilde at the gate,
hazard lights blinking.

### Outside

**Driveway** (440). Iron gate, Brunhilde with her bonnet up, the house on
the cliff behind. Intro and ending only.

## The puzzles

Every puzzle has one solution; the dependency chart is below. Things sent by
dumbwaiter: GIVE an item to a friend's portrait (from anywhere; "Sending it
down the dumbwaiter"). The car battery and anything else too big cannot go.

| # | Who | Goal | Solution |
|---|---|---|---|
| 1 | Kjell | matches | OPEN the kitchen drawer, PICK UP the matchbox (one match). |
| 2 | Kjell | oil | OPEN the cupboard, PICK UP the cooking oil. |
| 3 | Kjell → Dag | fire | GIVE the manual and the matches to Dag. |
| 4 | Dag | light the furnace | USE matches on furnace alone: "the coal's damp, I'd waste our only match". USE manual on furnace (kindling), then USE matches on furnace. The furnace roars; the pipes knock through the house. |
| 5 | Dag | lab key | TALK TO Mr Bones once he's warm: he gives Dag the lab key. USE key on the iron door. |
| 6 | Dag | open jam | PICK UP jam. USE jam alone: stuck ("1987 was a strong year for lids"). USE jam on the lit furnace: the lid loosens. Dag eats a spoonful; now he'll part with his sandwich. |
| 7 | Espen | the study | PUSH trunk: too heavy. PULL trunk: it rolls on its castors. |
| 8 | Espen | monocle, diary | OPEN the desk drawer: monocle. LOOK AT diary: the transmogrifier clue. |
| 9 | Espen → Kjell | the cat | GIVE monocle to Kjell. Kjell GIVEs it to Mrs Whiskers: she puts it on, gives him a long look, and hops down. PICK UP cat (she allows it, barely). |
| 10 | Kjell → Dag | cat to the lab | GIVE cat to Dag. Dag OPENs the booth, USEs cat on booth. |
| 11 | Dag → Espen | jam | GIVE opened jam to Espen. Espen GIVEs it to Count Flapula ("It's red. That will do."): the bat flutters up to the rafters with it. |
| 12 | Espen | the roof | OPEN the dormer window, walk out. |
| 13 | Kjell → Espen | the rod | GIVE oil to Espen. Espen USEs oil on the rusted socket, then PULLs (or USEs) the rod upright. |
| 14 | Espen | letters | OPEN the letter trunk, PICK UP letters, LOOK AT letters: Torvald's beard was called **Sigurd**. |
| 15 | Espen ↔ Hedvig | the séance | On the roof, TALK TO the chimney. Hedvig, below, thinks she has reached the spirits of the living, and asks what Torvald called his beard. "SIGURD" (only offered after reading the letters) convinces her: the living may have her poker. |
| 16 | Kjell | poker | PICK UP poker (Hedvig lets him now). |
| 17 | Dag → Kjell | sandwich | GIVE sandwich to Kjell (after the jam; before it, Dag refuses). |
| 18 | Kjell | Gustav | GIVE sandwich to Gustav: he eats it, burps up the clock key and falls asleep. PICK UP clock key. |
| 19 | Kjell | gloves | After the furnace is lit, the freezer has thawed: OPEN freezer, PICK UP rubber gloves. |
| 20 | Kjell | the cable | OPEN junction box. USE poker on junction box: refuses without gloves, and while Gustav is awake. With both done, the poker bridges the cut. |
| 21 | Dag | arm the machine | PULL the big lever. |
| 22 | Kjell | midnight | USE clock key on the clock. It strikes twelve. If anything is missing, the strike fails in a way that names it (the rod lies flat; the cable sparks in the conservatory; the machine isn't armed; the booth is empty) and the clock clicks back to 11:59. With everything in place: the finale. |

Optional, for flavour and hints: the radio (Espen USEs it: no antenna, so he
pulls the coat-hanger wire out of his own bunny ears, which flop for the rest
of the game, and hears that the storm peaks "at the stroke of midnight");
Mr Bones' lore about "the night the cat arrived"; the blackboard; the phone,
the piano, the gramophone, the costume trunk, the mannequin, the armour, the
herring, the brain.

**Hints.** TALK TO a friend's portrait: they chat about what to do next.
The hint is chosen from the first unsolved goal the pair can see.

**Dependency chart.**

```
manual (start) ─┐
matches (1) ────┴─► furnace lit (4) ─┬─► Bones' key (5) ─► lab ─┬─► lever (21) ─────────────┐
                                      ├─► jam opens (6) ─┬─► sandwich free (17) ─► Gustav (18) ─► clock key ─┐
                                      │                  └─► jam to bat (11) ─► roof (12) ─┬─► rod (13) ◄─ oil (2)
                                      │                                                    └─► séance (15) ◄─ letters (14)
                                      └─► freezer thaws ─► gloves (19)                              │
trunk (7) ─► study ─► monocle (8) ─► cat (9) ─► booth (10) ◄─ lab                                   ▼
                                                                                 poker (16) ─► junction (20) ◄─ Gustav asleep
all of: rod, junction, booth, lever  +  clock key ─► MIDNIGHT (22) ─► finale
```

## Interface

The DOTT/SCUMM layout at 320×200 logical pixels: the scene on top (144 tall),
the panel below (56 tall):

- **Sentence line**: "Walk to Grandfather clock", "Use Oil with Rusty
  socket", in the current hero's colour.
- **Nine verbs** in a 3×3 grid: GIVE, PICK UP, USE / OPEN, LOOK AT, PUSH /
  CLOSE, TALK TO, PULL. The hotspot under the cursor lights its default verb
  (right-click does it).
- **Inventory**: icons in a grid, scroll arrows when it overflows.
- **Portraits**: the three heroes' heads. Click one to switch to him. GIVE an
  item to one to send it by dumbwaiter. TALK TO one for a hint.

Mouse: left-click to walk or to do the sentence, right-click for the default
verb. Keys: the verbs' initials (G P U O L S C T Y), 1/2/3 switch hero, `.`
skips a line, Space pauses, Escape tap pauses and a 3 s hold quits to the
title. Touch: tap a verb, tap a thing; tap a thing with no verb walks there
(a door leaves). On a portrait phone the view zooms in to
about 160 pixels wide (`stageMin` and `tallLayout` in `engine/layout.ts`),
so the scene fills the width, and the panel below it grows into big
buttons with what height is left. Scripted camera views keep their centre.

Dialogue: SCUMM style, text over the speaker's head in their colour, one line
at a time, timed by length, skipped with a click. Dialogue choices replace
the verb panel; a long option wraps (up to three lines), and when the options
don't fit, arrows beside the portraits, the arrow keys or the wheel scroll
them (the wide panel shows five one-line options). Every hero has his own blips of "voice" (Animal Crossing
style), pitched by who speaks.

## Sound

Synthesised Web Audio, no samples. One theme, an oompah-and-harpsichord
waltz in D minor, and an iMUSE-style arrangement per floor that crossfades
when you switch hero: ground floor harpsichord and tuba; cellar bassoon, low
pizzicato and drips; attic celesta, music box and wind. Rain and thunder
under everything, louder by windows. Stings for solved puzzles. Speech blips.
The site radio is parked while the game plays.

## Code

```
themes/battery/
  DESIGN.md       this file
  types.ts        rooms, hotspots, items, actors, commands, state, save
  engine/         pure TS, no DOM; tests bundle it with esbuild
    state.ts      new game, save/load
    walk.ts       walk polygons, path finding
    script.ts     the command runner (generator scripts)
    game.ts       the game: input → sentence → handler → script; update loop
    ctx.ts        what a handler sees (c.say, c.walk, c.give, c.flag …)
    index.ts
  content/        the game's data and scripts
    heroes.ts     the three, their colours and default lines
    items.ts      every item: name, icon id, look text, sending rules
    rooms/<id>.ts one per room: size, walk area, hotspots, handlers
    story.ts      intro, midnight attempt, finale, credits
    hints.ts      the portrait hints
    index.ts      registry
  render/         canvas painters on the pixel stage
    rooms/<id>.ts one per room: static background, animated layer, lights, front layer
    actors.ts     the character rig (heroes, Professor) and NPC painters
    items.ts      inventory icons
    ui.ts         panel, sentence line, choices, speech text, cursor
    fx.ts         rain, lightning, dust, sparks
    title.ts      title screen, split screen, credits
    index.ts      the renderer
  audio.ts
  progress.ts     local save, profile save
  Landing.vue     the page: canvas, input, EscHold, saves
  theme.css
```

**What would make it redundant:** Petter retiring it from the arcade. Then
drop the cabinet from `themes/zelda/world/town.ts`, the id from the registry,
`SAVE_GAMES` and CI.
