## The pixel look: the games in Neon Shrine's paint (started 2026-09-24)

Petter liked how Neon Shrine (the portal's world) looks, and asked for the
other games to be redrawn in the same style, one at a time. The rules of
each game stay as they were; only the drawing changes.

**What the look is.** The world is drawn into a small logical-resolution
buffer (one logical pixel = one sprite pixel), scaled by a whole number to
the screen, so the pixels are chunky and crisp. The scene is multiplied by
a light map (a dusk ambient colour plus additive glow pools for lamps,
shots, eyes, windows), then gets a soft bloom of the same lights, faint
scanlines and a vignette. Sprites are string maps in Neon Shrine's palette
with a dark outline and two-tone shading; text is Neon Shrine's 5×7 font.
Palette: teal-indigo grass and canopies, rose paths, violet stone with neon
strips, magenta rim light; cyan for the player, pink for danger, gold for
treasure.

**Shared code** (`themes/base/pixel/`):

- `stage.ts` — `createPixelStage(canvas)`: `resize(cssW, cssH, dpr, minW,
  minH)` picks the largest whole scale that still shows `minW`×`minH`
  logical pixels; `begin()` → scene context `g`; `light()` / `emit()`;
  `present({ ambient, afterLight, flash, fade, shakeX, shakeY })` does the
  light map, scale, bloom, scanlines, vignette and the `hud` layer. `k` is
  CSS px per logical pixel and `px(v)` converts a CSS coordinate, so a game
  keeps its rules in CSS px.
- `sprites.ts` — `PAL` (Neon Shrine's palette), `sprite(rows, palOverride)`,
  `silhouette()`, `shade()` (outline + highlight/shadow for a one-colour
  'X' map), `pixelize()` / `relight()` (turn vector-painted art into
  palette-snapped, outlined, top-lit pixel sprites; Galaga uses them),
  `bayer()`, `mix()`, `drawBigText()`, and the 5×7 font
  (`drawText`, `textWidth`, re-exported from `themes/zelda/render/font.ts`).
- `scenery.ts` — side-view painters in the terrain palette: dithered dusk
  sky, stars, striped sun, ridges with a rim, tree lines, houses with lit
  windows, lamps, grass.
- `pixel.css` — `.px-title`, `.px-hud`, `.px-hint`, `.px-dim`, `.px-blink`
  for the HTML overlays, in `--font-pixel`.

**The pixel font for HTML.** `public/fonts/neon-pixel.woff` (3 KB) is the
canvas font as a TrueType/WOFF font, built by `node
scripts/make-pixel-font.mjs` (fontTools). One font pixel is an eighth of
the em, so it is crisp at font sizes that are multiples of 8 px. Lower case
maps to the capitals; Æ Ø Å (and æ ø å) have their own glyphs (Å's ring takes one
row above the cap height, the em's top pixel, so it reads at 16 px; `glyphAbove` in
`font.ts`, drawn by `drawText` and `drawBigText`), and É È Ä Ö Ü
draw as the canvas aliases them (E, E, Æ, Ø, U; 2026-09-26); it adds ▶ ◀ ▲ ▼ | [ ] @ ♪ ↻ ⌂ — … ❚ ◈ ■.

**Status** (2026-09-25): the whole site is on the pixel look — the eight games, the Hall of Fame and Hangar pages, the shell's chrome, the 404 and the icons. The old vector synthwave backdrop (`neonHorizon.js`, `mountainTerrain.js`) is gone.

| Game | Pixel look | Setting |
|---|---|---|
| Space Invaders | done | the formation comes down over the town at dusk; bunkers are shrine stone |
| Galaga | done | a dithered violet night with nebulae in the sector tints, a ringed planet, cratered rocks; the vector ships pixelized at run time; the intercom is Neon Shrine's dialog box |
| Breakout | done | a shrine chamber seen from above: stone and crystal bricks, braziers, a pit under the paddle |
| Tetris | done | a torchlit stone shaft in the shrine; carved bevelled blocks; the town at dusk behind the cabinet |
| R-Type | done | the shrine caves: rock walls with glowing crystals that light the walls, a warm far cave behind; turned a quarter on portrait phones (`resize(…, rotate)`) |
| Star Fox | done | the Super FX way: three.js at the stage's logical size, snapped to the palette with a Bayer dither in a shader; a biome per sector (sea, woods, ember, mirror lake, space), each with its own ground mode, sky and props (`docs/games/star-fox.md`, 2026-09-25) |
| OutRun | done | the coast road at dusk as a SNES-era sprite-scaler: Neon Shrine ground per biome, teal canopies, shrine-gate tunnels, pixelized cars |
| Another Shore | done | flat Another World polygons scanline-filled on the pixel grid, snapped to the palette; dithered sky and sea; glowing things lit through an emissive layer; the prologue flies over the pixel dusk |
| Hall of Fame | done | the shrine's hall of champions at night: arched windows on the dusk, banners, torches, trophies, a statue of the hero; the board is a `.px-box`, avatars shrunk to 12×12 pixels (`docs/games/hall-of-fame.md`) |
| Hangar | done | a shrine-stone launch bay open to the sea at dusk; the ship rendered the Star Fox way (low-res three.js, palette dither) on a pad with a neon ring (`docs/games/hangar.md`) |

**Outside the games** (2026-09-25), all in the pixel font and Neon Shrine's dialog box:

- `.px-text`, `.px-box`, `.px-btn` in `pixel.css`: the dialog box for HTML panels — a one-pixel edge with notched corners drawn by four offset shadows, `--px-u` CSS px per pixel, `--px-edge` for the colour; no border-radius, no soft glows.
- The radio (`components/RadioWidget.vue`) is a box in the theme's accent; on phones it shows ♪ instead of the station name. The home chip is a 9×8 pixel house. The Escape pills (`themes/base/EscHold.vue`) are boxes with a bar that fills in twelve cells; touch players see just PAUSED. The sound toggle is a `.px-btn` reading ♪ ON / ♪ OFF.
- The 404 (`error.vue` + `components/LostScene.vue`): the path out of town ends at a signpost reading 404, on the pixel stage; the parked themes keep their own 404 blocks.
- The portal's hint and ending panel, and Neon Shrine's touch pads, use the pixel font and hard edges.
- Favicon and app icons (`scripts/make-favicon.py`): the dusk on a 16/32/36-pixel grid, scaled up nearest-neighbour.

**Checking a look.** `node scripts/zelda-lab/games-shot.mjs <devUrl> <outDir>
[ids] [w] [h]` screenshots each game idle and after a moment of play;
`scripts/zelda-lab/over-shot.mjs` plays a moment and holds Escape into game
over. Both need the dev server (`npm run dev`).
