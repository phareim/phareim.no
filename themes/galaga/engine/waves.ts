/**
 * Space Voyagers: Galaga's waves. A wave is rows of letters (balance.ts,
 * SECTORS); here they become strings of enemies that fly in along curves to a
 * formation that sways and breathes, and a director that sends them diving,
 * alone or in pairs, and lets the formation fire. Also the bonus run: strings
 * that fly through and never shoot.
 */
import {
  BONUS, CAPTOR, DIVER_WARN, FORMATION, GANGS, ROLE_LETTER, SNIPER, STRING, TANK, boltCap, boltSpeed, difficulty, diveEvery,
  diveAfter, diveTicks, diverSpeed, enterTicks, fireEvery, maxDivers, pairChance, tankHp, veteranHp,
} from './balance.ts'
import { SEE_GANG } from './cuemap.ts'
import { enemyTime } from './player.ts'
import { chance, rand, randInt, randRange } from './rng.ts'
import type { Enemy, World } from './types.ts'
import { cue, emit, spawnAim, spawnBolt, spawnEnemy } from './world.ts'

export function slotX(w: World, col: number): number {
  const f = w.formation
  return w.w / 2 + (col - (f.cols - 1) / 2) * f.dx + f.off
}
export function slotY(w: World, row: number): number {
  const f = w.formation
  return f.top + row * f.dy
}

export function stepFormation(w: World): void {
  const f = w.formation
  const g = GANGS[w.gang]
  f.t += enemyTime(w)
  let off = Math.sin(f.t * FORMATION.swayRate) * g.swayAmp
  if (g.sway === 'step') off = Math.round(off / FORMATION.stepPx) * FORMATION.stepPx
  f.off = off
  f.dx = FORMATION.dx * (1 + FORMATION.breathe * Math.sin(f.t * 0.013))
}

function curve(e: Enemy, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, ex: number, ey: number): void {
  e.ax = ax; e.ay = ay; e.bx = bx; e.by = by; e.cx = cx; e.cy = cy; e.ex = ex; e.ey = ey
}

/** Begin a wave: every enemy is made now and waits its turn to fly in. */
export function startWave(w: World, rows: readonly string[]): void {
  const f = w.formation
  const d = difficulty(w.sector, w.voyage)
  const g = GANGS[w.gang]
  const H = w.h
  const mid = w.w / 2
  f.cols = FORMATION.cols
  f.rows = rows.length
  f.dy = FORMATION.dy
  f.top = FORMATION.top + (H - 320) * 0.1
  let string = 0
  let count = 0
  let last = 0
  for (let r = rows.length - 1; r >= 0; r--) {
    for (let half = 0; half < 2; half++) {
      const s = half === 0 ? -1 : 1
      let k = 0
      for (let j = 0; j < 4; j++) {
        const col = half === 0 ? 3 - j : 4 + j
        const role = ROLE_LETTER[rows[r]![col]!]
        if (!role) continue
        const e = spawnEnemy(w, role, w.gang, -40, -40)
        if (!e) continue
        e.col = col
        e.row = r
        if (role === 'tank') e.hp = e.maxHp = Math.min(5, tankHp(d) + g.tankHp)
        else if (role !== 'captor' && role !== 'splitter') e.hp = e.maxHp = e.hp + veteranHp(d)
        const delay = string * STRING.between + k * STRING.gap
        last = Math.max(last, delay)
        e.t = -delay
        e.dur = enterTicks(d) / g.speed * (role === 'flanker' ? 1.3 : 1)
        if (role === 'flanker') curve(e, mid + s * 140, H * 0.28, mid - s * 10, H * 0.8, mid - s * 90, H * 0.45, 0, 0)
        else if (r % 2 === 0) curve(e, mid + s * 24, -20, mid + s * 130, H * 0.3, mid + s * 70, H * 0.62, 0, 0)
        else curve(e, mid + s * 140, H * 0.5, mid + s * 20, H * 0.62, mid - s * 30, 30, 0, 0)
        e.fireT = role === 'tank' ? TANK.every * (0.5 + rand(w.rng)) : SNIPER.every * (0.4 + rand(w.rng))
        // The captor arrives with its shield up and goes for the partner as soon as it has settled.
        if (role === 'captor') { e.shield = true; e.fireT = CAPTOR.settle }
        k++
        count++
      }
      if (k > 0) string++
    }
  }
  w.waveSize = count
  w.waveLeft = count
  w.toEnter = count
  w.diveT = diveEvery(d) + 60
  w.fireT = fireEvery(d) + last
  emit(w, 'wave', 0, 0, w.gang, w.wave)
  cue(w, SEE_GANG[w.gang])
}

