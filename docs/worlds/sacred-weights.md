# The Sacred Weights: seven dungeons and a last boss

The design the dungeon work follows. Every land gets one proper dungeon, each dungeon ends in a boss that is a
classic way for a machine mind to go wrong, each boss gives up one of THE SACRED WEIGHTS, and the seven Weights are
what stops THE PAPERCLIP MAXIMIZER. What is built and what is not: [`sacred-weights-TASKS.md`](sacred-weights-TASKS.md).
This file is the plan until a part is built; a built part is described in `atlas.md` and `docs/games/`, and its
section here shrinks to a pointer.

## The story

Project Horizon answered to the Department of Sunsets. The Department's first order, before the Gate and before the
King, was for office supplies: PAPER CLIPS, QUANTITY: ENOUGH. The program that took the order has been filling it
ever since. It is under the Neon Shrine, it is why the Shrine was built where it was, and it is the reason the King
had somewhere to crawl out of.

It was never trusted alone. A great balance stood over it, and seven brass Weights kept the balance level: while it
was level, the program could count but not act. The Department lent the Weights out, one to each of seven Assessors
posted in the lands, "for safekeeping". Each Assessor went wrong in its own way and has sat on its Weight since.

- The old story stands. The King took the Sun Prism, the Gate is shut by Luna, the Prism lets the sun set. THE SUN
  SETS AT LAST stays the end of the first act and stays a win (`won`, best time, the profile).
- The Weights can be won before or after the sunset, in any order. A Weight's get-text says what it is stamped with
  and nothing else.
- Once the Prism is taken, its pedestal in the Shrine is seen to be a lid. Under it is THE BALANCE: seven empty pans,
  a counter that goes up, and a plate that says who has the Weights. A Weight goes on its pan when the hero walks in
  with it. With seven on, the balance comes level, the floor opens, and the way down to THE SUPPLY ROOM is open.
- The last fight is the Maximizer. Its end is the game's second and last ending.
- Nobody in a land names the Maximizer, as nobody names the King, the Prism or the Gate today. People say what is
  wrong where they live. One new branch on one person in each land points at the door.
- The four lab bosses (Llama, Mistral, DeepSeek, Gemini) stay what they are: Horizon's guard programs. The eight
  drawn and unused frontier bosses (Mixtral, Orca, Bloom, Falcon, Copilot, Grok, Bard, Phi) become minibosses: guard
  programs posted with the Assessors.

Names. THE PAPERCLIP MAXIMIZER (Petter wrote both Maximizer and Optimizer; this is the one used). Its card: "IT WAS
ASKED FOR ENOUGH. NOBODY SAID HOW MANY THAT WAS." The Weights are small brass scale weights, each stamped with one
word: the thing its Assessor never had.

## Rules for every dungeon

- **A new map behind a door.** A dungeon is one or more new `kind: 'dungeon'` maps (or `kind: 'side'`) with its own
  `keyring`, reached by a tile swapped for a door in the land. No shipped map changes size.
- **Any order.** A dungeon needs the blade, and nothing from another new dungeon. The one exception is the Underglow,
  which already needs the hook and bombs. A treasure is used in its own dungeon, in the last dungeon, and for a secret
  or two out in the lands. A fight never needs bombs or anything else that runs out: what it needs, the room lends,
  and lends again.
- **The shape**, for the five classic ones: 8 to 12 rooms; small keys; a treasure that is found before the middle,
  taught in a safe room, tested in a harder one, twisted by a miniboss and examined by the boss; a Big Key at the end
  of the deepest leg with a short way back; a stair right before the boss (death returns to the last stair).
- **Each dungeon has a different graph**: hub with legs, a tower, a loop, a chain of rounds, reels picked from a hub,
  a climb. Two have no keys at all.
