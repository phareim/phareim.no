/**
 * The Hollow's fighters (2026-09-25): eleven low-poly enemies, one builder
 * each. Dark violet hulls that read as silhouettes against the dusk, one
 * accent colour per kind (so a kind is known by its glow), emissive eyes
 * and engines. Noses point +Z, toward the player.
 *
 * Every model is `root` (placed by the game) → `body` (idle motion: bob,
 * roll, spin) → meshes, one per material. Geometry is cached per kind, so
 * a pool of forty gnats shares one set of buffers.
 *
 * `createEnemySlot()` is the pool-friendly wrapper: one slot per pooled
 * enemy, `setKind(kind)` shows that kind's model (built on first use, kept
 * after) and hides the others.
 */
import * as THREE from 'three'
import {
  Geo, P, geo, hullMat, glowMat, mesh, setMat, flashTree, light, ringZ, mat,
  type Model, type ModelLight, type V3, type Hex,
} from './core'
import { BIOMES, type BiomeId } from '../pixel'
import { buildRival, RIVAL_RADIUS, type RivalModel } from './allies'

export type EnemyModelId =
  | 'drone' | 'kamikaze' | 'weaver' | 'sniper' | 'dasher' | 'bulwark'
  | 'splitter' | 'mite' | 'carrier' | 'turret' | 'missile' | 'rival'

export const ENEMY_MODEL_IDS: EnemyModelId[] = [
  'drone', 'kamikaze', 'weaver', 'sniper', 'dasher', 'bulwark', 'splitter', 'mite', 'carrier', 'turret', 'missile', 'rival',
]

/** Display name, collision radius (world units) and the kind's glow colour (for its lights, trails, explosion). */
export const ENEMY_INFO: Record<EnemyModelId, { name: string; radius: number; accent: Hex }> = {
  drone: { name: 'GNAT', radius: 1.3, accent: P.hot },
  kamikaze: { name: 'SPIKE', radius: 1.0, accent: P.red },
  weaver: { name: 'MANTA', radius: 1.9, accent: P.cyan },
  sniper: { name: 'LANCER', radius: 1.0, accent: P.hot },
  dasher: { name: 'HORNET', radius: 1.4, accent: P.orange },
  bulwark: { name: 'BULWARK', radius: 2.0, accent: P.gold },
  splitter: { name: 'POD', radius: 1.2, accent: P.pink },
  mite: { name: 'MITE', radius: 0.6, accent: P.pink },
  carrier: { name: 'CARRIER', radius: 5.0, accent: P.purple },
  turret: { name: 'TURRET', radius: 1.6, accent: P.red },
  missile: { name: 'MISSILE', radius: 0.6, accent: P.orange },
  rival: { name: 'MEGA COBRA', radius: RIVAL_RADIUS, accent: P.lime },
}

/** Per-frame animation inputs from game logic; everything optional. */
export interface EnemyState {
  /** 0–1: bulwark shield open, carrier bay doors open, pod cracking apart. */
  open?: number
  /** 0–1: spike lock-on blink, lancer aim charge, hornet boost. */
  charge?: number
  /** 0–1: carrier damage (its panels run hotter). */
  hurt?: number
  /** Roll from the flight path, radians (added to the idle roll). */
  bank?: number
  /** 0–1: engine boost (rival, hornet). */
  boost?: number
}

export interface EnemyModel extends Model {
  kind: EnemyModelId
  body: THREE.Group
  animate(t: number, dt: number, state?: EnemyState): void
  /** Turret: aim the head (yaw round Y, pitch up from level), radians. */
  aim?(yaw: number, pitch: number): void
  /** Turret: tint the base for a biome. */
  setBiome?(id: BiomeId): void
}

// ---------------------------------------------------------------- helpers

const HULL = P.stone
const HULL_LIT = P.stoneLit
const HULL_DARK = P.stoneDark

/** Mirror a list of points across x = 0, keeping the order (for one-sided plates). */
function flipX(pts: V3[]): V3[] {
  return pts.map(p => [-p[0], p[1], p[2]] as V3)
}

interface Parts { [mat: string]: (g: Geo) => void }

/** One mesh per material, geometry cached as `<kind>/<name>`. Keys: 'hull:#hex' (lit) or 'glow:#hex' (unlit). */
function build(kind: string, parent: THREE.Object3D, parts: Parts): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  for (const key of Object.keys(parts)) {
    const [type, color] = key.split(':') as [string, string]
    const g = geo(`${kind}/${key}`, parts[key]!)
    out.push(mesh(g, type === 'glow' ? glowMat(color) : hullMat(color), parent))
  }
  return out
}

