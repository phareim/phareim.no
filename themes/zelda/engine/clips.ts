/**
 * HEARTS TURNED TO CLIPS (THE PAPERCLIP MAXIMIZER's fight, `engine/bossMaximizer.ts`): the last `GameState.clips`
 * hearts of the hero's row are paper clips. A count and a cap, never a lower `maxHp`: a clipped heart cannot be filled
 * while it is a clip, two hearts can never be clipped, and nothing but the hearts' row is touched. Never saved; a
 * respawn and any `enterMap` clear it. A pure module: the engine, the HUD and the fight read it.
 */
import type { GameState } from '../types'

/** The most hit points the hero can hold now. */
export const heroCap = (s: GameState) => s.hero.maxHp - 2 * (s.clips ?? 0)

/** The most hearts that may be clips at once: all but two. */
export const clipLimit = (s: GameState) => Math.max(0, Math.floor(s.hero.maxHp / 2) - 2)

/** Sets the count (held to the limit) and takes the hero's hit points down to what is left to fill. */
export function setClips(s: GameState, n: number) {
  const clips = Math.max(0, Math.min(clipLimit(s), n))
  if (clips) s.clips = clips
  else delete s.clips
  s.hero.hp = Math.min(s.hero.hp, heroCap(s))
}

/** One more heart becomes a clip. False when no heart may be clipped any more. */
export function clipHeart(s: GameState): boolean {
  const n = s.clips ?? 0
  if (n >= clipLimit(s)) return false
  setClips(s, n + 1)
  return true
}

/** One clip becomes a heart again, a full one; with no clip left, one heart is healed. */
export function unclipHeart(s: GameState) {
  if (s.clips) setClips(s, s.clips - 1)
  s.hero.hp = Math.min(heroCap(s), s.hero.hp + 2)
}
