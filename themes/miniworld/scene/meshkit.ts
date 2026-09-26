/**
 * Mini World's block kit (avatar/house agent): collect coloured boxes,
 * cones and voxel maps, merge them into one geometry with vertex colours,
 * and the shared materials that draw them. One merged mesh per moving
 * part keeps a person or a sofa to a handful of draw calls.
 *
 * Colours are sRGB hex; `THREE.Color` turns them linear for the vertex
 * colour attribute, as three's colour management expects.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ---------------------------------------------------------------- colours

const colorCache = new Map<string, THREE.Color>()
export function col(hex: string): THREE.Color {
  let c = colorCache.get(hex)
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c) }
  return c
}

/** Mix two hex colours in sRGB, t = 0..1 toward b. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = (p: number, s: number) => (p >> s) & 255
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t)
  return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)
}
export const darken = (hex: string, t = 0.25) => mixHex(hex, '#1a1024', t)
export const lighten = (hex: string, t = 0.3) => mixHex(hex, '#ffffff', t)

// ---------------------------------------------------------------- materials

let vcMat: THREE.MeshLambertMaterial | null = null
let vcGlowMat: THREE.MeshLambertMaterial | null = null

/** The shared vertex-colour material every merged solid part uses. Never dispose it. */
export function vcMaterial(): THREE.MeshLambertMaterial {
  if (!vcMat) vcMat = new THREE.MeshLambertMaterial({ vertexColors: true })
  return vcMat
}

/** Vertex colours that also glow in their own colour (level 3 "Magisk", lamps). */
export function vcGlowMaterial(): THREE.MeshLambertMaterial {
  if (!vcGlowMat) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true })
    m.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vColor.rgb * 0.55 + vec3(0.06, 0.02, 0.1);',
      )
    }
    m.customProgramCacheKey = () => 'mw-vc-glow'
    vcGlowMat = m
  }
  return vcGlowMat
}

const basicCache = new Map<string, THREE.Material>()
/** Unlit, shared by key (flames, screens, light spots). Never dispose. */
export function basicMaterial(hex: string, opts: { opacity?: number; additive?: boolean; vc?: boolean; side?: THREE.Side } = {}): THREE.MeshBasicMaterial {
  const key = `${hex}|${opts.opacity ?? 1}|${opts.additive ? 1 : 0}|${opts.vc ? 1 : 0}|${opts.side ?? 0}`
  let m = basicCache.get(key) as THREE.MeshBasicMaterial | undefined
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: hex,
      vertexColors: !!opts.vc,
      transparent: (opts.opacity ?? 1) < 1 || !!opts.additive,
      opacity: opts.opacity ?? 1,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !(opts.additive || (opts.opacity ?? 1) < 1),
      side: opts.side ?? THREE.FrontSide,
    })
    basicCache.set(key, m)
  }
  return m
}

const lambertCache = new Map<string, THREE.MeshLambertMaterial>()
/** Lit, one colour, shared by key (glass, water). Never dispose. */
export function lambertMaterial(hex: string, opts: { opacity?: number; emissive?: number; side?: THREE.Side } = {}): THREE.MeshLambertMaterial {
  const key = `${hex}|${opts.opacity ?? 1}|${opts.emissive ?? 0}|${opts.side ?? 0}`
  let m = lambertCache.get(key)
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color: hex,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
      depthWrite: (opts.opacity ?? 1) >= 1,
      emissive: opts.emissive ? new THREE.Color(hex).multiplyScalar(opts.emissive) : new THREE.Color(0),
      side: opts.side ?? THREE.FrontSide,
    })
    lambertCache.set(key, m)
  }
  return m
}

const texMatCache = new Map<THREE.Texture, THREE.MeshLambertMaterial>()
/** Lit, textured (patterns in world UVs), shared per texture. */
export function textureMaterial(tex: THREE.Texture, opts: { alphaTest?: number; glow?: boolean } = {}): THREE.MeshLambertMaterial {
  let m = texMatCache.get(tex)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ map: tex, alphaTest: opts.alphaTest ?? 0, transparent: false })
    texMatCache.set(tex, m)
  }
  return m
}

// ---------------------------------------------------------------- the kit

type Rot = { x?: number; y?: number; z?: number }
const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpS = new THREE.Vector3(1, 1, 1)
const tmpP = new THREE.Vector3()

