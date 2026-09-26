# Lag Din Figur — design (2026-09-26)

Ulrikke's second game (she is seven). Theme id `figur`, cabinet eleven in
the portal's arcade. A figure maker: make one figure, see it drawn the way
Minecraft, Roblox, Toca Boca or Avatar World would draw it, dress it,
draw your own clothes, ask for help. Free, no ads, no bits. Norwegian
throughout (bokmål, short words, one idea per line, pictures before words,
big buttons).

Ulrikke's wishes, verbatim, and where each one lives:

| Wish | Where |
|---|---|
| Lage figur til hvilket som helst spill, helt gratis. | Everything is free; nothing costs bits. `STYLES` in `render/styles.ts` is a list, so a fifth game is one more renderer. |
| Ingen reklame. | None. No third-party requests at all. |
| Man kan også tegne hvordan det skal se ut, og man kan spørre om hjelp. | Tegn (the drawing board, `ui/DrawBoard.vue`) and Hjelp (the helper Pip, `core/helper.ts` + `ui/Helper.vue`). |
| Figurer for Minecraft, Roblox, Toca Boca og Avatar World. | One figure, four renderers (`render/minecraft.ts`, `roblox.ts`, `toca.ts`, `avatar.ts`). The switch is instant. Minecraft also downloads as a real 64×64 skin. |
| Man kan lage klær selv — og slette de hvis man ikke blir fornøyd. | Drawn clothes live in the save's `closet`; each has a trash can (with a JA/NEI question). |
| Litt forskjellige klær å velge mellom fra start av. | `catalog.ts`: tops, dresses, trousers, skirts, shoes, hats, glasses, capes and wings, every one recolourable. |
| (Petter) The figure made here is the hero in Neon Shrine. | `core/hero.ts` writes `figur.heroColors`; Neon Shrine reads it before Mini World's. |

## The one idea: every garment is a small pixel picture

A garment, built-in or drawn, is a **texture**: a small grid of colours
(`Texture` in `types.ts`) in a fixed **layout** per garment kind (below).
The catalog *generates* the built-in textures from a shape, colours and a
pattern; the drawing board *edits* a texture; the four renderers and the
Minecraft skin export only ever *sample* textures. So a drawn dress looks
right in every style, "Tegn på denne" starts the board from any built-in
piece, and a new style needs no new clothes code.

Colours inside a texture are `#rrggbb` strings or `null` (transparent: the
body or whatever is under it shows through).

### Layouts (front view, arms hanging down, pixel (0,0) top-left)

