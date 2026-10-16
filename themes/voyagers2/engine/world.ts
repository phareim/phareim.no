/**
 * Space Voyagers II: the world and its one `step`. Pure: no DOM, no clock
 * but `world.tick` (60 a second), no chance but `world.rng`. Same seed, same
 * inputs, same flight. The page calls `step` once a tick with what the person
 * pressed; the renderer reads the world; the radio reads `world.events`.
 *
 * A mission runs in stages: `launch` (out of the Deep Dish's oven door),
 * `fly`, `auto` (the autopilot between nav points: a short cut, not the trip),
 * `land` and `done`. DESIGN.md, "A mission".
 */
import { GUN, SCORE, SHIPS, SHIELD, SPACE, TICK } from './balance.ts'
import { aiWeapons, attackersOf, formOn, setMode, stepAi, stepEscapes } from './ai.ts'
import { clearControls, fly, makeControls, steerTo } from './flight.ts'
import { fireGuns, leadDir, stepAutoTurrets, stepGunCharge, stepShots } from './guns.ts'
import {
  angleBetween, copyTo, dist, forwardTo, maddTo, normTo, q4, qLookTo, rightTo, setTo, subTo, upTo, v3,
} from './math.ts'
import { launchMissile, stepLock, stepMissiles } from './missiles.ts'
import type { MissionDef, WingmanId } from './missions.ts'
import { makeRng, randRange } from './rng.ts'
import { calzoneTurret, makeCrew, partnerPilot, partnerTurret, playerTurret, stepDecoys, swapSeats } from './seats.ts'
import type { Crew } from './seats.ts'
import { kill, live, shipAt, spawnShip } from './ships.ts'
import type { Controls, Input, Nav, PilotId, Ship, SpawnGroup, World } from './types.ts'

export const LAUNCH_TICKS = 150
export const AUTO_TICKS = 200
export const LAND_TICKS = 180
/** After the Calzone is lost: the seats eject, then the mission ends. */
export const EJECT_TICKS = 200
/** A ship that went lingers this long (its explosion) before it leaves the list. */
export const WRECK_TICKS = 120
/** The autopilot drops the Calzone this far short of the nav point. */
export const ARRIVE_SHORT = 2200

export interface Wingman { kind: Ship['kind']; pilot: string; name: string; skill: number; nerve: number }
export const WINGMEN: Record<WingmanId, Wingman> = {
  dougie: { kind: 'moped', pilot: 'dougie', name: 'MOPED', skill: 0.35, nerve: 0.45 },
  marge: { kind: 'rig', pilot: 'marge', name: 'TALL TALE', skill: 0.6, nerve: 0.95 },
  ridley: { kind: 'tug', pilot: 'ridley', name: 'NOSTALGIA', skill: 0.8, nerve: 0.8 },
  duo: { kind: 'pigeon', pilot: 'duo', name: 'CENTURY PIGEON', skill: 0.7, nerve: 1 },
}

export interface Voyage extends World {
  def: MissionDef
  crew: Crew
  /** The Calzone's own controls this tick (whoever flies it). */
  ctl: Controls
}

export interface WorldOpts {
  seed: number
  mission: MissionDef
  /** The pilot the player is, and where they start: the front seat. */
  pilot: PilotId
}

export function makeInput(): Input {
  return {
    pitch: 0, yaw: 0, roll: 0, burn: false, brake: false, fire: false, missile: false,
    nextTarget: false, attacker: false, swap: false, auto: false, order: null, pick: null, touch: false,
  }
}

const KM = 1000

