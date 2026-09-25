/**
 * Shared bits for the Star Fox models (2026-09-25): the palette, shared
 * materials, a tiny low-poly geometry builder, and the Model contract
 * every enemy, boss, capsule and prop follows.
 *
 * Conventions (all models):
 * - Units are world units of the flight scene (the lane is ±11 wide,
 *   the ground at y = −5, the ship's laser hit box ~1.6 across).
 * - Noses point +Z, toward the player. `root.lookAt(target)` aims a nose
 *   at the target (Object3D.lookAt turns +Z to the target).
 * - Geometry is flat shaded (non-indexed, face normals) and cached per
 *   model kind; materials are cached per colour. Building a second
 *   instance only creates Mesh objects, so pools are cheap.
 * - Materials are double sided, so a model reads the same from any side.
 * - Hit flash swaps every mesh of the instance to one white material and
 *   back; no per-instance materials are needed for it.
 * - Light anchors are points in a node's local space; `eachLight` turns
 *   them into world positions for the stage light map (call it after a
 *   render, or after `root.updateMatrixWorld()`).
 */
import * as THREE from 'three'
import { glyphRows } from '../../zelda/render/font'

// ---------------------------------------------------------------- palette

/** Neon Shrine colours (all in QUANT_PALETTE, so they survive the snap). */
export const P = {
  ink: '#0b0616', night: '#140b26', dusk: '#1c1030', plum: '#2a1a4c', violet: '#43246e',
  mauve: '#6a2a7c', rose: '#a8347e', blush: '#e0508a',
  sunPale: '#fff1b0', gold: '#ffd23f', orange: '#ff8a3d', hot: '#ff2fa0',
  ridge: '#2c2058', ridgeLit: '#6a4fb0', ridgeDark: '#1c1440', ridgeRim: '#d0509e',
  deepTeal: '#0f3445', teal: '#1b5763', sea: '#2a8579', mint: '#5fd6b8',
  grass: '#245573', grassLit: '#2d6682', grassDark: '#1b4560', grassDeep: '#163a52', aqua: '#3f8fa8', ice: '#6fd2d6',
  path: '#7d4d7c', pathLit: '#9b6593', pathDark: '#5e3862',
  stone: '#3a2f70', stoneLit: '#4a3d88', stoneDark: '#271f50', stoneDeep: '#1f1a3c',
  cyan: '#2ff3ff', cyanDark: '#1a9fc4', white: '#fff4ff', lavender: '#cfc6ff', grey: '#8f86b8', greyDark: '#5a5285',
  purple: '#9a4ff0', purpleDark: '#54259e', pink: '#ff8ae0', pinkDark: '#b01874',
  amber: '#c4861c', red: '#ff3b5c', redDark: '#9e1638', blue: '#2f5fd0', navy: '#1a2f78',
  lime: '#b6ff4a', limeDark: '#4f9a2a', jade: '#3fd8b0', jadeDark: '#1f7a6e',
  clay: '#5b2a1c', clayLit: '#b0543a', clayHot: '#e07a4e',
} as const

export type Hex = string

// ---------------------------------------------------------------- materials

const lit = new Map<string, THREE.MeshLambertMaterial>()
/** Share of a hull's own colour it shows unlit (linear). */
export const SELF_LIGHT = 0.28
const glow = new Map<string, THREE.MeshBasicMaterial>()

/** Flat-lit hull material, shared per colour. */
export function hullMat(color: Hex): THREE.MeshLambertMaterial {
  let m = lit.get(color)
  if (!m) {
    // A little self-light, so faces turned from the game's three lights
    // keep their colour instead of sinking to black at pixel size.
    m = new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(SELF_LIGHT), flatShading: true, side: THREE.DoubleSide })
    lit.set(color, m)
  }
  return m
}

/** Unlit glow material (eyes, engines, neon strips), shared per colour. */
export function glowMat(color: Hex): THREE.MeshBasicMaterial {
  let m = glow.get(color)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    glow.set(color, m)
  }
  return m
}

/** Own (not shared) lit material, for models that tint per instance (carrier hurt glow, turret biome). */
export function ownHullMat(color: Hex, emissive: Hex = P.ink): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, emissive, flatShading: true, side: THREE.DoubleSide })
}

/** The hit-flash material: every mesh of a model turns to it for a frame or two. */
export const FLASH_MAT = new THREE.MeshBasicMaterial({ color: P.white, side: THREE.DoubleSide })

// ---------------------------------------------------------------- geometry builder

export type V3 = [number, number, number]

/** Collects triangles, then builds one flat-shaded non-indexed BufferGeometry. */
export class Geo {
  readonly pos: number[] = []

  tri(a: V3, b: V3, c: V3): this {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
    return this
  }