function shell(kind: EnemyModelId): { root: THREE.Group; body: THREE.Group; phase: number } {
  const root = new THREE.Group()
  root.name = kind
  const body = new THREE.Group()
  root.add(body)
  return { root, body, phase: Math.random() * 6.28 }
}

function finish(kind: EnemyModelId, root: THREE.Group, body: THREE.Group, lights: ModelLight[], animate: EnemyModel['animate'], extra: Partial<EnemyModel> = {}): EnemyModel {
  return { kind, root, body, lights, radius: ENEMY_INFO[kind].radius, flash: on => flashTree(root, on), animate, ...extra }
}

// ---------------------------------------------------------------- GNAT

function buildDrone(): EnemyModel {
  const { root, body, phase } = shell('drone')
  const wing: V3[] = [[0.25, 0, 0.5], [1.7, -0.5, -0.55], [1.7, -0.5, -0.95], [0.25, 0, -0.75]]
  build('drone', body, {
    [`hull:${HULL}`]: g => {
      g.loft([[[0, 0.02, 1.55]], ringZ(4, 0.34, 0.28, 0.7), ringZ(4, 0.44, 0.36, -0.4), ringZ(4, 0.26, 0.22, -1.1)])
      g.fin([[0, 0.25, -0.35], [0, 0.85, -1.15], [0, 0.25, -1.1]], 0.08)
    },
    [`hull:${P.greyDark}`]: g => { g.plate(wing, 0.1).plate(flipX(wing), 0.1) },
    [`glow:${P.hot}`]: g => {
      const tip: V3[] = [[1.52, -0.44, -0.48], [1.78, -0.52, -0.5], [1.78, -0.52, -1.02], [1.52, -0.44, -1.02]]
      g.plate(tip, 0.16).plate(flipX(tip), 0.16)
      g.box(0, 0.12, 0.95, 0.34, 0.14, 0.34) // the eye
      g.box(0, 0, -1.12, 0.34, 0.26, 0.08) // engine
    },
  })
  const lights = [light(body, 0, 0.12, 1.0, 0.6, P.hot, 0.6), light(body, 0, 0, -1.2, 0.7, P.hot, 0.45)]
  return finish('drone', root, body, lights, (t, _dt, s) => {
    body.rotation.z = Math.sin(t * 2.3 + phase) * 0.22 + (s?.bank ?? 0)
    body.position.y = Math.sin(t * 3.1 + phase) * 0.08
  })
}

// ---------------------------------------------------------------- SPIKE

function buildKamikaze(): EnemyModel {
  const { root, body, phase } = shell('kamikaze')
  const star = (z: number, rOut: number, rIn: number): V3[] => {
    const out: V3[] = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 4
      const r = i % 2 === 0 ? rOut : rIn
      out.push([Math.cos(a) * r, Math.sin(a) * r, z])
    }
    return out
  }
  const glows = build('kamikaze', body, {
    [`hull:${P.redDark}`]: g => { g.loft([star(1.1, 0.26, 0.2), star(0.15, 1.0, 0.24), star(-0.7, 0.72, 0.2), ringZ(8, 0.14, 0.14, -1.3)]) },
    [`glow:${P.red}`]: g => {
      g.loft([[[0, 0, 1.95]], ringZ(4, 0.24, 0.24, 1.1)], false, true)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        g.box(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.12, 0.18, 0.18, 0.4)
      }
      g.box(0, 0, -1.34, 0.26, 0.26, 0.08)
    },
  }).filter(m => (m.material as THREE.Material).type === 'MeshBasicMaterial')
  const lights = [light(body, 0, 0, 1.6, 0.8, P.red, 0.7), light(body, 0, 0, -1.4, 0.7, P.red, 0.5)]
  let spin = 0
  return finish('kamikaze', root, body, lights, (t, dt, s) => {
    const c = s?.charge ?? 0
    spin += dt * (3 + c * 12)
    body.rotation.z = spin
    body.position.y = Math.sin(t * 2.7 + phase) * 0.06
    const blink = c > 0 && Math.floor(t * 12) % 2 === 0
    for (const m of glows) setMat(m, glowMat(blink ? P.white : P.red))
    lights[0]!.a = 0.7 + c * 0.3
  })
}

// ---------------------------------------------------------------- MANTA

