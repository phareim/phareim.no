import type { Beast, Buddy, Guard, Leech, TentacleHazard, World } from '../types'
import { TAP_HOLD, BEAM_HOLD, KICK_TIME } from '../engine/util'
import {
  CYAN, FAR, GOLD, L, MID, NEAR, PINK, SKIN, SUIT,
  bar, clamp, disc, glow, poly, rect,
  type Pt, type Scene, type View,
} from './core'

// Everyone with a body. One rig for the pilot, the guards and the friend:
// flat quads for limbs, a polygon head, key poses held (not tweened), so the
// motion has the rotoscoped weight of the original. u is forward, v is up
// from the feet, in figure units (the pilot is 52 tall).

type Leg = [number, number, number, number] // knee u,v · foot u,v
type Arm = [number, number, number, number] // elbow u,v · hand u,v
export interface Pose {
  hip: number
  hipU?: number
  sho: number
  lean: number
  head: Pt
  legs: [Leg, Leg] // back, front
  arms: [Arm, Arm] // back, front
  /** draw a gun in the front hand */
  gun?: boolean
}

const IDLE: Pose = { hip: 27, sho: 45, lean: 0, head: [1, 48.5], legs: [[-3, 14, -3.5, 0.5], [3, 14, 3.5, 0.5]], arms: [[-4.5, 36, -4.5, 29.5], [4.5, 36, 5, 29.5]] }
const RUN_HALF: Pose[] = [
  { hip: 26, sho: 44, lean: 2, head: [3, 48.5], legs: [[-7, 13, -13, 5], [6, 15, 11, 0.5]], arms: [[6, 36, 10, 41], [-7, 36, -10, 30]] },
  { hip: 24, sho: 42, lean: 3, head: [4, 46.5], legs: [[-3, 16, -10, 9], [3, 12, 3, 0.5]], arms: [[3, 35, 7, 39], [-4, 35, -6, 31]] },
  { hip: 27, sho: 45, lean: 3, head: [4, 49.5], legs: [[5, 20, 3, 11], [-4, 14, -9, 3]], arms: [[-3, 36, -5, 31], [4, 36, 8, 41]] },
]
const RUN: Pose[] = [
  ...RUN_HALF,
  ...RUN_HALF.map((p): Pose => ({ ...p, legs: [p.legs[1], p.legs[0]], arms: [p.arms[1], p.arms[0]] })),
]
const JUMP: Pose = { hip: 27, sho: 45, lean: 4, head: [5, 49], legs: [[-7, 20, -13, 12], [9, 19, 15, 10]], arms: [[-8, 38, -12, 31], [8, 41, 14, 47]] }
const HOP: Pose = { hip: 27, sho: 45, lean: 1, head: [2, 49], legs: [[-2, 16, -3, 7], [3, 17, 3, 7]], arms: [[-6, 38, -9, 32], [6, 38, 9, 32]] }
const FALL: Pose = { hip: 27, sho: 45, lean: -1, head: [1, 49], legs: [[-4, 15, -6, 4], [5, 16, 6, 4]], arms: [[-6, 42, -9, 50], [6, 42, 9, 50]] }
const CROUCH: Pose = { hip: 18, hipU: 1, sho: 34, lean: 5, head: [7, 38], legs: [[-7, 9, -7, 0.5], [7, 10, 6, 0.5]], arms: [[-3, 26, 1, 20], [9, 28, 13, 22]] }
const KICK: Pose = { hip: 28, sho: 45, lean: -4, head: [-2, 49], legs: [[-3, 14, -4, 0.5], [9, 24, 22, 20]], arms: [[-9, 38, -14, 33], [3, 38, 8, 33]] }
const KICK_WIND: Pose = { hip: 27, sho: 45, lean: -2, head: [-1, 48.5], legs: [[-3, 14, -4, 0.5], [6, 22, 2, 12]], arms: [[-7, 37, -11, 32], [5, 37, 8, 32]] }
const AIM: Pose = { hip: 27, sho: 45, lean: 1, head: [2, 48.5], legs: [[-5, 14, -7, 0.5], [4, 14, 6, 0.5]], arms: [[-3, 37, 4, 38], [9, 41, 17, 42]], gun: true }
const AIM_CROUCH: Pose = { hip: 18, hipU: 1, sho: 34, lean: 3, head: [5, 38], legs: [[-7, 9, -7, 0.5], [7, 10, 6, 0.5]], arms: [[-1, 27, 6, 24], [9, 24, 17, 13]], gun: true }
const HOLD_GUN: Pose = { ...IDLE, arms: [[-4.5, 36, -4.5, 29.5], [6, 35, 10, 31]], gun: true }
const MANTLE_A: Pose = { hip: 30, sho: 50, lean: 3, head: [4, 54], legs: [[-2, 16, -3, 4], [3, 18, 4, 6]], arms: [[1, 60, 6, 70], [5, 60, 10, 70]] }
const MANTLE_B: Pose = { hip: 24, sho: 42, lean: 8, head: [10, 45], legs: [[-4, 14, -9, 4], [10, 20, 8, 8]], arms: [[8, 34, 12, 28], [12, 34, 16, 28]] }
const SWIM_A: Pose = { hip: 26, sho: 44, lean: 2, head: [3, 49], legs: [[-6, 14, -10, 4], [6, 16, 10, 8]], arms: [[-10, 44, -18, 48], [10, 44, 18, 48]] }
const SWIM_B: Pose = { hip: 26, sho: 44, lean: 2, head: [3, 49], legs: [[-3, 12, -6, 2], [4, 18, 6, 11]], arms: [[-10, 38, -18, 34], [10, 38, 18, 34]] }
const DEAD: Pose = { hip: 4, hipU: 0, sho: 4, lean: -22, head: [-26, 5], legs: [[10, 5, 20, 2], [12, 3, 22, 1]], arms: [[-14, 2, -8, 1], [-12, 7, -4, 3]] }
const SLUMP: Pose = { hip: 12, hipU: -2, sho: 22, lean: -10, head: [-12, 22], legs: [[4, 12, 12, 0.5], [6, 8, 14, 0.5]], arms: [[-10, 14, -6, 4], [-6, 16, 0, 6]] }

