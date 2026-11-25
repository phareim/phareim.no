# THE UNDERGLOW

Where does the sun go when it finally sets? Down. Behind Lumenby's deepest drift the rock opens onto a
round shaft so wide the far wall is a rumour, lit from below by a second, smaller sun. Around its rim a
delvers' club sells glowsticks by rank and keeps a wall of names that never came back up. Going down is
easy: ledges, slides, holes, a jump. Coming back up is the problem, because the deep pulls at whoever
climbs. Six layers, each stranger than the last, from echoing miners' ledges to a forest that hangs from
the ceiling, a sea under an aurora, a layer where the radio talks back, a graveyard of fossil arcade
cabinets, and at the bottom the Sun Below itself.

## Inspiration

- **Made in Abyss's layers and the curse of ascending** (symptoms grow with depth: dizziness, then numbness,
  then hallucinations): here climbing a layer boundary on foot gives *the Pull*, gentle and playable: a
  greyed heart per layer climbed, and from layer 3 up the screen fills with static and a signpost may lie.
  Down is always free.
- **Made in Abyss's whistle ranks** (a cave raider's colour says how deep they may go): the Delvers' Club
  hands out glowsticks in the game's own tones: rose, pink, cyan, violet, gold. A turnstile at each layer
  only reads your colour. Rank up by bringing a relic back up.
- **Made in Abyss's inverted forest** (updrafts from below make the second layer grow upside down): the
  Upside Grove: crowns hang down, roots up, dropped bits float to the ceiling, and its shadows fall upward.
- **Journey to the Centre of the Earth**: the Hansbach (Hans taps a river from the rock and saves them) is the
  descent's water: a cyan stream that follows you down every layer, and a canteen refill point. The
  aurora-lit underground sea crossed on a raft of petrified wood becomes the Glass Sea, crossed on a raft
  you build. The giant herdsman tending mastodons is a gentle giant tending a herd of wandering jukeboxes.
  The eruption that throws them out at Stromboli is the Geyser: the way home from the bottom.
- **Spelunky's Tunnel Man** (pay bombs, ropes and cash over runs to dig a shortcut): Lift Lady Rut rebuilds
  one lift per layer if you bring that layer's own material; once built, the lift beats the Pull.
- **Dwarf Fortress's "dug too deep"** (adamantine pillars through the magma sea, a breach that wakes
  something): the gold vein at the bottom is the Sun Below's own root; mine it and the boss wakes.
- **Stranger Things' Other Side** (the game's own lore): layer 4 is where Horizon's static rises from.

## Look & sound