export function createWorld(o: WorldOpts): Voyage {
  const other: PilotId = o.pilot === 'rex' ? 'nova' : 'rex'
  const navs: Nav[] = o.mission.navs.map(n => ({
    name: n.name, pos: v3(n.at[0] * KM, n.at[1] * KM, n.at[2] * KM), groups: n.groups, met: false,
  }))
  const w: Voyage = {
    tick: 0,
    rng: makeRng(o.seed),
    talkRng: makeRng(o.seed ^ 0x5eed),
    ships: [],
    shots: [],
    missiles: [],
    decoys: [],
    events: [],
    nextId: 1,
    player: -1,
    carrier: -1,
    seat: 'front',
    front: o.pilot,
    back: other,
    mission: {
      id: o.mission.id, stage: 'launch', t: 0, navs, nav: 1, pending: [], result: '', why: '', kills: 0, skipped: 0,
    },
    score: 0,
    ejected: false,
    def: o.mission,
    crew: makeCrew(),
    ctl: makeControls(),
  }
  // The Deep Dish, nose to -z, still.
  const home = spawnShip(w, 'deepdish', 'us', v3(0, 0, 0), q4(), { name: 'DEEP DISH', pilot: 'mei', role: 'protect', speed: 0 })
  home.cruise = 0
  w.carrier = home.id
  // Out of the oven door, nose towards nav 1.
  const first = navs[1] ?? navs[0]!
  const dir = normTo(v3(), subTo(v3(), first.pos, home.pos))
  const start = maddTo(v3(), home.pos, dir, 320)
  start.y -= 30
  const me = spawnShip(w, 'calzone', 'us', start, qLookTo(q4(), dir), { name: 'CALZONE', pilot: o.pilot, speed: 120 })
  w.player = me.id
  o.mission.wing.forEach((id, i) => {
    const wm = WINGMEN[id]
    const side = i % 2 === 0 ? 1 : -1
    const p = maddTo(v3(), start, rightTo(v3(), me.q), side * 80)
    maddTo(p, p, dir, -60)
    const s = spawnShip(w, wm.kind, 'us', p, me.q, { name: wm.name, pilot: wm.pilot, ai: 'form', skill: wm.skill, nerve: wm.nerve, speed: 120 })
    formOn(s, me, side)
  })
  for (const c of o.mission.convoy ?? []) {
    const p = maddTo(v3(), start, dir, -300)
    p.y += 60
    spawnShip(w, c.kind, 'us', p, me.q, { name: c.name, pilot: c.pilot, role: 'protect', ai: 'nav', speed: SHIPS[c.kind].cruise })
  }
  w.events.push({ type: 'cue', cue: 'launch' })
  return w
}

export function calzone(w: World): Ship | null {
  return shipAt(w, w.player)
}

/** Is the autopilot lit: nothing hostile near, nothing still to come here? */
export function autoReady(w: Voyage): boolean {
  const m = w.mission
  if (m.stage !== 'fly') return false
  const me = calzone(w)
  if (!live(me)) return false
  if (m.pending.length > 0) return false
  for (const s of w.ships) {
    if (!live(s) || s.side === 'us') continue
    if (dist(s.pos, me.pos) < SPACE.autoClear) return false
  }
  return true
}

/** What the autopilot would do now: fly to a nav point, or land. */
export function autoGoal(w: Voyage): 'nav' | 'land' | 'none' {
  const m = w.mission
  if (!autoReady(w)) return 'none'
  const me = calzone(w)!
  const home = shipAt(w, w.carrier)
  const allMet = m.navs.every((n, i) => i === 0 || n.met)
  if (allMet && m.navs[0]!.met && live(home) && dist(me.pos, home.pos) < 4000) return 'land'
  return 'nav'
}

const TMP = v3()
const FWD = v3()

