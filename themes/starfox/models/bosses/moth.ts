/**
 * THE MOTH (sector 2, WHISPER WOODS): a moth machine hanging in the night
 * air. Four wing panels meet over its chest and cover the gold core; each
 * panel carries a glowing jade eyespot and can be shot off, and falls
 * away tumbling. Feathered antennae, pink compound eyes, a striped
 * abdomen with glowing spore sacs (it drops spore mines from them).
 *
 * Place the root at y ≈ 3. Rest layout (root space, scale 1.2 applied):
 * wingspan ≈ 25, antenna tips at y ≈ 10.5, abdomen tip at y ≈ −7; the
 * core sits at (0, 1.1, 1.1) behind the four panel roots.
 */
import * as THREE from 'three'
import { P, geo, glowMat, light, mesh, type ModelLight } from '../core'
import { beam, bossMat, bossModel, kit, meshes, plateXY } from './shared'
import type { MothModel } from './types'

const S = 1.2

type P2 = [number, number]

// Panel outlines in pivot space for the LEFT side (x < 0 is outward).
const UPPER: P2[] = [[0.35, -0.1], [0.35, 1.6], [-2.2, 4.6], [-6.0, 6.4], [-9.6, 5.8], [-10.4, 3.0], [-8.8, 0.2], [-4.6, -1.1], [-0.8, -0.6]]
const LOWER: P2[] = [[0.35, 0.1], [-0.6, 0.5], [-4.4, 0.2], [-7.6, -1.4], [-8.4, -4.4], [-6.6, -6.8], [-3.6, -6.6], [-1.4, -4.4], [0.35, -1.6]]

interface PanelDef { outline: P2[]; pivot: [number, number, number]; eye: P2; eyeR: number; ribs: P2[]; hit: [number, number, number]; hitR: number; upper: boolean }

const DEFS: PanelDef[] = [
  { outline: UPPER, pivot: [-0.3, 1.1, 2.1], eye: [-6.0, 3.3], eyeR: 1.7, ribs: [[-6.0, 6.3], [-10.0, 4.4], [-8.8, 0.3]], hit: [-5.6, 2.8, 0], hitR: 3.4, upper: true },
  { outline: LOWER, pivot: [-0.3, 0.9, 2.35], eye: [-4.6, -3.2], eyeR: 1.2, ribs: [[-8.0, -2.8], [-6.6, -6.7], [-3.4, -6.5]], hit: [-4.4, -3.0, 0], hitR: 2.8, upper: false },
]

function mirror(pts: P2[], s: number): P2[] {
  const out = pts.map(p => [p[0] * -s, p[1]] as P2)
  return s > 0 ? out.reverse() : out
}

function annulus(g: Parameters<typeof plateXY>[0], cx: number, cy: number, ro: number, ri: number, z: number, n = 8) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + Math.PI / n
    const a1 = ((i + 1) / n) * Math.PI * 2 + Math.PI / n
    plateXY(g, [
      [cx + Math.cos(a0) * ro, cy + Math.sin(a0) * ro], [cx + Math.cos(a1) * ro, cy + Math.sin(a1) * ro],
      [cx + Math.cos(a1) * ri, cy + Math.sin(a1) * ri], [cx + Math.cos(a0) * ri, cy + Math.sin(a0) * ri],
    ], z, 0.2)
  }
}

function hexPts(cx: number, cy: number, r: number, n = 6): P2[] {
  const out: P2[] = []
  for (let i = 0; i < n; i++) out.push([cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r])
  return out
}

/** side −1 = left (outward is −x), 1 = right. */
function panelGeos(d: PanelDef, side: number) {
  const key = `moth:${d.upper ? 'u' : 'l'}${side}`
  const m = (x: number) => x * -side
  return {
    skin: geo(`${key}:skin`, g => plateXY(g, mirror(d.outline, side), 0, 0.35)),
    ribs: geo(`${key}:ribs`, (g) => {
      for (const r of d.ribs) beam(g, [m(0.4), 0, 0.25], [m(r[0]) * 0.92, r[1] * 0.92, 0.25], 0.22, 0.12)
      // A dark border along the outer edge.
      const o = mirror(d.outline, side)
      for (let i = 0; i < o.length; i++) {
        const a = o[i]!
        const b = o[(i + 1) % o.length]!
        if (Math.abs(a[0]) < 2 && Math.abs(b[0]) < 2) continue
        beam(g, [a[0], a[1], 0.22], [b[0], b[1], 0.22], 0.2, 0.2)
      }
    }),
    ring: geo(`${key}:ring`, g => annulus(g, m(d.eye[0]), d.eye[1], d.eyeR, d.eyeR * 0.6, 0.3)),
    pupil: geo(`${key}:pupil`, g => plateXY(g, hexPts(m(d.eye[0]), d.eye[1], d.eyeR * 0.36), 0.3, 0.25)),
  }
}

