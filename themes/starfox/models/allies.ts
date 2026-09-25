/**
 * The player's side and the rival (2026-09-25).
 *
 * `buildWingShip(pilot)`: the wingmen's fighter (heron pink, bison gold,
 * dingo cyan; reserves walrus violet/teal, zebra white/black). An Arwing-family silhouette in pale
 * hull colours — the Hollow's ships are dark, so friends read light — with
 * upturned wingtip fins in the pilot's trim and a bright engine. Nose −Z,
 * like the player's ship (they fly with the player).
 *
 * `buildRival()`: MEGA COBRA's fighter, flying for the Hollow. Near-black
 * hull, a cobra hood that flares open when he attacks, two pink slit eyes,
 * fangs under the nose and a lime stripe down the spine. Nose +Z, like
 * every enemy (he comes at the player).
 */
import * as THREE from 'three'
import { P, geo, hullMat, glowMat, mesh, setMat, flashTree, light, ringZ, type Model, type ModelLight, type V3, type Hex } from './core'

// ---------------------------------------------------------------- wingmen

/** The wing pilots (Hall of Fame animals): three fly, two wait in reserve. */
export type WingPilotId = 'heron' | 'bison' | 'dingo' | 'walrus' | 'zebra'
export const WING_PILOT_IDS: WingPilotId[] = ['heron', 'bison', 'dingo', 'walrus', 'zebra']

/** Trim per pilot: [bright trim, second trim]. */
export const WING_TRIMS: Record<WingPilotId, [Hex, Hex]> = {
  heron: [P.hot, P.pink],
  bison: [P.gold, P.orange],
  dingo: [P.cyan, P.cyanDark],
  walrus: [P.purple, P.jade],
  zebra: [P.white, P.ink],
}

export interface WingShipModel extends Model {
  pilot: WingPilotId
  /** Roll this for banking and barrel rolls (the root is the game's). */
  bank: THREE.Group
  /** Engine anchor in `bank` space (for trails): the exhaust centre. */
  engine: THREE.Vector3
  /** Down / damaged: trim goes smoke-dark, the engine sputters, lights dim. */
  down(on: boolean): void
  /** Idle engine flicker; `boost` 0–1 lengthens the flame. */
  animate(t: number, dt: number, boost?: number): void
}

const flip = (pts: V3[]): V3[] => pts.map(p => [-p[0], p[1], p[2]] as V3)
const SMOKE = P.greyDark