/** Put a group of their ships into the fight. */
export function spawnGroup(w: Voyage, g: SpawnGroup, at: Nav): Ship[] {
  const me = calzone(w)
  const ref = live(me) ? me : shipAt(w, w.carrier)!
  forwardTo(FWD, ref.q)
  const base = v3()
  switch (g.from) {
    case 'ahead': maddTo(base, ref.pos, FWD, g.range); break
    case 'behind': maddTo(base, ref.pos, FWD, -g.range); break
    case 'left': maddTo(base, ref.pos, rightTo(TMP, ref.q), -g.range); break
    case 'right': maddTo(base, ref.pos, rightTo(TMP, ref.q), g.range); break
    case 'above': maddTo(base, ref.pos, upTo(TMP, ref.q), g.range); break
    case 'below': maddTo(base, ref.pos, upTo(TMP, ref.q), -g.range); break
    case 'far': {
      const a = randRange(w.rng, 0, Math.PI * 2)
      setTo(base, at.pos.x + Math.cos(a) * g.range, at.pos.y + randRange(w.rng, -400, 400), at.pos.z + Math.sin(a) * g.range)
      break
    }
  }
  const out: Ship[] = []
  for (let i = 0; i < g.count; i++) {
    const p = v3(base.x + (i - (g.count - 1) / 2) * 140, base.y + (i % 2) * 60, base.z + randRange(w.rng, -80, 80))
    const goal = g.goFor === 'carrier' ? shipAt(w, w.carrier) : g.goFor === 'protect' ? w.ships.find(s => s.role === 'protect' && s.id !== w.carrier && live(s)) ?? null : ref
    const aimAt = live(goal) ? goal.pos : ref.pos
    const q = qLookTo(q4(), normTo(v3(), subTo(v3(), aimAt, p)))
    const bomber = g.kind === 'hound' && g.goFor === 'carrier'
    const s = spawnShip(w, g.kind, 'them', p, q, {
      ai: bomber ? 'strike' : 'attack', skill: g.skill ?? 0.4, nerve: g.kind === 'rat' ? 0.4 : 0.65,
      pilot: g.ace ?? 'mascot',
    })
    s.target = live(goal) ? goal.id : ref.id
    if (g.ace) s.role = 'ace'
    out.push(s)
  }
  w.events.push({ type: 'spawn', kind: g.kind, value: g.count })
  return out
}

/** The Calzone has come to a nav point: the fight there begins. */
function arrive(w: Voyage, idx: number): void {
  const m = w.mission
  const nav = m.navs[idx]!
  if (nav.met) return
  nav.met = true
  w.events.push({ type: 'arrive', value: idx })
  w.events.push({ type: 'cue', cue: idx === 0 ? 'home' : 'arrive', value: idx })
  for (const g of nav.groups) {
    if (g.delay <= 0) spawnGroup(w, g, nav)
    else m.pending.push({ at: w.tick + Math.round(g.delay * 60), group: g, nav: idx })
  }
  // On to the next point: the one after, or home after the last.
  if (idx !== 0) m.nav = idx + 1 < m.navs.length ? idx + 1 : 0
}

/** The autopilot: the cut is over, put the Calzone and its wing short of the next nav point. */
function autoJump(w: Voyage): void {
  const m = w.mission
  const me = calzone(w)!
  const nav = m.navs[m.nav]!
  subTo(TMP, nav.pos, me.pos)
  const d = Math.sqrt(TMP.x * TMP.x + TMP.y * TMP.y + TMP.z * TMP.z)
  normTo(TMP, TMP)
  const at = maddTo(v3(), nav.pos, TMP, -(m.nav === 0 ? 3200 : ARRIVE_SHORT))
  m.skipped += Math.max(0, d - ARRIVE_SHORT) / Math.max(1, me.cruise)
  const q = qLookTo(q4(), TMP)
  const shift = subTo(v3(), at, me.pos)
  // Everything of ours that flies with the Calzone comes along; wrecks and stragglers stay behind.
  for (const s of w.ships) {
    if (!live(s)) continue
    if (s.side === 'them') { s.gone = true; continue }
    if (SHIPS[s.kind].capital && s.role !== 'protect') continue
    if (s.id === w.carrier) continue
    s.pos.x += shift.x; s.pos.y += shift.y; s.pos.z += shift.z
    s.q.x = q.x; s.q.y = q.y; s.q.z = q.z; s.q.w = q.w
    s.speed = s.cruise
  }
  w.shots.length = 0
  w.missiles.length = 0
  w.decoys.length = 0
  arrive(w, m.nav)
}

