# Galaga

A vertical shooter in the Galaga mould, on the Neon Dreams palette: cyan
player and HUD, pink enemies, gold rewards, violet-black ground. The title
screen waits for Enter or a tap. Current state verified 2026-09-23.

## Files

| File | Job |
|---|---|
| `themes/galaga/Galaga.vue` | Game loop, update, drawing, HUD, input |
| `themes/galaga/balance.ts` | Pure tuning: hull, difficulty ramps, bestiary, capsules, boss, SYNC |
| `themes/galaga/weapons.ts` | Pure volley patterns (SPREAD, LASER, SEEKER) and seeker steering |
| `themes/galaga/story.ts` | Sectors, the intercom script and the director that paces it |
| `themes/galaga/sprites.ts` | Sprite atlas: every ship, bolt and glow pre-rendered at the pixel ratio |
| `themes/galaga/Intercom.vue` | The intercom panel (DOM, typewriter) |
| `themes/galaga/audio.ts` | One-shot SFX; music comes from the global radio (`docs/games/global-radio.md`) |
| `themes/galaga/Landing.vue` | Title, game over, Hall of Fame submit, high score |

## Story and intercom

Relay station Kestrel has lost every channel to a song. The Choir, a swarm,
sings over the whole band, and each boss is a Cantor carrying one of its
voices. Claude rides in the ship's second seat and talks over the intercom.

- **Sectors.** Each boss ends a sector: KESTREL APPROACH, THE SHOALS,
  RINGFALL, CHOIR SPACE, CONDUCTOR'S NEST (boss: THE CONDUCTOR), then
  DEEP CHOIR I, II, … A sector opens with a banner, a Claude line and new
  nebula tints (`sectorFor` in `story.ts`).
- **Who speaks.** Claude in the person voice (lowercase Space Grotesk, gold
  spark portrait, cyan panel). The Choir in the machine voice (uppercase
  mono, pink panel) when a Cantor arrives and in the odd taunt from sector 3.
  `tests/galaga-story.test.mjs` checks the script against those rules.
- **What Claude says.** A briefing on the first run of a page load, a
  shorter line on retries, a first look at each new enemy kind and capsule,
  SYNC instructions, low-hull warnings, boss warnings and kills, sector
  openings, wave 10 and 25, a new personal best and the last word at death.
  The pilot is addressed by the Hall of Fame animal (`Neon Otter` → `otter`,
  `pilot` without a profile).
- **The director** (`createDirector`) queues lines by priority. 3 is story
  and interrupts; 2 is teaching; 1 is ambient and only lands after 9 s of
  silence. Cues can be once per page load (`SESSION_SEEN`, survives theme
  switches), once per run, or on a cooldown. A teaching line cut by a story
  beat is said again afterwards. Lines type at 26 ms per character and hold
  for 1.5 s + 32 ms per character, all on the game clock, so pause freezes
  the intercom too.

## Weapons and capsules

One weapon level (1–5) is shared by three modules. A hit costs one level;
it is never wiped.

- **SPREAD** (start): a fan of bolts, one stream per level, up to 70°.
- **LASER** (`L`): piercing lances, fastest fire rate; level adds lances.
- **SEEKER** (`H`): a forward bolt plus seekers on every other volley that
  pick the nearest on-screen target and turn at a capped rate.

`P` raises the level of the current module; `L` and `H` switch module and
keep the level (the same module raises it). Both appear from wave 3.

Other capsules, all gold hexes with a letter and a name tag: `S` heals a
hull segment, else shields the nose, else feeds the gun; `A` double shield;
`D` escort wingman that fires with you and takes the next hit; `R` rear gun;
`T` slow motion for enemies and their fire; `N` nova screen bomb; `M` magnet
for capsules and incoming fire; `C` double score. Timed capsules show as
chips with a draining bar on the HUD's sector line. At most three fall at
once; hull ≤ 1 with no `S` for 20 s forces one.

**SYNC** is the overdrive. Kills charge the meter (3.5 % per enemy HP, a
little per boss hit). When it is full, Shift (keyboard) or a second finger
(touch) hands the guns to Claude for 6 s: every enemy bolt on screen turns
into 10 points, the module fires at level 5, twice as fast, with seekers on
top.

