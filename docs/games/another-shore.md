## Another Shore (2026-09-06)

`?theme=anotherworld` selects **Another Shore**, an original sidescrolling
platformer in the manner of Another World's flat polygon landscapes. First
in the live theme rotation. `themes/anotherworld/` holds `types.ts`,
`engine.ts` (pure physics + the authored level, no runtime imports),
`renderer.ts` (Canvas 2D through a 16-entry palette array) and
`Landing.vue` (loop, input, chrome). `DESIGN.md` there describes what is
built.

Reworked 2026-09-06 after an audit of the first version (branch `aw-fix`):
ground line at 84 % (80 % portrait), three background layers with mass
(monoliths, a headland, black arches and a foreground band), the sea as one
field with a horizon, moon top right clear of the profile and the
monoliths, slab edges from silhouette plus a lit top band. Sixteen colours
— 8 base + 8 lit — and four palettes that turn on a hard cut per beacon:
dusk → night → storm (one-frame lightning, not under reduced motion) →
dawn. The figure has six held run poses at 12 fps, hop vs running jump, a
landing crouch. Hazards have shape and show before they kill: a tide surge
on a 4 s cycle and a rockfall from a cracked overhang; deaths are 0.8 s
vignettes, then a hard cut to the checkpoint. The level is three places —
shore, causeway, tower — and the finish is climbing to the lamp. No HUD
boxes: beacon dots, pause/exit as text, outlined touch zones above the
pager dots. No sound.

Idle runs the same simulation on autopilot (it waits for the tide and the
rock, never dies, and holds the dawn 2.5 s before restarting); reduced
motion leaves the idle scene still. The game stays horizontal on phones
with a cropped following camera. No external assets, network calls or new
dependencies. Palette tokens also cover the content routes and the 404
block.

`npm run test:anotherworld` runs 14 engine tests (physics, tide, rockfall,
vignettes, demo traversal without deaths), also in CI.

Verified 2026-09-06 in headless Chromium: 1440×900, 375×667 and 667×375,
keyboard and touch, pause, the four palettes, a fall vignette, `/about` and
`/nope`; no console or page errors. (In a git worktree whose `node_modules`
is a symlink into the main clone, the dev server 403s the `@fontsource`
woff files — Vite's fs allow-list — so text renders in fallback fonts there;
the main clone and production are unaffected.) Move with arrows or A/D,
jump with Space/Up/W (hold for the full arc), pause with P/Escape.

