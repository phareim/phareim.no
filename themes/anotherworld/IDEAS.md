# Another Shore — idea sets (2026-09-06)

Four directions for how the theme could look, then shared ideas for character, death, level, mobile, and the profile. Written after `research.md` (Another World 1991) and `audit.md` (the live version). Each direction is self-consistent; do not mix them halfway.

## Direction A — Fixed frames (the Chahi way)

The screen never scrolls. The crossing is 6–8 authored shots, each a composition with its own horizon and negative space; walking off the edge hard-cuts to the next shot. Everything in a shot is drawn once to an offscreen canvas and blitted; only the figure, the water line and the lamp move.

- Shots (left to right): **1 tide pool** (figure surfaces, waist deep, sky 70 %), **2 the arch** (a black foreground arch fills the left third; the figure walks under it, tiny), **3 causeway** (broken slabs, sea both sides, the moon dead centre), **4 the stair** (a cliff face, descending ledges, the sea below), **5 the beast** (a silhouette on a far rock that turns to look; it does nothing this time), **6 the tower base** (huge, the figure 1/12 of the height), **7 the lamp** (close: the figure and the lamp at the same size, the only close shot).
- Palette: 16 entries, 8 base + 8 lit. Base: sky, far rock, mid rock, near rock, sea, ground, skin, shirt. Lit: each of those one step toward the moon colour. A moonlit face of a rock uses the lit index of the rock, never a new colour.
- Shot 5's beast is 3 colours: near-rock black, moon-white eyes, nothing else.
- On portrait phones each shot is re-composed tall (horizon at 60 %, figure lower), not cropped: a second vertex list per shot, or the same list with a per-shot portrait transform (scale + offset) chosen by hand.
- No HUD at all. Progress is the lamp count on the tower, visible in shot 6 and 7. Pause is a dim of the palette (every index one step darker) plus one line of Space Mono at the bottom.
- Profile: the name and blurbs are shot 0, the title card: a black frame, the name in Space Grotesk 300, then it cuts to shot 1. On the idle landing, shot 0 is the profile with shot 1 running small behind it? No: the profile sits over shot 1's sky; shot 1 is the attract loop (figure surfaces, wades, climbs out, cut to black, repeat).

## Direction B — Night tide (the current direction, done properly)

Keep the scrolling camera and the engine. Fix the composition.

- Ground line at 84 % of the height, never lower. The 16 % below is the near-black foreground band. The sky is 55 % or more.
- Three background layers, all with mass: **far** = 3–4 monoliths per screen width, 30–60 % of the screen tall, flat-topped or broken, leaning; **mid** = a single continuous cliff silhouette with an arch every ~1400 units the figure walks under (the arch is drawn in the near layer so it passes in front); **near** = black rock and stiff plant silhouettes along the bottom edge, 0.9 parallax, sometimes rising to 40 % of the height to frame a shot.
- The sea is one flat field with a horizon line and two lighter bands only under the moon; no stripes elsewhere. Water motion: one band shifts x by 1 px every second, nothing more.
- Moon: keep it large but move it to the upper left so the profile can sit in the sky's empty half on desktop, and put it above the horizon on portrait; it never overlaps a monolith (draw monoliths so the tallest is under the sky's other side).
- Platform edges read from silhouette: a platform is a slab whose top is a lit index band of 3–4 px and whose right end is a broken diagonal. Remove the pale corner ticks.
- Lit/unlit: everything facing the moon (left sides of slabs, top faces) uses the lit index of its base colour. That is the whole lighting model.
- HUD: remove the boxes. Beacon count becomes small amber dots low in the right corner in Space Mono; pause/exit become one line of text top right with no border and no background. Touch buttons stay but are outlines only.
- Deaths get animations (see below). Hazards become things with shape: a tide surge (a lit band that rises over a low slab on a 4 s cycle, visible before it kills), a rockfall (a dark wedge that drops when the figure passes a cracked ledge), a sea creature silhouette that lunges from a gap.

## Direction C — The palette turns (light as narrative)

Either A or B as the base; the addition is that the crossing happens while the light changes, and the light change is a palette remap.

- Four palettes for the same vertex data: **dusk** (warm grey sky, the shirt almost matches the sky, the moon barely there), **night** (the current petrol), **storm** (everything one step darker, then a single frame of all-lit for the lightning), **dawn at the tower** (the sky takes the skin tone, a Chahi trick: the figure's colour becomes the sky's).
- Palette advances at each beacon. The last beacon lit = dawn. On the win overlay the world is at dawn and stays.
- Cheap to implement: one `palette[index]` array, every draw call indexes it, a 400 ms crossfade is NOT allowed (gradients); the swap is a hard cut on the frame after the beacon lights, like the original.
- Reduced motion: no lightning frame.

## Direction D — Silhouette shore (the Playdead foil)

Near-monochrome: 5 values of one blue-black, and the shirt as the single accent. Fog by value bands, not alpha. Included so the choice is explicit: it is the easier look and the less Chahi one. Not recommended, because the site already has dark neon themes and the point of this theme is colour discipline, not darkness.

## Shared ideas

**Character.** 22×52 stays. Proportions: head 7 units, torso 18, legs 27. Run cycle as 6 held key poses at 12 fps (contact, down, pass, up, contact, down), not a sine swing: the rotoscoped weight comes from the pass pose being held and the contact pose being long. Standing jump = short hop; running jump = the current long arc. Landing from a high fall = a 250 ms crouch pose before control returns. Idle = one breath every 3 s (torso 1 px). Facing flips by mirroring; the shirt is the only accent so the figure reads at 1/12 screen height.

**Deaths.** One hit kills, and the world does not reset instantly. Each cause has a 700–900 ms vignette, then a hard cut to the checkpoint: **fall** = the figure drops out of frame, the camera does not follow, one beat of the empty landscape; **tide** = the lit band covers the figure, it is gone when the band retreats; **rockfall** = the wedge lands, the figure is under it, the wedge stays; **beast** = the silhouette closes over the figure, then is gone. Deaths count nowhere visible. Threat is always visible before it is lethal: the tide band shows on the slab two cycles before the figure reaches it; the cracked ledge has a lit crack.

**Level as places.** Whatever the direction, the crossing needs three different places, not three densities of gap: **the shore** (flat, tide pools, teaches run and jump; the first beacon is a stranded lamp post), **the causeway** (slabs over water, the tide, the arch), **the tower** (vertical: three ledges up the base, the rockfall, the lamp at the top; the finish is climbing onto the lamp platform and the lamp lighting).

**Mobile.** Portrait: the sky is the profile's space; the ground line at 80 %; touch buttons as three thin outlined zones at the very bottom (◀ ▶ left half, jump right half) rather than boxes floating mid-scene. Landscape: the profile column max 200 px, the start button never wraps, the hint hidden. The game stays horizontal in both.

**Profile as prologue.** Idle: profile upper-left over the sky, chapter label "another shore", start as an underlined Space Mono line. Starting is a hard cut: the profile is gone the same frame. The win state: the lamp lights, the palette turns to dawn, the name returns in the sky in small type, then the two buttons. No "Signal reached" box.

**Sound.** None by default. If ever: footsteps on rock, the tide, one sting at the lamp. Never a loop.

## Assignment

- **Fixer** (in place, `themes/anotherworld/`): Direction B, with C's palette turns if it fits, the shared ideas, the audit's items. Keep engine.ts and the tests.
- **Fresh** (new theme `themes/shore/`): Direction A, fixed frames, with C's palette turns. Own engine, own tests, own shell. Same site contract.
