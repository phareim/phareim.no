/**
 * Space Voyagers' autopilot: it looks at the world and gives back the input
 * a player would. It is how the tests play the game and how the lab takes
 * its pictures; it is not in the game.
 *
 * Each tick it picks a place it would like to be (under a target, on a
 * pick-up, beside the stalled ship), lists what could hurt in the next
 * second or so (shots, lines about to fire, lit patches, bodies), and flies
 * to the candidate spot nearest its goal that it can reach without being hit.
 * It sees only what a player sees: positions, velocities and warnings.
 */
import { PICKUP, PLAYER, RESCUE, WEAPONS } from './balance.ts'
import type { Input, World } from './types.ts'
import { reach } from './weapons.ts'
import { playerTop } from './world.ts'

const MAX = 256
const HORIZON = 120
const STEP = 2

export interface AutopilotOptions {
  /** Hold fire (a dodging test). */
  holdFire?: boolean
  /** Never press DUET. */
  noDuet?: boolean
  /** Keep to the bottom of the field: no pick-ups, no rescue, no targets. */
  dodgeOnly?: boolean
  /** Extra clearance kept from anything that hurts, in pixels. */
  margin?: number
  /** Ticks between two looks at the field; a person manages about four a second (15). 1: every tick. */
  every?: number
  /** How far ahead it reads the field, in ticks (at most 120). */
  sight?: number
}

/** A stand-in for a casual player: looks five times a second, reads less far ahead, cuts it finer. */
export const CASUAL: AutopilotOptions = { every: 12, sight: 48, margin: 2 }
/** A worse one still: three looks a second, half a second of foresight, no margin. */
export const CLUMSY: AutopilotOptions = { every: 20, sight: 30, margin: 0 }

export interface Autopilot {
  input: Input
  opts: AutopilotOptions
  /** Threats: circles (kind 0) and boxes (kind 1), flat. */
  n: number
  kind: Uint8Array
  x: Float64Array
  y: Float64Array
  vx: Float64Array
  vy: Float64Array
  /** A circle's radius and how it grows; a box's size. */
  a: Float64Array
  b: Float64Array
  /** When it starts to hurt and when it stops, in ticks from now. */
  t0: Float64Array
  t1: Float64Array
  /** A mine stops moving after this many ticks. */
  stop: Float64Array
}

export function createAutopilot(opts: AutopilotOptions = {}): Autopilot {
  const f = (): Float64Array => new Float64Array(MAX)
  return {
    input: { dx: 0, dy: 0, hasTarget: true, tx: 0, ty: 0, fire: true, duet: false },
    opts, n: 0, kind: new Uint8Array(MAX), x: f(), y: f(), vx: f(), vy: f(), a: f(), b: f(), t0: f(), t1: f(), stop: f(),
  }
}

function circle(ap: Autopilot, x: number, y: number, vx: number, vy: number, r: number, grow: number, t0: number, t1: number, stop = 1e9): void {
  const i = ap.n
  if (i >= MAX) return
  ap.kind[i] = 0; ap.x[i] = x; ap.y[i] = y; ap.vx[i] = vx; ap.vy[i] = vy; ap.a[i] = r; ap.b[i] = grow
  ap.t0[i] = t0; ap.t1[i] = t1; ap.stop[i] = stop
  ap.n = i + 1
}

function box(ap: Autopilot, x: number, y: number, bw: number, bh: number, vx: number, vy: number, t0: number, t1: number): void {
  const i = ap.n
  if (i >= MAX) return
  ap.kind[i] = 1; ap.x[i] = x; ap.y[i] = y; ap.vx[i] = vx; ap.vy[i] = vy; ap.a[i] = bw; ap.b[i] = bh; ap.t0[i] = t0; ap.t1[i] = t1
  ap.n = i + 1
}

