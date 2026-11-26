# LUMENBY QUARRY

> **What was built differs (2026-11-26).** Dig & build was taken out of the game. Lumenby keeps the pit's benches
> as fixed terrain, and its realm system is relighting the hill sign: lumen tubes turned into place, one letter a
> puzzle (`docs/games/neon-shrine-sign.md`). The sketch below is the original design.

Every neon tube on the coast was once a pink vein in this hill. Lumenby was the quarry town that dug the
lumen out, blew it into glass and shipped it down the coast road; when the static came the shift whistle
stopped, the miners left, and the big hillside sign that spelled L U M E N B Y went dark one letter at a time.
Now the pit is full of rain and bats, and the union hall's blueprints are still pinned up. Find the tools,
dig the stone, rebuild the town lot by lot: each house brings a resident home and lights one letter.

## Inspiration

- **Dragon Quest Builders' blueprints and rooms** (walls + a light + the right furniture = a room): each
  empty lot has its old house chalked on the ground; fill it, hang a door and a lamp, and it counts.
- **SteamWorld Dig's town that grows as you sell ore**: the town's level is the count of lit letters; every
  letter adds a shop line, a resident and a new recipe, so digging always pays visibly in the hub.
- **Minecraft's first night** (darkness spawns foes, a torch makes a safe circle): at dusk hounds and gnawers
  climb out of the pit and will not stand in a lamp's pool. The first craft is a lamp; the first night teaches.
- **Terraria's NPC housing** (walls, a door, a light, a table and a chair or nobody moves in): the residents
  are fussy in the same small way, and say so in one line ("No lamp, no Gunn.").
- **Dig Dug's falling rocks** (clear the dirt under a rock and it drops): dig out the tile under a terrace
  boulder and it rolls one level down, crushing foes; it is also one way to daze the boss.
- **Real open-pit benches**: the pit is stepped terraces joined by haul ramps; the heights are the benches.
- **Spelunky's 4×4 room grid**: the drifts (side tunnels into the bench walls) are small generated mines of
  16 rooms with a guaranteed path from the mouth to the face; off-path rooms may be sealed until you dig.

## Look & sound

- Palette: **rose** dust and topsoil, **violet** bench stone with **pink** lumen veins that glow at night,
  **cyan** rainwater in the pit, **gold** chrome ore and lamp light; rust-pines with violet needles on the rim.
- Ground mix: 45 % stone benches, 20 % topsoil, 15 % pit water, 10 % rust-pines, 10 % lots, rails, spoil.
  Features: rusted haul trucks, a gantry, the whistle tower, the sign (7 letters, grey violet / lit pink).
- Light: a low sun by day; at night only lamps, veins and lit letters (each pools pink on the slope below).
- Music: a slow work-song for synth and anvil clanks, the bassline gaining a voice per lit letter.
- `views: iso` (dig & build realms are iso-only: the heights are the game).

## Procedural recipe

- **Map**: 96×96 tiles, height levels 0–4 (0 = pit water / floor, 4 = the rim). Seed per world, fixed per save.
- **Heightmap**: base = 2-octave value noise (cell 24, then 8) mapped to 2–4 on the rim. Carve the pit as a
  quantised bowl: centre at a random point within 12 tiles of the map centre, radius 22–28; height =
  `clamp(floor(dist / bench), 0, 4)` with bench width 5 ± 1 (noise wobble ±1 tile), so 4 rings step down.
  Cut 3 haul ramps (2 tiles wide, 1 level per 3 tiles) from rim to floor at random angles ≥ 80° apart.
  Water fills every tile at height 0 inside the bowl; leave 3–5 islands of height 1 (radius 1–2).