/** The Calzone's crew picks targets for the front seat: what it asked for, else what is in front. */
function playerTargeting(w: Voyage, me: Ship, input: Input): void {
  const cur = shipAt(w, me.target)
  if (input.pick !== null) {
    const p = shipAt(w, input.pick)
    if (live(p) && p.side !== me.side) me.target = p.id
  }
  if (input.attacker) {
    const a = attackersOf(w, me, 4000)[0]
    if (a) me.target = a.id
  }
  if (input.nextTarget) {
    const list = w.ships.filter(s => live(s) && s.side !== me.side && dist(s.pos, me.pos) < 9000)
    list.sort((a, b) => dist(a.pos, me.pos) - dist(b.pos, me.pos))
    if (list.length) {
      const i = list.findIndex(s => s.id === me.target)
      me.target = list[(i + 1) % list.length]!.id
    }
  }
  // Lost the target (or never had one): take the nearest fighter in front, else the nearest at all.
  if (!live(cur) && !live(shipAt(w, me.target))) {
    forwardTo(FWD, me.q)
    let best = -1, bestScore = Infinity
    for (const s of w.ships) {
      if (!live(s) || s.side === me.side) continue
      const d = dist(s.pos, me.pos)
      if (d > 8000) continue
      subTo(TMP, s.pos, me.pos)
      normTo(TMP, TMP)
      const off = angleBetween(FWD, TMP)
      const score = d * (1 + off * 1.5) + (SHIPS[s.kind].capital ? 50000 : 0)
      if (score < bestScore) { bestScore = score; best = s.id }
    }
    me.target = best
  }
}

const LEAD = v3()

/** Orders to the wing over the comms. */
function giveOrder(w: Voyage, me: Ship, order: NonNullable<Input['order']>): void {
  w.events.push({ type: 'order', kind: order })
  w.events.push({ type: 'cue', cue: 'order-' + order })
  if (order === 'taunt') {
    // The back seat opens the channel and insults whoever is targeted: it comes for the Calzone.
    const o = shipAt(w, me.target)
    if (live(o) && o.ai && o.side !== me.side) {
      o.target = me.id
      if (o.ai.mode === 'strike' || o.ai.mode === 'flee') setMode(o.ai, 'attack')
      w.events.push({ type: 'cue', cue: 'taunted', a: o.id })
    }
    return
  }
  for (const s of w.ships) {
    if (!live(s) || s.side !== me.side || !s.ai || s.id === me.id || SHIPS[s.kind].capital) continue
    s.ai.order = order
    if (order === 'form') { setMode(s.ai, 'form') }
    else if (order === 'attack') {
      const t = shipAt(w, me.target)
      if (live(t)) { s.target = t.id; setMode(s.ai, 'attack') }
      s.ai.order = null
    } else if (order === 'help') {
      const a = attackersOf(w, me, 4000)[0]
      if (a) { s.target = a.id; setMode(s.ai, 'attack') }
      s.ai.order = null
    }
  }
}

function endMission(w: Voyage, result: 'won' | 'lost', why: string): void {
  const m = w.mission
  if (m.stage === 'done') return
  m.result = result
  m.why = why
  m.stage = 'done'
  m.t = 0
  if (result === 'won') {
    w.score += SCORE.missionWon
    for (const s of w.ships) if (s.role === 'protect' && live(s)) w.score += SCORE.saved
  }
  w.events.push({ type: 'objective', kind: result, value: w.score })
  w.events.push({ type: 'cue', cue: result === 'won' ? 'won' : 'lost' })
}

