# DESIGN.md — Neon Shrine art direction (approved 2026-09-21)

Handcrafted 16-bit top-down action adventure. LTTP influence is the goal:
solid pixel silhouettes, layered tile scenery, shaded canopy masses, stone
wall tops with vertical faces, dirt paths, water banks, door thresholds, an
expressive small adventurer. All assets are original code-drawn pixel maps —
no Nintendo assets. Implements the binding decisions from the 2026-09-21
assignment (Codex design, Muse implementation).

## Pixel grid

- Logical unit is 1/16 of a tile. Sprites are string pixel maps in
  `renderer.ts` (`SPRITES`), drawn with `fillRect` per logical pixel —
  always crisp, no smoothing anywhere (`imageSmoothingEnabled = false`,
  no scaled `drawImage` of art except the 1:1 tile-cache blit).
- Tile vocabulary is 16 logical px; sprites are 12–16 px, the boss 24 px
  (2× logical pixels, still crisp). World coordinates are unchanged
  (15×11 rooms, tile units), so engine, saves and tests are untouched.
- `tests/zelda-sprites.test.mjs` pins every map: rectangular, charset-only,
  hero has head/hood/torso/boots rows, each enemy kind has a distinct
  silhouette key.

## Palette (Neon Dreams discipline)

- Ground violet-black `#0b0616`, dark floor `#100826`. Terrain is muted
  plum/slate clusters (`#1c1233`, `#241743`, `#2e1f4d`, stone
  `#3a3f5e`/`#23263d`, dirt `#33232e`, wood `#4a3220`, clay `#6e3f2a`) —
  filled shaded shapes with restrained contrast, never every tile outlined
  in neon. The old vivid green (`#35f2c8`) and violet outlines are gone.
- Exactly three saturated accents: cyan `#2ff3ff` (hero, sword, interface),
  pink `#ff2fa0` (danger, enemies, telegraphs), gold `#ffd23f`
  (treasure, progression, lamps). White only as hit flash / blade core.
  Text is lavender (`#b9a8d9`), never pure white blocks.
- Luminous focal points per room are few by construction: sword pickup,
  chest gold trim, locked/boss doors, portal lamps, magic flashes. Glow is
  one soft under-pass plus a crisp core, only on those.

## Map composition

- Neighbor-aware tiles: stone walls merge into runs (cap highlight only
  where sky is above, face where mass is below), water draws banks and foam
  only against walkable tiles, trees vary canopy by deterministic hash.
- Walkable path reads as packed dirt (`,` tiles) against darker floor;
  solid boundaries are unbroken wall/tree/water runs; every portal trigger
  gets visible exit posts with small gold lamps, so exits are findable.
- No perspective grid on walkable terrain. The striped sun / stars / ridge
  live only in the letterbox around the room (subdued backdrop pass),
  never under combat.

## Hero and combat feel

- Hero: hood, face with facing eyes, cyan tunic, boots; down/up/side maps
  × 2 walk frames. Sword swing reuses engine timing (`SWING_TIME`):
  anticipation (lean back, p < 0.25), attack (lunge + stepped pixel arc +
  white blade at the leading edge, reach == `SWORD_REACH`), recovery.
- One clear hit flash (white, 80 ms) + knockback; no persistent glow, no
  shake beyond the existing ±4 px decay (off under reduced motion).
- Enemies have distinct silhouettes + readable facing: chaser (horned
  prowler, eyes lead), wanderer (squashing slime), turret (stone statue,
  eye brightens on telegraph), bat (2-frame wings), knight (shield plate
  on facing side), slimeKnight (crowned blob, pink spikes, gold body).
  Telegraphs are a single pink ring / bright eye, not pulsing auras.
- Reward pickup is a short gold square-burst; chest keeps one small ring.

## Layout and controls

- Fixed compact HUD strip above the room: pixel hearts, key count, room
  label (wide screens). Title/attract shows the live room with a compact
  NEON SHRINE bar and one start action — no panel hiding the scene.
- Portrait reserve (bottom 34 %) and landscape reserves (22 % each side)
  are the control deck: left thumb zone with a faint DRAG TO MOVE marker,
  SWORD + USE buttons ≥ 64 px, pause button; paused touch overlay offers
  RESUME + QUIT. The right-side hold-to-interact stays as a fallback, not
  the only path. Desktop keeps arrows/WASD + Space/J + E/K with concise
  hints. Stick has a 6 px dead zone; all pointers release on
  blur/hidden/cancel/unmount; navigation lock unchanged.
- Reduced motion: hard cuts, no bob/pulse/shake/particles, idle draws once.

## Non-goals (unchanged)

Parked status, theme id, engine determinism, saves (`zeldaSave` v1),
audio, progression, world content. No campaign expansion: the two phase-1
rooms only, made beautiful and navigable.
