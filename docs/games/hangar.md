## Hangar — the pilot profile and cross-game ships

`?theme=hangar` is a live theme, reached by the HANGAR door in the portal's arcade: the pilot
profile — portrait + name, the seven high scores with ranks, the
adventure rows (Neon Shrine: step n/N and play time; Another Shore:
`CH n/5` and play time; or the best finish) — and a 3D viewer of the
ship the player flies in every ship game. Ship browsing is ◀ ▶ buttons
only; nothing locks navigation.

**Look** (2026-09-25): Neon Shrine's pixel look, like the games
(`docs/games/pixel-look.md`).

- *Backdrop* (`Horizon.vue`, scene in `pixel.ts`): a shrine-stone launch
  bay on the coast at dusk, on the shared pixel stage. Two stone pillars
  with braziers and cyan neon and a lintel with hanging lamps and a pink
  strip frame the bay's mouth; through it, the sea, the ridges and the
  striped sun. The deck runs out in perspective flagstones, and a launch
  rail of rose path between two rails carries running lights that chase
  out towards the sky. Reduced motion draws it once.
- *Panel*: `.px-box` (Neon Shrine's dialog box) with all text in the
  pixel font at 16 px (name 24/32 px), ◀ ▶ and FLY THIS SHIP as
  `.px-btn`. The portrait (`PixelPortrait.vue`) is the pilot's painting
  shrunk into a 32×32 canvas and shown at 2× (4× on wide screens) with
  hard pixels; `avatarFull` from `/api/profile`, the thumbnail meanwhile.
- *Ship viewer* (`ShipViewer.vue`, an async component so three.js stays
  out of the initial bundle): Star Fox's Super FX pipeline. three.js
  renders into an offscreen WebGL canvas at a small logical size, Star
  Fox's quantize pass (`createPixelPipeline` in `themes/starfox/pixel.ts`)
  snaps it to the palette with a Bayer dither, and a second pixel stage
  scales it up with a light map (engine, wingtips, the pad's pink ring),
  bloom and scanlines. Its whole-number scale is the backdrop's, so the
  ship's pixels match the bay's. The hull colours are lifted towards the
  palette's grey-violet (unlit dark metal would vanish), the edge lines
  stay as the lit outline, the additive engine halo is off (the light map
  does it). The ship stands on a stone pad and swings between its two
  three-quarter views; mouse-drag turns it.
- *Layout*: one stacked box on phones (fits 375×667 and 390×844 with no
  scrolling: on short screens the tagline and nudge go, and the ship's bay
  is the one element that gives way), two columns on landscape phones,
  and two columns (pilot/scores · ship) from 1024×700. The top padding
  clears the radio, the bottom the ⌂ chip.

**Ships.** `themes/ships/ships.ts` is the catalogue both games read
(colours + `dart`/`vandal` variant, plain TS shared client/server/tests).
`dart` is the starter; `vandal` (gold hull, pink trim, wider striker
silhouette) unlocks at scores in 4 distinct games. XP/level columns and
`xpSlots`/`powerupSlots` are reserved for the next iteration — nothing
reads them yet. `composables/useShip.ts` holds the pick: localStorage
(`phareim.ship`) so canvases paint synchronously, `readShipDef()` for
games, server sync with silent fail. `themes/ships/three.ts` builds the
low-poly model both the viewer and Star Fox use — one builder, one ship.

**Wiring.** Migration `0004_ships.sql` (`players.selected_ship`,
`player_ships` with reserved xp/level). `GET /api/profile?player=` →
bests + ships + selected + distinct count + `saves` (the adventure save
slots, see `docs/games/neon-shrine.md`); `POST /api/ship/select` →
400 bad id/ship, 404 unknown player, 423 locked. Unlock is derived live
from `COUNT(DISTINCT game)`, so no backfill. Games re-read the ship on
every start: Galaga (hull + wide wings + trim cockpit), R-Type (hull,
flame core, trim Force pod, vandal chin fin), Star Fox (`buildShip`
delegates to the shared builder, engine flicker around the ship's base
size), Invaders (same 1978 silhouette in hull colour, trim base row,
hull-coloured bolts; glow cache keyed per colour).

**Tests.** `npm run test:ships` (catalogue + unlock, in CI). The three
2D harnesses stub `readShipDef` (imports are stripped in the vm) and
assert reset/start re-reads the pick; R-Type also smoke-draws both
variants against an absorbing ctx stub. Verified 2026-09-09: all suites
green, typecheck, production build, headless-Chromium DOM + console
checks on hangar/starfox/galaga/rtype/invaders (no JS errors), and a
live API round-trip (423 locked → unlocked at 4 games → select sticks,
400 on unknown ship).