- Palette per layer, darker and more saturated going down: 1 **violet** stone and **gold** rail lamps;
  2 **cyan** and **pink** upside canopies; 3 **cyan** water under a **violet**/**pink** aurora; 4 grey static
  with **cyan** crystal masts; 5 **rose** bone and **gold** cabinet marquees; 6 white-**gold** core light.
- Ground mix: ledges and slopes 50 %, the shaft's lip 10 %, water 15 % (sea layer 50 %), props/POIs 25 %.
- Light: from below (the Sun Below), every shadow cast up and out. Music: one theme, a semitone lower per layer.
- `views: iso` (the descent is heights, and up/down is the story).

## Procedural recipe

- **Shape**: each layer is its own map, 72×72, a ring around a central shaft (radius 10–14, impassable
  void: walking in = a fall to the next layer's landing ledge, half a heart). Six layers, seeded per world.
- **Heightmap**: a spiral. Height = `4 - floor(((angle / 2π) + ring) * 5) mod 5` gives ledges stepping down
  clockwise; add noise ±1 then clamp 0–4. Height 0 at the shaft lip is the layer's floor. Each layer has
  2 *drop holes* (height 0 pits off the spiral, 1 tile) and 1 *slide* (a 6-tile chute): both one-way down.
- **Materials by layer** (diggable top blocks; shovel and pickaxe work here, but digging only goes down):
  1 stone, timber from old props, lumen; 2 root-wood, glowshroom; 3 petrified wood (raft), sand, glass;
  4 static crystal (breaks only with the chrome pick); 5 bone (light, strong); 6 sunstone, gold vein.
- **Caves**: per layer 3–5 side chambers (interior rooms, 16×12, a 2×2 Spelunky grid) cut into the outer
  wall at height ≥ 2, holding the relics. The Hansbach runs as a 1-tile stream from the outer wall to the lip.
- **POIs per layer**: 1 lift stub (Rut's job), 1 camp (bench + lamp: rest clears the Pull), 1 turnstile
  at the landing, 2–3 relic chambers, 1 signpost (on layers 3–5, 1 in 3 lies), 1 heart piece on layers 2/4.
  Layer specials: 1 *Echo Ledges* (old rails, a lost miner); 2 *Upside Grove* (float zone: things dropped
  rise to a ledge 1 higher); 3 *Glass Sea* (a sea of 4–6 islands; build a raft at the shore); 4 *Broadcast*
  (3 masts to tune); 5 *Fossil Arcade* (6–9 cabinets, the herdsman); 6 *the Core* (arena, Geyser).
- **Variation**: relic tables per layer, with rarities: common trinket 60 %, recipe 25 %, rank relic 12 %
  (exactly one guaranteed per layer), "white" relic 3 % (cosmetic, a story line).

## Folk

- **Mother Mag**, runs the Delvers' Club, mends glowsticks and kids. *"Rose stick. Rose ledge. Home by tea."*
- **Rut**, the Lift Lady, builds with what you bring. *"Bone? Lovely. Bone lifts sing."*
- **Hanna**, a guide who says one word at a time, refills your canteen. *"Down."*
- **Sigge**, a rose-stick kid who wants to go deeper than he may. *"I've been to two. Nearly."*
- **Bror Gunn**, Lumenby's lost miner on layer 1, can't climb any more. *"Tell my sister the rails hold."*
- **The Herdsman**, a gentle giant on layer 5 with a herd of jukeboxes. *"They only play when fed coins."*
- **Echo**, on layer 4, a voice that sounds like whoever you last talked to. *"Did I say left? I meant left."*

## Foes

- **bat** (1–2), **blob** (sea shore), **skull** (5, dodges among bones), **eye** (4, watches the masts),
  **zapper** (4, crackles with static).
- **Floater** (new, layer 2): falls upward; it drops on you from the ceiling's point of view, so it rises
  from below a ledge you stand on. Shadows show where it will come up.
- **Mimic hiker** (new, layers 3–5): an echo of the hero that replays your last three seconds of moves.
- **Boss: PHI**, a golden spiral of segments coiled round the Sun Below. Only the segment lit by the
  sun's beam can be hurt, and the beam shines one way; place mirror blocks (the one placeable in the arena,
  you get 3) to bend it onto the coil. Each phase PHI eats a ring of floor and the arena drops one height
  level, carrying your mirrors with it. 16 HP.

## Mechanic hook

The Pull. Every layer boundary climbed on foot greys one heart (layer 3+ also adds screen static and
lying signs) until you rest at a camp. Down is free. Three ways to beat it: rest at camps (slow, and
the hearts come back), build Rut's lifts (one per layer, from that layer's material: a lift ride costs
nothing), or ride the Geyser home from the bottom (it throws you out on the coast at Mirror Lake). Rank
says how deep you may go; the Pull says what it costs to come back, so every trip down is a choice.

## Quest hooks

- **Rose to gold**: a relic per layer raises your stick; Mother Mag's turnstile lets you one layer deeper.
- **Lifts**: Rut needs timber (1), root-wood (2), petrified wood (3), crystal (4), bone (5).
- **The raft**: build a 3×2 raft of petrified wood at the Glass Sea's shore to cross to the far ledge.
- **Feed the jukeboxes**: the Herdsman's herd blocks the bone road until each plays a song (bits).
- **Three masts**: tune layer 4's masts to the right station (hint: Dusty's numbers) to quiet the static.
- *Cross-realm*: bring Bror Gunn's lamp up to Lumenby; Gunn lights the eighth, hidden letter (a heart).
- *Cross-realm*: take Luna to layer 4; she hears Room Eleven's lights and finds the Gate's last seed.

## Art needs

- Six layer tile sets at 2:1 with up-lit shading (light from below), spiral ledge edges and the shaft void.
- Rising particles (bits, leaves) for the Upside Grove; the aurora sky band for the Glass Sea; static overlay.
- Props: lift (stub, built ×5 material skins), camp bench, turnstile, masts ×3 states, fossil cabinets, raft.
- Glowsticks in 5 tones (HUD pip + held in hand), mirror block with beam.
- Foes: floater, mimic hiker (hero recolour), PHI (segments, head, lit state, ring-eating frames).
- Folk ×7; the Herdsman big (3×3 tiles) with a jukebox herd (walk, play).
- The Sun Below (large animated sprite) and the Geyser launch.
