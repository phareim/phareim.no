/**
 * A small seeded random source (mulberry32), so contests can be replayed
 * and tested: the same seed draws the same fashion theme, judges and deck.
 */
export type Rng = () => number

export function seeded(seed: number): Rng {
  let a = (seed >>> 0) || 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length) % list.length]!

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = out[i]!
    out[i] = out[j]!
    out[j] = t
  }
  return out
}

/** Random lowercase id of `len` characters from Math.random (ids need to be unique, not secret). */
export function randomId(len: number, rng: Rng = Math.random): string {
  let s = ''
  for (let i = 0; i < len; i++) s += '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(rng() * 36)]
  return s
}
