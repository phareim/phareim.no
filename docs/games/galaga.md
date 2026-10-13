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
| `themes/galaga/render/crops.ts` | Which 40 × 40 of each portrait the narrow band shows: one origin per speaker, per mood where the head sits elsewhere |
| `themes/galaga/render/fx.ts` | What outlasts a tick: pops, floating words, banners, shake (fixed pools, the game clock) |
| `themes/galaga/render/pix.ts`, `palette.ts` | Pixel verbs (line, ring, stipple, big text) and the flat colours |
| `themes/galaga/render/index.ts` | The frame: one buffer of logical pixels, put on the canvas's backing store at a whole scale |
| `public/galaga/*.png` | The bitmaps (the art job: `scripts/galaga-lab/art/`, never edited by hand) |
| `scripts/galaga-lab/shot.mjs` | The picture tool |
| `scripts/galaga-lab/tune.mjs` | The tuning table: three autopilot profiles, 12 seeds, both heights |
| `scripts/galaga-lab/crops.mjs`, `perf.mjs`, `png.mjs` | The portraits' contact sheet; what a frame costs on a throttled phone; a PNG reader for measuring bitmaps |
| `scripts/galaga-lab/REPORT-engine.md`, `REPORT-page.md`, `REPORT-finish.md` | What each job built, measured and left open |

## The rules as built

The engine's rules are in `engine/README.md` and `scripts/galaga-lab/REPORT-engine.md`
(five valves, two tows, the partner's capture and dock, DUET, twelve power-ups, eight roles,
five gangs, five bosses and the Deaf Star, convoys, rescues, friends' passes, VOYAGE II).
Every number is in `engine/balance.ts`. What the page adds:

- **The clock.** Real time is collected and spent in whole ticks of 1/60 s. A long frame
  spends at most five ticks and drops the rest. Pause is not stepping; the director runs on
  the same ticks, so it freezes too.
- **A run** starts from the title with Enter, Space or a tap (a click, so a swipe does not
  start one). The field takes the height the screen gives it then (320 to 432) and keeps it.
  A window resized or a phone turned mid-run lays the frame out again round that same field
  (wide: the largest whole scale at which all of it fits; narrow: a frame as wide as it must
  be for the rows), with the console's colours and the sky round it; a turn (wide becomes
  tall or the other way) also pauses.
- **Controls.** Arrows or WASD fly, Space fires while held, Shift is DUET, P or an Escape tap
  pauses, a 3 s Escape hold ends the run (`themes/base/EscHold.vue`). Touch: the ship flies to
  a point 42 field pixels above the finger and fires while touched; a second finger is DUET.
  M is the site's radio.
- **Pilot.** Left/right or a tap on a portrait, on the title and on GAME OVER;
  `voyagers.pilot` in localStorage, Rex the first time.
- **Score.** `galagaHighScore` in localStorage (falls back once to `hackerHighScore`).
  GAME OVER calls `submitScore('galaga', score)` unless the score is 0. The board's cap is
  5,000,000: the autopilot makes 420,000 to 500,000 in a first voyage (2026-10-13) and the
  score runs on, so the cap is about ten strong runs. The old game's scores are on the same
  board (the best was 72,410); the new game's go past them, which is how Petter wants it
  (2026-10-13): scores that could not be beaten would be the worse fault.
