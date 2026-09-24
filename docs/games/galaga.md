# Galaga

A vertical shooter in the Galaga mould, drawn since 2026-09-24 in Neon
Shrine's pixel look (`docs/games/pixel-look.md`): cyan player and HUD, pink
enemies, gold rewards, a dithered violet night. The title screen waits for
Enter or a tap. Rules verified 2026-09-23, look 2026-09-24.

## Files

| File | Job |
|---|---|
| `themes/galaga/Galaga.vue` | Game loop, update, drawing, HUD, input |
| `themes/galaga/balance.ts` | Pure tuning: hull, difficulty ramps, bestiary, capsules, boss, SYNC |
| `themes/galaga/weapons.ts` | Pure volley patterns (SPREAD, LASER, SEEKER) and seeker steering |
| `themes/galaga/story.ts` | Sectors, the intercom script and the director that paces it |
| `themes/galaga/sprites.ts` | Source art: every enemy, the player ship and the Cantor as vector painters |
| `themes/galaga/pixel.ts` | The pixel art: those painters pixelized per pixel size, rocks, nebulae, planet, night sky |
| `themes/galaga/Intercom.vue` | The intercom panel (DOM, typewriter, Neon Shrine dialog box) |
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
- **Who speaks.** Claude in the person voice (written lowercase; gold
  pixel-spark portrait, cyan panel). The Choir in the machine voice (written
  uppercase; ring-and-waveform portrait, pink panel, glitching while it
  talks) when a Cantor arrives and in the odd taunt from sector 3. Both show
  in the 5×7 pixel font, which has only capitals.
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
- Drawing is on the shared pixel stage (`themes/base/pixel/`): a logical
  buffer at 3 CSS px per pixel on wide screens and ~2.3 on phones (about
  2.5 on phones with a pixel ratio of 2), lit by a light map, bloomed and
  scanlined. Game logic works in CSS pixels through `W()`/`H()`; `L()`
  converts when drawing.
- `pixel.ts` pixelizes the vector painters of `sprites.ts` at the current
  pixel size (`pixelize()`: palette snap, outline, top light), so every
  enemy keeps its silhouette at any screen size: two frames each, a white
  silhouette for the hit flash, 16 headings for the kinds that turn along
  their path (squadron, stinger, diver, mite). The player ship (five bank
  steps, per Hangar look, plus a small escort copy), the Cantor (per
  on-screen size) and the relay station the same way; all cached.
- Bolts are pixel streaks along their velocity (white head, coloured
  tail), enemy fire pink pixel discs and needles, shockwaves pixel rings,
  sparks single pixels with a light, smoke dithered puffs. Capsules are
  gold hexes with the letter in the 5×7 font and the name below. The engine
  flame is two flickering pixel columns; the shield a one-pixel arc.
- The deep field: a dithered violet night, per-sector nebulae as three
  dithered tones of the sector tint, a ringed planet shaded like the
  striped sun (pink rim on the lit side, the ring's back half behind the
  globe), Kestrel station, six drifting cratered rocks at parallax depths,
  twinkling one-pixel stars (they stay bright through the light map).
  Reduced motion stops the backdrop, the shake and the intercom animations.
- HUD (canvas, 5×7 font on the stage's HUD layer). Wide screens: score
  top-centre, then hull, weapon module and level, SYNC meter, sector and
  wave, capsule chips; the boss bar on the sector line. Phones and short
  landscape screens: two lines, about 8 % of a phone's height. Line 1
  (score, `S1 W2`) stays left of the radio widget; line 2 starts at the
  radio's bottom edge with hull, weapon and level, the SYNC bar, the
  multiplier and the chips. The boss bar is above the pager on phones and
  on the right of line 2 on short landscape screens. The intercom panel is
  Neon Shrine's dialog box: bottom-left on wide screens; in the corner
  without its name line on short landscape screens; on phones just under
  the HUD, where it sat before, clear of the ship and the thumb, with a
  smaller portrait and no name line. Title and game over use `.px-*`.

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
