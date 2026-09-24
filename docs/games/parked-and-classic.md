# Parked and classic themes

Breakout and Tetris are live, older arcade themes that didn't have their own
doc yet. Scandinavian Glass, Space and Tufte Desk are parked (`disabled:
true` in `themes/index.ts`): no way in from the portal, still
reachable with `?theme=<id>`.

## Breakout

`?theme=breakout` — the arcade classic, added 2026-09-04. Same
canvas-behind-the-card pattern as Galaga; plays itself (autopilot) until
Enter. On the Neon Dreams design system: cyan paddle/ball/HUD, pink bricks
in three tints, gold armoured bricks and powerups, over the shared horizon
backdrop (`themes/base/neonHorizon.js`), which beats on every hit.

## Tetris

`?theme=tetris` — playable Tetris, ported from `tetris-theme-legacy` and
reworked for Neon Dreams: cyan active piece/ghost, pink stacked blocks, gold
line clears, shared horizon with lock/clear pulses. Drag sideways to move,
tap to rotate, fast down flick to hard drop, slow down drag to lower, up
swipe or HOLD to stash. ROTATE/DROP, pause/resume and exit buttons work on
touch and mouse. A gesture stops controlling pieces once its original piece
locks or swaps. The board sizes to its
actual remaining container space with ResizeObserver; landscape phones use
two columns. The profile column was removed — the cabinet is the whole
theme now, and the portal carries the person.

Tests: `npm run test:tetris` (gesture regression: tap, direction lock, drop,
soft drop, hold); CI runs it before typecheck.

## Scandinavian Glass

`?theme=scandi` — parked. `themes/scandi/Bubbles.vue` is the one Options
API component in the codebase (moved verbatim rather than ported to
Composition API).

## Space

`?theme=space` — parked. Starfield backdrop (`themes/space/Starfield.vue`).

## Tufte Desk

`?theme=desk` — parked. The tactile paper-on-desk layer from the tufte-viz
design system; it replaced an earlier flat Tufte theme. Carries the ET Book
`@font-face`.
