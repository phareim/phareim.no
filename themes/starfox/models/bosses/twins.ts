/**
 * THE TWINS (sector 4, MIRROR LAKE): two mirrored ships, one the other's
 * reflection — B flies upside down, pink where A is cyan. Each is a pale
 * chrome delta with forward prongs; the core sits between the prongs,
 * dead centre of the ship's face, and only the lit one can be hurt.
 * The wings stand in an X so each ship reads from the front.
 *
 * `ships[0]` (A) and `ships[1]` (B) are children of the root; move and
 * turn them freely. Rest: A at (−7, 1.5, 0), B at (7, 1.5, 0) rolled π.
 * Each ship (scale 1.15 applied): X wings ≈ 11.3 wide and 6.2 tall, 13
 * long; the core at ship-local (0, 0, 4.1), hit radius 1.4; the ship's
 * own hit sphere at its centre, radius 4.5.
 */
import * as THREE from 'three'
import { Geo, P, geo, glowMat, light, mat, mesh, setMat, type ModelLight, type V3 } from '../core'
import { beam, bossMat, bossModel, kit, meshes, spike } from './shared'
import type { BossPart, TwinsModel } from './types'

const S = 1.15

const WING_TILT = 0.5

/** Build a blade on the right side, then add it tilted up and tilted down (and mirrored if `mirror`). */
function xWings(g: Geo, build: (w: Geo) => void, mirror = true) {
  for (const a of [WING_TILT, -WING_TILT]) {
    const w = new Geo()
    build(w)
    if (mirror) w.mirrorX()
    g.add(w.build(), mat(0, 0, 0, 0, 0, a))
  }
}

function shipGeos() {
  return {
    hull: geo('twins:hull', (g) => {
      // Fuselage: a diamond section from the core cradle back to the tail.
      const ring = (z: number, w: number, h: number): V3[] => [[w, 0, z], [0, h, z], [-w, 0, z], [0, -h * 0.7, z]]
      g.loft([ring(3.0, 0.9, 0.9), ring(1.2, 1.5, 1.6), ring(-2.0, 1.4, 1.3), ring(-4.4, 0.7, 0.6)])
      // Forward prongs either side of the core.
      beam(g, [1.3, 0, 2.0], [1.5, 0, 5.4], 0.55, 0.4, 4)
      spike(g, [1.5, 0, 5.4], [1.3, 0, 6.8], 0.4)
      // Tail fin.
      g.fin([[0.9, 0.9, -1.4], [1.6, 2.6, -3.6], [1.5, 2.6, -4.3], [0.9, 0.6, -4.2]], 0.2)
      g.mirrorX()
    }),
    wings: geo('twins:wings', (g) => {
      // X wings: an upper and a lower swept blade each side, so the ship
      // reads as an X from the front, not a line.
      xWings(g, w => w.plate([[0.9, 0, 1.6], [5.6, 0, -2.2], [5.4, 0, -3.4], [0.9, 0, -3.3]], 0.32))
      g.box(0, -0.9, -1.0, 1.4, 0.5, 3.6)
    }),
    trim: geo('twins:trim', (g) => {
      // Leading-edge strips and wingtip lights, tinted per ship.
      xWings(g, (w) => {
        beam(w, [1.0, 0.2, 1.6], [5.6, 0.2, -2.2], 0.16, 0.16, 4)
        w.box(5.5, 0, -2.9, 0.55, 0.55, 1.3)
      }, false)
      g.box(1.5, 0, 5.3, 0.9, 0.9, 0.4)
      g.box(1.2, 1.6, -4.0, 0.3, 0.3, 0.8)
      g.mirrorX()
      g.box(0, 0.2, -4.6, 1.2, 0.7, 0.3)
    }),
    cradle: geo('twins:cradle', (g) => {
      // A dark ring round the core.
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * Math.PI * 2
        const a1 = ((i + 1) / 6) * Math.PI * 2
        beam(g, [Math.cos(a0) * 1.6, Math.sin(a0) * 1.6, 3.6], [Math.cos(a1) * 1.6, Math.sin(a1) * 1.6, 3.6], 0.32, 0.32, 4)
      }
    }),
  }
}

