# Neon Shrine: dig & build

Minecraft-like digging and building in an action adventure, switched on per map by `MapDef.dig`; drawn for
the isometric view (heights). Design sketch for the realms: `docs/worlds/dig-notes.md`. Code:
`themes/zelda/engine/dig.ts` (tools, materials, edits, save), `engine/digGround.ts` (heights, pure),
`render/dig.ts` (tile painters, the outline, the B icon), `render/iso/dig.ts` (columns, ramps, lifting),
`render/spritesDig.ts` (tool and material pictures), `world/quarry.ts` (the demo), `tests/zelda-dig.test.mjs`.

## The ground

- `MapDef.dig = { heights?, ground?, build?, caches? }`. `heights` are rows like `rows`, a digit 0–4 per tile;
  any other char is `ground` (default 1). One below the ground is a hole; water lies at the ground.
- `MapState.dig = { h, g, z }`: every tile's height, the ground's level, the hero's standing level.
- A mover stands at the highest level its circle touches (`digLevel`). A tile higher than that blocks it
  (`circleBlocked` / `moveCircle` in `engine/map.ts`; foes too, from where they stand); a lower one it steps
  down onto, freely. Out of a hole (below the ground) it steps up one, onto the ground and no higher: a hole is
  no trap, for the hero or a foe. A ramp (`ж з и й`, rising north, south, east, west) counts one below its height until the
  mover's centre is past its middle on the way up, so it joins two levels one apart. No z in the simulation
  beyond that: projectiles fly as before, the hook still reels the hero up onto whatever it bites.
- What stands higher than the hero is out of A's reach (a chest on a ledge opens only from up there).
- Tiles (Cyrillic, all open in `TILE_INFO`; the heights do the blocking): `а` stone, `б` timber, `в` turf,
  `д` dug earth, `е` lumen ore, the four ramps, `к` hole. Built lamps are the existing `t`, planks `=`.

## Tools and verbs

Tools are items (`pickaxe`, `shovel`, `axe`, `hammer`; owned = the flag `item:<tool>`), found in chests. On a
dig map they add two B items to the cycle (`UseItem`):

- **DIG** uses the tool the tile in front asks for: shovel (earth, grass, sand, turf: one level down, for dirt;
  a hole or a tile below the hero: filled with dirt), pickaxe (stone and ore one level down, for stone or
  lumen; rocks, boulders, cracked walls gone), axe (trees, bushes, timber blocks, built planks, for wood).
  Reach: up to one above the hero's level. Without the tool: a clank, and the first time a line names it.
  Digging below the ground beside water floods the hole. A tile listed in `caches` turns up its item once.
- **BUILD** (the hammer): water in front gets a plank (wood 1); ground level with the hero and a step one up
  beyond it gets a ramp (stone 1); otherwise a block of the chosen kind (stone or wood; one up, at most 4) or a
  lamp (lumen 1 + wood 1). The cycle button with the hammer out steps through the kinds that can be built
  before it moves on (`Inventory.build`). The hammer takes back what was built (ramp, lamp, plank, a block
  standing above the hero), whole.
- Off a dig map DIG and BUILD leave the cycle; one that is out gives way, on entering, to another B item the
  hero has (or none), and a dig map entered with nothing out hands DIG back (`settleItem` in `engine/hero.ts`).
- Materials: `Inventory.mats` (dirt, stone, wood, lumen; up to 99 each). The HUD shows them in the counter
  row only while DIG or BUILD is out (the hammer's kind lit); the B box shows the tool for the tile in front.
- Lamps keep foes out of their light (2.6 tiles, `stepDig`).
- The ways in stay clear: on an entry's tile, and on the two rows of ground along an edge that leads on, nothing
  rises above the map's own ground and no lamp or water goes (a hole is fine: it is no trap). Nothing rises
  where someone stands. An arrival that still finds its spot built over or flooded (an older save) steps to the
  nearest clear ground (`enterMap`).
- The outline on the target tile: cyan to dig or take back, pink to build, rose when it cannot. The classic
  view draws it on the tile; the isometric view at the tile's height, over the lit scene.

The 16×16 tool sprites also serve as held-up item art. `item_chromePick` is ready in the sprite registry
for the planned deep-quarry reward.

## Edits and the save

- Every change is an edit against the map as authored: `GameState.digEdits[mapId][tileIndex] = tile + height`.
  An edit back to the authored tile and height is dropped. `loadMap` lays them over the tiles, so they survive
  leaving and coming back; a generated map (same seed, same tiles) takes them the same way.
- Caps: `DIG_CAP` 400 edits a map, `DIG_TOTAL` 800 in all, on up to `DIG_MAPS` 24 maps (room for every dig map
  of the world: the quarry and the 18 generated dig regions now; a test counts them). At a cap a change of a new
  tile is refused with a line that says which (this map's, or the land's: fill a hole or take something back,
  here or elsewhere); an edited tile can still change. A save keeps at most about 5 KB of edits (16 KB in all).
- `SaveData.dig`: per map, `<index base 36><tile><height>` joined by commas (about 5 KB at most). Older saves past the total are cut at it. `parseSave`
  cleans it and the materials; saves without them load as before. A `dig` event saves at once.

## Drawing

- Isometric (`render/iso/dig.ts`, hooks in `iso/view.ts`): a tile above the ground is a column of that many
  levels with its picture on top (turf in the grass material, sides in rockface, timber in boards); a ramp is
  a stepped slope with its sides; a chest or lamp on raised ground stands on a column capped like its
  neighbours; people, foes and props stand at their tile's height (the hero eases down off a ledge, sinks a
  little in a hole). Shadows of lifted things are not lifted.
- On dig maps, edited stone and timber columns stack the 32-pixel building kit's blocks, and player-built
  lamps use its cyan lantern. The kit also has the other materials, ramps, steps, bridge and door art.
  Run `node scripts/zelda-lab/frontier-art.mjs building <sheet.html>` to bake the sprites and view the sheet.
- Classic: the tiles' own pictures, with lit and dark edges where the height changes. Readable, but the heights
  are an isometric thing: once `MapDef.views` lands the quarry should say `views: ['iso']`.

## The demo: THE OLD QUARRY (`quarry`, down the stairs from Lumenby's pit, `world/demos.ts`)

Entry `start` at the south. The shovel by the road; the pickaxe inside a ring of turf (dig through); the axe
behind a stone wall with ore in it (pickaxe); the hammer in a grove (axe). With the hammer: a ramp up the
plateau to its chest (a lamp on it; a stone crag on top, one higher), planks to the island's chest, lamps
against the blobs and the hound. Three caches under rings of pink flowers. Lab scenes: `q-quarry`,
`q-ledge`, `q-hole` (`VIEW=iso node scripts/zelda-lab/shot.mjs <out> q-quarry`).
