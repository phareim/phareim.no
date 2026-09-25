/**
 * Biome obstacles (2026-09-25): what replaces the grey pillars and rocks
 * in each sector. Two shapes, as before, so the rules stay the same:
 *
 * - `tall`: stands on the ground. Placed like Flight's pillars: base at
 *   (x, y, z), width `w`, height `h` (pillars were w 2.2–4.2, h 5–15 from
 *   y = −5). Collision: a vertical cylinder of radius `w × radius` from
 *   the base to `h`; props with a crown (trees) add a sphere `capR × w`
 *   at the top — see `PropDef.collide`.
 * - `float`: hangs in the lane like Flight's rocks: centre (x, y, z),
 *   radius `r` (rocks were 1.0–2.2). Collision: a sphere `r × radius`.
 *
 * Instanced: `createPropField(shape, capacity)` makes one pool for every
 * biome (one InstancedMesh per biome × variant × material, built on first
 * use); `setBiome` swaps which set shows. A slot's variant is `i % n`
 * unless `set` passes one. Hidden slots are zero-scaled.
 */
import * as THREE from 'three'
import { Geo, P, geo, hullMat, glowMat, ringY, mat, seeded, type Hex, type V3 } from './core'
import { BIOMES, type BiomeId } from '../pixel'

export type PropShape = 'tall' | 'float'

/**
 * How a part is placed. 'stretch': unit geometry (y 0–1, x/z ±0.5) scaled
 * (w, h, w) from the base. 'top': built for w = 1 round the top point,
 * scaled by w at (x, y + h, z). 'base': the same at the base. 'uniform':
 * float props, unit radius, scaled by r.
 */
export type PropPlace = 'stretch' | 'top' | 'base' | 'uniform'

export interface PropPart { key: string; color: Hex; glow: boolean; place: PropPlace; build: (g: Geo) => void }

export interface PropLight {
  /** Unit coordinates: for 'stretch' y is a share of h; for 'top' an offset above the top in w; float: in r. */
  x: number; y: number; z: number
  at: 'stretch' | 'top' | 'uniform'
  r: number; color: Hex; a: number
}

export interface PropDef {
  id: string
  name: string
  shape: PropShape
  parts: PropPart[]
  lights: PropLight[]
  /** Collision in unit terms: tall = cylinder radius × w (+ a crown sphere capR × w at the top); float = sphere radius × r. */
  collide: { radius: number; capR?: number }
}

// ---------------------------------------------------------------- shapes

/** Irregular ring round Y (rocks, stacks), deterministic per seed. */
function roughRing(n: number, r: number, y: number, rnd: () => number, jitter = 0.18): V3[] {
  return ringY(n, r, r, y, rnd() * 6).map(p => {
    const k = 1 + (rnd() - 0.5) * jitter * 2
    return [p[0] * k, p[1], p[2] * k] as V3
  })
}

/** A lumpy rock of radius ~1: an icosahedron with pushed vertices. */
function lump(g: Geo, seed: number, sx = 1, sy = 1, sz = 1, jit = 0.28) {
  const ico = new THREE.IcosahedronGeometry(1, 1)
  const pos = ico.getAttribute('position')
  const rnd = seeded(seed)
  const seen = new Map<string, number>()
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
    let k = seen.get(key)
    if (k === undefined) { k = 1 + (rnd() - 0.5) * jit * 2; seen.set(key, k) }
    pos.setXYZ(i, pos.getX(i) * k * sx, pos.getY(i) * k * sy, pos.getZ(i) * k * sz)
  }
  g.add(ico)
}

const part = (key: string, color: Hex, place: PropPlace, build: (g: Geo) => void, glow = false): PropPart => ({ key, color, glow, place, build })

// ---------------------------------------------------------------- the catalogue