/** The mission's rules each tick: arrivals, waves that were waiting, losses, the end. */
function stepMission(w: Voyage): void {
  const m = w.mission
  const me = calzone(w)
  // Waves that come a little after the first.
  for (let i = m.pending.length - 1; i >= 0; i--) {
    const p = m.pending[i]!
    if (p.at <= w.tick) {
      m.pending.splice(i, 1)
      spawnGroup(w, p.group, m.navs[p.nav]!)
    }
  }
  if (m.stage === 'fly' && live(me)) {
    // Flying in by hand counts too.
    const nav = m.navs[m.nav]!
    if (!nav.met && dist(me.pos, nav.pos) < SPACE.navReach) arrive(w, m.nav)
    if (m.nav === 0 && !nav.met) {
      const allMet = m.navs.every((n, i) => i === 0 || n.met)
      if (allMet && dist(me.pos, nav.pos) < 5000) arrive(w, 0)
    }
  }
  // Losses.
  for (const s of w.ships) {
    if (s.dead !== 1) continue
    if (s.id === w.player) {
      w.ejected = true
      w.events.push({ type: 'eject', a: s.id })
      w.events.push({ type: 'cue', cue: 'eject' })
    } else if (s.role === 'protect' && m.result === '') {
      w.events.push({ type: 'cue', cue: s.id === w.carrier ? 'carrierLost' : 'convoyLost', a: s.id })
    }
  }
  if (w.ejected && m.stage !== 'done') {
    m.t++
    if (m.t > EJECT_TICKS) endMission(w, 'lost', 'eject')
  }
  const home = shipAt(w, w.carrier)
  if (!live(home) && w.carrier >= 0 && m.stage !== 'done' && !w.ejected) {
    if (home && home.dead > 60) endMission(w, 'lost', 'carrier')
  }
}

/** Score the kills of this tick: ours fully (either seat), the wing's at half. */
function scoreKills(w: Voyage): void {
  for (const e of w.events) {
    if (e.type !== 'kill') continue
    const victim = shipAt(w, e.a ?? -1)
    if (!victim || victim.side === 'us') continue
    const by = shipAt(w, e.b ?? -1)
    const pts = e.value ?? 0
    if (by && by.id === w.player) { w.score += pts; w.mission.kills++ }
    else if (by && by.side === 'us') w.score += Math.round(pts / 2)
  }
}

