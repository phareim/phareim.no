# SETER FELL

The last week of summer on the high mountain pasture. Every seter on the fell is full: dairymaids calling the cows
home over the heather, cheese on the shelves, cowbells in the birches. On Moving Day the folk walk the herds down to
the valley, and that evening the Hidden Folk move into the empty huts, as they do every autumn. This year the trolls
who sleep as hills are waking before dark, a three-headed one has taken the big seter's best cow, and the hero has
five days to dig, build and call the fell back into order before the doors close for winter. Cosy by day, uncanny at
dusk, and the low sun is a weapon.

## Inspiration

- **Seter life** (the Norwegian summer farm, UNESCO-listed 2024): herds moved up to outlying pasture, a dairymaid
  (budeie) in charge, kulokk herding calls that carry for kilometres. *Here:* the hero gets a **call** button (a
  rising square-wave yodel) that brings cattle, wakes NPCs and is the "ask first" of dig & build.
- **Moving Day and the Hidden Folk**: they claim the seter in autumn and anyone who stays past moving day angers
  them; you warn the folk under the hill before throwing water out; a byre whose muck dripped into their sitting
  room had to be moved. *Here:* a five-day realm clock, and mounds (haug) with tusse homes under the soil.
- **Kittelsen's trolls as landscape**: trolls that are forest and mountain, trees on their backs, the troll who
  wonders how old he is. *Here:* "troll humps", generated hills with a nose rock and birches on the back that stand
  up at dusk. Sunlight turns them to stone, and the iso view's low, shadow-casting sun makes that a puzzle.
- **The trolls of the Hedal wood** (Asbjørnsen): three trolls with one eye between them, used in turns; the boys
  steal the eye. *Here:* the boss's single eye is routed between three heads.
- **Huldra manners**: a lovely woman whose cow's tail slips out at awkward moments; never mention the tail (a
  tactful lad praised her long plait instead); steel holds her folk and their cattle. *Here:* a seter neighbour
  with a swishing tail; the dialogue choice that names it shuts her door for a day.
- **The nisse's butter**: given porridge at Yule and finding no butter, he kills the best cow, then finds the butter
  hidden at the bottom and fetches the neighbour's cow to make amends. *Here:* a mystery quest, nobody dies.
- **Soria Moria shimmering like gold** (Kittelsen), nearer, then further away: a rare receding gold glow. **Over the
  Garden Wall's** autumn wander (tone only), travellers who give up become the forest: the **Sitters**, half moss.

## Look & sound

- Palette: **gold** birch crowns and lamp windows, **rose** heather and lingonberry slopes, **violet** fell stone and
  dusk, **cyan** tarns and the first frost, **pink** troll eyes and the Hidden Folk's lanterns.
- Ground mix: heather (flowers) 30 %, turf (ground) 25 %, tall grass 15 %, rock/scree 15 %, bog water 8 %, tree 7 %.
- Light: long gold afternoons with the sun very low; a long violet dusk; at night only seter windows, troll eyes and
  lantern cairns. Each of the five days ends a little earlier.
- Music: a slow drone on one held fifth, a kulokk-like melody on top that answers the hero's call.
- `views:` iso, classic (the plateau reads well flat; troll humps keep their nose rock).

## Procedural recipe

- **Region** 64×48 tiles; 6–9 regions per realm joined by cairn paths; seed fixed per save.
- **Height bands** (0–4, 2-octave value noise tilted so one edge is low): 0 valley birch wood (tree, bush, tall
  grass, river), 1 slopes (heather, switchback path), 2 vidda plateau (turf, rock, tarns), 3 scree and cliff,
  4 snowfield cap (≤ 1 per region, new tile `snow`).
- **Water**: tarns as noise blobs on band 2 (2–5 per region, 6–40 tiles); bog = water rimmed with tall grass; one
  river per two regions steps down band by band, a waterfall at each cliff, a bridge where the path crosses.
- **Generators**: *seter cluster* (3–6 turf-roofed huts round a meadow, stone fence ring, milk trough, 2–6 cows);
  *troll hump* (oval of rock, nose rock facing the valley, 1–3 birches on the back; one in three wakes at night);
  *haug mound* (round grassy bump, half with a 5×4 tusse room one layer down); *cairns* every 10–14 tiles on paths,
  a lantern cairn at each junction; *stone fences* as 6–20 tile random walks between seters.
- **POIs per region**: seters 1–2, troll humps 2–4, mounds 4–8, Sitters 0–2, shieling ruin 0–1, peddler camp 0–1;
  per realm one troll hall (the boss).