export const PROPS: Record<BiomeId, { tall: PropDef[]; float: PropDef[] }> = {
  coast: {
    tall: [
      {
        id: 'stack', name: 'SEA STACK', shape: 'tall', collide: { radius: 0.5 },
        parts: [
          part('stack/rock', P.stoneLit, 'stretch', (g) => {
            const rnd = seeded(11)
            const ys = [0, 0.28, 0.32, 0.6, 0.64, 0.9, 1]
            const rs = [0.5, 0.46, 0.5, 0.42, 0.45, 0.38, 0.3]
            g.loft(ys.map((y, i) => roughRing(7, rs[i]!, y, seeded(11 + i), 0.12)), false, true)
            void rnd
          }),
          part('stack/strata', P.stoneDark, 'stretch', (g) => {
            for (const y of [0.3, 0.62]) g.loft([roughRing(7, 0.52, y - 0.02, seeded(40), 0.1), roughRing(7, 0.52, y + 0.02, seeded(40), 0.1)], false, false)
          }),
          part('stack/cap', P.sea, 'top', (g) => { g.loft([ringY(7, 0.34, 0.34, -0.05), ringY(7, 0.3, 0.3, 0.12), [[0, 0.2, 0]]], true, false) }),
          part('stack/foam', P.ice, 'base', (g) => { g.loft([ringY(8, 0.62, 0.62, 0.02), ringY(8, 0.5, 0.5, 0.08)], false, false) }, true),
        ],
        lights: [],
      },
      {
        id: 'marker', name: 'CHANNEL MARKER', shape: 'tall', collide: { radius: 0.35 },
        parts: [
          part('marker/frame', P.greyDark, 'stretch', (g) => {
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * Math.PI * 2 + Math.PI / 4
              const b0: V3 = [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4]
              const t0: V3 = [Math.cos(a) * 0.12, 0.96, Math.sin(a) * 0.12]
              g.loft([ringY(4, 0.04, 0.04, 0, 0, b0[0], b0[2]), ringY(4, 0.03, 0.03, 0.96, 0, t0[0], t0[2])], false, false)
            }
            for (const y of [0.25, 0.5, 0.75]) g.add(new THREE.CylinderGeometry(0.4 - y * 0.29, 0.4 - y * 0.29, 0.02, 4, 1, true), mat(0, y, 0, 0, Math.PI / 4))
          }),
          part('marker/bands', P.hot, 'stretch', (g) => {
            for (const y of [0.12, 0.42, 0.72]) g.add(new THREE.CylinderGeometry(0.38 - y * 0.28, 0.4 - y * 0.28, 0.05, 4), mat(0, y, 0, 0, Math.PI / 4))
          }, true),
          part('marker/lamp', P.stoneDark, 'top', (g) => { g.box(0, 0, 0, 0.35, 0.12, 0.35).box(0, 0.42, 0, 0.3, 0.08, 0.3) }),
          part('marker/light', P.hot, 'top', (g) => { g.add(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 6), mat(0, 0.22, 0)) }, true),
        ],
        lights: [{ x: 0, y: 0.25, z: 0, at: 'top', r: 1.4, color: P.hot, a: 0.8 }],
      },
    ],
    float: [
      {
        id: 'beacon', name: 'HOLLOW BEACON', shape: 'float', collide: { radius: 0.85 },
        parts: [
          part('beacon/shell', P.stone, 'uniform', (g) => { g.add(new THREE.OctahedronGeometry(0.75), mat(0, 0, 0, 0, 0, 0, 1, 1.1, 1)) }),
          part('beacon/cage', P.grey, 'uniform', (g) => {
            for (let i = 0; i < 3; i++) g.add(new THREE.TorusGeometry(0.9, 0.05, 3, 8), mat(0, 0, 0, Math.PI / 2, (i * Math.PI) / 3, 0))
          }),
          part('beacon/eye', P.hot, 'uniform', (g) => { g.add(new THREE.OctahedronGeometry(0.32)) }, true),
        ],
        lights: [{ x: 0, y: 0, z: 0, at: 'uniform', r: 1.2, color: P.hot, a: 0.6 }],
      },
    ],
  },
  woods: {
    tall: [
      {
        id: 'tree', name: 'OLD TREE', shape: 'tall', collide: { radius: 0.3, capR: 1.1 },
        parts: [
          part('tree/trunk', P.pathDark, 'stretch', (g) => {
            g.loft([ringY(6, 0.4, 0.4, 0), ringY(6, 0.26, 0.26, 0.12, 0.3), ringY(6, 0.2, 0.2, 0.7, 0.1), ringY(6, 0.16, 0.16, 1, 0.4)], false, true)
            // Roots.
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * Math.PI * 2 + 0.4
              g.fin([[0, 0.12, 0], [Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55], [0, 0, 0]].map(p => p as V3), 0.06)
            }
          }),
          part('tree/crown', P.teal, 'top', (g) => {
            lump(g, 3, 1.15, 0.72, 1.15, 0.2)
            g.add(new THREE.IcosahedronGeometry(0.7, 0), mat(0.55, 0.55, 0.2))
            g.add(new THREE.IcosahedronGeometry(0.6, 0), mat(-0.5, 0.45, -0.3))
          }),
          part('tree/lit', P.sea, 'top', (g) => { g.add(new THREE.IcosahedronGeometry(0.62, 0), mat(-0.25, 0.75, 0.25)) }),
          part('tree/spores', P.jade, 'top', (g) => {
            const rnd = seeded(5)
            for (let i = 0; i < 7; i++) g.box((rnd() - 0.5) * 2.2, -0.6 - rnd() * 0.4, (rnd() - 0.5) * 2.2, 0.09, 0.09, 0.09)
          }, true),
        ],
        lights: [{ x: 0, y: -0.7, z: 0, at: 'top', r: 1.8, color: P.jade, a: 0.35 }],
      },
    ],
    float: [
      {
        id: 'puff', name: 'SPORE PUFF', shape: 'float', collide: { radius: 0.85 },
        parts: [
          part('puff/body', P.jadeDark, 'uniform', (g) => { lump(g, 8, 0.8, 0.8, 0.8, 0.22) }),
          part('puff/nodes', P.mint, 'uniform', (g) => {
            const rnd = seeded(9)
            for (let i = 0; i < 9; i++) {
              const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.82)
              g.add(new THREE.OctahedronGeometry(0.16), mat(v.x, v.y, v.z))
            }
          }, true),
        ],
        lights: [{ x: 0, y: 0, z: 0, at: 'uniform', r: 1.3, color: P.jade, a: 0.5 }],
      },
    ],
  },
  ember: {
    tall: [
      {
        id: 'spire', name: 'OBSIDIAN SPIRE', shape: 'tall', collide: { radius: 0.4 },
        parts: [
          part('spire/glass', P.stoneDeep, 'stretch', (g) => {
            g.loft([roughRing(5, 0.5, 0, seeded(21), 0.15), roughRing(5, 0.36, 0.35, seeded(22), 0.15), roughRing(5, 0.2, 0.75, seeded(23), 0.2), [[0.04, 1, 0]]], false, false)
            g.loft([roughRing(4, 0.22, 0, seeded(24), 0.2), [[0.42, 0.46, 0.1]]].map(r => r.map(p => [p[0] + 0.38, p[1], p[2] + 0.05] as V3)), false, false)
          }),
          part('spire/edge', P.stoneLit, 'stretch', (g) => { g.fin([[0.3, 0, 0.32], [0.2, 0.4, 0.22], [0.05, 1, 0.02], [0.14, 0.4, 0.3]], 0.03) }),
          part('spire/crack', P.orange, 'stretch', (g) => {
            g.loft([ringY(3, 0.03, 0.03, 0.02, 0, -0.44, 0.1), ringY(3, 0.03, 0.03, 0.4, 0, -0.3, 0.05), ringY(3, 0.02, 0.02, 0.7, 0, -0.16, 0.02)], false, false)
          }, true),
          part('spire/rim', P.orange, 'base', (g) => { g.loft([ringY(7, 0.66, 0.66, 0.01), ringY(7, 0.52, 0.52, 0.05)], false, false) }, true),
        ],
        lights: [{ x: 0, y: 0.05, z: 0, at: 'stretch', r: 1.6, color: P.orange, a: 0.45 }],
      },
      {
        id: 'geyser', name: 'LAVA GEYSER', shape: 'tall', collide: { radius: 0.4 },
        parts: [
          part('geyser/cone', P.clay, 'base', (g) => { g.loft([roughRing(7, 0.9, 0, seeded(31), 0.15), roughRing(7, 0.45, 0.45, seeded(32), 0.1), ringY(7, 0.32, 0.32, 0.5)], false, false) }),
          part('geyser/mouth', P.gold, 'base', (g) => { g.poly(ringY(7, 0.32, 0.32, 0.5)) }, true),
          part('geyser/jet', P.orange, 'stretch', (g) => {
            g.loft([ringY(5, 0.18, 0.18, 0), ringY(5, 0.3, 0.3, 0.55, 0.4), ringY(5, 0.42, 0.42, 0.85, 0.2), ringY(5, 0.2, 0.2, 1, 0.6)], false, true)
          }, true),
          part('geyser/core', P.gold, 'stretch', (g) => { g.loft([ringY(4, 0.1, 0.1, 0), ringY(4, 0.18, 0.18, 0.6), [[0, 0.95, 0]]], false, false) }, true),
        ],
        lights: [{ x: 0, y: 0.9, z: 0, at: 'stretch', r: 2.2, color: P.orange, a: 0.7 }, { x: 0, y: 0.04, z: 0, at: 'stretch', r: 1.4, color: P.gold, a: 0.6 }],
      },
    ],
    float: [
      {
        id: 'magma', name: 'MAGMA ROCK', shape: 'float', collide: { radius: 0.9 },
        parts: [
          part('magma/rock', P.stoneDark, 'uniform', (g) => { lump(g, 14, 1, 0.85, 0.95, 0.3) }),
          part('magma/veins', P.orange, 'uniform', (g) => { lump(g, 14, 0.93, 0.79, 0.88, 0.3) }, true),
        ],
        lights: [{ x: 0, y: 0, z: 0, at: 'uniform', r: 1.2, color: P.orange, a: 0.4 }],
      },
    ],
  },
  lake: {
    tall: [
      {
        id: 'monolith', name: 'CRYSTAL MONOLITH', shape: 'tall', collide: { radius: 0.45 },
        parts: [
          part('monolith/body', P.grey, 'stretch', (g) => {
            g.loft([ringY(6, 0.42, 0.3, 0, 0.3), ringY(6, 0.4, 0.28, 0.82, 0.3), [[0.05, 1, 0]]], false, false)
            g.loft([ringY(5, 0.2, 0.16, 0, 0, 0.42, 0.18), ringY(5, 0.17, 0.14, 0.42, 0, 0.5, 0.2), [[0.58, 0.52, 0.22]]], false, false)
          }),
          part('monolith/facet', P.ice, 'stretch', (g) => { g.fin([[0, 0.05, 0.31], [0, 0.8, 0.29], [0, 0.95, 0.05], [0, 0.05, 0.05]].map(p => [p[0] + 0.12, p[1], p[2]] as V3), 0.02) }),
          part('monolith/core', P.cyan, 'stretch', (g) => { g.loft([ringY(4, 0.05, 0.05, 0.1), ringY(4, 0.05, 0.05, 0.78)], false, false) }, true),
        ],
        lights: [{ x: 0, y: 0.5, z: 0, at: 'stretch', r: 1.5, color: P.cyan, a: 0.4 }],
      },
    ],
    float: [
      {
        id: 'shard', name: 'CRYSTAL SHARD', shape: 'float', collide: { radius: 0.8 },
        parts: [
          part('shard/body', P.lavender, 'uniform', (g) => {
            g.loft([[[0, 1.3, 0]], ringY(6, 0.45, 0.45, 0.2), ringY(6, 0.45, 0.45, -0.3), [[0, -1.0, 0]]])
            g.loft([[[0.55, 0.8, 0.1]], ringY(4, 0.18, 0.18, 0.1, 0, 0.4, 0.1), [[0.3, -0.25, 0.1]]])
          }),
          part('shard/core', P.cyan, 'uniform', (g) => { g.add(new THREE.OctahedronGeometry(0.28), mat(0, 0, 0, 0, 0, 0, 1, 2.2, 1)) }, true),
        ],
        lights: [{ x: 0, y: 0, z: 0, at: 'uniform', r: 1.2, color: P.cyan, a: 0.5 }],
      },
    ],
  },
  space: {
    tall: [
      {
        id: 'girder', name: 'HULL GIRDER', shape: 'tall', collide: { radius: 0.5 },
        parts: [
          part('girder/posts', P.greyDark, 'stretch', (g) => {
            for (const [x, z] of [[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]] as const) g.box(x, 0.5, z, 0.12, 1, 0.12)
            for (let y = 0.1; y < 1; y += 0.2) {
              g.box(0, y, 0.4, 0.8, 0.03, 0.06).box(0, y, -0.4, 0.8, 0.03, 0.06)
              g.box(0.4, y + 0.1, 0, 0.06, 0.03, 0.8).box(-0.4, y + 0.1, 0, 0.06, 0.03, 0.8)
            }
          }),
          part('girder/plate', P.stone, 'stretch', (g) => { g.box(0, 0.62, 0.43, 0.9, 0.3, 0.05).box(-0.43, 0.3, 0, 0.05, 0.22, 0.9) }),
          part('girder/cap', P.stoneDark, 'top', (g) => { g.box(0, 0, 0, 1.2, 0.16, 1.2) }),
          part('girder/lamp', P.purple, 'top', (g) => { g.box(0.5, 0.12, 0.5, 0.16, 0.12, 0.16).box(-0.5, 0.12, -0.5, 0.16, 0.12, 0.16) }, true),
        ],
        lights: [{ x: 0.5, y: 0.15, z: 0.5, at: 'top', r: 1, color: P.purple, a: 0.6 }],
      },
    ],
    float: [
      {
        id: 'asteroid', name: 'ASTEROID', shape: 'float', collide: { radius: 0.9 },
        parts: [
          part('asteroid/rock', P.greyDark, 'uniform', (g) => { lump(g, 77, 1.05, 0.9, 1, 0.32) }),
          part('asteroid/crater', P.stoneDark, 'uniform', (g) => {
            g.add(new THREE.CylinderGeometry(0.38, 0.2, 0.2, 7), mat(0.1, 0.35, 0.82, Math.PI / 2 - 0.3))
            g.add(new THREE.CylinderGeometry(0.25, 0.12, 0.2, 6), mat(-0.7, -0.2, 0.55, Math.PI / 2, 0, 0.9))
          }),
        ],
        lights: [],
      },
    ],
  },
}

