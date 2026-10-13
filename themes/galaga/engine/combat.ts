/**
 * Space Voyagers: who gets hurt and what it is worth. Hits on enemies, on the
 * boss, on the player (bubble, valves, tows, GAME OVER) and on the partner
 * (three and it limps off); the score, the kill chain and the DUET needle.
 */
import { BONUS, BOSS_SOAK, CAPTOR, DUET, PARTNER, PLAYER, SCORE, TALK, chainMul } from './balance.ts'
import { HIT_CUE, PARTNER_CUE } from './cuemap.ts'
import { maybeDrop } from './pickups.ts'
import type { Boss, Enemy, World } from './types.ts'
import { clearDanger, cue, emit, spawnEnemy } from './world.ts'

/** Add points with the chain and the quarter applied; returns what was added. */
export function addScore(w: World, base: number, chained = true): number {
  const pts = Math.round(base * (chained ? w.chainMul : 1) * (w.player.quarter > 0 ? 2 : 1))
  w.score += pts
  return pts
}

function feedDuet(w: World, amount: number): void {
  if (w.duet > 0 || w.duetMeter >= 1) return
  w.duetMeter = Math.min(1, w.duetMeter + amount)
  if (w.duetMeter >= 1) {
    emit(w, 'duetReady')
    cue(w, 'duet.teach', 'duet.ready')
  }
}

/** The captor let go: on the dive the partner docks, in formation it is only loose. */
export function freePartner(w: World, dock: boolean): void {
  const q = w.partner
  if (q.state !== 'hanging' && q.state !== 'beamed') return
  const wasHanging = q.state === 'hanging'
  q.captor = -1
  q.hits = 0
  q.invuln = PARTNER.invuln
  q.t = 0
  if (!wasHanging) { q.state = 'fly'; return }
  if (dock) {
    q.state = 'docking'
    emit(w, 'freed', q.x, q.y)
    cue(w, PARTNER_CUE[w.partnerPilot].freed)
  } else {
    q.state = 'fly'
    emit(w, 'loose', q.x, q.y)
    cue(w, PARTNER_CUE[w.partnerPilot].loose)
  }
}

/** Pop an enemy. With `credit` it is the player's: points, chain, needle, a drop. */
export function popEnemy(w: World, e: Enemy, credit: boolean): void {
  if (!e.active) return
  e.active = false
  let pts = 0
  if (e.bonus) {
    if (credit) {
      w.bonusHits++
      pts = addScore(w, BONUS.each, false)
      feedDuet(w, DUET.perKillHp * 0.5)
    }
    emit(w, 'pop', e.x, e.y, e.kind, pts)
    return
  }
  const onDive = e.state !== 'form' && e.state !== 'enter' && e.state !== 'wait'
  if (credit) {
    w.chain++
    w.chainT = SCORE.chainTicks
    const mul = chainMul(w.chain)
    if (mul > w.chainMul) emit(w, 'chain', e.x, e.y, '', mul)
    w.chainMul = mul
    pts = addScore(w, e.carrying && onDive ? CAPTOR.freedScore : e.score)
    w.kills++
    w.stats.kills++
    feedDuet(w, DUET.perKillHp * e.maxHp)
    maybeDrop(w, e)
  }
  emit(w, 'pop', e.x, e.y, e.kind, pts)
  if (e.carrying) {
    e.carrying = false
    freePartner(w, onDive)
  } else if (w.partner.state === 'beamed' && w.enemies[w.partner.captor] === e) {
    freePartner(w, false)
  }
  if (e.role === 'splitter') {
    emit(w, 'split', e.x, e.y, e.kind)
    cue(w, 'see.splitter')
    for (let s = -1; s <= 1; s += 2) {
      const m = spawnEnemy(w, 'mite', e.gang, e.x + s * 7, e.y)
      if (!m) break
      m.state = 'free'
      m.vx = s * 0.7
      m.vy = 1.25
    }
  }
}

/** Returns true when it popped. */
export function hurtEnemy(w: World, e: Enemy, dmg: number, credit: boolean): boolean {
  if (!e.active) return false
  // A captor on its way to the partner has its shield up (enemies.ts): the shot glances off.
  if (e.shield) {
    emit(w, 'hit', e.x, e.y, 'armor')
    return false
  }
  e.hp -= dmg
  if (e.hp <= 0) {
    popEnemy(w, e, credit)
    return true
  }
  e.flash = 0
  emit(w, 'hit', e.x, e.y, 'enemy')
  return false
}

/** Is (x, y), grown by a shot's half sizes, inside the boss's body? */
export function inBody(b: Boss, x: number, y: number, hw: number, hh: number): boolean {
  if (Math.abs(x - b.x) >= hw + b.hw || Math.abs(y - b.y) >= hh + b.hh) return false
  if (!b.round) return true
  // Half an ellipse, flat side up: as wide as the body at its top edge, a point at its bottom.
  const u = (Math.abs(x - b.x) - hw) / b.hw
  const v = (y - hh - (b.y - b.hh)) / (b.hh * 2)
  return u <= 0 ? v < 1 : v <= 0 ? u < 1 : u * u + v * v < 1
}

