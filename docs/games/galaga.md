# Rex & Nova: Space Voyagers I

The game in the Galaga cabinet, at `/?theme=galaga`. Written again from nothing on
2026-10-13; the old Galaga (the Choir, Claude in the second seat, the Hangar ship) is gone.
The theme id, the Hall of Fame board, the high-score key and the radio's `galaga` origin are
the old ones: only the names changed.

What the game is: `themes/galaga/DESIGN.md` (it wins where this file disagrees). This file
says what is built and where.

## Files

| File | Job |
|---|---|
| `themes/galaga/DESIGN.md` | The design: world, pilots, picture, run, power-ups, sectors, who talks |
| `themes/galaga/Landing.vue` | The title (HTML over `card-title.png`, server-rendered), the pilot choice, GAME OVER. Loads `Game.vue` with `defineAsyncComponent` on the first start |
| `themes/galaga/Game.vue` | A run: canvas, the 60 Hz clock, input, EscHold, sounds, the radio, the debug hook |
| `themes/galaga/theme.css` | The token contract and the landing's styles (`.voyagers-*`) |
| `themes/galaga/audio.ts` | The three radio tracks (`TRACKS`, used by `themes/radio/engine.ts`) and the one-shots: `SFX_NAMES`, `soundFor(event)` |
| `themes/galaga/engine/` | The simulation: pure, seeded, one `step()` a tick. Its own guide: `engine/README.md` |
| `themes/galaga/story/` | `cues.ts` (who speaks, every cue), `lines.ts` (the words), `director.ts` (pacing, `listen()`) |
| `themes/galaga/render/layout.ts` | Where everything sits: pure arithmetic, the window rectangles of the console bitmaps |
| `themes/galaga/render/sprites.ts` | Bitmaps by name from `public/galaga/<name>.png`, loaded on first use, measured, with placeholders |
| `themes/galaga/render/field.ts` | The field: backdrop, every entity, shots, warnings, effects, banners |
| `themes/galaga/render/console.ts` | The monitor and the instruments, through the bitmaps' windows or drawn by code |
| `themes/galaga/render/fx.ts` | What outlasts a tick: pops, floating words, banners, shake (fixed pools, the game clock) |
| `themes/galaga/render/pix.ts`, `palette.ts` | Pixel verbs (line, ring, stipple, big text) and the flat colours |
| `themes/galaga/render/index.ts` | The frame: one buffer of logical pixels, put on the canvas at a whole scale |
| `public/galaga/*.png` | The bitmaps (the art job: `scripts/galaga-lab/art/`, never edited by hand) |
| `scripts/galaga-lab/shot.mjs` | The picture tool |
| `scripts/galaga-lab/REPORT-engine.md`, `REPORT-page.md` | What each job built, measured and left open |

## The rules as built

