## Hangar — the pilot profile and cross-game ships (2026-09-09)

`?theme=hangar` is the tenth live theme, last in the rotation: the pilot
profile over the shared horizon — avatar + name, the seven high scores
with ranks, the adventure rows — Neon Shrine (step n/7) and Another Shore (chapter n/5), each with play time, or the best
finish; since 2026-09-23), and a 3D viewer of the ship the player flies in every ship
game. Wide screens (≥1024×700) spread it into two frames — pilot/scores
left with the portrait at full-painting size (88 px, `avatarFull` from
`/api/profile`), the ship in a larger bay right; narrower viewports keep
the single stacked panel (the cols dissolve via `display:contents`).
Ship browsing is ◀ ▶ buttons only (left/right still switch theme;
nothing locks navigation). The viewer is an async component
(`ShipViewer.vue`) so three.js stays out of the initial bundle, like
Star Fox; mouse-drag spins, touch is left to the shell's swipe.

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
