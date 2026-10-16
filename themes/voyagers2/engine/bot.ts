/**
 * Space Voyagers II: a test pilot for the tuning table and the tests. It
 * flies like a person, not like the AI: it looks at the fight only every few
 * tenths of a second, its aim is off by a little, and the CLUMSY profile
 * steers with keys (full or nothing) the way a keyboard player does. Three
 * profiles, from a first-timer to a regular (DESIGN.md, "Tuning"). The bot
 * gives the same `Input` the page does; it reads the world but never changes
 * it.
 */
import { GUN, SHIPS } from './balance.ts'
import { attackersOf } from './ai.ts'
import { steerTo } from './flight.ts'
import { leadDir } from './guns.ts'
import { angleBetween, dist, forwardTo, normTo, subTo, v3 } from './math.ts'
import { makeRng, rand } from './rng.ts'
import type { Rng } from './rng.ts'
import { live, shipAt } from './ships.ts'
import type { Controls, Input } from './types.ts'
import { autoGoal, calzone, makeInput } from './world.ts'
import type { Voyage } from './world.ts'

export type BotProfile = 'clumsy' | 'casual' | 'sharp'

interface Profile {
  /** Ticks between looks. */
  look: number
  /** Aim error (radians, largest). */
  error: number
  /** Keys: steering is full or nothing. */
  keys: boolean
  /** Fires when the nose is this near the lead (radians). */
  trigger: number
  /** Jinks when hit from behind. */
  evades: boolean
  /** Uses missiles when locked. */
  missiles: boolean
  /** Takes the turret seat when something sits on the tail this long (ticks), 0 never. */
  swapsAfter: number
}

const DEG = Math.PI / 180
export const BOT_PROFILES: Record<BotProfile, Profile> = {
  clumsy: { look: 24, error: 2.2 * DEG, keys: true, trigger: 4 * DEG, evades: false, missiles: false, swapsAfter: 0 },
  casual: { look: 15, error: 1.1 * DEG, keys: false, trigger: 3 * DEG, evades: true, missiles: true, swapsAfter: 0 },
  sharp: { look: 9, error: 0.4 * DEG, keys: false, trigger: 3.5 * DEG, evades: true, missiles: true, swapsAfter: 0 },
}

export interface Bot {
  profile: Profile
  rng: Rng
  t: number
  err: { x: number; y: number; z: number }
  jink: number
  jinkDir: { x: number; y: number; z: number }
  held: Controls
  input: Input
  /** Ticks left of flying out from a big ship before turning in for the torpedo. */
  extend: number
}

export function createBot(profile: BotProfile, seed = 1): Bot {
  return {
    profile: BOT_PROFILES[profile], rng: makeRng(seed ^ 0xb07), t: 0, err: v3(), jink: 0, jinkDir: v3(),
    held: { pitch: 0, yaw: 0, roll: 0, burn: false, brake: false, fire: false, missile: false }, input: makeInput(), extend: 0,
  }
}

const LEAD = v3()
const FWD = v3()
const TMP = v3()

const quant = (v: number): number => (v > 0.12 ? 1 : v < -0.12 ? -1 : 0)

/**
 * A held key leans in like a stick pushed over: a quarter of a second from
 * nothing to full, straight back to nothing when it is let go. The page does
 * the same with the arrow keys (`Game.vue`), so short taps aim finely.
 */
export const KEY_RAMP = 1 / 15
export function keyRamp(now: number, key: number): number {
  if (key === 0) return 0
  if (Math.sign(now) !== key) now = 0
  return Math.max(-1, Math.min(1, now + key * KEY_RAMP))
}

