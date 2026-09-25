// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Seeded randomness. The composer draws everything from one of these, so a
 * seed reproduces a section exactly (Hold loops it; feedback records it).
 */

export interface Rng {
  /** 0 ≤ x < 1 */
  next(): number
  /** Integer 0 ≤ n < max */
  int(max: number): number
  /** Float in [lo, hi) */
  range(lo: number, hi: number): number
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
  /** Pick by weights (same length as items). */
  weighted<T>(items: readonly T[], weights: readonly number[]): T
  /** A new independent stream derived from this seed and a salt. */
  fork(salt: number): Rng
  readonly seed: number
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mix two integers into a new 32-bit seed. */
export function hashSeed(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (b + 0x85ebca6b), 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

export function createRng(seed: number): Rng {
  const s = seed >>> 0
  const f = mulberry32(s)
  const rng: Rng = {
    seed: s,
    next: f,
    int: max => Math.floor(f() * max),
    range: (lo, hi) => lo + f() * (hi - lo),
    chance: p => f() < p,
    pick: items => items[Math.floor(f() * items.length)]!,
    weighted: (items, weights) => {
      let total = 0
      for (const w of weights) total += Math.max(0, w)
      let r = f() * total
      for (let i = 0; i < items.length; i++) {
        r -= Math.max(0, weights[i]!)
        if (r < 0) return items[i]!
      }
      return items[items.length - 1]!
    },
    fork: salt => createRng(hashSeed(s, salt)),
  }
  return rng
}
