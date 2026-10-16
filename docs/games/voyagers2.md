# Rex & Nova: Space Voyagers II — Heart of the Oven

A Wing Commander III–style cockpit space-combat game at `/?theme=voyagers2`, written
2026-10-16 from Petter's brief ("the Galaga port fell short gameplay-wise … closer to the
absolute banger Wing Commander 3, still retro-future 80s, the two of them in one ship").
What the game is: `themes/voyagers2/DESIGN.md` (it wins where this file disagrees). This
file says what is built and where.

**State (2026-10-16): the first sortie, FIRST SHIFT, is playable from launch to landing,
parked** (`disabled: true` in `themes/index.ts`: no cabinet yet, reachable by URL only),
so Petter can judge the feel on his phone before the campaign is built round it.

## Files

| File | Job |
|---|---|
| `themes/voyagers2/DESIGN.md` | The design: world, the two seats, flying, guns, missiles, damage, enemies, the wing, a sortie, the campaign, the picture, the cockpit, controls, tuning targets |
| `themes/voyagers2/Landing.vue` | The title (HTML over `public/voyagers2/card-title.png`, server-rendered), who you are (Rex or Nova), the debrief. Loads `Game.vue` with `defineAsyncComponent`, so three.js ships only with the game |
| `themes/voyagers2/Game.vue` | A sortie: the canvas, the 60 Hz clock, keys and thumbs, the comms, sounds, the radio's intensity, the debug hook |
| `themes/voyagers2/audio.ts` | One-shots made by Web Audio: guns, hits, the lock tone, the klaxon, decoys, the afterburner, the engine hum, the CB click |
| `themes/voyagers2/engine/` | The simulation, pure and seeded, one `step()` a tick (below) |
| `themes/voyagers2/story/` | `cues.ts` (who speaks, every cue and its rule), `lines.ts` (the words), `director.ts` (Space Voyagers I's director with seats), `glue.ts` (engine events to cues) |
| `themes/voyagers2/render/` | `index.ts` (the frame), `scene.ts` (three.js: ships, bolts, missiles, debris, stars, sky, cameras), `toon.ts` (four-tone shader, the outline pass), `models.ts` + `shapes.ts` (every ship made in code), `hud.ts` (the view's marks and effects), `dash.ts` (the dashboard), `layout.ts`, `palette.ts`, `pix.ts` |
| `public/voyagers2/*.png` | Bitmaps from the art lab (`scripts/voyagers2-lab/art/`, never edited by hand): portraits, the title card, sky pieces, the mascots' faces and their heads on springs |
| `scripts/voyagers2-lab/shot.mjs` | The picture tool, and the touch check (a finger with a negative identifier drags the stick; prints PASS or FAIL) |
| `scripts/voyagers2-lab/tune.mjs` | The tuning table: three bot pilots fly a sortie on several seeds |
| `scripts/voyagers2-lab/REPORT-art.md` | What the art job ordered, shipped and left for Petter to judge |

## The engine

| File | Job |
|---|---|
| `math.ts`, `rng.ts` | Vectors and quaternions (three.js's axes: nose down −z); the seeded generator |
| `types.ts`, `balance.ts` | The shapes of things; every number (ships, guns, missiles, turrets, shields, the partner's eye) |
| `flight.ts` | How a ship flies (no drift, turn rates chase the stick, slower turns tighter) and `steerTo` |
| `ships.ts` | Spawning, damage (shield on the side hit, then that side's armour, then the core), kills |
| `guns.ts` | Nose guns with the aim help, turrets, bolts with a swept hit test, hulls as ellipsoids |
| `missiles.ts` | The lock, seekers and darts, torpedoes, decoys (a seeker hits only what it chases) |
| `ai.ts` | Every pilot that is not the player: attack, break, evade, flee, form, escort, strike, nav, and the Calzone's own pilot while the player is on the turret |
| `seats.ts` | The two seats: the partner's turret and decoys, the player's turret, changing seats |
| `missions.ts`, `world.ts` | Sorties as data; the world, `step`, nav points, the autopilot, landing, ejection, the score |
| `bot.ts` | The test pilot: CLUMSY (keys), CASUAL, SHARP; reaction time and aim error, never perfect |

## The picture

three.js draws the view into a canvas one logical pixel a pixel (about 240 across on a phone
held upright, 262 rows on a wide screen); the frame goes onto the page's canvas at a whole
number `n` of device pixels a logical pixel, with no smoothing, the canvas a hair larger than
the screen when the screen does not divide (`render/layout.ts`). Models are flat faces in four
tones a material, the outline is one ink pixel from the depth buffer, colours are not
colour-managed (every tone on screen is a palette tone). Fighters are drawn 2.2 times their hit
sphere's size (`VIS` in `models.ts`) so a fight at a few hundred metres fills the view.

## The debug hook

`/?theme=voyagers2&debug=voyagers2`, after launching, gives `window.__voyagers2`: `world()`,
`state()`, `seed(n)`, `bot('clumsy' | 'casual' | 'sharp' | null)`, `hold()`, `run()`,
`step(n)`, `auto()`, `swap()`, `menu(on)`, `touch(on)`, `invert(on)`.

## Pictures and checks

    npm run dev
    node scripts/voyagers2-lab/shot.mjs [baseUrl] [scene,scene@size…] [outDir]

Scenes: `title`, `launch`, `fight`, `fight2`, `turret`, `menu`, `auto`, `home`, `touch`;
sizes `p844` (390 × 844 at 3x), `p664` (Safari with its bars), `phone` (375 × 667 at 2x),
`wide` (1280 × 800). On Sleeper the browser needs WebGL on the CPU: a `CHROME_BIN` wrapper
that runs `chromium-browser --use-angle=swiftshader --enable-unsafe-swiftshader`, through
`heavy -x chrome`. Never run it against phareim.no or a preview: it ends sorties.

## Tuning (2026-10-16, FIRST SHIFT, 8 seeds)

| Bot | Won | Flying | Kills: front / back seat / wing | Hull left |
|---|---|---|---|---|
| CLUMSY | 8 of 8 | 2.5 min | 10.3 / 4.1 / 1.6 | 98% |
| CASUAL | 8 of 8 | 2.6 min | 12.0 / 2.5 / 1.3 | 96% |
| SHARP | 8 of 8 | 2.5 min | 12.1 / 2.0 / 1.9 | 98% |

The first sortie is meant to be gentle. What got it there: fights closer (breaks of 800 m),
a break long enough to turn onto the enemy's tail, the aim help at 2.5° on keys and 6° on
touch, shields that come back slowly (6% a second after 3 s), the Calzone's bubble firing its
twin guns at what is chasing it, and decoys that work.

## Tests

`npm run test:voyagers2`: the arithmetic; the engine (determinism, flying, steering, damage,
guns, missiles and decoys, the seats, the back seat's gunnery, a sortie, ejection, landing,
every bot home from FIRST SHIFT); the words (every line fits, every seat's cue has Rex and
Nova, every portrait is on disk), the director's seat rule, and the layout on nine screens
(a whole number of device pixels, no bars, the dashboard above the bottom band, the thumb
buttons on the view).

## Open

- Nobody has played it with hands, heard it, or held it on a phone (2026-10-16).
- Only FIRST SHIFT exists: the Deep Dish's rooms, the other nine sorties, the tree, the
  wingmen beyond Dougie, the strikes and the duel are designed, not built.
- No Hall of Fame board and no cabinet until it leaves the parking lot; Space Voyagers I keeps
  the SPACE VOYAGERS cabinet meanwhile.
- The mascot bear and rat may sit too close to Freddy Fazbear and Chuck E. Cheese
  (`scripts/voyagers2-lab/REPORT-art.md`): Petter's call.