// Guard and friend poses.
const POINT: Pose = { ...IDLE, arms: [[-4.5, 36, -4.5, 29.5], [10, 46, 20, 52]] }
const CRANK_A: Pose = { ...IDLE, arms: [[4, 44, 10, 52], [8, 46, 14, 54]] }
const CRANK_B: Pose = { ...IDLE, arms: [[4, 44, 12, 46], [8, 46, 16, 48]] }
const CARRY: Pose = { hip: 27, sho: 44, lean: 3, head: [4, 48], legs: [[-4, 14, -6, 0.5], [4, 14, 6, 0.5]], arms: [[6, 36, 14, 38], [8, 36, 16, 38]] }
const GUARD_DIE: Pose = { hip: 24, sho: 40, lean: -10, head: [-8, 44], legs: [[-3, 12, -6, 0.5], [6, 14, 10, 2]], arms: [[-10, 38, -16, 46], [-4, 38, -10, 48]] }

export interface Rig {
  x: number
  y: number
  facing: number
  scale: number
  legBack: string
  legFront: string
  torso: string
  sleeve: string
  fore: string
  hand: string
  head: string
  hair: string | null
  /** the glow on the torso (the pilot's ship colour), null for none */
  torsoGlow: string | null
  /** eyes: colour and whether they glow */
  eye: string | null
  /** bald heads are longer (guards, the friend) */
  longHead?: boolean
  gunTip?: string
}