- **Moods per region**: *birch* (more valley, more cows), *high* (bands 3–4, few people), *bog* (tarns join into a
  mire with boardwalks), *stone* (troll humps ×2, ore veins in the rock).
- **Rare**: the receding gold glow (1 per realm); a troll hump with a whole birch wood on its back (1 in 3 realms);
  a huldra cattle pen of gold-belled cows behind a steel-scratched ring (1 per realm).

## Folk

- **Budeie** (dairymaid): loud, kind, short of time. "THREE COWS MISSING. FIVE DAYS LEFT."
- **Tail-neighbour** (huldra): lovely, sly, changes the subject. "LOVELY EVENING. DON'T LOOK DOWN."
- **Tusse elder**, under the mound, grey and fussy. "SOMEBODY DUG INTO MY PANTRY."
- **Ash-heap lad**, youngest brother, pockets of junk. "FOUND A STONE THAT SQUEAKS. WANT IT?"
- **Barn nisse**: red cap, short fuse. "NO BUTTER. NO BUTTER! NO..."
- **A Sitter**, half moss, in no hurry. "I'LL WALK ON. TOMORROW. PROBABLY."
- **Cairn-keeper** maps the fell in stones. "THE GOLD LIGHT? IT WAS EAST. NOW WEST."

## Foes

- Reused: **blob** (moss blobs in bogs), **bat** (dusk, troll caves), **hound** (fell wolves round the herds at night).
- **Hump troll** (new): a hill by day; at night it stands and walks toward light and noise, breaking fences; caught
  in a sunbeam it turns to stone for good and becomes a minable troll-stone rock.
- **Tusse** (new): pops out of a mound dug into or built on without a call first and throws turf; leaves if fed.
- **Lemming run** (new): a line of 6–12 lemmings that runs straight, ignores the hero, pours off cliff edges, and
  shoves (and nicks) whoever stands in its way.
- **Boss: MIXTRAL**, Mistral's big cousin, a three-headed fell troll in the troll hall: "THREE EXPERTS. ONE EYE."
  The single gold eye is **routed** to one head at a time and flies between sockets; only the seeing head aims. Hook
  or disc the eye mid-flight and all three are blind and smash toward the hero's call, through the hall's walls;
  break the east wall before dawn and the first beam ends it.

## Mechanic hook

**Dig & build** (shovel, pickaxe, axe and hammer, all found on the fell), with folk manners:
- **Ask first.** Dig or build near a mound without calling and a tusse comes up angry and the nearest seter's milk
  turns. Call first and a voice answers from below: yes, or "not there, that's our chimney".
- **"Let the dawn in"**: an awake troll guards a ridge path. The sun rises low from the east and its shadow map is
  real: cut a notch in the ridge (pickaxe), fell the birches (axe) or pull down a fence so the first beam reaches
  the troll. Each region's sun angle is fixed and can be watched at every dusk.
- **"The byre on the roof"**: a seter barn stands on a tusse home and leaks into it. Take it apart plank by plank
  (hammer) and rebuild it on flat turf 4+ tiles away; the tusser lend the huldra herd for the move.

## Quest hooks

- **Three cows** strayed before Moving Day (one grazes on a sleeping troll's back): find them, call them home.
- **The nisse's butter**: he says it is missing and he means to take it out on the cow. Look in the bowl. He brings a
  cow back from the next seter by way of sorry.
- **The receding glow**: whoever walks away from the gold light along the cairns finds it behind them, near.
- **Moving Day**: on day five the folk walk down in procession; a hero still on the fell spends a lantern-lit night
  among the Hidden Folk in the full huts until dawn.
- *Cross-realm*: the **tail-neighbour** wants to be wed under a church bell that rings; there is none up here (the
  stave church of YULE FJORD has one, cracked).
- *Cross-realm*: **the Eye**, Mixtral's gold eye, kept after the fight: worn, it shows hidden folk, mounds and hidden
  doors in any realm.

## Art needs

- Tiles: heather, turf, bog, scree, snow, tarn edge, waterfall step, boardwalk, stone fence, cairn, lantern cairn.
- Props: turf-roofed seter hut (door open/shut, lit window), milk trough, cheese shelf, haug mound (plain / with a
  tiny door), troll hump asleep (nose rock, birch slots), troll-stone rock (minable), the gold glow.
- People: budeie, tail-neighbour (tail in two frames), tusse elder, ash-heap lad, barn nisse, a Sitter (mossy).
- Animals: cow (walk, graze, gold-bell variant), lemming (run, fall).
- Foes: hump troll (rise, walk, smash, to stone), tusse (pop up, throw), MIXTRAL (three heads, eye in flight, blind
  stomp, stone). Effects: the call (sound rings), dawn beam, dig dust, soured-milk puff.
