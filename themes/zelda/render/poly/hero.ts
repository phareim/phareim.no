/**
 * The hero as a model in the polygon views: a mesh of many triangles (6,000 for the 32-bit look, 20,000 for the
 * 64-bit one) made from the drawn hero, fetched the first time a polygon look needs it (`public/zelda/poly/`,
 * written by `scripts/zelda-lab/poly-pack.mjs`). The sprite card stands in until it is here, and if it fails.
 *
 * The mesh has no rig. It is split here into stiff parts by where its vertices lie in its A-pose (the legs, the
 * torso, the two arms, the head with its hair and band), with soft weights across each joint so nothing tears,
 * and the parts are driven by the poses the 16-bit view's modelled figure already has (`iso/figure.ts`
 * `solvePose`: the walk of sixteen phases, lift, carry, push, hurt, get, use, fall, dead, the swing). The mesh is
 * sent to the GPU once (`heroVerts`: the engine's own vertices with two bones and a weight) and skinned in the vertex
 * shader by six bone matrices a frame (`poseHero`), so the lamps, the sun, the vertex snap, the filter and the fog
 * treat it like everything else and the CPU does next to nothing for it. The blade is a small mesh in the hand along
 * the engine's own swing angle. (`skinHero`, the same on the CPU, is kept for the tests.)
 *
 * Pure but for `loadHero`, which fetches.
 */
import type { FigurePose, SolvedPose } from '../iso/figure'
import { solvePose } from '../iso/figure'
import type { HeroLook } from '../heroLook'
import { DRAWN_LOOK } from '../heroLook'
import { FLAG, HSTRIDE, ROLE, STRIDE, TEX, type Verts } from './mesh'

export interface HeroMesh {
  /** Model space as the GLB has it: y up, the face toward −z, the hero's right toward +x; metres. */
  pos: Float32Array
  nrm: Float32Array
  uv: Float32Array
  idx: Uint16Array
  /** Per vertex: two bones and the weight of the first. */
  bone: Uint8Array
  w: Float32Array
  /** The lowest and the highest point (y). */
  lo: number
  hi: number
}

/** The bones: 0 torso (from the hips), 1 head, 2 left arm, 3 right arm, 4 left leg, 5 right leg. */
const TORSO = 0, HEAD = 1, ARM_L = 2, ARM_R = 3, LEG_L = 4, LEG_R = 5

/** Where the joints are, as shares of the height from the soles up (measured on the mesh: the shoes and legs take the lowest fifth, the head the upper half). */
export const JOINTS = { hip: 0.205, neck: 0.5, shoulder: 0.44, shoulderX: 0.165, hipX: 0.075 }

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** The packed mesh (`poly-pack.mjs`): the header, quantized positions, normals, texture coordinates, indices. */
export function parseHero(buf: ArrayBuffer): HeroMesh {
  const dv = new DataView(buf)
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'NSH1') throw new Error('not a hero mesh')
  const nv = dv.getUint32(4, true)
  const ni = dv.getUint32(8, true)
  const lo = [dv.getFloat32(12, true), dv.getFloat32(16, true), dv.getFloat32(20, true)]
  const hi = [dv.getFloat32(24, true), dv.getFloat32(28, true), dv.getFloat32(32, true)]
  let o = 36
  const qp = new Int16Array(buf.slice(o, o + nv * 6)); o += nv * 6
  const qn = new Int8Array(buf.slice(o, o + nv * 3)); o += nv * 3
  const qu = new Uint16Array(buf.slice(o, o + nv * 4)); o += nv * 4
  const idx = new Uint16Array(buf.slice(o, o + ni * 2))
  const pos = new Float32Array(nv * 3)
  const nrm = new Float32Array(nv * 3)
  const uv = new Float32Array(nv * 2)
  for (let i = 0; i < nv; i++) {
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = lo[k]! + ((qp[i * 3 + k]! + 32767) / 65534) * (hi[k]! - lo[k]!)
      nrm[i * 3 + k] = qn[i * 3 + k]! / 127
    }
    uv[i * 2] = qu[i * 2]! / 65535
    uv[i * 2 + 1] = qu[i * 2 + 1]! / 65535
  }
  const m: HeroMesh = { pos, nrm, uv, idx, bone: new Uint8Array(nv * 2), w: new Float32Array(nv), lo: lo[1]!, hi: hi[1]! }
  rig(m)
  return m
}