export function drawRig(ctx: CanvasRenderingContext2D, v: View, rig: Rig, pose: Pose, breath = 0): void {
  const s = v.s * rig.scale
  const f = rig.facing < 0 ? -1 : 1
  const U = (u: number): number => v.X(rig.x) + u * f * s
  const V = (vv: number): number => v.Y(rig.y) - vv * s
  const P = (u: number, vv: number): Pt => [U(u), V(vv)]
  const hipU = pose.hipU ?? 0
  const hip = pose.hip
  const sho = pose.sho + breath
  const shoU = hipU + pose.lean * 0.6
  const thigh = 4 * s
  const shin = 3 * s
  const upper = 3 * s
  const fore = 2.4 * s

  const leg = (l: Leg, color: string) => {
    const hipPt = P(hipU, hip)
    const knee = P(l[0], l[1])
    const foot = P(l[2], Math.max(0.5, l[3]))
    bar(ctx, hipPt, knee, thigh, color)
    bar(ctx, knee, foot, shin, color)
    rect(ctx, knee[0] - thigh / 2, knee[1] - thigh / 2, thigh, thigh, color)
    const fy = Math.max(0.5, l[3])
    poly(ctx, [P(l[2] - 2, fy), P(l[2] + 4, fy), P(l[2] + 4, fy + 2.5), P(l[2] - 2, fy + 2.5)], rig.legBack)
  }
  const arm = (a: Arm, front: boolean) => {
    const shoPt = P(shoU, sho - 1)
    const elbow = P(a[0], a[1] + breath)
    const hand = P(a[2], a[3] + breath)
    bar(ctx, shoPt, elbow, upper, rig.sleeve)
    bar(ctx, elbow, hand, fore, rig.fore)
    const hr = 2.2 * s
    rect(ctx, hand[0] - hr / 2, hand[1] - hr / 2, hr, hr, rig.hand)
    if (front && pose.gun) {
      // The gun: a short dark block, the muzzle in the owner's ink.
      const tip = P(a[2] + 6, a[3] + breath + 0.5)
      bar(ctx, [hand[0], hand[1] - 0.8 * s], tip, 2.6 * s, '#05030d')
      if (rig.gunTip) rect(ctx, tip[0] - 1 * s, tip[1] - 1.2 * s, 2 * s, 2 * s, rig.gunTip)
    }
  }

  leg(pose.legs[0], rig.legBack)
  arm(pose.arms[0], false)
  const torso: Pt[] = [P(hipU - 3, hip), P(hipU + 3, hip), P(shoU + 4.5, sho), P(shoU - 4, sho)]
  if (rig.torsoGlow) glow(ctx, rig.torsoGlow, 10 * rig.scale, () => poly(ctx, torso, rig.torso), v.cheap)
  else poly(ctx, torso, rig.torso)
  rect(ctx, U(shoU + (f < 0 ? 1 : -1)) - (f < 0 ? 2 * s : 0), V(sho + 1.5), 2 * s, 2 * s, rig.head)
  const hx = pose.head[0]
  const hy = pose.head[1] + breath
  const top = rig.longHead ? 5.5 : 3.5
  poly(ctx, [
    P(hx - 3, hy - 3.5), P(hx - 3, hy + 2), P(hx - 1, hy + top), P(hx + 2, hy + top),
    P(hx + 3.5, hy + 1), P(hx + 3, hy - 2), P(hx + 1, hy - 3.5),
  ], rig.head)
  if (rig.hair) poly(ctx, [P(hx - 3.2, hy + 0.5), P(hx - 3, hy + 2.5), P(hx - 1, hy + 3.7), P(hx + 2.2, hy + 3.7), P(hx + 1, hy + 1.5), P(hx - 1.5, hy + 1)], rig.hair)
  if (rig.eye) {
    const e = P(hx + 1.6, hy + 0.6)
    glow(ctx, rig.eye, 6, () => rect(ctx, e[0] - (f < 0 ? 2.2 * s : 0), e[1] - 0.6 * s, 2.2 * s, 1.2 * s, rig.eye!), v.cheap)
  }
  arm(pose.arms[1], true)
  leg(pose.legs[1], rig.legFront)
}

// ---- the pilot ----

export interface PilotLook {
  /** the Hangar ship's hull colour: the suit's stripe, the shots, the shield */
  accent: string
}

function pilotRig(sc: Scene, x: number, y: number, facing: number, look: PilotLook): Rig {
  const pal = sc.pal
  return {
    x, y, facing, scale: 1,
    legBack: pal[SUIT], legFront: pal[SUIT + L], torso: look.accent, sleeve: look.accent,
    fore: pal[SUIT + L], hand: pal[SKIN], head: pal[SKIN], hair: pal[NEAR], torsoGlow: look.accent,
    eye: null, gunTip: look.accent,
  }
}

