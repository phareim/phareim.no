# Space Voyagers — page job report

2026-10-13. Status: DONE. Every check asked for passes (below). Nobody on this job heard the
game or held a phone, and every picture is a still: nothing here says how it feels, sounds
or moves.

## What is built

- **`themes/galaga/render/`** (8 files): the frame and everything in it.
  `layout.ts` (the layout rule, pure, tested), `sprites.ts` (bitmaps by name from
  `public/galaga/<name>.png`, loaded on first use, measured, centred; a flat placeholder
  with the name's initials until loaded or when missing; white silhouette, frost and mirror
  variants made from the bitmap), `field.ts` (backdrop, every entity, shots, warnings,
  beam, doors, cables, cargo bar, pips, banners, the ending card, TRACKING's tear),
  `console.ts` (monitor and instruments, through the bitmaps' windows or by code),
  `fx.ts` (pops, words, banners, shake: fixed pools on the game clock), `pix.ts`,
  `palette.ts`, `index.ts` (one logical buffer, one unsmoothed blit at a whole scale).
  The shared stage (`themes/base/pixel/stage.ts`) is not used and was not touched.
- **`themes/galaga/Game.vue`**: canvas, 60 Hz accumulator (five ticks a frame at most, the
  rest dropped), engine and director stepped together, pause, keys and touch, EscHold,
  reduced motion, events to one-shots, the site's radio, `window.__voyagers`.
- **`themes/galaga/Landing.vue`, `theme.css`**: the title over `card-title.png` lettered in
  the pixel font (server-rendered: checked with curl), pilot choice, high score, GAME OVER
  with how far the run got and the world rank, the ending picture after a finished voyage.
  The game is its own 128 KB chunk; the entry holds none of the engine (checked in `dist`).
- **`audio.ts`**: the one-shots are a typed table (`SFX_NAMES`); new: `radioOpen`,
  `radioClose`, `cutIn`, `beam`, `capture`, `dock`, `tow`, `duet`, `duetReady`, `horn`,
  `bass`, `disc`, `mend`, `mirrorball`; `soundFor(type, kind, n)` maps engine events.
  `TRACKS`, `TRACK_NAMES`, `intensityVoices`, `transposeFor`, `hz` are unchanged.
- **The names**: registry, Hall of Fame entry, the cabinet's label, lines, marquee and
  screen, README, docs. Ids, `LEGACY_THEME_IDS`, D1 rows and the radio origin untouched.
- **The old game is removed** (list at the end).
- **`scripts/galaga-lab/shot.mjs`**, **`docs/games/galaga.md`** (rewritten), AGENTS.md lines.

## Checks (all run after the last code change)

| Check | Result |
|---|---|
| `npm run test:galaga` | 108 pass (86 engine and story, 22 new or extended: layout 8, look 7, audio 7) |
| `npm run test:portal` | 38 pass |
| `npm run test:zelda` | 98 pass |
| `npm run test:leaderboard` | 11 pass |
| `node --test tests/radio-catalog.test.mjs` | 5 pass |
| `npm run typecheck` | clean |
| `npm run build` | complete |

No test was loosened; the rename broke none.

## The pictures (`tmp/galaga-shots/`, 64 PNGs, no page error in any run)

Rendered against `nuxt dev` (not `wrangler pages dev dist`), seed 7, the clock held. The dev
toolbar pill at the bottom centre of each picture is Nuxt's, not the game's.

Opened and looked at (40):

| Picture | Shows | Wrong or weak |
|---|---|---|
| `title-phone`, `title-wide`, `title-more-side` | Card, lettering, both portraits (Rex chosen), TAP/ENTER hint, copyright, radio widget clear of everything | Wide: the right half is sparse (portraits at 1x beside a 2x card). No high-score line shown (none stored) |
| `card-phone` | SECTOR 1 / LOW ORBIT banner, Earth's limb at the bottom, band, name plate beside the widget | |
| `sector-1-wide`, `-phone`, `sector-2-wide`, `sector-3-phone`, `sector-4-wide`, `sector-5-wide` | Each gang, backdrop bitmaps darker than the action, monitor typing, counter rolling, valves, dial, needle, lamps, chart | Score words pile up where several things pop at once (sector 4, 5). Monitor often still on the briefing because the hook jumped sectors |
| `capture-wide`, `hanging-phone` | The beam as stippled bars in a cone with the partner in it; the partner under the captor in formation, CAPTURED | |
| `dock-wide` | Two ships side by side, DOCKED, the DK lamp | |
| `duet-wide`, `duet-phone` | Level-5 fan, pink and gold edge bars, the time bar on top, DUET banner, needle pinned, raiders on the rig | The banner lies over the shots for a second |
| `convoy-3-wide`, `cb-wide` | Three rigs in the lane with the CARGO bar; a called rig and a BOOMBOX arc | CARGO label touches the top edge when the lead rig is leaving |
| `rescue-wide`, `rescue-phone`, `wing-wide` | The stalled ship with beacon and cable bar; the third ship flying along | The autopilot parks on the ship, so the cables are a few pixels long; Ridley's tug half under the dev pill |
| `tracking-wide` | Five lamps lit, tear lines, bubble rings, magnet ring, the hairspray cloud as a checker | The band shift itself hardly shows on a sparse field: only the snow lines read |
| `boss-knight-wide`, `boss-humdinger-wide`, `-phone`, `boss-durant-wide`, `boss-cal-wide`, `-phone`, `boss-fader-wide`, `boss-deafstar-phone` | Each boss, hull bar, warned patches (stipple, dashed edge), live patches, aim line, mines, doors, sliders, the target frame | CAL's bitmap is 77 tall on a 44-tall body: it hangs below the wall and the doors cross its bottom. Live patches are a loud orange checker |
| `gameover-phone`, `-wide` | Panel with score, VOYAGE I · SECTOR 3 · THE SHAG NEBULA · WAVE n, NEW HIGH SCORE, WORLD RANK (the dev server's memory store), pilot buttons, hint | Phone: the reached line wraps to two rows |
| `ending-wide`, `-phone` | `card-ending`, DELIVERED, ONE LARGE PEPPERONI, SCORE | Phone: the card and its words cover the two ships |
| `fallback-wide`, `-phone` | The game with every PNG refused: wood and metal panels by code, placeholders with initials (PME, SR, SN, RM, EGT, PT) | The valves in these two pictures are plain rectangles: lit and dark valves by code were added after, and not pictured again |
| `layouts-tall`, `-laptop`, `-side` | 390 × 844 at 3x: name, channel and lamps beside the widget, chart under, field 432. 1180 × 700 at 2x: panels 175 wide, cropped. 667 × 375: wide, the widget large | Laptop: the caption's left bezel is cut off. Tall: bare wood round the chart. Side: the widget covers the field's top-right corner |

Rendered but not opened (24): `monitor-*`, `bonus-*`, `convoy-*` (the single rig),
`fallback-title-*`, `title-more-tall`, `title-more-laptop`, and the other size of
`sector-2/3/4/5`, `capture`, `hanging`, `dock`, `convoy-3`, `wing`, `tracking`, `cb`,
`boss-knight`, `boss-durant`, `boss-fader`, `boss-deafstar`. Also not looked at again after
their last fix: the floating words no longer overlapping (`layouts-*` re-rendered, tested
in `galaga-look`), the boss flash limit on `boss-humdinger-wide`, the code-drawn valves.

Never pictured: a tow, GAME OVER after a finished voyage (the ending picture in the panel),
VOYAGE II, Hans Duo, a friend's pass, a lost convoy or rescue, the 160 to 171 wide panels,
reduced motion in play, the Hall of Fame board with the new title, the cabinet's new marquee.

## Decisions

1. **Own blitter**, not the shared stage: nothing of the stage's (light, bloom, overlay) is wanted.
2. **The canvas is backed at the real `devicePixelRatio`** (capped at 4), not `canvasPixelRatio()`:
   the rule is whole device pixels. AGENTS.md says every canvas game goes through that
   helper; this one deliberately does not.
3. **The scale drops one step** when the band's 96 rows would not fit under the 240 × 320 rule.
4. **The radio widget is measured from the DOM** and laid out round: the right panel starts
   under it; on a phone the field gives up rows (down to 320) so the caption is clear of it.
5. **Panels narrower than 200** (560 to 639 logical px across, e.g. a 13" laptop) show a crop
   of the bitmap centred on its windows.
6. **A backdrop bitmap cut straight along its bottom** stands on the bottom edge (measured
   from its last row), instead of drifting with a visible cut.
7. **CAL's bitmap is drawn at its moving lens** (the engine slides the target along the wall);
   the wall itself is flat code-drawn metal.
8. **A boss flashes white two ticks in eight at most**, and not at all under reduced motion.
9. **The ending card is drawn in the field** while the engine's `ending` stage runs; the
   landing shows it again on GAME OVER after a finished voyage.
10. **Title lettering is HTML in the pixel webfont**, so it server-renders; the card and
    portraits are scaled to whole device pixels by `Landing.vue` once the screen is known.
11. **Pilot order is Nova left, Rex right**, as on the card. Left/right pick; Enter starts.
12. **GAME OVER restarts with Enter or a tap**, after 0.7 s; Space does not (it is fire).
13. **Board title `Space Voyagers I`**, tagline `Rex & Nova · five sectors · one large
    pepperoni`; **cabinet label `SPACE VOYAGERS`**. `maxScore` 500,000 to 5,000,000: the
    autopilot makes up to 600,780 in one voyage and the score runs on.
14. **Only the player's guns are heard**; kills at most every third tick.
15. **Hook extras** beyond the list: `wave`, `dock`, `run`, `quit`, `ending`, `hull`, `reduced`, `world`.
16. **Quit** (3 s Escape) sets `world.over` from the page; the engine has no call for it.
17. **Touch**: the ship flies 42 field pixels above the finger.

## Missing against DESIGN.md, by weight

1. **Unjudged**: feel, sound, a real phone, touch at all (the lab only taps to start).
2. **A window resized or a phone turned mid-run** keeps the run's height: the field may be cut.
3. **Hit boxes and bitmaps disagree for bosses** (see below); nothing shows the body's box.
4. **The narrow band has no lamps or chart of its own**: at 375 × 667 the lit lamps stand in
   the field's corner and the voyage chart is not shown at all.
5. **The band's portrait is the middle 40 × 40**, as specified; it shows half a face.
6. **TRACKING's tear** reads as lines of snow more than as shifted bands.
7. **"Names under a new pick-up"** show for 2.5 s; a pop's points only from 300 up.
8. **The monitor's ident** is op-art rings and two words per sector, not drawn stations.
9. **No mouse control.** No picture or test of reduced motion in play.
10. **`themes/breakout/Breakout.vue`, `themes/rtype/Shooter.vue`, `themes/base/DefaultLanding.vue`**
    still name the old `Galaga.vue` or `galaga` in a comment (not mine to edit).

## What the art needs for the console and the field to line up

- **Windows must stay where `windows.json` says** and be fully transparent; a test compares
  the code's rectangles with that file, so regenerate it with any new console bitmap.
- **`console-left`**: its windows span x 19 to 191. At the narrowest layout only 160 columns
  show. Keep everything that matters within x 25 to 185, and best within the 160 columns
  round x 105; the caption (172 wide) is the one that gets cut.
- **`console-right`**: windows span 24 to 176 and survive every crop. There is no window for
  tows or for the weapon's name: both are drawn inside `weapon` and `chart`. The top 27 rows
  sit under the radio widget on a 1280 × 800 screen: the panel is pushed down by that much.
- **`console-band`**: no window for the name plate, channel, lamps or chart. The top-right
  52 CSS px belong to the radio widget; the caption starts 10 rows down and just clears it.
  A 9-row weapon window holds `BLAST3`, not a name and pips.
- **`vu_face`**: the needle pivots at the face's bottom centre (4 rows up), 31 long, 55°
  either side. The painted scale fits that.
- **`boss-cal`**: 120 × 77 for a body 224 × 44 whose lens (20 × 20) slides 70 px either way.
  The lens is painted 7 px above the bitmap's centre; the code is told so (`BOSS_ANCHOR`).
  A unit about 44 tall would sit in the wall.
- **Other bosses** are centred on the body: knight 56 × 113 for a 68 × 60 box, humdinger
  97 × 117 for 72 × 68, durant 104 × 106 for 104 × 52, fader 140 × 95 for 60 × 60,
  deafstar 193 × 96 for 240 × 88 with the tweeter at the bottom centre (it lines up).
- **`bg-1-a`, `bg-4-b`** are cut straight along the bottom, so they are pinned there.
- **Enemy sizes vary a lot** (8 × 31 to 39 × 30) against hit boxes of 18 to 26 square.
- **`valve-on` 11 × 24, `valve-off` 12 × 23**: one pixel apart; they are centred, so a valve
  shifts half a pixel when it pops.

## Engine and story files touched

- `themes/galaga/story/lines.ts`: one word in the head comment (`galaga-story.test.mjs` to
  `galaga-script.test.mjs`, the file I deleted). No fault found in the engine; nothing in
  `engine/` changed.

## Files

Created: `themes/galaga/Game.vue`; `themes/galaga/render/` `index.ts`, `layout.ts`,
`sprites.ts`, `field.ts`, `console.ts`, `fx.ts`, `pix.ts`, `palette.ts`;
`tests/galaga-layout.test.mjs`, `tests/galaga-look.test.mjs`;
`scripts/galaga-lab/shot.mjs`, `scripts/galaga-lab/REPORT-page.md`.

Changed: `themes/galaga/Landing.vue`, `theme.css`, `audio.ts`, `story/lines.ts` (comment);
`tests/galaga-audio.test.mjs`; `package.json` (`test:galaga`); `themes/index.ts`;
`themes/leaderboard/games.ts`; `themes/zelda/world/town.ts`; `themes/zelda/render/exits.ts`;
`app.vue` (a comment); `README.md`; `AGENTS.md`; `.claude/skills/phareim-theme/SKILL.md`;
`docs/games/galaga.md` (rewritten), `hangar.md`, `global-radio.md`, `pixel-look.md`,
`hall-of-fame.md`, `portal.md`, `star-fox.md`, `parked-and-classic.md`.

Deleted: `themes/galaga/Galaga.vue`, `Intercom.vue`, `balance.ts`, `weapons.ts`, `story.ts`,
`sprites.ts`, `pixel.ts`; `tests/galaga-game.test.mjs`, `galaga-balance.test.mjs`,
`galaga-weapons.test.mjs`, `galaga-story.test.mjs`.

Not in the patch: `tmp/galaga-shots/`, `dist/`, `.nuxt/` (git-ignored). The lab's browser
profiles are in `~/zshots/prof-*` on the Mac (`scripts/zelda-lab/cdp.mjs` makes them).
The dev server started for the pictures was stopped; nothing was committed.
