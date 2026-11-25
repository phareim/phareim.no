## Neon Shrine — physical puzzles

Ice, light beams, weights, rolling stones and sluices, plus a little more physical combat. Every rule is switched
on by the map: by its puzzle tiles, or (combat only) by `MapDef.physics`. A map with none plays exactly as before
(a test checks every older map is off). Code: `engine/puzzles/` (rules, kits), `world/puzzles.ts` (the tiles as
data), `render/puzzleTiles.ts` (classic painter, beams), `render/iso/puzzleProps.ts` (the things in the round).
Demo: `world/puzzlelab.ts`. Tests: `tests/zelda-puzzles.test.mjs`.

**Tiles** (Greek letters; behaviour also in `world/tiles.ts`):

| Tile | What | Rule |
|---|---|---|
| `α` | ice | The hero, pushed blocks and mirrors, thrown pots slide until something stops them or they reach ground that is not ice. The stick does not steer a slide. |
| `β` | beam emitter | Mark `{ t: 'emitter', dir, when? }` (unmarked: down, always). Shines while `when` holds. |
| `μ` `ν` | mirror (`/`, `\`) | Turns a beam a quarter. A blade, the disc or A turns it (`μ`⇄`ν`); it pushes like a block and slides on ice. |
| `π` | prism | Splits a beam into the two ways across it. |
| `ρ` | receiver | Mark `{ t: 'receiver', flag }` (unmarked: `beam:<map>:<tile>`). Lit once, the flag is set for good. |
| `θ` `η` | light / heavy plate | Mark `{ t: 'plate', id }` (unmarked: `w:<tile>`). Held by weight ≥ 1 / ≥ 2: block or mirror 2, boulder 3, pot or rock tile 1, hero 1 (2 carrying a pot or rock), foe 1 (big 3), Luna 1. Read by `{ plates: [id] }` like the old plates. |
| `σ` | scale pan | Pans sharing a plate id are one scale: down only while all carry equal weight > 0. |
| `κ` | boulder | Mark `{ t: 'boulder', dir, flag? }`: rolls along `dir` once `flag` is set (a lever); a bomb beside any boulder kicks it away. Crushes foes (4), hits the hero (2, thrown aside), bursts cracked walls (`%`, `R`) and rolls on, fills a pit for good, rests at anything solid. |
| `ω` `ψ` | sluice water / drained floor | Mark `{ t: 'sluice', flag, invert? }` on every tile of a basin: full while `flag` is unset (set, with `invert`). Flooding waits for the hero to step out and drowns walking foes. |
| `ξ` | valve | Mark `{ t: 'valve', flag }`: a hit or A sets or clears the flag (two valves on one flag, two basins with opposite `invert`: one drains as the other fills). |

Beams pass over water, fences and counters, stop at anything else solid (a block pushed in their way too) and
burn the foes they cross. Bombs shove blocks and mirrors beside them (on ice they slide). On a physical map a foe
knocked into a pit or water is gone, onto spikes hurt.

**State and saves.** Live state is `MapState.phys` (never saved). What lasts is flags: receivers' and valves' own,
`boulder:<map>:<home>:<rest>` (rest -1: it filled a pit), `fill:<map>:<tile>`, and bombs' `bomb:` flags for walls a
boulder broke; `loadPuzzleTiles` (called by `loadMap`) applies them. Entering a dungeon room brings the floors back
under moved blocks and, unless a gate of the room is open, its mirrors home.

**Hooks in shared files** (each a line or a branch): `hero.ts` (slide, push, blade hits, A on a mirror or valve,
psi blocks over ice), `objects.ts` (step, plates, bombs, disc, pots), `enemies.ts` (knock-back), `game.ts`
(room reset), `map.ts` (load, default mark tiles), `validate.ts` (pits on a boulder's road count as floor),
`render/tiles.ts`, `renderer.ts` (beams with the shots, rolling boulders queued), `iso/shape.ts` (the solids are
cards), `iso/props.ts` (their kinds), `iso/view.ts` (which prop stands, rolling boulders, ice glazed, `ω` is water).

**Looks.** Beams are neon cyan lines with a white core, `BEAM_Z` (7 classic px) over the floor, drawn on the shots'
layer in every view, and they light the floor they cross. In the isometric view emitters, mirrors, the prism,
receivers (dark / lit), valves (shut / open) and rolling boulders (four frames each way) are built of solids;
ice is glazed (the composite's wet floor shows the lamps in it), the sluice water is the view's water. The
isometric view is the intended one; the classic view draws all of it top-down. Shots: `pz-weights`, `pz-ice`,
`pz-beam`, `pz-boulder`, `pz-sluice`, `pz-final` in `scripts/zelda-lab/shot.mjs`.

**For the generator** (`engine/puzzles/kits.ts`, exported from `engine/index.ts`). `puzzleKits`: small grids with
marks, an entry on their edge and a `solved` Cond (ice-cross, ice-block, beam-mirrors, beam-prism, scale,
boulder-wall, sluice, ice-mirror). `stampKit(def, kit, x, y, prefix)` writes one into a MapDef (free marker
chars, flags and plate ids prefixed) and returns the Cond in the map's terms, for a gate's `open` or a chest's
`appear`. `solveKit(kit)` / `solveGrid({ rows, marks }, start, goal)` is the validator: a breadth-first search over
hero tile + grid + flags with the engine's rules at tile resolution (walk, slide, push, hit what is beside you,
beams, weights; pots and foes left out). Past a kit's edge is wall.

**The Puzzle Lab** (`puzzlelab`, entry `start`, registered in `WORLD.maps`, not linked yet). Six rooms, 3×2:
A weights (carry a pot onto the heavy plate) → B ice (slide the block onto the plate) → C beams (prism, two
mirrors, two receivers) → D rolling stone (lever, cracked wall, pit filled) → E sluices (two valves, two basins)
→ F all together (the stone clears the beam's road, the mirror slides up the ice into it and is turned, the
receiver opens the chest's gate). Needs no item; a blade or A works every switch. Once CORE lands `views`, it
should say `views: ['iso', 'classic']` (both draw it).
