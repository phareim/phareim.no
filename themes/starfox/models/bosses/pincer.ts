/**
 * THE PINCER (sector 1, CORAL COAST): a crab carrier skimming the sea.
 * A wide domed carapace on six skimming legs, eyes on stalks, two huge
 * claws raised at the sides that swing down across the lane, and a maw
 * whose jaws cover the gold core until it roars.
 *
 * Place the root at y ≈ 0 over the sea: the leg tips skim y ≈ −5.
 * Rest layout (root space, scale 1.2 applied): carapace 16 wide, 6.6 tall,
 * 12 deep; claws raised to x ≈ ±14, y ≈ 7; core in the maw at (0, 0, 6).
 */
import * as THREE from 'three'
import { P, geo, glowMat, light, mesh, setMat, type V3 } from '../core'
import { beam, bossMat, bossModel, kit, meshes, spike, window01 } from './shared'
import type { PincerModel } from './types'

/** Built at 1, shown at S: hit radii below are already in world units. */
const S = 1.2
const shellMat = () => bossMat(P.greyDark, P.dusk)
const underMat = () => bossMat(P.stone, P.night)
const clawMat = () => bossMat(P.red, P.redDark)
const boneMat = () => bossMat(P.lavender, P.greyDark)

function shellRing(z: number, w: number, top: number, bot: number): V3[] {
  return [
    [w, 0, z], [w * 0.78, top * 0.72, z], [w * 0.34, top, z], [-w * 0.34, top, z],
    [-w * 0.78, top * 0.72, z], [-w, 0, z], [-w * 0.72, -bot, z], [w * 0.72, -bot, z],
  ]
}

function buildBody(g: { shell: THREE.BufferGeometry; under: THREE.BufferGeometry; accent: THREE.BufferGeometry; bone: THREE.BufferGeometry; eyes: THREE.BufferGeometry; skim: THREE.BufferGeometry; mouth: THREE.BufferGeometry }, parent: THREE.Object3D) {
  meshes(parent, [
    [g.shell, shellMat()], [g.under, underMat()], [g.accent, clawMat()],
    [g.bone, boneMat()], [g.eyes, glowMat(P.hot)], [g.skim, glowMat(P.cyan)], [g.mouth, glowMat(P.ink)],
  ])
}

function bodyGeos() {
  return {
    shell: geo('pincer:shell', (g) => {
      g.loft([
        shellRing(4.6, 3.4, 1.0, 0.9),
        shellRing(3.0, 6.2, 2.3, 1.2),
        shellRing(0.2, 6.8, 3.0, 1.3),
        shellRing(-2.8, 6.0, 2.6, 1.2),
        shellRing(-4.9, 3.2, 1.3, 0.8),
      ])
    }),
    under: geo('pincer:under', (g) => {
      // Six legs: hip → knee (up and out) → foot skimming the sea.
      for (const z of [1.8, -0.6, -3.0]) {
        const knee: V3 = [8.4, 0.9, z + 0.4]
        beam(g, [5.4, -0.6, z], knee, 0.45, 0.4)
        spike(g, knee, [9.6, -4.2, z + 1.2], 0.4)
      }
      g.mirrorX()
      // Belly plate.
      g.loft([shellRing(3.6, 4.6, 0.2, 1.5), shellRing(-3.6, 4.4, 0.2, 1.5)])
    }),
    accent: geo('pincer:accent', (g) => {
      // Rim spikes round the carapace front, and a dorsal crest.
      spike(g, [5.8, 0.4, 2.6], [8.0, 0.8, 4.4], 0.45)
      spike(g, [6.4, 0.8, 0.0], [8.8, 1.8, 0.6], 0.45)
      spike(g, [5.6, 0.6, -2.8], [7.6, 1.6, -4.0], 0.4)
      spike(g, [2.2, 2.6, 1.6], [2.8, 4.0, 0.8], 0.35)
      g.mirrorX()
      spike(g, [0, 2.8, 1.5], [0, 4.4, -0.2], 0.5)
      spike(g, [0, 2.8, -1.0], [0, 4.0, -2.6], 0.45)
      // Eye stalks.
      beam(g, [1.7, 2.0, 3.0], [2.4, 3.6, 3.8], 0.28, 0.22)
      beam(g, [-1.7, 2.0, 3.0], [-2.4, 3.6, 3.8], 0.28, 0.22)
    }),
    bone: geo('pincer:bone', (g) => {
      // Stripes of pale shell plate across the carapace top.
      for (const z of [1.6, -1.4]) {
        g.plate([[-4.6, 2.72, z + 0.35], [4.6, 2.72, z + 0.35], [4.2, 2.62, z - 0.35], [-4.2, 2.62, z - 0.35]], 0.25)
      }
    }),
    eyes: geo('pincer:eyes', (g) => {
      g.add(new THREE.OctahedronGeometry(0.62), new THREE.Matrix4().makeTranslation(2.45, 3.85, 3.85))
      g.add(new THREE.OctahedronGeometry(0.62), new THREE.Matrix4().makeTranslation(-2.45, 3.85, 3.85))
    }),
    skim: geo('pincer:skim', (g) => {
      for (const x of [-3, 0, 3]) g.box(x, -1.55, 0, 1.4, 0.2, 5)
    }),
    mouth: geo('pincer:mouth', (g) => {
      g.box(0, 0, 4.55, 4.4, 2.2, 0.3)
    }),
  }
}

