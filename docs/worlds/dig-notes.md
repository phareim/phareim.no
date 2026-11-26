# Dig & build: design notes

> **Gone from the game (2026-11-26).** Dig & build played badly and was taken out; Lumenby keeps its heights as
> fixed terrain and relights its sign instead (`docs/games/neon-shrine-sign.md`). These notes stay as history.

The dig & build system for the realms (first home: `realm-lumenby.md`; a lean version in `realm-underglow.md`).
Not voxels: a tile grid where each tile has a **height 0–4** and a **top block** of one material. Digging lowers
a tile by one level and hands you its block; placing raises a tile by one level (or puts a fixture on it).
Iso view only. One dig is one beat: hit, crack, pop, the block flies to your pocket. Small doses, always.

## Rules of the ground

- Walk across equal heights; step **down** one or more levels freely (a hop, no damage up to 2, half a heart
  for 3+). Step **up** only by a ramp or stairs. So a ramp is a key, and digging a moat is a wall.
- Water sits at height 0. A tile dug to 0 next to water floods (a little splash; Dwarf Fortress's aquifer, polite).
- Placed blocks and dug holes are part of the map: foes path round them, the hook bites a placed post, bombs
  break any block back to its material (never lost).

## Tools (found, never bought; they are abilities, not slots)

| Tool | Where | Unlocks |
|---|---|---|
| Shovel | Gunn, the first night | dig dirt, sand, gravel; fill a hole with carried dirt; dig out under boulders |
| Axe | the north rim shed | fell rust-pines and root-wood (timber); clear wooden debris and old fences |
| Pickaxe | the weigh-house ruin (after the whistle) | stone, lumen, chrome, bone; open sealed drift rooms |
| Hammer | Mrs. Kvarts, after the first house | build fixtures (ramp, stairs, bridge, door, lamp); take placed blocks back whole |
| Chrome pick | Neon Nils (chrome ×6) | static crystal and sunstone (the deep layers) |

The tool is chosen by what you face: the dirt asks for the shovel, the tree for the axe. Without the right
tool a block just clinks and the hero shakes a hand ("Ow. Stone."). The world gates itself: ledges with
chests sit above a stone face, so the pickaxe opens them; the far bench needs a bridge, so the hammer does.

## Materials (stack 99 each; no weight, no durability)

| Material | Where | Builds |
|---|---|---|
| Dirt | topsoil, heights 3–4 | fill, dirt ramps, garden plots (a lot needs one) |
| Sand | by water (≤ 2 tiles) | glass at the kiln (with lumen); sandbags against floods |
| Stone | every bench face | walls, stairs, the only wall GROK and gnawers respect |
| Timber | rust-pines (regrow in 2 days), old props | planks, bridges, doors, scaffolds, the workbench |
| Lumen | pink veins at height ≤ 2 | lamps (lumen 1 + timber 1); glass tint; the sign's tubes |
| Chrome | gold clumps at height ≤ 1, drifts | hinges (doors), rails, lift parts, the chrome pick |
| Sunstone | 0.3 %, pit floor and deep drift faces | a beacon: a continue point and a warp to other beacons |

## What you can place

- **Block** (dirt, stone, timber, glass): raises the tile one level, up to 4. Glass blocks let lamp light through.
- **Ramp / stairs** (dirt or stone 2): joins two heights one apart; faces the way you stand.
- **Bridge** (timber 1 per tile): a plank span over water or a pit, up to 5 tiles, between equal heights;
  built from the hero's tile outward, one plank per press.
- **Lamp** (lumen + timber): light radius 3; no night foe spawns in or steps into its pool (hounds circle it).
- **Door** (timber 2 + chrome 1): opens for the hero and Luna, never for foes.
- **Workbench** (timber 4): crafting happens here (A at it); the union hall has the first.
- **Beacon** (sunstone 1): at most 1 per region; becomes the realm's continue point when lit.

## What building is for

1. **Reach**: ramps up to ledge chests, bridges to islands, scaffolds to the gantry. The map is built so most
   rewards sit one level up or one gap across.
2. **Safety**: lamps against the night (Minecraft's first night as a tutorial), stone walls against gnawers.
3. **Combat**: wall a narrow ramp so a sentry or GROK rams it; drop a boulder by digging under it (Dig Dug).
4. **Rebuild**: chalk lots (Dragon Quest Builders' blueprints, Terraria's housing rules) bring residents
   home; each house lights a letter, opens a service, and the town gets brighter.
5. **Shortcuts**: lifts in the Underglow (Spelunky's Tunnel Man) and bridges that stay built.

## Chrome (keep it tiny)

- **Hotbar of 4**, shown only in a dig realm, bottom right, beside the B item: slot 1 is always **DIG**
  (the hand: the contextual tool), slots 2–4 are the last three placeables chosen at the workbench.
- Material counts are not on screen: a pick-up shows a 1-second toast by the hero (`+1 STONE  23`), and the
  workbench shows the full pouch. The target tile wears a 1-px outline: **cyan** to dig, **pink** to place,
  **rose** when you cannot (wrong tool, no stock, too high).
- No crafting grid: the workbench is a short list of what you can make now, with greyed lines for the rest.

## Controls (keyboard and touch the same)

- Target = the tile in front of the hero (its height decides dig or place). On touch, a tap on a tile within
  2 tiles of the hero also targets it (and turns the hero to it).
- **B** with DIG selected: dig (soft 0.2 s, stone 0.5 s, ore 0.8 s). **Hold B** keeps digging forward, tile
  after tile, so a tunnel or trench is one hold (Dig Dug's flow). With a placeable selected, B places it.
- **Swipe the hotbar** (or Q/E, shoulder buttons) to change slot. **A** stays contextual (talk, open, lift).
- Before the shovel, nothing of this shows. Undo: the hammer takes any placed block back, whole.

## Save size

- Store edits per map as a sparse diff against the seed: one edit = tile index (14 bits) + height (3) +
  material (4) + fixture (4) + facing (2) in 4 bytes, packed and base64'd into the save.
- **Cap: 1,024 edits per surface map** (4 KB raw, about 5.5 KB in the save), **8 maps** with edits at most,
  so dig & build never adds more than 48 KB to a profile.
- Drift interiors and Underglow side chambers are **not** saved: they re-roll per visit, like LTTP rooms.
- Near the cap (900), wild digs far from any build heal back first (oldest first, out of view); placed blocks
  and lots never heal. At the cap the hammer says so in one line and offers take-backs.
- Trees regrow, boulders do not; dropped boulders are edits like any other.
