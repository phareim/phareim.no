/**
 * Space Voyagers II: the pilots who are not the player. One brain for every
 * fighter, ours and theirs, with modes (DESIGN.md, "Who you fight"):
 *
 *  - attack: chase the target's lead point, fire inside a cone that shrinks
 *    with skill, launch a missile when locked now and then;
 *  - break: after a pass (or when about to ram) turn away hard for a moment,
 *    then come round again. Attack and break together are the joust that
 *    makes Wing Commander's fights move;
 *  - evade: jink when something on its tail is hitting it;
 *  - flee: armour almost gone and no nerve left: run, and leave the fight;
 *  - form / escort: fly on a leader, or guard a ship and go for what comes near;
 *  - strike: a bomber's run on a big ship, torpedo at the end of it;
 *  - nav: fly to a point;
 *  - turret: the Calzone's own pilot while the player works the turret: keep the
 *    enemy behind, where the turret can reach it.
 *
 * Decisions are taken every `think` ticks (slower for worse pilots: that is
 * their reaction time); steering and the trigger run every tick.
 */
import { GUN, SHIPS, SPACE } from './balance.ts'
import { clearControls, steerTo } from './flight.ts'
import { fireGuns, leadDir } from './guns.ts'
import {
  addTo, angleBetween, copyTo, dist, distSq, dot, forwardTo, maddTo, normTo, rightTo, rotateTo, scaleTo, setTo, subTo,
  upTo, v3,
} from './math.ts'
import type { V3 } from './math.ts'
import { launchMissile } from './missiles.ts'
import { chance, rand, randRange } from './rng.ts'
import { live, shipAt, wholeness } from './ships.ts'
import type { Ai, AiMode, Controls, Ship, World } from './types.ts'

const DIR = v3()
const FWD = v3()
const TMP = v3()
const TMP2 = v3()
const LEAD = v3()

/** The range the AI fires its guns at. */
export const GUN_RANGE = GUN.speed * GUN.life * 0.8

export function setMode(ai: Ai, mode: AiMode): void {
  if (ai.mode !== mode) { ai.mode = mode; ai.t = 0 }
}

/** Reaction time in ticks: 0.15 s for an ace, 0.4 s for a rookie, a little chance on top. */
function reaction(w: World, ai: Ai): number {
  return Math.round(9 + (1 - ai.skill) * 15 + rand(w.rng) * 6)
}

/** The largest aim error a pilot of this skill makes (radians): 1.8 degrees for a rookie, 0.3 for an ace. */
export function aimError(ai: Ai): number {
  return (0.3 + (1 - ai.skill) * 1.5) * Math.PI / 180
}

function rollAimError(w: World, ai: Ai): void {
  const m = aimError(ai) * rand(w.rng)
  const a = rand(w.rng) * Math.PI * 2
  const b = Math.acos(2 * rand(w.rng) - 1)
  setTo(ai.err, Math.sin(b) * Math.cos(a) * m, Math.sin(b) * Math.sin(a) * m, Math.cos(b) * m)
}

/** Enemies of `s` near a point, nearest first (a small list, made fresh). */
export function enemiesNear(w: World, s: Ship, at: V3, range: number): Ship[] {
  const out: Ship[] = []
  const r2 = range * range
  for (const o of w.ships) {
    if (!live(o) || o.side === s.side) continue
    if (distSq(o.pos, at) <= r2) out.push(o)
  }
  out.sort((a, b) => distSq(a.pos, at) - distSq(b.pos, at))
  return out
}

/** Who is chasing `s`: enemies whose target it is, within range, nearest first. */
export function attackersOf(w: World, s: Ship, range = 2500): Ship[] {
  const out: Ship[] = []
  for (const o of w.ships) {
    if (!live(o) || o.side === s.side || o.target !== s.id) continue
    if (distSq(o.pos, s.pos) <= range * range) out.push(o)
  }
  out.sort((a, b) => distSq(a.pos, s.pos) - distSq(b.pos, s.pos))
  return out
}

