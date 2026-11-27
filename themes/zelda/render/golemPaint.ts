/**
 * THE SCRAPE GOLEM as it is drawn (`engine/bossGolem.ts`; its pictures in `spritesGolem.ts`), both views from this one
 * painter: the isometric view stands the same pictures up. Seven frames a size: rest, the pull's tell, the pull, the
 * spit's tell, the spit (while its piece flies), the choke and the fall. Over them: a slow bob at rest, a shudder while
 * it tells, a shake and a white flash of the rest frame as it grows, and the fallen frame fading as it goes. Its ring
 * and lanes are floor paint (`stencilsOf`), its flying pieces `heapMarks.ts`'s.
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

type Pose = '0' | 'tell' | 'pull' | 'spit_tell' | 'spit' | 'choke' | 'hurt'

function golemPose(e: Enemy): Pose {
  const mode = e.ai.mode
  if (e.dead) return 'hurt'
  if (mode === 'tell' || mode === 'pull') return mode
  if (mode === 'spit') return 'spit_tell'
  if (mode === 'choke' || mode === 'ease') return 'choke'
  // (The mouth stays open while the piece it spat is in the air.)
  return mode === 'rest' && e.ai.fly ? 'spit' : '0'
}

/** The frame it shows. */
export function golemSprite(e: Enemy): string {
  return `golem_${golemSize(e) ? 'l' : 'm'}_${golemPose(e)}`
}

type Spot = readonly [u: number, v: number]
/**
 * Where the lights sit on a frame, px from its top left, medium and grown: the middle of what is drawn there. The eyes
 * wide open in the pull's tell (cyan, pink), the mouth it pulls with, the lump behind the lip it is about to spit and
 * the open mouth it spits from.
 */
const SPOTS: Record<'eyeL' | 'eyeR' | 'pull' | 'spit_tell' | 'spit', readonly [Spot, Spot]> = {
  eyeL: [[20, 27], [29, 40]],
  eyeR: [[30, 27], [39, 39]],
  pull: [[24.5, 37.5], [34.5, 49.5]],
  spit_tell: [[24.5, 37], [32, 47.5]],
  spit: [[23, 37], [33.5, 47]],
}

type Span = ((x0: number, y0: number, x1: number, y1: number) => { x: number; y: number }) | null

/**
 * A light on px (u, v) of a frame `size` px square that stands on `at`. Flat, that spot of the picture; in a turned
 * view, that far along the screen from the feet and that high over them, then a little toward the eye (which leaves it
 * where it is on the screen), so that it lies on the face of the standing picture.
 */
function onPicture(at: At, size: number, [u, v]: Spot, span: Span): { x: number; y: number; z?: number } {
  const right = u - size / 2
  const up = (size - v) / T
  const ex = span?.(0, 0, 1, 0)
  const ey = span?.(0, 0, 0, 1)
  const det = ex && ey ? ex.x * ey.y - ey.x * ex.y : 0
  if (!ex || !ey || span!(0, 0, 1, 1).y <= 0 || !det) return { x: at.x + right / T, y: at.y + 1 / T - up }
  const near = 0.2
  return { x: at.x + (right * ey.y) / det + near, y: at.y - (right * ex.y) / det + near, z: up + span!(0, 0, near, near).y / T }
}

/**
 * The spot on the floor its picture's feet stand on. Flat (`span` null), a body's radius south of its middle, so the
 * picture lies over the footprint. In a turned view a card stands on one point of the floor and cannot hang below it,
 * and the footprint is half as deep on the screen: the feet go a little way toward the eye (`span`: how far down the
 * screen, classic px, a tile each of x and y is).
 */
export function golemStand(e: Enemy, span: Span): { x: number; y: number } {
  const down = span?.(0, 0, 1, 1).y ?? 0
  if (down <= 0) return { x: e.x, y: e.y + e.r }
  const d = (e.r * T * 0.6) / down
  return { x: e.x + d, y: e.y + d }
}

type At = { x: number; y: number }

/** Standing, its feet on `at` (`golemStand`). `flash`: struck. */
export function drawGolem(g: G, e: Enemy, at: At, cx: number, cy: number, time: number, reduced: boolean, flash: boolean, lights: Light[], span: Span) {
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
  // What the frame shows, lit where it shows it. (Pink, a mouth too: it is open to the blade only when it chokes.)
  const pose = golemPose(e)
  const spot = (k: keyof typeof SPOTS, r: number, color: string, a: number) => lights.push({ ...onPicture(at, c.width, SPOTS[k][size], span), r, color, a })
  if (pose === 'tell') {
    spot('eyeL', size ? 0.9 : 0.7, '#2ff3ff', 0.6)
    spot('eyeR', size ? 0.9 : 0.7, '#ff2fa0', 0.6)
  } else if (pose === 'pull') spot('pull', size ? 1.3 : 1, '#ff2fa0', 0.45)
  else if (pose === 'spit_tell') spot('spit_tell', size ? 1.5 : 1.15, '#ff2fa0', 0.5)
  else if (pose === 'spit') spot('spit', size ? 1.8 : 1.3, '#ff2fa0', 0.75)
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