export function pilotPose(world: World): Pose | null {
  const p = world.player
  const t = world.time
  if (world.dying) {
    const c = world.dying.cause
    if (c === 'fall') return FALL
    if (c === 'tide' || c === 'tentacles') return world.dying.t < 0.15 ? SWIM_A : null
    if (c === 'beast') return world.dying.t < 0.12 ? FALL : null
    if (c === 'bolt') return world.dying.t < 0.18 ? GUARD_DIE : DEAD
    if (c === 'leech') return world.dying.t < 0.3 ? CROUCH : SLUMP
    return CROUCH
  }
  if (p.mantle) return p.mantle.t < 0.18 ? MANTLE_A : MANTLE_B
  if (p.swimming) return Math.floor(t * 3) % 2 ? SWIM_A : SWIM_B
  if (p.landT > 0) return CROUCH
  if (p.kickT > 0) return p.kickT > KICK_TIME * 0.75 ? KICK_WIND : KICK
  if (p.hasGun && p.grounded && (p.holdT > TAP_HOLD * 0.4 || p.shotT > 0)) return p.crouching ? AIM_CROUCH : AIM
  if (p.crouching) return p.hasGun ? AIM_CROUCH : CROUCH
  if (!p.grounded) {
    if (p.hop) return p.vy < 0 ? HOP : FALL
    if (Math.abs(p.vx) > 100) return JUMP
    return p.vy < 0 ? HOP : FALL
  }
  if (Math.abs(p.vx) > 30) return RUN[Math.floor(p.stride / 18) % 6]
  return p.hasGun ? HOLD_GUN : IDLE
}

export function drawPilot(ctx: CanvasRenderingContext2D, v: View, sc: Scene, world: World, look: PilotLook): void {
  const pose = pilotPose(world)
  if (!pose) return
  const p = world.player
  const breath = pose === IDLE && !world.dying && world.time % 3 > 0.9 && world.time % 3 < 1.9 ? 1 : 0
  drawRig(ctx, v, pilotRig(sc, p.x, p.y, p.facing, look), pose, breath)
  // Charging: a light at the muzzle that grows, and turns white when the beam is ready.
  if (p.hasGun && p.holdT > TAP_HOLD && !world.dying) {
    const u = clamp((p.holdT - TAP_HOLD) / (BEAM_HOLD - TAP_HOLD), 0, 1)
    const f = p.facing < 0 ? -1 : 1
    const muzzleV = pose === AIM_CROUCH ? 13.5 : 42.5
    const mx = v.X(p.x) + (pose === AIM_CROUCH ? 24 : 23) * f * v.s
    const my = v.Y(p.y) - muzzleV * v.s
    const r = (1.5 + u * 4) * v.s
    const c = u >= 1 ? '#ffffff' : look.accent
    glow(ctx, look.accent, 8 + u * 14, () => disc(ctx, mx, my, r, c, 10), v.cheap)
  }
}

/** The pilot standing, lying or carried in a cut: position and pose given. */
export function drawPilotAt(ctx: CanvasRenderingContext2D, v: View, sc: Scene, x: number, y: number, facing: number, look: PilotLook, pose: 'idle' | 'dead' | 'slump' | 'swim' | 'fall' | 'run', frame = 0): void {
  const map = { idle: IDLE, dead: DEAD, slump: SLUMP, swim: frame % 2 ? SWIM_A : SWIM_B, fall: FALL, run: RUN[frame % 6] }
  drawRig(ctx, v, pilotRig(sc, x, y, facing, look), map[pose])
}

// ---- guards ----

export function drawGuard(ctx: CanvasRenderingContext2D, v: View, sc: Scene, g: Guard, time: number): void {
  const pal = sc.pal
  let pose: Pose = { ...IDLE, gun: true, arms: [[-4.5, 36, -4.5, 29.5], [6, 35, 10, 31]] }
  if (g.state === 'dead') pose = DEAD
  else if (g.state === 'dying') pose = g.t < 0.3 ? GUARD_DIE : SLUMP
  else if (g.state === 'walk') pose = { ...RUN[Math.floor(time * 8) % 6], lean: 1, gun: true }
  else if (g.state === 'alert') pose = g.crouch ? AIM_CROUCH : AIM
  else if (g.state === 'idle' && g.range === 0) pose = { ...IDLE, head: [2, 50], arms: [[-4.5, 36, -4.5, 29.5], [8, 42, 12, 50]], gun: false }
  drawRig(ctx, v, {
    x: g.x, y: g.y, facing: g.facing, scale: 66 / 52,
    legBack: '#05030d', legFront: pal[NEAR + L], torso: pal[MID + L], sleeve: '#05030d',
    fore: pal[NEAR + L], hand: pal[FAR + L], head: pal[FAR + L], hair: null, torsoGlow: null,
    eye: g.state === 'dead' || g.state === 'dying' ? null : PINK, longHead: true, gunTip: PINK,
  }, pose)
}

