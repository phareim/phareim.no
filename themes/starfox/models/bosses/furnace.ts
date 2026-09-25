/**
 * THE FURNACE (sector 3, EMBER FIELDS): a three-legged walker. An iron
 * kiln with a glowing grille and a smoking chimney rides high above the
 * lane on three spider legs; the knees glow (the weak points) and a
 * copper hatch low on its front covers the white-hot core.
 *
 * Origin: place the root at y = 0 and the feet stand on the ground
 * (y = −5). Built at 1, shown at 1.25 and raised 1.25; in root space the
 * body spans y ≈ 3.3–12, the chimney fire y ≈ 17; the knees sit in the
 * lane at y ≈ 5.4, x ≈ ±9.1, z ≈ 5.3 (front pair) and (0, 5.4, −10.5);
 * feet at x ≈ ±11.3, z ≈ 6.5 and (0, −5, −13); the core behind the
 * hatch at (0, 4.6, 4.5). Knees and core are inside the lane (y ≤ 6).
 * Legs: 0 = front left, 1 = front right, 2 = back.
 */
import * as THREE from 'three'
import { P, geo, glowMat, light, mesh, setMat, ringY, type ModelLight } from '../core'
import { beam, bossMat, bossModel, clamp01, kit, meshes, plateXY, spike, window01 } from './shared'
import type { FurnaceModel } from './types'

const iron = () => bossMat(P.stone, P.stoneDeep)
const dark = () => bossMat(P.stoneDark, P.ink)
const copper = () => bossMat(P.clayLit, P.clay)

/** Built at 1, shown at S, raised so the feet stay on the ground. */
const S = 1.25
const LIFT = 5 * (S - 1)
const HIP_Y = 2.6
const HIP_R = 3.8
const DIRS: [number, number][] = [[-0.87, 0.5], [0.87, 0.5], [0, -1]]

function bodyGeos() {
  const R = (y: number, r: number) => ringY(8, r, r, y, Math.PI / 8)
  return {
    shell: geo('furnace:shell', (g) => {
      g.loft([R(1.6, 2.2), R(2.4, 3.4), R(4.0, 4.6), R(7.0, 4.5), R(8.6, 3.0)])
      g.loft([R(8.6, 1.1), R(11.4, 0.85)], false, false)
      g.loft([R(11.4, 1.25), R(12.0, 1.25)])
      // Grille bars and a brow over the grille.
      for (const x of [-1.35, -0.45, 0.45, 1.35]) g.box(x, 5.6, 4.55, 0.35, 2.0, 0.3)
      g.box(0, 6.75, 4.45, 4.4, 0.4, 0.6)
      // The hatch housing: a short octagonal tube round the core, open at the front.
      g.loft([
        [[0, 2.7, 2.4]],
        [[1.6, 5.6, 2.6], [1.6, 7.0, 2.6], [0.7, 7.8, 2.6], [-0.7, 7.8, 2.6], [-1.6, 7.0, 2.6], [-1.6, 5.6, 2.6], [-0.7, 4.8, 2.6], [0.7, 4.8, 2.6]],
        [[1.6, 5.6, 4.4], [1.6, 7.0, 4.4], [0.7, 7.8, 4.4], [-0.7, 7.8, 4.4], [-1.6, 7.0, 4.4], [-1.6, 5.6, 4.4], [-0.7, 4.8, 4.4], [0.7, 4.8, 4.4]],
      ], false, false)
      // Hip sockets.
      for (const [dx, dz] of DIRS) g.add(new THREE.OctahedronGeometry(1.2), new THREE.Matrix4().makeTranslation(dx * HIP_R, HIP_Y, dz * HIP_R))
    }),
    bands: geo('furnace:bands', (g) => {
      g.loft([R(3.7, 4.75), R(4.3, 4.75)], false, false)
      g.loft([R(6.6, 4.68), R(7.2, 4.62)], false, false)
      g.loft([R(10.6, 1.0), R(11.0, 1.0)], false, false)
    }),
    grille: geo('furnace:grille', g => plateXY(g, [[-1.9, 4.6], [1.9, 4.6], [1.9, 6.55], [-1.9, 6.55]], 4.35, 0.2)),
    fire: geo('furnace:fire', (g) => {
      g.add(new THREE.OctahedronGeometry(0.9), new THREE.Matrix4().makeTranslation(0, 12.5, 0))
      g.add(new THREE.OctahedronGeometry(0.5), new THREE.Matrix4().makeTranslation(0.3, 13.6, -0.2))
    }),
    pit: geo('furnace:pit', g => plateXY(g, [[-1.5, 1.4], [1.5, 1.4], [1.5, 4.0], [-1.5, 4.0]], 2.7, 0.2)),
  }
}

