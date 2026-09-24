## Mountain depth: the Neon Horizon backdrop (2026-09-07; users updated 2026-09-24)

`themes/base/neonHorizon.js` draws the old vector synthwave backdrop: sky,
stars, the striped sun, a mountain range and the perspective grid, with a
heartbeat. The mountains come from `themes/base/mountainTerrain.js`, a
deterministic XYZ heightfield projected into Canvas 2D, with irregular
pointed peaks, dark faces and violet triangle edges. Geometry and colours
are built once per instance; resize reprojects the same landscape.
`horizon.setView(x, y)` takes normalized coordinates (-1…1) and `update(dt)`
smooths the camera, so near terrain moves farther than distant ridges while
the sun stays fixed. The sun frames itself against the highest nearby
terrain tips (about a third of the disc above them); an explicit `sunY`
overrides that. Reduced motion stops the parallax.

**Who uses it** (verified 2026-09-24): only the Hall of Fame and Hangar
pages (`themes/leaderboard/Horizon.vue`, `themes/hangar/Horizon.vue`). Every
game moved to the pixel look on 2026-09-24 and paints its own scenery on
the pixel stage (`docs/games/pixel-look.md`). If those two pages move to the
pixel look too, both files can go.
