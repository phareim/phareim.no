# Neon Shrine — design

A Link to the Past–style adventure on an 80s neon coast: a 20–30 minute
quest with one overworld, three small interiors and one dungeon. Original
story, maps, sprites and music. Status and checks: `docs/games/neon-shrine.md`.

## Story

The sun has hung on the horizon for three nights. The Static King crawled
out of the old Neon Shrine and took the Sun Prism. The Keeper hands you a
blade; you bring the prism back and the sun can finally set.

## World (`world/`)

Maps are string grids (tile legend in `types.ts`, behaviour in
`world/tiles.ts`). A char listed in a map's `marks` is a marker: an entity
(chest, NPC, enemy, sign, shop item, warp, entry, plate, gate) placed on that
tile. `world/validate.ts` checks shapes, warps and that every chest, item,
NPC and warp is reachable once locks and cracks have given way.

**Overworld** (`overworld.ts`, 64×48, free-scrolling camera). Six areas, each
with a banner, a music track and a continue point:

| Area | Where | What |
|---|---|---|
| Home Glade | SW, start | Keeper, sword chest, pots, blobs, rock-ring chest |
| Whisper Woods | NW | bats, dashers, **bomb bag** chest, heart piece behind a boulder |
| Night Market | N | shop, arcade, kid, cat, fountain; `village` music |
| Hollow Graves | NE | zappers, sentry, ghost; rubble seals the Shrine stairs |
| Crossroads | centre | signpost, spitters, a sentry |
| Mirror Lake | SE | the sun's reflection, island chest, bomb-able cliff → cave |

**Interiors** (`interiors.ts`): shop (bombs 15, heart 10, heart piece 100
bits), arcade (robot hints, high-score sign, chest), lakeside cave (dark,
heart piece).

**The Neon Shrine** (`shrine.ts`, 3×4 camera rooms of 16×12): entry → east
room (clear it, key 1) → push-block puzzle opens the gate to the dark room
(clear it, key 2) → key 1 opens the hub's west door → crystal room (toggle
the switch, big chest: **Prism Disc**) → key 2 → Chrome Knight miniboss
(**Big Key**) → antechamber (disc the switch across the water, eye statues)
→ big-key door → the Static King → heart container + **Sun Prism** = win.
A cracked wall in the entry hides a heart piece. Four heart pieces + the
boss container take you from 3 to 5 hearts.

## Play (`engine/`)

Pure and deterministic (fixed 1/120 s steps, seeded RNG in the state), so
the tests can play the whole game. The A button is contextual: talk, read,
open, buy, lift, throw — otherwise the sword. Hold A after a swing and let go
for a spin (2 damage). B uses the selected item: bombs (crack `R`/`%`, hurt
everything, stun zappers) or the Prism Disc (boomerang: stuns, kills bats and
blobs, fetches drops, flips crystal switches, breaks the King's shards).

Enemies: blob, spitter (reflect its pellets), sentry (sees you, charges),
bat, dasher, zapper (shocks a blade unless stunned), skull (dodges), eye
statue (laser), knight (shield front, charges, dazed after a wall hit),
king (orbiting shards; break all four, then strike while he's down; phase 2
at half health).

Death: full hearts back at the last continue point (overworld area entry or
the Shrine entrance); progress, keys and opened doors stay. Dungeon rooms
respawn their enemies and reset unsolved blocks on re-entry, like LTTP.

## Look (`render/`)

The world is drawn at 16 px per tile into a logical-resolution buffer, lit
by a multiply light map (dusk ambient, lamp pools, dark rooms where only the
hero glows), scaled by a whole number, then given soft neon bloom and faint
scanlines. The view follows the screen: at least 13×11 tiles, taller on
portrait phones. Palette: teal-indigo grass, rose paths, teal/violet
canopies with magenta rim light, violet stone with neon strips; cyan hero,
pink danger, gold treasure. Sprites and the 5×7 pixel font are code
(`render/sprites.ts`, `render/font.ts`); terrain is painted procedurally
(`render/tiles.ts`).

## Sound (`audio.ts`)

Own Web Audio graph: seven original looping tracks (title, overworld,
village, dungeon, boss, indoor, ending), five jingles and ~40 SFX, all
synthesised. The site radio is parked while a track plays.
