# Neon Shrine — design

A Link to the Past–style adventure on an 80s neon coast: a quest of an hour
or more with two overworlds (the coast and the Wildwood), a handful of
interiors, two labs of two floors each and the Shrine.
Original story, maps, sprites and music. Since 2026-09-24 it is phareim.no's
front page: the town (the portal) is the west end of the same world, and the
quest starts down the coast road from it. Status and checks:
`docs/games/neon-shrine.md`; the town: `docs/games/portal.md`.

## Story

The sun has hung on the horizon for three nights. The Static King crawled
out of the old Neon Shrine and took the Sun Prism. The Keeper hands you a
blade; you bring the prism back and the sun can finally set.

The King came from somewhere: Project Horizon, a lab in the Wildwood west of
town, opened a Gate to the static between stations. Static vines from it
have grown over the Graves road to the Shrine. With Luna, the lab's escaped
test subject, you go down through both labs and shut the Gate; then the
vines wither and the Shrine is open. The Wildwood part: `docs/games/wildwood.md`.

Quest (`progress.ts`, twelve steps): blade · bomb bag · Luna · hook ·
Mistral · Arc Blade · Gemini (the Gate shut) · rubble · disc · big key ·
Static King · Sun Prism.

A visitor starts in the town square facing Petter's name, with nothing. The
coast road east leads to Home Glade; walking in without the blade, the
Keeper (standing by the hut door) tells the story once (the area's `intro`),
and the blade's chest is right next to the door. The quest clock starts with
the blade.

## World (`world/`)

Maps are string grids (tile legend in `types.ts`, behaviour in
`world/tiles.ts`). A char listed in a map's `marks` is a marker: an entity
(chest, NPC, enemy, sign, shop item, warp, entry, plate, gate, exit) placed
on that tile. An entry with `out: true` sits on a door: arriving there, the
hero walks one tile out along its direction before control returns.
`world/validate.ts` works on any `World` (the portal runs it on its own): it
checks shapes, warps, exits, and that every chest, item, NPC, warp and exit
is reachable once locks and cracks have given way.

**Overworld** (`overworld.ts`, 104×48, free-scrolling camera). The town fills
columns 0–39; the old coast is shifted 40 east (`TOWN_W`). Seven areas (the Wildwood is a map of its own), each
with a banner, a music track and a continue point:

| Area | Where | What |
|---|---|---|
| PHAREIM.NO | W, the start | the town: Petter's house, the arcade, fountain, newsstand, pier; no enemies; `village` music. Details: `themes/portal/DESIGN.md` |
| Home Glade | SW | the coast road arrives here; Keeper's hut (door → hut), Keeper, sword chest, pots, blobs, rock-ring chest |
| Whisper Woods | NW | bats, dashers, **bomb bag** chest, heart piece behind a boulder |
| Night Market | N | shop, kid, cat, fountain, market stalls and a sign where the old arcade stood (the arcade is in town since 2026-09-24); `village` music |
| Hollow Graves | NE | zappers, sentry, ghost; static vines (a gate open on `gateShut`) and rubble seal the Shrine stairs |
| Crossroads | centre | signpost, spitters, a sentry |
| Mirror Lake | SE | the sun's reflection, island chest, bomb-able cliff → cave |

**The Wildwood** (`wildwood.ts`, its own overworld map, 84×52; the town's
west road warps there through a thicket you cut) and its labs (`lab1.ts`,
`lab2.ts`): see `docs/games/wildwood.md`.

**Interiors** (`interiors.ts`): the Keeper's hut (bed, table, lamps, pots,
the Keeper's cat), shop (bombs 15, heart 10, heart piece 100 bits), lakeside
cave (dark, heart piece). In `town.ts`: the arcade (eight cabinets, the Hall
of Fame board, the HANGAR door, the robot's chatter, the HIGH SCORES sign, a
chest) and Petter's house.

**Exits** (`ExitDef` in `types.ts`) leave the game for somewhere else: the
town's cabinets, board, HANGAR door, kiosk, signpost and terminals. The
hut has no exit any more; `{ home: true }` is still a valid target but
nothing uses it.

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
open, buy, use an exit, lift, throw — otherwise the sword. Hold A after a swing and let go
for a spin (2 damage). B uses the selected item: bombs (crack `R`/`%`, hurt
everything, stun zappers) or the Prism Disc (boomerang: stuns, kills bats and
blobs, fetches drops, flips crystal switches, breaks the King's shards).

The Wildwood added the grappling hook (B: bites posts, pillars, lamps and
chests and reels you over pits and water), the Arc Blade (the upgraded
sword: 2 damage, a beam at full hearts, cuts static vines), Luna (follows;
slides psi blocks), letter stones, levers, crystal groups shared across
floors, holes to the floor below, per-dungeon keyrings and room events.

Enemies: blob, spitter (reflect its pellets), sentry (sees you, charges),
bat, dasher, zapper (shocks a blade unless stunned), skull (dodges), eye
statue (laser), knight (shield front, charges, dazed after a wall hit),
king (orbiting shards; break all four, then strike while he's down; phase 2
at half health). The Wildwood: hound (circles, lunges), drone (fires along
a line), and the bosses LLAMA, MISTRAL, DEEPSEEK and GEMINI.

Death: full hearts back at the last continue point (overworld area entry,
the hut door, or the Shrine entrance); progress, keys and opened doors stay.
Dungeon rooms respawn their enemies and reset unsolved blocks on re-entry,
like LTTP.

Exits: walking onto a door exit, or pressing A at a solid one (after its
lines, if it has any), starts the usual door fade; at full dark the engine
emits `exit` and enters mode `exit`, which is terminal like `won`. The shell
does the navigating. The engine also registers an entry named after each
exit beside it (on `side`), so the portal can put you back where you left.

Before the blade: A only talks, reads and uses; B does nothing and makes
no sound; the HUD (hearts, bits, items) is hidden and the clock stands
still. The town is safe because it has no enemies or hazards, not because
of a rule (`World.peaceful` was removed 2026-09-24).

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

Own Web Audio graph: ten original looping tracks (title, overworld,
village, dungeon, boss, indoor, ending, forest, lab, static), six jingles
and ~50 SFX, all synthesised. The site radio is parked while a track plays.
