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
maps to the capitals; it adds ▶ ◀ ▲ ▼ | [ ] @ ♪ ↻ ⌂.

**Status** (2026-09-24):

| Game | Pixel look | Setting |
|---|---|---|
| Space Invaders | done | the formation comes down over the town at dusk; bunkers are shrine stone |
| Galaga | done | a dithered violet night with nebulae in the sector tints, a ringed planet, cratered rocks; the vector ships pixelized at run time; the intercom is Neon Shrine's dialog box |
| Breakout | done | a shrine chamber seen from above: stone and crystal bricks, braziers, a pit under the paddle |
| Tetris, R-Type, OutRun, Star Fox, Another Shore | in progress | |

**Checking a look.** `node scripts/zelda-lab/games-shot.mjs <devUrl> <outDir>
[ids] [w] [h]` screenshots each game idle and after a moment of play;
`scripts/zelda-lab/over-shot.mjs` plays a moment and holds Escape into game
over. Both need the dev server (`npm run dev`).
