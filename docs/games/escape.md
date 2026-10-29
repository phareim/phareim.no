# Escape and the keyboard shell

How Escape, `P` and the arrow keys behave across the site. Code:
`themes/base/escHold.ts`, `themes/base/EscHold.vue`,
`composables/useThemeNavigation.ts`. Test: `npm run test:eschold`.

## Keyboard

- The shell does not use the arrow keys: they belong to the games, and on the portal they walk the hero.
- `Esc` in a game goes back to the portal when the game is not using it: navigation not blocked, not a repeat, not in a form field, and no game listener called `preventDefault` (checked in a `setTimeout(0)` after the whole dispatch, since games listen on `window` too). A game that uses Escape outside a run must `preventDefault` (Russian Block Game's GAME OVER dismiss, Another Shore's ending, Another Shore II's won screen do).
- After a game releases navigation at game over or exit, Escape and the home chip stay blocked for 3 seconds, so the Escape that ended a run does not also leave the game. The shared watcher in `useThemeNavigation` starts the grace period synchronously. Starting another run clears the grace timer and keeps the game lock. A lock released because the route changed (back button, home chip) starts no grace period, and arriving on a theme by URL clears one.

## Tap pauses, 3 s hold quits

Every game theme shares one Escape contract: a quick tap pauses or resumes
the run, holding Escape for 3 seconds cancels the run into game over (the
score games show their GAME OVER screen; Another Shore returns to its title
with progress kept, Another Shore II to idle; Russian Block Game shows its
GAME OVER overlay, where a further Esc tap dismisses to idle; the portal's
world saves and puts you back in town, its pill reads HOLD ESC FOR TOWN).
`P` pauses too, everywhere. Idle attract mode leaves Escape to the shell,
which goes back to the portal (see Keyboard).

Implementation: `themes/base/escHold.ts` holds the framework-free
`EscHoldTracker` state machine (tap vs hold, `performance.now`-injected so
`tests/esc-hold.test.mjs` covers it in plain node); `themes/base/EscHold.vue`
wraps it with the window listeners and the fixed progress pill (HOLD ESC TO
QUIT with a filling bar) plus a PAUSED pill for games with no paused UI of
their own (the five arcade games freeze their loop behind it; Russian Block
Game and the Shores pass `show-paused=false` and keep their native paused
states). Each game's `quitToGameOver` reuses its natural death path so
high-score persistence and the delayed `death`/`over` emits behave exactly
like losing.