/** Jaw plate hinged at the node's origin; `dir` −1 hangs down (upper jaw), 1 rises (lower). */
function jawGeo(key: string, dir: number) {
  const span = dir < 0 ? 1.25 : 0.95
  return {
    plate: geo(`pincer:${key}`, (g) => {
      g.plate([[-2.4, 0, -0.1], [2.4, 0, -0.1], [2.0, dir * span, 1.7], [-2.0, dir * span, 1.7]], 0.55)
      spike(g, [2.3, 0, 0.2], [3.1, dir * -0.2, 1.4], 0.3)
      spike(g, [-2.3, 0, 0.2], [-3.1, dir * -0.2, 1.4], 0.3)
    }),
    teeth: geo(`pincer:${key}:teeth`, (g) => {
      for (const x of [-1.5, -0.5, 0.5, 1.5]) spike(g, [x, dir * span, 1.55], [x, dir * (span + 0.6), 1.5], 0.22, 3)
    }),
  }
}

function clawGeos() {
  return {
    arm: geo('pincer:arm', (g) => {
      beam(g, [0, 0, 0], [0, 0, 4.6], 0.75, 0.6, 6, 0)
      spike(g, [0, 0.5, 2.2], [0, 1.5, 2.8], 0.3)
    }),
    palm: geo('pincer:palm', (g) => {
      g.loft([
        [[0.9, 0, 0], [0, 0.9, 0], [-0.9, 0, 0], [0, -0.9, 0]],
        [[1.5, 0, 1.4], [0, 1.5, 1.2], [-1.5, 0, 1.4], [0, -1.3, 1.4]],
        [[1.3, 0.2, 3.0], [0, 1.4, 3.0], [-1.3, 0.2, 3.0], [0, -1.0, 3.0]],
      ])
      // The fixed finger: up and forward, hooked.
      beam(g, [0, 0.6, 2.8], [0, 1.1, 4.8], 0.8, 0.5, 4, Math.PI / 4)
      spike(g, [0, 1.1, 4.8], [0, 0.0, 6.4], 0.5)
    }),
    finger: geo('pincer:finger', (g) => {
      beam(g, [0, 0, 0], [0, -0.35, 1.9], 0.65, 0.45)
      spike(g, [0, -0.35, 1.9], [0, 0.5, 3.3], 0.45)
    }),
    teethHi: geo('pincer:teethHi', (g) => {
      for (const z of [3.4, 4.2, 5.0]) spike(g, [0, 0.9 - (z - 3.4) * 0.2, z], [0, 0.1 - (z - 3.4) * 0.25, z + 0.3], 0.24, 3)
    }),
    teethLo: geo('pincer:teethLo', (g) => {
      for (const z of [0.9, 1.7]) spike(g, [0, -0.15, z], [0, 0.55, z + 0.3], 0.22, 3)
    }),
  }
}

const Z = new THREE.Vector3(0, 0, 1)