const boxProto = new THREE.BoxGeometry(1, 1, 1)
const coneProtos = new Map<string, THREE.BufferGeometry>()
function coneProto(seg: number, top: number): THREE.BufferGeometry {
  const k = `${seg}|${top}`
  let g = coneProtos.get(k)
  if (!g) { g = new THREE.CylinderGeometry(top, 0.5, 1, seg, 1); coneProtos.set(k, g) }
  return g
}
const sphereProtos = new Map<number, THREE.BufferGeometry>()
function sphereProto(detail: number): THREE.BufferGeometry {
  let g = sphereProtos.get(detail)
  if (!g) {
    // Flat-shaded, indexed like the rest so they merge.
    const ico = new THREE.IcosahedronGeometry(0.5, detail)
    ico.deleteAttribute('uv')
    ico.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((ico.getAttribute('position').count) * 2), 2))
    g = ico.index ? ico : indexify(ico)
    sphereProtos.set(detail, g)
  }
  return g
}
function indexify(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.getAttribute('position').count
  const idx: number[] = []
  for (let i = 0; i < n; i++) idx.push(i)
  g.setIndex(idx)
  return g
}

/**
 * Collects parts; `build()` merges them into one indexed geometry with
 * position, normal, uv and color. Coordinates are the part's centre unless
 * a method says min corner.
 */
export class Kit {
  private parts: THREE.BufferGeometry[] = []

  get empty(): boolean { return this.parts.length === 0 }

  /** Any geometry (cloned), coloured, placed by position/rotation/scale. */
  add(proto: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rot?: Rot): this {
    const g = proto.clone()
    if (!g.index) indexify(g)
    tmpE.set(rot?.x ?? 0, rot?.y ?? 0, rot?.z ?? 0)
    tmpQ.setFromEuler(tmpE)
    tmpS.set(sx, sy, sz)
    tmpP.set(x, y, z)
    tmpM.compose(tmpP, tmpQ, tmpS)
    g.applyMatrix4(tmpM)
    const n = g.getAttribute('position').count
    const c = col(color)
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    this.parts.push(g)
    return this
  }

  /** Box by centre and size. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, rot?: Rot): this {
    return this.add(boxProto, color, x, y, z, w, h, d, rot)
  }

  /** Box by min corner and size. */
  boxMin(x0: number, y0: number, z0: number, w: number, h: number, d: number, color: string): this {
    return this.add(boxProto, color, x0 + w / 2, y0 + h / 2, z0 + d / 2, w, h, d)
  }

  /** Cone/cylinder by centre: base radius r, top radius r·top, height h, `seg` sides. */
  cone(x: number, y: number, z: number, r: number, h: number, color: string, seg = 6, top = 0, rot?: Rot): this {
    return this.add(coneProto(seg, top * 0.5), color, x, y, z, r * 2, h, r * 2, rot)
  }

  cyl(x: number, y: number, z: number, r: number, h: number, color: string, seg = 8, rot?: Rot): this {
    return this.add(coneProto(seg, 0.5), color, x, y, z, r * 2, h, r * 2, rot)
  }

  /** Faceted ball of radius r. */
  ball(x: number, y: number, z: number, r: number, color: string, detail = 0, sy = 1): this {
    return this.add(sphereProto(detail), color, x, y, z, r * 2, r * 2 * sy, r * 2)
  }

  /**
   * A pixel map extruded into voxels: rows top to bottom, each char a key
   * in `pal` ('.' or ' ' = empty). Drawn in the x/y plane centred on (x, y, z),
   * `px` units per pixel, `depth` thick; `rotY` turns it.
   */
  voxels(rows: string[], pal: Record<string, string>, x: number, y: number, z: number, px: number, depth = px, rotY = 0): this {
    const h = rows.length, w = Math.max(...rows.map(r => r.length))
    const cos = Math.cos(rotY), sin = Math.sin(rotY)
    for (let r = 0; r < h; r++) {
      const row = rows[r]!
      let cx = 0
      while (cx < row.length) {
        const ch = row[cx]!
        if (ch === '.' || ch === ' ' || !pal[ch]) { cx++; continue }
        const start = cx
        while (cx < row.length && row[cx] === ch) cx++
        const len = cx - start
        const lx = (start + len / 2 - w / 2) * px
        const ly = (h / 2 - r - 0.5) * px
        this.add(boxProto, pal[ch]!, x + lx * cos, y + ly, z - lx * sin, len * px, px, depth, { y: rotY })
      }
    }
    return this
  }