// ---------------------------------------------------------------- the instanced field

export interface PropField {
  root: THREE.Group
  shape: PropShape
  biome: BiomeId
  capacity: number
  /** Variants of the current biome (a slot's variant defaults to i % count). */
  readonly variants: PropDef[]
  setBiome(id: BiomeId): void
  /**
   * Show slot i. Tall: base (x, y, z), width w, height h, turned `spin`
   * round Y. Float: centre (x, y, z), radius w (h ignored), tumbling by
   * `spin` round X and Y.
   */
  set(i: number, x: number, y: number, z: number, w: number, h: number, spin?: number, variant?: number): void
  hide(i: number): void
  /** Upload the matrices (once a frame, after the sets). */
  commit(): void
  /** Glow anchors of the visible slots, in world space. */
  lights(add: (x: number, y: number, z: number, r: number, color: Hex, a: number) => void): void
  /** Collision for slot i (what `set` gave it), or null when hidden. */
  slot(i: number): { def: PropDef; x: number; y: number; z: number; w: number; h: number } | null
  dispose(): void
}

interface Batch { def: PropDef; part: PropPart; mesh: THREE.InstancedMesh }

export function createPropField(shape: PropShape, capacity: number): PropField {
  const root = new THREE.Group()
  const sets = new Map<BiomeId, Batch[]>()
  const slots: ({ def: PropDef; vi: number; x: number; y: number; z: number; w: number; h: number; spin: number } | null)[] = new Array(capacity).fill(null)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const pv = new THREE.Vector3()
  const sv = new THREE.Vector3()
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  let current: Batch[] = []
  let biome: BiomeId = 'coast'
  let dirty = true

  function batchesFor(id: BiomeId): Batch[] {
    let b = sets.get(id)
    if (b) return b
    b = []
    for (const def of PROPS[id][shape]) {
      for (const p of def.parts) {
        const g = geo(`prop/${p.key}`, p.build)
        const mesh = new THREE.InstancedMesh(g, p.glow ? glowMat(p.color) : hullMat(p.color), capacity)
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        mesh.frustumCulled = false
        for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, zero)
        mesh.visible = false
        root.add(mesh)
        b.push({ def, part: p, mesh })
      }
    }
    sets.set(id, b)
    return b
  }

  const field: PropField = {
    root,
    shape,
    get biome() { return biome },
    capacity,
    get variants() { return PROPS[biome][shape] },
    setBiome(id) {
      for (const b of current) b.mesh.visible = false
      biome = id
      current = batchesFor(id)
      for (const b of current) b.mesh.visible = true
      for (let i = 0; i < capacity; i++) {
        const s = slots[i]
        if (s) s.def = PROPS[id][shape][s.vi % PROPS[id][shape].length]!
      }
      dirty = true
    },
    set(i, x, y, z, w, h, spin = 0, variant) {
      const defs = PROPS[biome][shape]
      const vi = variant ?? i
      slots[i] = { def: defs[vi % defs.length]!, vi, x, y, z, w, h, spin }
      dirty = true
    },
    hide(i) {
      if (slots[i]) { slots[i] = null; dirty = true }
    },
    commit() {
      if (!dirty) return
      dirty = false
      for (const b of current) {
        for (let i = 0; i < capacity; i++) {
          const s = slots[i]
          if (!s || s.def !== b.def) { b.mesh.setMatrixAt(i, zero); continue }
          placeMatrix(b.part.place, s, m4)
          b.mesh.setMatrixAt(i, m4)
        }
        b.mesh.instanceMatrix.needsUpdate = true
      }
    },
    lights(add) {
      for (const s of slots) {
        if (!s) continue
        for (const l of s.def.lights) {
          lightPos(l, s, pv)
          add(pv.x, pv.y, pv.z, l.r * (l.at === 'stretch' ? s.w : s.w), l.color, l.a)
        }
      }
    },
    slot(i) {
      const s = slots[i]
      return s ? { def: s.def, x: s.x, y: s.y, z: s.z, w: s.w, h: s.h } : null
    },
    dispose() {
      for (const b of sets.values()) for (const x of b) { x.mesh.dispose(); root.remove(x.mesh) }
      sets.clear()
    },
  }

  function placeMatrix(place: PropPlace, s: { x: number; y: number; z: number; w: number; h: number; spin: number }, out: THREE.Matrix4) {
    if (place === 'uniform') {
      e.set(s.spin * 0.7, s.spin, 0)
      q.setFromEuler(e)
      out.compose(pv.set(s.x, s.y, s.z), q, sv.setScalar(s.w))
      return
    }
    e.set(0, s.spin, 0)
    q.setFromEuler(e)
    if (place === 'stretch') out.compose(pv.set(s.x, s.y, s.z), q, sv.set(s.w, s.h, s.w))
    else if (place === 'top') out.compose(pv.set(s.x, s.y + s.h, s.z), q, sv.setScalar(s.w))
    else out.compose(pv.set(s.x, s.y, s.z), q, sv.setScalar(s.w))
  }

  function lightPos(l: PropLight, s: { x: number; y: number; z: number; w: number; h: number; spin: number }, out: THREE.Vector3) {
    const c = Math.cos(s.spin)
    const sn = Math.sin(s.spin)
    const lx = l.x * s.w
    const lz = l.z * s.w
    const rx = lx * c + lz * sn
    const rz = -lx * sn + lz * c
    if (l.at === 'uniform') out.set(s.x + rx, s.y + l.y * s.w, s.z + rz)
    else if (l.at === 'top') out.set(s.x + rx, s.y + s.h + l.y * s.w, s.z + rz)
    else out.set(s.x + rx, s.y + l.y * s.h, s.z + rz)
  }

  field.setBiome('coast')
  return field
}

/** A geyser's jet height over time (0 = dormant, 1 = full): the game sets h = maxH × this. */
export function geyserJet(t: number, phase = 0): number {
  const c = (t * 0.35 + phase) % 1
  if (c < 0.55) return 0.04 + Math.max(0, Math.sin(c * 40)) * 0.03 // simmer
  if (c < 0.62) return 0.07 + ((c - 0.55) / 0.07) * 0.93 // burst
  if (c < 0.85) return 0.95 + Math.sin(t * 20) * 0.05
  return Math.max(0.04, 1 - ((c - 0.85) / 0.15)) // fall
}

/** The biome's neon for arches, mines and ring glows. */
export function biomeAccent(id: BiomeId): Hex {
  return BIOMES[id].accent
}
