# The frontier — Neon Shrine's generated world

Across the bay from the town lies the **frontier**: a world made from a seed
instead of drawn by hand, many times the size of the hand-made maps. The town,
the coast, the Shrine and the Wildwood stay as they are.

**Getting there.** The ferry at the end of the town's pier (overworld 20,38)
goes to THE LANDING (`fr:4,6`); the dock there brings you back (entry
`ferry`). The ferryman stands on the pier until the hero has a blade.

## How it is made (`themes/zelda/world/gen/`)

| File | What |
|---|---|
| `frontier.ts` | `FRONTIER`: seed, region size (64×44), the macro map (one char per region → a realm), the Landing, hand-written `sites`. `frontierMap(id)` makes a map on first ask and keeps it. Ids: `fr:<rx>,<ry>`, caves `fr:<rx>,<ry>:cave<n>` |
| `realms.ts` | The realms as data (`RealmSpec`, `types.ts`): terrain mix, foes by weight, density, places, folk and what they say, lore, loot, allowed views, `special` (dig / battle / puzzles) |
| `region.ts` | One region: noise in world coordinates → land; a rim with passes where a neighbour is (the pass offsets are a hash of the edge, so both sides cut the same gap); places (`stamps.ts`, sites); roads (cheapest paths joining passes and places); folk, chests, signs and foes on what the roads reach |
| `stamps.ts` | The places: camp, house, hamlet, shrine, relic (a realm's heart piece), graves, cave, pond, market, ruin, grove, stones, the Landing's dock |
| `cave.ts` | A cave: 2–3 × 2 rooms of 16×12 joined by a random spanning tree, the stairs up in the first, a chest in the furthest |
| `rng.ts` | Hashes, a seeded generator, value noise |

The engine sees ordinary `MapDef`s: `World.generate` (in `world/index.ts`) makes
any id `maps` does not have, and `mapDef(world, id)` (engine/map.ts) is the one
lookup. Three MapDef fields came with it: `edges` (walking off an edge where
there is open ground fades into the neighbour at the same place along the
edge), `realm`, and `views` (the shell turns to an allowed view while the hero
is there, the isometric one first, and back to the visitor's own after; V skips
the others). Saves just name the map (`fr:4,6`), so a save made out there loads
out there; death puts you at the region's camp.

Same seed, same world: everything is a pure function of the seed and the
region's place, on every device. Things saved against the world (chest flags
`chest:fr:<rx>,<ry>.c<n>`, a realm's first-visit flag `realm:<id>`, dig edits)
point into it — **changing the seed, the region size or a realm's recipe moves
everything already saved**. Add realms and regions at the macro map's edges
instead, or bump the frontier's seed only with a save migration.

Checks: `tests/zelda-frontier.test.mjs` (every region made and kept; both sides
of every edge open at the same tiles; the world checks pass with every region
and cave in; the ferry; walking off an edge). Pictures:
`VIEW=iso node scripts/zelda-lab/shot.mjs <dir> f-landing,f-meadow,f-quarry,f-cave`.

## The realms (designs in this directory)

| Realm | Sketch | Special |
|---|---|---|
| LUMENBY QUARRY | `realm-lumenby.md` | dig & build (iso only) |
| THE UNDERGLOW | `realm-underglow.md` | the descent under the quarry |
| SETER FELL | `realm-seterfell.md` | dig & build with folk manners |
| YULE FJORD | `realm-yulefjord.md` | physical puzzles (tide, ice, beam) |
| STILLSAND | `realm-stillsand.md` | physical puzzles (weights, light) |
| SPORELIGHT | `realm-sporelight.md` | field battles (calm, not kill) |
| FOGSTAGE | `realm-fogstage.md` | field battles |
| RERUN ESTATES | `realm-rerun.md` | field battles, one street in three eras |

`battle-notes.md` and `dig-notes.md` are the designs for the two new systems;
`SOURCES.md` lists the research. The realms in `realms.ts` today: the Landing,
the Green Miles (the plain between the realms), Lumenby; the others are being
encoded from their sketches.