- **Materials by height** (a tile's top block; stone below everything):
  - height 4–3 outside the pit: topsoil over stone; 1 in 9 is sand near water (dist ≤ 2).
  - bench faces (a tile whose neighbour is lower): stone; **lumen** veins as 3–7 tile random walks along
    faces at height ≤ 2 (target 14 veins, 6 % of face tiles); **chrome** in 2–4 tile clumps at height ≤ 1
    (target 8 clumps, 2 %).
  - islands and drift faces: **sunstone**, 0.3 % of stone, ≤ 4 per map, one guaranteed in the deepest drift.
  - rim woods: rust-pines on noise > 0.6 at height ≥ 3, 40–70 trees (timber; regrow in 2 days).
  - loose boulders: 10–14 on bench edges, each over a diggable tile.
- **Drifts** (the caves): 6–8 mouths cut into bench faces at heights 1–3, ≥ 14 tiles apart. Each leads to
  an interior map of a 4×4 grid of 12×10 rooms (Spelunky path walk: start in top row, step L/R/down, exit
  on bottom row at the "face" with a chest). Off-path rooms: 50 % sealed by stone (dig in), 20 % flooded.
  Drift interiors are not saved; they re-roll from `seed + drift + visits` each time you enter.
- **POIs per region** (split the map into rim N/E/S/W, benches and floor):
  - Town (fixed region, the flattest rim quadrant, height 3): 7 chalk lots in a horseshoe round a square,
    the union hall (intact, the workbench is here), the whistle tower, the sign on the slope above.
  - Each other rim quadrant: 1 ruin (shed, weigh-house or kiln) with a tool or recipe chest, 1–2 boulders.
  - Benches: 2–3 rusted haul trucks (sometimes a chest), 1 conveyor gantry; floor: the sunken pump house
    on the largest island (GROK), 1 heart piece.
- **Variation**: 3 weathers (dry, rain = more water at height 1 hollows, dust = shorter view), picked per
  visit. Rarity table for drift chests: bits 60 %, lumen ×5 20 %, chrome ×3 12 %, heart piece / recipe 8 %.

## Folk

- **Gunn**, the last forewoman, gruff, counts everything in shifts. *"Seven lots. Seven letters. Dig."*
- **Neon Nils**, sign-bender, blows glass at the kiln, speaks in fonts. *"That's a lovely serif of a rock."*
- **Pip**, kid with a metal detector, beeps at chests. *"BEEP. Under the truck. BEEP."*
- **The Choir**, three old miners who sing once their hall has a roof. *"We only sing indoors, love."*
- **Vend-O**, a vending robot by the weigh-house, sells by the kilo. *"Lumen accepted. Feelings not."*
- **Mrs. Kvarts**, the architect's widow, keeps the blueprints, judges your corners. *"Square. Ish. Fine."*
- **Rocco**, a cat who sleeps on every finished roof and rates it. *"Mrrp." (four stars)*

## Foes

- **bat** in the drifts and over the pit at night; **hound** circles lamp pools at night, lunges at the
  dark side; **drone** (old survey drones) fires along bench lines by day; **blob** in pit-edge mud.
- **Gnawer** (new): a rust-beetle that eats one placed timber block per 4 s at night; stone stops it.
- **Ore mimic** (new): a lumen vein that sits still until struck, then hops at you; drops double lumen.
- **Boss: GROK**, a tunnel-boring machine with a face, in the flooded pump house. It rolls the arena
  ramming whatever is in its way. It cannot be hurt head-on; **build a stone wall** in its path and it rams
  it, dazed for 3 s with its vents open; or dig under a boulder on the arena's rim to drop it on GROK
  (dazes and deals 2). Phase 2 at half: it bores through walls of timber, so only stone stops it. 14 HP.

## Mechanic hook

The chalk lots. Each lot is a blueprint outline (6×5 to 8×6 tiles) with a list on Mrs. Kvarts's board:
a ring of the named blocks at height ≥ +1, one door, one lamp inside, sometimes one fixture (kiln,
bench, bed). Fill it and the house resolves: walls snap to the realm's art, the resident moves in, a
letter lights, and one service opens (shop, recipe, fast travel, heart piece). A bad build is never
rejected rudely; the resident just says what is missing.

## Quest hooks

- **The first night**: Gunn gives the shovel and asks for one lamp before dusk; the gate to the pit opens.
- **Whistle at six**: mend the whistle tower (chrome ×4, timber ×6); it ends one night a day early.
- **Pip's detector**: three buried chests on the benches, each under a boulder you must drop first.
- **The sign**: all seven letters lit, the sign blinks L-U-M-E-N-B-Y and opens the pump house to GROK.
- **Neon Nils's kiln**: sand + lumen = glass; he wants a glass window in his lot (a recipe unlocks).
- *Cross-realm*: the NEW LOOK stall in PHAREIM.NO wants pink glass; Nils's glass relights its dead sign.
- *Cross-realm*: the deepest drift breaks into the Underglow (`realm-underglow.md`), where Gunn's brother went.

## Art needs

- Iso block tiles at 2:1 for 7 materials (top, two faces, damage cracks ×3), plus ramps and stairs per material.
- Chalk outlines (ground decal), 7 resolved houses (rotoscoped from solids), the union hall, whistle tower.
- The hillside sign: 7 letters × lit/unlit, bloom mask; lumen vein glow mask for night.
- Props: haul truck, gantry, rust-pine (+ sapling, stump), boulder (+ roll), lamp post, kiln.
- Foes: gnawer, ore mimic (still/hop), GROK (roll, ram, dazed with vents, phase 2 drill); folk ×7, a cat.
- Effects: dig dust per material, block pop-in, item fly to hotbar, water fill when a tile floods.
