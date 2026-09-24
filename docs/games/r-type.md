## R-Type overview (added 2026-09-05)

`?theme=rtype` is an endless side-scrolling shooter in neon-vector outline
style. Attract-mode autopilot flies the ship until Enter/tap; Shift or a
double-tap fires the Force pod; holding Space charges a beam; procedural
cave walls narrow with distance; kills chain into a streak multiplier. On
the Neon Dreams contract since 2026-09-06: violet-black ground, cyan
snapped to `#2ff3ff`, orange kept as the danger hue, gold as the multiplier
colour from x4.

## History

Built by Muse Spark via `/musecode` in three parallel variants; this one
won. The other two are in `git log`.

## R-Type mountain walls and weapon pickups (2026-09-08)

`themes/rtype/Shooter.vue` draws the cave as dark triangular rock faces with
fine violet mesh edges, matching the other games' mountain palette. The rim
uses world-anchored 64 px samples; drawing and ship collision use the same
linear interpolation, replacing the smooth cyan rims and separate spikes.
The world still rotates for portrait flight.

Gold capsules arrive after 8 seconds, then every 9 seconds, plus boss kills.
They cycle through G SPREAD (three-way gun), B WIDE (wider beam, six damage),
F TWIN (two angled pod shots), G RAPID (0.075 s firing interval), B QUICK
(0.4 s charge), F SEEKER (homing pod shots). Upgraded pods fire while attached
or launched. Each weapon has its own 20-second upgrade slot; collecting another
variant replaces only that slot. The three slots stack. Timers freeze while
paused or the ship is dead; losing a life clears upgrades and loose pickups.
Restart resets the drop sequence. Existing shots keep their launch properties.
Capsules show their letter and variant upright in either orientation; the top
left HUD lists active variants and remaining seconds. Controls are unchanged.

`npm run test:rtype` runs five regression tests for pickup cycling/stacking/
expiry, weapon behavior, reset/paused input and angular wall collision, in CI.
Verified 2026-09-08: all 93 tests, typecheck and an isolated production build pass; Chromium rendering at
1440×900, 375×667 and 667×375 with keyboard fire and injected upgraded loadouts
shows no page errors or document overflow. Emulated portrait touch holds fire
and releases a charged beam. Physical-phone performance is unmeasured.

