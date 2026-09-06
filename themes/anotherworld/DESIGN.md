# Another shore

Design note, revised 2026-09-06 after the first version was audited. An
original cinematic platformer in the manner of Another World (1991): flat
polygons, one palette per scene, a small figure against big shapes, deaths
that tell you something. This is what is built, not what was planned.

## Composition

The ground line sits at 84 % of the height (80 % on portrait phones). The
sea horizon is 22 % above it. Everything above the horizon is sky and
silhouette; the sea is one flat field between horizon and ground; below the
ground line the slabs' bodies run down into a near-black foreground band
with rock humps and stiff plant blades (parallax 0.9). Three background
layers, all with mass:

- **far** (parallax 0.2): monoliths on the horizon, 3–4 per desktop width,
  flat-topped or broken, leaning, with a lit strip on the side facing the
  moon. Their tops are capped below the moon so the two never cross.
- **mid** (parallax 0.5): one continuous headland silhouette on the horizon
  — shelves, stacks and notches; every slope that descends to the right is
  lit.
- **near** (world-anchored, drawn in front of the figure): two black arches
  the figure walks under, the cracked overhang in the tower section, the
  foreground band.

The moon is screen-fixed top right (top-right corner on portrait, beside
the profile copy) with two lit bands under it on the sea; the lower band
shifts one pixel every second and that is all the water does. Slab edges
read from silhouette: a 3–4 px lit top band on the collision line and a
broken diagonal at the right end. No corner ticks, no outlines, no
gradients, no alpha.

## Palette

Sixteen entries, drawn through one array: indices 0–7 are base hues (sky,
far rock, mid rock, near/black, sea, slab, skin, shirt), 8–15 the same hues
one step toward the moon. Every lit face is `base + 8`; that is the entire
lighting model. Reuse is deliberate: the moon is lit sky, the amber lamp is
lit skin, trousers are lit near-black.

Four palettes share the vertex data and turn on a hard cut at each beacon:
**dusk** (violet-grey blue hour, moon barely there) → **night** (petrol) →
**storm** (night one step darker; a single lit frame every 6.5 s is the
lightning, skipped under reduced motion) → **dawn** (the sky takes the skin
tone, so the figure's face becomes the sky's). Pausing draws the current
palette one step darker. The Vue shell flips its ink to dark at dawn.

## Figure

22×52, head 7 / torso 18 / legs 27. Six held run poses at 12 fps (contact,
down, pass, mirrored), a standing hop and a running long jump, a fall pose,
a 250 ms landing crouch after real drops, one held breath every 3 s while
idle. Limbs are flat quads; the coral shirt is the only accent.

## Places and threats

The crossing is three places. **The shore**: flat, one small gap, a low
rock, a stranded lamp post (beacon 1). **The causeway**: slabs over water,
an arch, and the tide slab — a lit band of water that rises visibly for
0.6 s before it is lethal, stays up 1.2 s, retreats, on a 4 s cycle;
another lamp post on the last slab (beacon 2). **The tower**: a black
overhang with a lit crack and a rock wedge hanging under it; passing the
trigger drops it, and it lands as a rock that stays. Then three solid stacks
up to the platform at the tower's foot, where lighting the big lamp wins.

Deaths are vignettes of 0.8 s, then a hard cut to the checkpoint: a fall
keeps falling out of frame while the camera holds on the empty landscape;
the tide covers the figure and it is gone when the band retreats; the rock
lands on the figure and stays. Deaths are counted in the world and shown
nowhere.

## Chrome

Idle: profile unboxed upper left over the sky, chapter label, name, blurbs,
socials, an underlined Space Mono start line. Playing: one line of text top
right (pause · exit), three small dots low right for the beacons (amber
when lit), and on touch devices three thin outlined zones in the black
band (◀ ▶ jump), placed above the site's pager dots. Paused: the palette
dims and one line says so. Won: the world stays at dawn, the name returns
in the sky in small type with two plain text buttons. No boxes anywhere.
No sound.

## Modules

`types.ts` — world units, y down; player x/y is feet centre; hazards are a
discriminated union (`tide` | `rockfall`); `world.dying` is the vignette.
`engine.ts` — `createWorld()`, `stepWorld(world, input, dt)`,
`demoInput(world)` (waits for the tide and the rock), `tideLevel()`,
and the renderer's landmark constants (`ARCHES`, `OVERHANG`, `TOWER`). No
runtime imports, so the node test can transpile it alone.
`renderer.ts` — `drawWorld(ctx, world, width, height, { reducedMotion,
paused })` and `paletteNameFor(world)`; computes its own camera and draws
at CSS pixel size (the caller applies devicePixelRatio).
`Landing.vue` — the loop, input, phases and chrome.
`tests/anotherworld-engine.test.mjs` — 14 physics and level tests, in CI.
