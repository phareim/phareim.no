# World lab: tools for drawing Neon Shrine's lands by hand

The lands around the coast are hand-made maps on one grid (`docs/worlds/atlas.md`, `themes/zelda/world/atlas.ts`).
These are the tools for laying one out and looking at it.

| File | What |
|---|---|
| `map-png.mjs` | A whole map as a flat-colour picture: tiles, people (pink), chests (gold), signs (white), ways in and out (cyan), foes (red), landmark footprints (yellow), area names. `node scripts/world-lab/map-png.mjs <out.png> <map> [px a tile]`; `atlas` instead of a map id draws every map of the grid in its place |
| `stamps.ts` | The tile patterns of the old generated frontier's places (a seter, the stilts, a cul-de-sac, a hill town …). The presets in `themes/zelda/world/scenery.ts` (`sceneryAt(realm, place, x, y)`) are drawn to fit them |
| `examples/seterfell-layout.py`, `examples/seterfell-map.py` | How Seter Fell was first laid out: a script of shapes (ridge, tarn, stream, the seter's ring, the humps, fields, roads) printed as rows, and a second script that places people, signs, chests, ways and landmarks and writes `world/seterfell.ts`. The map file is the truth from then on: edit it, not the scripts |

Looking at a land in the game: the lab's `life` scene puts the hero anywhere,
`heavy -x chrome -- env LIFE=<map>,<x>,<y> VIEW=iso TAG=<name> node scripts/zelda-lab/shot.mjs <dir> life`
(add `DAY=noon` or `DAY=night`; it writes a desktop and a phone picture). `tests/zelda-world.test.mjs` checks the grid,
the seams, the gates, reaching every map, the dialogue's font and box and chest ids; landmark art is
`tests/zelda-things.test.mjs`'s.