/** Each vertex's two bones and their share, by where it lies in the A-pose. */
export function rig(m: HeroMesh): void {
  const H = m.hi - m.lo
  const n = m.pos.length / 3
  for (let i = 0; i < n; i++) {
    const x = m.pos[i * 3]!
    const u = (m.pos[i * 3 + 1]! - m.lo) / H
    // Up the body: a leg below the hip, the torso, the head above the neck; across it, an arm outside the torso.
    const leg = 1 - smooth(JOINTS.hip - 0.025, JOINTS.hip + 0.025, u)
    const head = smooth(JOINTS.neck - 0.03, JOINTS.neck + 0.03, u)
    const arm = (1 - leg) * (1 - head) * smooth(JOINTS.shoulderX - 0.02, JOINTS.shoulderX + 0.025, Math.abs(x))
    const side = x > 0 ? 1 : 0
    // The two strongest of leg, arm, head, torso.
    const ws: Array<[number, number]> = [[leg, LEG_L + side], [arm, ARM_L + side], [head, HEAD], [Math.max(0, 1 - leg - arm - head), TORSO]]
    ws.sort((a, b) => b[0] - a[0])
    const sum = ws[0]![0] + ws[1]![0] || 1
    m.bone[i * 2] = ws[0]![1]
    m.bone[i * 2 + 1] = ws[1]![1]
    m.w[i] = ws[0]![0] / sum
  }
}

/** A 3 × 4 transform, row-major: [r00 r01 r02 tx, r10 …]. */
type Mx = Float32Array
const mx = () => new Float32Array(12)
function setRot(o: Mx, yaw: number, pitch: number, roll: number) {
  // About the model's up (y), then its right (x), then its forward (z).
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll)
  // R = Ry · Rx · Rz
  const a = [cr, -sr, 0, sr, cr, 0, 0, 0, 1]
  const b = [1, 0, 0, 0, cp, -sp, 0, sp, cp]
  const c = [cy, 0, sy, 0, 1, 0, -sy, 0, cy]
  const bc = mul3(b, a)
  const r = mul3(c, bc)
  o[0] = r[0]!; o[1] = r[1]!; o[2] = r[2]!; o[4] = r[3]!; o[5] = r[4]!; o[6] = r[5]!; o[8] = r[6]!; o[9] = r[7]!; o[10] = r[8]!
  o[3] = 0; o[7] = 0; o[11] = 0
}
function mul3(a: number[], b: number[]): number[] {
  const o = new Array(9).fill(0)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j] += a[i * 3 + k]! * b[k * 3 + j]!
  return o
}
/** The rotation that takes unit direction a to unit direction b (the shortest way), into o. */
function setAlign(o: Mx, a: [number, number, number], b: [number, number, number]) {
  const la = Math.hypot(...a) || 1, lb = Math.hypot(...b) || 1
  const ax = a[0] / la, ay = a[1] / la, az = a[2] / la
  const bx = b[0] / lb, by = b[1] / lb, bz = b[2] / lb
  let vx = ay * bz - az * by, vy = az * bx - ax * bz, vz = ax * by - ay * bx
  const c = ax * bx + ay * by + az * bz
  const s = Math.hypot(vx, vy, vz)
  if (s < 1e-6) { setRot(o, 0, 0, 0); return }
  vx /= s; vy /= s; vz /= s
  const t = 1 - c
  o[0] = c + vx * vx * t; o[1] = vx * vy * t - vz * s; o[2] = vx * vz * t + vy * s
  o[4] = vy * vx * t + vz * s; o[5] = c + vy * vy * t; o[6] = vy * vz * t - vx * s
  o[8] = vz * vx * t - vy * s; o[9] = vz * vy * t + vx * s; o[10] = c + vz * vz * t
  o[3] = 0; o[7] = 0; o[11] = 0
}
/** o = a · b (both 3 × 4 transforms). */
function compose(o: Mx, a: Mx, b: Mx) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) o[i * 4 + j] = a[i * 4]! * b[j]! + a[i * 4 + 1]! * b[4 + j]! + a[i * 4 + 2]! * b[8 + j]!
    o[i * 4 + 3] = a[i * 4]! * b[3]! + a[i * 4 + 1]! * b[7]! + a[i * 4 + 2]! * b[11]! + a[i * 4 + 3]!
  }
}
/** A rotation about a pivot: translate(p) · R · translate(−p). */
function about(o: Mx, r: Mx, p: [number, number, number]) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) o[i * 4 + j] = r[i * 4 + j]!
    o[i * 4 + 3] = p[i]! - (r[i * 4]! * p[0] + r[i * 4 + 1]! * p[1] + r[i * 4 + 2]! * p[2]) + r[i * 4 + 3]!
  }
}

