/**
 * Space Voyagers: the five bosses and the Deaf Star. Walking on, moving,
 * choosing the next attack (attacks.ts), changing phase, going down. What
 * makes each one its own fight:
 *
 *   SATURDAY KNIGHT   sways under his mirror ball; rays sweep, the floor lights up in squares
 *   LORD HUMDINGER    shows a lane and charges down it; mines that sit; hogs from the trailer
 *   DURANT DURANT     the organ's keys are columns; left alone it cools, so it must be overplayed
 *   CAL 9000          a wall; only the lens takes damage, and doors shut across the field to a gap
 *   DARK FADER        follows the ship; bars come down the field with one gap to thread
 *   THE DEAF STAR     fills the top; a tweeter 18 px wide; rings of bass, the one note, three phases
 */
import { ATTACK, BOSSES, BOSS_SOAK, SCORE, STAGE, TALK, bossHp } from './balance.ts'
import { addScore, popEnemy } from './combat.ts'
import { BOSS_CUE } from './cuemap.ts'
import { beginAttack, runAttack } from './attacks.ts'
import { callCavalry } from './friends.ts'
import { enemyTime } from './player.ts'
import { chance, randRange } from './rng.ts'
import type { Boss, BossKind, World } from './types.ts'
import { clearDanger, cue, emit, spawnPickup } from './world.ts'

/** Bosses that are a wall along the top sit against it; the others float below. */
const WALLS: readonly BossKind[] = ['cal', 'deafstar']

export function startBoss(w: World, id: BossKind): void {
  const def = BOSSES[id]
  const b = w.boss
  b.active = true
  b.id = id
  b.kind = `boss-${id}`
  b.hw = def.hw; b.hh = def.hh
  b.wx = def.weak[0]; b.wy = def.weak[1]; b.whw = def.weak[2]; b.whh = def.weak[3]
  b.hp = b.maxHp = bossHp(id, w.voyage)
  b.phase = 1
  b.state = 'enter'
  b.t = 0
  b.homeY = def.hh + (WALLS.includes(id) ? 6 : 26) + (w.h - 320) * 0.1
  b.x = w.w / 2
  b.y = -def.hh - 10
  b.attack = ''
  b.attackT = 0
  b.steps = 0
  b.stepT = 0
  b.rest = 80
  b.rot = 0
  b.flash = 99
  b.sinceHit = 0
  b.soak = BOSS_SOAK.dps
  b.a = 0
  b.b = 0
  w.barriers[0]!.active = false
  if (w.sector === 5 && id === 'fader') {
    // The last fight: everyone met on the way is owed a pass.
    w.passQueue.length = 0
    for (let i = 0; i < w.friends.length; i++) w.passQueue.push(w.friends[i]!)
    w.passDue = 0
  }
  emit(w, 'bossIn', b.x, b.y, id, b.maxHp)
  cue(w, BOSS_CUE[id].enter)
  if (id === 'deafstar') callCavalry(w, false)
}

function die(w: World, b: Boss): void {
  b.state = 'dying'
  b.t = 0
  b.attack = ''
  clearDanger(w, 0)
  w.barriers[0]!.active = false
  // Its helpers go with it.
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (e.active && e.role !== 'raider') popEnemy(w, e, false)
  }
  addScore(w, SCORE.boss * w.sector, false)
  w.stats.bossesDown++
  spawnPickup(w, 'pizza', b.x - 16, b.y + b.hh)
  spawnPickup(w, 'tube', b.x + 16, b.y + b.hh)
  emit(w, 'bossDown', b.x, b.y, b.id, w.sector)
  cue(w, BOSS_CUE[b.id].dead)
}

