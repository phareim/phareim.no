# Another Shore II

Design notes, 2026-09-06. A homage to Éric Chahi's *Another World* (1991),
built as fixed frames with hard cuts. The research brief it follows is
summarised in the checklist at the end.

## The picture

The screen never scrolls. The crossing is seven authored shots; walking off
an edge hard-cuts to the next. Every shot is drawn once to an offscreen
canvas (bleed, scenery, walkable solids) and blitted; only the figure, the
water dashes, the tide band, the rock, the beast's head, the beacon lamps
and the foreground layer move.

Each shot has its own horizon and negative space, in two compositions: a
320×200 landscape frame and a 200×320 portrait frame. Portrait is authored,
not cropped: the same stage (walkable geometry) is placed lower in a tall
frame under a bigger sky, with its own scenery. Odd viewports are fitted by
width; the height may be cropped at most 20 % (centred) and is otherwise
extended with the composition's bleed colours (sky above, ground below,
near-black at the sides). While touch zones are on screen the frame fits
above them (`bottomInset`).

| # | Shot | Horizon (landscape) | What it is for |
|---|------|---------------------|----------------|
| 0 | tide pool | 70 % sky | the figure surfaces, wades, climbs a 26-unit step; beacon 1 is a stranded lamp post |
| 1 | the arch | 52 % sky | a black arch fills the left third; the figure is 1/10 of the frame; a low lintel forces a crouch |
| 2 | causeway | 64 % sky, moon dead centre | three slabs over the sea, two long jumps, one slab the tide covers on a 4.5 s cycle |
| 3 | the stair | 60 % sky, upper right | steps cut into a cliff face, crevices between them, the sea beyond; beacon 2 on the landing |
| 4 | the beast | 55 % sky | a silhouette on a far rock turns its head as the figure passes; harmless this time |
| 5 | tower base | a slit of sky | the overhang with the cracked wedge, the tower as a black mass with three lamps, three ledges up |
| 6 | the lamp | 61 % sky | the one close shot: the figure and the lamp at the same size |

Figure scale is per shot: 22×52 stage units drawn at `s` = 0.5 (13 % of the
frame height), 0.4 (arch, tower base) or 1.0 (the lamp). Portrait uses
`s × 0.625` so the stage spans the width in both.

## Colour

Sixteen entries per palette, like the Amiga: 0–7 base (sky, far rock, mid
rock, near rock, sea, ground, skin, shirt), 8–15 the lit variant of each.
Every fill in `renderer.ts` is `palette[index]`; there are no gradients,
alpha, strokes, shadows or dithering. The moon is the lit skin (14): the
figure's face and the sky's highlight share a slot. The tide band is lit sea,
a moonlit rock face is the lit index of its rock, the beast is near-black
with lit-skin eyes.

Light is a palette swap. Four palettes are the four acts: **dusk** (warm
grey; the shirt almost matches the sky; the moon barely there) → **night**
(petrol, coral shirt) at beacon 1 → **storm** (one step darker, a pale lit
ramp) at beacon 2, with one all-lit lightning frame at the turn and a strike
every 7 s → **dawn** at the lamp, where the sky takes the skin tone and the
figure's face becomes the sky. Pause is `dim()` (every index darker) plus one
line of Space Mono. Reduced motion skips the lightning frame and the attract
loop.

## Movement and death

Stage units, y down. Run 160 u/s, gravity 1500. A standing jump is a short
hop (36 up, no drift); a running jump is the long arc (53 up, ~107 across)
with committed velocity — no air control, but a jump into a ledge slides up
its face and lands on top once the feet clear it. Crouch (30 tall) on ↓ or
forced under a low ceiling; walking up a step of ≤ 28 needs no jump (the
wade out of the pool). A drop of more than 90 units costs a 250 ms landing
crouch. The run is six held key poses at 12 fps: contact, down, pass, and
their mirrors; the pass pose with the knee high carries the weight.

One hit kills. Each death is a 0.75–0.9 s vignette, a 0.3 s black frame,
then a hard cut to the last beacon: **fall** — the body keeps falling out of
frame, the camera does not follow; **tide** — the lit band rises over the
figure and it is gone when the band retreats; **rock** — the wedge lands, the
figure is under it, the wedge stays and becomes terrain (hop over it). Every
threat is visible before it is lethal: the tide's rest position shows under
the low slab from the first frame and rises for 0.6 s before it covers; the
wedge hangs under a lit crack; the gaps are gaps. Deaths are counted nowhere
visible.

## Shell

No HUD. Progress is the lamps on the tower (shots 5 and 6). Idle is the
profile upper-left over the tide pool's sky while shot 0 plays an attract
loop (surface, wade, climb out, cut to black, repeat) that never reaches the
beacon. Start is a hard cut: the profile is gone the same frame. Win: the
lamp lights, the palette turns to dawn, the name returns small in the sky,
two plain underlined lines (walk again / leave).

Keys: ← → / A D run, Space / ↑ / W jump, ↓ / S crouch, P / Esc pause, Enter
start. Touch: four thin outlined zones along the bottom edge (◀ ▶ | ▼ ▲),
pointer-captured, multi-touch safe; they only appear on coarse pointers. The
crouch zone is an addition to the brief's three zones because the lintel
cannot be passed without it. No sound.

## Modules

- `types.ts` — stage/frame coordinate contract, `Shot`, `World`, `Input`.
- `palette.ts` — the four 16-entry palettes, `dim()`, `flash()`.
- `shots.ts` — the seven shots: solids and hazards in stage units, two
  compositions each as vertex lists, beacons, start.
- `engine.ts` — pure and deterministic: `createWorld({attract?})`,
  `stepWorld(world, input, dt)`, `demoInput(world)`, `tideTop()`.
- `renderer.ts` — `createRenderer().draw(ctx, world, W, H, dpr, {dim,
  allowFlash, bottomInset})`; background cache keyed by shot, orientation,
  palette state and viewport (LRU of 6).
- `Landing.vue` — loop, input, profile / pause line / win line / touch zones.
- `tests/shore-engine.test.mjs` — `npm run test:shore`: shot transitions at
  both edges, the wade step, hop vs long jump, the forced crouch, one death
  and respawn per hazard kind, beacons and palette turns with the lightning
  frame, the beast, dt clamping, determinism, the attract loop, and a full
  autopilot traversal to the lamp without a death.

## Checklist from the research brief

1. Fixed screens, hard cuts — yes. 2. ≤ 16 colours per scene — 16. 3. Base +
lit ramp — yes. 4. No outlines/dithering/gradients — none. 5. Light = palette
swap — dusk/night/storm/dawn, lightning, pause. 6. Silhouette + one accent —
the shirt. 7. Character small; close framing for one beat — 1/10 to 1/8 of
the frame, close only at the lamp. 8. No HUD — the tower's lamps. 9. One hit
kills, readable death, threat visible first — yes. 10. Cheap checkpoints —
three beacons. 11. Weighty, key-posed motion — six held poses, committed
jumps. 12. Silence — yes. 13. Cached background canvas — yes. 14. Reuse
palette entries — moon = lit skin, tide = lit sea, trousers = far rock. 15.
Composition, not letterbox; tall compositions on portrait — yes.
