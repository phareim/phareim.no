# RERUN ESTATES

Past the end of the coast road the hedges turn into lawns, and the lawns go on: a suburb of cul-de-sacs,
mailboxes and sprinklers that is the same street in three years at once. Step into a phone booth, dial, and step
out on the same corner in 1958 (pastel, half-built, saplings), 1986 (neon, now) or 2086 (overgrown, the houses
empty, the dishes rusted). Whatever you plant, bury or break in an earlier year is still there later. And
something drives laps of the estate in all three years: a wood-panel station wagon with a cardboard cut-out in the
passenger seat and nobody at the wheel.

## Inspiration

- **EarthBound's small-town America seen slightly wrong** (yo-yos, hamburgers, a mad taxi, a cranky lady, an
  unassuming local guy as foes): here the suburb's things have gone touchy (a mower, a sprinkler, a flamingo
  flock, a mailbox that bites). People are fine; things are not.
- **EarthBound's visible foes, green swirl for a back touch and red when they get you, and weaker foes that flee
  and lose on contact**: battles start on the lawn where you stand; a back touch gives the first cue; a group the
  hero outclasses runs, and catching one is an instant win.
- **EarthBound's HP that rolls down like an odometer**: hearts tick down like a gas-pump counter; win before the
  roll ends and the rest never lands (a core rule, `battle-notes.md`).
- **EarthBound's Dad on the phone who saves, and its band stuck in debt to a crooked theatre**: phone booths call
  Petter's house to save (an answering machine). The Overdue Four, a cover band, owe the drive-in "one more gig"
  every night, and their bassist is lost in another decade.
- **Chrono Trigger's eras and cause and effect through time** (a seed in one age is a forest in another): the
  whole hook. One seed renders three years; a short table of changes carries forward.
- **FFVI's World of Ruin** (the same map after the end, one lonely island): 2086 is the estate after everyone
  left, lawns gone to grass, pools to reedy ponds, one old woman who stayed.

## Look & sound

- 1986: **cyan** pools and lawns, **pink** porch neon, **gold** street lamps, **violet** roofs, **rose** drives.
  1958: the same tones bleached to pastel, no neon. 2086: **violet** dusk and ruins, **gold** only in solar lamps.
- Ground mix (1986): lawn 40 %, path (roads, drives) 22 %, building 14 %, fence/hedge 10 %, flowers 5 %, tree 4 %,
  water (pools) 2 %, lamp/sign 3 %. 1958: sand on 30 % of lots, bushes for trees. 2086: tall grass on 70 % of lawn.
- Light: 1958 bright afternoon; 1986 the town's dusk, lamp pools, pink windows; 2086 violet dusk, fireflies.
- Music: a jaunty organ-and-sax suburb tune; on a toy piano in 1958, slowed on warped tape in 2086.
- `views: iso, classic` (a lattice of lots and fences reads well flat).

## Procedural recipe

- **Size**: 192×128 tiles, 8 regions of 48×64. One seed, three eras rendered from it.
- **Roads**: a lattice, spacing 24 × 20, nodes jittered ±3; 35 % of edges cut, each stub ending in a cul-de-sac
  (a path disc of radius 3, a lamp in the middle). Every block keeps road on 2 sides. Lamps every 8 tiles.
- **Lots**: 10×8, facing the nearest road: house (building 4×3, door to the road), drive (path 2 wide), lawn, front
  fence or hedge (60 %), mailbox (sign), 1–2 back trees, flowers under the windows (50 %), pool (water 3×2, 15 %).
- **Features**: one hedge maze per region (12×12 of bush, 2-tile corridors, recursive backtracker); the creek
  (one water meander east–west, 2–3 wide, bridges at roads); garage sales (a lot with 4–6 tables, 20 % per region).
