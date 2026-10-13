# Space Paddle — The Odyssey (`breakout`)

`?theme=breakout`. The cabinet is "SPACE PADDLE" in the arcade; the theme id
stays `breakout` (the URL, the Hall of Fame game id, the saved high score
`breakoutHighScore` and the music key `breakout`). Redesigned 2026-10-13 from
the 2026-09-04 Breakout: faster, more things happen on each board, louder
power-ups, a start card and a pause card, and 1980s synthwave in space.

## Play

- Start: Enter or tap. Launch the ball: Space, Enter, ↑ or tap.
- Move: ← → or A D; with a mouse, move it; on a phone, drag.
- Pause: P, a quick Esc tap, or the **II** button in the HUD line (touch).
  The pause card has RESUME and QUIT.
- Hold Esc for 3 s: the run ends in GAME OVER (`themes/base/EscHold.vue`).
- Behind the start card the game plays itself (attract mode). Nothing scores
  and lives do not run out.

## Rules (`themes/breakout/engine.ts`, pure)

- **Speed**: 520 px/s at level 1 (it was 380), plus 34 a level, capped at 1100.
  The ball moves in sub-steps of at most 3 px. The paddle and the bricks are
  checked for a crossing, so a ball at top speed cannot pass through them.
- **Boards**: rows grow from 5 to 9, one row every second level. Five layouts
  cycle: full wall, checker, pyramid, columns, chevrons.
  - Level 2 and up: every third row drifts sideways, keeping one free column
    at each wall.
  - Level 3 and up: some bricks are pulse bricks. Open for 1.2 s, shut for
    1.2 s. A shut one bounces the ball and takes no damage.
  - Level 4 and every even level after: a planet in the field bends the ball's
    course with gravity. Its speed stays the same.
  - From level 4 the top row takes three hits.
- **Score**: the row's points times the hits (pulse bricks count double),
  times the combo (×1 to ×4). A paddle hit or a lost ball resets the combo.
- **Capsules**: 14 % of destroyed bricks drop one. Weights out of 100:
  MULTI-BALL (X) 30, EXPAND (E) 22 for 12 s, LASER (L) 16 for 8 s (two bolts
  every 0.28 s), TIME WARP (T) 14 for 8 s (the ball at 60 %), SHIELD (S) 10
  (a line under the paddle that bounces one ball, then goes), EXTRA LIFE (+) 8.
- **Lives**: three. Losing the last ball costs a life. The last life ends the
  run; GAME OVER shows 0.9 s later.

## Look (`themes/breakout/pixel.ts`)

On the shared pixel stage (`docs/games/pixel-look.md`). A striped sun sits on
the horizon, the violet sky has stars, a perspective grid scrolls towards the
player, the walls are neon. Bricks are sunset crystals (pink, orange, gold,
violet, teal by row), chrome stone with cracks, and cyan pulse bricks. The
planet is banded magenta and violet with a gold ring. Capsules take their
power's colour.

The start card (`Landing.vue`) has the logo, a review line, the hints, the
high score and `(C) SLEEPY PRODUCTIONS, 2Q89`. The pause card is over the
frozen field.

## Code

- `engine.ts`: the rules, with an injected seeded RNG and the game's own clock.
- `pixel.ts`: the painters (sky, sun, grid, bricks, paddle, orb, capsule,
  bolt, planet).
- `Breakout.vue`: the glue. The loop, input, sound, particles, and the
  events and numbers it reports up. It exposes `togglePause` and
  `quitToGameOver` for the pause card and the touch button.
- `Landing.vue`: start, pause, game over. Loads the game through
  `defineAsyncComponent`, as every landing must.
- `theme.css`: the `--theme-*` tokens (unchanged colours).

## Tests

`npm run test:breakout` (`tests/breakout-engine.test.mjs`, 29 tests): no
tunnelling at top speed, the paddle's crossing, lives and game over, the
shield, the planet, pulse bricks, every capsule, the levels and the seeded
boards, drift staying on the field, the layout at a narrow width, attract
mode, and a seeded autopilot run that reaches level 2.

## Ties to the rest of the site

- Hall of Fame: `submitScore('breakout', score)`, maximum 500 000
  (`themes/leaderboard/games.ts`).
- The portal's cabinet 3 (`themes/zelda/world/town.ts`), named SPACE PADDLE.
- The display name in `themes/index.ts` is "Space Paddle — The Odyssey".

## Checks (2026-10-13)

- `test:breakout`, `test:portal`, `test:leaderboard` pass. Typecheck and
  production build pass.
- Chrome at 375 × 667 with touch emulation (2× pixel ratio): tap to start,
  drag the paddle, pause with the II button, resume, hold Esc to GAME OVER,
  Enter to restart. No console errors.
- Not checked: a desktop layout pass, a real iPhone, and how the pulse
  bricks and the planet feel over a long run.
