# YULE FJORD

A fishing fjord in the dark time, when the sun does not rise for weeks and noon is one blue hour. The village of
stilt-huts and drying racks has gone into the long winter sleep: most folk stay in bed until the sun comes back, and
a handful are awake to keep the lamps lit. The aurora runs pink and cyan over the cliffs, and on the Yule nights
something rides along it with a rattle like a radio between stations. Draugs row half-boats in the fog, a grey horse
grazes by the one rapid that never freezes, and an old woman with a broom walks from house to house putting the
lamps out. The hero keeps the lights burning until the first sunrise of the year, the mirror of the home coast,
where the sun would not set.

## Inspiration

- **Oskoreia, the Yule ride** (snl.no): the restless dead and troll-kin ride fire-spitting horses through the Yule
  nights, a rattling, noisy band; horses taken from the stable are found at dawn sweating and trembling; people are
  swept up and dropped far from home; folk drew crosses in chalk or tar on doors, casks and horses, hung sharp steel
  over the door, and if caught outdoors threw themselves flat on the ground like a cross. *Here:* the Ride follows
  the aurora, its rattle is the game's static (a nod to the Other Side), and its sweep moves people between realms.
- **Draugen** (Nordland; Jonas Lie's tales): a drowned fisherman with seaweed for a head, rowing half a boat; his
  cries foretell storms; he calls "welcome" or your name, and you must not answer but turn your back and shout it
  back; wreck planks buried above the tide mark take his power; get him over the tide line, or hold on till
  daylight, and he is gone; a firebrand thrown with "you're on fire!" sends him to sea. *Here:* a foe and the boss.
- **Nøkken** (snl.no): lives in rivers, tarns and wells; a grey horse grazing at the edge (sit on it and it leaps in),
  a log, a hollow boat; fiddle music at rapids; say its name and it lets go; it teaches the fiddle to whoever throws
  it meat on three Thursday evenings. *Here:* a lurking foe and a quest.
- **Pesta** (Kittelsen's *Svartedauen*): an old woman walking farm to farm with a rake and a broom; the rake means
  some are spared, the broom none; "she sweeps every corner". *Here:* the **Sweeper**, who sweeps the light out of
  houses (lamps, not lives); a rake visit leaves some lamps lit.
- **Mørketid** (Northern Norway): weeks without sun, then a first sun day with sun buns. *Here:* the goal and ending.
- **Moominvalley in winter** (tone only): a valley asleep, odd beings awake only in winter, a lonely cold thing
  drawn to light. *Here:* the **Lamplicker**, a shy, huge, soft shape that follows lamps and eats their glow; the
  water where it rests freezes.

## Look & sound

- Palette: **cyan** ice, snow shadow and the blue noon; **violet** cliffs and night water; **pink** and **cyan**
  aurora; **gold** lamp windows, lanterns and the stockfish racks by lamplight; **rose** the noon glow on the peaks.
- Ground mix: snow (new tile) 35 %, water 20 %, rock/cliff 20 %, ice (new tile) 15 %, path/boardwalk 6 %, spruce 4 %.
- Light: night ambient all day; at noon a 90-second blue hour (ambient up, no sun disc); lamps are the main light and
  the hero's lantern is a carried one; the aurora is a moving band that lays faint coloured light.
- Music: a slow fiddle air over a sympathetic-string drone and music bells; a crackle rises as the Ride nears.
- `views:` iso only (fjord walls, tide heights and stilt-huts need the height).

## Procedural recipe

- **Region** 64×48 tiles, 6–8 per realm strung along one fjord from the open sea (west) to a glacier tongue (east).
- **Terrain**: a main channel 6–12 tiles wide, meandering; **fjord arms**, 2–4 water fingers from the channel, 3–5
  wide and 12–30 long, each ending in a waterfall (frozen 3 in 4) or a river mouth. Cliffs rise from the shore in
  bands 0–4 (0 strand at sea level, 1 village shelf, 2–3 cliff, 4 fell top).
- **Tide**: band-0 water rises and falls on a 4-minute cycle; strand tiles (sand, rock) flood at high tide; a glowing
  cyan row of weed, the **tide mark**, lies one tile above the highest flood.
- **Ice**: tarns and still arm ends are ice (slides); each river mouth keeps one open rapid.
- **Generators**: *village shelf* (4–9 stilt-huts on band 1, a boathouse on the strand, 1–3 drying racks, a pier,
  lamp posts every 5 tiles; every door has a chalk-cross slot); *wreck line* (3–6 planks on the strand, re-rolled at
  each high tide); *spruce clumps* on bands 2–3; *ice falls* at arm ends; *boulders* on ice slopes (rolling stones).
- **POIs per region**: village 1 (4–6 per realm), boathouse 1–2, sea cave 0–1 (low tide only), waterfall rapid 1–2,
  ice-fishing camp 0–1; per realm a lighthouse (west mouth) and a stave church (centre).
- **Variation**: seaward regions have rough water, more draugs and little ice; inland ones are still and frozen,
  with more nøkk and ice puzzles; the glacier end is high and empty, where the Ride comes down.
- **Rare**: a hot spring with a sleeping elder in it (1 per realm); a beached half-boat (1 in 2 realms); a night with
  no aurora, when the Ride does not come.

## Folk

- **Lighthouse keeper**, the last one awake, yawning. "KEEP THE LAMPS LIT TILL SUN DAY."
- **A Sleeper** in a box bed, talking in their sleep. "WAKE ME... WHEN IT'S... BUNS..."
- **Chalk girl**, door to door, very serious. "THE DOORS BY THE PIER HAVE NO MARKS."
- **The Sweeper**, old and polite, broom and rake. "MIND ROWING ME ACROSS, DEAR?"
- **The fiddler** who can't stop playing. "IT TAUGHT ME ONE TUNE. NOT THE END."
- **Stockfish wife** at the racks, blunt. "SOMETHING ATE MY FISH. SOMETHING WET."
- **Boathouse grandad** counts the storm cries. "THREE CRIES LAST NIGHT. NOBODY ROWS."

## Foes

- Reused: **bat** (sea caves), **zapper** (charged wisps under the aurora), **dasher** (seals sliding on ice).
- **Draug** (new): rows a half-boat along the shore calling the hero; facing it while it calls costs a heart; turn
  your back and call back and it comes ashore, a slow grappler that weakens above the tide mark.
- **Nøkk** (new): a grey horse grazing at the water or a log at the bank; still until touched, then it lunges to drag
  the hero in; steel thrown in the water, or its name (carved somewhere near), sends it under.
- **Ride-rider** (new, an event): the Ride crosses the region along the aurora in 20 s; a hero standing in the open is
  swept up and dropped in a random region (or another realm); one lying flat is passed over.
- **Boss: ORCA**, a draug in half a boat, two hundred years looking for the other half: "NOT A WHALE. NEVER WAS."
  The fight follows the tide: at low tide he wrestles on the strand and the hero must shove him over the tide mark
  before the water returns; at high tide he rows and calls, and only a firebrand thrown from the shore reaches him.
  Wreck planks of the arena buried above the mark first make his grip weaker.

## Mechanic hook

**Physical puzzles** (water, ice, weights, beams, rolling stones), driven by the tide and the cold:
- **The tide**: a strand path, a sea cave or a pier step exists only at low tide; drying racks are weights that lift
  the boathouse doors when hung with fish; stones pushed onto the strand stay or wash a tile with each tide.
- **The Lamplicker as a tool**: it follows the brightest lamp, and where it sits the water freezes for 20 s. Carry
  the lantern to lead it, set it down by a fjord arm and walk the ice; lead it near the village and the lamps go.
- **"The Ride"** (encounter): the crackle rises, the aurora goes white, horses scream in the stables. Lie flat (hold
  down + B) in the open or stand in a chalk-crossed door. Afterwards the taken horses are found sweating in their
  stalls, and a stranger from elsewhere has been dropped by the pier.
- **"Light across the fjord"** (puzzle): the lighthouse beam sweeps; ice blocks are mirrors that slide until they hit
  something; set them so the beam reaches the far shore's dead lamp and wakes that village.

## Quest hooks

- **Chalk before Yule**: help the chalk girl mark every door, cask and stall before the Ride night.
- **Bury the planks**: carry each washed-up plank above the tide mark; the last one has a mitten on it.
- **Three Thursdays**: the fiddler wants the end of his tune; leave a fish at the rapid on three Thursday nights (the
  realm's week clock) and the nøkk plays the rest.
- **The Sweeper's ferry**: row her across the fjord or don't; ferried, she uses the rake on your village, not the broom.
- **Sun Day**: relight every lamp and wake the Sleepers; the first sun rises over the glacier; sun buns for everyone.
- *Cross-realm*: **the Ride drops strangers**: after each Ride someone from another realm stands by the pier (a seter
  girl from SETER FELL, asking about the cows), and a hero swept up can land in another realm.
- *Cross-realm*: **the cracked bell** of the stave church: recast and rung, it calls home those taken into the
  mountains in any realm (SETER FELL's tail-neighbour wants to be wed under it).

## Art needs

- Tiles: snow, ice (plain, cracked), strand in three tide states, tide-mark weed row, frozen waterfall, open rapid,
  stilt boardwalk, pier.
- Props: stilt-hut (lamp on/off, chalk cross), boathouse, drying rack (empty/full), lighthouse and beam, stave church
  with bell, half-boat, wreck plank, lamp post, box bed.
- People: lighthouse keeper, sleeper, chalk girl, the Sweeper (broom and rake poses), fiddler, stockfish wife, grandad.
- Creatures: the Lamplicker (drift, sit, freeze ring); horses in stalls (calm, sweating).
- Foes: draug (row, call, wrestle), nøkk (horse, log, lunge), Ride riders (silhouettes on the aurora), seal (dasher
  skin), ORCA (in the boat, ashore, burning). Effects: aurora band, static crackle, freeze ring, firebrand, sunrise.
