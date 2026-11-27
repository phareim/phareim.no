# The lands: Neon Shrine's world beyond the coast

Around the town, the coast and the Wildwood lie seven lands, each a map drawn by hand: Seter Fell, Yule Fjord, the
Sporelight, Stillsand, Rerun Estates, Lumenby Quarry and Fogstage, with the Underglow under Lumenby. Where they lie,
what is in them and which stories run through them: [`atlas.md`](atlas.md). This file is how they are built.

They replaced a generated frontier (89 regions made from a seed, 2026-11-25) that was reached both north of the
coast by gates and south across the bay by ferry, so no place had a where. The realm sketches (`realm-*.md`), the
concept pictures (`img/`) and the dig notes are still the design behind the lands (dig & build itself left
the game on 2026-11-26; the ideas parked since are in [`mechanic-ideas.md`](mechanic-ideas.md)).

## One grid

Every outdoor map has a place on one grid of tiles (`themes/zelda/world/atlas.ts`, `World.atlas`): x east, y south,
the overworld's top-left at (0, 0), the Wildwood at (−84, −12). A land's place is its top-left tile.

- **Seams.** Walking off a land's edge where the ground is open carries the hero into the map that holds the next
  tile of the grid, at the same place along the edge (`edgeOut` in `engine/game.ts`, `atlasAt`). Two lands share a
  pass of three tiles, open on both sides; elsewhere the rims are cliff, sea or wood. The validator checks the grid:
  no two maps overlap, and an open rim tile always meets open ground beyond it (`world/validate.ts`, `atlasProblems`).
- **Past the edge.** The isometric view, the classic painters and the shadows draw past an outdoor map's edge
  whatever map of the grid lies there (`render/beyond.ts`, `atlasBeyond`): from Seter Fell's rim the view looks
  down into Whisper Woods. Where no map lies, the old guess goes on (sea stays sea, rock stays rock, else woods).
- **Gates.** The six ways from the hand-made coast and Wildwood into the lands are warps, not seams
  (`world/gates.ts`): each is a short road between two lamp posts with a warden who stands aside only for the blade,
  and its two ends lie side by side on the grid. Both ends name the entry `gate-<id>`; ids never change.
- **The ferry.** The pier's warp sails to Yule Fjord's harbour (entry `ferry`) and back (overworld `ferry`).
- **Stairs** lead from Stillsand's gold pyramid to a system's teaching map, THE PUZZLE LAB (`world/demos.ts`).
- **The MAP page** draws the whole world's chart under or beside the map of where the hero is (`render/mapPage.ts`):
  every map of the grid where it lies, in fog until walked into (flag `seen:<id>`; the coast and the Wildwood are
  known from the start). A new land needs its short name in `WORLD_SHORT` (`render/worldMap.ts`).

## A land

A land is an ordinary `MapDef` in `themes/zelda/world/<land>.ts` that exports its maps (the land and its caves) as
`MAPS`; `world/lands.ts` gathers them. Seter Fell (`seterfell.ts`) is the worked example.

- `away: true`: a land past the coast. A reload of the tab out there continues there (the per-tab flag `zelda.out`,
  `awayMap`, `loadSpot`); arriving in an area with first-visit words opens them ("How the lands speak", below).
- `realm`: the land's identity: its art kit (`render/iso/frontierArt/`, an art pack fetched when the hero is there;
  docs/games/neon-shrine.md, "The art packs"), its light and air (`render/looks.ts`, `MOOD`), its people's and foes' looks, the critters that live
  there (`render/life/`). `kits` names more kits the map draws from (Seter Fell's hay and mill are the `meadow` kit's);
  the view merges them (`kitsFor`). Every piece in a kit is drawn by Codex over a guide built from solids
  (`scripts/zelda-lab/codex/README.md`; `kit-check.mjs` fails on a piece that is not); a new landmark gets its guide in
  the kit's source (`frontierArt/<kit>.ts`) and goes the same way before it is placed.