/** CAL's pod-bay doors: open, then shut to a gap that drifts, then open again. */
function stepDoors(w: World, b: Boss, dt: number): void {
  const D = ATTACK.doors
  const d = w.barriers[0]!
  if (!d.active) {
    d.active = true
    d.y = b.homeY + D.below
    d.hh = 5
    d.shut = 0
    d.dir = 0
    d.gapX = w.w / 2
    d.gapW = D.gap
    d.vx = 0
    b.b = D.open
  }
  b.b -= dt
  if (d.dir === 0 && b.b <= 0) {
    if (d.shut === 0) {
      d.dir = 1
      d.gapW = b.phase >= 2 ? D.gap2 : D.gap
      d.gapX = randRange(w.rng, 50, w.w - 50)
      d.vx = (chance(w.rng, 0.5) ? -1 : 1) * D.drift * (b.phase >= 2 ? 1.6 : 1)
      emit(w, 'door', d.gapX, d.y, '', 1)
    } else {
      d.dir = -1
      emit(w, 'door', d.gapX, d.y, '', 0)
    }
  }
  if (d.dir !== 0) {
    d.shut = Math.max(0, Math.min(1, d.shut + d.dir * dt / D.shutTicks))
    if (d.shut === 1) { d.dir = 0; b.b = D.shut } else if (d.shut === 0) { d.dir = 0; b.b = D.open * (b.phase >= 2 ? 0.5 : 1) }
  }
  if (d.shut === 1) {
    d.gapX += d.vx * dt
    const lo = d.gapW / 2 + 10
    if (d.gapX < lo) { d.gapX = lo; d.vx = Math.abs(d.vx) }
    if (d.gapX > w.w - lo) { d.gapX = w.w - lo; d.vx = -Math.abs(d.vx) }
  }
}

function move(w: World, b: Boss, dt: number): void {
  const mid = w.w / 2
  if (b.state === 'ram') return
  switch (b.id) {
    case 'knight':
      b.x = mid + Math.sin(b.t * 0.015) * 60
      b.y = b.homeY + Math.sin(b.t * 0.05) * 3
      break
    case 'humdinger': {
      const tx = mid + Math.sin(b.t * 0.01) * 70
      b.x += Math.max(-1.2, Math.min(1.2, tx - b.x))
      break
    }
    case 'durant': {
      // The Excess Machine cools when nobody plays it; never back past the phase it has reached.
      const C = ATTACK.cool
      if (b.sinceHit > C.after) {
        const def = BOSSES.durant
        const top = b.phase === 1 ? 1 : def.phases[b.phase - 2]!
        b.hp = Math.min(b.maxHp * top, b.hp + C.per * dt)
      }
      break
    }
    case 'cal':
      // The lens slides along the wall.
      b.wx = Math.sin(b.t * 0.012) * 70
      stepDoors(w, b, dt)
      break
    case 'fader': {
      const tx = Math.max(40, Math.min(w.w - 40, w.player.x))
      b.x += Math.max(-0.5, Math.min(0.5, tx - b.x)) * dt
      b.y = b.homeY + Math.sin(b.t * 0.03) * 6
      break
    }
    case 'deafstar':
      break
  }
}

export function stepBoss(w: World): void {
  const b = w.boss
  if (!b.active) return
  const def = BOSSES[b.id]
  const dt = enemyTime(w)
  b.t++
  b.flash++
  b.sinceHit++
  b.soak = Math.min(BOSS_SOAK.dps, b.soak + BOSS_SOAK.dps / 60)
  if (b.state === 'enter') {
    b.y += (b.homeY + def.hh + 10) / STAGE.bossEnter
    if (b.y >= b.homeY) {
      b.y = b.homeY
      b.state = 'fight'
      b.t = 0
    }
    return
  }
  if (b.state === 'dying') {
    if (b.t % 9 === 0) emit(w, 'pop', b.x + randRange(w.rng, -b.hw, b.hw), b.y + randRange(w.rng, -b.hh, b.hh), b.kind, 0)
    if (b.t >= STAGE.bossDying) b.active = false
    return
  }
  if (b.hp <= 0) {
    die(w, b)
    return
  }
  const share = b.hp / b.maxHp
  const phase = def.phases[1] > 0 && share <= def.phases[1] ? 3 : share <= def.phases[0] ? 2 : 1
  if (phase > b.phase) {
    b.phase = phase
    emit(w, 'bossPhase', b.x, b.y, b.id, phase)
    const half = BOSS_CUE[b.id].half
    if (phase === 2 && half) cue(w, half)
    callCavalry(w, b.id === 'deafstar' && phase === 3)
  }
  move(w, b, dt)
  if (b.attack === '') {
    b.rest -= dt
    if (b.rest <= 0) {
      const list = def.attacks[Math.min(def.attacks.length, b.phase) - 1]!
      beginAttack(w, b, b.force || list[b.rot++ % list.length]!)
      // It plays faster the more it has been hurt.
      b.rest = def.rest[0] + (def.rest[1] - def.rest[0]) * (1 - share)
    }
  } else {
    runAttack(w, b, dt)
  }
  const taunt = BOSS_CUE[b.id].taunt
  if (taunt && b.t % TALK.taunt === TALK.taunt - 1) cue(w, taunt)
}