- **GAME OVER** shows the score, how far the run got (voyage and sector on one row, the
  sector's name and the wave or the boss on the next), PIZZA DELIVERED and the ending picture
  when a voyage was finished (beside the words on a wide screen, over them on a phone, left
  out where neither fits), the high score and the world rank once the Hall of Fame has
  answered. The panel is lettered in the game's own pixels (`--vg`).
- **The ending** owns the field while the engine's `ending` stage runs (10 s): nothing of
  the run is drawn under it, the guns are quiet, and the field shows `card-ending.png`,
  DELIVERED and the score. Then VOYAGE II begins by itself, under its own card.
- **The title** is one pixel size (`--vk`, a whole number of device pixels, set by
  `Landing.vue`'s `fit()`): the card, both portraits and every letter. The pilots stand under
  the card on a phone and in a column as wide as the card beside it when that makes the
  pixels larger (2 at 1280 × 800, 3 at 1920 × 1080).
- **The radio** (the music) is the site's: `ensurePlaying()` on the start gesture, the
  intensity follows the run (a card: arp alone; waves 1 and 2: with bass; the bonus run and
  waves 3 and 4: the full band; a boss: the lift), suspended while paused or hidden.
- **Sounds.** `soundFor()` maps an engine event to a one-shot; only the player's own guns
  are heard, pops at most every third tick. A new line on the monitor is a CB click and
  squelch (`radioOpen`), the end of talk its tail (`radioClose`), a boss a low chord (`cutIn`).
  The one-shots' context is made when a run begins, which is after the tap that asked for the
  game's chunk, so iOS may leave it suspended: every touchstart, touchend and keydown of the
  run asks it to run again (`wake()` in `Game.vue`, `start()` in `audio.ts`, which makes one
  context and never throws). A fault in the sound cannot stop the input handlers. Not heard
  on a phone by anyone (2026-10-13).
- **Page cues.** The page asks the director for `briefing` (else `retry`) at the start,
  `best` when the stored high score is passed, `ending` and `gameover`. After GAME OVER the
  director and the effects run on, on the page's own count of ticks.
- **Reduced motion** (`prefers-reduced-motion`): no shake, no tearing (TRACKING, a boss
  cutting in), a still backdrop, slower blinks.

## The picture

One buffer of logical pixels is drawn each frame and put on the canvas's backing store once,
at a whole number of its pixels with `imageSmoothingEnabled` false. Wide, the backing store is
the screen's device pixels (the real `devicePixelRatio`, capped at 4, not
`canvasPixelRatio()`: the rule is about device pixels, and the frame is one small buffer and
one blit, not the pixel stage's four or five passes) and the canvas is `pixelated`. Narrow
(2026-10-13), the backing store is the frame itself, `lw × n` by `lh × n`, CSS fits it to the
viewport and the renderer takes `pixelated` off the canvas (`resize` in `render/index.ts`).
Measured (before the narrow rule: a 1170 × 2532 store; it is now 1200 × 2595)
2026-10-13 on the built site (`perf.mjs`: 390 × 844, 4x CPU throttle, headless Chrome on the
Mac): one draw takes 0.3 ms in the middle and 3.3 ms at the 95th percentile at ratio 3, and
the same at ratio 2 and at ratio 1; a tick and a draw of a busy wave 2.3 and 5.9 ms. No bloom, glow, scanline, vignette, light map, gradient or alpha blending: a fade
is a stipple, a hit flash is the bitmap's silhouette in one tone, and no colour is black.
The shared pixel stage (`themes/base/pixel/stage.ts`) is not used; the 5×7 font is.

**Layout** (`render/layout.ts`, `tests/galaga-layout.test.mjs`):

- Wide or narrow: the largest whole number of device pixels at which 240 × 320 fits above the
  site's bottom band is tried first; 560 logical pixels across there is wide; if not, and the
  band's 96 rows would not fit above the field at that scale, the next scale down is tried.
- Wide: the field in the middle, `console-left` (the monitor) and `console-right` (the
  instruments) either side, each 160 to 200 wide. A panel narrower than its bitmap shows the
  columns its windows are in. The right panel starts under the site's radio widget (measured
  from the DOM); the rows above it are flat metal.
- Narrow (`narrow()`; DESIGN.md has the rule): a frame 240 across, rows = round(CSS height ×
  240 / CSS width), `scale` = ceil(device pixels across / frame width). Down it: `strip` (bare
  wood: the radio widget's rows less the 8 of the band it may lie over), `band`
  (`console-band`, 96 rows), `field`, `under` (the bottom band and any rows a 432-row field
  leaves). The name plate and the channel are drawn on the band's steel (`BAND_PLATES`). A
  screen without the rows gets a wider frame (`lw` > 240, even), band and field in its middle,
  the band's edge columns and the sky's stars drawn on either side. The lit lamps are stacked
  in the field's top-left corner.
- The radio widget's left edge is taken at its CSS `max-width`, not as measured: it is as
  wide as the track's name, and the layout must not move when the track changes.
- A run under way keeps its field's height: `computeLayout(screen, fieldH)`.
- `toField()` maps a touch: narrow by the frame (`lw / CSS width`, `lh / CSS height`), wide by
  device pixels. `wholePx()` is the pixel GAME OVER's panel is drawn at: whole device pixels.
- The field ends at the bottom band; the backdrop runs on through it.
- A backdrop bitmap that is cut straight along its bottom (most of its last row is solid:
  the Earth's limb, the field of dishes) stands on the bottom edge; the others drift down.

**The console.** With a console bitmap the instruments are drawn first and the bitmap over
them, so they show through its transparent windows; the window rectangles in `layout.ts` are
copied from `scripts/galaga-lab/art/windows.json` and a test compares the two. Without the
bitmap the panel is flat wood or metal with the same windows. Monitor: the speaker's
portrait in the line's mood (on the band a 40 × 40 window on the face, `crops.ts`), name plate, channel, the line
typing out in rows of 28; a boss tears the picture for 26 ticks; between lines the sector's
station ident, every third stretch a test card. Instruments: the score on seven wheels that
roll, five valves, the weapon with its level, the DUET needle over the painted VU face (a
bar on the band), six lamps with the time left (`MG` magnet, `X2` quarter, `TR` tracking,
`EH` extra hold, `DK` dock, `BB` bubble), the voyage as a strip chart with a pen, tows left.

**Bitmaps** are looked up by name (`kind` in the engine is the name) and loaded when first
asked for; a sector's are asked for while its card is up. Until a file has loaded, and for
good when it is missing, a flat rectangle with the name's initials stands in at the size
DESIGN.md gives that kind of thing. `shot.mjs fallback` shows the whole game with none.

## The bosses and their boxes

A boss's bitmap is drawn centred on the boss. Its body, its weak spot and the point its shots
leave from are `BOSSES` in `engine/balance.ts`, measured in the bitmap (2026-10-13):

| Boss | Bitmap | Body, half sizes | Weak spot | Shots leave from |
|---|---|---|---|---|
| knight | 56 × 113 | 24, 55 | all of him | the mirror ball: glints, and the head of each ray |
| humdinger | 97 × 117 | 44, 56 | all of the rig | the trailer: mines roll off it, hogs come out of it; the ram's lane is 92 wide |
| durant | 104 × 106 | 50, 51 | all of the organ | the pipes' mouths: the notes |
| cal | 120 × 77 | 120, 38: a wall across the field | the lens, 20 × 20, which slides 60 either way with its unit | the lens |
| fader | 140 × 95 | 46, 46: helmet and chest | all of that | the chest: the choke's line |
| deafstar | 193 × 96 | half a disc 96 wide, flat along the top of the field | the red dome, 14 × 14, 40 right of the middle | the woofer: the rings |

A shot in the column under a weak spot flies up over the body until it meets it; outside
that column a wall stops it. CAL's wall either side of the unit is the bitmap's own valve
banks laid end to end. The ship keeps 24 rows under a standing boss. The far moon of sector 5
(`bg-5-a`) leaves the backdrop when the Deaf Star itself flies in.

## The play, as tuned

Targets and where the three autopilot profiles stand (`node scripts/galaga-lab/tune.mjs`,
12 seeds at both heights, 2026-10-13; the profiles aim perfectly, so they say more about
dodging than about how hard the game is for a person):

| Target | Measured |
|---|---|
| Sector 1 gentle: CLUMSY clears it 12 of 12 with at most one tow | 12 of 12, no tow, 0.1 to 0.2 hits |
| Hits rise every sector | Not met. CASUAL 0.0 1.3 0.7 0.7 0.8 at 320 and 0.5 0.5 1.8 2.1 2.5 at 432; CLUMSY 0.1 3.3 2.6 1.1 4.5 and 0.2 2.8 2.9 2.6 4.8 |
| CASUAL finishes on most seeds with a tow on half; CLUMSY finishes on few | Not met: every profile finishes 12 of 12; a tow on 0 (CASUAL) and 0 to 3 (CLUMSY) seeds |
| The partner is taken at least once on most CASUAL seeds, a dock on some | 8 and 9 of 12 seeds; a dock on 7 |
| About 45 pick-ups and 6 to 8 DUETs a voyage | 50 to 53 and 8.3 to 8.8 |
| Scores stay on the scale the first live version had | 420,000 to 500,000 for the autopilot in a first voyage (it was 463,000 to 566,000 before the tuning) |

What does it: the captor arrives with a shield, settles for 50 ticks and comes down for the
partner; the shield drops when its beam begins to warm (half a second), which is the moment
to shoot it or fly the partner clear. The partner steps aside from what will reach it within
40 ticks. Hans Duo comes when six have formed up or half the wave has flown in, and takes
half of what is left. A rescued friend flying along leaves the formation to make her own
pass. In the last fight the engine books each story line's time on the air: friends wait for
a clear channel, gunfire counts for less while the talk is behind, and the Deaf Star does not
go down while a friend is still owed a pass. From sector 4 the small enemies take three hits.

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
| `boxes(on)` | Draw the engine's boxes over the field: bodies (green), weak spots (magenta), where shots leave from (cyan) |

## Pictures

    npm run dev
    node scripts/galaga-lab/shot.mjs [baseUrl] [scene,scene…] [outDir]

Writes `tmp/galaga-shots/<scene>-<phone|wide>.png` (375 × 667 at 2x, 1280 × 800) through
the hook with the clock held, seed 7: the title, each sector, the monitor, capture, hanging,
dock, DUET, both convoys, a rescue, the third ship, the bonus run, TRACKING with every lamp
lit, a called rig, each boss, GAME OVER, the ending, and `fallback` with every bitmap refused.
`phone-play`, `phone-boss` and `touch` run at nine narrow screens (`p844` installed, `p664`,
`p932`, `p852`, `phone`, `p553`, `p740`, `p568`, `pad`; `touch` flies the ship with a finger
whose identifier is negative and fails if the ship does not end under it); `bars` shrinks an
installed phone to Safari's height mid-run. A scene takes one size as a suffix (`boss-cal-p844`).
`layouts` and `title-more` add a tall phone (390 × 844 at 3x), a laptop whose panels are
narrower than their bitmaps (1180 × 700 at 2x), a phone on its side and 1920 × 1080. Also:
`boxes-<boss>` (each boss with the boxes drawn), `tow`, `gameover-delivered`, `voyage-2`,
`duo`, `pass-rig`, `pass-strafe`, `convoy-lost`, `rescue-lost`, `reduced`, `words`, `turned`
(a phone turned mid-run), `shrunk` (a window made small), `board` (the Hall of Fame) and
`cabinet` (the arcade in the portal). It runs against `npm run dev` or a preview of the
built site (`npm run build`, `npm run preview`, port 8788).

## Tests

`npm run test:galaga` (110 tests, about 60 s):

| File | Covers |
|---|---|
| `galaga-engine`, `-pickups`, `-encounters`, `-bosses`, `-voyage` | The simulation (see `REPORT-engine.md`) |
| `galaga-director`, `-script` | The radio's rules and every line |
| `galaga-layout` | The layout rule: nine narrow screens (frame, scale, band, field, bottom band, radio widget, a run's field kept), every speaker's plates on the band, a touch mapped by the frame, wide as it was, a sweep of 11,000 screens; the windows against `windows.json`; panel crops |
| `galaga-look` | Banners for every card, pops and shakes running out on the game clock, pick-up names, fixed pools over a played sector |
| `galaga-audio` | The radio tracks; every one-shot exists and plays against a fake Web Audio; every engine event is silent or makes one; `start()` again and again makes one context, wakes it when it is not running and never throws |

`test:radio` holds the station names against `audio.ts`. Nothing tests the canvas drawing
itself: that is what the pictures are for.

## Open

- Nobody has heard it, held it on a phone or judged how it feels.
- It is still too easy for the three autopilot profiles (the table above): they aim perfectly
  and shoot most of a wave as it flies in, so harder dives and more shots barely move their
  numbers. What a person meets is unknown; the knobs are `diveEvery`, `maxDivers`,
  `diveTicks`, `enterTicks`, `veteranHp`, `GANGS` and the bosses' `rest` in `balance.ts`.
- The weakest profile is caught by Lord Humdinger's lane (92 wide) more than by anything in
  sectors 3 and 4, which is why its curve dips after sector 2.
- Live patches (a ray, a key column) are a loud orange checker.
- GAME OVER after a finished voyage on a 375 × 667 phone: the site's radio widget lies over
  the top right corner of the ending picture.
- A panel narrower than 172 logical pixels cuts the monitor's caption to fewer than 28
  characters a row; the line is wrapped again and the last three rows are shown.
- The narrow band has no lamps or chart of its own: on every narrow screen the lit lamps
  stand in the field's corner and the voyage chart is not shown.
- Narrow, the canvas is smoothed by the browser over its last 2 to 24 % (measured at nine
  screens; 375 × 667 at 2x is the 24: 3.02 device pixels a pixel, and ceil gives 4): at a pixel ratio of 1
  (a narrow desktop window) that softening can be seen; on a phone's density it was not
  looked at on a phone.
