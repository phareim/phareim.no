/**
 * Space Voyagers II: the world and its one `step`. Pure: no DOM, no clock
 * but `world.tick` (60 a second), no chance but `world.rng`. Same seed, same
 * inputs, same flight. The page calls `step` once a tick with what the person
 * pressed; the renderer reads the world; the radio reads `world.events`.
 *
 * A sortie runs in stages: `launch` (out of the Deep Dish's oven door),
 * `fly`, `auto` (the autopilot between nav points: a short cut, not the trip),
 * `land` and `done`. Its goal (`missions.ts`) decides won or lost at the
 * landing; losing the Calzone or the Deep Dish loses it at once. DESIGN.md,
 * "A sortie".
 */
import { GUN, SCORE, SHIPS, SHIELD, SPACE, TICK } from './balance.ts'
import { aiWeapons, attackersOf, formOn, setMode, stepAi, stepEscapes } from './ai.ts'
import { clearControls, fly, makeControls, steerTo } from './flight.ts'
import { fireGuns, HULLS, leadDir, stepAutoTurrets, stepGunCharge, stepShots, turretWorld } from './guns.ts'
import {
  addTo, angleBetween, copyTo, dist, distSq, forwardTo, maddTo, normTo, q4, qLookTo, rightTo, rotateTo, setTo, subTo, unrotateTo, upTo, v3,
} from './math.ts'
import { launchMissile, stepLock, stepMissiles } from './missiles.ts'
import type { MissionDef, Placed, ScriptDo, WingmanId } from './missions.ts'
import { makeRng, randRange } from './rng.ts'
import { calzoneTurret, makeCrew, partnerPilot, partnerTurret, playerTurret, stepDecoys, swapSeats } from './seats.ts'
import type { Crew } from './seats.ts'
import { attach, hurt, kill, live, placeAttached, shipAt, spawnShip, wholeness } from './ships.ts'
import type { Controls, Input, Nav, PilotId, Ship, SpawnGroup, World } from './types.ts'

export const LAUNCH_TICKS = 150
export const AUTO_TICKS = 200
export const LAND_TICKS = 180
/** After the Calzone is lost: the seats eject, then the sortie ends. */
export const EJECT_TICKS = 200
/** A ship that went lingers this long (its explosion) before it leaves the list. */
export const WRECK_TICKS = 120
/** The autopilot drops the Calzone this far short of the nav point. */
export const ARRIVE_SHORT = 2200
/** A sortie that ends with its target: the explosion plays this long before the end. */
export const FINISH_TICKS = 240

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
  /** The crew's morale 0..1 (the hub's talk): the wing and the back seat fly a little better or worse. */
  morale?: number
}

export function makeInput(): Input {
  return {
    pitch: 0, yaw: 0, roll: 0, burn: false, brake: false, fire: false, missile: false,
    nextTarget: false, attacker: false, swap: false, auto: false, order: null, pick: null, touch: false,
  }
}

const KM = 1000

