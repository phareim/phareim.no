# FOGSTAGE

Below the cliffs south of the coast lies a lowland drowned to the knees of its hills in pink stage fog. In the
fog everything happens on cue: foes and folk wait their turn, step forward, act and step back, so this is where
the field battles live. The hilltops stand out of the fog like islands, each a small town with a ticket booth,
and a patched touring blimp, the RAINCHECK, moors at a different hill every night to play the same musical.
Tonight it cannot finish: something came up through a stage trap and stole the last act, and the fog is rising.

## Inspiration

- **FFIX's Mist, which blankets the lowlands and stirs a fighting instinct in whoever breathes it**: here the fog
  is why fights turn into turns. Inside it every body waits for its cue (the ATB gauge); above the fog line it is
  real-time Zelda play again. One rule the player can see: the fog's edge on the ground.
- **FFIX's mist engines and its theatre ship run by a troupe of thieves**: fog engines (bellows and tanks) fill
  the RAINCHECK's lift bags; its cast act by night and pick pockets in the interval (bits only, given back if you
  catch one from behind).
- **FFIX's village of made mages who copy town life from a book and bury those who "stop"**: the Understudies'
  Hollow, wind-up puppet extras made for a show that never opened. They run an inn and a shop from a script and
  stand stopped friends in "the wings", keys hung on nails. Gentle, not grim: a new spring wakes one.
- **FFVI's opera, the singer who must pick the right lyric, and the timed dash through the rafters while a weight
  hangs over the stage**: the dungeon is the FLY LOFT (catwalks and rope lines above the RAINCHECK's stage),
  sandbags drop along rope rows, and the boss sings lines with a word missing.
- **Secret of Mana's cannon travel**: star traps (the stage trapdoor that pops an actor up through the floor) on
  the hilltops fling the hero to the next hill in a 1.2 s arc over the fog.
- **The theatre ghost light** (a bare bulb left burning on an empty stage, a real custom): a lone lamp in the fog
  is a continue point and a pool where no battle starts.

## Look & sound

- Palette: **rose** fog (alpha 0.55, 0.8 in hollows), **violet** hills and cliffs, **gold** footlights on every
  cliff lip, **cyan** rigging and ropes, **pink** danger and cue rings.
- Ground mix (lowland): ground 45 %, tall grass 20 %, water 10 %, path/bridge 10 %, rock 5 %, flats 5 %, lamp 1 %.
- Light: footlights from below on the cliffs, fog lit pink from within, the blimp's searchlight sweeping a hill.
- Music: a slow waltz on a detuned theatre organ; on a cue the same bar adds kettle drums and a synth bass.
- `views: iso` (the fog is a volume and needs height; it does not read flat).

## Procedural recipe

- **Size**: 160×120, 12 regions of 40×40; value noise (scales 24/8, weights .75/.25), 0–3 plateaus (r 6–10, +0.3).
- **Bands**: h < 0.22 water (fog ponds); 0.22–0.52 fog lowland (battles on); 0.52–0.62 cliff, a lamp every 4 tiles
  along the lip; h > 0.62 hilltop (no fog).
- **Hill towns**: each hilltop of ≥ 60 tiles (cap 6): a ramp cut on its lowest side, 3–6 buildings on a 5-tile
  grid, a ticket booth (building + sign) at the ramp head, a fog engine prop, flowers between doors.
- **Boardwalks**: an MST over the ramp heads (path; bridge on water), +1 loop edge per 3 towns, reeds cleared.
- **Features**: reed beds (tall grass blobs of 8–30 tiles, 2–4 per region); scenery flats (3–5 tiles of fence with a
  painted sign: castle, moon, ship; 1–2 per region; block lines in battle); trap floors (3×3 planks hiding a
  Prompter, 0–1 per region); star traps (1 per town, aimed at the nearest town).
- **POIs per region**: 3 encounter groups (2–4 foes, never within 6 tiles of a ghost light); 1 chest; 1 libretto
  poster (8 words in 8 regions); 1 ghost light (75 %); a town on every other region on average.
- **Uniques**: the Understudies' Hollow (the lowest basin, cliff-ringed, fanned clear of fog); Rehearsal Row (the
  largest hilltop); the RAINCHECK and 4 masts (the 4 towns farthest apart; it moves on each time the hero rests at
  an inn); the FLY LOFT, boarded from whichever mast holds the blimp; one stopped Understudy lying in the fog.
