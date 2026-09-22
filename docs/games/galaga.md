## Galaga (2026-09-08)

`themes/galaga/Galaga.vue` keeps the starfield and vertical shooter,
with cyan player/bolts/HUD, pink enemies, gold pickups and violet-black ground.
Six drifting rocks use irregular triangulated heightfields, dark shaded faces
and fine violet edges matching the shared mountain renderer. Rocks and stars
move in idle and play; reduced motion stops the backdrop and steering parallax.
Pause freezes both gameplay and the backdrop.

Waves cycle through small scouts, a curved squadron from the left, one from the
right, and three larger armoured ships. Side squadrons keep their spacing,
point along their flight path, fire only on screen and leave at the opposite
edge. Armoured ships take three hits, show remaining armour and award 250
points; scouts award 100. Bosses scale to the viewport (about 147–210 px body
size), have layered wing panels, engine pods, a recessed reactor and two gun
ports. They start at 18 HP, scale with weapon level, and retain the 500-point
reward and screen-clearing shockwave.

`npm run test:galaga` tests both side entrances and exits, armour damage and
scoring, boss bounds/gun ports, and mesh recycling/reduced motion. Included in
CI. Verified 2026-09-08: all 67 tests, typecheck and production build pass; Chromium keyboard
start/pause at 1440×900, 375×667 and 667×375 has no page errors or overflow.
Production renderer encounter screenshots checked at desktop and phone sizes.
Physical-phone performance has not been measured.

**Renamed 2026-09-08.** The theme was called *Cyberpunk* under the id `hacker`,
which described the palette it now shares with every other theme. Curved
squadrons entering from the edges and a recurring boss are Galaga's, so the
name follows the lineage like Breakout, R-Type, Space Invaders and Tetris do.
The id changed with it: the directory is `themes/galaga/`, the game component
`Galaga.vue`, the test `npm run test:galaga`, the D1 `game` column `galaga`
(migration `0003_rename_hacker_to_galaga.sql` moves the Hall of Fame rows) and
the localStorage key `galagaHighScore` (falling back to `hackerHighScore`
once). Old links and cookies still work: `LEGACY_THEME_IDS` in
`themes/index.ts` maps `hacker` onto `galaga` before the id is resolved.

## Galaga overhaul — bestiary, hull, radio, deep field (2026-09-12)

`?theme=galaga` skalerte aldri: 4 bølgemønstre, 2 powerups, one-hit death,
ingen lyd. Omskrevet til tre filer etter Star Fox/OutRun-mal:
`themes/galaga/balance.ts` (ren tuning, ingen Vue/DOM — alle
vanskelighetsfunksjoner av `wave`/`bossNum`),
`themes/galaga/audio.ts` (full radio-sequencer etter `outrun/audio.ts`:
tre originale chiploops STARDUST RUN 128 / VOID CHOIR 96 / BULLET BALLET
142, M eller tap øverst til høyre sykler stasjon, valget i
`localStorage.galagaRadio`, intensitet følger wave-tier + boss-transponering
+2, one-shots for alt) og `Galaga.vue` (wiring, canvas, HUD).

**Bestiary:** 10 kinds (`ENEMY_STATS` i balance.ts) — scout/squadron/heavy
pluss diver (selvmords-stuper), weaver (sinus), sniper (lanesøker, raskeste
kuler, max 2), splitter (2 HP, popper til 2 mites som aldri spawner
direkte), bulwark (5 HP, 3-skudds vifte, max 1, fra wave 12) og stinger
(2× formasjonsfart, ett skudd). 7-mønsters rotasjon. **Skalering:**
`waveIntervalFor` 2500→1100, `enemySpeedMul` +3 %/wave cap +80 %,
`shootChanceFor` 0.5→0.9, `boltSpeedFor`, `heavyHpFor` 3→5, speider-veteraner
2 HP fra wave 6, boss hver `bossEveryFor` 25→14 s med
`bossMaxHpFor(n,w) = 24+6n+2w` (**frakoblet `bulletLevel`** — den gamle
`18·1.35^(bulletLevel-1)` straffet sterke spillere), fan 2→3 kuler fra boss
#3, bounty `500+250n`. Tiers 1–4/5–9/10+/15+.

**Hull:** `HULL_MAX = 5` med 1.2 s blink-invuln, ett våpentinn ned per treff
(aldri full wipe), boss-kill healer 1. S-kapsel healer først, ellers skjold,
ellers våpen; AEGIS er 2-treffs skjold; D-eskorten ofres før skroget (også
mot ramming). Pity: hull ≤ 1 + >20 s siden S tvinger S. **9 kapsler:**
S/P pluss D (dual), R (hekkskudd), A (aegis), T (slow-mo 0.6×), N (nova
skjermbombe), M (magnet), C (2× score-timer); chain-combo (1.5 s-vindu)
stabler oppå til x4 med gullringer. Spawn-vektet (`pickPowerup`), max 3
fallende. Canvas-HUD: 5-segment hull-bar (cyan→gull→blinkende pink), WAVE,
xCOMBO, stasjon.

**Bakgrunn/effekter:** 4 pre-renderede nebula-blobs, planet-bue med ringer,
stasjons-silhuett med blinkende vinduer, warp-streaks ved wave-start —
ingen horisont/sol i skuddlinjen (sjangerlesbarhet). Kill-shatter,
chain-ringer i gull, boss-cinematic (flash + shake + 90 ms hit-stop +
gullring + heal), muzzle flash, screen shake. `MAX_PARTICLES = 300` med
pool, `mobileFx` (<600 px: 0.6× partikler, ingen `shadowBlur`), alt nytt
gatet på `reducedMotion`.

**Tester:** `npm run test:galaga` kjører nå tre filer (29 tester, inkl.
soak-testen som autospiller ~3 min: waves > 10, boss ≥ 1, partikler/powerups bounded):
`galaga-game` (12: alle gamle + hull/escort/shield/sniper/splitter/bokstaver),
`galaga-balance` (8: pinner alle formler + regresjon på frakoblet boss-HP),
`galaga-audio` (3: spor/voices/parser). CI uendret (én linje).

**Review-fikser (2026-09-12, samme dag):** åtte feil funnet av
`/code-review` og rettet. Chain-combo-ringene er nå kosmetiske
(`triggerShockwave(…, lethal=false)`); alle drap går gjennom
`damageEnemy`/`killEnemy` (kuler, nova, boss-/nova-ringer, ramming), så
score, mites og lyd er konsistente og ramming under blink-invuln er ikke
gratis drap; `killBoss` deles av kule- og nova-stien (bounty/heal/cinematic
også ved nova-kill, intensitet resettes bare når ingen boss lever);
formasjonsfiender integrerer x inkrementelt (ingen teleport når tempo eller
wave endrer `foeMul`); `fadeMusic` sporer timeren sin så rask restart ikke
dreper musikken; S kan spawne med skjold oppe når hullet ikke er fullt
(`hullFull` i `pickPowerup`, pity krever ikke lenger `!shield`);
`shootChance`-rullet skjer én gang per cooldown; `intensityFor` bruker
`waveTier`. 29 tester (6 nye regresjoner). Kjent, ikke rettet: sniper-cap
ikke håndhevet (`Math.max(1, count)`), deep field re-allokerer canvas ved
hver resize, radiohint tegnes på touch, ~100 Web Audio-linjer duplisert
fra `outrun/audio.ts`, leaderboard-cap 500 000 kan nås av gode runs.