export function createWorld(o: WorldOpts): Voyage {
  const def = o.mission
  const other: PilotId = o.pilot === 'rex' ? 'nova' : 'rex'
  const navs: Nav[] = def.navs.map(n => ({
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
      id: def.id, stage: 'launch', t: 0, navs, nav: def.startHome ? 0 : 1, pending: [], result: '', why: '', kills: 0, skipped: 0,
      script: [], flags: {}, homeT: 0, launchers: [], endAt: -1,
    },
    score: 0,
    ejected: false,
    def,
    crew: makeCrew(),
    ctl: makeControls(),
  }
  const morale = o.morale ?? 0.6
  // The Deep Dish, nose to -z, still.
  const home = spawnShip(w, 'deepdish', 'us', v3(0, 0, 0), q4(), { name: 'DEEP DISH', pilot: 'mei', role: 'protect', speed: 0 })
  home.cruise = 0
  w.carrier = home.id
  // Out of the oven door, nose towards nav 1 (or straight out, for a fight at home).
  const first = navs[1] ?? null
  const dir = first ? normTo(v3(), subTo(v3(), first.pos, home.pos)) : v3(0, 0, -1)
  const start = maddTo(v3(), home.pos, dir, 320)
  start.y -= 30
  const me = spawnShip(w, 'calzone', 'us', start, qLookTo(q4(), dir), { name: 'CALZONE', pilot: o.pilot, speed: 120 })
  me.torps = def.torps ?? 0
  if (me.torps > 0) me.missiles = 4
  w.player = me.id
  def.wing.forEach((id, i) => {
    const wm = WINGMEN[id]
    const side = i % 2 === 0 ? 1 : -1
    const p = maddTo(v3(), start, rightTo(v3(), me.q), side * 80)
    maddTo(p, p, dir, -60)
    // Morale moves how well the wing flies: a tenth of skill either way.
    const skill = Math.max(0.1, Math.min(0.95, wm.skill + (morale - 0.6) * 0.25))
    const s = spawnShip(w, wm.kind, 'us', p, me.q, { name: wm.name, pilot: wm.pilot, ai: 'form', skill, nerve: wm.nerve, speed: 120 })
    formOn(s, me, side)
  })
  ;(def.convoy ?? []).forEach((c, i) => {
    const p = maddTo(v3(), start, dir, -260 - i * 160)
    p.y += 50
    p.x += (i % 2 ? 1 : -1) * 90
    const s = spawnShip(w, c.kind, 'us', p, me.q, { name: c.name, pilot: c.pilot, role: 'protect', ai: 'form', skill: 0.6, nerve: 0.9, speed: 120 })
    formOn(s, me, i % 2 ? 1 : -1)
    if (s.ai) setTo(s.ai.slot, (i % 2 ? 1 : -1) * 160, 40, 260 + i * 120)
  })
  w.events.push({ type: 'cue', cue: 'launch' })
  return w
}

export function calzone(w: World): Ship | null {
  return shipAt(w, w.player)
}

function hostileNear(w: Voyage, at: Ship, range: number): boolean {
  for (const s of w.ships) {
    if (!live(s) || s.side === 'us') continue
    // The sortie's target holds the autopilot from much further: you do not fly home past it.
    if (dist(s.pos, at.pos) < (s.role === 'kill' ? range * 3 : range)) return true
  }
  return false
}

/** Is the autopilot lit: nothing hostile near, nothing still to come here? */
export function autoReady(w: Voyage): boolean {
  const m = w.mission
  if (m.stage !== 'fly') return false
  const me = calzone(w)
  if (!live(me)) return false
  // Something still to come here (a wave, a defection, help on its way) holds the autopilot.
  if (m.pending.length > 0 || m.script.length > 0) return false
  return !hostileNear(w, me, SPACE.autoClear)
}

/** What the autopilot would do now: fly to a nav point, or land. */
export function autoGoal(w: Voyage): 'nav' | 'land' | 'none' {
  const m = w.mission
  if (!autoReady(w)) return 'none'
  const me = calzone(w)!
  const home = shipAt(w, w.carrier)
  const allMet = m.navs.every(n => n.met)
  if (allMet && live(home) && dist(me.pos, home.pos) < 4000) {
    if (w.def.goal.type === 'survive' && !m.flags.helped) return 'none'
    return 'land'
  }
  if (allMet) return 'nav'
  return 'nav'
}

const TMP = v3()
const FWD = v3()

/** The ship a group goes for. */
function goalFor(w: Voyage, g: SpawnGroup, ref: Ship): Ship | null {
  if (g.goFor === 'carrier') return shipAt(w, w.carrier)
  if (g.goFor === 'protect') {
    const list = w.ships.filter(s => s.role === 'protect' && s.id !== w.carrier && live(s))
    if (list.length) return list[Math.floor(randRange(w.rng, 0, list.length))]!
  }
  return ref
}

/** Put a group of their ships into the fight. */
export function spawnGroup(w: Voyage, g: SpawnGroup, at: Nav, origin?: Ship): Ship[] {
  const me = calzone(w)
  const ref = live(me) ? me : shipAt(w, w.carrier)!
  forwardTo(FWD, ref.q)
  const base = v3()
  if (origin) copyTo(base, origin.pos)
  else switch (g.from) {
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
    const p = v3(base.x + (i - (g.count - 1) / 2) * 140, base.y + (i % 2) * 60 + (origin ? -120 : 0), base.z + randRange(w.rng, -80, 80))
    const goal = goalFor(w, g, ref)
    const aimAt = live(goal) ? goal.pos : ref.pos
    const q = qLookTo(q4(), normTo(v3(), subTo(v3(), aimAt, p)))
    const bomber = g.kind === 'hound' && g.goFor === 'carrier'
    const s = spawnShip(w, g.kind, 'them', p, q, {
      ai: bomber ? 'strike' : 'attack', skill: g.skill ?? 0.4, nerve: g.kind === 'rat' ? 0.4 : g.ace ? 1 : 0.65,
      pilot: g.ace ?? 'mascot', name: g.ace === 'parmesan' ? 'PRINCE PARMESAN' : undefined,
    })
    s.target = live(goal) ? goal.id : ref.id
    if (g.ace) s.role = 'ace'
    out.push(s)
  }
  w.events.push({ type: 'spawn', kind: g.kind, value: g.count })
  return out
}

/** A big ship parked at a nav point, with its guns (and the Hut's vent). */
function place(w: Voyage, p: Placed, nav: Nav): Ship {
  const pos = v3(nav.pos.x + p.at[0], nav.pos.y + p.at[1], nav.pos.z + p.at[2])
  const me = calzone(w)
  const face = me ? normTo(v3(), subTo(v3(), me.pos, pos)) : v3(0, 0, 1)
  face.y = 0
  const goal = w.def.goal
  const s = spawnShip(w, p.kind, 'them', pos, qLookTo(q4(), normTo(face, face)), { name: p.name, role: goal.type === 'kill' && goal.kind === p.kind ? 'kill' : '', speed: 0 })
  s.cruise = SHIPS[p.kind].cruise
  if (p.vent) {
    const v = spawnShip(w, 'vent', 'them', pos, s.q, { name: 'THE VENT', role: 'kill' })
    attach(v, s, v3(p.vent[0], p.vent[1], p.vent[2]))
  }
  if (p.launcher) w.mission.launchers.push({ id: s.id, next: 60 * 8, left: p.launcher.max, every: p.launcher.every, group: p.launcher.group })
  w.events.push({ type: 'spawn', kind: p.kind, value: 1 })
  return s
}

/** The Calzone has come to a nav point: the fight there begins. */
function arrive(w: Voyage, idx: number): void {
  const m = w.mission
  const nav = m.navs[idx]!
  if (nav.met) return
  nav.met = true
  w.events.push({ type: 'arrive', value: idx })
  const ambush = w.def.navs[idx]?.ambush === true
  w.events.push({ type: 'cue', cue: idx === 0 ? (w.def.startHome ? 'homeFight' : 'home') : ambush ? 'ambush' : 'arrive', value: idx })
  for (const p of w.def.placed ?? []) if (p.nav === idx) place(w, p, nav)
  for (const g of nav.groups) {
    if (g.delay <= 0) spawnGroup(w, g, nav)
    else m.pending.push({ at: w.tick + Math.round(g.delay * 60), group: g, nav: idx })
  }
  for (const e of w.def.events ?? []) if (e.nav === idx) m.script.push({ at: w.tick + Math.round(e.delay * 60), do: e.do })
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
  // Everything of ours that flies with the Calzone comes along; wrecks, stragglers and parked ships stay behind.
  for (const s of w.ships) {
    if (!live(s)) continue
    if (s.side === 'them') { s.gone = true; continue }
    if (s.id === w.carrier || s.parent >= 0) continue
    if (SHIPS[s.kind].capital && s.role !== 'protect') continue
    s.pos.x += shift.x; s.pos.y += shift.y; s.pos.z += shift.z
    s.q.x = q.x; s.q.y = q.y; s.q.z = q.z; s.q.w = q.w
    s.speed = s.cruise
    // The trip took minutes: shields are full again (armour is not mended in flight).
    const k = SHIPS[s.kind]
    s.shieldF = k.shield
    s.shieldB = k.shield
    s.energy = 1
    s.fuel = 1
  }
  m.launchers.length = 0
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
    if (live(p) && p.side !== me.side && !SHIPS[p.kind].scenery) me.target = p.id
  }
  if (input.attacker) {
    const a = attackersOf(w, me, 4000)[0]
    if (a) me.target = a.id
  }
  if (input.nextTarget) {
    const list = w.ships.filter(s => live(s) && s.side !== me.side && !SHIPS[s.kind].scenery && dist(s.pos, me.pos) < 9000)
    list.sort((a, b) => dist(a.pos, me.pos) - dist(b.pos, me.pos))
    if (list.length) {
      const i = list.findIndex(s => s.id === me.target)
      me.target = list[(i + 1) % list.length]!.id
    }
  }
  // Lost the target (or never had one): the nearest fighter in front, else a big ship's gun, else the big ship.
  if (!live(cur) && !live(shipAt(w, me.target))) {
    forwardTo(FWD, me.q)
    let best = -1, bestScore = Infinity
    for (const s of w.ships) {
      if (!live(s) || s.side === me.side || SHIPS[s.kind].scenery) continue
      const d = dist(s.pos, me.pos)
      if (d > 8000) continue
      subTo(TMP, s.pos, me.pos)
      normTo(TMP, TMP)
      const off = angleBetween(FWD, TMP)
      const k = SHIPS[s.kind]
      const score = d * (1 + off * 1.5) + (k.capital ? 50000 : k.fixed ? 20000 : 0)
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
    if (!live(s) || s.side !== me.side || !s.ai || s.id === me.id || SHIPS[s.kind].capital || s.role === 'protect') continue
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
    for (const s of w.ships) if (s.role === 'protect' && live(s) && s.id !== w.carrier) w.score += SCORE.saved
  }
  w.events.push({ type: 'objective', kind: result, value: w.score })
  w.events.push({ type: 'cue', cue: result === 'won' ? 'won' : 'lost' })
}

/** The goal, judged at the landing: won, or lost and why. */
export function judge(w: Voyage): { won: boolean; why: string } {
  const goal = w.def.goal
  const m = w.mission
  const home = shipAt(w, w.carrier)
  if (!m.navs.every(n => n.met)) return { won: false, why: 'navs' }
  switch (goal.type) {
    case 'patrol': return { won: true, why: 'landed' }
    case 'kill': return m.flags.killed ? { won: true, why: 'landed' } : { won: false, why: 'target' }
    case 'protect': {
      const saved = w.ships.filter(s => s.role === 'protect' && s.id !== w.carrier && live(s)).length
      return saved >= goal.min ? { won: true, why: 'landed' } : { won: false, why: 'convoy' }
    }
    case 'defend': return home && live(home) && wholeness(home) >= 1 - goal.maxLoss ? { won: true, why: 'landed' } : { won: false, why: 'oven' }
    case 'survive':
      if (!m.flags.helped) return { won: false, why: 'carrier' }
      return home && live(home) && wholeness(home) >= 1 - goal.maxLoss ? { won: true, why: 'landed' } : { won: false, why: 'oven' }
    case 'duel': return m.flags.duel ? { won: true, why: 'landed' } : { won: false, why: 'duel' }
  }
}

/** Scripted things: the defection, Hans's return, the duel's escorts leaving, help arriving. */
function doScript(w: Voyage, what: ScriptDo | string): void {
  const me = calzone(w)
  if (!me) return
  if (what === 'defect') {
    const duo = w.ships.find(s => live(s) && s.pilot === 'duo' && s.side === 'us')
    if (duo && duo.ai) {
      duo.side = 'them'
      duo.role = 'ace'
      duo.target = me.id
      duo.ai.leader = -1
      duo.ai.order = null
      duo.ai.nerve = 1
      setMode(duo.ai, 'attack')
      w.events.push({ type: 'cue', cue: 'defect', a: duo.id })
    }
  } else if (what === 'hansBack') {
    const p = maddTo(v3(), me.pos, forwardTo(v3(), me.q), -900)
    p.y += 200
    const s = spawnShip(w, 'pigeon', 'us', p, me.q, { name: 'CENTURY PIGEON', pilot: 'duo', ai: 'attack', skill: 0.8, nerve: 1, speed: 400 })
    formOn(s, me, 1)
    setMode(s.ai!, 'attack')
    w.events.push({ type: 'cue', cue: 'hansBack', a: s.id })
  } else if (what === 'dareLeave') {
    for (const s of w.ships) if (live(s) && s.side === 'them' && s.role !== 'ace' && s.ai) setMode(s.ai, 'flee')
    w.events.push({ type: 'cue', cue: 'dareLeave' })
  } else if (what === 'help') {
    w.mission.flags.helped = true
    for (let i = 0; i < 3; i++) {
      const p = maddTo(v3(), me.pos, rightTo(v3(), me.q), (i - 1) * 300)
      maddTo(p, p, forwardTo(v3(), me.q), 1500)
      const s = spawnShip(w, 'rig', 'us', p, qLookTo(q4(), normTo(v3(), subTo(v3(), me.pos, p))), { name: i === 0 ? 'TALL TALE' : 'RIG ' + (i + 1), pilot: 'marge', ai: 'attack', skill: 0.6, nerve: 1 })
      s.target = -1
    }
    for (const s of w.ships) if (live(s) && s.side === 'them' && s.ai) setMode(s.ai, 'flee')
    w.events.push({ type: 'cue', cue: 'help' })
  }
}

/** The sortie's rules each tick: arrivals, waves that were waiting, the script, launches, losses, the end. */
function stepMission(w: Voyage): void {
  const m = w.mission
  const me = calzone(w)
  for (let i = m.pending.length - 1; i >= 0; i--) {
    const p = m.pending[i]!
    if (p.at <= w.tick) {
      m.pending.splice(i, 1)
      spawnGroup(w, p.group, m.navs[p.nav]!)
    }
  }
  for (let i = m.script.length - 1; i >= 0; i--) {
    const s = m.script[i]!
    if (s.at <= w.tick) { m.script.splice(i, 1); doScript(w, s.do) }
  }
  for (const l of m.launchers) {
    const ship = shipAt(w, l.id)
    if (!live(ship) || l.left <= 0) continue
    if (--l.next <= 0) {
      l.next = Math.round(l.every * 60)
      l.left--
      spawnGroup(w, l.group, m.navs[m.nav === 0 ? m.navs.length - 1 : m.nav - 1] ?? m.navs[0]!, ship)
      w.events.push({ type: 'cue', cue: 'launch-fighters', a: ship.id })
    }
  }
  if (w.def.startHome && m.navs[0]!.met) m.homeT++
  if (m.stage === 'fly' && live(me)) {
    // Flying in by hand counts too.
    const nav = m.navs[m.nav]!
    if (!nav.met && dist(me.pos, nav.pos) < SPACE.navReach) arrive(w, m.nav)
    if (m.nav === 0 && !nav.met) {
      const allMet = m.navs.every((n, i) => i === 0 || n.met)
      if (allMet && dist(me.pos, nav.pos) < 5000) arrive(w, 0)
    }
  }
  // Kills that matter, losses, the duel.
  for (const e of w.events) {
    if (e.type === 'kill') {
      const s = shipAt(w, e.a ?? -1)
      if (s && w.def.goal.type === 'kill' && s.kind === w.def.goal.kind) {
        m.flags.killed = true
        w.events.push({ type: 'cue', cue: 'targetDown', a: s.id })
        if (w.def.goal.endOnKill) m.endAt = w.tick + FINISH_TICKS
      }
      if (s && s.role === 'ace' && s.pilot === 'parmesan' && w.def.goal.type === 'duel') m.flags.duel = true
    }
  }
  for (const s of w.ships) {
    if (s.gone && s.role === 'ace' && !m.flags['gone' + s.id]) {
      m.flags['gone' + s.id] = true
      if (s.pilot === 'parmesan' && w.def.goal.type === 'duel') m.flags.duel = true
      w.events.push({ type: 'cue', cue: s.pilot === 'parmesan' ? 'parmesanFlees' : 'duoFlees', a: s.id })
    }
    // A big ship gone takes its guns with it.
    if (s.parent >= 0 && s.dead === 0) {
      const p = shipAt(w, s.parent)
      if (!p || p.dead > 0) kill(w, s, p ? p.lastHitBy : -1)
    }
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
  const home: Ship | null = shipAt(w, w.carrier)
  if (home !== null && home.dead > 60 && m.stage !== 'done' && !w.ejected) endMission(w, 'lost', 'carrier')
  // The target that ends the sortie: when its explosion has played, the sortie is won.
  if (m.endAt >= 0 && w.tick >= m.endAt && m.stage !== 'done' && !w.ejected) {
    w.score += SCORE.landed
    endMission(w, 'won', 'delivered')
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
      if (m.t >= LAUNCH_TICKS) {
        m.stage = 'fly'
        m.t = 0
        w.events.push({ type: 'cue', cue: 'launched' })
        // A fight at home begins as the Calzone clears the deck.
        if (w.def.startHome) arrive(w, 0)
      }
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
        // The partner flies; the sortie's next point is where they go when it is quiet.
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
        const j = judge(w)
        endMission(w, j.won ? 'won' : 'lost', j.why)
      }
    }
  }

  // Ships fly. The Calzone under its controls; the AI under theirs; fixed parts ride their hulls.
  for (const s of w.ships) {
    if (!live(s)) continue
    if (s.id === w.player) { fly(s, c, dt); continue }
    if (s.parent >= 0) continue
    if (s.ai) {
      const ac = stepAi(w, s, dt)
      fly(s, ac, dt)
      aiWeapons(w, s, ac)
    } else {
      fly(s, makeIdle, dt)
    }
  }
  for (const s of w.ships) {
    if (s.parent < 0 || !live(s)) continue
    const p = shipAt(w, s.parent)
    if (p) placeAttached(s, p)
  }
  // The convoy: freighters creep on to the next nav point and stop short of it; they never chase a fight.
  for (const s of w.ships) {
    if (!live(s) || s.role !== 'protect' || s.id === w.carrier || !SHIPS[s.kind].capital || !s.ai) continue
    const goal = m.navs[m.nav] ?? m.navs[0]!
    copyTo(s.ai.aim, goal.pos)
    if (s.ai.mode !== 'nav') setMode(s.ai, 'nav')
    s.cruise = dist(s.pos, goal.pos) < 900 ? 0 : 60
  }
  // The Calzone's guns and missiles, by seat.
  if (live(me) && m.stage === 'fly' && crew.swapping === 0) {
    const tgt = shipAt(w, me.target)
    const assist = live(tgt) && leadDir(LEAD, me.pos, me, tgt, GUN.speed) && dist(tgt.pos, me.pos) < 2600 ? LEAD : null
    const cone = input.touch ? GUN.assistTouch : GUN.assistKeys
    if (c.fire) fireGuns(w, me, w.seat === 'front' ? 'front' : '', assist, w.seat === 'front' ? cone : 0.03)
    if (w.seat === 'front' && c.missile) launchMissile(w, me)
    if (w.seat === 'front') partnerTurret(w, crew, me, partnerPilot(w), dt)
    else playerTurret(w, crew, me, input, dt)
  }
  // Locks, for everyone who carries missiles (or the Calzone's torpedoes).
  for (const s of w.ships) if (live(s) && (s.missiles > 0 || s.torps > 0)) stepLock(w, s, dt)
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
  stepHulls(w)
  // Wrecks burn out and leave the list.
  for (let i = w.ships.length - 1; i >= 0; i--) {
    const s = w.ships[i]!
    if (s.dead > 0) s.dead++
    if ((s.dead > WRECK_TICKS || s.gone) && s.id !== w.player && s.id !== w.carrier) w.ships.splice(i, 1)
  }
  w.tick++
}