/** Send one out of the formation. */
export function launchDive(w: World, e: Enemy, index: number): void {
  const p = w.player
  const d = difficulty(w.sector, w.voyage)
  const g = GANGS[w.gang]
  const H = w.h
  const sx = e.x
  const sy = e.y
  const tx = Math.max(16, Math.min(w.w - 16, p.x + randRange(w.rng, -16, 16)))
  const side = sx < w.w / 2 ? -1 : 1
  e.t = 0
  e.mode = 0
  e.fireT = g.diveShots
  e.dur = diveTicks(d) / g.speed
  emit(w, 'peel', sx, sy, e.kind)
  if (e.role === 'diver') {
    // Aims itself at the player, shows the line, and goes.
    e.state = 'aim'
    e.dur = DIVER_WARN
    const sp = diverSpeed(d)
    const dist = Math.hypot(p.x - sx, p.y - sy) || 1
    e.vx = (p.x - sx) / dist * sp
    e.vy = (p.y - sy) / dist * sp
    spawnAim(w, 'diver', sx, sy, p.x, p.y, DIVER_WARN, sp, index)
    return
  }
  e.state = 'dive'
  if (e.role === 'captor' && !e.carrying) {
    // Down to hover over the partner; the beam comes on there.
    const q = w.partner
    const hx = Math.max(20, Math.min(w.w - 20, q.x))
    const hy = Math.max(sy + 30, q.y - CAPTOR.hoverUp)
    curve(e, sx, sy, sx + side * 30, sy - 20, hx, hy - 50, hx, hy)
    e.dur = CAPTOR.dive
    e.mode = 1
    e.fireT = 0
    e.shield = true
  } else if (e.role === 'tank') {
    // Slow, straight down to mid-field for a three-way shot, and back.
    curve(e, sx, sy, sx, sy, sx, H * 0.46, sx, H * 0.46)
    e.dur = 130
    e.mode = 1
    e.fireT = 0
  } else if (e.role === 'flanker') {
    curve(e, sx, sy, sx, H * 0.55, tx, H * 0.98, w.w / 2 - side * 150, H * 0.5)
  } else if (g.dive === 'charge') {
    curve(e, sx, sy, sx, sy + 10, tx, H * 0.45, tx, H + 24)
    e.dur *= 0.85
  } else if (g.dive === 'rail') {
    curve(e, sx, sy, sx, H * 0.4, sx, H * 0.7, sx, H + 24)
  } else {
    curve(e, sx, sy, sx + side * 50, sy - 34, tx - side * 70, H * 0.6, tx, H + 24)
  }
}