/** The figure's frame (forward, right, up) as the model's (x right, y up, z back). */
const F = (f: number, r: number, z: number): [number, number, number] => [r, z, -f]

/** One frame's bone transforms (model space), from the figure's solved pose. */
export function boneMatrices(m: HeroMesh, P: SolvedPose): Mx[] {
  const H = m.hi - m.lo
  const y = (u: number) => m.lo + u * H
  // The figure is drawn about 26 px tall; the mesh is H metres. Its px, in metres.
  const px = H / 26
  const hip: [number, number, number] = [0, y(JOINTS.hip), 0]
  const neck: [number, number, number] = [0, y(JOINTS.neck), 0]
  const out = Array.from({ length: 6 }, mx)
  const r = mx(), t = mx(), torso = mx()
  // The torso: its turn from the legs, its lean and roll, about the hips; the body's rise.
  setRot(r, -P.twist, -P.lean, -P.roll)
  about(torso, r, hip)
  torso[7] += P.rise * px
  out[TORSO]!.set(torso)
  // The head on the torso.
  setRot(r, -P.turn, -(P.lean * 0.5 + P.nod) + P.lean, P.roll * 0.5 - P.roll)
  about(t, r, neck)
  compose(out[HEAD]!, torso, t)
  // The arms: from the shoulder, turned so the hand reaches where the figure has it.
  for (const side of [-1, 1]) {
    const sh = F(0.3, side * 6.7, 7.2)
    const rest = F(0.6 - 0.3, side * 8.5 - side * 6.7, 1.2 - 7.2)
    const hf = side < 0 ? P.lhf : P.rhf, hr = side < 0 ? P.lhr : P.rhr, hz = side < 0 ? P.lhz : P.rhz
    const now = F(hf - 0.3, hr - side * 6.7, hz - 7.2)
    setAlign(r, rest, now)
    about(t, r, [side * JOINTS.shoulderX * 1.05, y(JOINTS.shoulder), 0])
    void sh
    compose(out[side < 0 ? ARM_L : ARM_R]!, torso, t)
  }
  // The legs: from the hip joint, turned so the foot lands where the figure puts it.
  for (const side of [-1, 1]) {
    const ff = side < 0 ? P.lf : P.rf, fz = side < 0 ? P.lz : P.rz
    const rest = F(0, side * 0.5, 2.6 - (P.hip - 0.5))
    const now = F(ff, side * 0.5, fz + 2.6 - (P.hip - 0.5))
    setAlign(r, rest, now)
    about(out[side < 0 ? LEG_L : LEG_R]!, r, [side * JOINTS.hipX, y(JOINTS.hip), 0])
  }
  // The whole figure: over on its side (dead), lifted and moved (px), and its scale (a fall into a pit).
  if (P.lie || P.scale !== 1 || P.ox || P.oy || P.oz) {
    setRot(r, 0, 0, P.lie)
    const base = mx()
    about(base, r, [0, m.lo, 0])
    for (let k = 0; k < 12; k++) base[k] = base[k]! * (k % 4 === 3 ? 1 : P.scale)
    base[3] += P.oy * px * 0.5
    base[7] += P.oz * px
    for (const b of out) { const c = new Float32Array(b); compose(b, base, c) }
  }
  return out
}

export interface Placement {
  /** World point under the hero (tiles), the ground's height there, which way the body faces (world angle, 0 east, π/2 south). */
  x: number
  y: number
  g: number
  yaw: number
  /** Tiles per metre of the mesh. */
  scale: number
}

/** Scratch for one frame: the skinned vertices in model space. */
let sp = new Float32Array(0)
let sn = new Float32Array(0)
let wp = new Float32Array(0)
let wn = new Float32Array(0)

/**
 * The hero, posed and placed, into `v` as the engine's triangles (texture: the hero's; light: the facet's normal
 * and, for smooth shading, the vertex's). Returns where the right hand is (world, tiles), for the blade.
 */
