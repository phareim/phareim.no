/** Small pure helpers shared by the engine modules. */
import type { Dir, GameState, Vec } from '../types'

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right']

export function dirVec(d: Dir): Vec {
  switch (d) {
    case 'up': return { x: 0, y: -1 }
    case 'down': return { x: 0, y: 1 }
    case 'left': return { x: -1, y: 0 }
    default: return { x: 1, y: 0 }
  }
}

export function dirAngle(d: Dir): number {
  switch (d) {
    case 'up': return -Math.PI / 2
    case 'down': return Math.PI / 2
    case 'left': return Math.PI
    default: return 0
  }
}

/** Dominant axis of (dx, dy) as a direction; `fallback` for a zero vector. */
export function toDir(dx: number, dy: number, fallback: Dir): Dir {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return fallback
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

export function opposite(d: Dir): Dir {
  return d === 'up' ? 'down' : d === 'down' ? 'up' : d === 'left' ? 'right' : 'left'
}

/** Smallest absolute difference between two angles. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

/** mulberry32 over state.rng — the only gameplay randomness. */
export function rnd(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const rndRange = (s: GameState, lo: number, hi: number) => lo + rnd(s) * (hi - lo)
export const chance = (s: GameState, p: number) => rnd(s) < p
export function pick<T>(s: GameState, arr: readonly T[]): T {
  return arr[Math.floor(rnd(s) * arr.length) % arr.length]!
}

export const nextId = (s: GameState) => ++s.nextId