function buildWeaver(): EnemyModel {
  const { root, body, phase } = shell('weaver')
  build('weaver', body, {
    [`hull:${P.sea}`]: g => {
      g.loft([[[0, 0.05, 1.35]], ringZ(6, 0.55, 0.2, 0.8), ringZ(6, 0.8, 0.46, -0.2), ringZ(6, 0.42, 0.16, -0.9), [[0, 0, -1.25]]])
      g.plate([[0.09, 0, -0.9], [0.03, 0, -2.7], [-0.03, 0, -2.7], [-0.09, 0, -0.9]], 0.06)
    },
    [`glow:${P.cyan}`]: g => { g.box(0.3, 0.16, 0.8, 0.16, 0.1, 0.16).box(-0.3, 0.16, 0.8, 0.16, 0.1, 0.16).box(0, 0, -2.7, 0.14, 0.14, 0.14) },
  })
  const wingPts: V3[] = [[0, 0, 0.85], [1.9, -0.12, -0.15], [1.65, -0.12, -0.6], [0, 0, -0.85]]
  const edge: V3[] = [[0.05, 0.03, 0.88], [1.93, -0.1, -0.12], [1.82, -0.1, -0.24], [0.05, 0.03, 0.66]]
  const wings: THREE.Group[] = []
  for (const side of [1, -1]) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.55, 0, 0)
    body.add(pivot)
    const f = side > 0 ? (p: V3[]) => p : flipX
    build(`weaver-wing${side}`, pivot, {
      [`hull:${P.teal}`]: g => { g.plate(f(wingPts), 0.1) },
      [`glow:${P.cyan}`]: g => {
        g.plate(f(edge), 0.14)
        g.fin(f([[1.78, -0.12, 0.0], [1.95, 0.45, -0.45], [1.72, -0.12, -0.55]]), 0.08)
      },
    })
    wings.push(pivot)
  }
  const lights = [light(body, 0, 0.16, 0.85, 0.7, P.cyan, 0.6), light(wings[0]!, 1.8, -0.1, -0.2, 0.5, P.cyan, 0.35), light(wings[1]!, -1.8, -0.1, -0.2, 0.5, P.cyan, 0.35)]
  return finish('weaver', root, body, lights, (t, _dt, s) => {
    const f = Math.sin(t * 2.4 + phase) * 0.38
    wings[0]!.rotation.z = f
    wings[1]!.rotation.z = -f
    body.rotation.z = Math.sin(t * 1.2 + phase) * 0.15 + (s?.bank ?? 0)
    body.position.y = -f * 0.25
  })
}

// ---------------------------------------------------------------- LANCER

function buildSniper(): EnemyModel {
  const { root, body, phase } = shell('sniper')
  build('sniper', body, {
    [`hull:${P.grey}`]: g => { g.loft([[[0, 0, 2.7]], ringZ(4, 0.12, 0.12, 1.7), ringZ(4, 0.3, 0.3, 0), ringZ(4, 0.32, 0.32, -1.2), ringZ(4, 0.16, 0.16, -1.9)]) },
    [`hull:${HULL_DARK}`]: g => { g.box(0, 0, -1.95, 0.5, 0.5, 0.2) },
  })
  const collar = new THREE.Group()
  collar.position.z = -0.35
  body.add(collar)
  build('sniper-collar', collar, {
    [`hull:${HULL}`]: g => {
      g.add(new THREE.CylinderGeometry(0.62, 0.62, 0.4, 6), mat(0, 0, 0, Math.PI / 2))
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 2
        g.add(new THREE.BoxGeometry(0.12, 0.9, 0.5), mat(Math.cos(a) * 0.95, Math.sin(a) * 0.95, -0.1, 0, 0, a - Math.PI / 2))
      }
    },
    [`glow:${P.hot}`]: g => {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 2
        g.box(Math.cos(a) * 1.42, Math.sin(a) * 1.42, -0.1, 0.16, 0.16, 0.5)
      }
    },
  })
  const lens = mesh(geo('sniper/lens', g => { g.add(new THREE.OctahedronGeometry(0.2)) }), glowMat(P.hot), body)
  lens.position.z = 1.75
  const lights = [light(body, 0, 0, 1.75, 0.5, P.hot, 0.6)]
  return finish('sniper', root, body, lights, (t, dt, s) => {
    const c = s?.charge ?? 0
    collar.rotation.z += dt * (1.5 + c * 6)
    lens.scale.setScalar(1 + c * 1.6)
    lights[0]!.r = 0.5 + c * 1.2
    lights[0]!.a = 0.6 + c * 0.4
    body.position.y = Math.sin(t * 2 + phase) * 0.06
  })
}

// ---------------------------------------------------------------- HORNET