  quad(a: V3, b: V3, c: V3, d: V3): this {
    return this.tri(a, b, c).tri(a, c, d)
  }

  /** A fan from the centroid: fine for convex and star-shaped polygons. */
  poly(pts: V3[]): this {
    const c = centroid(pts)
    for (let i = 0; i < pts.length; i++) this.tri(c, pts[i]!, pts[(i + 1) % pts.length]!)
    return this
  }

  /**
   * Rings of equal length, joined by quads (a fuselage, a needle, a pod).
   * Caps close the first/last ring with a fan; a ring of one point is a tip.
   */
  loft(rings: V3[][], capStart = true, capEnd = true): this {
    for (let r = 0; r < rings.length - 1; r++) {
      const A = rings[r]!
      const B = rings[r + 1]!
      const n = Math.max(A.length, B.length)
      for (let i = 0; i < n; i++) {
        const a0 = A[i % A.length]!
        const a1 = A[(i + 1) % A.length]!
        const b0 = B[i % B.length]!
        const b1 = B[(i + 1) % B.length]!
        if (A.length === 1) this.tri(a0, b1, b0)
        else if (B.length === 1) this.tri(a0, a1, b0)
        else this.quad(a0, a1, b1, b0)
      }
    }
    if (capStart && rings[0]!.length > 2) this.poly(rings[0]!)
    if (capEnd && rings[rings.length - 1]!.length > 2) this.poly(rings[rings.length - 1]!)
    return this
  }

  /**
   * A plate: the outline `pts` (x, y, z, any y per vertex) thickened by
   * `thick` along Y, with side walls. Wings, fins, panels.
   */
  plate(pts: V3[], thick: number): this {
    const h = thick / 2
    const top = pts.map(p => [p[0], p[1] + h, p[2]] as V3)
    const bot = pts.map(p => [p[0], p[1] - h, p[2]] as V3)
    this.poly(top).poly(bot)
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length
      this.quad(top[i]!, top[j]!, bot[j]!, bot[i]!)
    }
    return this
  }

  /** Like `plate`, thickened along X (fins, blades standing upright). */
  fin(pts: V3[], thick: number): this {
    const h = thick / 2
    const a = pts.map(p => [p[0] + h, p[1], p[2]] as V3)
    const b = pts.map(p => [p[0] - h, p[1], p[2]] as V3)
    this.poly(a).poly(b)
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length
      this.quad(a[i]!, a[j]!, b[j]!, b[i]!)
    }
    return this
  }

  /** An axis-aligned box centred on (x, y, z). */
  box(x: number, y: number, z: number, w: number, h: number, d: number): this {
    return this.add(new THREE.BoxGeometry(w, h, d), new THREE.Matrix4().makeTranslation(x, y, z))
  }

  /** Append a three.js geometry (disposed after), optionally transformed. */
  add(geo: THREE.BufferGeometry, m?: THREE.Matrix4): this {
    const g = geo.index ? geo.toNonIndexed() : geo
    if (m) g.applyMatrix4(m)
    const a = g.getAttribute('position')
    for (let i = 0; i < a.count; i++) this.pos.push(a.getX(i), a.getY(i), a.getZ(i))
    if (g !== geo) g.dispose()
    geo.dispose()
    return this
  }

  /** Mirror every triangle so far across x = 0 (add the other side). */
  mirrorX(): this {
    const n = this.pos.length
    for (let i = 0; i < n; i += 9) {
      // Flip the winding so faces keep pointing outward.
      this.pos.push(
        -this.pos[i]!, this.pos[i + 1]!, this.pos[i + 2]!,
        -this.pos[i + 6]!, this.pos[i + 7]!, this.pos[i + 8]!,
        -this.pos[i + 3]!, this.pos[i + 4]!, this.pos[i + 5]!,
      )
    }
    return this
  }

  get empty(): boolean {
    return this.pos.length === 0
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }
}

export function centroid(pts: V3[]): V3 {
  let x = 0, y = 0, z = 0
  for (const p of pts) { x += p[0]; y += p[1]; z += p[2] }
  return [x / pts.length, y / pts.length, z / pts.length]
}

/** A ring of `n` points round the Z axis at depth `z` (radius rx × ry, turned by `rot`). */
export function ringZ(n: number, rx: number, ry: number, z: number, rot = 0, cx = 0, cy = 0): V3[] {
  const out: V3[] = []
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z])
  }
  return out
}

/** A ring of `n` points round the Y axis at height `y`. */
export function ringY(n: number, rx: number, rz: number, y: number, rot = 0, cx = 0, cz = 0): V3[] {
  const out: V3[] = []
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    out.push([cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz])
  }
  return out
}

export function translate(m: THREE.Matrix4 | null, x: number, y: number, z: number): THREE.Matrix4 {
  return (m ?? new THREE.Matrix4()).makeTranslation(x, y, z)
}