/** One tick. */
export function step(w: Voyage, input: Input): void {
  const m = w.mission
  if (m.stage === 'done' && m.t > 600) return
  const dt = TICK
  w.events.length = 0
  m.t++
  const me = calzone(w)
  const c = clearControls(w.ctl)
  const crew = w.crew

  if (live(me)) {
    if (m.stage === 'launch') {
      // Out of the oven door: straight on, speeding up.
      c.burn = false
      if (m.t >= LAUNCH_TICKS) { m.stage = 'fly'; m.t = 0; w.events.push({ type: 'cue', cue: 'launched' }) }
    } else if (m.stage === 'fly') {
      if (input.swap) swapSeats(w, crew, me)
      if (input.order) giveOrder(w, me, input.order)
      if (crew.swapping > 0) {
        crew.swapping--
      } else if (w.seat === 'front') {
        playerTargeting(w, me, input)
        c.pitch = input.pitch; c.yaw = input.yaw; c.roll = input.roll
        c.burn = input.burn; c.brake = input.brake
        c.fire = input.fire; c.missile = input.missile
      } else {
        // The partner flies; the mission's next point is where they go when it is quiet.
        if (me.ai) {
          const goal = m.navs[m.nav]!
          copyTo(me.ai.aim, goal.pos)
          const ac = stepAi(w, me, dt)
          c.pitch = ac.pitch; c.yaw = ac.yaw; c.roll = ac.roll
          c.burn = ac.burn; c.brake = ac.brake; c.fire = ac.fire
        }
        playerTargeting(w, me, { ...input, nextTarget: false, pick: null })
      }
      const goal = autoGoal(w)
      if (input.auto && goal !== 'none') {
        m.stage = goal === 'land' ? 'land' : 'auto'
        m.t = 0
        w.events.push({ type: 'auto', kind: goal })
        w.events.push({ type: 'cue', cue: goal === 'land' ? 'landing' : 'autopilot' })
      }
    } else if (m.stage === 'auto') {
      if (m.t >= AUTO_TICKS) { m.stage = 'fly'; m.t = 0; autoJump(w) }
    } else if (m.stage === 'land') {
      const home = shipAt(w, w.carrier)
      if (live(home)) {
        // The Deep Dish's deck takes over: fly in through the oven door.
        subTo(TMP, home.pos, me.pos)
        normTo(TMP, TMP)
        steerTo(c, me, TMP, 0.3)
      }
      if (m.t >= LAND_TICKS) {
        w.score += SCORE.landed
        endMission(w, w.def.kill && !killDone(w) ? 'lost' : 'won', w.def.kill && !killDone(w) ? 'target' : 'landed')
      }
    }
  }

  // Ships fly. The Calzone under its controls; the AI under theirs.
  for (const s of w.ships) {
    if (!live(s)) continue
    if (s.id === w.player) {
      fly(s, c, dt)
      continue
    }
    if (s.ai) {
      const ac = stepAi(w, s, dt)
      fly(s, ac, dt)
      aiWeapons(w, s, ac)
    } else {
      fly(s, makeIdle, dt)
    }
  }
  // The Calzone's guns and missiles, by seat.
  if (live(me) && m.stage === 'fly' && crew.swapping === 0) {
    const tgt = shipAt(w, me.target)
    const assist = live(tgt) && leadDir(LEAD, me.pos, me, tgt, 1600) && dist(tgt.pos, me.pos) < 2600 ? LEAD : null
    const cone = input.touch ? GUN.assistTouch : GUN.assistKeys
    if (c.fire) fireGuns(w, me, w.seat === 'front' ? 'front' : '', assist, w.seat === 'front' ? cone : 0.03)
    if (w.seat === 'front' && c.missile) launchMissile(w, me)
    if (w.seat === 'front') partnerTurret(w, crew, me, partnerPilot(w), dt)
    else playerTurret(w, crew, me, input, dt)
  }
  // Locks, for everyone who carries missiles.
  for (const s of w.ships) if (live(s) && s.missiles > 0) stepLock(w, s, dt)
  stepAutoTurrets(w, dt, live(me) ? calzoneTurret(me) : null)
  stepMissiles(w, dt)
  if (live(me)) stepDecoys(w, crew, me)
  stepShots(w, dt)
  stepGunCharge(w, dt)
  // Shields come back after a while without a hit.
  for (const s of w.ships) {
    if (!live(s)) continue
    s.sinceHit++
    if (s.sinceHit > SHIELD.wait * 60) {
      const k = SHIPS[s.kind]
      s.shieldF = Math.min(k.shield, s.shieldF + k.shield * SHIELD.regen * dt)
      s.shieldB = Math.min(k.shield, s.shieldB + k.shield * SHIELD.regen * dt)
    }
  }
  scoreKills(w)
  stepMission(w)
  if (live(me)) stepEscapes(w, me.pos)
  // Wrecks burn out and leave the list.
  for (let i = w.ships.length - 1; i >= 0; i--) {
    const s = w.ships[i]!
    if (s.dead > 0) s.dead++
    if ((s.dead > WRECK_TICKS || s.gone) && s.id !== w.player && s.id !== w.carrier) w.ships.splice(i, 1)
  }
  w.tick++
}

const makeIdle: Controls = makeControls()

function killDone(w: Voyage): boolean {
  const k = w.def.kill
  if (!k) return true
  return !w.ships.some(s => s.kind === k.kind && s.side === 'them' && live(s))
}

/** For the tests: lose the Calzone now. */
export function destroyCalzone(w: Voyage): void {
  const me = calzone(w)
  if (me) kill(w, me, -1)
}
