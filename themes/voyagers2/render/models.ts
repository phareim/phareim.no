/**
 * Space Voyagers II: every ship, made in code (DESIGN.md, "The picture").
 * Ours are Slop's red and white with wood panels; the Franchise's are its
 * mustard, brown and cream, each kind shaped after its mascot. The Deep
 * Dish is a pizza in a pan with a brick oven on it.
 *
 * Sizes match the engine's collision radii (`engine/balance.ts`): a model
 * is about two radii long.
 */
import type { ShipKind } from '../engine/types'
import { M } from './palette'
import { Shape } from './shapes'
import type { P3 } from './shapes'

const R = Shape.ring

function calzone(s: Shape): void {
  // Nova's dart is the nose, Rex's wagon the body, nose to tail; the bubble turret at the back.
  s.loft([
    [[0, 0.1, -9.5]],
    R(-7, 1.0, 0.9, 8, Math.PI / 8),
    R(-4, 1.9, 1.6, 8, Math.PI / 8),
  ], M.red)
  s.loft([
    R(-4, 1.9, 1.6, 8, Math.PI / 8),
    R(-2.5, 2.4, 2.0, 8, Math.PI / 8),
    R(3.5, 2.5, 2.1, 8, Math.PI / 8),
    R(6.5, 1.9, 1.7, 8, Math.PI / 8),
  ], M.white)
  // Wood panels down both sides.
  for (const x of [-1, 1]) s.box(0.3, 1.5, 6.2, M.wood, { at: [x * 2.45, -0.15, 0.6], rot: [0, 0, x * -0.15] })
  // The red stripe over the top.
  s.box(1.1, 0.25, 9.5, M.red, { at: [0, 2.05, 0.7] })
  // The front cockpit: a glass hump, its frame white.
  s.taper(1.5, 0.6, 2.0, 1.2, 3.2, M.glass, { at: [0, 2.2, -2.4] }, -0.25, 0)
  // The bubble turret.
  s.ball(1.35, 8, 3, M.glass, { at: [0, 1.75, 4.6] }, true, 0.9)
  s.cyl(1.4, 1.4, 0.4, 8, M.white, { at: [0, 1.75, 4.6], rot: [Math.PI / 2, 0, 0] })
  // Twin guns under the turret, pointing back.
  for (const x of [-0.45, 0.45]) s.box(0.22, 0.22, 1.6, M.steel, { at: [x, 2.2, 6.0] })
  // Rocket fins, three of them, the old way.
  for (const a of [Math.PI / 2 + 2.1, Math.PI / 2 - 2.1, Math.PI / 2]) {
    const c = Math.cos(a), sn = Math.sin(a)
    s.taper(0.25, 0.5, 0.25, 3.4, 3.6, M.red, { at: [c * 2.6, sn * 2.4, 6.0], rot: [0, 0, a - Math.PI / 2] }, 0, 1.2)
  }
  // Nozzle and its fire.
  s.cyl(1.3, 1.0, 1.6, 8, M.steel, { at: [0, 0, 7.4] })
  s.cyl(0.9, 0.5, 0.6, 8, M.glow, { at: [0, 0, 8.4] })
  // Nova's headlamp on the nose.
  s.cyl(0.35, 0.35, 0.3, 6, M.glow, { at: [0, 1.0, -6.6], rot: [-0.3, 0, 0] })
}

function moped(s: Shape): void {
  // Dougie's: a scooter with a windshield and two little wings.
  s.loft([
    [[0, -0.2, -6]],
    R(-4, 1.2, 1.0, 6, Math.PI / 6),
    R(2, 1.4, 1.2, 6, Math.PI / 6),
    R(5, 0.9, 0.8, 6, Math.PI / 6),
  ], [M.red, M.cream, M.cream])
  s.taper(1.4, 0.2, 1.6, 1.4, 1.6, M.glass, { at: [0, 1.2, -2.6], rot: [-0.5, 0, 0] })
  for (const x of [-1, 1]) s.taper(0.2, 0.2, 3.4, 0.25, 2.6, M.red, { at: [x * 2.2, -0.3, 1.8] })
  s.cyl(0.6, 0.5, 0.8, 6, M.glow, { at: [0, 0, 5.4] })
  s.cyl(0.3, 0.3, 0.2, 6, M.glow, { at: [0, 0.6, -4.6] })
}

