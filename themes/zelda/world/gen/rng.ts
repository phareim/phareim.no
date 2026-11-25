/**
 * Seeded randomness for the generated world. Everything here is a pure
 * function of its numbers, so a region comes out the same on every device
 * and every visit (saves, quests and dig edits point into it).
 */

/** A 32-bit hash of any number of integers. */
export function hash(...n: number[]): number {
  let h = 0x811c9dc5 | 0
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 0x01000193)
    h ^= h >>> 15
    h = Math.imul(h, 0x2c1b3c6d)
    h ^= h >>> 12
  }
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

/** A string's hash, for ids. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5 | 0
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return hash(h)
}

/** A small seeded generator (mulberry32). */
export class Rng {
  private a: number
  constructor(seed: number) { this.a = seed >>> 0 || 0x9e3779b9 }
  /** [0, 1) */
  next(): number {
    let t = (this.a = (this.a + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  /** An integer in [lo, hi] (both included). */
  int(lo: number, hi: number): number { return lo + Math.floor(this.next() * (hi - lo + 1)) }
  chance(p: number): boolean { return this.next() < p }
  pick<T>(list: readonly T[]): T { return list[Math.floor(this.next() * list.length)]! }
  /** A pick by weight: [item, weight] pairs. */
  weighted<T>(list: ReadonlyArray<readonly [T, number]>): T {
    let sum = 0
    for (const [, w] of list) sum += w
    let r = this.next() * sum
    for (const [v, w] of list) { r -= w; if (r < 0) return v }
    return list[list.length - 1]![0]
  }
  shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const t = list[i]!; list[i] = list[j]!; list[j] = t
    }
    return list
  }
}

/** Smooth value noise in [0, 1] at a point in world tiles, `scale` tiles per cell. */
export function noise(seed: number, x: number, y: number, scale: number): number {
  const fx = x / scale
  const fy = y / scale
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const v = (i: number, j: number) => hash(seed, i, j) / 4294967296
  const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx
  const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx
  return a + (b - a) * sy
}

/** Fractal noise: `octaves` layers of `noise`, each half the size and weight. */
export function fbm(seed: number, x: number, y: number, scale: number, octaves = 3): number {
  let sum = 0
  let amp = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise(seed + o * 1013, x, y, scale) * amp
    norm += amp
    amp *= 0.5
    scale *= 0.5
  }
  return sum / norm
}
