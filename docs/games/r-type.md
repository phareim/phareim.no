## G-Type overview (2026-09-05; renamed from R-Type 2026-10-13)

`?theme=rtype` is an endless side-scrolling shooter. The id stays `rtype`
(high scores, Hall of Fame and links depend on it); only the name changed.
Attract-mode autopilot flies behind the title menu until START or a tap on
START. Shift or a double-tap fires the Force pod; holding Space charges a
beam; procedural cave walls narrow with distance; kills chain into a streak
multiplier. Cyan is the player, orange the danger hue, gold the reward (the
multiplier from x4, capsules).

**Menus (2026-10-13).** Landing draws them; Shooter owns the cursor and the
keys (`MENUS`, `setMenu`, `choose`, `handleMenuKey` in `Shooter.vue`).
- Title: G-TYPE, the copyright line `(C) 2Q88, Sleepy Productions`, START and
  HOW TO PLAY. Arrows or W/S move the cursor, Enter selects, a tap on the
  button selects. A tap on empty space does not start the run.
- HOW TO PLAY: the controls card, BACK (Enter or Esc returns to the title;
  Esc is `preventDefault`ed so the theme's Escape-to-portal does not fire).
- Pause menu: RESUME, RESTART, QUIT RUN. It opens on an Esc tap or P, or the
  `II` button (top centre, left of the score line; phones: its row under the
  power-up list). QUIT RUN goes to game over, like the 3 s Esc hold. EscHold
  runs with `show-paused=false`, so there is one pause indicator.
- Menu keys are consumed before the game's own keys while a menu is open.
  `resetGame` and `togglePause` set the menu; the run has none.

**Speed (2026-10-13).** Scroll `170 + min(190, m·0.4)` px/s (was 150 / 170)
and `speedMul` starts at 1.05 (was 1). The demo scroll (90) and ship speed
are unchanged.

**Artwork (2026-10-13).** The ships (`DART`, `VANDAL` in `pixel.ts`) got a
two-tone hull, a glint on the canopy and a trim stripe; the drone is a
magenta-rimmed lozenge with a pulsing core, the gunship an armour hull
with a magenta band, the weaver two neon blades (magenta and gold), the hex
a magenta, orange, red and gold stack. The boss plates have a magenta rim.
Sprites are within about a pixel of the old sizes, and the hitboxes did not
change. The sheet
is rendered with `scripts/pixel-lab/sheet.mjs`; the menus with
`scripts/rtype-lab/menus.mjs <baseUrl> <outDir>` against a dev server
(`heavy -x chrome --`).

**Look (2026-09-24): Neon Shrine's pixels** (`docs/games/pixel-look.md`):
a flight through the shrine caves. The walls are pixel rock in the cliff
palette (a tileable boulder texture, world-anchored so it scrolls with the
cave), with a lit floor rim, teal moss, stalactite drips and crystals
(pink, cyan, gold) that glow and light the rock round them. Behind: a
dithered far cave, dark at the walls and warm through the middle (the cave
mouth ahead), quiet parallax ridges and drifting stars. The ship is a pixel
sprite in the Hangar colours (dart, or the wider vandal) with a flickering
flame; the Force pod a trim-coloured orb; drones, weavers, hexes and
gunships outlined orange sprites (weavers and hexes as pre-rendered
rotation frames); the boss a pixel ring of ten plates round a pulsing
core. The light map does the work: the engine, bolts, the charge beam
(which flares on release), enemy shots and explosions light the walls as
they pass. On portrait phones the stage turns the whole scene a quarter
(`resize(…, rotate)` in `themes/base/pixel/stage.ts`); HUD text stays
upright. The canvas HUD is small: charge pips and the Force state under
the ship, active power-ups top left, capsule letters over their crates;
the score line and title text are HTML in `.px-*`. About 3 CSS px per
pixel, so the ship keeps its old size. Code: `themes/rtype/pixel.ts` and
the draw section of `Shooter.vue`.

## History

Built by Muse Spark via `/musecode` in three parallel variants; this one
won. The other two are in `git log`.

## G-Type cave walls and weapon pickups (2026-09-08)

The cave rim uses world-anchored 64 px samples; ship collision uses the same
linear interpolation the drawing samples, one logical pixel per column.

Gold capsules arrive after 8 seconds, then every 9 seconds, plus boss kills.
They cycle through G SPREAD (three-way gun), B WIDE (wider beam, six damage),
F TWIN (two angled pod shots), G RAPID (0.075 s firing interval), B QUICK
(0.4 s charge), F SEEKER (homing pod shots). Upgraded pods fire while attached
or launched. Each weapon has its own 20-second upgrade slot; collecting another
variant replaces only that slot. The three slots stack. Timers freeze while
paused or the ship is dead; losing a life clears upgrades and loose pickups.
Restart resets the drop sequence. Existing shots keep their launch properties.
Capsules show their letter and variant upright in either orientation; the top
left HUD lists active variants and remaining seconds (nothing while every
weapon is standard). Controls are unchanged.

`npm run test:rtype` runs seven regression tests in CI: pickup cycling/stacking/
expiry, weapon behavior, reset/paused input, angular wall collision (all from
2026-09-08) and the title, help and pause menus (2026-10-13).
Verified 2026-09-08: all 93 tests, typecheck and an isolated production build pass; Chromium rendering at
1440×900, 375×667 and 667×375 with keyboard fire and injected upgraded loadouts
shows no page errors or document overflow. Emulated portrait touch holds fire
and releases a charged beam. Physical-phone performance is unmeasured.