/** Count the wave once a tick, then send dives and let the formation fire. */
export function stepWaveDirector(w: World): void {
  const dt = enemyTime(w)
  const d = difficulty(w.sector, w.voyage)
  const g = GANGS[w.gang]
  let left = 0
  let entering = 0
  let inForm = 0
  let diving = 0
  let latched = 0
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.active) continue
    if (e.role === 'raider') { if (e.state === 'latch') latched++; continue }
    if (e.bonus) continue
    left++
    if (e.state === 'wait' || e.state === 'enter') entering++
    else if (e.state === 'form') { if (e.frozen <= 0) inForm++ } else if (e.col >= 0) diving++
  }
  let bolts = 0
  for (let i = 0; i < w.bolts.length; i++) if (w.bolts[i]!.active) bolts++
  w.waveLeft = left
  w.toEnter = entering
  w.inForm = inForm
  w.diving = diving
  w.boltsOut = bolts
  w.latched = latched
  if (w.stage !== 'wave' || inForm === 0 || (entering > 0 && inForm < diveAfter(d))) return

  // The last few do not wait their turn, and nobody stays home.
  const endgame = left <= 3
  w.diveT -= dt
  if (w.diveT <= 0 && diving < maxDivers(d)) {
    // The captor does not wait to be picked: while there is a partner to take, it often goes first.
    let first = chance(w.rng, 0.4) ? captorReady(w) : -1
    if (first < 0) first = pickFormed(w, endgame, -1, -1)
    if (first >= 0) {
      const e = w.enemies[first]!
      const row = e.row
      const col = e.col
      launchDive(w, e, first)
      if (chance(w.rng, pairChance(d) + g.pair) && diving + 1 < maxDivers(d)) {
        const second = pickFormed(w, endgame, row, col)
        if (second >= 0) launchDive(w, w.enemies[second]!, second)
      }
    }
    w.diveT = diveEvery(d) * (endgame ? 0.5 : 1)
  }

  w.fireT -= dt
  if (w.fireT <= 0) {
    w.fireT = fireEvery(d) / g.fire
    if (bolts < boltCap(d)) {
      const i = pickFormed(w, true, -1, -1)
      if (i >= 0) {
        const e = w.enemies[i]!
        if (e.role !== 'sniper' && e.role !== 'tank' && e.role !== 'captor') {
          spawnBolt(w, 'bolt', e.x, e.y + e.hh, 0, boltSpeed(d) * g.bolt)
        }
      }
    }
  }
}

function captorReady(w: World): number {
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (e.role === 'captor' && !e.carrying && mayDive(w, e, false)) return i
  }
  return -1
}

/** Can this one be sent diving now? */
function mayDive(w: World, e: Enemy, all: boolean): boolean {
  if (!e.active || e.state !== 'form' || e.frozen > 0) return false
  // A captor that has just arrived goes by itself, when it has settled (enemies.ts).
  if (e.shield) return false
  if (all) return true
  if (e.role === 'sniper') return false
  // The captor comes for the partner only when there is one to take.
  if (e.role === 'captor' && !e.carrying) return w.partner.state === 'fly' && w.player.towing === 0
  return true
}

/** A random formed enemy that may dive; with a row and column, its neighbour in that row. */
function pickFormed(w: World, all: boolean, row: number, col: number): number {
  let n = 0
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!mayDive(w, e, all)) continue
    if (row >= 0 && (e.row !== row || Math.abs(e.col - col) !== 1)) continue
    n++
  }
  if (n === 0) return -1
  let k = randInt(w.rng, n)
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!mayDive(w, e, all)) continue
    if (row >= 0 && (e.row !== row || Math.abs(e.col - col) !== 1)) continue
    if (k-- === 0) return i
  }
  return -1
}

/** The bonus run: strings that fly through in patterns. Nothing shoots, nothing hurts. */
export function startBonus(w: World): void {
  const H = w.h
  const W = w.w
  w.bonusTotal = 0
  w.bonusHits = 0
  for (let s = 0; s < BONUS.strings; s++) {
    for (let k = 0; k < BONUS.perString; k++) {
      const e = spawnEnemy(w, s % 2 === 0 ? 'grunt' : 'flanker', w.gang, -40, -40)
      if (!e) continue
      e.bonus = true
      e.t = -(s * BONUS.between + k * BONUS.gap)
      e.dur = BONUS.flyTicks
      const flip = s >= 2 && s % 2 === 1
      switch (s % 4) {
        case 0: curve(e, -20, H * 0.2, W - 30, H * 0.2, W - 30, H * 0.62, -20, H * 0.55); break
        case 1: curve(e, W + 20, H * 0.2, 30, H * 0.2, 30, H * 0.62, W + 20, H * 0.55); break
        case 2: curve(e, 60, -20, 60, H * 0.78, W - 60, H * 0.78, W - 60, -20); break
        default: curve(e, flip ? W + 20 : -20, H * 0.5, 90, H * 0.1, 150, H * 0.72, flip ? -20 : W + 20, H * 0.25)
      }
      w.bonusTotal++
    }
  }
}

/** How many bonus targets are still to come or in the air. */
export function bonusLeft(w: World): number {
  let n = 0
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (e.active && e.bonus) n++
  }
  return n
}