/** What the bot presses this tick. */
export function botInput(b: Bot, w: Voyage): Input {
  const p = b.profile
  const inp = b.input
  inp.nextTarget = false; inp.attacker = false; inp.swap = false; inp.auto = false; inp.order = null; inp.pick = null
  inp.missile = false
  inp.touch = !p.keys
  b.t++
  const me = calzone(w)
  if (!live(me) || w.mission.stage !== 'fly') { inp.pitch = 0; inp.yaw = 0; inp.roll = 0; inp.fire = false; return inp }
  if (autoGoal(w) !== 'none') { inp.auto = true; inp.fire = false; return inp }
  const look = b.t % p.look === 0
  const o = shipAt(w, me.target)
  if (look) {
    // Under fire from behind: jink for a moment.
    const chaser = attackersOf(w, me, 900).find(a => {
      forwardTo(FWD, me.q); subTo(TMP, a.pos, me.pos); normTo(TMP, TMP)
      return angleBetween(FWD, TMP) > 2.2
    })
    if (p.evades && chaser && me.sinceHit < 30 && b.jink <= 0) {
      b.jink = 60 + Math.round(rand(b.rng) * 40)
      b.jinkDir.x = rand(b.rng) - 0.5; b.jinkDir.y = rand(b.rng) - 0.5; b.jinkDir.z = -0.3
    }
    // A new aim error each look.
    const m = p.error * rand(b.rng)
    const a = rand(b.rng) * Math.PI * 2
    b.err.x = Math.cos(a) * m; b.err.y = Math.sin(a) * m; b.err.z = 0
    // Nothing targeted that is near: ask for the next.
    if (!live(o) || dist(o.pos, me.pos) > 6000) inp.nextTarget = true
    // A bomber on the Deep Dish comes first (Mei says so in the briefing); then whatever the mission is for.
    if (!o || o.kind !== 'hound') {
      const hound = w.ships.find(s => live(s) && s.side === 'them' && s.kind === 'hound' && dist(s.pos, me.pos) < 7000)
      if (hound) inp.pick = hound.id
    }
  }
  const c = b.held
  if (b.jink > 0) {
    b.jink--
    forwardTo(FWD, me.q)
    TMP.x = FWD.x + b.jinkDir.x * 2; TMP.y = FWD.y + b.jinkDir.y * 2; TMP.z = FWD.z + b.jinkDir.z
    normTo(TMP, TMP)
    steerTo(c, me, TMP, 1)
    c.burn = me.fuel > 0.2
    c.fire = false
  } else if (live(o) && SHIPS[o.kind].capital && me.torps > 0 && (b.extend > 0 || dist(o.pos, me.pos) < 1300)) {
    // A torpedo run: too close to lock, so fly out to two kilometres and turn in again.
    if (b.extend <= 0) b.extend = 200
    b.extend--
    if (dist(o.pos, me.pos) > 2300) b.extend = 0
    subTo(TMP, me.pos, o.pos)
    normTo(TMP, TMP)
    steerTo(c, me, TMP, 0.5)
    c.burn = me.fuel > 0.4
    c.fire = false
    c.brake = false
  } else if (live(o)) {
    if (!leadDir(LEAD, me.pos, me, o, GUN.speed)) subTo(LEAD, o.pos, me.pos)
    LEAD.x += b.err.x; LEAD.y += b.err.y
    normTo(LEAD, LEAD)
    // A person's hand: keys are pressed or let go every few ticks, a stick follows the eye.
    if (!p.keys || b.t % 5 === 0) steerTo(c, me, LEAD, 0.4)
    forwardTo(FWD, me.q)
    const off = angleBetween(FWD, LEAD)
    const d = dist(o.pos, me.pos)
    c.burn = d > 2500 && me.fuel > 0.5
    // Brake to turn inside it when it is well off the nose and near (people learn this fast).
    c.brake = (d < 400 && off < 0.4 && me.speed > o.speed) || (off > 0.6 && d < 900)
    c.fire = off < p.trigger && d < 2000 && !SHIPS[o.kind].capital ? true : off < p.trigger && d < 1500
    if (p.missiles && me.lock >= 1 && look && me.missiles > 0 && SHIPS[o.kind].points >= 200) inp.missile = true
    // Everyone fires a torpedo when it has locked a big ship.
    if (me.torps > 0 && me.lock >= 1 && SHIPS[o.kind].capital) inp.missile = true
  } else {
    c.pitch = 0; c.yaw = 0; c.roll = 0; c.fire = false; c.burn = false; c.brake = false
  }
  inp.pitch = p.keys ? keyRamp(inp.pitch, quant(c.pitch)) : c.pitch
  inp.yaw = p.keys ? keyRamp(inp.yaw, quant(c.yaw)) : c.yaw
  inp.roll = p.keys ? keyRamp(inp.roll, quant(c.roll)) : c.roll
  inp.burn = c.burn
  inp.brake = c.brake
  inp.fire = c.fire
  return inp
}