// ---- the friend ----

export function drawBuddy(ctx: CanvasRenderingContext2D, v: View, sc: Scene, b: Buddy, time: number): void {
  if (b.state === 'hidden' || b.state === 'gone') return
  const pal = sc.pal
  let pose: Pose = IDLE
  if (b.state === 'point') pose = POINT
  else if (b.state === 'run') pose = RUN[Math.floor(time * 10) % 6]
  else if (b.state === 'crank') pose = Math.floor(time * 2.5) % 2 ? CRANK_A : CRANK_B
  else if (b.state === 'carry') pose = CARRY
  drawRig(ctx, v, {
    x: b.x, y: b.y, facing: b.facing, scale: 1.36,
    legBack: pal[FAR], legFront: pal[FAR + L], torso: pal[MID + L], sleeve: pal[FAR],
    fore: pal[FAR + L], hand: pal[FAR + L], head: pal[FAR + L], hair: null, torsoGlow: null,
    eye: CYAN, longHead: true,
  }, pose)
}

export function drawBuddyAt(ctx: CanvasRenderingContext2D, v: View, sc: Scene, x: number, y: number, facing: number, state: Buddy['state'], time: number): void {
  drawBuddy(ctx, v, sc, { kind: 'buddy', id: 0, x, y, facing, state, goalX: x, t: 0 }, time)
}

// ---- the beast ----

/** A long black cat of a thing, four gallop frames; `air` for the leap. */
export function drawBeastAt(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, facing: number, frame: number, air = false, dead = false): void {
  const s = v.s
  const f = facing < 0 ? -1 : 1
  const X = (u: number) => v.X(x) + u * f * s
  const Y = (vv: number) => v.Y(y) - vv * s
  const ink = '#05030d'
  const k = frame % 4
  const stretch = air ? 1.12 : [1, 1.08, 0.94, 1.02][k]
  const lift = air ? 6 : [0, 4, 2, 5][k]
  if (dead) {
    poly(ctx, [[X(-40), Y(2)], [X(-30), Y(14)], [X(10), Y(16)], [X(36), Y(8)], [X(40), Y(2)]], ink)
    return
  }
  // Body.
  const b = (u: number) => u * stretch
  poly(ctx, [
    [X(b(-44)), Y(24 + lift)], [X(b(-36)), Y(38 + lift)], [X(b(-6)), Y(44 + lift)], [X(b(24)), Y(42 + lift)],
    [X(b(38)), Y(34 + lift)], [X(b(40)), Y(22 + lift)], [X(b(20)), Y(18 + lift)], [X(b(-30)), Y(18 + lift)],
  ], ink)
  // Head, low and forward, jaw open on the leap.
  const hx = b(38)
  poly(ctx, [[X(hx - 4), Y(38 + lift)], [X(hx + 10), Y(42 + lift)], [X(hx + 22), Y(34 + lift)], [X(hx + 18), Y(28 + lift)], [X(hx + 2), Y(24 + lift)]], ink)
  if (air) poly(ctx, [[X(hx + 18), Y(28 + lift)], [X(hx + 24), Y(22 + lift)], [X(hx + 8), Y(26 + lift)]], ink)
  glow(ctx, PINK, 8, () => rect(ctx, X(hx + 12) - (f < 0 ? 2.5 * s : 0), Y(37 + lift), 2.5 * s, 1.6 * s, PINK), v.cheap)
  // Tail.
  bar(ctx, [X(b(-42)), Y(32 + lift)], [X(b(-62)), Y(40 + lift + (k % 2) * 4)], 3 * s, ink)
  // Legs: bars, reaching and gathering by frame.
  const legs: Array<[number, number, number]> = air
    ? [[-30, -52, 18], [-24, -44, 16], [24, 46, 26], [30, 54, 24]]
    : [
        [[-30, -48, 0], [-26, -18, 0], [22, 36, 0], [28, 10, 0]],
        [[-30, -40, 4], [-26, -30, 0], [22, 44, 2], [28, 30, 0]],
        [[-30, -22, 0], [-26, -34, 6], [22, 20, 0], [28, 40, 4]],
        [[-30, -12, 0], [-26, -40, 2], [22, 8, 0], [28, 48, 2]],
      ][k].map(([a, bb, c]) => [a, bb, c] as [number, number, number])
  for (const [hipU, footU, footV] of legs) {
    const knee: Pt = [X((b(hipU) + footU) / 2), Y(10 + lift + footV / 2)]
    bar(ctx, [X(b(hipU)), Y(22 + lift)], knee, 5 * s, ink)
    bar(ctx, knee, [X(footU), Y(footV + (air ? lift : 0))], 3.5 * s, ink)
  }
}

