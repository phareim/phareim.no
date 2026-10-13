## Hangar — the pilot profile, high scores and adventures

`?theme=hangar` is a live theme, reached by the HANGAR door in the portal's arcade. The screen
fills with the pilot: portrait and name, then a STATUS block (games with a score, adventures
started), the HIGH SCORES (seven games, with rank) and the ADVENTURES rows (Neon Shrine: step n/N
and play time; Another Shore: `CH n/5` and play time; one row per save slot, or the best finish). Nothing
here is chosen: the ship bay and its ◀ ▶ picker went on 2026-10-13.

**Look** (2026-09-25, layout 2026-10-13): Neon Shrine's pixel look, like the games
(`docs/games/pixel-look.md`).

- *Backdrop* (`Horizon.vue`, scene in `pixel.ts`): a shrine-stone launch
  bay on the coast at dusk, on the shared pixel stage. Two stone pillars
  with braziers and cyan neon and a lintel with hanging lamps and a pink
  strip frame the bay's mouth; through it, the sea, the ridges and the
  striped sun. The deck runs out in perspective flagstones, and a launch
  rail of rose path between two rails carries running lights that chase
  out towards the sky. Reduced motion draws it once.
- *Panel*: `.px-box` (Neon Shrine's dialog box) with all text in the
  pixel font at 16 px (name 24/32 px). The box fills the screen; on a
  short phone its list scrolls inside it. The portrait (`PixelPortrait.vue`)
  is the pilot's painting shrunk into a 32×32 canvas and shown at 2×
  (4× on wide screens) with hard pixels; `avatarFull` from `/api/profile`,
  the thumbnail meanwhile.
- *Layout*: one flow on phones; two columns from 720 px (pilot and status
  left, high scores and adventures right, with the scores' column top
  aligned to the pilot). The top padding clears the radio, the bottom the
  ⌂ chip.

**Ships (no longer in the Hangar).** `themes/ships/ships.ts` is still the catalogue
the games read (colours + `dart`/`vandal` variant, plain TS shared client/server/tests).
`dart` is the starter; `vandal` unlocks at scores in 4 distinct games. The server still
validates the unlock (`POST /api/ship/select`, 423 when locked), and the pick is still
stored (`players.selected_ship`, localStorage `phareim.ship`), so a player who picked the
Vandal before 2026-10-13 still flies it in the ship games. `composables/useShip.ts` keeps
`readShipDef()` for the games and `loadProfile()` for the Hangar, but no longer exposes
`selectShip` to a screen. `themes/ships/three.ts` builds the low-poly model Star Fox uses.
Removing the Vandal and the server's ship columns is a separate change: it alters what
the games fly.

**Wiring.** Migration `0004_ships.sql` (`players.selected_ship`,
`player_ships` with reserved xp/level). `GET /api/profile?player=` →
bests + ships + selected + distinct count + `saves` (the adventure save
slots, see `docs/games/neon-shrine.md`). Unlock is derived live
from `COUNT(DISTINCT game)`, so no backfill. Games re-read the ship on
every start: R-Type (hull,
flame core, trim Force pod, vandal chin fin), Star Fox
(`scene/player.ts` builds it with the shared `buildPlayerShip` when the
theme mounts), Invaders (same 1978 silhouette in hull colour, trim base row,
hull-coloured bolts; glow cache keyed per colour). The Galaga cabinet no longer wears it
(2026-10-13): Rex & Nova: Space Voyagers I flies Rex's Wagon and Nova's Scooter, which are
bitmaps, and does not call `readShipDef`.

**Tests.** `npm run test:ships` (catalogue + unlock, in CI). The
2D harnesses (R-Type, Invaders) stub `readShipDef` (imports are stripped in the vm) and
assert reset/start re-reads the pick; R-Type also smoke-draws both
variants against an absorbing ctx stub. Verified 2026-09-09 (ship bay, since removed).