export function buildWingShip(pilot: WingPilotId = 'heron'): WingShipModel {
  const [hi, hi2] = WING_TRIMS[pilot]
  const root = new THREE.Group()
  root.name = `wing-${pilot}`
  const bank = new THREE.Group()
  root.add(bank)
  // Swept main wing with a slight dihedral; the tip fins stand up (the Arwing look, the player's squadron).
  const wing: V3[] = [[0.3, 0, -0.3], [2.0, 0.18, 0.75], [1.95, 0.18, 1.2], [0.3, 0, 0.9]]
  const fin: V3[] = [[1.95, 0.15, 0.45], [2.14, 1.1, 1.1], [2.14, 1.1, 1.3], [2.0, 0.15, 1.25]]
  mesh(geo('wing/hull', g => {
    g.loft([[[0, -0.05, -2.1]], ringZ(4, 0.24, 0.2, -1.2), ringZ(4, 0.46, 0.36, 0.1), ringZ(4, 0.4, 0.3, 1.2), ringZ(4, 0.26, 0.2, 1.55)])
    // Wingtip guns, like the player's ship.
    for (const s of [1, -1]) g.loft([ringZ(4, 0.08, 0.08, -0.7, 0, s * 1.9, 0.12), ringZ(4, 0.08, 0.08, 0.9, 0, s * 1.9, 0.12)], true, true)
  }), hullMat(P.lavender), bank)
  mesh(geo('wing/wings', g => { g.plate(wing, 0.1).plate(flip(wing), 0.1) }), hullMat(P.grey), bank)
  mesh(geo('wing/canopy', g => { g.loft([[[0, 0.3, -0.9]], ringZ(4, 0.18, 0.2, -0.3, 0, 0, 0.3), [[0, 0.32, 0.5]]]) }), glowMat(P.navy), bank)
  // Trim: tip fins and the tail fin in the bright trim (they are what shows from behind), stripes in the second.
  const trimA = mesh(geo('wing/trimA', g => {
    g.fin(fin, 0.09).fin(flip(fin), 0.09)
    g.fin([[0, 0.3, 0.7], [0, 1.0, 1.4], [0, 1.0, 1.55], [0, 0.3, 1.5]], 0.08)
  }), hullMat(hi), bank)
  const trimB = mesh(geo('wing/trimB', g => {
    const edge: V3[] = [[0.32, 0.02, -0.33], [1.98, 0.2, 0.72], [1.98, 0.2, 0.9], [0.32, 0.02, -0.14]]
    g.plate(edge, 0.12).plate(flip(edge), 0.12)
    g.box(0, 0.22, -1.25, 0.16, 0.06, 0.55)
    // Zebra-style bars over the fins read for every pilot as a second colour.
    g.fin([[2.05, 0.6, 0.72], [2.12, 0.95, 0.98], [2.12, 0.95, 1.1], [2.05, 0.6, 0.86]].map(p => [p[0] + 0.05, p[1], p[2]] as V3), 0.02)
    g.fin(flip([[2.05, 0.6, 0.72], [2.12, 0.95, 0.98], [2.12, 0.95, 1.1], [2.05, 0.6, 0.86]]).map(p => [p[0] - 0.05, p[1], p[2]] as V3), 0.02)
  }), hullMat(hi2), bank)
  const flame = mesh(geo('wing/engine', g => { g.poly(ringZ(4, 0.24, 0.2, 1.57)); g.loft([ringZ(4, 0.24, 0.2, 1.57), [[0, 0, 2.3]]], false, false) }), glowMat(P.white), bank)
  const tips = mesh(geo('wing/tips', g => { g.box(2.14, 1.12, 1.2, 0.12, 0.14, 0.24).box(-2.14, 1.12, 1.2, 0.12, 0.14, 0.24) }), glowMat(hi === P.white ? P.cyan : hi), bank)
  const engine = new THREE.Vector3(0, 0, 1.8)
  const lights: ModelLight[] = [light(bank, 0, 0, 1.9, 1.2, hi === P.white ? P.lavender : hi, 0.75), light(bank, 2.14, 1.1, 1.2, 0.45, hi, 0.5), light(bank, -2.14, 1.1, 1.2, 0.45, hi, 0.5)]
  let isDown = false
  return {
    pilot, root, bank, engine, lights, radius: 1.5,
    flash: on => flashTree(root, on),
    down(on) {
      isDown = on
      setMat(trimA, hullMat(on ? SMOKE : hi))
      setMat(trimB, hullMat(on ? P.stoneDark : hi2))
      setMat(tips, glowMat(on ? P.redDark : hi === P.white ? P.cyan : hi))
      lights[1]!.on = lights[2]!.on = !on
    },
    animate(t, _dt, boost = 0) {
      if (isDown) {
        // A sputtering engine: out more often than on.
        const on = Math.sin(t * 23) + Math.sin(t * 7.3) > 0.9
        flame.visible = on
        lights[0]!.on = on
        lights[0]!.a = 0.4
        return
      }
      flame.visible = true
      lights[0]!.on = true
      lights[0]!.a = 0.75
      flame.scale.set(1, 1, 0.8 + 0.3 * Math.sin(t * 40) + boost * 0.8)
      lights[0]!.r = 1.2 + boost
    },
  }
}

// ---------------------------------------------------------------- MEGA COBRA

export interface RivalModel extends Model {
  body: THREE.Group
  /** 0 hood folded (cruising), 1 flared (attacking / taunting). */
  hood(open: number): void
  animate(t: number, dt: number, state?: { bank?: number; boost?: number }): void
}

export const RIVAL_RADIUS = 1.8

