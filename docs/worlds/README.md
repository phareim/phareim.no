# The frontier — Neon Shrine's generated world

Across the bay from the town lies the **frontier**: a world made from a seed
instead of drawn by hand, many times the size of the hand-made maps. The town,
the coast, the Shrine and the Wildwood stay as they are.

**Getting there.** The ferry at the end of the town's pier (overworld 20,38)
goes to THE LANDING (`fr:6,8`); the dock there brings you back (entry
`ferry`). The ferryman stands on the pier until the hero has a blade. In the isometric view the
neon ferry bobs alongside each pier (`render/iso/ferryArt.ts`, lab scenes `f-ferry-town` and
`f-ferry-landing`).

## Frontier art

Each realm has a kit in `themes/zelda/render/iso/frontierArt/`. The authored
solids bake into the isometric renderer's 32 px/tile grid, with hard alpha,
surface normals and depth. The generated tables are packed losslessly for
the build. The view adds only the current realm's kit to its prop atlas.
`frontierScenery.ts` anchors scenery to generated stamps and quest
sites. The Underglow places its landmarks by layer in `descent.ts`.

The frontier actors start with 16×16 classic sprites in `render/frontierSprites.ts`.
Their isometric frames use the same sprite names and live-sprite hash checks
as the rest of Neon Shrine. The eight boss families are registered for their
planned encounters. Era, sign, troll and other quest art includes the variants
for those systems. See the [art checklist](../art/codex-tasks.md).

- Bake and preview one prop kit with `node scripts/zelda-lab/frontier-art.mjs <kit> <out.html>`.
- Bake the actor families with `node scripts/zelda-lab/frontier-people.mjs`.
  Pass a JSON path to also write GROK's four Blender guide poses, then render
  them with `scripts/zelda-lab/grok-guide.py`.
- The `f-<realm>` and `f-<realm>-390` scenes in `scripts/zelda-lab/shot.mjs`
  show the generated landmarks in place at desktop and phone widths.

## How it is made (`themes/zelda/world/gen/`)

