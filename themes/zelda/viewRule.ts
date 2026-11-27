/**
 * The view rule as the shell keeps it, less the page: what to do about the rule this frame, given the game and the
 * renderer's turn. Pure (the shell, `Zelda.vue`, does what it says; `tests/zelda-view-rule.test.mjs` drives it with
 * the renderer's own turn). The rule itself is the engine's: `engine/map.ts` (`setViewRule`), `world/tiles.ts`
 * (`blockUp`).
 */
import type { GameState, ViewSide } from './types'
import { risesUnderHero } from './engine/map'
import { turnSide, viewSide } from './render/turn'

/**
 * Is the rule on its own: the isometric picture cannot be had (its code did not arrive, it threw), or the round of
 * views holds no isometric one? Then the picture says nothing about the rule, and V and the Prism turn it alone on a
 * map with view blocks, so no room can lock a player out.
 */
export function ruleLoose(lost: boolean, round: readonly { engine: string }[]): boolean {
  return lost || !round.some(v => viewSide(v.engine) === 'iso')
}

/**
 * The rule's move this frame: the side it turns to (the one it stands on, for no turn), 'back' for a turn to be
 * taken back (it would raise a block under the hero), or null where the picture has no say.
 *
 * The rule never runs ahead of the picture: while a view is still being fetched the renderer heads where it did, and
 * so does the rule. `vs`: the renderer's turn (`viewState()`). `loose`: `ruleLoose`.
 */
export function ruleMove(
  s: GameState, vs: { id: string; k: number; turning: boolean; dark: boolean }, loose: boolean,
): ViewSide | 'back' | null {
  // A visit's first dark moments: there is no picture yet.
  if (vs.dark) return null
  const heading = viewSide(vs.id)
  if (heading === 'flat' && loose) return null
  // Asked about all the way to the half, so a hero who walks onto a block after the press is not caught either.
  if (risesUnderHero(s, heading)) return 'back'
  return turnSide(vs, s.view)
}
