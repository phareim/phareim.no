/**
 * THE SCRAPE GOLEM as it is drawn (`engine/bossGolem.ts`; its pictures in `spritesGolem.ts`), both views from this one
 * painter: the isometric view stands the same pictures up. Four frames a size; the rest of its states are the rest
 * frame treated: a slow bob at rest, a shudder while it tells, a shake and a white flash as it grows, and the fallen
 * frame fading as it goes. Its ring and lanes are floor paint (`stencilsOf`), its flying pieces `heapMarks.ts`'s.
 */
import type { Enemy } from '../types'
import { TILE } from '../types'
import { GOLEM, golemOpen, golemSize } from '../engine/bossGolem'
import { silhouette, sprite } from './sheet'
import type { Light } from './tiles'

type G = CanvasRenderingContext2D
const T = TILE

const GOLD = '#ffd23f'
/**
 * The fallen frames are anchored on the heap's base and lean: this far (art px, right and down) puts their middle, by
 * the two eyes, where the standing frames have it.
 */
const FALLEN_AT = [[1, 1], [2, 5]] as const

/** The frame it shows. */
export function golemSprite(e: Enemy): string {
  const size = golemSize(e) ? 'l' : 'm'
  const pose = e.dead ? 'hurt' : e.ai.mode === 'pull' ? 'pull' : e.ai.mode === 'choke' || e.ai.mode === 'ease' ? 'choke' : '0'
  return `golem_${size}_${pose}`
}

/**
 * The spot on the floor its picture's feet stand on. Flat (`span` null), a body's radius south of its middle, so the
 * picture lies over the footprint. In a turned view a card stands on one point of the floor and cannot hang below it,
 * and the footprint is half as deep on the screen: the feet go a little way toward the eye (`span`: how far down the
 * screen, classic px, a tile each of x and y is).
 */
export function golemStand(e: Enemy, span: ((x0: number, y0: number, x1: number, y1: number) => { x: number; y: number }) | null): { x: number; y: number } {
  const down = span?.(0, 0, 1, 1).y ?? 0
  if (down <= 0) return { x: e.x, y: e.y + e.r }
  const d = (e.r * T * 0.6) / down
  return { x: e.x + d, y: e.y + d }
}

type At = { x: number; y: number }

/** Standing, its feet on `at` (`golemStand`). `flash`: struck. */
export function drawGolem(g: G, e: Enemy, at: At, cx: number, cy: number, time: number, reduced: boolean, flash: boolean, lights: Light[]) {
  const mode = e.ai.mode
  const size = golemSize(e)
  let dx = 0
  let dy = 0
  let white = flash
  if (!reduced) {
    if (mode === 'tell' || mode === 'spit' || mode === 'ease') dx = Math.floor(time * 24) % 2 ? 1 : -1
    else if (mode === 'grow') { dx = Math.floor(time * 30) % 2 ? 2 : -2; dy = Math.floor(time * 22) % 2 }
    else if (mode === 'rest' || mode === 'idle') dy = Math.floor(time * 1.6) % 2
  }
  // The flash it swells in: white from just before the swap to just after.
  if (mode === 'grow' && Math.abs(e.ai.t - GOLEM.grow / 2) < 0.14) white = true
  const name = golemSprite(e)
  const c = white ? silhouette(name, '#ffffff') : sprite(name)
  const x = Math.round(at.x * T - cx) + dx
  const feet = Math.round(at.y * T - cy + 1) + dy
  g.drawImage(c, Math.round(x - c.width / 2), feet - c.height)
  // A pale light of its own, so the heap stands out of a violet floor; gold on the core while it is open.
  const open = golemOpen(e)
  lights.push({ x: e.x, y: e.y - 0.3, r: size ? 3.6 : 2.9, color: '#c4fbff', a: 0.5 })
  if (open) lights.push({ x: e.x, y: e.y + (size ? 0.2 : 0.1), r: size ? 1.7 : 1.3, color: GOLD, a: 0.85 })
  // (The first 0.3 s of a choke, while the blade still clanks: a white flash on the core, not the gold.)
  else if (mode === 'choke') lights.push({ x: e.x, y: e.y + (size ? 0.2 : 0.1), r: size ? 1.7 : 1.3, color: '#ffffff', a: 0.7 })
  else if (mode === 'tell' || mode === 'pull') lights.push({ x: e.x, y: e.y + 0.2, r: size ? 3 : 2.4, color: '#ff2fa0', a: 0.35 })
}

/** Fallen: the leaning frame, fading over `GOLEM.fall` s. */
export function drawGolemFall(g: G, e: Enemy, at: At, cx: number, cy: number, lights: Light[]) {
  const k = Math.min(1, (e.deathT ?? 0) / GOLEM.fall)
  const [ax, ay] = FALLEN_AT[golemSize(e)]
  const c = sprite(golemSprite(e))
  g.globalAlpha = 1 - k
  g.drawImage(c, Math.round(at.x * T - cx - c.width / 2) + ax, Math.round(at.y * T - cy + 1) - c.height + ay)
  g.globalAlpha = 1
  lights.push({ x: e.x, y: e.y - 0.3, r: 3, color: '#c4fbff', a: 0.5 * (1 - k) })
}
