## Space Invaders overview (added 2026-09-05)

`?theme=invaders` is the faithful 1978 formation game: a 5×11 formation
with the original sprites, a step-timer march that quickens as invaders
die, eroding bunkers, a mystery UFO, one shot on screen at a time, and a
kill-combo multiplier.

**Look (2026-09-24): Neon Shrine's pixels** (`docs/games/pixel-look.md`).
The formation comes down over the town at dusk: a dithered sky with stars,
the striped sun behind two ridges, a tree line with houses (lit windows)
and lamps, grass where the cannon rides. Drawn on the shared pixel stage,
lit by a light map. One invader pixel is one logical pixel (`px` = the
stage's `k`); the 1978 bitmaps get an outline, shading (squid pink, crab
violet, octopus rose) and eyes that flash white on each heartbeat step.
Bunkers are shrine stone (brick courses, a cyan neon strip along every
exposed top) at one cell per logical pixel. The cannon keeps its 13×8
silhouette in the Hangar ship's colours. Shots, bombs, sparks, rings and
the sun glow after the light map. Pickups are gold crates; score pops,
the combo and the weapon label are in the 5×7 font on the HUD layer; the
HTML text uses `.px-*`. Code: `themes/invaders/pixel.ts` (scene, sprites,
bunker painter) and the draw section of `Invaders.vue`. Phones use a
minimum of 104 logical pixels across (`stageMinW()`), which keeps sprites
≥ 24 CSS px tall.

## History

Built via `/musecode`: three looks (phosphor cabinet, risograph paper,
synthwave) went through review/polish, then two effect packages were tried
on the winner and one was fixed up. The losing looks are in `git log`,
commits `8344268`..`d5436f7`.

## Space Invaders on phones (2026-09-08)

Portrait widths below 600 px use five columns, with sprites at least 24 px
tall (the stage's pixel scale, see above). Sprite scale also respects
available height. The cannon and bunkers leave finger space below the playfield,
including landscape phones; the live score sits at the top instead of covering
play. Mobile rendering omits the marching camera jolt.

Touch steering follows the finger directly, like Breakout. Holding a stationary
finger fires the next bolt as soon as the previous one clears; only one player
bolt exists at a time. The initiating touch owns control until release/cancel;
blur and page hiding clear held input.
Shots and bombs check the distance travelled between frames for bunker/cannon/
invader collisions, so a slow frame cannot skip a small target or thin remnant.

`npm run test:invaders` covers layout, hold-to-fire, direct steering, extra
fingers/cancellation, idle tap versus swipe, cannon bounds and collision sweeps
(eight tests, included in CI). Verified 2026-09-08 in Chromium with emulated
touch at 320×568, 375×667, 390×844 and 667×375, plus keyboard at 1440×900:
held touch scores without further movement, HUD stays clear, no page errors
or document overflow. Physical-phone feel and frame rate are not measured.

## Space Invaders weapon pickups (2026-09-08)

The live formation marches 15% faster and base bolts travel about 20% faster;
wave breaks are 1.3 seconds. Holding Space/Up/W fires again when the current
bolt clears, matching held touch. Gold pickups drop every fifth invader kill
and on UFO kills, alternating P (Pierce) and B (Blast), with at most three
falling at once. Catch them with the cannon: Pierce passes through invaders
with a faster bolt; Blast damages a 1.35-cell-radius area and removes nearby
bombs, with extra particles and shockwaves. Bunkers still stop either bolt.

Each pickup replaces the weapon for 12 seconds of active play; the label and
remaining seconds appear below the cannon. Pause, death freezes and wave breaks
freeze pickup movement and duration. Losing a life or restarting clears weapons
and pickups. Existing bolts retain their weapon until impact. No extra controls.
The additions stay in `themes/invaders/Invaders.vue`; the mobile regression suite
also covers pickup lifecycle, piercing, blast damage and wave-clear behavior.
Typecheck, production build and engine tests verified 2026-09-08.
Chromium gameplay smoke checks also passed at 320×568, 375×667, 390×844,
667×375 and 1440×900 with touch/keyboard input, no page errors or document
overflow (2026-09-08). Physical-phone feel remains unmeasured.