function legGeos() {
  return {
    thigh: geo('furnace:thigh', (g) => {
      beam(g, [0, 0, 0], [0, 0.7, 4.6], 0.95, 0.8, 6, 0)
    }),
    piston: geo('furnace:piston', (g) => {
      beam(g, [0, 1.0, 0.4], [0, 1.5, 4.2], 0.32, 0.32, 4)
    }),
    cap: geo('furnace:cap', (g) => {
      spike(g, [0, 0.5, -0.1], [0, 3.6, -0.7], 0.75)
    }),
    knee: geo('furnace:knee', g => g.add(new THREE.OctahedronGeometry(1.25))),
    shin: geo('furnace:shin', (g) => {
      beam(g, [0, 0, 0], [0, -4.2, 1.3], 0.85, 0.65, 6, 0)
      beam(g, [0, -4.2, 1.3], [0, -7.45, 2.0], 0.65, 0.45, 6, 0)
      // Three toes.
      spike(g, [0, -7.45, 2.0], [1.3, -8.3, 2.9], 0.35)
      spike(g, [0, -7.45, 2.0], [-1.3, -8.3, 2.9], 0.35)
      spike(g, [0, -7.45, 2.0], [0, -8.3, 0.6], 0.35)
    }),
  }
}

interface Leg { hip: THREE.Group; knee: THREE.Group; kneeMesh: THREE.Mesh; shin: THREE.Group; walk: number; stomp: number; broken: boolean; light: ModelLight; dir: [number, number] }