function rat(s: Shape): void {
  // A slice: a cheese-topped wedge, crust along the back, rat ears and a head for a cockpit.
  const tip = -6.5, back = 3.5, half = 4.6
  s.plate([[0, tip], [half, back], [-half, back]], 1.2, M.mustard, { at: [0, 0, 0] })
  s.plate([[0, tip + 0.6], [half - 0.3, back - 0.2], [-half + 0.3, back - 0.2]], 0.6, M.brown, { at: [0, -0.8, 0] })
  // Pepperoni.
  for (const [x, z] of [[0, -2.5], [-1.6, 0.8], [1.5, 1.2]] as [number, number][]) s.cyl(0.7, 0.7, 0.2, 6, M.mred, { at: [x, 0.65, z], rot: [Math.PI / 2, 0, 0] })
  // The crust, a fat rod along the back edge.
  s.cyl(0.8, 0.8, half * 2 + 0.6, 6, M.crust, { at: [0, 0.1, back + 0.3], rot: [0, Math.PI / 2, 0] })
  // The head and its ears.
  s.ball(1.1, 6, 2, M.cream, { at: [0, 0.6, 1.4] }, true)
  for (const x of [-1, 1]) {
    s.cyl(0.9, 0.9, 0.25, 8, M.brown, { at: [x * 1.1, 1.9, 1.6], rot: [0, 0, x * 0.3] })
    s.cyl(0.5, 0.5, 0.3, 8, M.mred, { at: [x * 1.1, 1.9, 1.5], rot: [0, 0, x * 0.3] })
  }
  // A tail, and the engine.
  s.box(0.2, 0.2, 3.2, M.brown, { at: [0, 0.2, back + 2.2], rot: [0.3, 0, 0] })
  s.cyl(0.5, 0.4, 0.5, 6, M.glow, { at: [0, -0.3, back + 0.9] })
}

function bear(s: Shape): void {
  // A pan with a bowler hat and ears.
  s.cyl(5.6, 5.6, 1.6, 12, M.brown, { rot: [Math.PI / 2, 0, 0] })
  s.cyl(5.9, 5.9, 0.5, 12, M.mustard, { at: [0, 0.75, 0], rot: [Math.PI / 2, 0, 0] })
  // The hat: crown and brim.
  s.cyl(2.6, 2.6, 0.3, 10, M.dark, { at: [0, 1.1, 0.4], rot: [Math.PI / 2, 0, 0] })
  s.ball(1.8, 8, 2, M.dark, { at: [0, 1.2, 0.4] }, true, 1.1)
  // Ears either side of the hat.
  for (const x of [-1, 1]) s.cyl(1.0, 1.0, 0.4, 8, M.brown, { at: [x * 2.4, 1.9, 0.6], rot: [0, 0, x * 0.4] })
  // A cream snout at the front, two guns.
  s.ball(1.2, 6, 2, M.cream, { at: [0, 0.4, -4.9] }, false, 0.7)
  for (const x of [-2.6, 2.6]) s.box(0.4, 0.4, 3, M.steel, { at: [x, 0, -5.2] })
  s.cyl(0.8, 0.6, 0.5, 6, M.glow, { at: [0, 0, 5.6] })
}