export function skinHero(v: Verts, m: HeroMesh, P: SolvedPose, at: Placement): [number, number, number] {
  const bones = boneMatrices(m, P)
  const n = m.pos.length / 3
  if (sp.length < n * 3) { sp = new Float32Array(n * 3); sn = new Float32Array(n * 3) }
  for (let i = 0; i < n; i++) {
    const a = bones[m.bone[i * 2]!]!, b = bones[m.bone[i * 2 + 1]!]!
    const w = m.w[i]!, w2 = 1 - w
    const x = m.pos[i * 3]!, y = m.pos[i * 3 + 1]!, z = m.pos[i * 3 + 2]!
    const nx = m.nrm[i * 3]!, ny = m.nrm[i * 3 + 1]!, nz = m.nrm[i * 3 + 2]!
    for (let k = 0; k < 3; k++) {
      const r = k * 4
      sp[i * 3 + k] = w * (a[r]! * x + a[r + 1]! * y + a[r + 2]! * z + a[r + 3]!) + w2 * (b[r]! * x + b[r + 1]! * y + b[r + 2]! * z + b[r + 3]!)
      sn[i * 3 + k] = w * (a[r]! * nx + a[r + 1]! * ny + a[r + 2]! * nz) + w2 * (b[r]! * nx + b[r + 1]! * ny + b[r + 2]! * nz)
    }
  }
  // Model to world, once a vertex: the face (−z) along the body's heading, the hero's right (+x) to its right, up as up.
  const s = at.scale
  const fx = Math.cos(at.yaw), fy = Math.sin(at.yaw)
  const rx = -fy, ry = fx
  if (wp.length < n * 3) { wp = new Float32Array(n * 3); wn = new Float32Array(n * 3) }
  for (let i = 0; i < n; i++) {
    const x = sp[i * 3]!, y = sp[i * 3 + 1]!, z = sp[i * 3 + 2]!
    wp[i * 3] = at.x + s * (x * rx - z * fx)
    wp[i * 3 + 1] = at.y + s * (x * ry - z * fy)
    wp[i * 3 + 2] = s * (y - m.lo)
    const nx = sn[i * 3]! * rx - sn[i * 3 + 2]! * fx, ny = sn[i * 3]! * ry - sn[i * 3 + 2]! * fy, nz = sn[i * 3 + 1]!
    const l = Math.hypot(nx, ny, nz) || 1
    wn[i * 3] = nx / l; wn[i * 3 + 1] = ny / l; wn[i * 3 + 2] = nz / l
  }
  const tris = m.idx.length / 3
  v.reserve(tris * 3)
  const d = v.data
  const idx = m.idx
  const uv = m.uv
  for (let t = 0; t < tris; t++) {
    const i0 = idx[t * 3]!, i1 = idx[t * 3 + 1]!, i2 = idx[t * 3 + 2]!
    const ax = wp[i0 * 3]!, ay = wp[i0 * 3 + 1]!, az = wp[i0 * 3 + 2]!
    const ex = wp[i1 * 3]! - ax, ey = wp[i1 * 3 + 1]! - ay, ez = wp[i1 * 3 + 2]! - az
    const gx = wp[i2 * 3]! - ax, gy = wp[i2 * 3 + 1]! - ay, gz = wp[i2 * 3 + 2]! - az
    let nx = ey * gz - ez * gy, ny = ez * gx - ex * gz, nz = ex * gy - ey * gx
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l; ny /= l; nz /= l
    // (The facet's normal turned to the side its corners' own normals are on: the mesh's winding is not ours.)
    if (nx * (wn[i0 * 3]! + wn[i1 * 3]! + wn[i2 * 3]!) + ny * (wn[i0 * 3 + 1]! + wn[i1 * 3 + 1]! + wn[i2 * 3 + 1]!) + nz * (wn[i0 * 3 + 2]! + wn[i1 * 3 + 2]! + wn[i2 * 3 + 2]!) < 0) { nx = -nx; ny = -ny; nz = -nz }
    for (let c = 0; c < 3; c++) {
      const i = c === 0 ? i0 : c === 1 ? i1 : i2
      const o = v.n * STRIDE
      d[o] = wp[i * 3]!; d[o + 1] = wp[i * 3 + 1]!; d[o + 2] = wp[i * 3 + 2]!; d[o + 3] = at.g
      d[o + 4] = nx; d[o + 5] = ny; d[o + 6] = nz
      d[o + 7] = uv[i * 2]!; d[o + 8] = uv[i * 2 + 1]!
      d[o + 9] = TEX.HERO
      d[o + 10] = 1; d[o + 11] = 1; d[o + 12] = 1
      d[o + 13] = 1; d[o + 14] = ROLE.STAY; d[o + 15] = 0; d[o + 16] = 0
      d[o + 17] = wn[i * 3]!; d[o + 18] = wn[i * 3 + 1]!; d[o + 19] = wn[i * 3 + 2]!
      v.n++
    }
  }
  // The right hand: the lowest point of the right arm's vertices, roughly; from the rest pose's hand through its bone.
  const H = m.hi - m.lo
  const handOf = (bone: number, x: number): [number, number, number] => {
    const hand: [number, number, number] = [x, m.lo + 0.3 * H, -0.02]
    const b = bones[bone]!
    const hx = b[0]! * hand[0] + b[1]! * hand[1] + b[2]! * hand[2] + b[3]!
    const hy = b[4]! * hand[0] + b[5]! * hand[1] + b[6]! * hand[2] + b[7]!
    const hz = b[8]! * hand[0] + b[9]! * hand[1] + b[10]! * hand[2] + b[11]!
    return [at.x + s * (hx * rx - hz * fx), at.y + s * (hx * ry - hz * fy), s * (hy - m.lo)]
  }
  lastLeft = handOf(ARM_L, -0.31)
  return handOf(ARM_R, 0.31)
}
/**
 * The mesh as the GPU keeps it, in model space: every triangle's three corners in the engine's layout (`HSTRIDE`), the
 * facet's normal turned to the side its corners' own normals are on, then each corner's two bones and the first one's
 * weight. Built once a mesh.
 */