/** The y of the body's lower edge at column x (the bottom of its box; for a round body, of the half disc). */
export function bodyBottom(b: Boss, x: number): number {
  if (!b.round) return b.y + b.hh
  const u = Math.min(1, Math.abs(x - b.x) / b.hw)
  return b.y - b.hh + b.hh * 2 * Math.sqrt(1 - u * u)
}

/**
 * Damage to the boss; it cannot be hurt while it walks on or goes down. Gunfire is soaked
 * (BOSS_SOAK); `raw` damage (a rig, the mirror ball, a friend's pass) is taken whole.
 */
export function hurtBoss(w: World, dmg: number, raw = false): boolean {
  const b = w.boss
  if (!b.active || (b.state !== 'fight' && b.state !== 'ram') || b.hp <= 0) return false
  if (!raw) {
    const full = Math.min(dmg, b.soak)
    b.soak -= full
    dmg = full + (dmg - full) * BOSS_SOAK.over
    if (w.sector === 5) {
      // The last fight is as long as its talk: gunfire counts for less while the radio is behind.
      const behind = w.air - w.tick
      if (behind > TALK.airGrace) dmg *= Math.max(TALK.airFloor, 1 - (behind - TALK.airGrace) / (TALK.airSlow - TALK.airGrace))
    }
  }
  // The Deaf Star does not go down while a friend is still owed a pass: the last of them finishes it.
  if (b.id === 'deafstar' && w.sector === 5 && w.passDue > 0 && w.passQueue.length > 0) dmg = Math.min(dmg, Math.max(0, b.hp - 1))
  b.hp = Math.max(0, b.hp - dmg)
  b.flash = 0
  b.sinceHit = 0
  feedDuet(w, DUET.perBossHit * dmg)
  emit(w, 'hit', b.x + b.wx, b.y + b.wy, 'boss')
  return true
}

function gameOver(w: World): void {
  w.over = true
  w.stage = 'over'
  w.stageT = 0
  emit(w, 'gameover', w.player.x, w.player.y)
  emit(w, 'card', 0, 0, 'gameover', w.score)
}

/** Something hit the player's cockpit. Returns true when it counted. */
export function hurtPlayer(w: World): boolean {
  const p = w.player
  if (w.over || p.invuln > 0 || p.towing > 0) return false
  w.stats.hits++
  if (p.bubble > 0) {
    p.bubble--
    p.invuln = PLAYER.invuln >> 1
    emit(w, 'bubble', p.x, p.y, '', p.bubble)
    if (p.bubble === 0) emit(w, 'powerOff', p.x, p.y, 'bubble')
    return true
  }
  p.hull--
  p.invuln = PLAYER.invuln
  p.level = Math.max(1, p.level - PLAYER.hitLevelLoss)
  w.chain = 0
  w.chainMul = 1
  emit(w, 'valve', p.x, p.y, '', p.hull)
  if (p.hull > 0) {
    if (p.hull === 1) cue(w, 'lowHull')
    cue(w, HIT_CUE[w.pilot])
    return true
  }
  if (p.tows <= 0) {
    gameOver(w)
    return true
  }
  // The partner hooks on: the field is cleared and the ship comes back with three valves.
  p.tows--
  p.towing = PLAYER.towTicks
  w.stats.tows++
  clearDanger(w, 0)
  emit(w, 'tow', p.x, p.y, '', p.tows)
  cue(w, p.tows === 0 ? 'tow.last' : 'tow.first')
  return true
}

/** Something hit the partner. It cannot die: the third hit sends it off to mend. */
export function hurtPartner(w: World): boolean {
  const q = w.partner
  if (q.state !== 'fly' || q.invuln > 0 || w.player.towing > 0) return false
  q.hits++
  q.invuln = PARTNER.invuln
  emit(w, 'partnerHit', q.x, q.y, '', q.hits)
  if (q.hits >= PARTNER.hits) {
    q.state = 'limp'
    q.t = 0
    emit(w, 'limp', q.x, q.y)
    cue(w, PARTNER_CUE[w.partnerPilot].limp)
  } else {
    cue(w, PARTNER_CUE[w.partnerPilot].hit)
  }
  return true
}

/** Once a tick: the chain runs out, the DUET plays down. */
export function stepScoreTimers(w: World): void {
  if (w.chain > 0 && --w.chainT <= 0) {
    w.chain = 0
    w.chainMul = 1
  }
  if (w.duet > 0) {
    w.duet--
    w.duetMeter = w.duet / DUET.ticks
    if (w.duet === 0) {
      w.duetMeter = 0
      emit(w, 'duetOff', w.player.x, w.player.y)
      cue(w, 'duet.end')
    }
  }
}

/** DUET pressed with the needle full. */
export function startDuet(w: World): boolean {
  if (w.duet > 0 || w.duetMeter < 1 || w.over || w.player.towing > 0) return false
  w.duet = DUET.ticks
  w.stats.duets++
  clearDanger(w, DUET.cancelScore)
  emit(w, 'duetOn', w.player.x, w.player.y)
  cue(w, 'duet.go')
  return true
}
