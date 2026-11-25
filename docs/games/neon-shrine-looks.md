# Neon Shrine: the realm looks

A map's `look` (`MapDef.look`, `types.ts`) picks its painter's palette. Besides
`lab` (Project Horizon) and `wild` (the deep Wildwood) there are six realm
looks for the frontier (`docs/worlds/`): `snow` (Seter Fell, Yule Fjord),
`dune` (Stillsand), `spore` (Sporelight), `fog` (Fogstage), `quarry`
(Lumenby, the Underglow) and `suburb` (Rerun Estates). World data only names
the look; every colour is on the render side. A map without one of these is
drawn exactly as before.

## Where a look is

| File | What the look changes |
|---|---|
| `render/looks.ts` | The tables: `CLASSIC` (the classic palette over the coast's: ground, paths, sand, crowns, rock, water, bushes, tall grass), `GROUND` (which material slot each ground takes in the isometric view, and a cliff's top), `MOOD` (sky colours, water, haze, mist and ground fog, shafts, ambient and sun tints, shadow length and colour, particles, wind-blown leaves) |
| `render/tiles.ts` | The classic painter swaps its palette (`setLook`) for both views' ground pictures and the land beyond the edge |
| `render/iso/materials.ts` | `LOOK_SHEETS`: a look paints some of the 16 material slots again (snow drifts, dune sand, hardpan, glow moss, fog turf, ochre blocks, a striped lawn, snowy or slate roofs, red or pastel siding); `stepLookMaterials` builds that atlas a sheet at a time, the last three are kept |
| `render/iso/flora.ts` | `REALM_FLORA`: ramps per look, and two forms: `pine` (tiers; snow and quarry) and `cap` (a giant mushroom on a pale stalk, its rim lit from below; spore); `frost` lays snow on what faces up |
| `render/iso/backdrop.ts` | `REALM_SKY`: the land beyond in three depths of hills (snow-capped peaks, dunes and mesas, cap-crowned hills, hills in pink fog banks, terraced mesas, green hills), a near wood or bare land, the look's sun, the aurora (snow), lights among the caps (spore) |
| `render/iso/air.ts` | Snow falling, spores rising (every sixth lights the ground), dust and petals on the wind |
| `render/iso/view.ts` | Threads it through: the ground slots, the atlas, the plants, the sky, `moodLook` over the hour's light |
| `render/iso/shaders.ts` | Three uniforms: `uRefs` (how bright the look's classic ground paints a slot), `uWaterTint`, `uFog` (the ground fog parts round the hero) |

## The rule that ties the two views

The isometric ground lays a material only where the classic picture has that
slot's own ground (`fits` in `GROUND_FS`): a lawn slot takes cool colours, a
path slot magenta, sand warm, water deep blue. So a look's classic colours
keep to the family of the slot `GROUND` puts them in (snow is pale blue in the
lawn slot; the dune's rose hardpan and the fog's pink-grey lowland lie in the
path slot), while the slot's sheet can be any colour.
`tests/zelda-looks.test.mjs` checks this, and that every look has a row in
every table.

## Pictures

`VIEW=iso node scripts/zelda-lab/shot.mjs <dir> look-snow,look-dune,…`:
scenes `look-<look>` and `look-<look>-2` draw a generated region in that look
whatever its realm (a copy of the region under the id `look-<look>:fr:x,y`).