The engine's rules are in `engine/README.md` and `scripts/galaga-lab/REPORT-engine.md`
(five valves, two tows, the partner's capture and dock, DUET, twelve power-ups, eight roles,
five gangs, five bosses and the Deaf Star, convoys, rescues, friends' passes, VOYAGE II).
Every number is in `engine/balance.ts`. What the page adds:

- **The clock.** Real time is collected and spent in whole ticks of 1/60 s. A long frame
  spends at most five ticks and drops the rest. Pause is not stepping; the director runs on
  the same ticks, so it freezes too.
- **A run** starts from the title with Enter, Space or a tap (a click, so a swipe does not
  start one). The field takes the height the screen gives it then (320 to 432) and keeps it;
  a window resized mid-run shows what fits of it until the next run.
- **Controls.** Arrows or WASD fly, Space fires while held, Shift is DUET, P or an Escape tap
  pauses, a 3 s Escape hold ends the run (`themes/base/EscHold.vue`). Touch: the ship flies to
  a point 42 field pixels above the finger and fires while touched; a second finger is DUET.
  M is the site's radio.
- **Pilot.** Left/right or a tap on a portrait, on the title and on GAME OVER;
  `voyagers.pilot` in localStorage, Rex the first time.
- **Score.** `galagaHighScore` in localStorage (falls back once to `hackerHighScore`).
  GAME OVER calls `submitScore('galaga', score)` unless the score is 0. The board's cap is
  5,000,000 (the autopilot makes 430,000 to 600,000 a voyage and the score runs on).
- **GAME OVER** shows the score, how far the run got (voyage, sector and its name, the wave or
  the boss), PIZZA DELIVERED and the ending picture when a voyage was finished, the high
  score and the world rank once the Hall of Fame has answered.
- **The ending** is drawn in the field while the engine's `ending` stage runs (10 s):
  `card-ending.png`, DELIVERED, the score. Then VOYAGE II begins by itself.
- **The radio** (the music) is the site's: `ensurePlaying()` on the start gesture, the
  intensity follows the run (a card: arp alone; waves 1 and 2: with bass; the bonus run and
  waves 3 and 4: the full band; a boss: the lift), suspended while paused or hidden.
- **Sounds.** `soundFor()` maps an engine event to a one-shot; only the player's own guns
  are heard, pops at most every third tick. A new line on the monitor is a CB click and
  squelch (`radioOpen`), the end of talk its tail (`radioClose`), a boss a low chord (`cutIn`).
- **Page cues.** The page asks the director for `briefing` (else `retry`) at the start,
  `best` when the stored high score is passed, `ending` and `gameover`. After GAME OVER the
  director and the effects run on, on the page's own count of ticks.
- **Reduced motion** (`prefers-reduced-motion`): no shake, no tearing (TRACKING, a boss
  cutting in), a still backdrop, slower blinks.

## The picture

One buffer of logical pixels is drawn each frame and put on the canvas once, at a whole
number of device pixels with `imageSmoothingEnabled` false (the canvas is backed at the
real `devicePixelRatio`, not at `canvasPixelRatio()`, because the rule is about device
pixels). No bloom, glow, scanline, vignette, light map, gradient or alpha blending: a fade
is a stipple, a hit flash is the bitmap's silhouette in one tone, and no colour is black.
The shared pixel stage (`themes/base/pixel/stage.ts`) is not used; the 5×7 font is.

**Layout** (`render/layout.ts`, `tests/galaga-layout.test.mjs`):

- The scale is the largest whole number of device pixels at which 240 × 320 fits above the
  site's bottom band. It drops one step when that would leave the console band less than
  its 96 rows.
- From 560 logical pixels across: the field in the middle, `console-left` (the monitor) and
  `console-right` (the instruments) either side, each 160 to 200 wide. A panel narrower than
  its bitmap shows the columns its windows are in. The right panel starts under the site's
  radio widget (measured from the DOM); the rows above it are flat metal.
- Narrower: `console-band` (96 rows) above the field, and above that a strip of the rows
  the field cannot use: the name plate and the channel beside the radio widget, then the
  lamps and the voyage chart when there are rows for them. With no room, the lit lamps are
  stacked in the field's top-left corner.
- The field ends at the bottom band; the backdrop runs on through it.
- A backdrop bitmap that is cut straight along its bottom (most of its last row is solid:
  the Earth's limb, the field of dishes) stands on the bottom edge; the others drift down.

**The console.** With a console bitmap the instruments are drawn first and the bitmap over
them, so they show through its transparent windows; the window rectangles in `layout.ts` are
copied from `scripts/galaga-lab/art/windows.json` and a test compares the two. Without the
bitmap the panel is flat wood or metal with the same windows. Monitor: the speaker's
portrait in the line's mood (the middle 40 × 40 on the band), name plate, channel, the line
typing out in rows of 28; a boss tears the picture for 26 ticks; between lines the sector's
station ident, every third stretch a test card. Instruments: the score on seven wheels that
roll, five valves, the weapon with its level, the DUET needle over the painted VU face (a
bar on the band), six lamps with the time left (`MG` magnet, `X2` quarter, `TR` tracking,
`EH` extra hold, `DK` dock, `BB` bubble), the voyage as a strip chart with a pen, tows left.

**Bitmaps** are looked up by name (`kind` in the engine is the name) and loaded when first
asked for; a sector's are asked for while its card is up. Until a file has loaded, and for
good when it is missing, a flat rectangle with the name's initials stands in at the size
DESIGN.md gives that kind of thing. `shot.mjs fallback` shows the whole game with none.

## The debug hook

`/?theme=galaga&debug=galaga`, after a run has started, gives `window.__voyagers`. The
engine's lab files (`engine/debug.ts`, `engine/autopilot.ts`) are loaded only then.

| Call | Does |
|---|---|
| `state()` | Plain data: tick, seed, stage, sector, wave, voyage, score, hull, weapon, DUET, partner, wing, boss, the layout, which bitmaps loaded and which are missing, the monitor |
| `seed(n)` | Start again with this seed |
| `sector(n)`, `wave(n \| 'bonus')`, `boss(id?)`, `ending()` | Jump there |
| `give(id)`, `give(weapon, level)` | Take a power-up; set the weapon |
| `duet()`, `capture()`, `dock()`, `event()` | Play DUET; send a captor; dock the partner; start the sector's convoy or rescue |
| `autopilot(on)` | The engine's autopilot flies |
| `step(ticks)`, `run()` | Hold the clock and step it by hand; let it run again |
| `quit()`, `hull(n)`, `reduced(on)`, `world()` | End the run; set the hull; reduced motion; the world itself |

## Pictures

    npm run dev
    node scripts/galaga-lab/shot.mjs [baseUrl] [scene,scene…] [outDir]

Writes `tmp/galaga-shots/<scene>-<phone|wide>.png` (375 × 667 at 2x, 1280 × 800) through
the hook with the clock held, seed 7: the title, each sector, the monitor, capture, hanging,
dock, DUET, both convoys, a rescue, the third ship, the bonus run, TRACKING with every lamp
lit, a called rig, each boss, GAME OVER, the ending, and `fallback` with every bitmap refused.
`layouts` and `title-more` add a tall phone (390 × 844 at 3x), a laptop whose panels are
narrower than their bitmaps (1180 × 700 at 2x) and a phone on its side.

## Tests

`npm run test:galaga` (108 tests, about 50 s):

| File | Covers |
|---|---|
| `galaga-engine`, `-pickups`, `-encounters`, `-bosses`, `-voyage` | The simulation (see `REPORT-engine.md`) |
| `galaga-director`, `-script` | The radio's rules and every line |
| `galaga-layout` | The layout rule on a phone, an installed phone, a tall phone, wide, a phone on its side and a sweep of 5,000 screens; the windows against `windows.json`; panel crops |
| `galaga-look` | Banners for every card, pops and shakes running out on the game clock, pick-up names, fixed pools over a played sector |
| `galaga-audio` | The radio tracks; every one-shot exists and plays against a fake Web Audio; every engine event is silent or makes one |

`test:radio` holds the station names against `audio.ts`. Nothing tests the canvas drawing
itself: that is what the pictures are for.

## Open

- Nobody has heard it, held it on a phone or judged how it feels. Difficulty is the engine
  job's open question (the autopilot never needs a tow).
- A panel narrower than 172 logical pixels cuts the monitor's caption to fewer than 28
  characters a row; the line is wrapped again and the last three rows are shown.
- A window resized mid-run keeps the run's field height; the console moves, the field may be cut.
- Boss bitmaps are centred on the engine's body, whose half sizes they do not match
  (`REPORT-page.md`, "What the art needs").
- `themes/breakout/Breakout.vue` and `themes/rtype/Shooter.vue` still name `galaga/Galaga.vue`
  in a comment.