const builtVerts = new WeakMap<HeroMesh, Float32Array>()
export function heroVerts(m: HeroMesh): Float32Array {
  const had = builtVerts.get(m)
  if (had) return had
  const tris = m.idx.length / 3
  const d = new Float32Array(tris * 3 * HSTRIDE)
  const P = m.pos, N = m.nrm
  // The smooth normals from the facets about each corner (by place, across the texture's seams), not the model's own:
  // a few of those at the back of the head point the wrong way, and the light drew their facets as a pair of eyes.
  const nv = P.length / 3
  const key = (i: number) => `${Math.round(P[i * 3]! * 1e4)},${Math.round(P[i * 3 + 1]! * 1e4)},${Math.round(P[i * 3 + 2]! * 1e4)}`
  const sums = new Map<string, [number, number, number]>()
  for (let t = 0; t < tris; t++) {
    const i0 = m.idx[t * 3]!, i1 = m.idx[t * 3 + 1]!, i2 = m.idx[t * 3 + 2]!
    const ex = P[i1 * 3]! - P[i0 * 3]!, ey = P[i1 * 3 + 1]! - P[i0 * 3 + 1]!, ez = P[i1 * 3 + 2]! - P[i0 * 3 + 2]!
    const gx = P[i2 * 3]! - P[i0 * 3]!, gy = P[i2 * 3 + 1]! - P[i0 * 3 + 1]!, gz = P[i2 * 3 + 2]! - P[i0 * 3 + 2]!
    let nx = ey * gz - ez * gy, ny = ez * gx - ex * gz, nz = ex * gy - ey * gx
    // (Turned outward: away from the model's middle at that height, which a closed figure's surface always faces.)
    const cx = (P[i0 * 3]! + P[i1 * 3]! + P[i2 * 3]!) / 3, cz = (P[i0 * 3 + 2]! + P[i1 * 3 + 2]! + P[i2 * 3 + 2]!) / 3
    if (nx * cx + nz * cz < 0 && Math.abs(nx * cx + nz * cz) > 1e-9) { nx = -nx; ny = -ny; nz = -nz }
    for (const i of [i0, i1, i2]) { const k = key(i); const a = sums.get(k) ?? [0, 0, 0]; a[0] += nx; a[1] += ny; a[2] += nz; sums.set(k, a) }
  }
  // The back of the crown, above the band: modelled with two small pockets where the drawn hero's eyes were, which any
  // light picks out as eyes on the back of the head. Flagged (8), its corners are lit flat in the shader.
  let zs = 0, zn = 0
  for (let i = 0; i < nv; i++) if (P[i * 3 + 1]! > m.lo + 0.6 * (m.hi - m.lo)) { zs += P[i * 3 + 2]!; zn++ }
  const zc = zn ? zs / zn : 0
  const crownBack = (i: number) => P[i * 3 + 1]! > m.lo + 0.79 * (m.hi - m.lo) && P[i * 3 + 2]! > zc - 0.02
  const sn = new Float32Array(nv * 3)
  for (let i = 0; i < nv; i++) {
    const a = sums.get(key(i)) ?? [N[i * 3]!, N[i * 3 + 1]!, N[i * 3 + 2]!]
    const l = Math.hypot(a[0], a[1], a[2]) || 1
    sn[i * 3] = a[0] / l; sn[i * 3 + 1] = a[1] / l; sn[i * 3 + 2] = a[2] / l
  }
  for (let t = 0; t < tris; t++) {
    const i0 = m.idx[t * 3]!, i1 = m.idx[t * 3 + 1]!, i2 = m.idx[t * 3 + 2]!
    const ax = P[i0 * 3]!, ay = P[i0 * 3 + 1]!, az = P[i0 * 3 + 2]!
    const ex = P[i1 * 3]! - ax, ey = P[i1 * 3 + 1]! - ay, ez = P[i1 * 3 + 2]! - az
    const gx = P[i2 * 3]! - ax, gy = P[i2 * 3 + 1]! - ay, gz = P[i2 * 3 + 2]! - az
    let nx = ey * gz - ez * gy, ny = ez * gx - ex * gz, nz = ex * gy - ey * gx
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l; ny /= l; nz /= l
    if (nx * (sn[i0 * 3]! + sn[i1 * 3]! + sn[i2 * 3]!) + ny * (sn[i0 * 3 + 1]! + sn[i1 * 3 + 1]! + sn[i2 * 3 + 1]!) + nz * (sn[i0 * 3 + 2]! + sn[i1 * 3 + 2]! + sn[i2 * 3 + 2]!) < 0) { nx = -nx; ny = -ny; nz = -nz }
    for (let c = 0; c < 3; c++) {
      const i = c === 0 ? i0 : c === 1 ? i1 : i2
      const o = (t * 3 + c) * HSTRIDE
      d[o] = P[i * 3]!; d[o + 1] = P[i * 3 + 1]!; d[o + 2] = P[i * 3 + 2]!; d[o + 3] = 0
      d[o + 4] = nx; d[o + 5] = ny; d[o + 6] = nz
      d[o + 7] = m.uv[i * 2]!; d[o + 8] = m.uv[i * 2 + 1]!
      d[o + 9] = TEX.HERO
      d[o + 10] = 1; d[o + 11] = 1; d[o + 12] = 1
      d[o + 13] = 1; d[o + 14] = ROLE.STAY; d[o + 15] = crownBack(i) ? 8 : 0; d[o + 16] = 0
      d[o + 17] = sn[i * 3]!; d[o + 18] = sn[i * 3 + 1]!; d[o + 19] = sn[i * 3 + 2]!
      d[o + STRIDE] = m.bone[i * 2]!; d[o + STRIDE + 1] = m.bone[i * 2 + 1]!; d[o + STRIDE + 2] = m.w[i]!
    }
  }
  builtVerts.set(m, d)
  return d
}