/** Pick something for `s` to fight. Fighters before big ships, those near first, and whoever just hit it. */
export function chooseTarget(w: World, s: Ship, prefer = -1): number {
  const hitter = shipAt(w, s.lastHitBy)
  if (s.sinceHit < 90 && live(hitter) && hitter.side !== s.side && !SHIPS[hitter.kind].capital && s.ai && chance(w.rng, s.ai.nerve)) return hitter.id
  const p = shipAt(w, prefer)
  if (live(p) && p.side !== s.side) return p.id
  let best = -1, bestScore = Infinity
  for (const o of w.ships) {
    if (!live(o) || o.side === s.side) continue
    const big = SHIPS[o.kind].capital
    // Big ships are only chosen when nothing small is left (bombers go for them on purpose).
    const d = dist(o.pos, s.pos) + (big ? 20000 : 0) - (o.target === s.id ? 600 : 0)
    if (d < bestScore) { bestScore = d; best = o.id }
  }
  return best
}

/** The angle between `s`'s nose and the direction to `o` (radians). */
export function offNose(s: Ship, o: V3): number {
  forwardTo(FWD, s.q)
  subTo(TMP, o, s.pos)
  normTo(TMP, TMP)
  return angleBetween(FWD, TMP)
}

/** Fly towards a point. */
function steerToPoint(c: Controls, s: Ship, p: V3, bank = 0.5): void {
  subTo(DIR, p, s.pos)
  normTo(DIR, DIR)
  steerTo(c, s, DIR, bank)
}

/** A point `range` out from `s`, off to one side of the line to `away` and a little above or below. */
function breakPoint(w: World, s: Ship, away: V3, out: V3, range = 800): void {
  subTo(TMP, s.pos, away)
  normTo(TMP, TMP)
  rightTo(TMP2, s.q)
  const side = rand(w.rng) < 0.5 ? -1 : 1
  upTo(FWD, s.q)
  const lift = randRange(w.rng, -0.6, 0.6)
  out.x = s.pos.x + (TMP.x * 0.6 + TMP2.x * side + FWD.x * lift) * range
  out.y = s.pos.y + (TMP.y * 0.6 + TMP2.y * side + FWD.y * lift) * range
  out.z = s.pos.z + (TMP.z * 0.6 + TMP2.z * side + FWD.z * lift) * range
}

/** The jink: a fresh direction somewhere ahead and well to the side. */
function jinkPoint(w: World, s: Ship, out: V3): void {
  forwardTo(FWD, s.q)
  rightTo(TMP, s.q)
  upTo(TMP2, s.q)
  const a = randRange(w.rng, 0, Math.PI * 2)
  const sx = Math.cos(a), sy = Math.sin(a)
  out.x = s.pos.x + (FWD.x * 0.5 + TMP.x * sx + TMP2.x * sy) * 1000
  out.y = s.pos.y + (FWD.y * 0.5 + TMP.y * sx + TMP2.y * sy) * 1000
  out.z = s.pos.z + (FWD.z * 0.5 + TMP.z * sx + TMP2.z * sy) * 1000
}

/** Is someone of the other side on `s`'s tail, close, and hitting it? */
function hunted(w: World, s: Ship): Ship | null {
  if (s.sinceHit > 40) return null
  const o = shipAt(w, s.lastHitBy)
  if (!live(o) || o.side === s.side) return null
  if (dist(o.pos, s.pos) > 1100) return null
  // Behind: more than 110 degrees off the nose.
  return offNose(s, o.pos) > 1.9 ? o : null
}

