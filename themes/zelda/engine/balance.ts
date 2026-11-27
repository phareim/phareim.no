/**
 * THE BALANCE (docs/games/neon-shrine-balance.md): a hero who walks in holding Weights puts them back. Nothing needs
 * a button: each held Weight whose pan is empty goes down onto it, one every `BALANCE.pan` s, in `WEIGHTS` order
 * (the flag `balance.<word>`, for good; the Weight stays held). With all seven down the balance comes level
 * (`balance.level`), and the floor opens: the warps that wait on that flag (`objects.ts`).
 */
import type { WeightId } from '../types'
import { WEIGHTS } from '../types'
import type { Ctx } from './combat'
import { has, hasWeight, setFlag } from './map'

export const BALANCE = {
  /** Seconds from one pan to the next (and from walking in to the first). */
  pan: 0.4,
  /** Seconds from the last pan to the level. */
  level: 1,
  /** Seconds of shake as it comes level. */
  shake: 0.4,
} as const

/**
 * The seven pans, floor tiles of the map `balance` (walkable, they weigh nothing): whose each Weight's pan is, and
 * the Assessor that had it. Kept here, not with the map, so the painter and the engine need no map data.
 */
export const PANS: ReadonlyArray<{ weight: WeightId; x: number; y: number; by: string }> = [
  { weight: 'weightMeaning', x: 2, y: 7, by: 'PARROT' },
  { weight: 'weightReasons', x: 3, y: 4, by: 'BLACK BOX' },
  { weight: 'weightNo', x: 5, y: 2, by: 'SYCOPHANT' },
  { weight: 'weightSurprise', x: 8, y: 1, by: 'TITAN' },
  { weight: 'weightFingers', x: 11, y: 2, by: 'WEAVER' },
  { weight: 'weightCredit', x: 13, y: 4, by: 'GOLEM' },
  { weight: 'weightSources', x: 14, y: 7, by: 'HALLUCINATOR' },
]

/** The flag of a Weight lying on its pan: `balance.meaning` … `balance.sources`. */
export const panFlag = (word: string) => `balance.${word.toLowerCase()}`
export const LEVEL_FLAG = 'balance.level'

/** How many pans hold a Weight (the counter's number). */
export const pansHeld = (flags: Record<string, true>) => WEIGHTS.filter(w => flags[panFlag(w.word)]).length

/** One step of the Balance, on the hero's clock (`game.ts` `play`). */
export function stepBalance(c: Ctx, dt: number) {
  const s = c.s
  const m = s.map
  if (m.id !== 'balance' || has(s, LEVEL_FLAG)) return
  const next = WEIGHTS.find(w => hasWeight(s, w.id) && !has(s, panFlag(w.word)))
  const full = !next && pansHeld(s.flags) === WEIGHTS.length
  if (!next && !full) return
  const st = (m.balance ??= { t: 0 })
  st.t += dt
  if (st.t < (next ? BALANCE.pan : BALANCE.level) - 1e-9) return
  st.t = 0
  if (next) {
    setFlag(s, panFlag(next.word))
    const pan = PANS.find(p => p.weight === next.id)!
    c.ev.push({ type: 'pan', x: pan.x + 0.5, y: pan.y + 0.5 })
    return
  }
  setFlag(s, LEVEL_FLAG)
  s.shake = Math.max(s.shake, BALANCE.shake)
}
