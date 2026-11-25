# Neon Shrine: the realm looks

A map's `look` (`MapDef.look`, `types.ts`) picks its painter's palette. Besides
`lab` (Project Horizon) and `wild` (the deep Wildwood) there are six realm
looks for the lands past the coast (`docs/worlds/`): `snow` (Yule Fjord),
`dune` (Stillsand), `spore` (Sporelight), `fog` (Fogstage), `quarry`
(Lumenby, the Underglow) and `suburb` (Rerun Estates). World data only names
the look; every colour is on the render side. A map without one of these is
drawn exactly as before.

## Where a look is

| File | What the look changes |
|---|---|
| `render/looks.ts` | The tables: `CLASSIC` (the classic palette over the coast's: ground, paths, sand, crowns, rock, water, bushes, tall grass), `GROUND` (which material slot each ground takes in the isometric view, and a cliff's top), `MOOD` (sky colours, water, haze, mist and ground fog, shafts and their colour, ambient and sun tints, shadow length and colour, particles, wind-blown leaves, the lamps' strength and colours, fireflies or wisps, the life in the air, the hero's own light) |
| `render/tiles.ts` | The classic painter swaps its palette (`setLook`) for both views' ground pictures and the land beyond the edge; street lamps take the look's two colours (`MOOD.lamp`), and in the spore look a cap here and there lights the moss under it |
| `render/iso/materials.ts` | `LOOK_SHEETS`: a look paints some of the 16 material slots again (snow drifts, dune sand, hardpan, glow moss, fog turf, ochre blocks, a striped lawn, snowy or slate roofs, red or pastel siding); `stepLookMaterials` builds that atlas a sheet at a time, the last three are kept |
| `render/iso/flora.ts` | `REALM_FLORA`: ramps per look, and two forms: `pine` (tiers; snow and quarry) and `cap` (a giant mushroom on a pale stalk, its rim lit from below; spore); `frost` lays snow on what faces up |
| `render/iso/backdrop.ts` | `REALM_SKY`: the land beyond in three depths of hills (snow-capped peaks, dunes and mesas, cap-crowned hills, hills in pink fog banks, terraced mesas, green hills), a near wood or bare land, the look's sun, the aurora (snow), lights among the caps (spore) |
| `render/iso/air.ts` | `realmAir`: snow falling, spores rising (every sixth lights the ground), dust and petals on the wind. `realmLife` (`MOOD.life`): paper lanterns rising off the water and lighting it (snow), quartz glinting on the sand (dune), butterflies (suburb), birds or gulls crossing high up, fish jumping in open water; frontier maps without a look get birds and fish |
| `render/iso/view.ts` | Threads it through: the ground slots, the atlas, the plants, the sky, `moodLook` over the hour's light |
| `render/iso/shaders.ts` | `uRefs` (how bright the look's classic ground paints a slot), `uWaterTint`, `uFog` (the ground fog parts round the hero), `uRaysColor` (the shafts' colour); where the mist is thick the lamps light it (a halo of their colour, laid on as a screen) |

## Light and life

The lands are darker than the town, so their light is turned up where the
town's would be lost. A realm's lamps shine `MOOD.lamps` times the coast's
(they never drop below 0.8 of full on a land's map, so a campfire reads at
dusk), more of their light hangs in the air (in the lands up to 1.6
times, by day and at dusk but not at night, when it would burn the snow out
to a floodlight; then `MOOD.glow`), and the hero carries more of a lantern in
the dark realms and, a little, everywhere in the lands at night
(`renderer.ts` `ambient`, both views). The windows burn a little brighter at
night, and in the suburb one in four is a television (`drawLiveTiles`'s
`night`, from `daylight.ts` `nightOf`). Under the spore wood a cap lights the
moss here and there at the wood's edge, where the pool can be seen (a score
at most in view).

In the isometric view landmarks carry lights (`IsoLandmark.lights`, set in
the lands' maps and `world/scenery.ts` by tone, never by hex): a
lantern, a lit window, a giant cap's glow, a lit letter's spill (only while
its flag holds), a red blink under the blimp. A `fire` flickers; one in the
`fire` tone (the seter hut's chimney) is a real fire and throws embers and
pale smoke, as campfires, bonfires and tiki torches do (`Light.fire`, never
a light's colour: a DJ booth's orange glow throws none). A `sweep` turns a
beam round (the lighthouse's, pointing where the lens frame drawn points
it) or swings it (a stage spotlight), with lights along it and a dithered
wedge in the air. A light in front of a building stands
just past its cover's south edge: inside, the classic house's mass hides it.
Prints glow in the spore moss and darken the snow; a closed chest and what
lies to be picked up glint (both views). The realm skies have shooting
stars, and the aurora breathes; under the aurora at night the snow takes its
green. Under reduced motion all of it holds still: no flicker, the beams at
one angle, no glints, birds, fish, prints or shooting stars.

## The rule that ties the two views

The isometric ground lays a material only where the classic picture has that
slot's own ground (`fits` in `GROUND_FS`): a lawn slot takes cool colours, a
path slot magenta, sand warm, water deep blue. So a look's classic colours
keep to the family of the slot `GROUND` puts them in (snow is pale blue in the
lawn slot; the dune's low ground and the fog's pink-grey lowland lie in the
path slot), while the slot's sheet can be any colour: the dune's path slot is
rose sand combed by the wind, and its cliff tops are the dunes' own sand.
`tests/zelda-looks.test.mjs` checks this, and that every look has a row in
every table.

## Pictures

`VIEW=iso node scripts/zelda-lab/shot.mjs <dir> look-snow,look-dune,…`:
scenes `look-<look>` and `look-<look>-2` draw a generated region in that look
whatever its realm (a copy of the region under the id `look-<look>:fr:x,y`).
