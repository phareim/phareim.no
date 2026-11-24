/**
 * The polygon view's camera rig. Pure: no canvas, no DOM.
 *
 * A world point is (x east, y south, z up), all in tiles, as in `iso/camera.ts`.
 *
 * The rig is an interpolation between poses, and the classic picture is one
 * of them. That is what makes the turn: `rigMatrix(0, …)` is the classic
 * oblique picture to the pixel (so the hand-off can lie on it), `rigMatrix(1,
 * …)` is the pose, and in between the camera tips down off the classic
 * picture and the lines begin to meet. Two perspective poses are eased into
 * each other with `mixPose` (the crane sinking to the shoulder between the
 * 32-bit and the 64-bit look), which `turn.ts` knows nothing of: the view
 * does that itself when its values change.
 *
 * A pose aims the camera at the focus (the point the rig follows, normally
 * the hero's feet lifted to the ground's height) from `dist` tiles away,
 * heading `yaw` and looking down by `pitch`, and then slides the picture so
 * that the focus lands `focusY` of the way down the screen (a lens shift: the
 * picture is moved, the camera is not tilted, so what stands upright stays
 * upright on the screen).
 */
import { TILE } from '../../types'
import { ease, type Vec2 } from '../iso/project'

/** Column-major 4 × 4, as WebGL wants it: world (tiles) → clip. */
export type Mat4 = number[]

export interface Pose {
  /** Heading, radians: 0 looks north (toward −y), a quarter turn (π/2) looks east. The controls turn by it (`View.turn`). */
  yaw: number
  /** How far below level the camera looks, radians (π/2 would be straight down). */
  pitch: number
  /** Eye to focus, tiles. */
  dist: number
  /** Vertical field of view, radians, on a landscape screen; on a screen taller than wide it is the horizontal one, so a phone sees no less to the sides. */
  fov: number
  /** Where the focus lands, 0 (top of the screen) … 1 (bottom). */
  focusY: number
}

/** The 32-bit look's camera: a crane behind and above the hero, looking north, the horizon about a fifth of the way down (the sun whole over it). */
export const CRANE: Pose = { yaw: 0, pitch: 25.4 * Math.PI / 180, dist: 13.5, fov: 50 * Math.PI / 180, focusY: 0.7 }

/**
 * The 64-bit look's camera: behind the hero, a little over the shoulder, the horizon across the upper half. It
 * stands higher and further back than the sketch's, so foes beside the hero are in the picture. Its yaw follows the hero.
 */
export const SHOULDER: Pose = { yaw: 0, pitch: 17 * Math.PI / 180, dist: 5, fov: 56 * Math.PI / 180, focusY: 0.74 }

/**
 * A pose `t` of the way from `a` to `b` (0 … 1, not eased here). The yaw goes
 * the short way round; the distance is mixed in the log, so a pull-back and
 * a push-in look alike.
 */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const d = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw))
  return {
    ...a,
    yaw: a.yaw + d * t,
    pitch: a.pitch + (b.pitch - a.pitch) * t,
    dist: a.dist * Math.pow(b.dist / a.dist, t),
    fov: a.fov + (b.fov - a.fov) * t,
    focusY: a.focusY + (b.focusY - a.focusY) * t,
  }
}

/** How far the classic picture's depth runs, tiles of (y + z) either side of the screen's middle row. */
const CLASSIC_DEPTH = 512

/**
 * The classic picture as a matrix: world point (x, y, z) lands on scene px
 * (x·TILE − cx, (y − z)·TILE − cy) of a scene vw × vh px, where (cx, cy) is
 * the classic camera's top-left corner in px (`Picture.cx`, `Picture.cy`).
 * Height runs straight up the screen, unforeshortened, as the classic art
 * assumes. Depth sorts the way the classic painters do: of two points on the
 * same px, the one further south (and so higher up) is in front.
 */