## Enemies and bosses

Ten kinds (`ENEMY_STATS`): scout (bee), squadron (butterfly, side entry),
heavy (armoured beetle, 3–5 HP), diver, weaver (manta), sniper (shows a pink
sightline for the half second before it fires), splitter (pod that pops into
two mites), mite, bulwark (hex fort, three-way gun, from wave 12) and
stinger (wasp, flank run). At most two snipers are alive at once. Armour
shows as pips above the sprite. Squadrons, stingers, divers and mites turn
along their flight path.

Bosses are Cantors. The boss clock (25 s → 14 s) only runs while no boss is
alive, so each sector ends with exactly one. A Cantor cannot be hurt until it
has arrived on screen. It has `80 + 40·boss + 2·wave` HP (raised 2026-09-23
for the new weapons), a fan that gains an aimed bolt from the fourth boss,
a radial ring every 4th volley from the second (every 3rd from the fifth),
and below half HP it enrages: faster guns, damage smoke, and from the third
boss two mites at its side. Waves spawn at half rate during the fight. A
kill pays `500 + 250·boss`, heals one segment and opens the next sector.

## Hull, score, difficulty

Five hull segments with 1.2 s of blink invulnerability after a hit. Kills
within 1.5 s chain into a multiplier (up to x4 with `C`). Waves come every
2.5 s → 1.1 s; enemy speed, fire rate and bolt speed ramp with the wave
(`balance.ts`, pinned by `tests/galaga-balance.test.mjs`).

## Rendering and clock

- The world steps at a fixed 60 Hz on a simulated clock (`simNow`), so a
  120 Hz screen does not double the speed, and pause stops every timer.
- The canvas is backed at the device pixel ratio (capped at 2); game logic
  works in CSS pixels through `W()`/`H()`.
- `sprites.ts` bakes every enemy (two animation frames plus a white hit
  silhouette), the player ship (five bank angles, rebaked when the Hangar
  ship changes), the Cantor (per on-screen size), bolts, orbs, capsules and
  glow dots once. Sparks, bolts and glows draw additively; smoke is soft
  violet puffs.
- The deep field (nebulae, a ringed planet, Kestrel station), six drifting
  low-poly rocks and twinkling stars sit behind a vignette. Reduced motion
  stops the backdrop, the shake and the intercom animations.
- HUD: score top-centre (first line on phones, where the radio widget owns
  the top right), then hull, weapon module and level, SYNC meter, sector and
  wave, capsule chips. The boss bar sits under the score, or above the pager
  on phones. The intercom panel is bottom-left on wide screens, compact in
  the corner on short landscape screens, and under the HUD on phones.

`?theme=galaga&debug=galaga` exposes `window.__galaga` (`boss()`,
`give(type)`, `sync()`, `wave(n)`, `state()`) for screenshots and manual
checks.

## Controls

Arrows or WASD move, Space fires, Shift triggers SYNC, Esc tap or P pauses,
a 3 s Esc hold quits. Touch: drag to fly (the ship sits 80 px above the
finger and fires while touching), a second finger triggers SYNC. M cycles
the global radio.

## Tests

`npm run test:galaga` runs five files: `galaga-game` (the engine in a node
vm: waves, armour, bosses and entry shield, sectors, hull, escort, capsules,
weapon modules, seekers, SYNC, intercom, a three-minute soak),
`galaga-balance`, `galaga-weapons`, `galaga-story` and `galaga-audio`.

## Known gaps

- Physical-phone performance has not been measured.
- `audio.ts` still carries the old per-game chiptune sequencer, unused since
  the music moved to the global radio.

## History

The theme was called *Cyberpunk* under the id `hacker` until 2026-09-08.
`LEGACY_THEME_IDS` in `themes/index.ts` still maps `hacker` onto `galaga`,
migration `0003_rename_hacker_to_galaga.sql` moved the Hall of Fame rows, and
the landing reads the old `hackerHighScore` key once. Earlier passes (the
bestiary and hull on 2026-09-12, the radio move) are in `git log`.
