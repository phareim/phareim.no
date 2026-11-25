# STILLSAND

A pastel desert held at the moment just after sunrise, so quiet that a footstep carries for a screen. Islands of old
violet stone hang over the dunes at fixed heights, each held up by a humming lump of gold quartz knotted into the
roots of a single tree; on some, a moss-green garden machine still waters flowers nobody has looked at for an age. The
people who cross it ride stone birds and do not talk. Every few minutes the wind turns and redraws the dunes, and
whatever was rolling keeps rolling. It is the realm of weights, beams and patience.

## Inspiration

Sources: Mœbius (*Arzach*, *The Airtight Garage*, *The World of Edena*, his desert colour), *Castle in the Sky*.

- **Arzach's wordless rider on a stone pterodactyl**: the **Quiet**, wanderers who never speak and answer by holding
  up a painted stone (an arrow, a glyph); **slatebirds**, stone birds that carry the hero between mesa roosts (fast
  travel, downwind only). By day the realm has no music, only wind and the quartz's far chord.
- **Mœbius's desert colours** (sun reds, yellows, oranges against blues; pastel horizons, tiny figures on huge
  ground): rose sand, gold crests, cyan shadows always away from the low sun; long sightlines, a small hero.
- **The floating island held by a crystal in a great tree's roots**: every island has one root tree and one
  **hum-quartz**; its height depends on the weight it carries. Take the quartz and it falls (craters are landmarks).
- **The lone moss-covered gardener robot birds nest on; dormant soldier robots woken by the crystal**: **Tenders**,
  garden machines with nests in their shoulders that charge only if you trample their flowers; **Wardens**,
  half-buried, woken by quartz or a sunbeam: a puzzle piece first (they walk dead straight), a foe second.
- **The Airtight Garage, a pocket universe its maker keeps adding to**: the **Maker's Box**, a hollow butte whose
  floors are regenerated from a new seed every visit; the maker is a slow star overhead that drops notes.
- **Edena's refugee camp round a transporting pyramid; travellers raised on synthetic food**: the realm's gate is a
  gold pyramid with a caravan camped round it, living on ration bricks and wary of real fruit.

## Look & sound