export function buildRival(): RivalModel {
  const root = new THREE.Group()
  root.name = 'rival'
  const body = new THREE.Group()
  root.add(body)
  // A long snake's-head fuselage, nose +Z, tail trailing −Z.
  mesh(geo('rival/hull', g => {
    g.loft([[[0, -0.1, 2.6]], ringZ(6, 0.34, 0.2, 1.9, Math.PI / 6), ringZ(6, 0.55, 0.3, 0.9, Math.PI / 6), ringZ(6, 0.5, 0.34, -0.6, Math.PI / 6), ringZ(6, 0.3, 0.22, -1.8, Math.PI / 6), [[0, 0, -3.0]]])
    // Swept-back blade wings, low and sharp.
    const w: V3[] = [[0.4, -0.08, 0.2], [2.3, -0.25, -1.6], [2.1, -0.25, -1.9], [0.35, -0.08, -1.1]]
    g.plate(w, 0.08).plate(flip(w), 0.08)
  }), hullMat(P.stoneDeep), body)
  mesh(geo('rival/fangs', g => {
    g.loft([[[0.18, -0.55, 2.05]], ringZ(3, 0.06, 0.06, 1.75, 0, 0.18, -0.18)], false, true)
    g.loft([[[-0.18, -0.55, 2.05]], ringZ(3, 0.06, 0.06, 1.75, 0, -0.18, -0.18)], false, true)
  }), hullMat(P.white), body)
  mesh(geo('rival/spine', g => {
    g.box(0, 0.33, 0.2, 0.1, 0.06, 2.4)
    g.fin([[0, 0.3, -1.2], [0, 0.95, -2.2], [0, 0.22, -2.3]], 0.06)
    for (const s of [1, -1]) g.box(s * 2.2, -0.25, -1.75, 0.14, 0.1, 0.4)
  }), glowMat(P.lime), body)
  mesh(geo('rival/eyes', g => {
    for (const s of [1, -1]) g.plate([[s * 0.2, 0.2, 1.6], [s * 0.45, 0.16, 1.2], [s * 0.4, 0.16, 1.1], [s * 0.16, 0.2, 1.45]], 0.08)
  }), glowMat(P.hot), body)
  mesh(geo('rival/engine', g => { g.poly(ringZ(6, 0.26, 0.2, -1.82, Math.PI / 6).map(p => [p[0], p[1], p[2]] as V3)); g.box(0, 0, -1.86, 0.3, 0.14, 0.06) }), glowMat(P.lime), body)
  // The hood: two flat plates behind the head that fan out sideways.
  const hoods: THREE.Group[] = []
  for (const s of [1, -1]) {
    const hinge = new THREE.Group()
    hinge.position.set(s * 0.45, 0.1, 0.6)
    body.add(hinge)
    const plate: V3[] = [[0, 0, 0.4], [s * 1.25, 0.25, 0.1], [s * 1.35, 0.2, -0.6], [s * 0.9, 0.1, -1.1], [0, 0, -0.9]]
    mesh(geo(`rival/hood${s}`, g => { g.plate(plate, 0.08) }), hullMat(P.stoneDark), hinge)
    mesh(geo(`rival/hoodmark${s}`, g => {
      g.plate([[s * 0.5, 0.06, -0.05], [s * 0.9, 0.12, -0.15], [s * 0.85, 0.11, -0.45], [s * 0.5, 0.06, -0.35]], 0.1)
    }), glowMat(P.hot), hinge)
    mesh(geo(`rival/hoodedge${s}`, g => { g.plate([[s * 1.22, 0.26, 0.12], [s * 1.36, 0.24, 0.1], [s * 1.44, 0.2, -0.6], [s * 1.32, 0.2, -0.6]], 0.1) }), glowMat(P.lime), hinge)
    hoods.push(hinge)
  }
  let hoodOpen = 0
  const setHood = (o: number) => {
    hoodOpen = Math.max(0, Math.min(1, o))
    // Folded: the plates lie back along the hull; flared: they stand out to the sides.
    hoods[0]!.rotation.set(0, -(1 - hoodOpen) * 1.1, -hoodOpen * 0.25)
    hoods[1]!.rotation.set(0, (1 - hoodOpen) * 1.1, hoodOpen * 0.25)
    hoods[0]!.scale.setScalar(0.6 + hoodOpen * 0.4)
    hoods[1]!.scale.setScalar(0.6 + hoodOpen * 0.4)
  }
  setHood(0)
  const lights: ModelLight[] = [
    light(body, 0.3, 0.2, 1.35, 0.5, P.hot, 0.7),
    light(body, -0.3, 0.2, 1.35, 0.5, P.hot, 0.7),
    light(body, 0, 0, -2.0, 1.1, P.lime, 0.7),
  ]
  const phase = Math.random() * 6.28
  return {
    root, body, lights, radius: RIVAL_RADIUS,
    flash: on => flashTree(root, on),
    hood: setHood,
    animate(t, _dt, s) {
      // A snake's sway: yaw and roll a little out of step.
      body.rotation.y = Math.sin(t * 1.7 + phase) * 0.08
      body.rotation.z = Math.sin(t * 1.7 + phase - 0.8) * 0.15 + (s?.bank ?? 0)
      lights[2]!.r = 1.1 + (s?.boost ?? 0) * 1.2
      void hoodOpen
    },
  }
}