function gorilla(s: Shape): void {
  // A heavy: a chest of a body, a head on top, fists for gun pods.
  s.taper(5.5, 3.5, 7, 4.5, 14, M.brown)
  s.box(3.2, 2.4, 3.2, M.dark, { at: [0, 2.8, -3.4] })
  s.box(2.4, 1.4, 0.5, M.cream, { at: [0, 2.6, -5.1] })
  for (const x of [-1, 1]) {
    s.box(3.2, 0.8, 1.4, M.brown, { at: [x * 4.6, 0, -1.5] })
    s.box(2.8, 2.8, 3.2, M.mustard, { at: [x * 6.4, 0, -2.8] })
  }
  s.box(0.5, 0.5, 2.2, M.steel, { at: [0, 2.6, 7.6] })
  for (const x of [-1.6, 1.6]) s.cyl(1.0, 0.8, 0.6, 6, M.glow, { at: [x, 0, 7.2] })
}

function hound(s: Shape): void {
  // A long bomber with droopy ear fins and sunglasses; the torpedo under its belly.
  s.loft([
    [[0, 0, -12]],
    R(-9, 1.4, 1.3, 8, Math.PI / 8),
    R(-4, 2.6, 2.4, 8, Math.PI / 8),
    R(6, 2.6, 2.4, 8, Math.PI / 8),
    R(11, 1.6, 1.5, 8, Math.PI / 8),
  ], [M.orange, M.orange, M.cream, M.orange])
  s.taper(2.8, 0.7, 3.2, 1.0, 2.6, M.dark, { at: [0, 1.9, -6] })
  for (const x of [-1, 1]) {
    s.taper(0.3, 3.4, 0.3, 4.4, 5.5, M.brown, { at: [x * 2.9, -1.6, -1.5], rot: [0, 0, x * -0.5] })
  }
  s.cyl(0.9, 0.9, 7, 6, M.steel, { at: [0, -2.9, 1] })
  s.cyl(1.2, 0.9, 0.6, 8, M.glow, { at: [0, 0, 11.3] })
}

function rig(s: Shape): void {
  // Big Marge's Tall Tale: a cab and a box trailer, a tail gun.
  s.box(5, 5, 6, M.red, { at: [0, 0, -8] })
  s.box(4.4, 2, 2.2, M.glass, { at: [0, 1.6, -11] })
  s.box(6, 6, 16, M.cream, { at: [0, 0.5, 3] })
  s.box(0.6, 0.6, 3, M.steel, { at: [0, 4, 11] })
  for (const x of [-2, 2]) s.cyl(0.4, 0.4, 3, 6, M.steel, { at: [x, 3.4, -9], rot: [Math.PI / 2, 0, 0] })
  s.cyl(1.6, 1.2, 0.8, 8, M.glow, { at: [0, 0, 11.4] })
}

function tug(s: Shape): void {
  s.box(6, 4, 9, M.steel)
  s.box(4, 2, 3, M.glass, { at: [0, 2.6, -2] })
  s.box(8, 1, 3, M.mustard, { at: [0, -1.5, -5] })
  s.cyl(1.4, 1.1, 1, 8, M.glow, { at: [0, 0, 5] })
}

function pigeon(s: Shape): void {
  // Hans Duo's: a saucer with a cockpit off to one side.
  s.cyl(6, 6, 1.4, 12, M.steel, { rot: [Math.PI / 2, 0, 0] })
  s.ball(2, 8, 2, M.glass, { at: [3.6, 0.6, -2] }, true)
  for (const x of [-1.6, 1.6]) s.box(1.6, 1, 5, M.steel, { at: [x, 0, -7] })
  s.cyl(1.4, 1.2, 0.6, 8, M.glow, { at: [0, 0, 6.2] })
}

function parmesan(s: Shape): void {
  // The prince's GOLDEN GRATER: a box grater with wings and a crown.
  s.taper(2.5, 2.5, 5, 5, 14, M.gold)
  for (const x of [-1, 1]) s.plate([[0, -3], [7, 4], [0, 5]], 0.5, M.gold, { at: [x * 2, 0, 0], rot: [0, x > 0 ? 0 : Math.PI, 0] })
  for (let i = -2; i <= 2; i++) s.box(0.5, 0.9, 0.5, M.gold, { at: [i * 0.9, 3.0, -1] })
  s.box(4.6, 0.6, 1.2, M.mred, { at: [0, 2.6, -1] })
  s.cyl(1.4, 1.1, 0.8, 8, M.glow, { at: [0, 0, 7.4] })
}

