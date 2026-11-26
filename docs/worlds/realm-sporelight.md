# THE SPORELIGHT

A forest of giant glowing fungus whose air is a slow cyan haze of spores that stings above knee height. Grazers the
size of vans wander it, eyes cyan while calm and pink when not. Under the roots the poison is gone: the fungus drank
it out of the soil, and the caves below are white sand, stone trees and clean water. In the middle a spirit inn
steams, where the staff never get your name quite right; at the edge a smelter camp of people the town turned away
burns the wood for iron, and its smoke makes the forest grow faster. Nobody here is the villain, and a fight you
calm is better than one you win.

## Inspiration

Sources: *Nausicaä of the Valley of the Wind*, *Princess Mononoke*, *Spirited Away*.

- **The toxic jungle is poisonous because of its soil, and its roots clean it, leaving pure water and sand below**:
  two layers per region, the **haze** above (a filter mask on a timer, refilled at clean wells) and the **Under**
  (no haze, white sand, stone trees, pools that heal). **Fire spreads spores, wind holds them off**: burnt fungus
  regrows bigger by dawn; the clean places are ridge-top windmill hamlets.
- **Great insects whose eyes go red in rage and blue when calm, soothed by a bullroarer**: **grazers** with eyes in
  our tones, pink rage and cyan calm, readable across the screen; the **hum-reed**, a spun reed that calms
  them. Their shed shells lie about as building material.
- **Kodama, tiny clicking tree spirits that guide and mark a living forest**: **clickers**, thumb-high cap spirits
  that turn their heads with a click; their number is a region's health, and a line of them points to secrets.
- **The god of life and death whose steps bloom and wither, and a god maddened by an iron ball in its side**: the
  boss BLOOM, gentle and enormous, a smelter's slag nail in it; each step makes flowers that wilt into spores.
- **The ironworks of outcasts at the forest's edge, women at the great bellows**: the **Clinker**, a smelter camp
  whose bellows are pumped by a dance class (good cardio); kind, proud, and cutting the forest down.
- **The spirits' bathhouse (a contract that takes your name, soot sprites hauling coal, a guest full of junk, gold
  that turns to mud)**: the **Steamhouse**: shifts pay in **tags** (wooden bath tags, its own coin); the clerk writes
  your name shorter each shift; puffballs carry charcoal; a silent guest pays in gold that is mud by morning.

## Look & sound

- **Palette:** teal-indigo moss, cyan haze and fungus glow, violet stalks and shadows, rose caps and gills, gold
  spirit lamps and tags; pink kept for rage (grazer eyes) and the sickly regrowth after fire.
- **Ground:** haze layer: ground (moss) ~45%, tall grass (spore reeds) ~20%, tree (fungus stalks) ~15%, bush
  (puffballs) 5%, flowers by clickers, dark pools, bridge (fallen stalks). Under: sand ~60%, rock, pillar, water.
- **Light:** under the caps always dusk, caps lit cyan and rose from below, sun only in clearings and on ridges;
  night brighter than day; the Steamhouse a gold block of light seen from far off.
- **Music:** a slow breathing synth over a wooden click rhythm; the Steamhouse a busy waltz with steam hisses.
- **views:** `iso` and `classic` (the forest floor is flat enough; caps read as canopy from above).

## Procedural recipe

Regions are 48×48 tiles, each with an Under map of the same size below (joined by clean wells). A realm is 3×3 to
4×4 regions: the Steamhouse in the centre, the Clinker in the edge region nearest the realm's entry.

- **Heights:** band 0 ravines with pools (noise valleys, 1–3 wide), 1 forest floor, 2 ridges (ridged noise > 0.7).
- **Groves:** poisson-disc stalks (radius 1–3, gap ≥3), each with a cap 2× its width that shades and, where it
  touches a ridge, is walkable at band 2 (cap bridges). Spore reeds fill gaps; puffballs on grove edges.
- **Haze:** density 0–3 per tile, high in groves, 0 on ridges and in the Under; drifts a tile downwind every 20 s;
  the mask drains at ≥2. **Grazer trails:** flow lines from water to ridges carved as path; herds of 3–6 on them.
- **Under:** cave noise under band 1, white sand, stone-tree pillars, 2–4 clean pools; clean wells (stairs in a
  ring of flowers) join the layers.
