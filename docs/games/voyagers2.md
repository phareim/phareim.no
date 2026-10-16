# Rex & Nova: Space Voyagers II — Heart of the Oven

A Wing Commander III–style cockpit space-combat campaign at `/?theme=voyagers2`, in the
SPACE VOYAGERS cabinet since 2026-10-16 (Space Voyagers I, `galaga`, is parked). Written
2026-10-16 from Petter's brief ("the Galaga port fell short gameplay-wise … closer to the
absolute banger Wing Commander 3, still retro-future 80s, the two of them in one ship").
What the game is: `themes/voyagers2/DESIGN.md` (it wins where this file disagrees). This
file says what is built and where.

## Files

| File | Job |
|---|---|
| `themes/voyagers2/DESIGN.md` | The design: world, the two seats, flying, guns, missiles, damage, enemies, the wing, a sortie, the campaign, the picture, the cockpit, controls, tuning targets |
| `themes/voyagers2/Landing.vue` | The title (server-rendered): new campaign or continue, who you are. Loads `Campaign.vue` on the tap that leaves it, so `/` carries the title alone |
| `themes/voyagers2/Campaign.vue` | Everything after the title: act cards, the hub, a sortie (`Game.vue`, mounted only while one runs), the debrief, the ending, the Hall of Fame (`voyagers2`, the campaign's score, once at the end). The save: localStorage `voyagers2.save` |
| `themes/voyagers2/Hub.vue`, `roomSpots.json` | The Deep Dish between sorties: three rooms (pictures with the crew in them; the boxes of who and what can be tapped come from the art lab's `rooms.json`), the faces to tap under them, the talk box with choices, Nonna's briefing, the chalkboard route, the killboard, Babs on the TV |
| `themes/voyagers2/Game.vue` | A sortie: the canvas, the 60 Hz clock, keys and thumbs, the comms, sounds, the radio's intensity, the debug hook |
| `themes/voyagers2/audio.ts` | One-shots made by Web Audio |
| `themes/voyagers2/engine/` | The simulation, pure and seeded, one `step()` a tick (below) |
| `themes/voyagers2/story/` | `cues.ts`, `lines.ts`, `director.ts`, `glue.ts` (the comms in flight); `hub.ts` (briefings, talks, choices, debriefs, horoscopes, endings) |
| `themes/voyagers2/render/` | `index.ts` (the frame), `scene.ts` (three.js), `toon.ts` (four tones, the outline), `models.ts` + `shapes.ts` (every ship in code), `hud.ts`, `dash.ts`, `layout.ts`, `palette.ts`, `pix.ts` |
| `public/voyagers2/*.png` | The art lab's bitmaps (`scripts/voyagers2-lab/art/`, never edited by hand): portraits, the title card, act cards, endings, rooms, sky pieces, mascot faces and heads |
| `scripts/voyagers2-lab/shot.mjs` | Pictures, the touch check (a negative finger identifier drags the stick; PASS or FAIL), and the campaign screens (`act`, `hub`, `talk`, `debrief`, `strike`) |
| `scripts/voyagers2-lab/tune.mjs` | The tuning table: `node scripts/voyagers2-lab/tune.mjs all 4` |
| `scripts/voyagers2-lab/REPORT-art.md` | What the art jobs ordered, shipped and left for Petter to judge |

## The engine

| File | Job |
|---|---|
| `math.ts`, `rng.ts` | Vectors and quaternions (three.js's axes: nose down −z); the seeded generator |
| `types.ts`, `balance.ts` | The shapes of things; every number |
| `flight.ts` | How a ship flies, and `steerTo` |
| `ships.ts` | Spawning (a big ship's guns are ships of their own, fixed to it), damage (shield, armour by side, core; a big ship as one pool; a torpedo pierces shields), kills |
| `guns.ts` | Nose guns with the aim help, turrets, bolts (swept hits; a gunproof hull only sparks; torpedoes can be shot down) |
| `missiles.ts` | Locks, seekers, darts, the Calzone's torpedoes (5 s lock on a big ship), the hound's (7 s), decoys |
| `ai.ts` | Every pilot that is not the player; aces run when wrecked |
| `seats.ts` | The two seats |
| `missions.ts` | The ten sorties as data: nav points, waves, convoys, big ships parked at a nav point, scripted events, the goal |
| `world.ts` | The world and `step`: nav points, the autopilot (it refills shields), landing, solid hulls, goals judged at the landing, the script (Hans defects, Hans comes back, the duel's escorts leave, help arrives), launchers |
| `campaign.ts` | The tree (two deciding sorties, two endings: eight ways through, always eight sorties), the save, sortie titles |
| `bot.ts` | The test pilot: CLUMSY (keys), CASUAL, SHARP |

## The campaign

| Act | Sortie | Goal | What it is |
|---|---|---|---|
| 1 | FIRST SHIFT | patrol | three nav points; a bomber on the Deep Dish at home |
| 1 | CONVOY | protect (one of two haulers home) | raiders go for the haulers |
| 1 | OVEN UNDER SIEGE (decides) | defend (the Deep Dish keeps 55 %) | three waves of hounds; they need 7 s to lock |
| 2 | TAKE-OUT (won) | kill the OUTLET | turrets, then two torpedoes |
| 2 | SPILLED SAUCE (lost) | protect Ridley's tug | the autopilot is ambushed |
| 2 | HANS SHOT FIRST | patrol | Hans Duo defects at nav 2 and runs when beaten |
| 2 | THE DARE (decides) | duel | Prince Parmesan; his escorts leave after 12 s; he runs when beaten |
| 3 | THE BUFFET (won) | kill the BUFFET | six turrets, it launches rats, three torpedoes |
| 3 | LAST SLICE (lost) | survive 3 min, the Deep Dish keeps half | then Marge's rigs come and the Franchise runs |
| 3 | HEART OF THE OVEN | kill the VENT, the sortie ends with it | the Hut, its guns, the prince; Hans comes back at 25 s |

Between sorties: the hub (Nonna's briefing first), talk choices that move the crew's morale
(the wing's skill, a quarter of the difference from 0.6) and the partner's mood (kept, not
yet used in flight), the debrief, an act card when an act begins, the ending (won: DELIVERED;
lost: FRANCHISED) and the Hall of Fame.

## The picture

three.js draws the view into a canvas one logical pixel a pixel (about 240 across on a phone
held upright, 262 rows on a wide screen); the frame goes onto the page's canvas at a whole
number `n` of device pixels a logical pixel, with no smoothing (`render/layout.ts`). Models
are flat faces in four tones a material, the outline is one ink pixel from the depth buffer,
colours are not colour-managed. Fighters are drawn 2.2 times their hit sphere's size (`VIS`),
so a fight at a few hundred metres fills the view.

## The debug hook

`/?theme=voyagers2&debug=voyagers2`, during a sortie, gives `window.__voyagers2`: `world()`,
`state()`, `seed(n)`, `bot('clumsy' | 'casual' | 'sharp' | null)`, `hold()`, `run()`,
`step(n)`, `auto()`, `swap()`, `menu(on)`, `touch(on)`, `invert(on)`, `end(won)` (the
sortie ends now: the lab's way to the debrief).

## Pictures and checks

    npm run dev
    node scripts/voyagers2-lab/shot.mjs [baseUrl] [scene,scene@size…] [outDir]

Scenes: `title`, `launch`, `fight`, `fight2`, `turret`, `menu`, `auto`, `home`, `touch`, `act`,
`hub`, `talk`, `debrief`, `strike`; sizes `p844` (390 × 844 at 3x), `p664` (Safari with its
bars), `phone` (375 × 667 at 2x), `wide` (1280 × 800). On Sleeper the browser needs WebGL on
the CPU: a `CHROME_BIN` wrapper that runs `chromium-browser --use-angle=swiftshader
--enable-unsafe-swiftshader`, through `heavy -x chrome`. Never against phareim.no or a
preview: the ending posts a score.

## Tuning (2026-10-16, bots, 4 to 6 seeds a sortie)

| Sortie | CLUMSY | CASUAL | SHARP |
|---|---|---|---|
| FIRST SHIFT | 4/4 | 4/4 | 4/4 |
| CONVOY | 4/4 | 4/4 | 4/4 |
| OVEN UNDER SIEGE | 5/6 | 4/6 | 4/6 |
| TAKE-OUT | 4/4 | 4/4 | 4/4 |
| SPILLED SAUCE | 4/4 | 4/4 | 4/4 |
| HANS SHOT FIRST | 4/4 | 4/4 | 3/4 |
| THE DARE | 0/4 | 2/4 | 4/4 |
| THE BUFFET | 2/4 | 3/4 | 3/4 |
| LAST SLICE | 6/6 | 6/6 | 6/6 |
| HEART OF THE OVEN | 1/6 | 4/6 | 5/6 |

The bots never shoot torpedoes down and never taunt a bomber off; a person can. What moved
the numbers: fights at a few hundred metres, breaks long enough to turn onto a tail, aim help
of 2.5° on keys and 6° on touch, slow shields, the bubble's twin guns going for what chases
the Calzone, decoys that work (a seeker hits only what it chases), torpedoes that pierce
shields, solid hulls, shields refilled by the autopilot, the hound's long lock.

## Tests

`npm run test:voyagers2`: the arithmetic; the engine (determinism, flying, steering, damage,
guns, missiles and decoys, the seats, the back seat's gunnery, a sortie, ejection, landing,
every bot home from FIRST SHIFT); the words (every line fits, seat cues in both voices, every
portrait on disk), the director's seat rule, the layout on nine screens; the campaign (the
tree, the save, every sortie's words, each kind of goal won by the bot, Hans's defection, the
finale ending on the vent with the Hut never a target, help arriving).

## Open

- Nobody has played it with hands, heard it, or held it on a phone (2026-10-16). The first
  sortie has been live since the afternoon of 2026-10-16 for that.
- The partner's mood is kept but changes nothing in flight yet; the SUGAR CRASH, the systems
  damage list and the slide of DESIGN.md are not built.
- The mascot bear and rat may sit too close to Freddy Fazbear and Chuck E. Cheese
  (`scripts/voyagers2-lab/REPORT-art.md`): Petter's call.