/** List everything that could hurt the player within the horizon. */
function look(ap: Autopilot, w: World): void {
  const p = w.player
  const dt = w.slow > 0 ? PICKUP.trackingSlow : 1
  ap.n = 0
  for (let i = 0; i < w.bolts.length; i++) {
    const s = w.bolts[i]!
    if (!s.active) continue
    if (s.frozen > 0) { circle(ap, s.x, s.y, 0, 0, s.r, 0, 0, s.frozen); continue }
    if (s.y > p.y + 40 && s.vy >= 0) continue
    circle(ap, s.x, s.y, s.vx * dt, s.vy * dt, s.r, 0, 0, s.life / dt, s.kind === 'mine' && s.stopAt > 0 && s.vy > 0 ? (s.stopAt - s.y) / (s.vy * dt) : 1e9)
  }
  for (let i = 0; i < w.aims.length; i++) {
    const a = w.aims[i]!
    if (!a.active) continue
    const dx = a.tx - a.x
    const dy = a.ty - a.y
    const d = Math.hypot(dx, dy) || 1
    const sp = a.speed * dt
    // The shot that will go along the line: it starts when the warning ends.
    const lead = a.warn / dt
    const r = a.kind === 'diver' ? 12 : 3
    for (let k = 0; k <= a.burst; k++) {
      const t0 = lead + k * 9 / dt
      circle(ap, a.x - dx / d * sp * t0, a.y - dy / d * sp * t0, dx / d * sp, dy / d * sp, r, 0, t0, 1e9)
    }
  }
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.active || e.bonus || e.state === 'wait') continue
    if (e.y < p.y - 170 && e.y - e.py < 1) continue
    const vx = e.frozen > 0 ? 0 : e.x - e.px
    const vy = e.frozen > 0 ? 0 : e.y - e.py
    // Bodies fly curves: trusted for a little while, and less the further ahead.
    circle(ap, e.x, e.y, vx, vy, Math.max(e.hw, e.hh) + 1, 0.18, 0, 44)
    // A captor's beam and a tank's stop are harmless to the cockpit; a diver's line is in the aims.
  }
  for (let i = 0; i < w.zones.length; i++) {
    const z = w.zones[i]!
    if (!z.active) continue
    box(ap, z.x, z.y, z.w, z.h, z.vx * dt, z.vy * dt, z.warn / dt, (z.warn + z.live) / dt)
  }
}

/** Fly from (x, y) toward (gx, gy): the first tick something hits, or HORIZON + 1. */
function firstHit(ap: Autopilot, x: number, y: number, gx: number, gy: number, margin: number): number {
  const pr = PLAYER.hitR + margin
  const sight = Math.min(HORIZON, ap.opts.sight ?? HORIZON)
  // Every tick at first, where a graze is decided, then every other.
  for (let t = 1, dt = 1; t <= sight; t += dt) {
    dt = t < 8 ? 1 : STEP
    const sp = PLAYER.speed * (t <= 8 ? 1 : STEP)
    const dx = gx - x
    const dy = gy - y
    const d = Math.hypot(dx, dy)
    if (d <= sp) { x = gx; y = gy } else { x += dx / d * sp; y += dy / d * sp }
    for (let i = 0; i < ap.n; i++) {
      if (t < ap.t0[i]! || t > ap.t1[i]!) continue
      if (ap.kind[i] === 0) {
        const tm = Math.min(t, ap.stop[i]!)
        const cx = ap.x[i]! + ap.vx[i]! * tm
        const cy = ap.y[i]! + ap.vy[i]! * tm
        const r = ap.a[i]! + ap.b[i]! * t + pr
        if ((cx - x) * (cx - x) + (cy - y) * (cy - y) < r * r) return t
      } else {
        const tt = t - ap.t0[i]!
        const bx = ap.x[i]! + ap.vx[i]! * tt
        const by = ap.y[i]! + ap.vy[i]! * tt
        if (x > bx - pr && x < bx + ap.a[i]! + pr && y > by - pr && y < by + ap.b[i]! + pr) return t
      }
    }
  }
  return HORIZON + 1
}