export function createFurnace(): FurnaceModel {
  const k = kit()
  const { body } = k
  body.scale.setScalar(S)
  const b = bodyGeos()
  meshes(body, [[b.shell, iron()], [b.bands, copper()], [b.grille, glowMat(P.gold)], [b.fire, glowMat(P.orange)], [b.pit, glowMat(P.ink)]])
  const coreMesh = mesh(new THREE.OctahedronGeometry(1.05), glowMat(P.sunPale), body)
  coreMesh.position.set(0, 2.7, 3.6)

  // Hatch doors, hinged at the housing's sides.
  const doorGeo = geo('furnace:door', g => plateXY(g, [[0, -1.55], [1.62, -1.55], [1.62, 1.55], [0, 1.55]], 0, 0.3))
  const doors: THREE.Group[] = []
  for (const s of [-1, 1]) {
    const d = new THREE.Group()
    d.position.set(s * 1.62, 2.7, 4.5)
    d.scale.x = -s
    body.add(d)
    mesh(doorGeo, copper(), d)
    doors.push(d)
  }

  const coreLight = light(coreMesh, 0, 0, 0.8, 2.0, P.sunPale, 0.2)
  k.lights.push(
    light(body, 0, 5.6, 4.6, 3.2, P.orange, 0.85),
    light(body, 0, 12.7, 0, 1.6, P.orange, 0.7),
    coreLight,
  )
  const core = k.add({ id: 'core', kind: 'core', node: coreMesh, r: 1.25 * S, open: false, lights: [coreLight] })

  const lg = legGeos()
  const legs: Leg[] = []
  DIRS.forEach(([dx, dz], i) => {
    const hip = new THREE.Group()
    hip.position.set(dx * HIP_R, HIP_Y, dz * HIP_R)
    hip.rotation.order = 'YXZ'
    hip.rotation.y = Math.atan2(dx, dz)
    body.add(hip)
    meshes(hip, [[lg.thigh, dark()], [lg.piston, copper()]])
    const knee = new THREE.Group()
    knee.position.set(0, 0.7, 4.6)
    hip.add(knee)
    const kneeMesh = mesh(lg.knee, glowMat(P.orange), knee)
    mesh(lg.cap, iron(), knee)
    const shin = new THREE.Group()
    knee.add(shin)
    mesh(lg.shin, dark(), shin)
    const kl = light(knee, 0, 0, 0, 1.5, P.orange, 0.7)
    k.lights.push(kl)
    const leg: Leg = { hip, knee, kneeMesh, shin, walk: 0, stomp: 0, broken: false, light: kl, dir: [dx, dz] }
    legs.push(leg)
    k.add({
      id: `knee-${i}`, kind: 'part', node: knee, r: 1.5 * S, lights: [kl],
      onDestroy: () => { leg.broken = true; setMat(kneeMesh, bossMat(P.clay, P.ink)); applyLeg(i); tilt(); belly(1) },
      onRestore: () => { leg.broken = false; setMat(kneeMesh, glowMat(P.orange)) },
    })
    k.add({ id: `leg-${i}`, kind: 'part', node: shin, x: 0, y: -4, z: 1.2, r: 1.4 * S })
  })

  let hatch = 0

  function applyLeg(i: number) {
    const l = legs[i]!
    const L = Math.max(l.walk, l.stomp)
    l.hip.rotation.x = -0.6 * L
    l.knee.rotation.x = 0.95 * L + (l.broken ? 0.35 : 0)
  }

  /** The body leans toward broken legs. */
  function tilt() {
    let x = 0, z = 0
    for (const l of legs) if (l.broken) { x += l.dir[0]; z += l.dir[1] }
    body.rotation.z = -x * 0.09
    body.rotation.x = z * 0.09
  }

  function legsPose(phase: number) {
    legs.forEach((l, i) => {
      l.walk = Math.max(0, Math.sin(phase + (i * Math.PI * 2) / 3)) * 0.45
      applyLeg(i)
    })
  }
  function stomp(leg: number, lift: number) {
    const l = legs[leg]
    if (!l) return
    l.stomp = clamp01(lift)
    applyLeg(leg)
  }
  function breakKnee(i: number) {
    k.destroy(`knee-${i}`)
  }
  function belly(open: number) {
    hatch = clamp01(open)
    doors[0]!.rotation.y = -1.35 * hatch
    doors[1]!.rotation.y = 1.35 * hatch
    core.open = core.alive && hatch > 0.6
    coreLight.a = 0.2 + 0.75 * hatch
  }

  function reset() {
    k.restoreAll()
    legs.forEach((l, i) => { l.walk = 0; l.stomp = 0; applyLeg(i) })
    tilt()
    belly(0)
    body.position.set(0, LIFT, 0)
  }

  let lastCycle = -1
  const base = bossModel('furnace', k, 12 * S, {
    animate(t) {
      body.position.y = LIFT + Math.sin(t * 2.2) * 0.12
      coreMesh.rotation.y = t * 2
      const f = 0.5 + 0.5 * Math.sin(t * 9) * Math.sin(t * 3.7)
      k.lights[0]!.a = 0.7 + 0.25 * f
      k.lights[1]!.a = 0.5 + 0.4 * f
    },
    reset,
    demo(t) {
      const c = t % 14
      if (c < lastCycle) reset()
      lastCycle = c
      legsPose(c < 4 ? c * 2.6 : 0)
      // Stomp: raise, hold, slam.
      stomp(0, window01(c, 4, 5.6, 0.7))
      stomp(1, window01(c, 6.3, 7.9, 0.7))
      if (c >= 9 && legs[0]!.broken === false) breakKnee(0)
      if (c >= 9) belly(window01(c, 9, 13.5, 0.4))
    },
  })
  reset()
  return { ...base, id: 'furnace', legs: legsPose, stomp, breakKnee, belly, reset }
}