- `look` (one per map): snow, dune, spore, fog, quarry, suburb, wild. A climate is its own map.
- Areas: five to eight named ones, each with a continue point; one of them may carry an `intro` (first-visit words,
  shown once by its flag). `camp` is the land's heart: a save out there that lost its spot continues there.
- The realm's system lives in a place built for it: relighting the hill sign in Lumenby (its tubes, on ground with
  heights: `MapDef.terrain`), physical puzzles in Yule Fjord and Stillsand (puzzle tiles in the rows, chests that
  appear once a puzzle is solved).
- Fights are the real-time ones everywhere: foe marks in the rows, at most 24 a land and none near an entry, drawn in
  the realm's skins where it has them (`render/renderer.ts`, `FRONTIER_FOE_LOOKS`). Fogstage's ponds drown the foes
  knocked into them (`MapDef.physics`).
- Scenery: `world/scenery.ts` has the helpers (`prop`, `light`, `at`, `cycle`, `lantern`) and the presets the
  realms' places were drawn with (`sceneryAt(realm, place, x, y)`); the classic tiles under a building are an `H`
  block its landmark covers, a body on open ground gets a `solid` footprint and a classic stand-in
  (`render/standIns.ts`).
- The questlines' people keep their old ids (`q.…`, `l.…`), so their flags and saves still work; each story's first
  step stands on the hand-made coast or in the Wildwood (atlas.md, "The stories start in the old world").

## How the lands speak

- At most one intro per land, and only where the map confirms it: Yule Fjord's beam at THE LIGHTHOUSE (while the
  Gate stands open), Rerun's mailboxes on THE AVENUE, Fogstage's spotlight on THE TICKET HILL.
- A sign that names its place says something about it; none is only a heading for the banner. A person says one
  thing.
- Bearings live on junction signs.
- The story thread: one beat per land, a thing that is a little wrong while the sun is stuck, and it answers on
  `gateShut` or `item:prism`. Solveig, Yule Fjord's grandad and Gunn's lit sign say it once (`seterfell.sun`,
  `yulefjord.hiss`, `lumenby.sunset`); Ragna, Arne, the Night Watch, Gunn's own lines and Rerun's phone booth say
  the new line for as long as it holds. No land line names the King, the Prism or the Gate.
- A sign may carry a second text (`alt: { when, lines }`), read instead of `lines` while its condition holds.

## Old saves

Saves name a map and an entry. A save made in the generated frontier (`fr:<x>,<y>…`) continues in the land that took
its region's place, at the same gate when it was made at one, else at the land's `camp`; the Green Miles' at the
Crossroads, the Landing's at the pier, the Underglow's at Lumenby's deep drift; one made in THE OLD QUARRY (gone with
dig & build) at Lumenby's pit; one made in the glade under the Sporelight (`arena`) in the root hollow
(`rescueGone` in `world/atlas.ts`, called by `rescueSave` through `World.rescue`).
Items, hearts and flags are kept; explored tiles of maps that no longer exist are dropped, so they do not count
against the caps. A save made with dig & build's DIG or BUILD out comes back with nothing out; its materials and
edits are dropped, and so are tonics a save holds.

## Checks and tools

- `tests/zelda-world.test.mjs`: the real world's validator and every land on the grid; every seam walked both ways;
  every gate walked through and back, calm at both ends, locked the way it says and a save at it continuing there;
  nobody out there without a blade; every land and every map a land leads into reached from the start; foes kept off
  the ways in; chest ids the world's own; every line in the pixel font and three rows of the narrowest box, each
  speaker named first; the world's data small on `/`. Old frontier saves continuing in the right land:
  `tests/zelda-old-saves.test.mjs`. Every landmark's art in its map's kits: `tests/zelda-things.test.mjs`. Every
  chest, key, locked door and gate reachable in some order: `tests/zelda-reach.test.mjs`.
- `node scripts/world-lab/map-png.mjs <out.png> <map>|atlas`: a whole map, or the whole grid, as a picture
  (`scripts/world-lab/README.md`).
- `heavy -x chrome -- env LIFE=<map>,<x>,<y> VIEW=iso node scripts/zelda-lab/shot.mjs <dir> life`: the game's own
  picture of any spot, desktop and phone.