function bodyGeos() {
  return {
    fur: geo('moth:fur', (g) => {
      // Head, thorax.
      g.add(new THREE.IcosahedronGeometry(1.3, 0), new THREE.Matrix4().compose(new THREE.Vector3(0, 3.6, 0.5), new THREE.Quaternion(), new THREE.Vector3(1.15, 0.9, 1)))
      g.add(new THREE.IcosahedronGeometry(2.0, 0), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.2, -1.2), new THREE.Quaternion(), new THREE.Vector3(1.15, 1.1, 1)))
      // Legs folded under the thorax.
      for (const s of [-1, 1]) {
        beam(g, [s * 1.2, 0.2, 0.4], [s * 2.6, -1.4, 1.6], 0.2, 0.16)
        beam(g, [s * 2.6, -1.4, 1.6], [s * 2.0, -3.2, 2.2], 0.16, 0.1)
      }
    }),
    abdomen: geo('moth:abdomen', (g) => {
      const ring = (y: number, r: number) => {
        const out: [number, number, number][] = []
        for (let i = 0; i < 6; i++) out.push([Math.cos((i / 6) * Math.PI * 2) * r, y, Math.sin((i / 6) * Math.PI * 2) * r - 0.6])
        return out
      }
      g.loft([ring(-0.2, 1.3), ring(-1.4, 1.75), ring(-2.8, 1.6), ring(-4.2, 1.1), ring(-5.4, 0.55), [[0, -6.3, -0.6]]])
    }),
    stripes: geo('moth:stripes', (g) => {
      for (const [y, r] of [[-1.4, 1.82], [-2.8, 1.66], [-4.2, 1.16]] as const) {
        const pts: [number, number, number][] = []
        for (let i = 0; i < 6; i++) pts.push([Math.cos((i / 6) * Math.PI * 2) * r, y, Math.sin((i / 6) * Math.PI * 2) * r - 0.6])
        const lo = pts.map(p => [p[0], p[1] - 0.3, p[2]] as [number, number, number])
        g.loft([lo, pts], false, false)
      }
    }),
    antennae: geo('moth:antennae', (g) => {
      plateXY(g, [[0.3, 4.2], [1.3, 5.2], [2.8, 7.2], [4.4, 8.8], [3.3, 7.0], [2.2, 5.6], [0.7, 4.4]], 0.6, 0.2)
      g.mirrorX()
    }),
    eyes: geo('moth:eyes', (g) => {
      for (const s of [-1, 1]) g.add(new THREE.OctahedronGeometry(0.72), new THREE.Matrix4().makeTranslation(s * 0.95, 3.75, 1.35))
    }),
    spores: geo('moth:spores', (g) => {
      for (const [x, y, z] of [[-1.3, -3.5, 0.5], [1.3, -3.7, 0.5], [0, -5.0, 0.6], [4.4, 8.9, 0.6], [-4.4, 8.9, 0.6]] as const) {
        g.add(new THREE.OctahedronGeometry(0.58), new THREE.Matrix4().makeTranslation(x, y, z))
      }
    }),
  }
}

interface Panel { node: THREE.Group; side: number; upper: boolean; rest: THREE.Vector3; age: number; dropped: boolean; lights: ModelLight[] }