function buildDasher(): EnemyModel {
  const { root, body, phase } = shell('dasher')
  const wing: V3[] = [[0.35, 0, -0.95], [2.3, 0.12, 0.4], [2.25, 0.12, 0.9], [0.35, 0, -0.1]]
  const tip: V3[] = [[2.1, 0.12, 0.35], [2.38, 0.12, 0.38], [2.32, 0.12, 1.05], [2.06, 0.12, 1.0]]
  const fin: V3[] = [[0.3, 0.3, -0.3], [0.62, 1.05, -1.25], [0.5, 0.3, -1.3]]
  // A wasp: hot orange body with black bands, pale forward-swept wings, a stinger.
  build('dasher', body, {
    [`hull:${P.clayHot}`]: g => {
      g.loft([[[0, -0.05, 1.8]], ringZ(6, 0.36, 0.3, 0.9, Math.PI / 6), ringZ(6, 0.52, 0.42, -0.5, Math.PI / 6), ringZ(6, 0.42, 0.32, -1.3, Math.PI / 6)])
    },
    [`hull:${P.stoneDeep}`]: g => {
      for (const z of [0.35, -0.35, -1.0]) g.loft([ringZ(6, 0.55, 0.45, z + 0.13, Math.PI / 6), ringZ(6, 0.55, 0.45, z - 0.13, Math.PI / 6)], false, false)
      g.loft([ringZ(6, 0.3, 0.24, -1.3, Math.PI / 6), [[0, 0.05, -2.3]]], true, false) // stinger
    },
    [`hull:${P.lavender}`]: g => { g.plate(wing, 0.12).plate(flipX(wing), 0.12) },
    [`hull:${P.clay}`]: g => { g.fin(fin, 0.08).fin(flipX(fin), 0.08) },
    [`glow:${P.orange}`]: g => {
      g.plate(tip, 0.18).plate(flipX(tip), 0.18)
      g.box(0.3, -0.15, -1.2, 0.3, 0.3, 0.12).box(-0.3, -0.15, -1.2, 0.3, 0.3, 0.12)
    },
    [`glow:${P.gold}`]: g => { g.box(0, 0.26, 0.9, 0.42, 0.12, 0.44) }, // visor
  })
  const lights = [light(body, 0, 0, -1.45, 0.8, P.orange, 0.6), light(body, 0, 0.24, 0.9, 0.5, P.orange, 0.5)]
  return finish('dasher', root, body, lights, (t, _dt, s) => {
    const c = s?.charge ?? 0
    body.rotation.z = Math.sin(t * 3.3 + phase) * 0.12 + (s?.bank ?? 0)
    body.position.y = Math.sin(t * 4 + phase) * 0.05
    lights[0]!.r = 0.8 + c * 1.4
    lights[0]!.a = 0.6 + c * 0.4
  })
}

// ---------------------------------------------------------------- BULWARK

/** A curved wall: a slice of a cylinder round (0, 0, cz), angles from +Z toward +X, shifted by (−ox, −oz). */
function arcWall(g: Geo, R: number, a0: number, a1: number, y0: number, y1: number, thick: number, segs: number, cz: number, ox = 0, oz = 0) {
  const pt = (a: number, r: number, y: number): V3 => [Math.sin(a) * r - ox, y, Math.cos(a) * r + cz - oz]
  const rOut = R + thick / 2
  const rIn = R - thick / 2
  for (let i = 0; i < segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs
    const b = a0 + ((a1 - a0) * (i + 1)) / segs
    g.quad(pt(a, rOut, y0), pt(b, rOut, y0), pt(b, rOut, y1), pt(a, rOut, y1))
    g.quad(pt(a, rIn, y0), pt(a, rIn, y1), pt(b, rIn, y1), pt(b, rIn, y0))
    g.quad(pt(a, rOut, y1), pt(b, rOut, y1), pt(b, rIn, y1), pt(a, rIn, y1))
    g.quad(pt(a, rOut, y0), pt(a, rIn, y0), pt(b, rIn, y0), pt(b, rOut, y0))
  }
  g.quad(pt(a0, rOut, y0), pt(a0, rOut, y1), pt(a0, rIn, y1), pt(a0, rIn, y0))
  g.quad(pt(a1, rOut, y0), pt(a1, rIn, y0), pt(a1, rIn, y1), pt(a1, rOut, y1))
}