export function drawBeast(ctx: CanvasRenderingContext2D, v: View, world: World, b: Beast): void {
  if (b.state === 'hidden' || b.state === 'gone') return
  const p = world.player
  let x = b.x
  let y = b.y
  let air = false
  // It runs on the ground line; over a gap it is in the air.
  const onGround = world.platforms.some(pl => x >= pl.x - 10 && x <= pl.x + pl.w + 10 && Math.abs(pl.y - b.y) < 120 && pl.y <= b.y + 1)
  const ledge = world.platforms.find(pl => x >= pl.x && x <= pl.x + pl.w && pl.y < b.y && pl.y > b.y - 100)
  if (ledge) y = ledge.y
  if (!onGround) {
    air = true
    y = b.y - 40
  }
  if (b.state === 'pounce') {
    const u = clamp(b.t / 0.35, 0, 1)
    x = b.x + (p.x - b.x) * u
    y = p.y - Math.sin(u * Math.PI) * 50
    air = u < 1
  }
  drawBeastAt(ctx, v, x, y, 1, Math.floor(b.t * 11), air)
}

// ---- leeches ----

export function drawLeech(ctx: CanvasRenderingContext2D, v: View, a: Leech, time: number): void {
  const s = v.s
  const ink = '#05030d'
  if (a.state === 'dead') {
    // Kicked away: an arc, then gone.
    const x = v.X(a.x + a.dir * -1 * a.t * 140)
    const y = v.Y(a.y - 40 * Math.sin(Math.min(1, a.t * 2.2) * Math.PI) + a.t * a.t * 200)
    rect(ctx, x - 4 * s, y - 6 * s, 8 * s, 4 * s, ink)
    return
  }
  const x = v.X(a.x)
  const y = v.Y(a.y)
  if (x < -30 || x > v.width + 30) return
  if (a.state === 'hang' || a.state === 'drop') {
    const sway = a.state === 'hang' ? Math.sin(time * 2 + a.id) * 2 * s : 0
    poly(ctx, [[x - 2.5 * s, y], [x + 2.5 * s, y], [x + 3 * s + sway, y + 12 * s], [x + sway, y + 15 * s], [x - 3 * s + sway, y + 12 * s]], ink)
    glow(ctx, PINK, 6, () => rect(ctx, x - 1.2 * s + sway, y + 13 * s, 2.4 * s, 2.4 * s, PINK), v.cheap)
    return
  }
  // Crawling: a hump that travels along the body.
  const f = a.dir < 0 ? -1 : 1
  const ph = (time * 3 + a.id) % 1
  const hump = Math.sin(ph * Math.PI) * 3 * s
  const pts: Pt[] = [
    [x - 8 * f * s, y], [x - 7 * f * s, y - 3 * s], [x - 2 * f * s, y - 4 * s - hump],
    [x + 4 * f * s, y - 4 * s], [x + 8 * f * s, y - 2 * s], [x + 9 * f * s, y],
  ]
  poly(ctx, pts, ink)
  glow(ctx, PINK, 6, () => rect(ctx, x + (f > 0 ? 6.5 : -9) * s, y - 3 * s, 2.5 * s, 2 * s, PINK), v.cheap)
}

// ---- the pool's tentacles ----

