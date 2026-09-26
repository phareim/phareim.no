/**
 * Merged block geometry for Mini World's places (2026-09-26): the town,
 * the obby and the meadow are thousands of boxes, drawn as a handful of
 * meshes. `Blocks` collects boxes, roofs and quads with vertex colours
 * (and optionally UVs) under a current transform; `build()` makes one
 * BufferGeometry. `SignAtlas` paints signs in the site's pixel font onto
 * one canvas, so every sign in a place is one draw call.
 */
import * as THREE from 'three'
import { drawText, textWidth } from '../../zelda/render/font'

const tmpC = new THREE.Color()
const tmpV = new THREE.Vector3()
const tmpN = new THREE.Vector3()
const tmpM3 = new THREE.Matrix3()

export type ColorIn = string | THREE.Color

function col(c: ColorIn): THREE.Color {
  return typeof c === 'string' ? tmpC.set(c) : tmpC.copy(c)
}

export interface BoxOpts {
  /** Colour of the top face (default: a touch lighter than the sides). */
  top?: ColorIn
  /** Leave out the bottom face (things standing on the ground). */
  bottom?: boolean
  /** Scale the side colours (1 = as given). */
  side?: number
}

export class Blocks {
  pos: number[] = []
  nrm: number[] = []
  clr: number[] = []
  uv: number[] = []
  private m = new THREE.Matrix4()
  private stack: THREE.Matrix4[] = []
  private hasM = false
  readonly withUv: boolean

  constructor(withUv = false) { this.withUv = withUv }