- **POIs per region**: 1 phone booth on a corner (save + era jump); 3 encounter groups (2–4 foes on lawns, never
  on a cul-de-sac disc); 1 odd house from a table (the backwards house, the lawn of flowers spelling a letter, the
  haunted garage, the band's van, the dish that hears static); 1 capsule spot (an X of flowers in 1958); 1 chest.
- **Era transforms** (per tile from the 1986 base): 1958: 30 % of lots sand + fence (building sites), trees →
  bush, no lamps, no pools, the outer two lattice columns tall grass, the creek wide with two bridges missing.
  2086: lawn → tall grass (70 %), house → rock rubble (30 %, by lot hash), pools → reedy water, trees → 2×2 big
  trees, lamps dark but 1 in 4 solar, every 5th road tile cracked to ground, one creek bridge gone.
- **Carry-forward map** (the only state shared across eras, per lot): acorn planted (1958) → tree (1986) → big
  tree that falls across the creek as a bridge (2086); capsule buried (1958) → chest later; fence broken → broken
  later; flamingo moved (1958) → still there; house painted (1986) → faded (2086).
- **Uniques**: the drive-in (20×16, screen + speaker posts); Rose's house (all years); COPILOT's cul-de-sac.
- **Rarities**: a lawn gnome heart piece (1958); an ice-cream truck that heals a heart (5 % per region per visit).

## Folk

- **Paperboy**, throws the same paper every day: "Extra! Same news as yesterday!"
- **Garage-sale lady**, prices everything at one bit: "Everything's a bit. Even the dog."
- **The Overdue Four**, a cover band in sequinned jackets: "We owe the drive-in one gig. Forever."
- **Rose**, a girl in 1958, a mum in 1986, a gran in 2086: "I planted that oak. Mind the roots."
- **TV repairman**, a van full of tubes: "Every set shows the same play. Odd."
- **Answering machine**, in every booth: "You've reached Petter's. Saved. Beep."

## Foes

- **spitter** (sprinkler), reused: sprays pellets in a ring of 4; wet tiles are slick (knockback +1) for a cue.
- **hound** (loose dog), reused: circles, then lunges at whoever acted last.
- **drone** (2086 satellite dish), reused: fires along one iso line; Luna can turn it to face its friends.
- **Mower** (new): rolls straight on its cue, turns only at fences, mows tall grass away, hits all in its row.
- **Flamingo flock** (new, 3–5 plastic birds): when one is hit, all the others turn to face the attacker; hits
  from behind do double, so the order of blows matters.
- **Mailbox** (new): looks like a sign; reading it starts a battle with its cue full; flag up, it is about to
  bite (2 damage); flag down, it can be hit.
- **Boss: COPILOT** (the station wagon, 36 HP): laps its cul-de-sac with a cardboard passenger. Every third cue
  it honks and the arena jumps year: 1958 (new paint, fast, only the engine at the front can be hit, saplings give
  no cover), 1986 (the side doors are weak, parked cars to hide behind), 2086 (rusted, slow, tyres weak, and the
  big tree falls on it if you planted the acorn). Below half the cut-out gives "directions": a lane is telegraphed.

## Mechanic hook

**Three years, one street.** Phone booths jump between 1958, 1986 and 2086 on the same corner, and save. One seed,
a per-tile era transform, a small carry-forward map of what the player changed. The puzzles are physical and slow:
plant, bury, push a flamingo, break a fence, then go forward and use the result (a tree bridge, a dug-up chest, a
gap in a hedge). Field battles run as in FOGSTAGE: back touch first cue, outclassed groups flee, rolling hearts.

## Quest hooks

- **Rose's time capsule**: in 1958 she asks you to bury her tin under the X; in 2086 she asks you to dig it up
  (a heart piece, and a photo of the street that marks every capsule spot on the map).
- **The Overdue Four's last gig**: the bassist is an old man in 2086 and a boy with a bass he cannot play yet in
  1958. Bring him back in 1986 and the drive-in show clears the debt.
- **The tree bridge**: the 2086 creek has no way to the east lots; a 1986 garage sale sells acorns.
- **The maze cat**: a cat lost in the 1986 hedge maze; in 1958 the maze is knee-high saplings you can see over.
- **Cross-realm, the rerun**: the TV repairman's tape of the stolen last act goes to FOGSTAGE (BARD's last verse).
- **Cross-realm, the dish that hears static**: the 2086 dish picks up the Other Side; tuned with Dusty's help
  (Radio Hill, the Wildwood), it points at a Project Horizon relay in another realm.

## Art needs

- The suburb in three years: house (4 colourways × 3, ruined), garage, mailbox (flag up/down), hedges, pool/pond,
  lamps (street, solar), phone booth (lit/ringing), drive-in; era jump wipe (0.5 s); acorn → fallen big tree.
- Rotoscoped bodies: COPILOT (new, neon, rust; honk frames; cardboard copilot), the band's van, the TV van, the
  ice-cream truck. Folk: paperboy on a bike, garage-sale lady, the Overdue Four, Rose at three ages,
  TV repairman. Foes: sprinkler, loose dog, dish, Mower, flamingo (4 facings), Mailbox (closed/biting).
- Tracks: the suburb tune ×3 (toy piano, neon, warped tape); a drive-in gig stinger.