/** One frame of the hero for the GPU: the bones (72 numbers), where it stands, which way it faces, its two hands. */
export interface HeroFrame {
  bones: Float32Array
  place: [number, number, number, number]
  face: [number, number]
  right: [number, number, number]
  left: [number, number, number]
}
/** The pose and the place of a frame, as the vertex shader skins them (`skinned` in `engine.ts`). */
export function poseHero(m: HeroMesh, P: SolvedPose, at: Placement): HeroFrame {
  const bones = boneMatrices(m, P)
  const flat = new Float32Array(72)
  bones.forEach((b, i) => flat.set(b, i * 12))
  const s = at.scale
  const fx = Math.cos(at.yaw), fy = Math.sin(at.yaw)
  const rx = -fy, ry = fx
  const H = m.hi - m.lo
  const handOf = (bone: number, x: number): [number, number, number] => {
    const hand: [number, number, number] = [x, m.lo + 0.3 * H, -0.02]
    const b = bones[bone]!
    const hx = b[0]! * hand[0] + b[1]! * hand[1] + b[2]! * hand[2] + b[3]!
    const hy = b[4]! * hand[0] + b[5]! * hand[1] + b[6]! * hand[2] + b[7]!
    const hz = b[8]! * hand[0] + b[9]! * hand[1] + b[10]! * hand[2] + b[11]!
    return [at.x + s * (hx * rx - hz * fx), at.y + s * (hx * ry - hz * fy), s * (hy - m.lo)]
  }
  const left = handOf(ARM_L, -0.31)
  lastLeft = left
  return { bones: flat, place: [at.x, at.y, s, m.lo], face: [fx, fy], right: handOf(ARM_R, 0.31), left }
}

