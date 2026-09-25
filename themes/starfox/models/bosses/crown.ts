/**
 * THE HOLLOW CROWN (sector 5, space): the mothership. A round violet hull
 * wearing five gold crown points, a slowly turning ring of six turrets
 * round a closed eye, four armour plates on its face with hot veins under
 * them, and engines at the back for the chase.
 *
 * Place the root at y ≈ 2. Rest layout (root space): hull 20 wide and
 * 16.4 tall with side blades to x ≈ ±13.4 (≈ 27 across), crown tips up to
 * y ≈ 14; face at z ≈ 2; turret ring radius 4.8 (turrets at 30° + k·60°,
 * spinning about Z); the eye at (0, 0, 2.4), hit radius 2.4.
 * Phase 3 loosens the plates, heats the engines and bares the heart, a
 * gold reactor between the engines at (0, 0, −5.6), hit radius 1.9 — it
 * faces the player once the root turns round for the chase (the scene
 * turns and moves the root).
 */
import * as THREE from 'three'
import { P, geo, glowMat, light, mesh, ringZ, type ModelLight } from '../core'
import { beam, bossMat, bossModel, clamp01, kit, meshes, plateXY, spike, window01 } from './shared'
import type { CrownModel } from './types'

type P2 = [number, number]

const RX = 10
const RY = 8.2
const TURRET_R = 4.8

function ngon(r: number, n: number, rot = 0, sx = 1, sy = 1): P2[] {
  const out: P2[] = []
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    out.push([Math.cos(a) * r * sx, Math.sin(a) * r * sy])
  }
  return out
}

/** An annular sector (elliptical outer edge) in the XY plane. */
function sector(a0: number, a1: number, ri: number, rox: number, roy: number, n = 5): P2[] {
  const inner: P2[] = []
  const outer: P2[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    inner.push([Math.cos(a) * ri, Math.sin(a) * ri])
    outer.push([Math.cos(a) * rox, Math.sin(a) * roy])
  }
  return [...inner, ...outer.reverse()]
}

const PLATES: [number, number][] = [[100, 165], [15, 80], [195, 260], [280, 345]].map(([a, b]) => [(a! * Math.PI) / 180, (b! * Math.PI) / 180])

function hullGeos() {
  const crownPts = [[-6, 3.4], [-3, 4.8], [0, 6.0], [3, 4.8], [6, 3.4]] as const
  return {
    hull: geo('crown:hull', (g) => {
      g.loft([
        ringZ(12, 8.4, 7.4, 2.0, Math.PI / 12),
        ringZ(12, RX, RY, 0.6, Math.PI / 12),
        ringZ(12, 9.4, 7.6, -2.4, Math.PI / 12),
        ringZ(12, 5.4, 4.0, -4.6, Math.PI / 12),
      ])
    }),
    trim: geo('crown:trim', (g) => {
      g.loft([ringZ(12, RX + 0.2, RY + 0.2, 1.0, Math.PI / 12), ringZ(12, RX + 0.2, RY + 0.2, 0.2, Math.PI / 12)], false, false)
      // Side blades.
      plateXY(g, [[9.6, 1.6], [13.0, 0.5], [13.4, -0.3], [9.6, -1.6]], 0.2, 1.4)
      plateXY(g, [[8.6, -4.0], [11.4, -5.8], [11.2, -6.4], [8.0, -5.4]], 0.0, 1.0)
      g.mirrorX()
    }),
    points: geo('crown:points', (g) => {
      for (const [x, h] of crownPts) {
        const edge = RY * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2))
        spike(g, [x, edge - 0.6, 0.6], [x * 1.12, edge + h, 0.2], 1.05)
      }
    }),
    gems: geo('crown:gems', (g) => {
      for (const [x, h] of crownPts) {
        const edge = RY * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2))
        g.add(new THREE.OctahedronGeometry(0.6), new THREE.Matrix4().makeTranslation(x * 1.02, edge + 0.5, 1.1))
      }
    }),
    socket: geo('crown:socket', g => plateXY(g, ngon(3.3, 12), 2.15, 0.2)),
    iris: geo('crown:iris', g => plateXY(g, ngon(2.35, 10, Math.PI / 10), 2.3, 0.2)),
    pupil: geo('crown:pupil', g => plateXY(g, [[0, -2.0], [0.6, 0], [0, 2.0], [-0.6, 0]], 2.45, 0.2)),
    veins: geo('crown:veins', (g) => {
      for (const [a0, a1] of PLATES) {
        for (let i = 0; i < 3; i++) {
          const a = a0 + ((a1 - a0) * (i + 0.5)) / 3
          beam(g, [Math.cos(a) * 6.0, Math.sin(a) * 6.0, 2.05], [Math.cos(a) * 7.8, Math.sin(a) * 6.8, 2.05], 0.35, 0.2, 4)
        }
      }
    }),
    engines: geo('crown:engines', (g) => {
      for (const x of [-2.6, 0, 2.6]) g.box(x, 0, -4.7, 1.7, 1.7, 0.4)
    }),
    ring: geo('crown:ring', (g) => {
      const n = 12
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2
        const a1 = ((i + 1) / n) * Math.PI * 2
        plateXY(g, [
          [Math.cos(a0) * 5.7, Math.sin(a0) * 5.7], [Math.cos(a1) * 5.7, Math.sin(a1) * 5.7],
          [Math.cos(a1) * 3.9, Math.sin(a1) * 3.9], [Math.cos(a0) * 3.9, Math.sin(a0) * 3.9],
        ], 0, 0.6)
      }
    }),
    turret: geo('crown:turret', (g) => {
      g.box(0, 0, 0.5, 1.7, 1.7, 1.0)
      g.add(new THREE.OctahedronGeometry(0.95), new THREE.Matrix4().makeTranslation(0, 0, 1.1))
      beam(g, [0, 0, 1.2], [0, 0, 2.9], 0.34, 0.3, 4)
    }),
    muzzle: geo('crown:muzzle', g => g.box(0, 0, 3.0, 0.62, 0.62, 0.3)),
    heart: geo('crown:heart', (g) => {
      g.add(new THREE.OctahedronGeometry(1.35), new THREE.Matrix4().makeScale(1, 1.25, 0.8))
    }),
    cage: geo('crown:cage', (g) => {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2
        beam(g, [Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.8], [Math.cos(a) * 1.5, Math.sin(a) * 1.5, -1.2], 0.22, 0.18, 4)
      }
    }),
    lid: geo('crown:lid', (g) => {
      const half: P2[] = [[3.45, 0]]
      for (let i = 1; i < 8; i++) {
        const a = (i / 8) * Math.PI
        half.push([Math.cos(a) * 3.45, Math.sin(a) * 3.45])
      }
      half.push([-3.45, 0])
      plateXY(g, half, 0, 0.35)
    }),
  }
}

