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

## SPORELIGHT (`sporelight`)

- [x] **P1 · Giant mushrooms (P1, `62ad0c9`).**
  Tree-sized teal and violet mushrooms in three sizes each, glow-moss and three spore-puff
  frames.
- [x] **P2 · The bathhouse (P2, `62ad0c9`).**
  Lantern-lit three-tile bathhouse frontage and a classic wooden bath-tag icon.
- [x] **P3 · Grazer (P2, `62ad0c9`).**
  Two grazer steps each with calm cyan and angry pink eyes. BLOOM has standing, kneeling,
  ring and calm boss art.

## FOGSTAGE (`fogstage`)

- [x] **G1 · Stage country (P1, `62ad0c9`).**
  Lit stage spotlight, painted house front with braces, sandbags and rope, and eight
  different pictures on the same poster board.
- [x] **G2 · The RAINCHECK (P2, `62ad0c9`).**
  The RAINCHECK bobs at its mooring over the gangway.
- [x] **G3 · Folk (P2, `62ad0c9`).**
  Wind-up extra with two key poses, a stage manager, and BARD’s prompter box with singing
  and dazed curtain poses.

## RERUN ESTATES (`rerun`)

- [x] **R1 · The cul-de-sac (P1, `62ad0c9`).**
  Two garage houses, mailbox, glowing booth, station wagon, lawn flamingo, two sprinkler
  frames and lawnmower.
- [x] **R2 · Three eras (P2, `62ad0c9`).**
  The same house footprint in 1958, 1986 and 2086, with distinct material and roof
  treatments.
- [x] **R3 · Foes (P2, `62ad0c9`).**
  Mower, flamingo flock and biting mailbox use existing field behaviours. COPILOT has honk,
  neon and rust boss poses.

## THE HERO IN A FIGHT (iso and classic, every realm)

The real-time fight is being reworked to feel quicker and lighter on its feet:
three swings in a chain (forehand, backhand, a lunging finisher), a dodge roll,
foes that reel when hit. The engine side lives on branch
`claude/trusting-gauss-rmqin0` until it is merged. Until then, add the frames
as art only: the game keeps drawing today's `atk`.

**Where it lands.** The iso hero is built from parts in `render/iso/heroArt.ts`:
- bodies `HERO_BODIES['<pose>/<front|back>/<trousers|shorts|skirt>']`, with the foot
  point at the art's origin and the neck point at `nx, ny`; the dress is the skirt
  in the shirt's colours;
- arms over the head `HERO_ARMS['<pose>/<facing>']`;
- heads `HERO_HEADS` (reused) and role letters `HERO_LETTERS` (no new colours).

**Classic first.** Each pose needs its classic frames first:
`hero_<down|up|side>_<pose>` (16×16) in `render/heroFrames.ts`.
`tests/zelda-hero-art.test.mjs` keeps `HERO_ART_NAMES` equal to the classic frame
names. `heroArtCovers` turns the whole hero classic if a pose in `ART_POSES`
(`render/iso/hero.ts:30`) lacks a body. So new poses go in a separate list
(`ART_EXTRA_POSES`), and a missing body falls back
to `atk` or `0`.