/** Where it would like to be, with nothing in the way. Writes ap.input.tx / ty. */
function goal(ap: Autopilot, w: World): void {
  const p = w.player
  const top = playerTop(w)
  const bottom = w.h - PLAYER.marginBottom
  const home = w.h - PLAYER.startFromBottom
  let gx = w.w / 2
  let gy = home
  const out = ap.input
  if (ap.opts.dodgeOnly) { out.tx = p.x; out.ty = home; return }

  // Something to shoot: the boss's weak spot, or the enemy that most needs it.
  let found = false
  let ty = 0
  const boss = w.boss
  if (boss.active && boss.state !== 'dying') {
    gx = boss.x + boss.wx
    ty = boss.y + boss.wy
    found = true
    const d = w.barriers[0]!
    if (d.active && d.shut > 0.5 && Math.abs(gx - d.gapX) > d.gapW / 2 - 4) gx = d.gapX
  }
  let best = found ? 40 : 1e9
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.active || e.state === 'wait' || e.y < 4 || e.y > p.y - 10) continue
    let cost = Math.abs(e.x - p.x) - e.y * 0.25
    if (e.state === 'latch') cost -= 260
    else if (e.role === 'raider') cost -= 120
    else if (e.carrying && e.state !== 'form') cost -= 200
    // Its shield is up on the way down; once the beam warms it is the thing to shoot.
    else if (e.shield) cost += 400
    // Hanging under it in formation: better left until it dives (a dock), unless the wave is nearly done.
    else if (e.carrying && w.waveLeft > 3) cost += 300
    else if (e.role === 'captor' && e.state === 'hover') cost -= 160
    else if (e.state !== 'form') cost -= 30
    if (cost < best) {
      best = cost
      // Lead it by where it will be when a shot gets there.
      const lead = Math.max(-28, Math.min(28, (e.x - e.px) * (p.y - e.y) / WEAPONS[p.weapon].speed))
      gx = e.x + lead
      ty = e.y
      found = true
    }
  }
  // A short gun has to be carried up to its target.
  if (found && p.weapon === 'boombox') gy = Math.max(top, Math.min(home, ty + reach(p.weapon, p.level) * 0.8))

  // The stalled ship: clear the raiders, then hold beside it for the cables.
  const g = w.wing
  if (g.state === 'stalled' && w.latched === 0 && g.y + 30 > top) {
    gx = g.x
    gy = Math.max(top, Math.min(bottom, g.y + RESCUE.reach * 0.7))
  }

  // A pick-up worth the trip.
  let near = 110
  for (let i = 0; i < w.pickups.length; i++) {
    const k = w.pickups[i]!
    if (!k.active) continue
    if (k.id === 'boombox' && p.weapon !== 'boombox') continue
    const d = Math.abs(k.x - p.x) + Math.max(0, top - k.y) * 0.4
    if (d < near && k.y > top - 150) {
      near = d
      gx = k.x
      gy = Math.max(top, Math.min(bottom, k.y + 6))
    }
  }
  out.tx = Math.max(PLAYER.marginX, Math.min(w.w - PLAYER.marginX, gx))
  out.ty = gy
}

export function autopilot(ap: Autopilot, w: World): Input {
  const out = ap.input
  const p = w.player
  const margin = ap.opts.margin ?? 4
  const top = playerTop(w)
  const bottom = w.h - PLAYER.marginBottom
  out.hasTarget = true
  out.fire = !ap.opts.holdFire
  out.duet = !ap.opts.noDuet && w.duetMeter >= 1 && w.duet === 0
    && ((w.boss.active && w.boss.state === 'fight') || w.boltsOut >= 4 || w.waveLeft >= 8)
  // Between two looks it keeps flying to where it last decided to go.
  const every = ap.opts.every ?? 1
  if (every > 1 && w.tick % every !== 0) return out
  goal(ap, w)
  if (p.towing > 0 || p.invuln > 24) return out
  look(ap, w)
  if (ap.n === 0) return out

  const gx = out.tx
  const gy = out.ty
  const sight = Math.min(HORIZON, ap.opts.sight ?? HORIZON)
  let bestHit = firstHit(ap, p.x, p.y, gx, gy, margin)
  if (bestHit > sight) return out
  // The goal is not safe: try spots across the field. A spot that is safe for now beats one
  // that is not; among equals, the one nearest the goal. It looks again next tick.
  let bestScore = -1e9
  let bx = gx
  let by = gy
  for (let pass = 0; pass < 2; pass++) {
    const m = pass === 0 ? margin : 0
    bestHit = 0
    for (let yi = -1; yi <= 2; yi++) {
      const cy = Math.max(top, Math.min(bottom, yi === 2 ? gy : p.y + yi * 30))
      for (let cx = PLAYER.marginX; cx <= w.w - PLAYER.marginX; cx += 4) {
        const hit = firstHit(ap, p.x, p.y, cx, cy, m)
        let score = -Math.abs(cx - gx) - Math.abs(cy - gy) * 0.6
        if (hit <= sight) score -= 4000 * (1 - hit / (sight + 1)) ** 2 + 200
        if (score > bestScore) { bestScore = score; bx = cx; by = cy; bestHit = hit }
      }
    }
    // Nothing that lasts with the full margin: look again with none and take the least bad.
    if (bestHit > 20) break
    bestScore = -1e9
  }
  out.tx = bx
  out.ty = by
  return out
}
