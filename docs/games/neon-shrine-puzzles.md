## Neon Shrine — physical puzzles

Ice, light beams, weights, rolling stones and sluices, plus a little more physical combat. Every rule is switched
on by the map: by its puzzle tiles, or (combat only) by `MapDef.physics` (Fogstage, whose ponds drown the foes
knocked into them). A map with none plays exactly as before (a test checks every older map is off). Code: `engine/puzzles/` (rules, kits), `world/puzzles.ts` (the tiles as
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
| `θ` `η` | light / heavy plate | Mark `{ t: 'plate', id }` (unmarked: `w:<tile>`). Held by weight ≥ 1 / ≥ 2: block or mirror 2, boulder 3, pot or rock tile 1, hero 1 (2 carrying a pot or rock), the echo 1 (`docs/games/neon-shrine.md`, "The Echo"; it holds a plain plate `_` too), foe 1 (big 3), Luna 1. Read by `{ plates: [id] }` like the old plates. |
| `σ` | scale pan | Pans sharing a plate id are one scale: down only while all carry equal weight > 0. |
| `κ` | boulder | Mark `{ t: 'boulder', dir, flag? }`: rolls along `dir` once `flag` is set (a lever); a bomb beside a boulder kicks it away, unless its lever still holds it. Crushes foes (4), hits the hero (2, thrown aside), bursts cracked walls (`%`, `R`) and rolls on, fills a pit for good, rests at anything solid. |
| `ω` `ψ` | sluice water / drained floor | Mark `{ t: 'sluice', flag, invert? }` on every tile of a basin: full while `flag` is unset (set, with `invert`). Flooding waits for the hero to step out and drowns walking foes. |
| `ξ` | valve | Mark `{ t: 'valve', flag }`: a hit or A sets or clears the flag (two valves on one flag, two basins with opposite `invert`: one drains as the other fills). |

Lumen tubes (`╵ ─ ┌ … ╬`, the tap `Θ`, the socket `Λ`) are puzzle tiles too, with rules of their own:
`docs/games/neon-shrine-sign.md` (Relight the Sign, Lumenby).

**The view blocks** are a kit piece beside these, and not puzzle tiles (they switch no other rule on):

| Tile | What | Rule |
|---|---|---|
| `□` | square block | Solid in the 8-bit view; in the isometric view an outline on the floor, walked over. |
| `◇` | diamond block | Solid in the isometric view; in the 8-bit view an outline on the floor. |

An up block is a wall to the hero, shots, the disc, the hook, beams and sight; foes, people and pushed things
(blocks, mirrors, boulders, psi blocks, bombs) stand on neither kind in either view. A turn that would raise one
under the hero is refused. Authoring: allow both views, put every entry and landing on a tile that is neither
kind, leave two tiles of free ground wherever the player is meant to turn (the hero is 0.68 tiles wide), keep
them out of rooms with a boss that places itself, and let `validateWorld` check the routes. The full rule:
`docs/games/neon-shrine.md`, "The view as a rule". `Cond { view }` opens a gate or raises a chest in one view.
Taught in the Turn Room (below). The kit solver (`solveKit`) does not know them.

Beams pass over water, fences and counters, stop at anything else solid (a block pushed in their way too) and
burn the foes they cross. Bombs shove blocks and mirrors beside them (on ice they slide). On a physical map a foe
knocked into a pit or water is gone, onto spikes hurt.

**State and saves.** Live state is `MapState.phys` (never saved). What lasts is flags: receivers' and valves' own,
`boulder:<map>:<home>:<rest>` (rest -1: it filled a pit), `fill:<map>:<tile>`, and bombs' `bomb:` flags for walls a
boulder broke; `loadPuzzleTiles` (called by `loadMap`) applies them, reading each by its map's prefix
(`puzzleFlag`: a map id may hold colons itself). Entering a dungeon room brings the floors back
under moved blocks and, unless a gate of the room is open, its mirrors and the boulders that came to rest home
(their flag cleared: a thrown lever lets them roll again; one that filled a pit stays gone).

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
beams, weights; pots and foes left out). Past a kit's edge is wall. A kit set into a land keeps the kit's `.` floor, not the land's ground: nothing is
pushed or rolled over Stillsand's sand (`-`).

**THE PUZZLE LAB** (`puzzlelab`, entry `start`, inside Stillsand's gold pyramid, `world/demos.ts`). Six rooms, 3×2 (their banners: THE WEIGH HOUSE, THE COLD ROOM, THE MIRROR ROOM, THE STONE RUN, THE SLUICE HALL, THE LAST ROOM; the mirror room, the stone run, the sluice hall and the last room have a sign, which never says how):
A weights (carry a pot onto the heavy plate) → B ice (slide the block onto the plate) → C beams (prism, two
mirrors, two receivers) → D rolling stone (lever, cracked wall, pit filled) → E sluices (two valves, two basins)
→ F all together (the stone clears the beam's road, the mirror slides up the ice into it and is turned, the
receiver opens the chest's gate). Needs no item; a blade or A works every switch. Both views draw it
(`views: ['iso', 'classic']`). A door in the north wall of the Weigh House leads to **THE TURN ROOM**
(`turnroom`, `world/turnroom.ts`), one room of 16 × 12 in the Lab's look that teaches the view blocks: from the
door a row of diamonds, then a row of squares, then a stagger of both and a chest of 20 bits; its door leads back
to the Weigh House (`from-turnroom`).