function buildBulwark(): EnemyModel {
  const { root, body, phase } = shell('bulwark')
  build('bulwark', body, {
    [`hull:${HULL}`]: g => {
      g.add(new THREE.CylinderGeometry(1.75, 1.9, 0.55, 6), mat(0, 0, 0, 0, Math.PI / 6))
      g.add(new THREE.CylinderGeometry(1.2, 0.45, 0.8, 6), mat(0, -0.66, 0, 0, Math.PI / 6))
    },
    [`hull:${P.grey}`]: g => { g.add(new THREE.CylinderGeometry(0.75, 1.15, 0.55, 6), mat(0, 0.55, -0.2, 0, Math.PI / 6)) },
    [`hull:${HULL_DARK}`]: g => { g.box(0, 0.05, 1.45, 0.34, 0.34, 1.0) },
    [`glow:${P.gold}`]: g => {
      g.add(new THREE.CylinderGeometry(1.93, 1.93, 0.12, 6), mat(0, -0.12, 0, 0, Math.PI / 6))
      g.box(0, 0.9, -0.2, 0.5, 0.12, 0.5)
    },
    [`glow:${P.hot}`]: g => { g.box(0, 0.05, 1.98, 0.26, 0.26, 0.1) },
  })
  // The shield: two curved halves in front, hinged at their outer ends.
  const R = 2.25
  const CZ = -0.35
  const half = 0.85 // radians each side of +Z
  const halves: THREE.Group[] = []
  for (const side of [1, -1]) {
    const hinge = new THREE.Group()
    const hx = Math.sin(side * half) * R
    const hz = Math.cos(side * half) * R + CZ
    hinge.position.set(hx, 0, hz)
    body.add(hinge)
    const a0 = side > 0 ? 0.03 : -half
    const a1 = side > 0 ? half : -0.03
    build(`bulwark-shield${side}`, hinge, {
      [`glow:${P.amber}`]: g => {
        const n = 3
        for (let i = 0; i < n; i++) {
          const b0 = a0 + ((a1 - a0) * i) / n + 0.025
          const b1 = a0 + ((a1 - a0) * (i + 1)) / n - 0.025
          arcWall(g, R, b0, b1, -0.6, 0.8, 0.18, 1, CZ, hx, hz)
        }
      },
      [`glow:${P.gold}`]: g => {
        arcWall(g, R + 0.04, a0, a1, 0.8, 0.97, 0.26, 3, CZ, hx, hz)
        arcWall(g, R + 0.04, a0, a1, -0.77, -0.6, 0.26, 3, CZ, hx, hz)
      },
    })
    halves.push(hinge)
  }
  const lights = [light(body, 0, 0.9, -0.2, 0.9, P.gold, 0.5), light(body, 0, 0.05, 2.0, 0.7, P.hot, 0.8), light(body, 0, 0.1, 2.3, 1.4, P.gold, 0.35)]
  return finish('bulwark', root, body, lights, (t, _dt, s) => {
    const o = Math.max(0, Math.min(1, s?.open ?? 0))
    halves[0]!.rotation.y = o * 1.5
    halves[1]!.rotation.y = -o * 1.5
    lights[1]!.on = o > 0.35
    lights[2]!.on = o < 0.35
    body.position.y = Math.sin(t * 1.6 + phase) * 0.1
    body.rotation.z = Math.sin(t * 1.1 + phase) * 0.05
  })
}

// ---------------------------------------------------------------- POD

function buildSplitter(): EnemyModel {
  const { root, body, phase } = shell('splitter')
  const halfRing = (r: number, z: number, side: number): V3[] => {
    const out: V3[] = []
    for (let i = 0; i <= 4; i++) {
      const a = -Math.PI / 2 + (i / 4) * Math.PI
      out.push([side * (0.04 + Math.cos(a) * r), Math.sin(a) * r * 1.05, z])
    }
    return out
  }
  const halves: THREE.Group[] = []
  for (const side of [1, -1]) {
    const h = new THREE.Group()
    body.add(h)
    build(`splitter${side}`, h, {
      [`hull:${P.purple}`]: g => {
        const rings = [halfRing(0.18, 1.35, side), halfRing(0.78, 0.75, side), halfRing(0.96, -0.15, side), halfRing(0.7, -0.9, side), halfRing(0.14, -1.45, side)]
        g.loft(rings, false, false)
        // The flat inner face along the seam.
        const face: V3[] = [...rings.map(r => r[4]!), ...rings.slice().reverse().map(r => r[0]!)]
        g.poly(face.map(p => [side * 0.04, p[1], p[2]] as V3))
      },
      [`hull:${P.grey}`]: g => {
        // An armour band round the middle.
        g.loft([halfRing(1.04, 0.25, side), halfRing(1.04, -0.35, side)], false, false)
        g.loft([halfRing(0.99, 0.25, side), halfRing(0.99, -0.35, side)], false, false)
      },
    })
    halves.push(h)
  }
  build('splitter-seam', body, {
    [`glow:${P.pink}`]: g => {
      g.box(0, 0.96, -0.15, 0.1, 0.1, 1.6).box(0, -0.98, -0.15, 0.1, 0.1, 1.6)
      g.fin([[0, 0, 1.2], [0, 0.7, 0.6], [0, 0.85, -0.2], [0, 0.6, -0.9], [0, 0, -1.3], [0, -0.6, -0.9], [0, -0.85, -0.2], [0, -0.7, 0.6]], 0.02)
    },
  })
  const lights = [light(body, 0, 0, 0, 1.0, P.pink, 0.5)]
  return finish('splitter', root, body, lights, (t, _dt, s) => {
    const o = Math.max(0, Math.min(1, s?.open ?? 0))
    halves[0]!.position.x = o * 0.6
    halves[1]!.position.x = -o * 0.6
    halves[0]!.rotation.y = o * 0.3
    halves[1]!.rotation.y = -o * 0.3
    lights[0]!.a = 0.5 + o * 0.5
    body.rotation.z = t * 0.9 + phase
    body.position.y = Math.sin(t * 1.9 + phase) * 0.1
  })
}