/** Decide, now and then: which mode, which target. */
function think(w: World, s: Ship, ai: Ai): void {
  const k = SHIPS[s.kind]
  // Wrecked and losing heart: run.
  if (ai.mode !== 'flee' && s.side === 'them' && wholeness(s) < 0.3 && rand(w.rng) > ai.nerve + 0.25) {
    setMode(ai, 'flee')
    w.events.push({ type: 'cue', cue: 'enemyFlees', a: s.id })
    return
  }
  if (ai.mode === 'flee' || ai.mode === 'idle' || ai.mode === 'turret') return
  // Under fire from behind: jink.
  if (ai.mode !== 'evade' && hunted(w, s) && rand(w.rng) < 0.35 + (1 - ai.nerve) * 0.4) {
    setMode(ai, 'evade')
    jinkPoint(w, s, ai.aim)
    return
  }
  if (ai.mode === 'form' || ai.mode === 'escort') {
    // Wingmen: told to form up, they hold; otherwise they go for whatever comes near.
    const lead = shipAt(w, ai.leader)
    const guard = live(lead) ? lead : s
    const near = enemiesNear(w, s, guard.pos, ai.mode === 'escort' ? 2600 : 3200)
    if (ai.order !== 'form' && near.length > 0) {
      // Go for what is chasing the leader first.
      const chasing = live(lead) ? attackersOf(w, lead, 3000) : []
      const pick = chasing.find(o => !SHIPS[o.kind].capital) ?? near.find(o => !SHIPS[o.kind].capital) ?? near[0]!
      s.target = pick.id
      setMode(ai, 'attack')
    }
    return
  }
  if (ai.mode === 'strike') return
  if (ai.mode === 'attack') {
    let o = shipAt(w, s.target)
    if (!live(o)) {
      s.target = chooseTarget(w, s)
      o = shipAt(w, s.target)
      if (!live(o)) {
        // Nothing to fight: wingmen go back to the leader, the others drift home.
        if (ai.leader >= 0) setMode(ai, ai.order === 'form' ? 'form' : 'form')
        else setMode(ai, 'idle')
        return
      }
    }
    // A wingman told to form up drops the fight.
    if (ai.order === 'form' && ai.leader >= 0) { setMode(ai, 'form'); return }
    // Switch to whoever is hitting us, sometimes.
    const hitter = shipAt(w, s.lastHitBy)
    if (s.sinceHit < 60 && live(hitter) && hitter.side !== s.side && hitter.id !== o.id && !SHIPS[hitter.kind].capital && chance(w.rng, 0.4)) s.target = hitter.id
    const d = dist(o.pos, s.pos)
    // A fresh aim error for this look.
    rollAimError(w, ai)
    // Overshot: the target is behind and close. Break and come round.
    if (d < 700 && offNose(s, o.pos) > 2.0 && chance(w.rng, 0.5)) {
      setMode(ai, 'break'); breakPoint(w, s, o.pos, ai.aim); return
    }
    // The joust: a light or medium fighter runs a pass for a few seconds, then breaks off.
    const passTicks = 60 * (3 + ai.skill * 4)
    if (ai.t > passTicks && d < 900 && k.pitch > 1.1 && chance(w.rng, 0.3)) {
      setMode(ai, 'break'); breakPoint(w, s, o.pos, ai.aim); return
    }
  }
  // A break extends: long enough that whoever it passed can turn onto its tail.
  if (ai.mode === 'break' && ai.t > 60 * (1.6 + (1 - ai.skill) * 1.2)) setMode(ai, 'attack')
  if (ai.mode === 'evade') {
    if (ai.t > 60 * (1.4 + ai.nerve)) setMode(ai, 'attack')
    else jinkPoint(w, s, ai.aim)
  }
  if (ai.mode === 'nav' && dist(ai.aim, s.pos) < 400) setMode(ai, ai.leader >= 0 ? 'form' : 'idle')
}

