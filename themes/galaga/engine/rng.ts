/**
 * Space Voyagers' only source of chance: a seeded generator (mulberry32) whose
 * whole state is one integer, so a world can be hashed and replayed. Nothing
 * in the engine or the director calls Math.random.
 */

export interface Rng {
  /** The state: an unsigned 32-bit integer. */
  s: number
}

export function makeRng(seed: number): Rng {
  return { s: (Math.floor(seed) >>> 0) || 1 }
}

/** The next number in [0, 1). */
export function rand(r: Rng): number {
  r.s = (r.s + 0x6D2B79F5) >>> 0
  let t = r.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** An integer in [0, n). */
export function randInt(r: Rng, n: number): number {
  return Math.floor(rand(r) * n)
}

/** A number in [a, b). */
export function randRange(r: Rng, a: number, b: number): number {
  return a + rand(r) * (b - a)
}

/** True with probability p. */
export function chance(r: Rng, p: number): boolean {
  return rand(r) < p
}