// ---------------------------------------------------------------- MITE

function buildMite(): EnemyModel {
  const { root, body, phase } = shell('mite')
  build('mite', body, {
    [`hull:${P.pinkDark}`]: g => {
      g.loft([[[0, 0, 0.6]], ringZ(3, 0.36, 0.3, 0, Math.PI / 2), [[0, 0, -0.5]]])
      for (const s of [1, -1]) {
        g.fin([[s * 0.2, -0.05, 0.15], [s * 0.62, -0.38, 0.35], [s * 0.25, -0.12, -0.05]], 0.05)
        g.fin([[s * 0.2, -0.05, -0.1], [s * 0.6, -0.4, -0.35], [s * 0.22, -0.12, -0.3]], 0.05)
      }
    },
    [`glow:${P.pink}`]: g => { g.box(0, 0.08, 0.42, 0.16, 0.1, 0.12) },
  })
  const lights = [light(body, 0, 0.08, 0.45, 0.4, P.pink, 0.55)]
  return finish('mite', root, body, lights, (t, _dt, s) => {
    body.rotation.z = Math.sin(t * 9 + phase) * 0.2 + (s?.bank ?? 0)
    body.rotation.x = Math.sin(t * 7 + phase) * 0.12
  })
}

// ---------------------------------------------------------------- CARRIER

function buildCarrier(): EnemyModel {
  const { root, body, phase } = shell('carrier')
  // Own panel material: its glow runs hotter as the carrier takes damage.
  const panel = new THREE.MeshLambertMaterial({ color: P.grey, emissive: P.ink, flatShading: true, side: THREE.DoubleSide })
  const hex = (rx: number, ry: number, z: number) => ringZ(6, rx, ry, z, Math.PI / 6)
  build('carrier', body, {
    [`hull:${P.stoneLit}`]: g => {
      g.loft([hex(2.3, 1.0, 5.6), hex(3.0, 1.45, 3.0), hex(3.0, 1.45, -3.2), hex(2.0, 0.95, -6.0)], false, true)
      // The bay mouth: the front ring stepping in to a recessed back wall.
      g.loft([hex(2.3, 1.0, 5.6), hex(1.7, 0.66, 5.6), hex(1.7, 0.66, 3.6)], false, false)
      // Nacelles.
      for (const s of [1, -1]) g.loft([[[s * 3.7, -0.3, 3.6]], ringZ(6, 0.8, 0.8, 2.6, 0, s * 3.7, -0.3), ringZ(6, 0.9, 0.9, -3.4, 0, s * 3.7, -0.3), ringZ(6, 0.7, 0.7, -4.4, 0, s * 3.7, -0.3)])
      for (const s of [1, -1]) g.box(s * 3.0, -0.3, -0.5, 1.4, 0.4, 3.0) // pylons
    },
    [`hull:${HULL_DARK}`]: g => {
      g.poly(hex(1.7, 0.66, 3.6))
      g.box(0, 1.85, -3.0, 1.3, 1.0, 2.2) // bridge
      g.box(0, 1.4, 1.0, 0.5, 0.5, 4.5) // spine
    },
    [`glow:${P.purple}`]: g => {
      for (const s of [1, -1]) {
        g.poly(ringZ(6, 0.7, 0.7, -4.45, 0, s * 3.7, -0.3))
        // Intake rings at the nacelle mouths.
        g.loft([ringZ(6, 0.84, 0.84, 2.7, 0, s * 3.7, -0.3), ringZ(6, 0.84, 0.84, 2.4, 0, s * 3.7, -0.3)], false, false)
      }
      g.poly(hex(1.95, 0.9, -6.05))
    },
    [`glow:${P.gold}`]: g => {
      g.box(0, 2.0, -1.88, 1.0, 0.18, 0.06) // bridge windows
      g.box(0, 2.0, -4.12, 1.0, 0.18, 0.06)
      for (const s of [1, -1]) g.box(s * 0.66, 2.0, -3.0, 0.06, 0.18, 1.6)
      for (const s of [1, -1]) g.box(s * 3.02, 0.35, 0.8, 0.06, 0.14, 4.2) // flank stripes
      g.box(0, -0.66, 4.8, 3.0, 0.1, 0.14).box(0, 0.66, 4.8, 3.0, 0.1, 0.14) // bay lights
    },
  })
  // Armour panels on the flanks: these heat up under fire.
  const panels = mesh(geo('carrier/panels', g => {
    for (const s of [1, -1]) {
      for (const z of [2.0, -0.6]) g.plate([[s * 2.95, 0.9, z + 1.1], [s * 3.1, 0.2, z + 1.1], [s * 3.1, 0.2, z - 1.1], [s * 2.95, 0.9, z - 1.1]].map(p => [p[0], p[1], p[2]] as V3), 0.12)
      g.box(s * 1.5, 1.4, -0.5, 1.4, 0.2, 5.2)
    }
  }), panel, body)
  panels.userData.own = true
  // Bay doors: upper and lower, hinged at the mouth.
  const doors: THREE.Group[] = []
  for (const s of [1, -1]) {
    const hinge = new THREE.Group()
    hinge.position.set(0, s * 0.7, 5.62)
    body.add(hinge)
    build(`carrier-door${s}`, hinge, { [`hull:${P.grey}`]: g => { g.box(0, -s * 0.34, -0.04, 3.2, 0.68, 0.14) } })
    doors.push(hinge)
  }
  const lights = [
    light(body, 0, 0, 4.2, 1.8, P.gold, 0.35),
    light(body, 3.7, -0.3, -4.6, 1.2, P.purple, 0.7),
    light(body, -3.7, -0.3, -4.6, 1.2, P.purple, 0.7),
    light(body, 0, 2.0, -1.8, 0.8, P.gold, 0.5),
  ]
  const hot = new THREE.Color(P.hot)
  const cold = new THREE.Color(P.ink)
  return finish('carrier', root, body, lights, (t, _dt, s) => {
    const o = Math.max(0, Math.min(1, s?.open ?? 0))
    doors[0]!.rotation.x = -o * 1.35
    doors[1]!.rotation.x = o * 1.35
    lights[0]!.a = 0.3 + o * 0.6
    const h = Math.max(0, Math.min(1, s?.hurt ?? 0))
    const pulse = h > 0 ? 0.6 + 0.4 * Math.sin(t * (6 + h * 10)) : 0
    panel.emissive.copy(cold).lerp(hot, h * pulse)
    body.position.y = Math.sin(t * 0.8 + phase) * 0.18
    body.rotation.z = Math.sin(t * 0.6 + phase) * 0.03 + (s?.bank ?? 0)
  })
}

