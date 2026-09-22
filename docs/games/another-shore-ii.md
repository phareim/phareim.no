## Another Shore II (2026-09-06)

`?theme=shore` selects **Another Shore II**, a second take on the Another
World homage built from scratch on branch `aw-fresh`. **Parked 2026-09-07**
(`disabled: true`): out of the swipe order, still reachable by deep link.
It is: fixed frames and hard
cuts instead of a scrolling camera. Registered directly after `anotherworld`
in `themes/index.ts` (live, `themeColor` = the night sky). `themes/shore/`
holds `DESIGN.md` (the shot list, palettes, movement, death vignettes,
module contract), `types.ts`, `palette.ts` (four 16-entry palettes: dusk →
night → storm → dawn, `dim()` for pause, `flash()` for lightning), `shots.ts`
(seven shots, each authored twice: 320×200 landscape and 200×320 portrait;
walkable solids in stage units), `engine.ts` (pure, deterministic:
`createWorld`/`stepWorld`/`demoInput`), `renderer.ts` (Canvas 2D, flat fills
through the palette array only, cached backgrounds) and `Landing.vue`.

Shots: tide pool → the arch (crouch under a lintel) → causeway (two long
jumps, a tide that covers one slab) → the stair (steps cut into a cliff) →
the beast (turns its head, harmless) → tower base (rockfall wedge, three
ledges) → the lamp (the one close shot). Three beacons turn the palette; the
lamp is the third and the win. Deaths are 0.75–0.9 s vignettes then a hard
cut to the last beacon. No HUD (progress is the tower's lamps), no sound.
Keys: arrows / A D, Space / ↑ / W, ↓ / S crouch, P / Esc, Enter. Touch: four
thin outlined zones along the bottom (◀ ▶ | ▼ ▲); the frame fits above them.

`npm run test:shore` (16 engine tests, in CI after `test:anotherworld`).
Verified 2026-09-07 in headless Chromium at 1440×900, 375×667 and 667×375:
idle attract loop, play, pause, `/about`, `/nope`, reduced motion, emulated
touch zones, and a deterministic keyboard replay of the autopilot to the win
overlay. Dev-only gotcha: in a git worktree whose `node_modules` is a symlink,
Vite refuses the @fontsource files (403) unless the real path is added to
`vite.server.fs.allow` (a local `.nuxtrc`, not committed).