- **Rarities**: a golden ticket (5 % of chests: the VIP box aboard, a heart piece); a fog-whale shadow (10 % of ponds).

## Folk

- **Raincheck cast**, actor-pickpockets in capes: "Lovely show. Check your pockets."
- **Understudy**, a wind-up extra who reads its role off a card: "I'm Villager #3. I have no lines yet."
- **Fog stoker**, sooty and proud of the engines: "Fog's thin north. Something drinks it."
- **Ticket-taker**, in every booth, never the same face: "No ticket? Then you're in the show."
- **Old prompter**, retired, whispers from a bucket: "Psst. The last act went down the trap."
- **Program kid**, sells one-page programs: "Programs! Act three is torn out!"
- **Ghost-light keeper**, a moth-eaten night watchman: "Never let the stage go dark. Never."

## Foes

- **blob** (fog blob), reused: steps toward other blobs; two adjacent ones merge, HP summed (bursts pay).
- **bat** (footlight moth), reused: spreads out, always flies to a lit tile; Fogged does not touch it.
- **knight** (swashbuckler), reused: the shield front takes 0; after a lunge it shows its back for one cue.
- **Sandbag** (new): on its cue a whole row along one iso axis gets a pink shadow; on the next it drops there
  (2 damage). Step out, or have Luna lift it first.
- **Prompter** (new): hides under a trap floor and cannot be targeted; its whisper makes one party member Cueless
  (skips a turn). A bomb or Luna lifting the trapdoor pulls it out (3 HP).
- **Heckler** (new): floating opera glasses; gains 25 % gauge whenever anyone else is hit. Silence it first.
- **Boss: BARD** (the RAINCHECK's stage, 30 HP): a towering prompter's box with a curtain for a mouth, singing the
  stolen act. Every third cue it sings a line with a word gone and a three-word ring opens: the posters' word
  clears the fog (BARD Dazed 6 s, double damage), a wrong one calls a Heckler. Between songs it pulls the fly lines
  (Sandbag rows); below half it swaps the hero's and Luna's places each song.

## Mechanic hook

**Field battles, on cue.** In the fog, touch a foe group (or be touched) and a pink ring closes round the spot: an
arena diamond of radius 4 where you stand. Gauges fill, the four-petal ring opens on whoever is ready, Luna joins
in duos; win and the ring opens out again. Rules: `battle-notes.md`. The fog line is the switch: on a hilltop or
in a ghost light's pool no fight can start. The first boardwalk teaches it (two blobs and a moth), and BARD tests
every part: shapes, positions, duos, status.

## Quest hooks

- **The last act**: find the 8 libretto posters and the trap the thief used (the FLY LOFT), then face BARD before
  the fog reaches the towns (it rises a band each time the blimp moves; cosmetic until the end).
- **Villager #3's spring**: a stopped Understudy lies in the fog; the spare spring is in the fly loft's tool room.
  Wound up, it gets its first line and opens the Hollow's shop.
- **Rehearsal Row** (after FFVI's Zozo, the town of liars): every resident speaks a line from the wrong scene;
  match lines to the scene signs and the ticket-taker's door opens (heart piece).
- **The fog engines**: a Prompter nest under the boardwalks drinks the fog; clear it for a star-trap shortcut.
- **Cross-realm, the rerun**: the stolen act was broadcast; RERUN ESTATES' TV repairman has it on tape, and it
  gives BARD's song its last verse (a fourth word in the ring).
- **Cross-realm, the outing**: the Understudies have never seen a real sunset. After the Sun Prism, walk one to
  Mirror Lake at dusk; the Hollow then plays the organ waltz on the site radio.

## Art needs

- Fog layer (2 densities, soft edge band, 8-frame drift), the fog line on the ground; cliff lip with up-lit
  footlights; ticket booth, fog engine, scenery flats (3), trap-floor planks, star trap (closed/open/launch).
- Rotoscoped bodies: the RAINCHECK (patched lift bags, gondola stage, searchlight) and its mast; BARD (curtain
  mouth, 3 sing frames, dazed, swap effect).
- Folk: cast (2 colourways), Understudy (key turning, stopped), stoker, ticket-taker, prompter, program kid,
  keeper. Foes: fog blob (merged), moth, swashbuckler, Sandbag + rope + row shadow, Prompter, Heckler.
- Battle chrome: arena ring, cue ring, petals, BARD's word ring. Tracks: fog waltz + battle stem; BARD's song.