// ---------------------------------------------------------------- TURRET

function buildTurret(): EnemyModel {
  const { root, body } = shell('turret')
  const base = mesh(geo('turret/base', g => {
    g.add(new THREE.CylinderGeometry(1.3, 1.8, 0.9, 8), mat(0, 0.45, 0, 0, Math.PI / 8))
    g.add(new THREE.CylinderGeometry(1.0, 1.3, 0.2, 8), mat(0, 1.0, 0, 0, Math.PI / 8))
  }), hullMat(BIOMES.coast.groundTint), body)
  build('turret-trim', body, { [`glow:${P.red}`]: g => { g.add(new THREE.CylinderGeometry(1.62, 1.62, 0.1, 8), mat(0, 0.3, 0, 0, Math.PI / 8)) } })
  const yawN = new THREE.Group()
  yawN.position.y = 1.1
  body.add(yawN)
  build('turret-head', yawN, {
    [`hull:${P.grey}`]: g => { g.add(new THREE.CylinderGeometry(0.65, 0.95, 0.7, 6), mat(0, 0.35, 0, 0, Math.PI / 6)) },
    [`glow:${P.red}`]: g => {
      g.box(0, 0.45, 0.72, 0.4, 0.16, 0.16)
      g.add(new THREE.CylinderGeometry(0.97, 0.97, 0.08, 6), mat(0, 0.05, 0, 0, Math.PI / 6))
    },
  })
  const pitchN = new THREE.Group()
  pitchN.position.set(0, 0.35, 0.2)
  yawN.add(pitchN)
  build('turret-guns', pitchN, {
    [`hull:${P.greyDark}`]: g => { g.box(0.28, 0, 0.8, 0.2, 0.2, 1.6).box(-0.28, 0, 0.8, 0.2, 0.2, 1.6) },
    [`glow:${P.hot}`]: g => { g.box(0.28, 0, 1.65, 0.24, 0.24, 0.12).box(-0.28, 0, 1.65, 0.24, 0.24, 0.12) },
  })
  const lights = [light(yawN, 0, 0.45, 0.8, 0.6, P.red, 0.6), light(pitchN, 0, 0, 1.7, 0.7, P.hot, 0.5)]
  let aimed = false
  return finish('turret', root, body, lights, (t) => {
    if (!aimed) {
      yawN.rotation.y = Math.sin(t * 0.7) * 0.6
      pitchN.rotation.x = -0.5 - Math.sin(t * 0.9) * 0.2
    }
    aimed = false
  }, {
    aim(yaw: number, pitch: number) {
      aimed = true
      yawN.rotation.y = yaw
      pitchN.rotation.x = -pitch
    },
    setBiome(id: BiomeId) { setMat(base, hullMat(BIOMES[id].groundTint)) },
  })
}

