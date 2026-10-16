/**
 * Space Voyagers II: the engine's own 3D arithmetic. Plain objects, no
 * three.js, so the simulation runs in node for the tests. The convention is
 * three.js's: right-handed, +y up, a ship's nose points down its local -z,
 * its right wing along +x. Lengths are metres, times seconds, angles radians.
 *
 * Functions that end in `To` write into their first argument and return it,
 * so the hot loop makes no garbage; the others make a new object.
 */

export interface V3 { x: number; y: number; z: number }
/** A unit quaternion: the orientation of a ship. */
export interface Q4 { x: number; y: number; z: number; w: number }

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z })
export const q4 = (): Q4 => ({ x: 0, y: 0, z: 0, w: 1 })

export function copyTo(o: V3, a: V3): V3 { o.x = a.x; o.y = a.y; o.z = a.z; return o }
export function setTo(o: V3, x: number, y: number, z: number): V3 { o.x = x; o.y = y; o.z = z; return o }
export function addTo(o: V3, a: V3, b: V3): V3 { o.x = a.x + b.x; o.y = a.y + b.y; o.z = a.z + b.z; return o }
export function subTo(o: V3, a: V3, b: V3): V3 { o.x = a.x - b.x; o.y = a.y - b.y; o.z = a.z - b.z; return o }
export function scaleTo(o: V3, a: V3, s: number): V3 { o.x = a.x * s; o.y = a.y * s; o.z = a.z * s; return o }
/** o = a + b * s */
export function maddTo(o: V3, a: V3, b: V3, s: number): V3 { o.x = a.x + b.x * s; o.y = a.y + b.y * s; o.z = a.z + b.z * s; return o }
export function crossTo(o: V3, a: V3, b: V3): V3 {
  const x = a.y * b.z - a.z * b.y
  const y = a.z * b.x - a.x * b.z
  const z = a.x * b.y - a.y * b.x
  o.x = x; o.y = y; o.z = z
  return o
}
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z
export const len = (a: V3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
export const lenSq = (a: V3): number => a.x * a.x + a.y * a.y + a.z * a.z
export function dist(a: V3, b: V3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
export function distSq(a: V3, b: V3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}
export function normTo(o: V3, a: V3): V3 {
  const l = len(a)
  if (l < 1e-9) { o.x = 0; o.y = 0; o.z = -1; return o }
  return scaleTo(o, a, 1 / l)
}
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** Move `v` towards `to` by at most `step`. */
export function approach(v: number, to: number, step: number): number {
  return v < to ? Math.min(to, v + step) : Math.max(to, v - step)
}

// ---------------------------------------------------------------- quaternions

export function qCopyTo(o: Q4, a: Q4): Q4 { o.x = a.x; o.y = a.y; o.z = a.z; o.w = a.w; return o }
export function qMulTo(o: Q4, a: Q4, b: Q4): Q4 {
  const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y
  const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x
  const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  o.x = x; o.y = y; o.z = z; o.w = w
  return o
}
export function qNormTo(o: Q4, a: Q4): Q4 {
  const l = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z + a.w * a.w) || 1
  o.x = a.x / l; o.y = a.y / l; o.z = a.z / l; o.w = a.w / l
  return o
}
export function qAxisAngleTo(o: Q4, axis: V3, angle: number): Q4 {
  const h = angle / 2, s = Math.sin(h)
  o.x = axis.x * s; o.y = axis.y * s; o.z = axis.z * s; o.w = Math.cos(h)
  return o
}
/** Rotate `v` by `q` into `o`. */
export function rotateTo(o: V3, q: Q4, v: V3): V3 {
  // t = 2 * cross(q.xyz, v); o = v + w * t + cross(q.xyz, t)
  const tx = 2 * (q.y * v.z - q.z * v.y)
  const ty = 2 * (q.z * v.x - q.x * v.z)
  const tz = 2 * (q.x * v.y - q.y * v.x)
  const x = v.x + q.w * tx + (q.y * tz - q.z * ty)
  const y = v.y + q.w * ty + (q.z * tx - q.x * tz)
  const z = v.z + q.w * tz + (q.x * ty - q.y * tx)
  o.x = x; o.y = y; o.z = z
  return o
}
/** Rotate `v` by the inverse of `q`: a world direction into the ship's own frame. */
export function unrotateTo(o: V3, q: Q4, v: V3): V3 {
  const c: Q4 = SCRATCH_Q
  c.x = -q.x; c.y = -q.y; c.z = -q.z; c.w = q.w
  return rotateTo(o, c, v)
}
const SCRATCH_Q: Q4 = { x: 0, y: 0, z: 0, w: 1 }

const FWD: V3 = { x: 0, y: 0, z: -1 }
const UP: V3 = { x: 0, y: 1, z: 0 }
const RIGHT: V3 = { x: 1, y: 0, z: 0 }
export function forwardTo(o: V3, q: Q4): V3 { return rotateTo(o, q, FWD) }
export function upTo(o: V3, q: Q4): V3 { return rotateTo(o, q, UP) }
export function rightTo(o: V3, q: Q4): V3 { return rotateTo(o, q, RIGHT) }

/**
 * Turn `q` by body rates (radians this step about the ship's own right, up and
 * back axes: pitch up, yaw left, roll left positive), in place.
 */
const SCRATCH_D: Q4 = { x: 0, y: 0, z: 0, w: 1 }
export function qTurnBody(q: Q4, pitch: number, yaw: number, roll: number): Q4 {
  // Small-angle body rotation as one quaternion: (pitch about x, yaw about y, roll about z).
  const ax = pitch, ay = yaw, az = roll
  const a = Math.sqrt(ax * ax + ay * ay + az * az)
  if (a < 1e-12) return q
  const s = Math.sin(a / 2) / a
  SCRATCH_D.x = ax * s; SCRATCH_D.y = ay * s; SCRATCH_D.z = az * s; SCRATCH_D.w = Math.cos(a / 2)
  qMulTo(q, q, SCRATCH_D)
  return qNormTo(q, q)
}

/** The orientation whose nose points along `dir` with its top as near `up` as it can be. */
export function qLookTo(o: Q4, dir: V3, up: V3 = UP): Q4 {
  // Build the basis: z axis = -dir (the nose looks down -z).
  const zx = -dir.x, zy = -dir.y, zz = -dir.z
  const zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1
  const z0 = zx / zl, z1 = zy / zl, z2 = zz / zl
  // x = up × z
  let x0 = up.y * z2 - up.z * z1
  let x1 = up.z * z0 - up.x * z2
  let x2 = up.x * z1 - up.y * z0
  let xl = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2)
  if (xl < 1e-6) { x0 = 1; x1 = 0; x2 = 0; xl = 1 }
  x0 /= xl; x1 /= xl; x2 /= xl
  // y = z × x
  const y0 = z1 * x2 - z2 * x1
  const y1 = z2 * x0 - z0 * x2
  const y2 = z0 * x1 - z1 * x0
  // Rotation matrix columns x, y, z to quaternion.
  const m00 = x0, m01 = y0, m02 = z0
  const m10 = x1, m11 = y1, m12 = z1
  const m20 = x2, m21 = y2, m22 = z2
  const tr = m00 + m11 + m22
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1)
    o.w = 0.25 / s; o.x = (m21 - m12) * s; o.y = (m02 - m20) * s; o.z = (m10 - m01) * s
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    o.w = (m21 - m12) / s; o.x = 0.25 * s; o.y = (m01 + m10) / s; o.z = (m02 + m20) / s
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    o.w = (m02 - m20) / s; o.x = (m01 + m10) / s; o.y = 0.25 * s; o.z = (m12 + m21) / s
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
    o.w = (m10 - m01) / s; o.x = (m02 + m20) / s; o.y = (m12 + m21) / s; o.z = 0.25 * s
  }
  return qNormTo(o, o)
}