export function classicMatrix(vw: number, vh: number, cx: number, cy: number): Mat4 {
  const T = TILE
  const sx = 2 * T / vw
  const sy = 2 * T / vh
  // (The line of sight runs north and down, along (0, −1, −1): a point further along (0, 1, 1) is nearer.)
  const yc = (cy + vh / 2) / T
  const dz = -1 / CLASSIC_DEPTH
  return [
    sx, 0, 0, 0,
    0, -sy, dz, 0,
    0, sy, dz, 0,
    -2 * cx / vw - 1, 1 + 2 * cy / vh, -dz * yc, 1,
  ]
}

/** The focal length of a pose on a scene, px: the field of view is the vertical one on a landscape screen, the horizontal one on a portrait screen. */
export function focalPx(pose: Pose, vw: number, vh: number): number {
  return (vw >= vh ? vh : vw) / 2 / Math.tan(pose.fov / 2)
}

/** The camera's axes for a pose: right, up and forward (world, unit). */
export function poseAxes(pose: Pose): { r: [number, number, number]; u: [number, number, number]; f: [number, number, number] } {
  const cy = Math.cos(pose.yaw)
  const sy = Math.sin(pose.yaw)
  const cp = Math.cos(pose.pitch)
  const sp = Math.sin(pose.pitch)
  const f: [number, number, number] = [sy * cp, -cy * cp, -sp]
  const r: [number, number, number] = [cy, sy, 0]
  // up = f × r
  const u: [number, number, number] = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]]
  return { r, u, f }
}

/**
 * A pose for a screen: on one taller than wide the lens is the horizontal one, so the picture reaches further
 * up and the horizon rides high over a strip of ground; there the camera looks further down, by as much as the
 * screen is tall, and from a little nearer, so the ground fills the height again and the horizon stays in the
 * upper part.
 */
export function fitPose(pose: Pose, vw: number, vh: number): Pose {
  if (vh <= vw) return pose
  const pitch = Math.atan(Math.tan(pose.pitch) * Math.pow(vh / vw, 0.85))
  // (And a little nearer: a phone's picture is narrow, and what is in it should not be small.)
  return { ...pose, pitch: Math.min(Math.PI * 0.4, pitch), dist: pose.dist * Math.pow(vw / vh, 0.3) }
}

/** A pose as a matrix, for a scene vw × vh px, following `focus` (tiles). `near` and `far` in tiles from the eye. */
export function poseMatrix(pose: Pose, vw: number, vh: number, focus: { x: number; y: number; z: number }, near = 0.25, far = 96): Mat4 {
  const { r, u, f } = poseAxes(pose)
  const e = [focus.x - f[0] * pose.dist, focus.y - f[1] * pose.dist, focus.z - f[2] * pose.dist]
  const F = focalPx(pose, vw, vh)
  const ax = 2 * F / vw
  const ay = 2 * F / vh
  const shift = 1 - 2 * pose.focusY
  const a = (far + near) / (far - near)
  const b = -2 * far * near / (far - near)
  // View space: X along r, Y along u, Z along f (depth), all from the eye. Clip: x = ax·X, y = ay·Y + shift·Z,
  // z = a·Z + b, w = Z; and the whole divided by the focus's own distance, which leaves the picture as it is and
  // makes w 1 at the focus, as it is everywhere in the classic picture (`rigMatrix` mixes the two).
  const k = 1 / pose.dist
  const row = (v: readonly number[]) => [v[0]!, v[1]!, v[2]!, -(v[0]! * e[0]! + v[1]! * e[1]! + v[2]! * e[2]!)]
  const X = row(r)
  const Y = row(u)
  const Z = row(f)
  const cx = X.map(q => q * ax * k)
  const cyv = Y.map((q, i) => (q * ay + Z[i]! * shift) * k)
  const cz = Z.map((q, i) => (q * a + (i === 3 ? b : 0)) * k)
  const cw = Z.map(q => q * k)
  return [
    cx[0]!, cyv[0]!, cz[0]!, cw[0]!,
    cx[1]!, cyv[1]!, cz[1]!, cw[1]!,
    cx[2]!, cyv[2]!, cz[2]!, cw[2]!,
    cx[3]!, cyv[3]!, cz[3]!, cw[3]!,
  ]
}