// ---------------------------------------------------------------- MISSILE

function buildMissile(): EnemyModel {
  const { root, body } = shell('missile')
  build('missile', body, {
    [`hull:${P.lavender}`]: g => {
      g.loft([ringZ(6, 0.17, 0.17, 0.5), ringZ(6, 0.17, 0.17, -0.6), ringZ(6, 0.12, 0.12, -0.72)])
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2
        g.add(new THREE.BoxGeometry(0.05, 0.42, 0.4), mat(Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.45, 0, 0, a - Math.PI / 2))
      }
    },
    [`glow:${P.red}`]: g => {
      g.loft([[[0, 0, 1.0]], ringZ(6, 0.18, 0.18, 0.5)], false, false)
      g.loft([ringZ(6, 0.19, 0.19, 0.1), ringZ(6, 0.19, 0.19, -0.1)], false, false)
    },
    [`glow:${P.orange}`]: g => { g.poly(ringZ(6, 0.13, 0.13, -0.74)) },
  })
  const lights = [light(body, 0, 0, -0.9, 0.8, P.orange, 0.8), light(body, 0, 0, 0.9, 0.3, P.red, 0.5)]
  return finish('missile', root, body, lights, (_t, dt) => { body.rotation.z += dt * 5 })
}

// ---------------------------------------------------------------- MEGA COBRA (the rival ace)

/** Cobra's fighter as an enemy kind: `open` flares the hood, `boost` the engine. The full model is `rival`. */
export interface RivalEnemyModel extends EnemyModel { rival: RivalModel }

function buildRivalEnemy(): RivalEnemyModel {
  const r = buildRival()
  return {
    kind: 'rival', root: r.root, body: r.body, lights: r.lights, radius: r.radius, rival: r,
    flash: r.flash,
    animate(t, dt, s) {
      if (s?.open !== undefined) r.hood(s.open)
      r.animate(t, dt, { bank: s?.bank, boost: s?.boost ?? s?.charge })
    },
  }
}

// ---------------------------------------------------------------- factory + pool slot

const BUILDERS: Record<EnemyModelId, () => EnemyModel> = {
  drone: buildDrone, kamikaze: buildKamikaze, weaver: buildWeaver, sniper: buildSniper, dasher: buildDasher,
  bulwark: buildBulwark, splitter: buildSplitter, mite: buildMite, carrier: buildCarrier, turret: buildTurret, missile: buildMissile, rival: buildRivalEnemy,
}

export function createEnemyModel(kind: EnemyModelId): EnemyModel {
  return BUILDERS[kind]()
}

/** One pooled enemy: switch its kind at spawn; models are built on first use and kept. */
export interface EnemySlot {
  root: THREE.Group
  kind: EnemyModelId | null
  model: EnemyModel | null
  setKind(kind: EnemyModelId): EnemyModel
}

export function createEnemySlot(): EnemySlot {
  const root = new THREE.Group()
  const models: Partial<Record<EnemyModelId, EnemyModel>> = {}
  const slot: EnemySlot = {
    root,
    kind: null,
    model: null,
    setKind(kind) {
      if (slot.model && slot.kind !== kind) slot.model.root.visible = false
      let m = models[kind]
      if (!m) {
        m = createEnemyModel(kind)
        models[kind] = m
        root.add(m.root)
      }
      m.root.visible = true
      m.flash(false)
      slot.kind = kind
      slot.model = m
      return m
    },
  }
  return slot
}

/** The lab's demo states: shields and bays cycling, charges blinking. */
export function demoEnemyState(kind: EnemyModelId, t: number): EnemyState {
  const wave = 0.5 - 0.5 * Math.cos(t * 1.2)
  switch (kind) {
    case 'bulwark':
    case 'carrier':
      return { open: Math.min(1, wave * 1.4), hurt: kind === 'carrier' ? wave : 0 }
    case 'splitter':
      return { open: Math.max(0, wave * 1.6 - 0.8) }
    case 'rival':
      return { open: Math.min(1, wave * 1.5), boost: wave > 0.7 ? 1 : 0 }
    case 'kamikaze':
    case 'sniper':
    case 'dasher':
      return { charge: wave > 0.6 ? (wave - 0.6) / 0.4 : 0 }
    default:
      return {}
  }
}