- **top** — `TOP_W × TOP_H` = 16 × 14. Columns 0–2 the figure's right arm
  (the viewer's left), 3–12 the torso, 13–15 the other arm. Row 0 is the
  shoulder line. A short sleeve paints the arm columns only down to row
  ~4; the rest of the arm is `null` and shows skin. Kinds: `tee`, `long`,
  `tank`, `hoodie`, `shirt` (the kind only picks the generator's mask and
  details; renderers treat all tops alike).
- **dress** — 16 × 24. Rows 0–13 exactly as `top`; rows 14–23 the skirt:
  paintable from columns 3–12 at row 14 widening one column each side
  every third row to 1–14 at the hem. A dress replaces both top and
  bottom. Renderers draw rows 14–23 as a skirt shape of their own
  (flared in Toca/Avatar World, straight over the legs in Minecraft and
  Roblox, as Minecraft skins do).
- **bottom** — 12 × 12. Columns 0–5 the viewer's left leg, 6–11 the
  right; row 0 the waistband. Kinds: `pants` (all rows), `shorts` (rows
  0–5), `skirt` (rows 0–7, and renderers flare it like a dress's skirt),
  `leggings` (all rows, tight).
- **shoes** — 6 × 4, one shoe seen from the front; renderers use it for
  both feet (mirrored for the other). Kinds: `sneaker`, `boot` (paints
  4 rows and renderers extend it up the shin), `flat`.
- **hat** — 16 × 10. The head's outline sits in the bottom four rows
  (the drawing board shows it as a guide); a crown is painted above it,
  cat ears poke up at the sides. Renderers stretch it over a hat box the
  width of their head plus a margin, its bottom four rows over the top
  of the head. Kinds: `hat`.
- **face** — 12 × 4, over the eye band (glasses). Built-in only.
- **back** — 20 × 18, drawn behind the body, centred on the torso (a cape
  hangs from the shoulders, wings spread past the arms). Built-in only.

`LAYOUTS` in `types.ts` holds the sizes; `core/textures.ts` holds the
masks (which pixels a kind may paint), the generators, and a guide for
the drawing board.

## The figure

`Figure` in `types.ts`: a name, a body (skin, hair style and colour, eyes
and eye colour, mouth, cheeks, freckles), and an outfit of slots
`top | bottom | shoes | hat | face | back`, each `null` or a `Worn`
(`{ id, color?, color2? }`, the catalog id or a drawn piece's id, with the
child's recolour). A dress sits in `top` and makes `bottom` ignored.
`style` is the style last looked at. Up to `MAX_FIGURES` figures; one is
**active**: the one on screen, the one Neon Shrine's hero wears.

Skins include three fantasy colours (blå, grønn, lilla). Hair styles:
`short, long, ponytail, pigtails, curly, bun, spiky, afro, none`. Eyes:
`round, happy, sparkle, sleepy, wink, star`. Mouths: `smile, grin, open,
tongue, small`. Every renderer draws every hair style, eye and mouth.

## The styles

`FigureStyle` in `types.ts`: an id, a Norwegian label, a stage backdrop,
and `draw(frame)`, which paints into a `PixelBuffer` of logical pixels.
The Stage component picks the largest whole-number scale that fits, so
each style has its own pixel size: Minecraft is chunky (its figure is the
skin's 16 × 32 front faces), the others are finer (about 48–64 px tall).
Each style is recognisable at a glance, drawn in our own art (no logos,
no copied assets):

- **Minecraft** — the skin's front faces, block-flat, a grass-and-dirt
  block floor and a blue sky with square clouds. Drawn *from* the same
  64 × 64 skin the download gives (`core/mcskin.ts`), so what you see is
  what you get in the game.
- **Roblox** — blocky but smooth-shaded: a wide rounded head, the classic
  yellow-ish default look only if the child picks that skin, boxy torso,
  arms and legs as blocks with a soft top light; a grey baseplate with
  studs and a light sky.
- **Toca Boca** — flat pastel, a big round head (about half the height),
  small body, dot eyes, rosy cheeks by default, thin limbs; a pastel room
  with a rug.
- **Avatar World** — chibi, a big head with big shiny eyes (lashes,
  highlights), soft outline, a sparkly lilac-to-pink background with
  hearts and stars.

Frames animate gently: a one-pixel idle bob, a blink every few seconds, a
little hop and sparkles when something changes (`pose.cheer`).

## Drawing clothes (Tegn)

Pick what to draw (T-skjorte, genser, kjole, bukse, shorts, skjørt, sko,
lue/hatt), or "Tegn på denne" from any piece. The board shows the
layout's grid, big cells, the mask (cells outside it are hatched and
cannot be painted), the guide (the body's outline in faint lines). Tools:
pencil, eraser, fill bucket, **speil** (mirror: paint both sides at once,
on by default), undo, clear. A palette of 24 colours. A live preview of
the figure wearing it in the current style. Save names it "Min kjole 2"
etc. (the child may rename). Drawn pieces sit in "Mine klær" at the front
of their slot's list, each with a trash can. Deleting a piece someone
wears takes it off them. At most `MAX_DRAWN` drawn pieces.

## Asking for help (Pip)

Pip is a small round helper bird in the corner. Tap: a speech box with
big buttons:

- **Lag en figur til meg!** — a whole random figure that goes together.
- **Gi meg en idé** — one of the themes (prinsesse, ninja, havfrue,
  astronaut, superhelt, pirat, fe, katt, robot, zombie, enhjørning, …)
  applied with a line about it.
- **Hvordan tegner jeg klær?** — three short lines.
- **Skriv hva du vil ha** — a text box: "blått hår og rosa kjole med
  stjerner" → `core/helper.ts` reads colours, pieces, hair, eyes and
  themes from Norwegian words and applies what it understood, then says
  what it did ("Nå har du blått hår og en rosa kjole!"), or what it did
  not understand. Nothing leaves the device.

## Saves

`FigurSave` in `types.ts`: figures, active id, drawn closet, `savedAt`.
localStorage `figur.save` at once, and the profile slot `figur`
(`SAVE_GAMES`, 32 KB) debounced, newest `savedAt` wins — the same pattern
as `composables/useMiniWorld.ts`. The Hangar shows N FIGURER · M KLÆR.

## Into Neon Shrine

`core/hero.ts` turns the active figure into Neon Shrine's `HeroColors`
(skin, hair, the hat's colour on the headband row, the top's most used
colour and its second as the stripe, the bottom or the dress's skirt,
the shoes) and writes localStorage `figur.heroColors`. Neon Shrine reads
`figur.heroColors` first and Mini World's `miniworld.heroColors` only
when there is no figure (Petter, 2026-09-26: the figure made here is the
hero).

## Code map

```
themes/figur/
  theme.css, Landing.vue      the page; Game.vue is its own async chunk
  types.ts                    every shared type and constant (the contract)
  catalog.ts                  palette, skins, hair colours, built-in garments, themes for Pip
  core/textures.ts            masks, guides, the built-in texture generators, sampling helpers
  core/figure.ts              new figure, random figure, dress/undress, validation
  core/save.ts                FigurSave: new, parse, actions (pure)
  core/helper.ts              Pip: Norwegian words → changes, and its lines
  core/hero.ts                Figure → HeroColors for Neon Shrine
  core/mcskin.ts              Figure → 64×64 Minecraft skin
  render/pixels.ts            PixelBuffer and drawing helpers (rect, ellipse, outline, texture mapping)
  render/minecraft.ts roblox.ts toca.ts avatar.ts   the four styles
  render/styles.ts            STYLES registry, drawFigure()
  ui/…                        Stage, tabs, pickers, DrawBoard, Helper, figure list
composables/useFigur.ts       reactive save, actions, persistence, hero colours
tests/figur-*.test.mjs        npm run test:figur
scripts/figur-lab/            screenshots of every style × sample figures
```
