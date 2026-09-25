# Building on Night of the Dead Battery

Read first: `DESIGN.md` (story, cast, rooms, puzzles), `types.ts` (every
contract), `engine/game.ts` (how sentences, scripts and Ctx behave),
`content/items.ts`, `content/flags.ts`, `content/heroes.ts`,
`content/sfx.ts`, `render/api.ts`, `render/fx.ts`,
`../base/pixel/sprites.ts` and `../base/pixel/stage.ts`.

## Rules of the house

- **One file per room, per painter, per NPC.** A room's content is
  `content/rooms/<id>.ts` (`export const room`), its art
  `render/rooms/<id>.ts` (`export const painter`), an NPC's art
  `render/npcs/<id>.ts` (`export const paint`); the registries
  (`content/index.ts`, `render/rooms/index.ts`, `render/npcs.ts`) import
  them. Shared contracts are `types.ts`, `content/flags.ts`,
  `content/items.ts`, `content/heroes.ts` and `content/sfx.ts`.
- **Import cycles.** story.ts and the rooms import each other (the clock
  runs `midnight`, the finale reads the rooms' exported coordinates): never
  read another module's export at module load, only inside handlers.
- **Flags.** Cross-floor puzzle state uses the names in `content/flags.ts`
  (`F.furnaceLit` …). A room's own small state uses `<room>.<thing>` flags
  local to your file.
- **Solves.** Call `yield c.solve('<id>')` once, at the moment a puzzle is
  solved, with exactly these ids (22, the numbered puzzles in DESIGN.md):
  `matches oil furnace bones-key lab jam trunk monocle diary cat booth bat
  window rod letters seance poker gustav gloves junction lever midnight`.
  Guard it so it can't fire twice.
- **Sounds.** `c.sfx(name)` only with names from `content/sfx.ts`. Music
  cues only from `MUSIC` there.
- **Text.** The pixel font is upper case only; write normal sentences, it
  upper-cases them. Speech wraps at about 210 px (35 characters a line); keep
  a line to three wrapped lines at most (~100 characters), split longer
  speech into several `say`s. Characters the font has: A–Z, 0–9,
  `. , ! ? ' " : ; - + / ( ) % & * # = < > _` and Æ Ø Å; `…`, `’`, `—`
  map to plain ones. No other symbols.
- **Humour.** Day of the Tentacle: dry, absurd, warm; objects have
  opinions; the heroes' voices differ (Kjell precise and fretful about his
  Volvo, Dag slow and food-first, Espen a thrilled ghost-podcaster). Use
  `c.by({ kjell, dag, espen })` when a line depends on who says it. The
  bunny suits are a running joke (Gustav thinks Kjell is a rabbit, the cat
  hisses at rabbits, the bat calls Espen "large rabbit", Mr Bones is out of
  carrots). Every hotspot answers LOOK AT, and the obvious verbs get a real
  line, not the default. No "honest" framings, no meta jokes about AI.
- **Coordinates.** Rooms are `w` wide (≥ 400) and 144 tall. Feet y for
  standing heroes is usually 100–140 (the floor). The heroes are about
  48–56 px tall with ears (Kjell tallest and thin, Dag wide ~22 px, Espen
  small). Put `at` points inside the walk area, `face` towards the thing.
  Exits sit at the walk area's edges (a door in the back wall: its `at` is
  on the floor in front of it). Hotspot rects must match what is drawn.
- **Speech anchors.** NPC speech goes over the NPC actor's head
  (`NPCS[id].talkY` above its feet). Move an NPC with
  `yield c.place('cat', 'kitchen', x, y)` and its pose with
  `yield c.pose('sit', undefined, 'cat')`; the NPC painter reads
  `a.pose`.

## Art: the pixel look, DOTT-coloured

- Everything is drawn with `fillRect` on whole pixels (or `sprite()` string
  maps from `sprites.ts`). No anti-aliased arcs, gradients or
  `imageSmoothing`. Circles and curves: fill them pixel by pixel. Dither
  with `bayer(x, y)`.
- DOTT's house: crooked and cartoony. Walls lean, door frames tilt,
  pictures hang askew, furniture has fat bulging shapes, floors are
  chequered or planked with strong perspective. Saturated colour: violet
  and teal walls, rose and gold trim, warm wood. Dark outlines (`#0b0616`)
  round objects, top-lit two-tone shading.
- Lighting: `ambient()` returns the room's light-map base (around
  `#7a70a0`–`#a098c0` for a lit room, darker for the cellar), `lights()`
  adds warm pools for candles, lamps, the fire, the furnace, a screen;
  `glow()` draws emissive things at full brightness (ghost glow, neon,
  sparks, a window during a strike: `v.flash` is the storm light 0–1).
  Windows show the storm: dark sky, rain with `rainIn()`, a bolt with
  `bolt()` when `v.flash > 0.5`.
- `paint()` is the static background, painted once and cached: put
  everything that never changes there. `back()` draws what depends on state
  or time (a drawer open, the rod raised, a flickering flame, ticking
  pendulum). `front()` draws things in front of the actors.
- Animate the house: candle flicker, pendulum, pipes that steam when the
  furnace is lit, rain on windows, a cobweb swaying. The NPCs are the
  stars: idle animations, a talking mouth when `v.talking === id`, poses.

## Checking your work

- Node: `tests/battery-load.mjs` bundles engine + content; drive the game
  with `tests/battery-helpers.mjs` (`doing(g, 'use', item('oil'),
  hs('socket'))`, `settle`, `g.s.flags`, `g.s.inv`). Set up state directly
  (place the hero, set flags, give items) to test your floor alone.
- Pictures: `flock /tmp/claude-1000/chrome.lock node
  scripts/battery-lab/shot.mjs ~/Pictures/battery/<you> "<shot>" …` (one
  browser, many shots; see the header of shot.mjs for the query keys:
  room, x, y, hero, flags, inv, actors, say, who, w, h, dpr, hover, flash).
  Always under the flock, never in a loop that starts a browser each time.
  Look at every picture you make and fix what looks wrong.
- Types: `flock /tmp/claude-1000/tsc.lock npx vue-tsc --noEmit -p
  .nuxt/tsconfig.json 2>&1 | grep themes/battery` from the worktree root.

## Poses (the hero rig draws these; scripts set them with `c.pose(name, seconds?)`)

`''` idle / walking · `reach` (an arm out: the engine sets it for 0.45 s on
hands-on verbs) · `pickup` (bend down) · `strain` (pulling, pushing, a stuck
lid) · `shrug` · `think` (hand on chin) · `point` · `scared` (arms up,
ears up) · `wave` · `cheer` (both arms up) · `sit` · `fall` (tumbling, for
the intro) · `lie` (flat on the floor) · `carry` (arms round something big:
Dag with the battery) · `eat` (hand to mouth) · `back` (seen from behind,
looking up at something).

The NPC painters define their own poses (`sleep`, `hang`, `shiver`, `sit`,
`booth`, `fly`, `wear-monocle` …) and document them at the top of their
file.