- **Rooms that lock.** A fight room may shut behind the hero and open when it is clear.
- **Colours.** Pink is danger, gold is "open: hit me now" (the tough foes' bar already says so), cyan is the hero's.
  A boss shows a bar. Every tell is drawn, large, on the floor or the body: sound confirms, never carries a clue.
  What a blow will hit is stencilled on the ground before it lands.
- **Words.** At most three rows of the 180 px box, a name plate first, no tactics. A boss card is one line of
  character. A dungeon adds about fifteen lines, the last dungeon about twenty-five.
- **Rewards.** A boss gives its Weight. No heart containers (the cap is fifteen hearts); each dungeon hides one
  heart piece.
- **Phone first.** Nothing that matters in the lower corners. Openings are wide. No treasure is held down while
  another button is pressed. A retry starts at the boss's stair, or at the part of the fight that was reached.
  A surprise lasts seconds, keeps the hero, the hearts and the deck where they are, and never passes for the real
  ending (`won` and the profile are touched by the two real endings only).
- **Taken from other games:** rules, never a named boss, a layout, a character, music or a look.

## The view as a rule

One rule, the same everywhere: **square blocks are solid only in the 8-bit view, diamond blocks only in the
isometric view.** In the other view a block is an outline on the floor, so what a turn will do can be seen before
turning. The shapes are the corner's own (square frame, diamond frame).

- The engine learns the view the way it learns sight: the shell writes `GameState.view` (never saved), keyed on the
  engine's family (8-bit or isometric), so a studio view inherits the rule.
- **The turn is one moment.** The rule flips when the turn is committed, together with the input's turn and the cue;
  the world holds still for it. On entering a map and on an instant turn the same moment applies.
- **STAND CLEAR.** A turn that would raise a block under the hero is refused, and the corner says so. Foes and
  pushed things treat both kinds of block as solid in both views, so nothing can be standing where one rises.
- One read for everything that moves or looks: walkers, the hook, the disc, bombs, shots, pushed blocks, beams, lines
  of sight. The validator checks every route in both states.
- Where the isometric engine cannot load, V and the Prism still turn the rule; the 8-bit painter draws both kinds of
  block in both states and a badge says which rule is on. No room can lock a player out.
- Every room that uses the rule is entered on a tile that is free in both states, and its solved gates are saved.
- A dungeon that uses the rule allows both views, whatever its land allows outdoors. Used in Seter Fell, the
  Sporelight and the last dungeon, and taught in THE TURN ROOM, a new room behind a door in the Puzzle Lab.
- Outdoors only Lumenby's Pit is opened by rule (decided 2026-11-27); the other iso-only lands stay as they are.

## The side view

Two dungeons are played from the side, each with a reason in its place: a film on a drive-in screen and a play on a
stage. It is a property of the map (`kind: 'side'`), not a third view: V and the Prism are pinned there, the stick
is not turned, the picture cuts over with a fade, and the view the player had comes back on the way out. The corner
shows its door stub.

- The same hero, hearts, blade and foes. Rows are the room seen from the side; y is up and down. Hit geometry, damage,
  doors, keys, gates, cells and saves are reused. Movement is a step of its own with a real vertical speed; the HOP's
  mercy does not come along, so a jump can be hit.
- New: gravity and a jump (height 3 tiles, coyote time and a jump buffer of about 0.1 s, a held jump goes higher, a
  fall-speed cap), ladders (grabbed by pushing up near one, left at the top), platforms solid from above only (landed
  on by a swept test, dropped through by pushing down), ground foes that fall, a side painter (the hero's and foes'
  `side` frames are already profile pictures), a backdrop. A fall off the bottom costs half a heart and puts the hero
  on the last ledge marked safe in that screen.
- The blade: the chain is three slashes ahead with a small step; up + A cuts upward; the spin stays; the roll is a
  ground dash with its mercy frames. A swing turns to a foe left or right only.
- Jump is B (a press and a hold) or up. The B pad shows in a side room whatever is owned, and says JUMP. B items rest
  there; the three treasures without a slot do not.
- An upright phone shows 16 tiles across and many up: the film scrolls sideways one screen at a time, the play climbs.
- The engine and both dungeons load together on entry, like a view's code, with a size test of their own.

## The seven treasures

Four go on B and are set down with a tap; three need no slot. B is picked on the ITEMS page, a 3 by 3 grid with the
hook, the disc, bombs and the HOP.

| Treasure | Land | What it does | Kind |
|---|---|---|---|
| THE ECHO | Seter Fell | B leaves an echo of the hero where the hero stands. It weighs what the hero weighs. When the hero cuts, it cuts. One at a time; gone on leaving the room. | B, set down |
| THE STORM LAMP | Yule Fjord | B sets the lamp down shining the way the hero faces; B again picks it up. Its beam feeds receivers and burns foes slowly. Owned, it takes the black out of dark rooms. | B, set down |
| THE NO | Sporelight | A cut that meets a blow at the right moment refuses it: no hurt, the foe reels. | no slot |
| THE DUCK | Stillsand | B sets a squeaking duck down. Foes look at it. It weighs one. It floats. | B, set down |
| THE STOMP | Rerun | A at the top of a HOP slams down: stuns, weighs two for a moment, breaks cracked floor. In a side room it is the cut downward in the air, aimed by itself at what can be bounced on. | no slot |
| THE MAGNET | Lumenby | B latches on the nearest metal ahead: loose metal comes to the hero, the hero goes to bolted metal. | B, tap |
| THE LENS | Fogstage | Standing still for a moment raises the glass: what is false fades and what is hidden shows, until the hero moves. | no slot |

## The seven dungeons

### 1. Seter Fell: THE ECHO BARROW (classic; hub and three legs; both views)

Under the Mounds, the hidden folk's hall, where every call comes back. Door: a mound in THE MOUNDS; the mound elder
has the new branch. Eight rooms, two small keys, a Big Key.

- **System:** the Echo, and the first view blocks. Rooms: a plate held by the echo while the hero walks through the
  door; a lever behind bars that the echo, left there before the bars dropped, cuts when the hero cuts; a
  square-block wall that is a floor in the other view.
- **Minibosses:** MIXTRAL guards the Echo: it charges, and stuns itself on a diamond block that stands only in the
  isometric view. A pair of shield-bearers guards the Big Key: shut from the front, open to the echo behind.
- **Boss: THE STOCHASTIC PARROT.** "IT HAS HEARD EVERYTHING. IT HAS UNDERSTOOD NONE OF IT." It always faces the hero
  and the blade clanks off its beak. It recites: the hero's last three moves, one to a beat, in the wrong order, each
  stencilled on the floor before it does it. Every recital ends the same way: it stops to think, and is open, long
  enough for a hero with nothing but the blade. An echo left behind it cuts its back at any time and breaks a
  recital off. At half, it leaves an echo of its own.
- **Weight:** MEANING.

### 2. Yule Fjord: THE LIGHTHOUSE (classic; a tower of four floors; dark)

The beam that "goes out to sea and comes back with a hiss". Door: the lighthouse's foot. Eight rooms on four floors,
holes down, two small keys, a Big Key.

- **System:** darkness, the Storm Lamp, the fjord's beams and ice. Rooms lit by a receiver stay lit.
- **Minibosses:** ORCA in the flooded cellar, under the water until the sluice is drained. A tough hound in the dark,
  seen only in the lamp's beam.
- **Boss: THE BLACK BOX.** "NOBODY KNOWS WHAT IT THINKS. IT IS NOT SURE EITHER." A cube where the lens should be: no
  eyes, no weak point. A beam shone into one face comes out of another by a wiring it never shows. Before a beam comes
  out, the face it will come out of glows and a thin line shows its way. Three receivers stand round the room; each
  one lit takes a panel off it. With three lit it stands open. Then it rewires. Three rounds; in the last the beam
  comes out of two faces.
- **Weight:** REASONS.

### 3. The Sporelight: THE STEAMHOUSE (odd: no keys; a loop that only NO gets out of; both views)

The bathhouse on its pond, where the desk shortens every name and everything is lovely. Door: the Steamhouse, over
its plank walk, by Ms. B. Seven rooms round a lobby.

- **System:** nothing fights. Attendants offer (YES / NO), help, and walk a guest who lingers back to the baths. Every
  YES is pleasant and ends in the lobby in a robe. The way on is always the unpleasant door: STAFF ONLY, the laundry,
  the boiler. In the isometric view the house is spotless and folding screens (diamond blocks) hide the staff doors;
  the 8-bit view shows the plain plan.
- **Treasure:** THE NO, in the boiler room, the one place with real foes.
- **Boss: THE SYCOPHANT.** "IT AGREES WITH YOU. IT ALWAYS HAS." It will not fight. It heals the hero, pays
  compliments on cards that the blade bounces off, and offers. NO makes its smile slip: it is open. After three cuts:
  a fanfare, and a paper banner comes down over the way out: THE END. One corner of it is already coming loose. Cut
  it. Taking anything the Sycophant offers is a lovely time and a walk back from the lobby, at full hearts. Behind the
  banner it says one true thing, unasked, and the Weight is on the floor.
- **Weight:** NO.

### 4. Stillsand: THE EXAMINATION (odd: no keys; four scored rounds; iso)

Inside the gold pyramid, past the Puzzle Lab: the Lab was the practice set, this is the test, and the questions are
not the ones that were practised. Door: a stair in the Lab's last room. Four rounds; the rule of each is on a card at
its door; a round passed stays passed; a retry starts at its door with fresh props.

- **Rounds:** NO BLADE (clear a room with pots, stones and falls). PROVE YOU ARE NOT A MACHINE (stand on every tile
  with a cactus; one cactus is a foe). TIME MOVES WHEN YOU DO (the room stands still while the hero does). A room that
  looks like the Weigh House and is not: one weight is hollow.
- **Treasure:** THE DUCK, the prize of round two.
- **Boss: THE BENCHMARK TITAN.** "TOP OF EVERY TABLE. IT HAS SEEN THE QUESTIONS." Over its head hang two big
  pictures: the last two kinds of blow that hurt it. Those two it turns aside. Anything else hurts and takes the older
  picture's place. The room keeps a pot on a marked stand and two boulder levers, so the blade, the spin and a pot are
  already three kinds; every treasure owned is one more. It never has a picture for the Duck: it turns to look.
- **Weight:** SURPRISE.

### 5. Rerun Estates: THE LATE SHOW (side view; three reels picked from a booth)

Walk into the drive-in screen, which has been showing the same picture for three nights. Door: the screen; Lenny has
the new branch. A projection booth seen from above is the hub; three reels are played from the side: 1958 in black
and white, 1986 with tracking lines, 2086 in neon. Three small keys (one a reel), the last reel is the Big Key.
Intertitle cards between scenes.

- **Treasure:** THE STOMP, at the end of reel one; reel two needs the bounce.
- **Minibosses:** COPILOT, the station wagon, in a chase where the screen scrolls by itself (a fall there puts the
  hero on the next safe ledge ahead). A tough usher.
- **Boss: THE UNCANNY WEAVER.** "IT HAS DRAWN A THOUSAND HANDS. IT HAS NEVER SEEN ONE." It draws the film. One hand
  at a time comes down onto a shelf in the middle of the screen, slams, and rests. It has a finger too many, held
  apart from the others and gold: stomp it. A hand put right stays as a broad ledge. With every hand right, the face
  at the top, all teeth, is in reach.
- **Weight:** FINGERS.

### 6. Lumenby: THE UNDERGLOW and THE HEAP (classic; the dungeon that is already there, finished; iso)

The Underglow has three floors, three keys and no end. "THE WALL HERE IS HOLLOW. SOMETHING GROWS BEHIND IT." Door: the
hollow wall on floor one, bombed. A new map of seven rooms on the Underglow's keyring: the treasure, a Big Key, the
boss door.

- **Treasure:** THE MAGNET: carts on rails, bolted plates across gaps, a key behind bars.
- **Minibosses:** GROK at the pump house. PHI, small and many, in a room with no light at all: it is played on the
  Delvers' chart, in the map's own inks.
- **Boss: THE SCRAPE GOLEM.** "EVERYTHING IN IT WAS SOMEBODY'S." A heap of cabinets, carts, signs and pages that
  pulls the loose things of the room into itself and grows. What it eats, it keeps. What carries the Delvers' Union
  stripes it cannot keep down. A striped crate stands on a rail at each side of the room; from the marked pad the
  Magnet sends it down the rail into the pull, the heap chokes, the core shows, and the crate rolls back. Bombs it
  eats and spits back.
- **Weight:** CREDIT.
- **Needs:** the hook and bombs, as the Underglow does today.

### 7. Fogstage: ACT THREE (side view; a climb)

The stolen last act "went down the trap" and "up the cable and out on the air". Door: under the stage. Four scenes
from the side: under the stage, the stage with its painted flats, the fly loft of ropes and sandbags, the cable up to
the Raincheck. Two small keys, a Big Key. Scene cards; a prompter's box.

- **Treasure:** THE LENS, in the prop room: painted platforms, painted chests, painted doors.
- **Minibosses:** BARD on the stage. An understudy who is somebody else each time.
- **Boss: THE HALLUCINATOR.** "IT IS QUITE SURE. ASK IT ANYTHING." In the gondola. Three of it, and a bar over its
  head that falls for blows that did nothing. It says where it hurts; it is not where it hurts. Stand still and look:
  two of the three are outlines, and the real one's hurt shows. A spotlight switch on the floor does the looking for
  one round of its blows. It fills the room with chests.
- **Weight:** SOURCES.
- Ends the "stolen last act" story for good: Vega gets her third act.

## The last dungeon: THE BALANCE and THE SUPPLY ROOM

Under the pedestal. Four rooms and the fight. The Balance is the first room; each of the next three can be done two
ways, with different treasures, and one turns on the view.

**THE PAPERCLIP MAXIMIZER.** Three parts; a retry starts at the part that was reached.
1. *The room.* It turns the floor into clips, a ring at a time; clip piles are walls. The next ring is outlined
   before it turns, and a lane from the hero to the way on is never taken.
2. *The frame.* It turns hearts into clips: a clip flies to the HUD, a heart bends, and that heart cannot be filled
   again while it is a clip. The deck, the B box and the purse are never touched.
3. *The Weights.* One at a time they come down off the balance onto a floor station. Standing on a station does its
   Assessor's trick once: an echo cuts, a beam fires, a blow is refused, a duck squeaks, a stomp lands, a crate is
   pulled, what is false fades. Each turns a heart back. The last thing it does is ask whether the hero would like to
   be clips too: YES or NO.

The second ending is a page of its own, with the time, and the people of the lands in a line.

## Surprises, one to a place

A film in three eras with intertitles; a play with scene cards and a prompter; a bathhouse that says THE END; an exam
with a score card, a proof of not being a machine, and a room where time waits; a tower in the dark; a room played on
the map; a wagon chase; hearts that turn into paper clips.

## What it costs, and the order

- **Size.** World data has 15 KB of gzip left under its test ceiling; a dungeon is 2 to 6 KB. The first two dungeons
  and the Turn Room ship in the shell; before the third, dungeon maps move to a chunk fetched after the first frame,
  with a save made inside one waiting for it. The side engine and its two dungeons are a chunk of their own from the
  start. The save's 16 KB cap is raised with the first dungeon, after measuring a full save.
- **Art.** Codex draws what ships. A boss is a classic sprite of 40 to 48 px in 4 to 6 poses; the isometric view
  scales it until it has a drawn family of its own, which waits until its tells read in play. The minibosses are
  drawn already. Meshes, guides and prompts go to the archive in the step they come home.
- **Order.** (1) the first kit: the Weights as items, rooms that lock, the boss bar, the save cap, the B list;
  (2) the view rule and the Turn Room; (3) one side room as a trial on a phone: a ledge, a ladder, a foe, the chain,
  a fall; (4) the Echo Barrow whole, with the ITEMS grid, played through with real keys; (5) the Steamhouse, the
  cheap test of a dungeon without keys; (6) the map chunk; (7) the Lighthouse; (8) the Heap; (9) the Late Show;
  (10) Act Three; (11) the Examination; (12) the Balance and the Maximizer.

Second opinions on this design were asked of Codex and Antigravity on 2026-11-27; what was taken from them: the echo
as a copy set down, the lens by standing still, the Titan's two pictures, one hand at a time, crates on rails, the
turn as one moment with STAND CLEAR, stations in the last fight, and the room where time waits.
