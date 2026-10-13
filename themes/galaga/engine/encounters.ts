/**
 * Space Voyagers: the sector's event, running through waves 3 and 4. A
 * convoy (a trucker's rig, or three, coming up a side lane with a cargo bar)
 * or a rescue (a stalled ship, jumper cables, a bar that fills while the
 * player holds beside it), and the raiders that go for either instead of
 * for the player.
 */
import type { ConvoyId, RescueId } from '../story/cues.ts'
import {
  CONVOY, CONVOY_RIGS, GANGS, RAIDER, RESCUE, SCORE, SECTORS, TALK, difficulty, raiderEvery,
} from './balance.ts'
import { addScore } from './combat.ts'
import { CONVOY_CUE, RESCUE_CUE } from './cuemap.ts'
import { chooseDrop } from './pickups.ts'
import { chance, randRange } from './rng.ts'
import type { Enemy, FriendId, World } from './types.ts'
import { cue, emit, spawnEnemy, spawnPickup, spawnRig } from './world.ts'

/** Is the event still to be settled? The boss waits for it. */
export function eventBusy(w: World): boolean {
  return w.convoy.active || w.wing.state === 'drift' || w.wing.state === 'stalled'
}

function befriend(w: World, id: FriendId): void {
  if (!w.friends.includes(id)) w.friends.push(id)
  emit(w, 'friend', 0, 0, id, w.friends.length)
}

/** Wave 3 begins: the rig comes up its lane, or the stalled ship drifts in. */
export function startEvent(w: World): void {
  const def = SECTORS[w.sector - 1]!.event
  w.eventStarted = true
  w.raidT = RAIDER.first
  w.chatT = TALK.chat
  const left = chance(w.rng, 0.5)
  if (def.type === 'convoy') {
    const kinds = CONVOY_RIGS[def.id]
    const x = left ? CONVOY.laneX : w.w - CONVOY.laneX
    const span = kinds.length * (CONVOY.rigHh * 2 + CONVOY.gap)
    const vy = -(w.h + span + 20) / CONVOY.ticks
    for (let i = 0; i < kinds.length; i++) {
      const y = w.h + CONVOY.rigHh + 10 + i * (CONVOY.rigHh * 2 + CONVOY.gap)
      spawnRig(w, kinds[i]!, 'convoy', x, y, vy, CONVOY.rigHw, CONVOY.rigHh)
    }
    const c = w.convoy
    c.active = true; c.id = def.id; c.cargo = 1; c.t = 0; c.done = false
    emit(w, 'convoyIn', x, w.h, def.id)
    cue(w, CONVOY_CUE[def.id].hail)
  } else {
    const g = w.wing
    g.state = 'drift'; g.id = def.id; g.kind = `stranded-${def.id}`
    g.x = left ? w.w * 0.3 : w.w * 0.7
    g.y = -RESCUE.hh - 6
    g.bar = 0; g.t = 0; g.fireT = 0
    emit(w, 'rescueIn', g.x, g.y, def.id)
    cue(w, RESCUE_CUE[def.id].hail)
  }
}

function spawnRaider(w: World): void {
  const fromLeft = chance(w.rng, 0.5)
  const e = spawnEnemy(w, 'raider', w.gang, fromLeft ? -14 : w.w + 14, randRange(w.rng, 30, w.h * 0.3))
  if (!e) return
  e.state = 'seek'
  if (w.convoy.active) {
    // Onto the side of one of the rigs.
    let n = 0
    for (let i = 0; i < w.rigs.length; i++) if (w.rigs[i]!.active && w.rigs[i]!.job === 'convoy') n++
    let k = Math.floor(randRange(w.rng, 0, n))
    e.mode = -1
    for (let i = 0; i < w.rigs.length; i++) {
      const r = w.rigs[i]!
      if (r.active && r.job === 'convoy' && r.y - r.hh < w.h - 60 && r.y + r.hh > 60) e.mode = i
      if (r.active && r.job === 'convoy' && k-- === 0 && e.mode >= 0) break
    }
    e.ox = (chance(w.rng, 0.5) ? -1 : 1) * (CONVOY.rigHw + 5)
    e.oy = randRange(w.rng, -CONVOY.rigHh * 0.8, CONVOY.rigHh * 0.8)
  } else {
    const a = randRange(w.rng, 0, Math.PI * 2)
    e.mode = -1
    e.ox = Math.cos(a) * (RESCUE.hw + 9)
    e.oy = Math.sin(a) * (RESCUE.hh + 8)
  }
}

/** A raider flies to the thing it is after and holds on. Called from the enemy loop. */
export function stepRaider(w: World, e: Enemy, dt: number): void {
  let tx = 0
  let ty = 0
  let has = false
  if (w.convoy.active && !w.convoy.done && e.mode >= 0) {
    const r = w.rigs[e.mode]!
    // It holds on to the part of the rig that is in the field.
    if (r.active) {
      tx = r.x + e.ox
      ty = Math.max(14, Math.min(w.h - 12, r.y + e.oy))
      has = r.y - r.hh < w.h - 24 && r.y + r.hh > 20
    }
  } else if (w.wing.state === 'stalled' || w.wing.state === 'drift') {
    tx = w.wing.x + e.ox
    ty = w.wing.y + e.oy
    has = true
  }
  if (!has) {
    // Nothing left to take: it goes.
    e.state = 'free'
    e.vx = 0
    e.vy = -2.2
    return
  }
  if (e.state === 'latch') {
    e.x = tx
    e.y = ty
    return
  }
  const dx = tx - e.x
  const dy = ty - e.y
  const d = Math.hypot(dx, dy)
  const sp = RAIDER.speed * GANGS[e.gang].speed * dt
  if (d <= sp + 1) {
    e.x = tx
    e.y = ty
    e.state = 'latch'
    emit(w, 'latch', e.x, e.y, w.convoy.active ? 'rig' : 'stranded')
  } else {
    e.x += dx / d * sp
    e.y += dy / d * sp
  }
}

