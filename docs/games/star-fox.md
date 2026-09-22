## Star Fox: health, sectors, gunship boss (2026-09-08)

`?theme=starfox` runs endless sectors instead of one endless corridor:
TRAVEL (80 s) → WARNING (2.5 s banner, the field drains) → BOSS → CLEAR
(3 s banner, `1000 × sector` points + 40 hull) → next sector, harder.
The old 3-life shield is a 100 HP hull meter; bolts/rams/pillars/rocks
deal 12/25/20/20, rings heal 12, the weapon still downgrades a step per
hit, and the barrel roll still grants i-frames. The HP buffer pays for
fiercer enemies: sector-scaled fire intervals and bolt speed (floored),
shoot chance up to 0.95, formations of up to 5, plus snipers (sooner,
faster bolts) and diving kamikazes from sector 2/3.

**Bestiary (2026-09-08).** Sector 1 is drones only (onboarding). Sector 2
adds weavers (wide cyan sine strafe), dashers (lock the player's lane,
then boost past, never shoot) and snipers; sector 3 adds bulwarks (3 HP,
gold ring, slow heavy bolts, survive rams), splitters (2 HP, pop into two
diving mites) — mites never spawn directly. Per-kind HP/score lives in
`ENEMY_STATS` (`balance.ts`); pooled enemies are restyled per kind at
spawn (tetra/cone/icosa geometries, cyan/pink/gold mats). Kill score uses
the kind's value × multiplier.

**Obstacles (2026-09-08).** Pillars + rocks plus, from sector 2: mines
(pulsing gold icosahedra, proximity fuse near either ship, shootable for
75 × mult, chain-detonate) and arches (twin posts + lethal lintel with
violet edges — thread the gap). Spawn mix ~34/22/24/20 pillar/rock/mine/
arch; caps 6 mines, 3 arches, 2 bulwarks.

**Wingman (2026-09-08).** A gold-trimmed AI co-flyer with its own brain in
`wingmanAi.ts` (pure, tested). Modes: formation (echelon slot right-rear of
the player, `BUDDY_OFFSET`), hunt (picks its own target among enemies in the
−170…−10 z window — threat-weighted: kamikaze/mite/dasher first, sniper,
then rest, bulwark last; boss turrets over core — flies to the target's lane
with 0.45 s lead), regroup (target gone: back to slot), cover (player hull
below 30 HP: glued to slot). Sticky lock with 0.6 s retarget cooldown and a
cost margin so a diving kamikaze can steal the lock. Fires only with line of
sight (|dx| < 0.9, |dy| < 1.3) every 0.28 s (two bolts at weapon level 3)
through the shared laser pool, so its kills feed the same score/multiplier.
Callouts (TARGET LOCKED, BREAKING OFF, BACK IN FORMATION, I'M HIT, WING DOWN,
BACK ONLINE, COVERING YOU) reach the HUD as `WING ▸ …` for 2.2 s via the
`wingSay` event; otherwise `WING ● ONLINE` / `WING ○ nS`. 50 HP, draws
~35 % of enemy aimed fire (`BUDDY_AGGRO`), safe while you roll; death is an
explosion + 10 s respawn with 2 s invuln, pure formation in attract mode.

The sector boss is the DREADNOUGHT: a gunship that cruises in from deep
field, parks at z ≈ −60 and strafes while its turrets cycle aimed bursts,
a spread fan, a minion screen and mine-seeding. Only the gold core takes
damage (**55 hits + 20 per sector** — scaled for ~+60 % allied DPS, net
harder; gold bolts count double); **four** turrets (pod + upper-hull pairs)
can be shot off and regrow after 8 s. Aimed volleys alternate between you
and the wingman. Attack interval 1.6/1.35/1.15 s (enrage ×1.5 below 30 %),
fan 5/7/9 bolts widening per sector, minions grow from 2 drones to
weaver/sniper (sector 2) + bulwark/kamikaze (sector 3); the bolt pool is
96 and the laser pool 72 for the buddy's bolts.

HUD and boss meter share one bottom dock
(sector/score, hull cyan → gold → blinking pink under 30 %, banners,
hints, wing status; boss meter stacked on top while active) so the corridor
stays clear — the sector line hides until launch, and the attract ship flies a
little higher to clear the dock.

Files: `themes/starfox/Flight.vue` (scene + state machine), `Landing.vue`
(HUD dock, bars, banners), `balance.ts` (all tuning as pure functions —
`advanceSector` holds the travel/warning/boss/clear edges except the
kill, which lives in the scene; `bossAttackInterval`/`bossFanCount`/
`bossFanSpread`/`bossMinions` pin the boss ramp; `ENEMY_STATS` the
bestiary; `BUDDY_*`/`MINE_*`/`MAX_*` the wingman and obstacle caps;
`sectorPalette` holds the
four cycling backdrop palettes — violet dusk, emerald, ember, azure — cut
hard onto mountains, grid, fog and sky at every sector rollover),
`wingmanAi.ts` (the wingman brain),
`tests/starfox-balance.test.mjs` (21 tests, `npm run test:starfox`, in
CI), `tests/starfox-wingman.test.mjs` (17 tests, `npm run test:wingman`, in
CI). During BOSS the corridor crawls at speed 16 and only rings spawn
(the in-fight heal trickle).

Verified 2026-09-08: 21/21 tests, typecheck, production build, and live
headless-Chromium runs (shortened timers, reverted after) — travel with
the wingman scoring, sector-2 mines/arches/weavers, and the DREADNOUGHT
fight with its full bar, minions and mine-seeding, no page errors or
document overflow. One transient all-magenta frame
was a bolt passing point-blank past the camera, not a bug.

## OutRun — five stages and a fork in the road (rebuilt 2026-09-11)