export function createMoth(): MothModel {
  const k = kit()
  const { body } = k
  body.scale.setScalar(S)
  const b = bodyGeos()
  meshes(body, [
    [b.fur, bossMat(P.grey, P.stoneDark)], [b.abdomen, bossMat(P.stoneLit, P.stoneDeep)], [b.stripes, bossMat(P.lavender, P.greyDark)],
    [b.antennae, bossMat(P.lavender, P.greyDark)], [b.eyes, glowMat(P.hot)], [b.spores, glowMat(P.mint)],
  ])
  const coreMesh = mesh(new THREE.OctahedronGeometry(1.2), glowMat(P.gold), body)
  coreMesh.position.set(0, 1.0, 0.6)
  const coreLight = light(coreMesh, 0, 0, 0.6, 2.4, P.gold, 0.25)
  k.lights.push(
    coreLight,
    light(body, 0.95, 3.75, 1.35, 0.9, P.hot, 0.7),
    light(body, -0.95, 3.75, 1.35, 0.9, P.hot, 0.7),
    light(body, 0, -4.2, 0.6, 2.2, P.mint, 0.55),
    light(body, 4.4, 8.9, 0.6, 0.9, P.mint, 0.6),
    light(body, -4.4, 8.9, 0.6, 0.9, P.mint, 0.6),
  )
  const core = k.add({ id: 'core', kind: 'core', node: coreMesh, r: 1.4 * S, open: false, lights: [coreLight] })

  const panels: Panel[] = []
  // Order: 0 upper left, 1 upper right, 2 lower left, 3 lower right.
  for (const d of [DEFS[0]!, DEFS[0]!, DEFS[1]!, DEFS[1]!].map((d, i) => [d, i % 2 === 0 ? -1 : 1] as const)) {
    const [def, side] = d
    const i = panels.length
    const node = new THREE.Group()
    node.position.set(side < 0 ? def.pivot[0] : -def.pivot[0], def.pivot[1], def.pivot[2])
    body.add(node)
    const pg = panelGeos(def, side)
    meshes(node, [
      [pg.skin, bossMat(P.purple, P.night)], [pg.ribs, bossMat(P.stoneDeep, P.ink)],
      [pg.ring, glowMat(P.jade)], [pg.pupil, glowMat(P.gold)],
    ])
    const ex = def.eye[0] * -side
    const pl = [light(node, ex, def.eye[1], 0.4, def.eyeR * 1.3, P.jade, 0.55)]
    k.lights.push(...pl)
    panels.push({ node, side, upper: def.upper, rest: node.position.clone(), age: 0, dropped: false, lights: pl })
    k.add({
      id: `wing-${i}`, kind: 'part', node, x: def.hit[0] * -side, y: def.hit[1], z: 0, r: def.hitR * S, lights: pl,
      // The panel falls away (animate drives the fall), so keep it visible.
      onDestroy: () => { panels[i]!.dropped = true; panels[i]!.age = 0; updateCore() },
      onRestore: () => {
        const p = panels[i]!
        p.dropped = false
        p.age = 0
        p.node.position.copy(p.rest)
        p.node.rotation.set(0, 0, 0)
      },
    })
  }

  function updateCore() {
    const gone = panels.filter(p => p.dropped).length
    core.open = core.alive && gone > 0
    coreLight.a = 0.25 + 0.18 * gone
  }

  /** sin(ph) drives the flap; the lower panels lag 0.7 rad. */
  function beat(ph: number) {
    for (const p of panels) {
      if (p.dropped) continue
      const f = Math.sin(ph - (p.upper ? 0 : 0.7))
      const amp = p.upper ? 0.55 : 0.4
      p.node.rotation.y = -p.side * amp * f
      p.node.rotation.z = -p.side * 0.12 * f
    }
  }

  function fall(p: Panel) {
    const a = p.age
    p.node.position.set(p.rest.x + p.side * 3.5 * a, p.rest.y - 6 * a * a, p.rest.z - 0.8 * a)
    p.node.rotation.set(a * 1.2, 0, p.side * a * 2.2)
    p.node.visible = a < 2.6
  }

  function dropPanel(i: number) {
    k.destroy(`wing-${i}`)
  }

  function reset() {
    k.restoreAll()
    updateCore()
    beat(0)
    body.position.set(0, 0, 0)
    body.rotation.set(0, 0, 0)
  }

  let lastCycle = -1
  const base = bossModel('moth', k, 12 * S, {
    animate(t, dt) {
      body.position.y = Math.sin(t * 1.3) * 0.5
      body.rotation.z = Math.sin(t * 0.7) * 0.05
      for (const p of panels) if (p.dropped) { p.age += dt; fall(p) }
      coreMesh.rotation.y = t * 1.2
      const pulse = 0.5 + 0.5 * Math.sin(t * 3)
      for (const l of k.lights) if (l.color === P.mint) l.a = 0.4 + 0.3 * pulse
    },
    reset,
    demo(t) {
      beat(t * 4.5)
      const c = t % 16
      if (c < lastCycle) reset()
      lastCycle = c
      for (let i = 0; i < 4; i++) {
        const at = 3 + i * 2.5
        if (c >= at) {
          if (!panels[i]!.dropped) dropPanel(i)
          panels[i]!.age = c - at
          fall(panels[i]!)
        }
      }
    },
  })
  reset()
  return { ...base, id: 'moth', beat, dropPanel, reset }
}