export function createPincer(): PincerModel {
  const k = kit()
  const { body } = k
  body.scale.setScalar(S)
  buildBody(bodyGeos(), body)

  // Maw: two jaws over the core.
  const coreMesh = mesh(new THREE.OctahedronGeometry(1.15), glowMat(P.gold), body)
  coreMesh.position.set(0, 0.05, 5.0)
  const upper = new THREE.Group()
  upper.position.set(0, 1.2, 4.6)
  const lower = new THREE.Group()
  lower.position.set(0, -1.05, 4.6)
  body.add(upper, lower)
  const uj = jawGeo('jawUp', -1)
  const lj = jawGeo('jawLo', 1)
  meshes(upper, [[uj.plate, clawMat()], [uj.teeth, boneMat()]])
  meshes(lower, [[lj.plate, clawMat()], [lj.teeth, boneMat()]])

  const coreLight = light(coreMesh, 0, 0, 0.4, 2.2, P.gold, 0.35)
  k.lights.push(
    light(body, 2.45, 3.85, 3.85, 1.0, P.hot, 0.8),
    light(body, -2.45, 3.85, 3.85, 1.0, P.hot, 0.8),
    light(body, 0, -1.8, 1, 3.5, P.cyan, 0.45),
    coreLight,
  )
  const core = k.add({ id: 'core', kind: 'core', node: coreMesh, r: 1.3 * S, open: false, lights: [coreLight] })

  // Claws.
  const cg = clawGeos()
  interface Claw { shoulder: THREE.Group; hand: THREE.Group; finger: THREE.Group; shells: THREE.Mesh[]; qRest: THREE.Quaternion; qSweep: THREE.Quaternion; glowLight: ReturnType<typeof light>; sweep: number; pinch: number; glow: number }
  const claws: Record<-1 | 1, Claw> = {} as Record<-1 | 1, Claw>
  for (const s of [-1, 1] as const) {
    const shoulder = new THREE.Group()
    shoulder.position.set(s * 5.7, 0.6, 2.4)
    body.add(shoulder)
    const arm = mesh(cg.arm, clawMat(), shoulder)
    const hand = new THREE.Group()
    hand.position.set(0, 0, 4.6)
    shoulder.add(hand)
    const palm = mesh(cg.palm, clawMat(), hand)
    mesh(cg.teethHi, glowMat(P.pink), hand)
    const finger = new THREE.Group()
    finger.position.set(0, -0.55, 2.8)
    hand.add(finger)
    const fingerMesh = mesh(cg.finger, clawMat(), finger)
    mesh(cg.teethLo, glowMat(P.pink), finger)
    const glowLight = light(hand, 0, 0.4, 3.8, 1.6, P.hot, 0.25)
    k.lights.push(glowLight)
    const qRest = new THREE.Quaternion().setFromUnitVectors(Z, new THREE.Vector3(s * 0.72, 0.62, 0.32).normalize())
    const qSweep = new THREE.Quaternion().setFromUnitVectors(Z, new THREE.Vector3(-s * 0.86, -0.12, 0.5).normalize())
    claws[s] = { shoulder, hand, finger, shells: [arm, palm, fingerMesh], qRest, qSweep, glowLight, sweep: 0, pinch: 0, glow: 0 }
    k.add({ id: s < 0 ? 'claw-l' : 'claw-r', kind: 'part', node: hand, x: 0, y: 0.3, z: 2.6, r: 2.2 * S, lights: [glowLight] })
  }

  let mawOpen = 0

  function claw(side: -1 | 1, sweep: number) {
    const c = claws[side]
    c.sweep = Math.max(0, Math.min(1, sweep))
    c.shoulder.quaternion.copy(c.qRest).slerp(c.qSweep, c.sweep)
  }
  function pinch(side: -1 | 1, amount: number) {
    const c = claws[side]
    c.pinch = Math.max(0, Math.min(1, amount))
    c.finger.rotation.x = 0.6 * (1 - c.pinch)
  }
  /** Telegraph: the claw heats up before a sweep (0 cold … 1 white-hot pink). */
  function glow(side: -1 | 1, amount: number) {
    const c = claws[side]
    c.glow = Math.max(0, Math.min(1, amount))
    const m = c.glow > 0.5 ? glowMat(P.hot) : clawMat()
    for (const sh of c.shells) setMat(sh, m)
    c.glowLight.a = 0.25 + 0.7 * c.glow
  }
  function maw(open: number) {
    mawOpen = Math.max(0, Math.min(1, open))
    upper.rotation.x = -0.95 * mawOpen
    lower.rotation.x = 0.75 * mawOpen
    core.open = core.alive && mawOpen > 0.6
    coreLight.a = 0.3 + 0.65 * mawOpen
  }

  function neutral() {
    for (const s of [-1, 1] as const) { claw(s, 0); pinch(s, 0); glow(s, 0) }
    maw(0)
    body.position.set(0, 0, 0)
    body.rotation.set(0, 0, 0)
  }

  const base = bossModel('pincer', k, 12 * S, {
    animate(t) {
      body.position.y = Math.sin(t * 1.6) * 0.25
      body.rotation.z = Math.sin(t * 0.9) * 0.035
      body.rotation.x = Math.sin(t * 1.1) * 0.02
      coreMesh.rotation.y = t * 1.5
      coreMesh.scale.setScalar(1 + 0.12 * mawOpen * Math.sin(t * 14))
    },
    reset() {
      k.restoreAll()
      neutral()
    },
    demo(t) {
      const c = t % 12
      // Left claw: heat, sweep across, back. Right claw the same. Then a roar.
      for (const [s, a] of [[-1, 1.5], [1, 5]] as const) {
        const heat = window01(c, a, a + 3, 0.3)
        const sw = window01(c, a + 0.9, a + 3, 0.5)
        glow(s, heat)
        claw(s, sw)
        pinch(s, c > a + 0.9 && c < a + 3 ? 0.5 + 0.5 * Math.sin(c * 12) : 0)
      }
      maw(window01(c, 8.5, 11, 0.35))
    },
  })
  neutral()
  return { ...base, id: 'pincer', claw, pinch, glow, maw }
}