/** The angle between two directions (both unit length). */
export function angleBetween(a: V3, b: V3): number {
  return Math.acos(clamp(dot(a, b), -1, 1))
}

/**
 * Where to aim to hit a target moving at `tv` from `from`, with a shot of
 * speed `speed` that also carries `sv` (the shooter's own velocity, which
 * shots in this game inherit). Writes the aim point into `o` and returns the
 * flight time, or -1 when no solution exists (then `o` is the target itself).
 */
export function leadTo(o: V3, from: V3, sv: V3, target: V3, tv: V3, speed: number): number {
  // Relative to the shooter, the target moves at tv - sv.
  const rx = target.x - from.x, ry = target.y - from.y, rz = target.z - from.z
  const vx = tv.x - sv.x, vy = tv.y - sv.y, vz = tv.z - sv.z
  const a = vx * vx + vy * vy + vz * vz - speed * speed
  const b = 2 * (rx * vx + ry * vy + rz * vz)
  const c = rx * rx + ry * ry + rz * rz
  let t: number
  if (Math.abs(a) < 1e-6) {
    t = b !== 0 ? -c / b : -1
  } else {
    const disc = b * b - 4 * a * c
    if (disc < 0) { copyTo(o, target); return -1 }
    const sq = Math.sqrt(disc)
    const t1 = (-b - sq) / (2 * a)
    const t2 = (-b + sq) / (2 * a)
    t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2)
  }
  if (!(t > 0)) { copyTo(o, target); return -1 }
  // The aim point in world space: where the target will be, less the drift the shot inherits.
  o.x = target.x + vx * t
  o.y = target.y + vy * t
  o.z = target.z + vz * t
  return t
}