function raiders(w: World): number {
  let n = 0
  for (let i = 0; i < w.enemies.length; i++) if (w.enemies[i]!.active && w.enemies[i]!.role === 'raider') n++
  return n
}

/** Is enough of a convoy rig in the field for a raider to go for? */
function rigInField(w: World): boolean {
  for (let i = 0; i < w.rigs.length; i++) {
    const r = w.rigs[i]!
    if (r.active && r.job === 'convoy' && r.y - r.hh < w.h - 60 && r.y + r.hh > 60) return true
  }
  return false
}

function stepConvoy(w: World): void {
  const c = w.convoy
  const id: ConvoyId = c.id
  c.t++
  let onField = 0
  for (let i = 0; i < w.rigs.length; i++) {
    const r = w.rigs[i]!
    if (!r.active || r.job !== 'convoy') continue
    r.y += r.unhooked ? r.vy * 4 : r.vy
    if (r.y + r.hh < -4) r.active = false
    else onField++
  }
  if (!c.done && w.latched > 0) {
    c.cargo = Math.max(0, c.cargo - w.latched * CONVOY.drain)
    cue(w, CONVOY_CUE[id].threat)
    if (c.t % 30 === 0) emit(w, 'cargo', 0, 0, id, c.cargo)
    if (c.cargo <= 0) {
      // Cargo gone: the cab unhooks and drives on.
      c.done = true
      for (let i = 0; i < w.rigs.length; i++) if (w.rigs[i]!.job === 'convoy') w.rigs[i]!.unhooked = true
      emit(w, 'convoyLost', 0, 0, id)
      cue(w, CONVOY_CUE[id].lost)
    }
  }
  if (onField === 0) {
    c.active = false
    if (!c.done) {
      // Home safe: a crate of two, a bonus, and a friend.
      c.done = true
      addScore(w, SCORE.convoy, false)
      befriend(w, id)
      spawnPickup(w, 'tube', w.w / 2 - 20, 24)
      for (let k = 1; k < CONVOY.crate; k++) spawnPickup(w, chooseDrop(w), w.w / 2 + 20 * k, 24)
      emit(w, 'convoySafe', 0, 0, id)
      cue(w, CONVOY_CUE[id].safe)
    }
    return
  }
  if (!c.done && --w.chatT <= 0) {
    w.chatT = TALK.chat
    cue(w, CONVOY_CUE[id].chat)
  }
}

function stepRescue(w: World): void {
  const g = w.wing
  const p = w.player
  const id: RescueId = g.id
  const home = w.h * RESCUE.yShare
  g.t++
  if (g.state === 'drift') {
    g.y += RESCUE.driftIn
    if (g.y >= home) g.state = 'stalled'
    return
  }
  // Raiders on it drag it up and off; left alone it settles back.
  if (w.latched > 0) g.y -= w.latched * RESCUE.drag
  else if (g.y < home) g.y = Math.min(home, g.y + RESCUE.settle)
  if (g.y < -RESCUE.hh - 4) {
    g.state = 'off'
    emit(w, 'rescueLost', g.x, g.y, id)
    cue(w, RESCUE_CUE[id].lost)
    return
  }
  // The jumper cables: hold within reach with the raiders cleared and the bar fills.
  const near = Math.hypot(p.x - g.x, p.y - g.y) < RESCUE.reach && p.towing === 0
  if (near && w.latched === 0) {
    if (g.bar === 0) {
      emit(w, 'cables', g.x, g.y, id)
      cue(w, RESCUE_CUE[id].cables)
    }
    g.bar += RESCUE.fill
    if (g.bar >= 1) {
      g.bar = 1
      g.state = 'flying'
      g.t = 0
      addScore(w, SCORE.rescue, false)
      befriend(w, id)
      emit(w, 'rescued', g.x, g.y, id)
      cue(w, RESCUE_CUE[id].saved)
    }
  } else if (g.bar > 0) {
    g.bar = Math.max(0.0001, g.bar - RESCUE.drain)
  }
}

export function stepEncounter(w: World): void {
  const convoy = w.convoy.active
  const stalled = w.wing.state === 'stalled'
  if (convoy) stepConvoy(w)
  else if (stalled || w.wing.state === 'drift') stepRescue(w)
  if ((w.convoy.active && !w.convoy.done) || w.wing.state === 'stalled') {
    if (--w.raidT <= 0 && (!w.convoy.active || rigInField(w))) {
      const d = difficulty(w.sector, w.voyage)
      w.raidT = raiderEvery(d)
      if (raiders(w) < Math.min(RAIDER.max, 2 + Math.floor(d / 2))) spawnRaider(w)
    }
  }
}