/** Each tick: turn, set the throttle, decide to fire. Writes `ai.out`. */
function act(w: World, s: Ship, ai: Ai, dt: number): Controls {
  const c = ai.out
  const k = SHIPS[s.kind]
  c.fire = false
  c.missile = false
  c.burn = false
  c.brake = false
  switch (ai.mode) {
    case 'idle': {
      c.pitch = 0; c.yaw = 0; c.roll = 0
      break
    }
    case 'attack': {
      const o = shipAt(w, s.target)
      if (!live(o)) { c.pitch = 0; c.yaw = 0; c.roll = 0; break }
      const d = dist(o.pos, s.pos)
      // About to ram (a head-on pass closes at twice the speed): break now, not at the next think.
      subTo(TMP, o.pos, s.pos)
      normTo(TMP, TMP)
      const closure = (s.vel.x - o.vel.x) * TMP.x + (s.vel.y - o.vel.y) * TMP.y + (s.vel.z - o.vel.z) * TMP.z
      if (closure > 0 && d < 500 && d / closure < 0.6 && !SHIPS[o.kind].capital) {
        setMode(ai, 'break'); breakPoint(w, s, o.pos, ai.aim)
        steerToPoint(c, s, ai.aim, 0.9)
        break
      }
      leadDir(LEAD, s.pos, s, o, GUN.speed)
      // Its aim is off by an error picked at each look: worse pilots, bigger error.
      LEAD.x += ai.err.x; LEAD.y += ai.err.y; LEAD.z += ai.err.z
      normTo(LEAD, LEAD)
      steerTo(c, s, LEAD, 0.6)
      forwardTo(FWD, s.q)
      const off = angleBetween(FWD, LEAD)
      // Throttle: close in fast from far or on a target running away, sit on a tail near.
      if ((d > 2200 || (d > 1100 && closure < 60)) && s.fuel > 0.35) c.burn = true
      else if (d < 450 && off < 0.5 && s.speed > o.speed) c.brake = true
      // Trigger: on the aim point (as it sees it) and in range, keeping some charge back.
      // They fire in bursts: about two thirds of the time, a rest between.
      const burst = (w.tick + s.id * 23) % 100 < 65
      if (burst && off < aimError(ai) + GUN.aiCone && d < GUN_RANGE && s.energy > 0.15) c.fire = true
      // Missile: locked, now and then.
      if (s.lock >= 1 && s.missiles > 0 && s.missileCool <= 0 && (w.tick + s.id) % 30 === 0 && chance(w.rng, 0.25 + ai.skill * 0.25)) c.missile = true
      break
    }
    case 'break': {
      steerToPoint(c, s, ai.aim, 0.9)
      if (s.fuel > 0.3 && ai.t < 50) c.burn = true
      break
    }
    case 'evade': {
      steerToPoint(c, s, ai.aim, 1)
      c.roll = c.roll * 0.5 + (Math.sin((w.tick + s.id * 13) / 9) > 0 ? 0.7 : -0.7)
      if (s.fuel > 0.2) c.burn = true
      break
    }
    case 'flee': {
      const near = enemiesNear(w, s, s.pos, 4000)
      if (near.length) {
        subTo(DIR, s.pos, near[0]!.pos)
        normTo(DIR, DIR)
        steerTo(c, s, DIR, 0.8)
      }
      c.burn = s.fuel > 0.05
      break
    }
    case 'form': {
      const lead = shipAt(w, ai.leader)
      if (!live(lead)) { setMode(ai, 'idle'); break }
      rotateTo(TMP, lead.q, ai.slot)
      addTo(TMP, TMP, lead.pos)
      const d = dist(TMP, s.pos)
      if (d > 120) {
        // Aim a little ahead of the slot, so it closes without overshooting.
        forwardTo(FWD, lead.q)
        maddTo(TMP2, TMP, FWD, Math.min(600, d))
        steerToPoint(c, s, TMP2, 0.4)
        c.burn = d > 1200 && s.fuel > 0.3
      } else {
        // In the slot: hold the leader's heading.
        forwardTo(FWD, lead.q)
        steerTo(c, s, FWD, 0.3)
      }
      // Speed: match the leader, a little more when behind the slot.
      subTo(TMP2, TMP, s.pos)
      forwardTo(FWD, lead.q)
      const along = dot(TMP2, FWD)
      s.cruise = Math.max(k.min, Math.min(k.max, lead.speed + along * 0.6))
      break
    }
    case 'escort': {
      const lead = shipAt(w, ai.leader)
      if (!live(lead)) { setMode(ai, 'idle'); break }
      // Circle the guarded ship at a distance.
      const ang = (w.tick + s.id * 400) / 600
      setTo(TMP, Math.cos(ang) * 900, 150, Math.sin(ang) * 900)
      addTo(TMP, TMP, lead.pos)
      steerToPoint(c, s, TMP, 0.6)
      break
    }
    case 'strike': {
      const o = shipAt(w, s.target)
      if (!live(o)) { setMode(ai, 'attack'); break }
      const d = dist(o.pos, s.pos)
      if (s.missiles <= 0) { setMode(ai, 'attack'); s.target = chooseTarget(w, s); break }
      if (ai.t < 0) {
        // Coming round for another run: fly out first.
        steerToPoint(c, s, ai.aim, 0.6)
        break
      }
      steerToPoint(c, s, o.pos, 0.4)
      if (d > 4000 && s.fuel > 0.4) c.burn = true
      if (s.lock >= 1 && d < 3200) {
        c.missile = true
        // Turn away after the shot and come round again.
        breakPoint(w, s, o.pos, ai.aim, 2500)
        ai.t = -60 * 6
      }
      break
    }
    case 'nav': {
      steerToPoint(c, s, ai.aim, 0.5)
      c.burn = dist(ai.aim, s.pos) > 3000 && s.fuel > 0.5
      break
    }
    case 'turret': {
      calzonePilot(w, s, ai, c)
      break
    }
  }
  return c
}

