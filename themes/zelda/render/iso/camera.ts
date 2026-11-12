/**
 * The 16-bit view's camera. Pure: no canvas, no DOM.
 *
 * The scene is drawn in hi-res pixels: `DENSITY` of them to one pixel of the
 * classic art, so a tile is 32 px on the ground where the classic view has
 * 16. `projection(k)` (`project.ts`) still says how the ground lies; this
 * adds the third axis and the numbers a z-buffer needs.
 *
 * A world point is (x east, y south, z up), all in tiles. Height is never
 * foreshortened: one tile up is one tile's worth of px up the screen at
 * every k, which is what the classic three-quarter art assumes, and what
 * lets the turn start on the classic picture.
 */
import { TILE } from '../../types'
import { projection, type Proj, type Rect, type Vec2 } from './project'

/** Hi-res px per classic px at k = 1. */
export const DENSITY = 2
/** The tallest thing the depth range and the height channel hold, in tiles. */
export const Z_MAX = 4

export interface Cam {
  k: number
  P: Proj
  /** Hi-res px per classic px now (2 at k = 1; during the turn it runs from the classic view's own size). */
  zoom: number
  /** Scene size, hi-res px. */
  sw: number
  sh: number
  /** One tile east, one tile south and one tile up, in hi-res px on the scene. */
  ex: Vec2
  ey: Vec2
  zs: number
  /** Where world (0, 0, 0) lands on the scene. */
  ox: number
  oy: number
  /** Depth = dot(world, dv): larger is nearer the viewer. `d0` and `dInv` bring it to 0..1 over what is in sight. */
  dv: [number, number, number]
  d0: number
  dInv: number
  /** The ground under a scene px: [xx, xy, yx, yy] of the inverse ground matrix. */
  inv: [number, number, number, number]
}

/**
 * The camera for a turn of `k`, a scene of sw × sh hi-res px, looking at the
 * projected point `c` (classic px, as `centreIn` gives it). `zoom0` is the
 * zoom at k = 0, where the picture must be as large as the classic one.
 */
export function makeCam(k: number, sw: number, sh: number, zoom0: number, c: Vec2, jitter: Vec2 = { x: 0, y: 0 }): Cam {
  const P = projection(k)
  const zoom = zoom0 + (DENSITY - zoom0) * k
  const ex = { x: P.ex.x * zoom, y: P.ex.y * zoom }
  const ey = { x: P.ey.x * zoom, y: P.ey.y * zoom }
  const zs = TILE * zoom
  const ox = Math.round(sw / 2 - c.x * zoom) + jitter.x
  const oy = Math.round(sh / 2 - c.y * zoom) + jitter.y
  // The direction that projects to a point: the cross product of the projection's two rows.
  const det = ex.x * ey.y - ey.x * ex.y
  const dv: [number, number, number] = [-ey.x * zs, ex.x * zs, det]
  const n = Math.hypot(dv[0], dv[1], dv[2]) || 1
  dv[0] /= n; dv[1] /= n; dv[2] /= n
  return { k, P, zoom, sw, sh, ex, ey, zs, ox, oy, dv, d0: 0, dInv: 1, inv: [ey.y / det, -ey.x / det, -ex.y / det, ex.x / det] }
}

/** Fit the depth range to the tiles in play. */
export function fitDepth(cam: Cam, R: Rect): void {
  let lo = Infinity
  let hi = -Infinity
  for (const x of [R.x - 1, R.x + R.w + 1]) for (const y of [R.y - 1, R.y + R.h + 1]) for (const z of [-1, Z_MAX + 1]) {
    const d = x * cam.dv[0] + y * cam.dv[1] + z * cam.dv[2]
    if (d < lo) lo = d
    if (d > hi) hi = d
  }
  cam.d0 = lo
  cam.dInv = 1 / Math.max(1e-6, hi - lo)
}

/** A world point on the scene, hi-res px. */
export function toScene(cam: Cam, x: number, y: number, z = 0): Vec2 {
  return { x: cam.ox + x * cam.ex.x + y * cam.ey.x, y: cam.oy + x * cam.ex.y + y * cam.ey.y - z * cam.zs }
}

/** The ground point under a scene px, for a thing `z` tiles up. */
export function toGround(cam: Cam, sx: number, sy: number, z = 0): Vec2 {
  const a = sx - cam.ox
  const b = sy - cam.oy + z * cam.zs
  return { x: cam.inv[0] * a + cam.inv[1] * b, y: cam.inv[2] * a + cam.inv[3] * b }
}

/** Depth of a world point, 0 (far) to 1 (near). */
export function depthOf(cam: Cam, x: number, y: number, z = 0): number {
  return (x * cam.dv[0] + y * cam.dv[1] + z * cam.dv[2] - cam.d0) * cam.dInv
}