function hauler(s: Shape): void {
  s.box(18, 14, 70, M.cream)
  s.box(16, 8, 10, M.glass, { at: [0, 4, -36] })
  for (const z of [-20, 0, 20]) s.box(20, 16, 4, M.red, { at: [0, 0, z] })
  for (const x of [-5, 5]) s.cyl(3, 2.4, 3, 8, M.glow, { at: [x, 0, 36] })
}

function deepdish(s: Shape): void {
  // The pan.
  s.cyl(170, 165, 38, 24, M.pan, { rot: [Math.PI / 2, 0, 0] })
  // The crust, a ring of fat segments round the top.
  const n = 24
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    s.box(46, 14, 18, M.crust, { at: [Math.cos(a) * 160, 22, Math.sin(a) * 160], rot: [0, -a + Math.PI / 2, 0] })
  }
  // Cheese.
  s.cyl(152, 152, 4, 24, M.mustard, { at: [0, 19, 0], rot: [Math.PI / 2, 0, 0] })
  // Pepperoni, big as hangars.
  const pep: [number, number][] = [[-70, -40], [40, -90], [90, 30], [-30, 80], [-100, 50], [10, 10], [70, -10], [-60, -100]]
  for (const [x, z] of pep) s.cyl(20, 20, 3, 10, M.mred, { at: [x, 22, z], rot: [Math.PI / 2, 0, 0] })
  // The brick oven: a chimney tower near the back, a bridge on it.
  s.box(46, 70, 46, M.brick, { at: [0, 55, 70] })
  s.box(30, 50, 30, M.brick, { at: [0, 110, 70] })
  s.box(36, 10, 36, M.dark, { at: [0, 137, 70] })
  s.box(60, 12, 20, M.steel, { at: [0, 82, 44] })
  s.box(56, 6, 4, M.glass, { at: [0, 84, 33.5] })
  // The oven door at the front: a dark mouth and the fire in it.
  s.box(70, 26, 12, M.brick, { at: [0, 0, -168] })
  s.box(54, 18, 6, M.dark, { at: [0, -1, -173] })
  s.box(46, 10, 3, M.glow, { at: [0, -4, -171] })
  // Engines.
  for (const x of [-80, 0, 80]) {
    s.cyl(18, 16, 30, 10, M.steel, { at: [x, -5, 178] })
    s.cyl(13, 9, 6, 10, M.glow, { at: [x, -5, 195] })
  }
}

function outlet(s: Shape): void {
  // A drive-through on an engine: a roof, a sign, a window.
  s.box(50, 30, 120, M.cream)
  s.taper(56, 4, 60, 18, 126, M.orange, { at: [0, 22, 0] }, 0, 0)
  s.box(4, 30, 4, M.steel, { at: [0, 45, -40] })
  s.box(40, 14, 3, M.mustard, { at: [0, 66, -40] })
  s.box(30, 10, 2, M.glass, { at: [26, 2, -20] })
  for (const x of [-15, 15]) s.cyl(10, 8, 14, 8, M.glow, { at: [x, 0, 66] })
}

function buffet(s: Shape): void {
  // A whole restaurant, long: the dining hall, the sign tower, the drive-through bay.
  s.box(110, 70, 420, M.cream)
  s.taper(120, 6, 124, 30, 430, M.orange, { at: [0, 48, 0] })
  s.box(10, 80, 10, M.steel, { at: [0, 100, 120] })
  s.box(90, 34, 6, M.mustard, { at: [0, 150, 120] })
  s.box(80, 30, 10, M.dark, { at: [0, -10, -212] })
  for (const z of [-120, -40, 40, 120]) for (const x of [-56, 56]) s.box(4, 20, 40, M.glass, { at: [x, 10, z] })
  for (const x of [-35, 35]) s.cyl(26, 20, 30, 10, M.glow, { at: [x, 0, 222] })
}