/**
 * The Calzone's front seat when the player is in the back: keep what chases
 * the ship behind it (where the turret reaches), weave so the turret has
 * crossing shots, take a gun shot when something drifts across the nose, and
 * go on to the nav point when the sky is clear.
 */
function calzonePilot(w: World, s: Ship, ai: Ai, c: Controls): void {
  const near = enemiesNear(w, s, s.pos, 3000).filter(o => !SHIPS[o.kind].capital)
  if (near.length === 0) {
    // Nothing near: fly to where the mission wants to go.
    steerToPoint(c, s, ai.aim, 0.5)
    return
  }
  // Anything in front and close: take the gun shot.
  const front = near.find(o => offNose(s, o.pos) < 0.5 && dist(o.pos, s.pos) < 1200)
  if (front) {
    leadDir(LEAD, s.pos, s, front, GUN.speed)
    steerTo(c, s, LEAD, 0.5)
    forwardTo(FWD, s.q)
    if (angleBetween(FWD, LEAD) < GUN.aiCone && s.energy > 0.2) c.fire = true
    return
  }
  // Otherwise fly away from them, weaving, not too fast: let them come into the turret's arc.
  copyTo(TMP, v3())
  for (const o of near) { subTo(TMP2, s.pos, o.pos); normTo(TMP2, TMP2); addTo(TMP, TMP, TMP2) }
  normTo(TMP, TMP)
  rightTo(TMP2, s.q)
  const weave = Math.sin(w.tick / 70) * 0.55
  maddTo(TMP, TMP, TMP2, weave)
  upTo(TMP2, s.q)
  maddTo(TMP, TMP, TMP2, Math.sin(w.tick / 110) * 0.3)
  normTo(TMP, TMP)
  steerTo(c, s, TMP, 0.7)
  // Too close behind: burn a little to open the range for the gunner.
  const closest = near[0]!
  if (dist(closest.pos, s.pos) < 250 && s.fuel > 0.3) c.burn = true
}

/**
 * The AI for one ship this tick. Returns its controls; the world then flies
 * it, fires its guns and launches what it asked for.
 */
export function stepAi(w: World, s: Ship, dt: number): Controls {
  const ai = s.ai!
  ai.t++
  ai.think--
  if (ai.think <= 0) {
    think(w, s, ai)
    ai.think = reaction(w, ai)
  }
  const c = act(w, s, ai, dt)
  // Big ships fly straight on; their turrets work alone.
  if (SHIPS[s.kind].capital) { clearControls(c); return c }
  return c
}

/** Fire what the AI asked for: guns (no aim help) and missiles. */
export function aiWeapons(w: World, s: Ship, c: Controls): void {
  if (c.fire) fireGuns(w, s, '', null, 0)
  if (c.missile) launchMissile(w, s)
}

/** Out of the arena while fleeing: gone, and the radio may say so. */
export function stepEscapes(w: World, centre: V3): void {
  for (const s of w.ships) {
    if (!live(s) || !s.ai || s.ai.mode !== 'flee') continue
    if (dist(s.pos, centre) > SPACE.arena) {
      s.gone = true
      w.events.push({ type: 'cue', cue: 'enemyGone', a: s.id })
    }
  }
}

/** Put a wingman on a leader's wing: left or right, a little behind. */
export function formOn(s: Ship, leader: Ship, side: number): void {
  if (!s.ai) return
  s.ai.leader = leader.id
  setTo(s.ai.slot, side * 70, 10, 60)
  setMode(s.ai, 'form')
}

/** For the tests and the debug hook: the scratch vector the lead was put in. */
export function lastLead(): V3 { return copyTo(v3(), LEAD) }