export function drawTentacles(ctx: CanvasRenderingContext2D, v: View, sc: Scene, hz: TentacleHazard, time: number): void {
  if (hz.tip >= hz.floor - 2) return
  const s = v.s
  const n = 4
  for (let i = 0; i < n; i++) {
    const baseX = hz.x + hz.w * (0.18 + i * 0.22)
    const len = hz.floor - hz.tip - i * 12
    if (len < 6) continue
    const segs = 8
    let prev: Pt = [v.X(baseX), v.Y(hz.floor)]
    for (let j = 1; j <= segs; j++) {
      const u = j / segs
      const sway = Math.sin(time * 2.4 + i * 1.7 + u * 3.2) * 14 * u
      const pt: Pt = [v.X(baseX + sway), v.Y(hz.floor - len * u)]
      bar(ctx, prev, pt, (7 - u * 4.5) * s, j % 2 ? sc.pal[FAR + L] : sc.pal[MID + L])
      prev = pt
    }
    glow(ctx, PINK, 10, () => disc(ctx, prev[0], prev[1], 2.6 * s, PINK, 8), v.cheap)
  }
}

// ---- machines and wrecks ----

/** The pilot's ship, flat: a delta in the hull colour; `tilt` in radians. */
export function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tilt: number, hull: string, trim: string, glowing: boolean, cheap: boolean): void {
  const c = Math.cos(tilt)
  const sn = Math.sin(tilt)
  const P = (u: number, vv: number): Pt => [x + (u * c - vv * sn) * size, y + (u * sn + vv * c) * size]
  const body: Pt[] = [P(1.1, 0), P(-0.7, -0.55), P(-0.45, 0), P(-0.7, 0.55)]
  const draw = () => {
    poly(ctx, body, hull)
    poly(ctx, [P(0.55, 0), P(0.05, -0.12), P(0.05, 0.12)], '#ffffff')
    bar(ctx, P(-0.7, -0.55), P(-0.2, -0.25), size * 0.08, trim)
    bar(ctx, P(-0.7, 0.55), P(-0.2, 0.25), size * 0.08, trim)
  }
  if (glowing) glow(ctx, hull, 18, draw, cheap)
  else draw()
}

export function drawWreck(ctx: CanvasRenderingContext2D, v: View, sc: Scene, x: number, y: number, hull: string, time: number): void {
  const s = v.s
  const sx = v.X(x)
  const sy = v.Y(y) - 14 * s
  if (sx < -100 || sx > v.width + 100) return
  // Half buried, nose down, a dying light in the cockpit.
  drawShip(ctx, sx, sy, 42 * s, 0.35, sc.pal[MID + L], sc.pal[FAR + L], false, true)
  if (Math.floor(time * 1.3) % 3 !== 0) glow(ctx, hull, 10, () => rect(ctx, sx + 10 * s, sy + 2 * s, 3 * s, 3 * s, hull), v.cheap)
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.6 + i * 0.37) % 1
    const bx = sx + (8 + i * 6) * s + Math.sin(t * 9 + i) * 3 * s
    const by = sy - t * 180 * s
    rect(ctx, bx, by, 2.5 * s, 2.5 * s, sc.pal[MID + L])
  }
}

/** The winged creature of the ending: slow wingbeats, a gold eye. */
export function drawWinged(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, size: number, time: number, facing = 1): void {
  const s = v.s * size
  const f = facing
  const X = (u: number) => v.X(x) + u * f * s
  const Y = (vv: number) => v.Y(y) - vv * s
  const ink = '#05030d'
  const beat = Math.sin(time * 3.2)
  const tipV = 40 * beat
  poly(ctx, [[X(-60), Y(6)], [X(-20), Y(16)], [X(30), Y(18)], [X(60), Y(10)], [X(40), Y(2)], [X(-10), Y(0)]], ink)
  poly(ctx, [[X(50), Y(16)], [X(78), Y(24)], [X(84), Y(18)], [X(62), Y(8)]], ink)
  poly(ctx, [[X(-10), Y(14)], [X(20), Y(16)], [X(-4), Y(30 + tipV)], [X(-50), Y(40 + tipV * 1.4)], [X(-30), Y(24 + tipV * 0.5)]], ink)
  poly(ctx, [[X(-80), Y(8)], [X(-60), Y(6)], [X(-66), Y(0)]], ink)
  glow(ctx, GOLD, 8, () => rect(ctx, X(74) - (f < 0 ? 2.5 * s : 0), Y(21), 2.5 * s, 2 * s, GOLD), v.cheap)
}