  /** Run `fn` with an extra transform (translate, then rotate about y). */
  at(x: number, y: number, z: number, rotY: number, fn: () => void) {
    this.stack.push(this.m.clone())
    const t = new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(rotY))
    this.m.multiply(t)
    const was = this.hasM
    this.hasM = true
    fn()
    this.m.copy(this.stack.pop()!)
    this.hasM = was || this.stack.length > 0
  }

  get count(): number { return this.pos.length / 3 }

  private vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color, u = 0, v = 0) {
    if (this.hasM) {
      tmpV.set(x, y, z).applyMatrix4(this.m)
      tmpN.set(nx, ny, nz).applyMatrix3(tmpM3.setFromMatrix4(this.m)).normalize()
      this.pos.push(tmpV.x, tmpV.y, tmpV.z)
      this.nrm.push(tmpN.x, tmpN.y, tmpN.z)
    } else {
      this.pos.push(x, y, z)
      this.nrm.push(nx, ny, nz)
    }
    this.clr.push(c.r, c.g, c.b)
    if (this.withUv) this.uv.push(u, v)
  }

  /** A quad from four corners (counter-clockwise seen from the front). */
  quad(a: number[], b: number[], c: number[], d: number[], n: number[], color: ColorIn, uv?: [number, number, number, number]) {
    const k = col(color).clone()
    const [u0, v0, u1, v1] = uv ?? [0, 0, 1, 1]
    const l = Math.hypot(n[0]!, n[1]!, n[2]!) || 1
    n = [n[0]! / l, n[1]! / l, n[2]! / l]
    this.vert(a[0]!, a[1]!, a[2]!, n[0]!, n[1]!, n[2]!, k, u0, v0)
    this.vert(b[0]!, b[1]!, b[2]!, n[0]!, n[1]!, n[2]!, k, u1, v0)
    this.vert(c[0]!, c[1]!, c[2]!, n[0]!, n[1]!, n[2]!, k, u1, v1)
    this.vert(a[0]!, a[1]!, a[2]!, n[0]!, n[1]!, n[2]!, k, u0, v0)
    this.vert(c[0]!, c[1]!, c[2]!, n[0]!, n[1]!, n[2]!, k, u1, v1)
    this.vert(d[0]!, d[1]!, d[2]!, n[0]!, n[1]!, n[2]!, k, u0, v1)
  }

  tri(a: number[], b: number[], c: number[], color: ColorIn) {
    const k = col(color).clone()
    const e1 = new THREE.Vector3(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!)
    const e2 = new THREE.Vector3(c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!)
    const n = e1.cross(e2).normalize()
    this.vert(a[0]!, a[1]!, a[2]!, n.x, n.y, n.z, k)
    this.vert(b[0]!, b[1]!, b[2]!, n.x, n.y, n.z, k)
    this.vert(c[0]!, c[1]!, c[2]!, n.x, n.y, n.z, k)
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: ColorIn, o: BoxOpts = {}) {
    const side = col(color).clone()
    if (o.side !== undefined) side.multiplyScalar(o.side)
    const top = o.top !== undefined ? col(o.top).clone() : side.clone().lerp(new THREE.Color(1, 1, 1), 0.12)
    // +y
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], top)
    // -y
    if (o.bottom !== false) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], side)
    // +z
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], side)
    // -z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], side)
    // +x
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], side)
    // -x
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], side)
  }

  /** Box by centre-bottom and size. */
  block(cx: number, y0: number, cz: number, sx: number, sy: number, sz: number, color: ColorIn, o: BoxOpts = {}) {
    this.box(cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + sy, cz + sz / 2, color, { bottom: false, ...o })
  }

  /** A four-sided pyramid roof over a rectangle. */
  pyramid(cx: number, y0: number, cz: number, sx: number, sz: number, h: number, color: ColorIn) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2
    const apex = [cx, y0 + h, cz]
    this.tri([x0, y0, z1], [x1, y0, z1], apex, color)
    this.tri([x1, y0, z1], [x1, y0, z0], apex, color)
    this.tri([x1, y0, z0], [x0, y0, z0], apex, color)
    this.tri([x0, y0, z0], [x0, y0, z1], apex, color)
  }

  /** A gable roof: ridge along x (alongX) or z, with two gable ends. */
  gable(cx: number, y0: number, cz: number, sx: number, sz: number, h: number, roof: ColorIn, end: ColorIn, alongX = true) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, yt = y0 + h
    if (alongX) {
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, yt, cz], [x0, yt, cz], [0, sz / 2, h], roof)
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, yt, cz], [x1, yt, cz], [0, sz / 2, -h], roof)
      this.tri([x1, y0, z1], [x1, y0, z0], [x1, yt, cz], end)
      this.tri([x0, y0, z0], [x0, y0, z1], [x0, yt, cz], end)
    } else {
      this.quad([x1, y0, z1], [x1, y0, z0], [cx, yt, z0], [cx, yt, z1], [sx / 2, h, 0], roof)
      this.quad([x0, y0, z0], [x0, y0, z1], [cx, yt, z1], [cx, yt, z0], [-sx / 2, h, 0], roof)
      this.tri([x0, y0, z1], [x1, y0, z1], [cx, yt, z1], end)
      this.tri([x1, y0, z0], [x0, y0, z0], [cx, yt, z0], end)
    }
  }

  /** An n-sided prism (blocky cylinder) standing on y0. */
  prism(cx: number, y0: number, cz: number, r: number, h: number, n: number, color: ColorIn, topColor?: ColorIn, rot = 0) {
    const top = topColor ?? color
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2
      const x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r
      const x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r
      const am = (a0 + a1) / 2
      this.quad([x1, y0, z1], [x0, y0, z0], [x0, y0 + h, z0], [x1, y0 + h, z1], [Math.cos(am), 0, Math.sin(am)], color)
      this.tri([cx, y0 + h, cz], [x1, y0 + h, z1], [x0, y0 + h, z0], top)
    }
  }

  /** A cone (n-sided) standing on y0. */
  cone(cx: number, y0: number, cz: number, r: number, h: number, n: number, color: ColorIn, rot = 0) {
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2
      this.tri([cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], [cx, y0 + h, cz], color)
    }
  }

  /** A flat quad facing +z (after the current transform), with UVs (signs). */
  panel(cx: number, cy: number, z: number, w: number, h: number, color: ColorIn, uv?: [number, number, number, number]) {
    this.quad([cx - w / 2, cy - h / 2, z], [cx + w / 2, cy - h / 2, z], [cx + w / 2, cy + h / 2, z], [cx - w / 2, cy + h / 2, z], [0, 0, 1], color, uv)
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.clr, 3))
    if (this.withUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

/** A mesh from a Blocks builder, or null when it is empty. */
export function blocksMesh(b: Blocks, mat: THREE.Material, shadows: { cast?: boolean; receive?: boolean } = {}): THREE.Mesh | null {
  if (!b.count) return null
  const m = new THREE.Mesh(b.build(), mat)
  m.castShadow = !!shadows.cast
  m.receiveShadow = !!shadows.receive
  m.matrixAutoUpdate = false
  m.updateMatrix()
  return m
}

// ---------------------------------------------------------------- signs

export interface SignStyle {
  bg: string
  fg: string
  border?: string
  shadow?: string
  /** Font pixel scale on the atlas (1–3). */
  scale?: number
  pad?: number
}

/**
 * Signs in the pixel font on one canvas. `add` paints a sign and returns
 * its UV rect and its aspect (w/h), so the caller can size the panel.
 */
export class SignAtlas {
  readonly canvas: HTMLCanvasElement
  readonly texture: THREE.CanvasTexture
  private g: CanvasRenderingContext2D
  private x = 0
  private y = 0
  private rowH = 0

  constructor(w = 512, h = 512) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = w
    this.canvas.height = h
    this.g = this.canvas.getContext('2d')!
    this.g.imageSmoothingEnabled = false
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.magFilter = THREE.NearestFilter
    this.texture.minFilter = THREE.LinearMipmapLinearFilter
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.generateMipmaps = true
  }

  clear() {
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.x = 0; this.y = 0; this.rowH = 0
  }

  private alloc(w: number, h: number): [number, number] {
    if (this.x + w > this.canvas.width) { this.x = 0; this.y += this.rowH + 1; this.rowH = 0 }
    const at: [number, number] = [this.x, this.y]
    this.x += w + 1
    this.rowH = Math.max(this.rowH, h)
    return at
  }

  /** Lines of text, centred, on a bordered board. Optional `icon` paints before the text (left). */
  add(lines: string[], style: SignStyle, icon?: { w: number; h: number; paint: (g: CanvasRenderingContext2D, x: number, y: number) => void }): { uv: [number, number, number, number]; aspect: number } {
    const s = style.scale ?? 1
    const pad = style.pad ?? 3
    const lineH = 8
    const iconW = icon ? icon.w + 3 : 0
    const tw = Math.max(...lines.map(l => textWidth(l)))
    const w0 = tw + iconW + pad * 2 + 2
    const h0 = Math.max(lines.length * lineH - 1, icon ? icon.h : 0) + pad * 2 + 2
    const W = w0 * s, H = h0 * s
    const [ax, ay] = this.alloc(W, H)
    const g = this.g
    g.save()
    g.translate(ax, ay)
    g.scale(s, s)
    g.fillStyle = style.border ?? style.fg
    g.fillRect(0, 0, w0, h0)
    g.fillStyle = style.bg
    g.fillRect(1, 1, w0 - 2, h0 - 2)
    const top = Math.floor((h0 - (lines.length * lineH - 1)) / 2)
    if (icon) icon.paint(g, pad + 1, Math.floor((h0 - icon.h) / 2))
    lines.forEach((l, i) => {
      const lx = pad + 1 + iconW + Math.floor((tw - textWidth(l)) / 2)
      drawText(g, l, lx, top + i * lineH, style.fg, style.shadow)
    })
    g.restore()
    this.texture.needsUpdate = true
    const cw = this.canvas.width, ch = this.canvas.height
    // CanvasTexture flips y: v runs bottom-up.
    return { uv: [ax / cw, 1 - (ay + H) / ch, (ax + W) / cw, 1 - ay / ch], aspect: w0 / h0 }
  }

  dispose() { this.texture.dispose() }
}

/** A small crown in pixels (neighbour signs, royal marks). */
export function paintCrown(g: CanvasRenderingContext2D, x: number, y: number) {
  const rows = ['#.#.#', '#####', '#####']
  g.fillStyle = '#ffd23f'
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') g.fillRect(x + i, y + j + 2, 1, 1) })
}

/** A deterministic 0..1 hash of two integers (scatter, variety). */
export function hash2(x: number, z: number, seed = 0): number {
  let h = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
