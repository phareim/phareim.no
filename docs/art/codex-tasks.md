# Art tasks for Codex — the frontier

Picked up with Codex (`image_gen`) on the Mac, the way parts 19–23 were made
(`docs/games/neon-shrine.md` → the folk, the hero, the bosses, the things; the
pipelines are in `tmp/iso-figures-20/tools/`, `tmp/iso-figures-21/tools/`,
`tmp/iso-figures-23/` on the Mac). One task = one sheet or a small set of sheets.
Tick the box and add the commit hash when a task ships; replace the task's text
with what was learned instead of appending.

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

- [ ] **S1 · Tools as items (P1).** Pickaxe, shovel, axe, hammer (and the chrome pick):
  HUD icons (16×16 classic, the item box in `hud16.ts`) and a held-up frame each for the
  item get. The dig & build system (`docs/worlds/dig-notes.md`) uses them.
- [ ] **S2 · Building blocks (P1).** Iso block faces for dirt, sand, stone, timber,
  lumen (glowing cyan ore), chrome, sunstone; a ramp and stairs in stone and timber; a
  plank bridge piece; a placed lamp; a door. One sheet, drawn as `THING_ART` cubes on the
  2:1 diamond, top + two faces, so heights stack cleanly.
- [ ] **S3 · Battle marks (P2).** The battle ring's four petals (STRIKE, SKILL, DUO, STEP)
  as 12×12 icons, the five status marks (dazed, fogged, static, quick/slow, lifted) as
  7×7, and the target diamond. Tiny, readable on a phone (`docs/worlds/battle-notes.md`).
- [ ] **S4 · The ferry (P2).** A small neon ferry boat moored at the end of the town's
  pier and at the Landing's dock (a `THING_ART` landmark, two frames of bobbing).

## LUMENBY QUARRY (`lumenby`, dig & build, iso only)

- [ ] **Q1 · The hill sign (P1).** The giant L-U-M-E-N-B-Y letters on the hillside, each
  letter unlit and lit (14 frames: every letter in both states), so the town's rebuilding
  lights them one by one.
- [ ] **Q2 · Quarry things (P1).** Mine cart (empty / full of glowing ore), haul ramp
  piece, timber headframe, ore vein in rock (cyan lumen glow), crate of tubes.
- [ ] **Q3 · Folk (P2).** The quarry foreman, a tube-blower, the Lift Lady (sketch →
  Folk). Classic first.
- [ ] **Q4 · Foes (P2).** The timber beetle and the hopping ore vein (sketch → Foes).
- [ ] **Q5 · GROK (P3).** The tunnel-boring machine boss, rotoscoped as part 22: a 3D
  guide (Blender primitives), posed per frame, then drawn.

## THE UNDERGLOW (`underglow`)

- [ ] **U1 · Ledge set (P1).** Spiral ledge edge pieces with depth below, rope lift (cage,
  rope, top wheel), glowstick markers in the five rank colours.
- [ ] **U2 · Layer landmarks (P2).** Fossil arcade cabinet in rock, upside-down grove
  roots, glass-sea shards, a broadcast mast, the Sun Below's glow disc.
- [ ] **U3 · PHI (P3).** The golden spiral boss.

## SETER FELL (`seterfell`)

- [ ] **F1 · Seter farm (P1).** Turf-roofed log hut (2×2 tiles, door, chimney smoke 2
  frames), a byre, a stone fence run, a milk churn stand.
- [ ] **F2 · Sleeping trolls (P1).** Moss boulders with a face and a tiny tree on the back,
  asleep and waking (2 frames), 2×2 and 3×2.
- [ ] **F3 · Folk (P2).** Seter girl, the old herder, a huldra (tail hidden in the classic
  frames' back view), goats as wandering folk. Classic first.
- [ ] **F4 · MIXTRAL (P3).** Three troll heads sharing one gold eye.

## YULE FJORD (`yulefjord`)

- [ ] **Y1 · Fjord village (P1).** Red boathouse on stilts, snow-roofed cottage, a small
  stave church, a lighthouse with a turning beam (4 frames), a lantern post.
- [ ] **Y2 · Ice (P1).** Ice floe pieces, an ice block that reads as a mirror (for the
  beam puzzles), frozen water edge.
- [ ] **Y3 · Folk (P2).** Fisher, the lamp-sweeping old woman, a child with a sled. Classic first.
- [ ] **Y4 · Foes (P2).** Draug in half a boat (small), the nøkk in the water (eyes only,
  then risen). **ORCA** (P3) the boss.

## STILLSAND (`stillsand`, physical puzzles, iso only)

- [ ] **D1 · Floating islands (P1).** A violet stone island hovering over the sand (its
  shadow on the dunes), one tree, the gold quartz glowing in its roots; small/medium/
  large, and one sunk lower (the weight puzzles).
- [ ] **D2 · Garden machines (P2).** White garden robots tending flowers (folk), a quartz
  lens on a stand that turns (4 directions).
- [ ] **D3 · Stone bird (P2).** The silent rider's stone bird, perched and flying.
  **FALCON** (P3) the boss.

## SPORELIGHT (`sporelight`, field battles)

- [ ] **P1 · Giant mushrooms (P1).** Tree-sized glowing mushrooms in teal and violet
  (3 sizes), glow-moss tufts, a spore cloud puff (3 frames).
- [ ] **P2 · The bathhouse (P2).** The spirit bathhouse front (3×3 tiles, lanterns), a
  wooden bath tag item icon.
- [ ] **P3 · Grazer (P2).** The van-sized grazer, calm (cyan eyes) and angry (pink eyes),
  2 walk frames. **BLOOM** (P3) the forest god.

## FOGSTAGE (`fogstage`, field battles)

- [ ] **G1 · Stage country (P1).** Stage spotlight on a pole (lit), painted flat house
  (front only, a prop brace behind), sandbags and rope, a poster board (8 posters for the
  BARD quest: same board, 8 pictures).
- [ ] **G2 · The RAINCHECK (P2).** The theatre blimp moored at a hill: 4×2 tiles, a slow
  bob (2 frames), its gangway.
- [ ] **G3 · Folk (P2).** Wind-up puppet extras (key turning, 2 frames), the stage manager.
  **BARD** (P3) the prompter's box boss.

## RERUN ESTATES (`rerun`, field battles)

- [ ] **R1 · The cul-de-sac (P1).** Suburban house with garage (2 variants), mailbox,
  phone booth (glowing), station wagon, lawn flamingo, sprinkler (2 frames), lawnmower.
- [ ] **R2 · Three eras (P2).** The same house in 1958, 1986 and 2086 (three drawings of
  one footprint), for the era transform.
- [ ] **R3 · Foes (P2).** Mower, flamingo flock, biting mailbox. **COPILOT** (P3) the
  self-driving station wagon.