const makeIdle: Controls = makeControls()

const HL = v3()
/**
 * Big hulls are solid: a ship that flies into one is put back on its skin,
 * slowed, and scraped now and then. Without it the Calzone could sit inside a
 * drive-through and never be shot.
 */
function stepHulls(w: Voyage): void {
  for (const big of w.ships) {
    if (!live(big)) continue
    const h = HULLS[big.kind]
    if (!h) continue
    for (const s of w.ships) {
      if (!live(s) || s === big || SHIPS[s.kind].capital || s.parent >= 0) continue
      const reach = Math.max(h[0], h[1], h[2]) + s.r
      if (distSq(s.pos, big.pos) > reach * reach) continue
      subTo(HL, s.pos, big.pos)
      unrotateTo(HL, big.q, HL)
      const ex = h[0] + s.r, ey = h[1] + s.r, ez = h[2] + s.r
      const k = (HL.x / ex) ** 2 + (HL.y / ey) ** 2 + (HL.z / ez) ** 2
      if (k >= 1) continue
      const f = 1 / Math.sqrt(Math.max(k, 1e-6))
      HL.x *= f; HL.y *= f; HL.z *= f
      rotateTo(HL, big.q, HL)
      addTo(s.pos, big.pos, HL)
      s.speed *= 0.6
      if (s.sinceHit > 30) hurt(w, s, 10, big.pos, big.id)
      w.events.push({ type: 'scrape', a: s.id, b: big.id })
    }
  }
}

