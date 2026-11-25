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
town, opened a Gate to the static between stations. With Luna, the lab's
escaped test subject, you go down through both labs and shut the Gate. The
Shrine road is open from the start (2026-10-01): king first or Gate first,
and the Sun Prism appears once both are done. The Wildwood part:
`docs/games/wildwood.md`.

Quest (`progress.ts`, twelve milestones, either road first; the hint follows the road the player has started): blade · bomb bag · Luna · hook ·
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
| PHAREIM.NO | W, the start | the town: Petter's house, the arcade, fountain, the NEW LOOK stall, the KODING KATA stand, newsstand, pier; no enemies; `village` music. Details: `themes/portal/DESIGN.md` |
| Home Glade | SW | the coast road arrives here; Keeper's hut (door → hut), Keeper, sword chest, pots, blobs, rock-ring chest |
| Whisper Woods | NW | bats, dashers, **bomb bag** chest, heart piece behind a boulder |
| Night Market | N | shop, kid, cat, fountain, market stalls and a sign where the old arcade stood (the arcade is in town since 2026-09-24); `village` music |
| Hollow Graves | NE | zappers, sentry, ghost; rubble seals the Shrine stairs |
| Crossroads | centre | signpost, spitters, a sentry |
| Mirror Lake | SE | the sun's reflection, island chest, bomb-able cliff → cave |

**The Wildwood** (`wildwood.ts`, its own overworld map, 84×52; the town's
west road warps there through a thicket you cut) and its labs (`lab1.ts`,
`lab2.ts`): see `docs/games/wildwood.md`.

**Interiors** (`interiors.ts`): the Keeper's hut (bed, table, lamps, pots,
the Keeper's cat), shop (bombs 15, heart 10, heart piece 100 bits), lakeside
cave (dark, heart piece). In `town.ts`: the arcade (fourteen cabinets: ten games and four that leave the site, Adventure, Pizza Rescue, Solo Rescue and Vector Horizon, the last by the door and taped off as under test; the Hall
of Fame board, the HANGAR door, the robot's chatter, the HIGH SCORES sign, a
chest), the VIP hall (Ulrikke's four games and a bar, behind a velvet rope that is down
only while logged in: `docs/games/portal.md`) and Petter's house.