**Size.** Frames 16–44 px wide and 26–46 high (the test's bounds), about twice
the classic sprite. Every pose in all three bottoms, front and back.

**Check.** Scenes `swing`, `swing2`, `swing3`, `roll` in `scripts/zelda-lab/shot.mjs`
(the last three come with the rework). They step 0.1, 0.25 and 0.4 s into a
chain with a blob in front.

- [x] **H1 · Combo swing bodies (P1, `e9196a5`).**
  `atk_wind` (blade arm drawn back across the body, weight on the back foot) and
  `atk_back` (the backhand: arm across the chest the other way, shoulders turned).
  Front/back × 3 bottoms = 12 bodies, plus `HERO_ARMS` where the arm rises over the head.
  Classic `hero_*_atk_wind`, `hero_*_atk_back`. Today's `atk` stays the forehand.
- [x] **H2 · Finisher (P1, `e9196a5`).**
  `atk_lunge` (deep forward step, body low, blade arm fully out) and `atk_land`
  (recovery, front knee bent), 12 bodies. Classic `hero_*_atk_lunge`, `hero_*_atk_land`.
  It must read as a different, heavier move than the forehand, even at 390 px wide.
- [x] **H3 · Roll (P1, `e9196a5`).**
  - Poses: `roll_0` (tuck), `roll_1` and `roll_2` (a ball, a quarter turn apart),
    `roll_3` (uncurl to a crouch). Front/back × 3 bottoms = 24 bodies.
  - The head may be partly hidden: use the neck point, or bake the head into
    `roll_1/2` and leave `nx` unset.
  - Classic `hero_*_roll_0..3` replace the rotated stand-ins the rework ships with.
- [x] **H4 · Blade at 16 directions (P1, `ba5847a`).**
  - Iso: `sword_e1` (22.5° off horizontal) and `sword_e2` (67.5°), plus the Arc
    Blade's `sword2_e1`, `sword2_e2`, in `BLADE_ART`/`BLADE_PAL` (`heroArt.ts`).
    About 26×20 px, same grip and guard as today.
  - Classic: 13×10 equivalents in `render/sprites.ts`, beside `sword_v/_h/_d`.
    Then `bladeSprite1` (`render/renderer.ts`) moves from 8 to 16 steps, so a sweep
    shows twice as many blade positions.
- [x] **H5 · Run cycle (P2, `e9196a5`).**
  - Poses: `run_0..run_5`, six frames, arms pumping, one frame with both feet off
    the ground. Front/back × 3 bottoms = 36 bodies.
  - Classic `hero_*_run_0..5`. The walk's `1`/`2` stay for slow walking and carrying.
  - Played at 12 fps from 4.5 tiles/s. Today's three-pose walk reads as skating.
- [x] **H6 · Idle breath and the held charge (P2, `e9196a5`).**
  `idle_1` (chest and shoulders up 1 px; `0` is the other half of the breath) and
  `charge` (crouched, blade low behind, back foot braced), 12 bodies.
  Classic `hero_*_idle_1`, `hero_*_charge`.
- [x] **H7 · Hurt from every side (P3, `e9196a5`).**
  `hurt/back/*` (3 bodies; hurt is front only today), and a `stagger` pose (knees
  buckled, front/back) for the shield bounce and the hard knock.
- [x] **H8 · Foes reeling (P2, `ba5847a`).**
  - A `front_hurt` frame (squashed, eyes shut or X'd, recoiling) for each small foe
    family in `FOLK_ART` (`render/iso/folkArt.ts`): `blob`, `spitter`, `hound`,
    `drone`, `sentry`, `bat`, `dasher`, `zapper` and `skull`; `knight` front and back.
  - Draw the classic `<kind>_hurt` sprite each is drawn over first (`render/sprites*.ts`).
    `facingOf` maps `<family>_hurt` to `front_hurt`, as `king_hurt` already does.
    Add the `src` hash with the classic rows so `familyFresh` holds.
  - The rework shows it while a foe is staggered.
- [x] **H9 · Impact and slash marks (P2, `ba5847a`).**
  - `hitfx_0..3`: a 4-ray impact star, white core, cyan rim; 16×16 classic, a 4-frame fx.
  - `slash_0..2`: a straight slash line across a foe, 24×8, fading.
  - `hitfx_gold_0..3`: for the Arc Blade and crits.
  - In `render/sprites.ts` next to `poof_*`. The fx layer draws them at classic px in
    both views; until then the rework draws its sparks procedurally.
- [x] **H10 · Modelled hero (P3, `e9196a5`).**
  `render/iso/figure.ts` acts `roll`, `lunge` and the backhand (`FigureAct`) for the
  `figure: 'modelled'` option, so it is not left behind.

## THE WAYS IN (gates from the coast and the Wildwood)

The realms get walking roads from the hand-made world, in addition to the ferry:
- north out of Whisper Woods to SETER FELL;
- the Night Market's north wall to the SPORELIGHT;
- east past the Hollow Graves to STILLSAND;
- Mirror Lake's east shore to RERUN ESTATES;
- the Wildwood's Riddle Grove north to LUMENBY;
- the Deep Woods west to FOGSTAGE.

Each realm's side of a road has a gate notch in the region's rim. This work
also lives on branch `claude/trusting-gauss-rmqin0` until merged. The gate
data is in `world/gen/gates.ts`.

- [x] **W1 · Gate arches, one per realm (P1, `47816b2`).**
  - Size: a three-tile-wide arch the road runs under, about 2.5 tiles tall.
  - Each in the realm's own material:
    - LUMENBY: timber headframe with a cyan lumen lamp.
    - SETER FELL: two turf-roofed gateposts with a pole across, birch bark.
    - SPORELIGHT: two mushroom stems bending into one cap.
    - STILLSAND: two quartz pillars with a sun disc.
    - FOGSTAGE: a proscenium of painted flats with a lit marquee.
    - RERUN ESTATES: a suburban welcome sign on two brick posts, with a neon "WELCOME".
  - Where it lands: `THING_ART` (`render/iso/thingArt.ts`) or the realm's kit in
    `render/iso/frontierArt/`, placed through `frontierScenery.ts`/`isoLandmarks`
    keyed `'gate'`. Give each arch a lit variant (neon on) and declare its glow pixels.
- [x] **W2 · The coast side of the gates (P2, `47816b2`).**
  - One shared waymark for the hand-made maps: a neon arrow post that names the realm
    in the pixel font's letters. Two frames, the arrow lit and dim, for a slow blink.
  - Plus a small "BORDER" barrier arm for the wardens' gates (blade-locked), up and down.

## LIGHT AND LIFE (every realm)

The light work in the same branch is procedural: lamps lighting the mist, lights
on the landmarks, embers, fireflies, lanterns over the fjord, sweeping beams.
These are the pieces it cannot draw by itself.

- [x] **L1 · Lit windows at night (P2, `47816b2`).**
  Night variants of `fjord_cottage`, `seter_hut`, the Rerun garage houses and the
  bathhouse: warm window panes with a 1-px glow rim, plus one "TV" pane in blue.
  Declare the glow pixels in `ThingArt.glow`, so the panes bloom in the iso view.
- [x] **L2 · Lighthouse lens and stage spotlight heads (P2, `47816b2`).**
  Brighter lens frames for `fjord_lighthouse` (four directions, the lit side white-gold)
  and a spotlight head for `fogstage_spotlight` in eight directions. The beam itself is
  procedural; it needs a source that points where it shines.
- [x] **L3 · Camp neon boards (P2, `ba5847a`).**
  - A small two-post board with neon letters, in four colourways (pink, cyan, gold,
    violet), and a blank board the game writes a short word on: `CAMP`, `OPEN`, `INN`.
  - It stands upright, because decals lie flat on the ground in the iso view.
  - Lands in `THING_ART`.
- [x] **L4 · Small life (P3, `ba5847a`).**
  - Classic-palette sprites, two to four frames each, at 5 sheet px to a scene px:
    - a fish jumping out of water and back (3 frames + splash);
    - a gull and a crow in flight (2 frames);
    - a moth for lamps (2 frames);
    - a butterfly (2 frames);
    - a frog on a lily pad (2 frames).
  - The procedural stand-ins are dots and flecks. These replace them where the
    camera is close.

## THE GREEN MILES AND THE LANDING (`meadow`, `landing`)

The plain between the realms has no scenery of its own, and the Landing is a
dock in a pool.

- [x] **M1 · Meadow landmarks (P1, `ba5847a`).**
  A windmill with turning sails (four frames), a waystone with a glowing rune, three
  haystack sizes, a rusted bus stop with a timetable board, and a hand cart. Anchored
  by `frontierScenery.ts` to the meadow's stamps (camp, hamlet, grove, stones).
- [x] **M2 · Road lanterns (P1, `ba5847a`).**
  - A lantern post for the frontier roads, in five tones (pink, cyan, violet, gold,
    rose), lit and unlit.
  - The game places them along roads by hash, so they must tile next to the road's
    stones without covering them.
- [x] **M3 · Coast set for the Landing (P2, `ba5847a`).**
  - Pieces:
    - a breakwater (straight and end pieces);
    - a pier that runs out into deep water;
    - mooring bollards, a stack of crates and a net rack;
    - a harbour light on a post.
  - The generator is to give the Landing a real shoreline; until then these sit on its
    sand.
- [x] **M4 · Campfire set (P2, `ba5847a`).**
  - Pieces: logs to sit on, a kettle on a tripod, a lean-to.
  - Fire frames to match the bonfire's, lit by the light work.