  /** The merged geometry, or null when nothing was added. The kit is emptied. */
  build(): THREE.BufferGeometry | null {
    if (!this.parts.length) return null
    const merged = this.parts.length === 1 ? this.parts[0]! : mergeGeometries(this.parts, false)
    if (this.parts.length > 1) for (const p of this.parts) p.dispose()
    this.parts = []
    merged.computeBoundingBox()
    merged.computeBoundingSphere()
    return merged
  }

  /** Build straight into a mesh with `mat` (default: the shared vertex-colour material). */
  mesh(mat: THREE.Material = vcMaterial()): THREE.Mesh | null {
    const g = this.build()
    if (!g) return null
    const m = new THREE.Mesh(g, mat)
    return m
  }
}

/**
 * Replace uv with world-planar coordinates (per face by its normal) at
 * `density` texture repeats per unit, so a tiled pattern keeps one scale
 * over every piece of a garment.
 */
export function worldUV(g: THREE.BufferGeometry, density: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i))
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    let u: number, v: number
    if (ny >= nx && ny >= nz) { u = x; v = z } else if (nx >= nz) { u = z; v = y } else { u = x; v = y }
    uv[i * 2] = u * density
    uv[i * 2 + 1] = v * density
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

/** Dispose every geometry under `root` and any material flagged `userData.own`. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose()
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
    for (const mat of mats) {
      if (mat.userData.own) {
        const mm = mat as THREE.MeshBasicMaterial
        if (mm.map && mm.map.userData.own) mm.map.dispose()
        mat.dispose()
      }
    }
  })
}

/** Mark a material as owned by one object (disposeTree frees it). */
export function own<T extends THREE.Material>(m: T): T { m.userData.own = true; return m }

// ---------------------------------------------------------------- sparkles

let sparkTex: THREE.Texture | null = null
/** A 7×7 four-point twinkle, white, for Points. */
export function sparkleTexture(): THREE.Texture {
  if (!sparkTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 7
    const g = c.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.fillRect(3, 0, 1, 7); g.fillRect(0, 3, 7, 1); g.fillRect(2, 2, 3, 3)
    g.fillStyle = 'rgba(255,255,255,0.5)'
    g.fillRect(1, 1, 1, 1); g.fillRect(5, 1, 1, 1); g.fillRect(1, 5, 1, 1); g.fillRect(5, 5, 1, 1)
    sparkTex = new THREE.CanvasTexture(c)
    sparkTex.magFilter = THREE.NearestFilter
    sparkTex.minFilter = THREE.NearestFilter
    sparkTex.generateMipmaps = false
    sparkTex.colorSpace = THREE.SRGBColorSpace
  }
  return sparkTex
}

/**
 * Twinkling sparkles as one Points draw: `count` points placed by `place`,
 * coloured from `colors`; `tick(t)` pulses them (and floats them up when
 * `float` is set, wrapping inside `box`).
 */
export function sparkles(count: number, box: THREE.Box3, colors: string[], opts: { size?: number; float?: boolean; seed?: number } = {}) {
  const pos = new Float32Array(count * 3)
  const colArr = new Float32Array(count * 3)
  const base: THREE.Color[] = []
  const phase: number[] = []
  let s = opts.seed ?? 7
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  const size = box.getSize(new THREE.Vector3())
  for (let i = 0; i < count; i++) {
    pos[i * 3] = box.min.x + rnd() * size.x
    pos[i * 3 + 1] = box.min.y + rnd() * size.y
    pos[i * 3 + 2] = box.min.z + rnd() * size.z
    base.push(col(colors[i % colors.length]!))
    phase.push(rnd() * Math.PI * 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
  const mat = own(new THREE.PointsMaterial({
    size: opts.size ?? 0.28, map: sparkleTexture(), vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, alphaTest: 0.01,
  }))
  const points = new THREE.Points(g, mat)
  points.frustumCulled = false
  const tick = (t: number, dt = 0) => {
    for (let i = 0; i < count; i++) {
      const k = Math.max(0, Math.sin(t * 2.6 + phase[i]!)) ** 2
      const c = base[i]!
      colArr[i * 3] = c.r * k; colArr[i * 3 + 1] = c.g * k; colArr[i * 3 + 2] = c.b * k
      if (opts.float && dt) {
        let y = pos[i * 3 + 1]! + dt * 0.35
        if (y > box.max.y) y = box.min.y
        pos[i * 3 + 1] = y
      }
    }
    g.getAttribute('color').needsUpdate = true
    if (opts.float) g.getAttribute('position').needsUpdate = true
  }
  tick(0.4)
  return { points, tick }
}