- **Palette:** rose sand, gold crests and quartz, cyan shadows and salt, violet sky, island stone and Quiet cloaks;
  pink only for danger (Warden eyes, the burrower's wake).
- **Ground mix:** sand ~65%, ground (hardpan) ~15%, rock 5%, cliff on mesa and island edges, flowers and tree only
  on islands and oases, water only in oases and the salt flat's mirror skim.
- **Light:** a fixed low sun per region (its azimuth is in the region seed), long hard shadows; night violet-black
  with gold quartz glowing above like low stars, cyan oasis lamps, one pink lantern per Quiet.
- **Music:** day silent (wind, quartz hum); dusk and night a slow synth pad with one plucked line, a far signal.
- **views:** `iso` only (stacked heights and floating islands are the point; flat they read as blobs).

## Procedural recipe

Regions are 48×48 tiles; a realm is 3×3 to 4×4 regions around the pyramid region.

- **Heights:** band 0 basin (salt flat, oasis), 1 dunes, 2 mesas (cliff edges, 3–8 tiles wide), 3–5 islands (not
  attached to ground). Low-frequency noise → bands 0–2; dunes: stripe noise along the region's wind axis, crests
  every 5–7 tiles in a lighter sand.
- **Water:** an oasis in 40% of regions (pond 3–6, palms, tall-grass ring, a lamp); salt flats get a mirror skim.
- **Islands:** 3–5 per region, poisson-placed ≥8 tiles apart, 5–11 tiles; one root tree, one quartz, 50% flowers,
  20% a Tender garden. Band = 5 − weight (hero 1, rock 1, block 2, Warden 3), clamped 3–5. Islands within 6 tiles
  may share a **chain over a pulley** (one rises as the other sinks).
- **Features:** rib arches (a giant bird's stone ribs, 2–3 per region, walkable under), fallen-island craters
  (1–2), half-buried Wardens (1), rolling stones parked on crests (4–8), a roost on one mesa.
- **Points of interest per region:** 1 roost, 1 Warden, 3–5 islands, 0–1 oasis; a caravan camp per 3 regions; the
  Maker's Box in 1 of 4 regions; the pyramid in the gate region only.
- **Variety:** biome by seed: dunes (default), salt flat (flat, mirror skim, few rocks), mesa maze (bands alternate
  in corridors), island sea (8+ islands, little ground). Wind strength 1–3 sets how far stones roll; sand drifts
  rose → gold → white with distance from the pyramid.
- **Wind cycle:** every ~3 min the wind turns 90°: crests shift a tile, loose stones roll, slatebirds change roosts.
- **Rare:** a fallen island that landed upright with its garden alive (heart piece); a slatebird nest with an egg; a
  Warden with its seal unbroken (carries a key); the maker's star landing (once per realm).

## Folk

- **The Quiet**: wanderer, never speaks, points. `(SHE HOLDS UP A STONE: AN ARROW, EAST)`
- **Tender**: gardener machine, literal-minded. `WATER. WATER. YOU ARE NOT A FLOWER.`
- **Caravan cook**: has never chewed. `REAL FRUIT? IS THAT SAFE TO BITE?`
- **Dune surveyor**: redraws the map every wind. `MY MAP WAS RIGHT. THEN IT BLEW AWAY.`
- **Roost kid**: knows the stone birds by name. `THE BIRDS ARE STONE. DON'T TELL THEM.`
- **Salt hermit**: lives with his reflection. `MY REFLECTION GOT THE BETTER TAN.`
- **Lost tourist from town**: far from phareim.no. `IS THIS STILL THE WEBSITE? NO SIGNAL.`

## Foes

- Reused: **blob** (shrinks in sun, swells at night), **dasher** (skims crests), **drone** (fires while its
  Warden is up).
- **Burrower** (new): swims under sand and surfaces where the hero stood one second ago; cannot cross hardpan or rock.
- **Warden** (new): wakes within 4 tiles of quartz or a beam, walks straight, fires along its facing, turns only on
  a hit; a blow to its back topples it, and a toppled Warden weighs 3 for good.
- **Kite** (new): a cloth-and-bone flier that only moves downwind; when the wind turns it drifts helpless for 2 s.
- **Boss FALCON**: a stone bird the size of an island, proud, slightly deaf, sure it is the sun's best friend. Its
  weight sinks whatever island it perches on; tip it off by loading the chained partner, or raise its perch into the
  low sun's beam to blind it, then strike the quartz in its chest. At band 3 it takes off and dives along the wind.

## Mechanic hook

**Physical puzzles**: weight (island bands), beams (the low sun through quartz lenses), rolling stones (wind).

- **The Scales:** two chained islands, the chest on the far one at band 5, the near one at band 3. Load the near one
  with rocks and a toppled Warden until the far one sits level with a mesa, then unload in an order that does not
  strand you. Variants by how many stones the region gives.
- **First Light:** three quartz lenses on three islands, each turnable in 45° steps; route the region's fixed sun
  onto a sleeping Warden so it wakes and walks, in a straight line, into the gap it then fills as a bridge.
- **The wind turn:** at the turn a dune slope's stones roll at the hero; shelter under rib arches, or roll one onto
  a plate. (The maker leaves a note in the Box: `NEW FLOOR TODAY. MIND THE PAINT.`)

## Quest hooks

- **Seeds for the Tender:** three seeds from fallen-island craters; a heart piece, and you may pick its fruit.
- **Chewing lessons:** bring island fruit to the caravan cook; the camp learns to eat and opens a shop.
- **The rolling egg:** the roost kid's slatebird egg blew off its nest; follow it downwind before the next turn.
- **The survey:** stand on three rib arches within one wind; the region's map fills in for good.
- **The Maker's Box:** reach its top floor (different every visit); the star drops a lens that bends any beam.
- **Cross-realm, clean seed:** the Tender's last bed wants a seed that grows only in soil the Sporelight purified.
- **Cross-realm, slatebird post:** a satchel bird flies to the roost of the realm you last left; the surveyor's
  blown-away map pages landed in other realms.

## Art needs

- Ground: rose sand, crest sand, hardpan, salt skim with reflection, violet cliff faces; pressure plate in sand.
- Island underside (rock, dangling roots, quartz glow) at three sizes; chain and pulley; root tree.
- Hum-quartz (idle, beam-lit, dead), lens on a turntable, sunbeam (straight, bent, blocked); rib arches, rubble.
- Rolling stone (4-frame roll); slatebird (perched, flying, carrying), roost, egg.
- Tender (walk, water, angry); Warden (buried, waking, walking, firing, toppled); burrower wake and bite; kite.
- The Quiet (cloak, sign stones, pink lantern); caravan tents and pyramid gate; oasis palms and lamp.
- FALCON (perched, takeoff, dive, blinded, chest quartz exposed); the maker's star.
