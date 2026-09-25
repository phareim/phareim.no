/**
 * Helpers shared by the five boss builders: XY plates, struts between two
 * points, and the part bookkeeping (hit spheres, destroy/restore, lights,
 * flash) every boss needs.
 */
import * as THREE from 'three'
import { Geo, flashTree, mesh, type ModelLight, type V3 } from '../core'
import type { BossId, BossModel, BossPart } from './types'

/** An outline in the XY plane (facing the player), thickened along Z. */
export function plateXY(g: Geo, pts: [number, number][], z: number, thick: number): Geo {
  const h = thick / 2
  const front = pts.map(p => [p[0], p[1], z + h] as V3)
  const back = pts.map(p => [p[0], p[1], z - h] as V3)
  g.poly(front).poly(back)
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    g.quad(front[i]!, front[j]!, back[j]!, back[i]!)
  }
  return g
}

const up = new THREE.Vector3(0, 1, 0)
const side = new THREE.Vector3(1, 0, 0)

/** A strut from a to b: an n-sided prism of radius ra at a, rb at b. */
export function beam(g: Geo, a: V3, b: V3, ra: number, rb = ra, n = 4, rot = Math.PI / 4): Geo {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = B.clone().sub(A).normalize()
  const ref = Math.abs(d.dot(up)) > 0.9 ? side : up
  const u = new THREE.Vector3().crossVectors(d, ref).normalize()
  const v = new THREE.Vector3().crossVectors(d, u).normalize()
  const ring = (c: THREE.Vector3, r: number): V3[] => {
    const out: V3[] = []
    for (let i = 0; i < n; i++) {
      const t = rot + (i / n) * Math.PI * 2
      out.push([
        c.x + (u.x * Math.cos(t) + v.x * Math.sin(t)) * r,
        c.y + (u.y * Math.cos(t) + v.y * Math.sin(t)) * r,
        c.z + (u.z * Math.cos(t) + v.z * Math.sin(t)) * r,
      ])
    }
    return out
  }
  return g.loft([ring(A, ra), ring(B, rb)])
}

/** A pointed spike from base centre `a` (radius r) to tip `b`. */
export function spike(g: Geo, a: V3, b: V3, r: number, n = 4): Geo {
  return beam(g, a, b, r, 0.0001, n)
}

export interface PartSpec {
  id: string
  kind: 'core' | 'part'
  node: THREE.Object3D
  x?: number
  y?: number
  z?: number
  r: number
  lights?: ModelLight[]
  open?: boolean
  /** Custom wreck (a dark stump, a fall); default hides the node. */
  onDestroy?: () => void
  onRestore?: () => void
}

interface PartRec {
  part: BossPart
  spec: PartSpec
}

export interface Kit {
  root: THREE.Group
  /** Child of root that idles (bob, sway); everything hangs off it. */
  body: THREE.Group
  lights: ModelLight[]
  parts: BossPart[]
  cores: BossPart[]
  add(spec: PartSpec): BossPart
  part(id: string): BossPart | undefined
  destroy(id: string): void
  restoreAll(): void
  partWorld(p: BossPart, out: THREE.Vector3): THREE.Vector3
}

export function kit(): Kit {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  const lights: ModelLight[] = []
  const parts: BossPart[] = []
  const cores: BossPart[] = []
  const recs = new Map<string, PartRec>()
  return {
    root, body, lights, parts, cores,
    add(spec) {
      const part: BossPart = {
        id: spec.id, kind: spec.kind, node: spec.node,
        x: spec.x ?? 0, y: spec.y ?? 0, z: spec.z ?? 0, r: spec.r,
        alive: true, open: spec.open ?? spec.kind === 'part',
      }
      recs.set(spec.id, { part, spec })
      ;(spec.kind === 'core' ? cores : parts).push(part)
      return part
    },
    part: id => recs.get(id)?.part,
    destroy(id) {
      const rec = recs.get(id)
      if (!rec || !rec.part.alive) return
      rec.part.alive = false
      rec.part.open = false
      for (const l of rec.spec.lights ?? []) l.on = false
      if (rec.spec.onDestroy) rec.spec.onDestroy()
      else rec.spec.node.visible = false
    },
    restoreAll() {
      for (const { part, spec } of recs.values()) {
        part.alive = true
        part.open = spec.open ?? spec.kind === 'part'
        for (const l of spec.lights ?? []) l.on = true
        spec.node.visible = true
        spec.onRestore?.()
      }
    },
    partWorld(p, out) {
      p.node.updateWorldMatrix(true, false)
      return p.node.localToWorld(out.set(p.x, p.y, p.z))
    },
  }
}

/** The shared half of a BossModel; each builder spreads it and adds its pose API. */
export function bossModel(id: BossId, k: Kit, radius: number, rest: Pick<BossModel, 'animate' | 'reset' | 'demo'> & Partial<Pick<BossModel, 'setPartDestroyed'>>): BossModel {
  return {
    id,
    root: k.root,
    lights: k.lights,
    radius,
    cores: k.cores,
    parts: k.parts,
    part: k.part,
    partWorld: k.partWorld,
    flash: on => flashTree(k.root, on),
    setPartDestroyed: rest.setPartDestroyed ?? (pid => k.destroy(pid)),
    animate: rest.animate,
    reset: rest.reset,
    demo: rest.demo,
  }
}

const bossMats = new Map<string, THREE.MeshLambertMaterial>()

/**
 * A lit hull material with an emissive floor, shared per colour pair. The
 * flight's key light comes from behind the bosses, so their fronts sit in
 * shade; the emissive floor keeps a boss's colours readable there.
 */
export function bossMat(color: string, emissive: string): THREE.MeshLambertMaterial {
  const key = `${color}|${emissive}`
  let m = bossMats.get(key)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, emissive, flatShading: true, side: THREE.DoubleSide })
    bossMats.set(key, m)
  }
  return m
}

/** One mesh per (geometry, material) under `parent`; skips empty builders. */
export function meshes(parent: THREE.Object3D, pairs: [THREE.BufferGeometry, THREE.Material][]): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  for (const [g, m] of pairs) {
    if (!g.getAttribute('position') || g.getAttribute('position').count === 0) continue
    out.push(mesh(g, m, parent))
  }
  return out
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** 0→1→0 over [a, b] with ramps of `ramp` seconds (for demo loops). */
export function window01(t: number, a: number, b: number, ramp = 0.4): number {
  if (t < a || t > b) return 0
  return clamp01(Math.min((t - a) / ramp, (b - t) / ramp))
}

/** Dispose the bosses' emissive-floor materials (call with core's disposeModelCaches on unmount). */
export function disposeBossMats(): void {
  for (const m of bossMats.values()) m.dispose()
  bossMats.clear()
}