**Exits** (`ExitDef` in `types.ts`) leave the game for somewhere else: the
town's cabinets (six of them, Eventyrland's, Supermusene's, Adventure's, Pizza Rescue's, Solo Rescue's and Vector Horizon's, for another site), board, HANGAR door, kiosk, the KODING KATA stand (kata.phareim.no), signpost and terminals. The
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
sword: 2 damage, cuts static vines), Luna (follows;
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

After the Sun Prism the woods follow a 12-minute day (`engine/day.ts`): the
placed foes at dusk and dawn, twice as many at midnight, none at noon, and
they walk in and out past the screen's edge instead of appearing.

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
by a multiply light map (dusk ambient until the Sun Prism is home, then the
hour's light of a 12-minute day: `docs/games/neon-shrine.md`, "Day and
night"; lamp pools, dark rooms where only the
hero glows) with hard-pixel shadows in it (`render/shade.ts`: outdoors a
low sun lays the shadow of every house, wall and wood along the ground, and
whoever walks throws one away from the nearest light), scaled by a whole number, then given soft neon bloom and faint
scanlines. The view follows the screen: at least 13×11 tiles, taller on
portrait phones. Palette: teal-indigo grass, rose paths, teal/violet
canopies with magenta rim light, violet stone with neon strips; cyan hero,
pink danger, gold treasure. Sprites and the 5×7 pixel font are code
(`render/sprites.ts`, `themes/base/pixel/font.ts`); terrain is painted procedurally
(`render/tiles.ts`). This is the classic view.

**Art direction** (Petter, 2026-11-24). The views are named for their picture (CLASSIC, ISOMETRIC, POLYGON), not for a
machine's bits. The isometric view is pixel art in its own right, bound to no period's limits: it draws in every colour
the screen has (`colors: 'full'`; the 15-bit dither is a choice), its art may have more pixels and more colours than the
classic sprites (its own ramps; the shared `PAL` stays as the classic and the other pixel games draw it), and where a
thing is naturally a body (a van, a tent, a boss, the hero) it may be pixel art rotoscoped from a 3D model, as the
standing things (`iso/props.ts`) and the modelled hero (`iso/figure.ts`) already are. Since part 19 the people
are redrawn for it as isometric pixel art at its own density (`iso/folk.ts`: since part 20 everyone but the bosses, the hero since part 21 composed and
recoloured by roles in `iso/hero.ts`, the bosses since part 22 rotoscoped in `iso/bossArt.ts`; the studio's newer edit of a classic sprite wins until the art is redrawn). Since part 23
the things of the world (the van, tents, fires, torches, the mast, tanks, the DJ booths, the furniture, the labs'
consoles and benches, a fountain in the square's pool) are rotoscoped too, from guides built of solids (`iso/things.ts`).
What still waits for its isometric art (the mistral, the pictures on the walls, the pool's square water, the effects) is
in the journal thread `neon-shrine-isometric-art`.

**Rotoscoped pixel art** (Petter, 2026-11-25: «Alt vi legger ut skal ha en håndtegnet piksel-art følelse … Vi tåler
veldig godt å bruke mange farger.»). A 3D model is only ever the guide: it gives the angle (the view's own projection:
the ground a 2:1 diamond, height not foreshortened), the proportions, the volume and the poses, and it never ships.
Every px that ships is drawn by hand (Codex `image_gen`) over the posed render, with the redrawn figures beside it as
the style and the classic sprite as the identity: no smooth shading, no specular, no plastic. Colours are not capped;
only what is one colour under the image's noise is merged. Pixels are one scale: a drawing is cut at the grid it was
drawn on, never resampled, and a figure must be guided large enough on the sheet for the drawing's own pixel to be one
px of the view (Codex draws about 10 px of a 1536-px sheet to a pixel; smaller, and its pixels come out doubled).
Whatever makes the classic figure readable is protected in the prompt and checked after: a glowing eye that goes dull
is a redraw. A thing with a body also takes from its guide what the drawing cannot say: which way each px
faces and how near it lies, so the view lights it and sorts the hero against it per px; frames are drawn on one sheet
with what does not move the same, or are pixel edits of one drawing, so the animation does not shimmer.

Other views draw the same
state another way: an isometric one, where a visit starts, with a sun of its own and its
own materials for the ground, the walls and the roofs; and a polygon one: since part 14 (2026-11-24) the
isometric world's own art (its hero, its trees) standing in the polygon engine's land and light (since part 16 the hero
and every person and thing are the classic drawings, as in the classic and the isometric adventure, at four times the isometric
view's pixels, made in the shader: Scale4x and the isometric view's blend), seen from the isometric
look's angle but nearer and with real depth (since part 18 a lit diorama: the isometric materials, none of the 1996
machine's flaws, calm lamps, and depth of field round the hero), the land flat beside roads and houses and low elsewhere, and reached
from the isometric look by one continuous move that never shows the classic picture (the 64-bit look below is out of
the round for now: `views.ts`); before that, the world as low polygons in
perspective from a crane behind the hero, with a horizon, rolling land, round ponds and a short draw distance,
drawn much as a 1996 console drew (corners that snap to the pixels, 15-bit colour with a dither, figures texel by
texel; its ground no longer swims: steadiness came first); and on the
same engine a 64-bit one, THIRD PERSON, from behind the hero's shoulder, soft and fogged (filtered textures,
smooth shading, smooth edges, thick fog in the hour's colour, lamp halos). Each generation draws finer than the one
before (the 32-bit look at four px to the classic px, the 64-bit one at the screen's own), both wear textures
painted for them in the whole colour range, and in both the hero is a model of many polygons (6,000 and 20,000)
moving by the isometric figure's poses. Both are steady where the period machine was not: the lamps and the hour's
light are held smooth so the dither never crawls, every change between the four views is a turn, an ease or a
dissolve and never a cut, and the light is the classic picture's at the turn's flat end and the same in every view
(the painted materials brought to the isometric view's mean light; the 64-bit look lit per pixel). The 64-bit look is
soft without being mush: its ground is filtered anisotropically (sharp near, steady far), its camera rides over the
land so the hero's feet and the sky are in the picture, the distance steps back in the hour's colour, the hero carries a
rim of light, and both looks run on a phone (the hero posed on the GPU, a stated ladder for slow devices). The turn switch in the
corner turns between the four: `docs/games/neon-shrine.md`, "Views".

## Sound (`audio.ts`)

Own Web Audio graph: ten original looping tracks (title, overworld,
village, dungeon, boss, indoor, ending, forest, lab, static), six jingles
and ~50 SFX, all synthesised. The site radio is parked while a track plays.