/** The left hand of the last hero skinned (world, tiles): with the right one, where what is carried sits. */
let lastLeft: [number, number, number] = [0, 0, 0]
export function leftHand(): [number, number, number] { return lastLeft }

/** A blade from the hand, along a world angle: a thin long box, its edge glowing. */
export function bladeMesh(v: Verts, hand: [number, number, number], a: number, g: number, length: number, arc: boolean) {
  const dx = Math.cos(a), dy = Math.sin(a)
  const px = -dy * 0.035, py = dx * 0.035
  const z0 = hand[2] + 0.02, z1 = hand[2] + 0.07
  const tip = [hand[0] + dx * length, hand[1] + dy * length]
  const base = [hand[0] + dx * 0.08, hand[1] + dy * 0.08]
  const steel: [number, number, number] = arc ? [0.75, 0.55, 1] : [0.85, 0.9, 1]
  const q = (pts: number[][], n: [number, number, number], c: [number, number, number], flags: number) => {
    v.reserve(6)
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = pts[i]!
      const o = v.n * STRIDE
      const d = v.data
      d[o] = p[0]!; d[o + 1] = p[1]!; d[o + 2] = p[2]!; d[o + 3] = g
      d[o + 4] = n[0]; d[o + 5] = n[1]; d[o + 6] = n[2]
      d[o + 7] = 0; d[o + 8] = 0; d[o + 9] = TEX.COLOR
      d[o + 10] = c[0]; d[o + 11] = c[1]; d[o + 12] = c[2]
      d[o + 13] = 1; d[o + 14] = ROLE.STAY; d[o + 15] = flags; d[o + 16] = 0
      d[o + 17] = n[0]; d[o + 18] = n[1]; d[o + 19] = n[2]
      v.n++
    }
  }
  // The flat of the blade, top and bottom faces, and its glowing edge.
  q([[base[0]! + px, base[1]! + py, z1], [tip[0]! + px * 0.3, tip[1]! + py * 0.3, z1], [tip[0]! - px * 0.3, tip[1]! - py * 0.3, z1], [base[0]! - px, base[1]! - py, z1]], [0, 0, 1], steel, 0)
  q([[base[0]! + px, base[1]! + py, z0], [tip[0]! + px * 0.3, tip[1]! + py * 0.3, z0], [tip[0]! + px * 0.3, tip[1]! + py * 0.3, z1], [base[0]! + px, base[1]! + py, z1]], [-dy, dx, 0], arc ? [1, 0.4, 0.9] : [0.4, 1, 1], FLAG.GLOW)
  q([[base[0]! - px, base[1]! - py, z0], [tip[0]! - px * 0.3, tip[1]! - py * 0.3, z0], [tip[0]! - px * 0.3, tip[1]! - py * 0.3, z1], [base[0]! - px, base[1]! - py, z1]], [dy, -dx, 0], steel, 0)
  // The guard.
  q([[hand[0] - py * 3, hand[1] + px * 3, z1 + 0.01], [hand[0] + py * 3, hand[1] - px * 3, z1 + 0.01], [hand[0] + py * 3, hand[1] - px * 3, z0 - 0.01], [hand[0] - py * 3, hand[1] + px * 3, z0 - 0.01]], [dx, dy, 0], [1, 0.82, 0.25], 0)
}

/**
 * The texture recoloured for a look that changes only colours: the jacket, the band, the hair and the trousers are
 * flat areas of the drawn hero's colours, and take the look's, keeping their shading. Null where the look is the
 * drawn hero's own colours.
 */