function turret(s: Shape): void {
  // A gun dome with twin barrels, looking down its mount's -z.
  s.cyl(5, 5.5, 2.5, 8, M.steel, { rot: [Math.PI / 2, 0, 0] })
  s.ball(4, 8, 2, M.steel, { at: [0, 1.2, 0] }, true)
  for (const x of [-1.2, 1.2]) s.box(0.8, 0.8, 7, M.dark, { at: [x, 2, -4] })
}

function hut(s: Shape): void {
  // THE HUT: a dome the size of a moon, a band of windows round its middle, a sign on a pylon.
  s.ball(470, 18, 6, M.cream, { at: [0, 0, 0] }, true, 0.64)
  s.cyl(480, 476, 40, 24, M.orange, { at: [0, 0, 0], rot: [Math.PI / 2, 0, 0] })
  s.cyl(486, 480, 12, 24, M.mustard, { at: [0, 24, 0], rot: [Math.PI / 2, 0, 0] })
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    s.box(40, 18, 6, M.glass, { at: [Math.cos(a) * 452, 70, Math.sin(a) * 452], rot: [0, -a + Math.PI / 2, 0] })
  }
  s.box(16, 260, 16, M.steel, { at: [300, 260, 0] })
  s.box(180, 70, 10, M.mred, { at: [300, 420, 0] })
  s.box(160, 50, 12, M.mustard, { at: [300, 420, 0] })
  // The underside: the moon it sits on.
  s.ball(470, 18, 4, M.pan, { at: [0, 0, 0], rot: [Math.PI, 0, 0] }, true, 0.4)
}

function vent(s: Shape): void {
  // The Hut's oven vent: a brick chimney stack with the fire in its mouth.
  s.box(56, 70, 56, M.brick, { at: [0, 35, 0] })
  s.box(64, 10, 64, M.dark, { at: [0, 74, 0] })
  s.box(40, 4, 40, M.glow, { at: [0, 80, 0] })
}

const BUILDERS: Record<ShipKind, (s: Shape) => void> = {
  calzone, moped, rig, tug, pigeon, deepdish, hauler, rat, bear, gorilla, hound, parmesan, buffet, outlet, turret, hut, vent,
}

export interface ModelData { pos: Float32Array; nor: Float32Array; mat: Float32Array }

/**
 * How much larger than its own metres a model is drawn. Fighters are drawn
 * 2.2 times their hit sphere's size, so a fight at a few hundred metres fills
 * the view as Wing Commander's did; big ships are drawn as they are.
 */
export const VIS = 2.2
export function visScale(capital: boolean): number { return capital ? 1 : VIS }

const cache = new Map<ShipKind, ModelData>()

export function modelData(kind: ShipKind): ModelData {
  let d = cache.get(kind)
  if (!d) {
    const s = new Shape()
    BUILDERS[kind](s)
    d = { pos: new Float32Array(s.pos), nor: new Float32Array(s.nor), mat: new Float32Array(s.mat) }
    cache.set(kind, d)
  }
  return d
}

/** Debris: a few small chunks in a ship's colours. */
export function chunkData(mat: number, size: number): ModelData {
  const s = new Shape()
  s.loft([[[0, size, 0] as P3], R(0, size * 0.8, size * 0.6, 3, 0.3).map(p => [p[0], -size * 0.4, p[1]] as P3), [[0, -size, 0.2] as P3]], mat)
  return { pos: new Float32Array(s.pos), nor: new Float32Array(s.nor), mat: new Float32Array(s.mat) }
}

/** The main colour of each kind: its debris and its shield flash. */
export const BODY: Record<ShipKind, number> = {
  calzone: M.white, moped: M.cream, rig: M.red, tug: M.steel, pigeon: M.steel, deepdish: M.pan, hauler: M.cream,
  rat: M.mustard, bear: M.brown, gorilla: M.brown, hound: M.orange, parmesan: M.gold, buffet: M.cream, outlet: M.cream,
  turret: M.steel, hut: M.cream, vent: M.brick,
}