| File | What |
|---|---|
| `frontier.ts` | `FRONTIER`: seed, region size (64×44), the macro map (one char per region → a realm), the Landing, hand-written `sites`. `frontierMap(id)` makes a map on first ask and keeps it. Ids: `fr:<rx>,<ry>`, caves `fr:<rx>,<ry>:cave<n>`, the Underglow's layers `fr:<rx>,<ry>:deep<n>` |
| `realms.ts` | The realms as data (`RealmSpec`, `types.ts`): terrain mix, foes by weight, density, places, folk and what they say, the first visit's words (`intro`), what each place's signs say (`signs`, by stamp; `lore` where a place has none), loot, allowed views, `special` (dig / battle / puzzles) |
| `region.ts` | One region: noise in world coordinates → land; a rim with passes where a neighbour is (the pass offsets are a hash of the edge, so both sides cut the same gap); places (`stamps.ts`, sites); roads (cheapest paths joining passes and places); folk, chests, signs and foes on what the roads reach. Folk are drawn without putting back (nobody twice in a region before everyone has stood, nobody saying the same twice); a camp's sign adds the roads out to other realms ("NORTH: SETER FELL"), from the macro map |
| `stamps.ts` | The places: camp, house, hamlet, shrine, relic (a realm's heart piece), graves, cave, pond, market, ruin, grove, stones, the Landing's dock; per realm: lots, truck, whistle (Lumenby); seter, trollhump, mound, cairns (Seter Fell); stilts, boathouse, racks, lighthouse (Yule Fjord); island, ribs, oasis, warden, caravan (Stillsand); well (stairs to THE UNDER), clickers, shellyard, windmill (Sporelight); hilltown, ghostlight, flats, reeds (Fogstage); culdesac, lot, booth, hedgemaze, garagesale (Rerun) |
| `cave.ts` | A cave: 2–3 × 2 rooms of 16×12 joined by a random spanning tree (`carveRooms`), the stairs up in the first, a chest in the furthest; a realm may name its caves and their foes (`RealmSpec.cave`) |
| `descent.ts` | THE UNDERGLOW under Lumenby: six layers of 3×2 rooms (Echo Ledges, the Upside Grove, the Glass Sea, Broadcast, the Fossil Arcade, the Core), stairs up and down, a person of the deep on each, heart pieces on 2 and 4; the Core's Geyser goes home. Reached by the deep drift at `fr:0,3` |
| `quests.ts` | The questlines' sites (`QUEST_SITES`), the realms' landmarks (`LANDMARK_SITES`: the pyramid, the Steamhouse, the deep drift, the drive-in), the folk of the deep. Stories: `quests.md` |
| `rng.ts` | Hashes, a seeded generator, value noise |

The engine sees ordinary `MapDef`s: `World.generate` (in `world/index.ts`) makes
any id `maps` does not have, and `mapDef(world, id)` (engine/map.ts) is the one
lookup. Three MapDef fields came with it: `edges` (walking off an edge where
there is open ground fades into the neighbour at the same place along the
edge), `realm`, and `views` (the shell turns to an allowed view while the hero
is there, the isometric one first, and back to the visitor's own after; V skips
the others). Saves just name the map (`fr:6,8`), so a save made out there loads
out there; death puts you at the region's camp.

Same seed, same world: everything is a pure function of the seed and the
region's place, on every device. Things saved against the world (chest flags
`chest:fr:<rx>,<ry>.c<n>`, a realm's first-visit flag `realm:<id>`, dig edits)
point into it — **changing the seed, the region size or a realm's recipe moves
everything already saved**. Add realms and regions at the macro map's edges
instead, or bump the frontier's seed only with a save migration.

Checks: `tests/zelda-frontier.test.mjs` (every region made and kept; both sides
of every edge open at the same tiles; the world checks pass with every region
and cave and layer of the deep in; the ferry; walking off an edge; every realm
on the macro map; every site in its region and realm; every line in the pixel
font, a page at most three rows of the narrowest box with the touch deck's key
names; everyone who talks opens with a name, none of them a hand-made
character's; every camp's roads true to the macro map; the clean seed talked
through end to end). Pictures:
`VIEW=iso node scripts/zelda-lab/shot.mjs <dir> f-landing,f-meadow,f-cave` and
one per realm: `f-lumenby`, `f-underglow`, `f-seterfell`, `f-yulefjord`,
`f-stillsand`, `f-sporelight`, `f-fogstage`, `f-rerun`.

## The macro map

12 × 9 regions, 89 of them (north up; ' ' is the sea):

```
     x 0123456789AB
y 0      YYYYYYYY       Y YULE FJORD        S SETER FELL      Q LUMENBY QUARRY
  1     QSSSSSSPPP      P THE SPORELIGHT    D STILLSAND       F FOGSTAGE
  2    QQQSSSGPPPPD     R RERUN ESTATES     G THE GREEN MILES L THE LANDING
  3    QQQGSGGGPPDD
  4     QGGGGGGGDDD     The Underglow is not on it: it is under Q, down the
  5    FFFGGGGGRDDD     deep drift at fr:0,3 (descent.ts).
  6    FFFFGGGRRRDD
  7     FFFGGGRRRR
  8       F  L
```

The ferry lands in the south; the Green Miles are the plain between; the cold
runs along the north (the fjord west to east over the fell's pastures), the
quarry hills west, the fungus wood north-east, the desert east, the fog
lowland south-west, the lawns south-east. Each realm's heart piece stands in
its region furthest from the Landing.

## The realms (designs in this directory)

| Realm | Sketch | Special | look | views |
|---|---|---|---|---|
| LUMENBY QUARRY | `realm-lumenby.md` | dig & build | quarry | iso |
| THE UNDERGLOW | `realm-underglow.md` | the descent under the quarry | quarry | iso |
| SETER FELL | `realm-seterfell.md` | dig & build with folk manners | wild (summer: heather and birch) | iso, classic |
| YULE FJORD | `realm-yulefjord.md` | physical puzzles (tide, ice, beam) | snow | iso |
| STILLSAND | `realm-stillsand.md` | physical puzzles (weights, light) | dune | iso |
| SPORELIGHT | `realm-sporelight.md` | field battles (calm, not kill) | spore | iso, classic |
| FOGSTAGE | `realm-fogstage.md` | field battles | fog | iso |
| RERUN ESTATES | `realm-rerun.md` | field battles, one street in three eras | suburb | iso, classic |

`img/concept-<realm>.jpg` are mood targets per realm: gpt-image-2.5 (WaveSpeed
`flare/edit`, ~$0.04 each) redrawing a real iso screenshot (`f-meadow`) as the
realm, so camera and density match; prompts in `img/concept-prompts.json`. The
art still to draw is in `docs/art/codex-tasks.md` (for Codex, on the Mac).

**How each realm's system is switched on** (`region.ts`, by `RealmSpec.special`):
battle realms place their foes as `MapDef.battle` groups (one to four foes,
some that spot you) instead of field foes; dig realms get `MapDef.dig` (their
inner cliffs as stone columns two or three high, some rocks as lumen ore, two
buried caches, and a cliff rim so nothing can be dug or built off the map);
puzzle realms get one or two walled puzzle kits (`engine/puzzles/kits.ts`) per
region, with a chest beside the way in that appears once the kit is solved.
The systems' first maps are reached by stairs from the frontier
(`gen/demos.ts`): THE OLD QUARRY under `fr:2,2` (Lumenby; the four tools are
there), THE BATTLE GLADE under `fr:7,2` (Sporelight) and THE PUZZLE LAB under
`fr:9,4` (Stillsand), each with a way back up. An edge leads on only where the
neighbour's tile is open ground.

`battle-notes.md` and `dig-notes.md` are the designs for the two new systems;
`SOURCES.md` lists the research; `quests.md` the five questlines across the
realms. Every realm is in `realms.ts`: its land, folk, foes (today's kinds
standing in for the sketches' new ones), places and what is said there. The
words follow the Dialogue rule of `docs/games/neon-shrine.md`: whole-sentence
pages, a name before what anyone says (roles for the realm's folk, names for
the questlines' people), bearings true to the macro map, one name per place,
and nothing about the systems below until they exist. What the sketches ask
of systems that do not exist yet:

## TODO: what the realms still need

- **Rerun Estates, three eras**: phone booths that save and jump 1958 / 1986 /
  2086 on the same corner; a per-tile era transform of one region (lots to sand
  and saplings in 1958, lawns to tall grass and houses to rubble in 2086); the
  small carry-forward map (an acorn planted in 1958 is a tree bridge in 2086).
  Needs an era field the region generator reads (an `era` in the map id or the
  state) and a flag set per lot; the booths are stamped already.
- **Fogstage, the fog line**: fog below a height band switches the realm to
  field battles; on hilltops and in a ghost light's pool no fight starts. Needs
  a per-tile "fogged" test (the hill towns and ghost lights are stamped) and the
  battle system's trigger reading it; star traps between hill towns; the
  RAINCHECK moving mast to mast.
- **The Underglow**: the Pull (a greyed heart per layer climbed, rest clears
  it), glowstick ranks and turnstiles, Rut's lifts, the Upside Grove's floating
  drops, the raft on the Glass Sea, the boss PHI at the Core.
- **Seter Fell**: the five-day clock and Moving Day, the call button, troll
  humps that wake at dusk, tusser under mounds (dig manners), MIXTRAL.
- **Yule Fjord**: the tide (strand tiles flood on a cycle), ice tiles, the
  Ride event (lie flat or stand in a chalked door; it also carries the hero to
  another realm), draugs and the nøkk, ORCA.
- **Stillsand**: islands that rise and sink with weight, the low sun's beams
  through quartz lenses, the wind turn, slatebird fast travel, FALCON.
- **Sporelight**: the haze and its mask, grazers whose eyes say calm or rage,
  the Under as a full second layer (today a well's cave), BLOOM.
- **Lumenby**: chalk lots that resolve into houses and light the sign, night
  foes and lamps, GROK.
- New foe kinds named in the sketches (gnawer, ore mimic, floater, hump troll,
  draug, burrower, grazer, sandbag, mower, …) replace today's stand-ins.