export function recolour(data: Uint8ClampedArray, look: HeroLook): Uint8ClampedArray | null {
  // A look of another shape wears the model too, as far as its colours go: nothing on the head is the band in the
  // hair's colour (it reads as hair), a dress is the trousers in the shirt's colour; another hair style keeps the
  // model's own hair, in the look's colour.
  const head = look.head === 'none' ? look.hairColor : look.headColor
  const bottom = look.bottom === 'dress' ? look.top : look.bottomColor
  // Each part by the model's own painted colour (measured on both meshes' textures), to the look's, if it differs
  // from the drawn hero's.
  const parts: Array<[string, string, string]> = [
    [MODEL_COLORS.top, DRAWN_LOOK.top, look.top], [MODEL_COLORS.band, DRAWN_LOOK.headColor, head],
    [MODEL_COLORS.hair, DRAWN_LOOK.hairColor, look.hairColor], [MODEL_COLORS.bottom, DRAWN_LOOK.bottomColor, bottom],
    [MODEL_COLORS.skin, DRAWN_LOOK.skin, look.skin],
  ]
  const live = parts.filter(([, drawn, want]) => drawn.toLowerCase() !== want.toLowerCase())
  if (!live.length) return null
  const rgb = (h: string) => { const v = parseInt(h.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }
  const all = parts.map(([m]) => rgb(m))
  const out = new Uint8ClampedArray(data)
  const lum = (c: number[]) => Math.max(1, c[0]! * 0.3 + c[1]! * 0.59 + c[2]! * 0.11)
  for (let o = 0; o < out.length; o += 4) {
    const c = [out[o]!, out[o + 1]!, out[o + 2]!]
    // The nearest of all the model's parts (so hair is never taken for trousers), if near enough.
    let best = -1, bd = 70
    for (let k = 0; k < all.length; k++) { const d = Math.hypot(c[0]! - all[k]![0]!, c[1]! - all[k]![1]!, c[2]! - all[k]![2]!); if (d < bd) { bd = d; best = k } }
    if (best < 0) continue
    const [m, drawn, want] = parts[best]!
    if (drawn.toLowerCase() === want.toLowerCase()) continue
    const a = rgb(m), to = rgb(want)
    // The texel's shade kept: its light against the part's own.
    const k = lum(c) / lum(a)
    out[o] = to[0]! * k; out[o + 1] = to[1]! * k; out[o + 2] = to[2]! * k
  }
  return out
}

/** The hero model's own painted colours (both meshes' textures, `poly-pack.mjs` writes them as the GLBs have them). */
export const MODEL_COLORS = { hair: '#181858', band: '#e81878', skin: '#f8a888', top: '#18a8f8', bottom: '#082858' } as const

/**
 * Whether a look can wear the model: every look the NEW LOOK stall sells can (part 7), recoloured by `recolour`; its
 * shape is the model's own (another hair style, a bow, a skirt are not modelled yet). Kept as the one place to say so.
 */
export function modelFits(look: HeroLook): boolean {
  return !!look
}

/** The solved pose for this frame (re-exported for the view). */
export function poseOf(p: FigurePose): SolvedPose { return solvePose(p) }

/** A hero model and its texture, fetched once per look (`32` or `64`). */
export interface LoadedHero { mesh: HeroMesh; tex: ImageData }
const loads = new Map<string, Promise<LoadedHero | null>>()
/** What has arrived (or failed: null), readable at once. */
const loaded = new Map<string, LoadedHero | null>()
const retried = new Set<string>()
export function loadedHero(which: '32' | '64'): LoadedHero | null | undefined { return loaded.get(which) }
export function loadHero(base: string, which: '32' | '64'): Promise<LoadedHero | null> {
  let p = loads.get(which)
  if (p) return p
  const bin = new Promise<ArrayBuffer>((ok, no) => {
    // (XHR, not fetch: the lab reads it from file://.)
    const x = new XMLHttpRequest()
    x.open('GET', `${base}hero-${which}.bin`)
    x.responseType = 'arraybuffer'
    x.onload = () => (x.status === 200 || x.status === 0) && x.response ? ok(x.response as ArrayBuffer) : no(new Error('no mesh'))
    x.onerror = () => no(new Error('no mesh'))
    x.send()
  }).then(async gz => {
    if (typeof DecompressionStream === 'undefined') throw new Error('no gzip')
    const s = new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(s).arrayBuffer()
  })
  const img = new Promise<ImageData>((ok, no) => {
    const im = new Image()
    im.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = im.width; c.height = im.height
        const g = c.getContext('2d')!
        g.drawImage(im, 0, 0)
        ok(g.getImageData(0, 0, im.width, im.height))
      } catch (e) { no(e) }
    }
    im.onerror = () => no(new Error('no texture'))
    im.src = `${base}hero-${which}.webp`
  })
  p = Promise.all([bin, img]).then(([b, tex]) => ({ mesh: parseHero(b), tex }), () => null).then(h => {
    loaded.set(which, h)
    // (A failed fetch is tried once more after a few seconds; the sprite stands in meanwhile, and for good after that.)
    if (!h && !retried.has(which)) { retried.add(which); setTimeout(() => { loads.delete(which); loaded.delete(which) }, 5000) }
    return h
  })
  loads.set(which, p)
  return p
}