/** Compose a matrix from position, Euler rotation and scale. */
export function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  )
}

// ---------------------------------------------------------------- caches

const geoCache = new Map<string, THREE.BufferGeometry>()

/** Build a geometry once per key; later calls share it. */
export function cachedGeo(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key)
  if (!g) { g = build(); geoCache.set(key, g) }
  return g
}

/** Build a Geo once per key (empty builders are allowed and give an empty geometry). */
export function geo(key: string, build: (g: Geo) => void): THREE.BufferGeometry {
  return cachedGeo(key, () => { const g = new Geo(); build(g); return g.build() })
}

/** Dispose every cached geometry and material (the lab and the game call it on unmount). */
export function disposeModelCaches(): void {
  for (const g of geoCache.values()) g.dispose()
  geoCache.clear()
  for (const m of lit.values()) m.dispose()
  lit.clear()
  for (const m of glow.values()) m.dispose()
  glow.clear()
}

// ---------------------------------------------------------------- the model contract

/** A glow anchor: a point in `node`'s local space, pushed to the stage light map. */
export interface ModelLight {
  node: THREE.Object3D
  x: number
  y: number
  z: number
  /** Radius in world units (the integrator projects it to pixels). */
  r: number
  color: Hex
  /** 0–1 base strength. */
  a: number
  /** Off lights are skipped by `eachLight` (a destroyed part, a closed eye). */
  on: boolean
}

export interface Model {
  root: THREE.Group
  /** Glow anchors for the stage light map. */
  lights: ModelLight[]
  /** Collision radius around the root, in world units at scale 1. */
  radius: number
  /** Hit flash: everything white while on. */
  flash(on: boolean): void
  /** Idle motion; call once a frame while visible. */
  animate(t: number, dt: number): void
}

export function light(node: THREE.Object3D, x: number, y: number, z: number, r: number, color: Hex, a = 0.7): ModelLight {
  return { node, x, y, z, r, color, a, on: true }
}

const tmpL = new THREE.Vector3()

/** Every lit anchor of `lights` in world space. Skips invisible nodes. */
export function eachLight(lights: readonly ModelLight[], cb: (x: number, y: number, z: number, r: number, color: Hex, a: number) => void, scale = 1): void {
  for (const l of lights) {
    if (!l.on || !visibleInTree(l.node)) continue
    tmpL.set(l.x, l.y, l.z)
    l.node.localToWorld(tmpL)
    cb(tmpL.x, tmpL.y, tmpL.z, l.r * scale, l.color, l.a)
  }
}

function visibleInTree(o: THREE.Object3D | null): boolean {
  while (o) {
    if (!o.visible) return false
    o = o.parent
  }
  return true
}

/** A mesh with its material remembered, so `flash` can restore it. */
export function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent?: THREE.Object3D): THREE.Mesh {
  const me = new THREE.Mesh(g, m)
  me.userData.mat = m
  if (parent) parent.add(me)
  return me
}

/** Swap every mesh under `root` to the flash material, or back. */
export function flashTree(root: THREE.Object3D, on: boolean): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.userData.mat) return
    m.material = on ? FLASH_MAT : (m.userData.mat as THREE.Material)
  })
}

/** Change a mesh's own material (and what `flash` restores to). */
export function setMat(m: THREE.Mesh, mat: THREE.Material): void {
  m.userData.mat = mat
  if (m.material !== FLASH_MAT) m.material = mat
}

// ---------------------------------------------------------------- pixel letters

/**
 * A 5×7 pixel-font letter on a dark plate with an outline, as a nearest-
 * filtered texture (9×11 texels: one texel margin, one texel outline).
 */
export function letterTexture(letter: string, color: Hex, plate: Hex = P.ink, edge: Hex = P.white): THREE.CanvasTexture {
  const key = `${letter}|${color}|${plate}|${edge}`
  let t = letterCache.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = 9
  c.height = 11
  const g = c.getContext('2d')!
  g.fillStyle = edge
  g.fillRect(0, 0, 9, 11)
  g.fillStyle = plate
  g.fillRect(1, 1, 7, 9)
  drawGlyph(g, letter, 2, 2, color)
  t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  letterCache.set(key, t)
  return t
}

const letterCache = new Map<string, THREE.CanvasTexture>()

function drawGlyph(g: CanvasRenderingContext2D, ch: string, x: number, y: number, color: Hex) {
  const rows = glyphRows(ch)
  g.fillStyle = color
  for (let r = 0; r < rows.length; r++) {
    for (let k = 0; k < rows[r]!.length; k++) if (rows[r]![k] === '#') g.fillRect(x + k, y + r, 1, 1)
  }
}

/** Deterministic pseudo-random in [0, 1) for model details (same model every build). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