interface Plate { node: THREE.Group; rest: THREE.Vector3; dir: THREE.Vector3; seed: number }

export function createCrown(): CrownModel {
  const k = kit()
  const { body } = k
  const g = hullGeos()
  meshes(body, [
    [g.hull, bossMat(P.grey, P.stoneDark)], [g.trim, bossMat(P.purple, P.purpleDark)],
    [g.points, bossMat(P.sunPale, P.amber)], [g.gems, glowMat(P.hot)],
    [g.socket, glowMat(P.ink)], [g.veins, glowMat(P.orange)], [g.engines, glowMat(P.pink)],
  ])

  // The eye: iris and pupil under two lids that fold back into the hull.
  const eyeNode = new THREE.Group()
  body.add(eyeNode)
  meshes(eyeNode, [[g.iris, glowMat(P.hot)], [g.pupil, glowMat(P.white)]])
  const lids: THREE.Group[] = []
  for (const s of [1, -1]) {
    const lid = new THREE.Group()
    lid.position.set(0, 0, 2.75)
    lid.scale.y = s
    body.add(lid)
    mesh(g.lid, bossMat(P.purple, P.purpleDark), lid)
    lids.push(lid)
  }
  const eyeLight = light(eyeNode, 0, 0, 2.6, 3.0, P.hot, 0.2)
  const engineLight = light(body, 0, 0, -5.2, 3.6, P.pink, 0.35)
  k.lights.push(eyeLight, engineLight)
  for (const x of [-6, 0, 6]) k.lights.push(light(body, x * 1.02, RY * Math.sqrt(1 - (x / RX) ** 2) + 0.5, 1.1, 0.8, P.hot, 0.55))
  const eyePart = k.add({ id: 'eye', kind: 'core', node: eyeNode, x: 0, y: 0, z: 2.4, r: 2.4, open: false, lights: [eyeLight] })

  // The heart: a reactor between the engines, caged until phase 3.
  const heartNode = new THREE.Group()
  heartNode.position.set(0, 0, -5.6)
  body.add(heartNode)
  const heartMesh = mesh(g.heart, glowMat(P.gold), heartNode)
  mesh(g.cage, bossMat(P.stoneDark, P.ink), heartNode)
  const heartLight = light(heartNode, 0, 0, -0.6, 2.6, P.gold, 0.2)
  k.lights.push(heartLight)
  const heartPart = k.add({ id: 'heart', kind: 'core', node: heartNode, x: 0, y: 0, z: -0.4, r: 1.9, open: false, lights: [heartLight] })

  // The turret ring.
  const ring = new THREE.Group()
  ring.position.set(0, 0, 2.3)
  body.add(ring)
  mesh(g.ring, bossMat(P.stone, P.stoneDeep), ring)
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3
    const t = new THREE.Group()
    t.position.set(Math.cos(a) * TURRET_R, Math.sin(a) * TURRET_R, 0)
    ring.add(t)
    meshes(t, [[g.turret, bossMat(P.stoneDark, P.ink)], [g.muzzle, glowMat(P.red)]])
    const tl: ModelLight[] = [light(t, 0, 0, 3.1, 1.0, P.red, 0.6)]
    k.lights.push(...tl)
    k.add({ id: `turret-${i}`, kind: 'part', node: t, x: 0, y: 0, z: 1.0, r: 1.35, lights: tl })
  }

  // Hull plates over the hot veins.
  const plates: Plate[] = []
  PLATES.forEach(([a0, a1], i) => {
    const node = new THREE.Group()
    body.add(node)
    const pg = geo(`crown:plate${i}`, gg => plateXY(gg, sector(a0, a1, 5.95, 8.15, 7.15), 2.3, 0.5))
    mesh(pg, bossMat(P.purple, P.purpleDark), node)
    const am = (a0 + a1) / 2
    plates.push({ node, rest: new THREE.Vector3(), dir: new THREE.Vector3(Math.cos(am), Math.sin(am), 0.6).normalize(), seed: i * 1.7 })
    k.add({ id: `hull-${i}`, kind: 'part', node, x: Math.cos(am) * 7, y: Math.sin(am) * 6.4, z: 2.3, r: 2.1 })
  })

  let phaseN: 1 | 2 | 3 = 1
  let eyeOpen = 0
  let spin = 0

  function phase(n: 1 | 2 | 3) {
    phaseN = n
    engineLight.a = n === 3 ? 0.9 : 0.35
    heartPart.open = heartPart.alive && n === 3
    heartLight.a = n === 3 ? 0.9 : 0.2
    heartMesh.scale.setScalar(n === 3 ? 1 : 0.6)
    if (n < 3) for (const p of plates) { p.node.position.copy(p.rest); p.node.rotation.set(0, 0, 0) }
  }
  function eye(open: number) {
    eyeOpen = clamp01(open)
    lids[0]!.rotation.x = -1.5 * eyeOpen
    lids[1]!.rotation.x = 1.5 * eyeOpen
    eyePart.open = eyePart.alive && eyeOpen > 0.6
    eyeLight.a = 0.2 + 0.75 * eyeOpen
  }

  function reset() {
    k.restoreAll()
    phase(1)
    eye(0)
    spin = 0
    ring.rotation.z = 0
    body.position.set(0, 0, 0)
    body.rotation.set(0, 0, 0)
  }

  let lastCycle = -1
  const base = bossModel('crown', k, 13, {
    animate(t, dt) {
      body.position.y = Math.sin(t * 0.8) * 0.4
      spin += dt * (phaseN === 1 ? 0.35 : phaseN === 2 ? 0.15 : 0.6)
      ring.rotation.z = spin
      if (phaseN === 3) {
        body.rotation.z = Math.sin(t * 3.1) * 0.03
        for (const p of plates) {
          const j = Math.sin(t * 7 + p.seed) * 0.25
          p.node.position.copy(p.dir).multiplyScalar(1.4 + j)
          p.node.rotation.set(Math.sin(t * 5 + p.seed) * 0.12, Math.cos(t * 4 + p.seed) * 0.12, 0)
        }
        engineLight.a = 0.8 + 0.2 * Math.sin(t * 20)
        heartMesh.rotation.z = t * 2.2
        heartMesh.scale.setScalar(1 + 0.1 * Math.sin(t * 9))
      }
      eyeNode.rotation.z = Math.sin(t * 0.9) * 0.15 * eyeOpen
    },
    reset,
    demo(t) {
      const c = t % 18
      if (c < lastCycle) reset()
      lastCycle = c
      if (c < 6) {
        phase(1)
        eye(0)
        for (let i = 0; i < 6; i++) if (c >= 2 + i * 0.7) k.destroy(`turret-${i}`)
      } else if (c < 12) {
        phase(2)
        for (let i = 0; i < 6; i++) k.destroy(`turret-${i}`)
        eye(window01(c, 6.4, 12.6, 0.6))
      } else {
        phase(3)
        for (let i = 0; i < 6; i++) k.destroy(`turret-${i}`)
        eye(1)
        if (c >= 15) k.destroy('hull-0')
      }
      // Deterministic ring angle for frozen lab shots.
      spin = t * 0.3
    },
  })
  reset()
  return { ...base, id: 'crown', phase, eye, reset }
}