interface Ship { root: THREE.Group; core: THREE.Mesh; coreLight: ModelLight; trimLight: ModelLight; color: string; shipPart: BossPart; corePart: BossPart }

export function createTwins(): TwinsModel {
  const k = kit()
  const g = shipGeos()
  const colors = [P.cyan, P.hot]
  const ships: Ship[] = []
  let current: 0 | 1 | null = null
  ;(['a', 'b'] as const).forEach((tag, i) => {
    const root = new THREE.Group()
    k.body.add(root)
    const inner = new THREE.Group()
    inner.scale.setScalar(S)
    root.add(inner)
    const color = colors[i]!
    meshes(inner, [
      [g.hull, bossMat(P.lavender, P.grey)], [g.wings, bossMat(P.grey, P.navy)],
      [g.cradle, bossMat(P.stoneDark, P.ink)], [g.trim, glowMat(color)],
    ])
    const core = mesh(new THREE.OctahedronGeometry(1.05), bossMat(P.navy, P.night), inner)
    core.position.set(0, 0, 3.6)
    const coreLight = light(core, 0, 0, 0.5, 2.2, color, 0.9)
    const trimLight = light(inner, 0, 0.2, -4.8, 1.6, color, 0.5)
    k.lights.push(coreLight, trimLight, light(inner, 4.8, 2.6, -2.9, 0.8, color, 0.5), light(inner, -4.8, -2.6, -2.9, 0.8, color, 0.5))
    const ship = {
      root, core, coreLight, trimLight, color,
      shipPart: null as unknown as BossPart,
      corePart: null as unknown as BossPart,
    }
    ship.corePart = k.add({ id: `core-${tag}`, kind: 'core', node: core, r: 1.4, open: false, lights: [coreLight] })
    ship.shipPart = k.add({ id: `ship-${tag}`, kind: 'part', node: root, r: 4.5, onDestroy: () => { root.visible = false } })
    ships.push(ship)
  })

  function lit(which: 0 | 1 | null) {
    current = which
    ships.forEach((s, i) => {
      const on = which === i && s.shipPart.alive
      setMat(s.core, on ? glowMat(P.white) : bossMat(P.navy, P.night))
      s.coreLight.on = on
      s.corePart.open = on && s.corePart.alive
    })
  }

  function setPartDestroyed(id: string) {
    // A dead core is a dead twin, and the other way round.
    const s = ships.find(x => x.corePart.id === id || x.shipPart.id === id)
    if (!s) { k.destroy(id); return }
    k.destroy(s.corePart.id)
    k.destroy(s.shipPart.id)
    s.root.visible = false
    lit(current)
  }

  function rest() {
    ships[0]!.root.position.set(-7, 1.5, 0)
    ships[0]!.root.rotation.set(0, 0, 0)
    ships[1]!.root.position.set(7, 1.5, 0)
    ships[1]!.root.rotation.set(0, 0, Math.PI)
  }

  function reset() {
    k.restoreAll()
    rest()
    lit(null)
  }

  const base = bossModel('twins', k, 12, {
    setPartDestroyed,
    animate(t) {
      k.body.position.y = Math.sin(t * 1.4) * 0.3
      ships.forEach((s, i) => {
        s.core.rotation.z = t * (i ? -2 : 2)
        if (s.coreLight.on) s.coreLight.a = 0.7 + 0.3 * Math.sin(t * 10)
      })
    },
    reset,
    demo(t) {
      // Orbit each other across the lane, trading the lit core every 2.5 s.
      const a = t * 0.7
      const x = Math.cos(a) * 7
      const y = Math.sin(a) * 3
      ships[0]!.root.position.set(-x, 1.5 + y, Math.sin(a * 2) * 2)
      ships[1]!.root.position.set(x, 1.5 - y, -Math.sin(a * 2) * 2)
      ships[0]!.root.rotation.set(0, 0, -Math.sin(a) * 0.35)
      ships[1]!.root.rotation.set(0, 0, Math.PI - Math.sin(a) * 0.35)
      lit((Math.floor(t / 2.5) % 2) as 0 | 1)
    },
  })
  reset()
  return {
    ...base,
    id: 'twins',
    ships: [ships[0]!.root, ships[1]!.root],
    lit,
    reset,
  }
}
