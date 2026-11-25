# Art tasks for Codex — the frontier

The frontier art ships as native-grid sprites. The ferry was drawn from
an `image_gen` concept. The realm kits and actors are baked from posed
solids and classic pixel art at the isometric view’s own resolution.
The tools, atlas and screenshot scenes are documented in
[Frontier art](../worlds/README.md#frontier-art).

The boxes track artwork. The boss families and extra quest states are
available in the art registry for their planned encounters and mechanics.

**Every task, the same rules**

- **Style.** The isometric view's own pixel art: the townsfolk (`render/iso/folkArt.ts`),
  the hero (`heroArt.ts`), the things (`thingArt.ts`). Same density (10 sheet px to a
  scene px on a 1536-px sheet, or 5 where the figure is small enough to land on whole
  px), hard alpha, the neon palette (`render/tones.ts`: pink, cyan, violet, gold, rose)
  as accents on calmer ground colours. Cut at the grid it was drawn on; nothing resampled.
- **Target picture.** Each realm has a concept image made over a real iso screenshot
  (same camera and density): `docs/worlds/img/concept-<realm>.jpg` (prompts in
  `concept-prompts.json`). It is a mood target, not a sprite source.
- **Design.** The realm's sketch `docs/worlds/realm-<realm>.md` → "Art needs", "Folk",
  "Foes". Inspired by, never a copy of the works in its "Inspiration" section.
- **Where it lands.** Folk → a family in `FOLK_ART` (`folkArt.ts`), read by `folk.ts`
  (each family is drawn from a classic sprite: the classic one comes first, see "Classic
  first"). Bosses → `BOSS_ART` (`bossArt.ts`). Standing things, landmarks, furniture →
  `THING_ART` (`thingArt.ts`, packed by `things.ts`, placed by `LANDMARKS` or
  `furnitureAt`). Item icons → the HUD's sprites (`render/sprites.ts`, `hud16.ts`).
- **Classic first.** A new person or foe needs a classic sprite (rows in
  `render/sprites*.ts`, ≈16×16, the classic palette) before its iso family can be drawn
  over it, as every family so far. Where a task names a new look, draw both: the classic
  frames (front/back × 2 steps) and then the iso family over them.
- **Check.** `VIEW=iso CHROME_BIN=<chrome> node scripts/zelda-lab/shot.mjs <dir> f-<realm>`
  (scenes in `scripts/zelda-lab/shot.mjs`); look at 1280×800 and 390×844. A thing that
  reads as something else (the llama that became a dog) is held back, not shipped.
- **Names.** The ids below are proposals; check the code for the names the engine uses
  when you pick a task up (the realms' data: `themes/zelda/world/gen/realms.ts`).

Priority: **P1** makes a realm read as itself; **P2** gives it its people; **P3** polish.

## Shared (all realms)

- [x] **S1 · Tools as items (P1, `3e8ba94`).** The pickaxe, shovel, axe and hammer
  share their existing 16×16 art between the HUD and item get. The chrome-pick sprite
  joins them in `spritesDig.ts`, ready for the deep-quarry reward.
- [x] **S2 · Building blocks (P1, `d6cfe5d`).** Fourteen `THING_ART` sprites from
  `frontierArt/building.ts`, baked at 32 scene pixels per tile. Player-built stone
  and timber stack one cube per level, and the placed lamp uses the kit's cyan lantern.
  The sheet includes the other materials, two ramps, two stairs, a bridge and a door.
- [x] **S3 · Battle marks (P2, `3e8ba94`).** `battleMarks.ts` supplies the 12×12
  command icons, 7×7 status glyphs and target diamond. The current battle strip uses
  strike, skill, duo for combo techs, item and step for flee. Fog, quick and lifted
  have artwork ready for when those statuses arrive.
- [x] **S4 · The ferry (P2, `3e8ba94`).** A neon ferry at both piers via
  `THING_ART`. The in-game sprite was drawn on the renderer's grid from an
  `image_gen` concept, with per-pixel depth and normals. The boat bobs one pixel
  between two frames and stays still with reduced motion.

## LUMENBY QUARRY (`lumenby`, dig & build, iso only)

- [x] **Q1 · The hill sign (P1, `62ad0c9`).**
  Fourteen scaffolded LUMENBY letter sprites, with grey-violet and lit-pink states. The sign
  stands above the union hall. Its light states are keyed by lot, with a mixed-state view in
  the lab.
- [x] **Q2 · Quarry things (P1, `62ad0c9`).**
  Two mine-cart loads, north and west haul ramps, the timber headframe, a cyan lumen vein
  and a crate of glass tubes. Their anchors follow the quarry stamps.
- [x] **Q3 · Folk (P2, `62ad0c9`).**
  Foreman, tube-blower and Lift Lady have classic facings and separate isometric poses. Gunn
  and Nils use the new art.
- [x] **Q4 · Foes (P2, `62ad0c9`).**
  A timber beetle with a walking step and a cyan ore mimic with a hop, paired with existing
  quarry enemy behaviours.
- [x] **Q5 · GROK (P3, `62ad0c9`).**
  GROK has roll, ram, vented daze and drill poses, with a reproducible Blender guide and a
  registered boss sprite family.

## THE UNDERGLOW (`underglow`)

- [x] **U1 · Ledge set (P1, `62ad0c9`).**
  Three ledge faces, cage, repeating rope and four wheel frames. All five rank markers glow
  in their own colours.
- [x] **U2 · Layer landmarks (P2, `62ad0c9`).**
  Fossil cabinet, upside-down roots, two shard clusters, three mast states and the Sun Below
  disc. The descent places them by layer.
- [x] **U3 · PHI (P3, `62ad0c9`).**
  PHI has a segmented golden coil, a lit segment and a floor-eating pose in the boss atlas.

## SETER FELL (`seterfell`)

- [x] **F1 · Seter farm (P1, `62ad0c9`).**
  Smoking turf-roof hut, byre, tileable stone walls and the churn stand dress the seter
  stamps.
- [x] **F2 · Sleeping trolls (P1, `62ad0c9`).**
  Two sleeping troll sizes with birches on their backs. Both have a distinct waking frame.
- [x] **F3 · Folk (P2, `62ad0c9`).**
  Dairymaid, old herder, huldra and wandering goat have classic and isometric walking
  frames. The huldra’s classic back view keeps her tail hidden.
- [x] **F4 · MIXTRAL (P3, `62ad0c9`).**
  MIXTRAL has a shared gold eye that can appear in any of the three troll heads.

## YULE FJORD (`yulefjord`)

- [x] **Y1 · Fjord village (P1, `62ad0c9`).**
  Stilted red boathouse, snow-roofed cottage, stave church, lantern and a four-direction
  rotating lighthouse beam.
- [x] **Y2 · Ice (P1, `62ad0c9`).**
  Three floe sizes and four ice edges dress the fjord. The two ice-mirror sprites follow the
  beam-puzzle tile directions.
- [x] **Y3 · Folk (P2, `62ad0c9`).**
  Fisher, lamplighter and sled child use the new classic and isometric frames.
- [x] **Y4 · Foes (P2, `62ad0c9`).**
  The draug rows a half-boat, and the nøkk has submerged eyes and risen poses. ORCA has
  rowing and stranded boss art.

## STILLSAND (`stillsand`, physical puzzles, iso only)

- [x] **D1 · Floating islands (P1, `62ad0c9`).**
  Three sizes of hovering violet island and a lowered variant, with a quartz-bearing root
  tree and a shadow on the sand.
- [x] **D2 · Garden machines (P2, `62ad0c9`).**
  The white watering robot has classic and isometric steps. The quartz lens has four
  directions and turns at the seed bed.
- [x] **D3 · Stone bird (P2, `62ad0c9`).**
  Stone bird perched and flying, plus FALCON’s takeoff, dive, blinded and exposed-quartz
  boss poses.

## SPORELIGHT (`sporelight`, field battles)

- [x] **P1 · Giant mushrooms (P1, `62ad0c9`).**
  Tree-sized teal and violet mushrooms in three sizes each, glow-moss and three spore-puff
  frames.
- [x] **P2 · The bathhouse (P2, `62ad0c9`).**
  Lantern-lit three-tile bathhouse frontage and a classic wooden bath-tag icon.
- [x] **P3 · Grazer (P2, `62ad0c9`).**
  Two grazer steps each with calm cyan and angry pink eyes. BLOOM has standing, kneeling,
  ring and calm boss art.

## FOGSTAGE (`fogstage`, field battles)

- [x] **G1 · Stage country (P1, `62ad0c9`).**
  Lit stage spotlight, painted house front with braces, sandbags and rope, and eight
  different pictures on the same poster board.
- [x] **G2 · The RAINCHECK (P2, `62ad0c9`).**
  The RAINCHECK bobs at its mooring over the gangway.
- [x] **G3 · Folk (P2, `62ad0c9`).**
  Wind-up extra with two key poses, a stage manager, and BARD’s prompter box with singing
  and dazed curtain poses.

## RERUN ESTATES (`rerun`, field battles)

- [x] **R1 · The cul-de-sac (P1, `62ad0c9`).**
  Two garage houses, mailbox, glowing booth, station wagon, lawn flamingo, two sprinkler
  frames and lawnmower.
- [x] **R2 · Three eras (P2, `62ad0c9`).**
  The same house footprint in 1958, 1986 and 2086, with distinct material and roof
  treatments.
- [x] **R3 · Foes (P2, `62ad0c9`).**
  Mower, flamingo flock and biting mailbox use existing field behaviours. COPILOT has honk,
  neon and rust boss poses.
