# Neon Shrine's ambient life

Small animated critters, plants and lights around the hero: fairies over the
flowers, owls in the crowns, wisps on the lake, a fairy ring, crabs combing the
sand. They only touch the picture. Each one is a pure function of the map, the
tile, a tile hash, the clock and the hero's distance, so the same place shows
the same life on every device and nothing is saved. They show in the classic
and isometric views, on every map they are gated to.

## How it works (`themes/zelda/render/life/`)

| File | What |
|---|---|
| `types.ts` | The contract: `Critter` (id, gate, palette, frames, `queue`) and `LifeCtx` (tiles, hash, clock, sun, realm, hero, `add` / `draw` / `glow`) |
| `index.ts` | `CRITTERS` (the registry), `lifeShows` (the gate), `queueLife`, called from `queue()` in `render/renderer.ts` beside the older `render/wildlife.ts` |
| `<id>.ts` | One critter: its own palette and frames (Codex-drawn letter rows, at most 16×16) and its placement |
| `held/` | Drawn and wired but not shipped: the critic held them back (see below). Not in the registry |
| `glimmerfae.ts` | The reference critter: placement over tiles, frame from the clock, a reaction from the hero's distance, a glow and a glitter trail |

**The gate.** `maps` (hand-made map ids) or `realms` (frontier realm ids),
`kinds` (default overworld; the Underglow's layers are dungeons) and `when`:
`dark` (sun ≤ 0.12), `day`, `dusk-dawn` (−0.3 < sun ≤ 0.35) or `always`. Without
the prism the game sits at the stuck dusk (sun ≈ 0.1) for good, so `dark` and
`dusk-dawn` critters are what most players see.

**Light.** `ctx.glow` adds to the light map (blooms in both views); `ctx.draw`
draws freehand pixels (trails, sparkles, ripples). With reduced motion the clock
is 0: every critter holds a still pose.

## The critters

The designs are in `docs/art/life-catalog.json` (18 by Codex, 6 fairy and light ideas added).

| Id | Where | When | What |
|---|---|---|---|
| `glimmerfae` | Neon Coast, glowing flowers | dark | Fairies in pink, cyan and gold dance figure-eights with glitter trails and scatter from the hero |
| `bellbloom` | Neon Coast flower beds | dusk-dawn | Three bellflowers sing a round, the smallest always early |
| `awningslug` | Neon Coast, along building fronts | dark | Slugs string a pink light garland that goes out behind them |
| `lacecrab` | Neon Coast shore sand | always | Crabs comb a scalloped lace into the wet sand and stamp a shell into it |
| `inkwisp` | Neon Coast beach | always | An ink drop climbs out of its bottle and scrawls a neon star |
| `owlwatch` | Crowns on the coast and in the Wildwood | dark | Gold owl eyes that blink and follow the hero |
| `ribbonkit` | Grass on the coast and in the Wildwood | always | Fox kits chase their ribbon tails and sit up straight when the hero comes |
| `wisps` | Wildwood water | dark | A procession of will-o'-wisps with reflections, keeping ahead of the hero |
| `fairyring` | Wildwood ground by trees | dusk-dawn | A mushroom ring lights round and round; step in and it all lights and the fairy bows |
| `pitweaver` | Wildwood pits | dark | A spider stitches a glowing crescent over a pit |
| `moonbloom` | Neon Coast, the Green Miles | always (opens in the dark) | Pale flowers open as the night deepens and breathe out glowing pollen |
| `birchghost` | Seter Fell, by the sleeping trolls | dusk-dawn | A birch spirit lifts a leaf lantern each time the troll breathes in |
| `fjordcrown` | Yule Fjord, by the ice | dark | Jellyfish press their crowns of light to the ice |
| `roottailor` | The Underglow | always | An upside-down imp darns a root with hot pink thread |
| `sporeparasol` | The Sporelight | always | Two mushroom folk share one umbrella |
| `paperunderstudy` | Fogstage, by the painted flats | always | A paper actor steps out of the scenery and bows in a spotlight ring |

**Held** (`held/`; each needs what the critic said before it moves up and into `CRITTERS`):
`wicktail` (the gecko's peek is too small, it stands beside the post in iso),
`dragonfly` (faint, over grass rather than water), `mossmask` (a boxy rim light),
`fenceparcel` (the squirrel is hidden in iso), `hayteacup` (the mouse reads as a pig),
`quartzhare` (reads as a hedgehog), `orefiddler` (the quarry's grade swallows the beetle),
`pinkflock` (the chick lands away from its flamingo).

## Adding one

1. Add the design to `docs/art/life-catalog.json`.
2. `scripts/life-lab/draw.sh <id> ~/zshots/life/<id> "<notes>"`: Codex draws the
   frames as letter rows into `<id>.frames.json` (runs outside the repo).
   `node scripts/life-lab/sheet.mjs <frames.json|<id>.ts> <out.png>` paints them big.
   Codex draws the pixels; redraw with sharper notes rather than editing by hand.
3. Write `render/life/<id>.ts` after `glimmerfae.ts`, and add it to `CRITTERS`.
4. Look at it in place: `heavy -x chrome -- env LIFE_FILE=themes/zelda/render/life/<id>.ts
   LIFE=<map>,<x>,<y> LIFE_T=<s> [DAY=noon|night] [VIEW=iso] node scripts/zelda-lab/shot.mjs <dir> life`
   (scene `life`: the hero at x, y with no foes; `LIFE_T` moves the clock; map ids
   like `fr:0,5` may hold commas). It must be findable without being told where,
   and read as what it is at 1280 and 390 px, in both views.
5. `tests/zelda-life.test.mjs` (in `test:zelda`) checks every file in the folder is
   registered once and its frames are rectangular, ≤ 16×16 and in its palette.