/**
 * The matrix `k` of the way through the turn (raw k, 0 … 1; eased inside):
 * exactly `classic` at 0, exactly `posed` at 1, and between them a picture
 * in which every point that both ends show moves without a jump and stays in
 * front of the camera.
 */
export function rigMatrix(k: number, classic: Mat4, posed: Mat4): Mat4 {
  if (k <= 0) return classic.slice()
  if (k >= 1) return posed.slice()
  // Both are scaled so that w is 1 where the eye looks (the classic picture's w is 1 everywhere), so mixing them
  // tips the picture down off the classic one while the lines begin to meet, and w stays positive in between.
  const e = ease(k)
  return classic.map((c, i) => c + (posed[i]! - c) * e)
}

/**
 * A world point on the scene: px from the scene's top-left, `depth` 0 (at
 * the near plane) … 1 (far), smaller in front, and `w` (positive in front of
 * the camera; a billboard's size on the screen goes by 1 / w).
 */
export function toScreen(m: Mat4, vw: number, vh: number, x: number, y: number, z = 0): Vec2 & { depth: number; w: number } {
  const cx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!
  const cy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!
  const cz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!
  const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!
  return { x: (cx / w + 1) / 2 * vw, y: (1 - cy / w) / 2 * vh, depth: (cz / w + 1) / 2, w }
}

/**
 * The ground point (at height z, tiles) under a scene px, or null where the
 * px looks over the horizon. The inverse of `toScreen` on that plane.
 */
export function toGround(m: Mat4, vw: number, vh: number, sx: number, sy: number, z = 0): Vec2 | null {
  const xn = (sx / vw) * 2 - 1
  const yn = 1 - (sy / vh) * 2
  const wz = m[11]! * z + m[15]!
  const a1 = m[0]! - xn * m[3]!
  const b1 = m[4]! - xn * m[7]!
  const c1 = -(m[8]! * z + m[12]!) + xn * wz
  const a2 = m[1]! - yn * m[3]!
  const b2 = m[5]! - yn * m[7]!
  const c2 = -(m[9]! * z + m[13]!) + yn * wz
  const det = a1 * b2 - a2 * b1
  if (Math.abs(det) < 1e-12) return null
  const x = (c1 * b2 - c2 * b1) / det
  const y = (a1 * c2 - a2 * c1) / det
  const w = m[3]! * x + m[7]! * y + wz
  return w > 1e-9 ? { x, y } : null
}

/** Where the horizon crosses the middle of the scene, px from the top (negative: above the screen; Infinity: the camera sees none, as in the classic picture). */
export function horizonY(m: Mat4, vw: number, vh: number): number {
  void vw
  // The level direction that lands on the middle column: clip x is 0 along it.
  let dx = m[4]!
  let dy = -m[0]!
  let w = m[3]! * dx + m[7]! * dy
  if (Math.abs(w) < 1e-9 * Math.hypot(dx, dy)) return Infinity
  if (w < 0) { dx = -dx; dy = -dy; w = -w }
  const yn = (m[1]! * dx + m[5]! * dy) / w
  return (1 - yn) / 2 * vh
}

/**
 * Picture px to one classic px: the finest that is a whole number of the screen's px to one of the picture's and no
 * finer than the value asks (`screen`: the screen's own), never under 2. A device that cannot keep up gets fewer.
 */
export function densityOf(want: unknown, scale: number, quality = 2): number {
  const target = want === 'screen' ? Infinity : Number(want) || 4
  let p = 1
  while (scale / p > target + 0.5 && p < scale) p++
  p += 2 - Math.max(0, Math.min(2, quality))
  // (Never under 2: the coarsest whole step that is still 2 or more, or the screen's own px on a screen coarser than that.)
  if (scale / p < 2) p = Math.max(1, Math.floor(scale / 2))
  return scale / p
}