/** For the tests: lose the Calzone now. */
export function destroyCalzone(w: Voyage): void {
  const me = calzone(w)
  if (me) kill(w, me, -1)
}

const ALIGN = v3()
const ALIGN_FROM = v3()
/**
 * Are the guns of the seat the player is in on the target's lead, within
 * `cone` (radians) and in range? Touch fires by itself when they are (DESIGN.md,
 * "Guns"): the page asks this each tick.
 */
export function onTarget(w: Voyage, cone: number): boolean {
  const me = calzone(w)
  if (!live(me) || w.mission.stage !== 'fly' || w.crew.swapping > 0) return false
  if (w.seat === 'front') {
    const t = shipAt(w, me.target)
    if (!live(t) || t.side === me.side || dist(t.pos, me.pos) > 2200 || SHIPS[t.kind].gunproof) return false
    if (!leadDir(ALIGN, me.pos, me, t, GUN.speed)) return false
    forwardTo(FWD, me.q)
    return angleBetween(FWD, ALIGN) < cone
  }
  const tur = calzoneTurret(me)
  const t = shipAt(w, w.crew.target)
  if (!tur || !live(t) || dist(t.pos, me.pos) > 1600) return false
  turretWorld(me, tur, ALIGN_FROM, FWD)
  if (!leadDir(ALIGN, ALIGN_FROM, me, t, GUN.turretSpeed)) return false
  return angleBetween(FWD, ALIGN) < cone
}