- **Per region:** 1 herd, 2–3 clean wells, 1 clicker clearing, 2–4 shed shells, a windmill hamlet in half the
  regions, a shellyard in 1 of 3; the boss grove in the region farthest from the Clinker.
- **Region health 0–3:** from distance to the Clinker, fires set, and foes killed rather than calmed. It sets
  clickers (0, 2, 5, 9), haze level, palette (pink regrowth at 0, clean cyan at 3) and whether the herd starts pink;
  it rises by one each dawn a region goes without a fire or a kill.
- **Rare:** a sapling in the Under that is not fungus at all (heart container); a white grazer (calm only); a lost
  Steamhouse spirit by a pool; an old arcade cabinet half-buried in a ravine (from town, somehow).

## Folk

- **Bath clerk**: shortens every name. `SIGN HERE. NO, SHORTER.`
- **Boiler spirit**: tall, tired, too many jobs. `COAL'S LATE. THE PUFFS ARE ON BREAK.`
- **Clinker forewoman**: took everyone in. `THE TOWN SAID NO. THE FIRE SAID YES.`
- **Bellows dancer**: aerobics instructor. `AND LEFT, AND PUMP, AND SMILE!`
- **Windmill keeper**: lives on wind. `WIND'S UP. THE HAZE STAYS DOWN THERE.`
- **The silent guest**: tall, paper mask, pays. `(IT HOLDS OUT GOLD. IT SMELLS OF MUD.)`

## Foes

- Reused: **bat** (spore moths), **blob** (mould blob, splits once in haze), **spitter** (puffball; reflect it).
- **Grazer** (new): never attacks while cyan; turns pink when it or a herd-mate is hurt or burnt; a pink grazer
  charges in a line. Calm it to cyan and it sheds a shell.
- **Burstcap** (new): struck in melee, bursts into a 3×3 haze cloud for 4 s; hit it from range, or calm it.
- **Slag hound** (new, a hound of Clinker scrap): circles and lunges; fungus dies where it walks; cannot be calmed.
- **Boss BLOOM**: the forest's god, gentle and vast, a slag nail in its side, growing faster than it can think. In
  its grove it blooms rings of tiles that wilt to haze a moment later. It can only be calmed: the hum-reed at a
  bloom's end makes it kneel, and the hook pulls the nail.

## Mechanic hook

Fights are the real-time ones; what stands in the land is in [`atlas.md`](atlas.md), "The lands".

## Quest hooks

- **Your name, in full:** three shifts and the clerk has you at one letter; the lost spirit knows the rest.
- **The muddy guest:** clean the junk spirit; its arcade cabinet goes back to the town arcade as a new game.
- **A sail for the mill:** a hamlet's windmill is broken and the haze is climbing; bring a shed shell.
- **The filter chimney:** three shells and clean Under sand, and the Clinker stops feeding the forest (health 2).
- **The nail:** with BLOOM calm, bring its nail to the forewoman; she melts it into the hero's next tool.
- **Cross-realm, clean seed:** the Under's sapling drops a seed the Stillsand Tender is waiting for.
- **Cross-realm, ore:** the chimney saves the forest but cuts the Clinker's wood; the forewoman sends you to a stone
  realm (Lumenby Quarry, pickaxe) for ore and coal, so the camp can work without felling a stalk.

## Art needs

- Ground: moss, spore reeds, puffball bush, glow flowers, dark pool with spore film, fallen-stalk bridge.
- Fungus stalks and caps at three widths (lit from below, casting shade); cap-bridge tops; drifting haze overlay
  at three densities; mask meter; clean well (flower ring, stairs); Under sand, stone-tree pillars, clear pool.
- Grazer (walk, graze, eyes cyan/pink, charge, shed shell); burstcap (walk, burst); slag hound; clickers (idle,
  head-click, pointing line).
- Steamhouse (desk and register, boiler room, baths), tags, puffballs with charcoal; Clinker smelter, bellows
  platform with dancers, chimney (before/after); windmill hamlet and sail.
- Hum-reed spin; mud spirit and its junk; river spirit.
- BLOOM (standing, kneeling, blooming ring, nail in and pulled, calm and walking off).
