/**
 * Intertitle cards (`CellDef.card`, docs/games/neon-shrine.md "Cards"): a title and a line or two over the whole
 * stage when the hero comes into a room by a warp. The world holds still under one: nothing steps, nothing can hurt,
 * and the hero, the hearts and the deck are where they were. Raised once a session by `<map>:<cell>`
 * (`GameState.cardsSeen`): a retry after a death does not play it again, a reload does. Painted by `render/card.ts`.
 */
import type { GameState, Input, World } from '../types'
import { cellDef, mapInfo } from './map'

/** Seconds: the fade in, how soon it may be passed, and how long it stands before it passes by itself. */
/** (A film's year passes after `auto`; a stage's card, Act Three's, after `stage`.) */
export const CARD = { fade: 0.25, pass: 0.6, auto: 2.6, stage: 3 } as const

/** The card of the room the hero has just been put in, if it has one that has not been shown. */
export function raiseCard(world: World, s: GameState) {
  delete s.card
  if (s.demo) return
  const info = mapInfo(world, s.map.id)
  const card = cellDef(info, s.zoneIndex)?.card
  const id = `${s.map.id}:${s.zoneIndex}`
  if (!card || s.cardsSeen.includes(id)) return
  s.cardsSeen.push(id)
  s.card = { id, title: card.title, lines: card.lines, t: 0, auto: info.def.era ? CARD.auto : CARD.stage, era: info.def.era ?? 'stage' }
}

/** A step under a card: its clock, and the press (A, or the cycle key) or the time that takes it away. */
export function stepCard(s: GameState, inp: Input, dt: number) {
  const card = s.card!
  card.t += dt
  if ((card.t >= CARD.pass && (inp.aPress || inp.cycle)) || (card.auto !== null && card.t >= card.auto)) delete s.card
}
