/**
 * Space Voyagers: what each enemy does each tick. One loop for all five
 * gangs; a gang's quirks are numbers in balance.ts (GANGS), a role's
 * behaviour is a state here. States: wait (its turn to fly in), enter, form,
 * aim (a diver showing its line), dive, hover (a tank's stop, a captor's
 * beam), return, free (a straight flyer: mites, a diver, a boss's helpers),
 * through (a bonus target), seek and latch (a raider, in encounters.ts).
 */
import { CAPTOR, GANGS, PARTNER, PICKUP, PLAYER, SNIPER, TANK, boltCap, boltSpeed, difficulty, enterFire } from './balance.ts'
import { hurtEnemy, hurtPartner, hurtPlayer } from './combat.ts'
import { stepRaider } from './encounters.ts'
import { enemyTime } from './player.ts'
import { rand } from './rng.ts'
import type { Enemy, World } from './types.ts'
import { slotX, slotY } from './waves.ts'
import { cue, emit, spawnAim, spawnBolt } from './world.ts'

function bezier(e: Enemy, u: number, ex: number, ey: number): void {
  const v = 1 - u
  const a = v * v * v
  const b = 3 * v * v * u
  const c = 3 * v * u * u
  const d = u * u * u
  e.x = a * e.ax + b * e.bx + c * e.cx + d * ex
  e.y = a * e.ay + b * e.by + c * e.cy + d * ey
}

/** Back to its slot: from the top after leaving the bottom, or straight from where it is. */
function goHome(w: World, e: Enemy, wrap: boolean): void {
  e.state = 'return'
  e.t = 0
  e.dur = 64
  if (wrap) {
    e.wraps++
    e.x = e.px = slotX(w, e.col)
    e.y = e.py = -24
  }
  e.ax = e.x
  e.ay = e.y
}

function threeWay(w: World, e: Enemy, d: number): void {
  const sp = boltSpeed(d) * GANGS[e.gang].bolt
  for (let k = -1; k <= 1; k++) spawnBolt(w, 'bolt', e.x, e.y + e.hh, Math.sin(k * TANK.fan) * sp, Math.cos(k * TANK.fan) * sp)
  cue(w, 'see.tank')
}

function sniperAims(w: World): number {
  let n = 0
  for (let i = 0; i < w.aims.length; i++) if (w.aims[i]!.active && w.aims[i]!.kind === 'sniper') n++
  return n
}

export function stepEnemies(w: World): void {
  const dt = enemyTime(w)
  const d = difficulty(w.sector, w.voyage)
  const p = w.player
  const q = w.partner
  const c = w.cloud
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.active) continue
    e.px = e.x
    e.py = e.y
    e.flash++
    if (e.frozen > 0) {
      // Standing still in the hairspray; afterwards it cannot be held again for a while.
      if (--e.frozen === 0) e.frozen = -PICKUP.cloudTicks
      continue
    }
    if (e.frozen < 0) e.frozen++
    e.t += dt
    const g = GANGS[e.gang]

    switch (e.state) {
      case 'wait':
        if (e.t >= 0) {
          e.t = 0
          e.state = e.bonus ? 'through' : 'enter'
          e.x = e.px = e.ax
          e.y = e.py = e.ay
        }
        continue
      case 'enter': {
        const u = Math.min(1, e.t / e.dur)
        bezier(e, u, slotX(w, e.col), slotY(w, e.row))
        // From sector 2 some let a shot go on the way in.
        if (u >= 0.45 && e.t - dt < e.dur * 0.45 && w.boltsOut < boltCap(d) && rand(w.rng) < enterFire(d)) {
          spawnBolt(w, 'bolt', e.x, e.y + e.hh, 0, boltSpeed(d) * g.bolt)
        }
        if (u >= 1) e.state = 'form'
        break
      }
      case 'through': {
        const u = Math.min(1, e.t / e.dur)
        bezier(e, u, e.ex, e.ey)
        if (u >= 1) e.active = false
        break
      }
      case 'form': {
        e.x += (slotX(w, e.col) - e.x) * 0.3
        e.y += (slotY(w, e.row) - e.y) * 0.3
        if (w.stage !== 'wave' && w.stage !== 'idle') break
        if (e.role === 'tank') {
          e.fireT -= dt
          if (e.fireT <= 0) {
            e.fireT = TANK.every / g.fire * (0.8 + 0.4 * rand(w.rng))
            if (w.boltsOut < boltCap(d) + 2) threeWay(w, e, d)
          }
        } else if (e.role === 'sniper') {
          e.fireT -= dt
          if (e.fireT <= 0) {
            e.fireT = Math.max(110, SNIPER.every - 12 * d) * (0.8 + 0.4 * rand(w.rng))
            if (sniperAims(w) < SNIPER.max) {
              // The line first, for half a second; then the shot goes along it.
              spawnAim(w, 'sniper', e.x, e.y + e.hh, p.x, p.y, SNIPER.warn, SNIPER.speed, i)
              cue(w, 'see.sniper')
            }
          }
        }
        break
      }
      case 'aim':
        e.x += (slotX(w, e.col) - e.x) * 0.3
        e.y += (slotY(w, e.row) - e.y) * 0.3
        if (e.t >= e.dur) {
          // Re-point from where it stands now at the place it showed.
          e.state = 'free'
          e.t = 0
        }
        break
      case 'dive': {
        const u = Math.min(1, e.t / e.dur)
        bezier(e, u, e.ex, e.ey)
        if (g.dive === 'wobble' && e.mode === 0) e.x += Math.sin(e.t * 0.16) * 11 * Math.sin(u * Math.PI)
        if (e.fireT > 0 && u > (e.fireT >= 2 ? 0.28 : 0.5) && e.y < w.h * 0.7) {
          e.fireT--
          if (w.boltsOut < boltCap(d)) spawnBolt(w, 'bolt', e.x, e.y + e.hh, 0, boltSpeed(d) * g.bolt)
        }
        if (u >= 1) {
          if (e.mode === 1) {
            e.state = 'hover'
            e.t = 0
            if (e.role === 'captor') { emit(w, 'beam', e.x, e.y, e.kind, CAPTOR.warn); cue(w, 'see.captor') }
          } else goHome(w, e, true)
        }
        break
      }
      case 'hover':
        if (e.role === 'captor') {
          const on = e.t >= CAPTOR.warn
          if (on && e.t - dt < CAPTOR.warn) emit(w, 'beamOn', e.x, e.y, e.kind, CAPTOR.beam)
          if (on && q.state === 'fly' && q.y > e.y && p.towing === 0) {
            const dx = e.x - q.x
            if (Math.abs(dx) < CAPTOR.beamHalf) {
              q.state = 'beamed'
              q.captor = i
              q.t = 0
            } else if (Math.abs(dx) < CAPTOR.beamHalf * 2.4) q.x += Math.sign(dx) * CAPTOR.pull
          }
          const lifting = q.state === 'beamed' && q.captor === i
          if (e.carrying || (!lifting && e.t >= CAPTOR.warn + CAPTOR.beam)) goHome(w, e, false)
        } else {
          if (e.t >= 30 && e.t - dt < 30) threeWay(w, e, d)
          if (e.t >= 70) goHome(w, e, false)
        }
        break
      case 'return': {
        const u = Math.min(1, e.t / e.dur)
        const k = u * u * (3 - 2 * u)
        e.x = e.ax + (slotX(w, e.col) - e.ax) * k
        e.y = e.ay + (slotY(w, e.row) - e.ay) * k
        if (u >= 1) {
          e.state = 'form'
          e.fireT = (e.role === 'tank' ? TANK.every : SNIPER.every) * (0.5 + 0.5 * rand(w.rng))
        }
        break
      }
      case 'free':
        e.x += e.vx * dt
        e.y += e.vy * dt
        if (e.role === 'mite') e.x += Math.sin(e.t * 0.13 + e.id) * 0.9 * dt
        if ((e.x < 8 && e.vx < 0) || (e.x > w.w - 8 && e.vx > 0)) e.vx = -e.vx
        if (e.y < -40) { e.active = false; continue }
        if (e.y > w.h + 20) {
          if (e.col >= 0) goHome(w, e, true)
          else if (e.role === 'mite' && e.wraps < 2) {
            // A mite comes round twice more, then gives up.
            e.wraps++
            e.y = e.py = -14
          } else { e.active = false; continue }
        }
        break
      case 'seek':
      case 'latch':
        stepRaider(w, e, dt)
        if (!e.active) continue
        break
    }

    if (c.active && e.frozen === 0 && (e.x - c.x) ** 2 + (e.y - c.y) ** 2 < (c.r + e.hw) ** 2) {
      e.frozen = PICKUP.holdTicks
      emit(w, 'freeze', e.x, e.y, e.kind)
    }
    if (e.bonus) continue
    // Ramming: the cockpit against the body. The enemy comes off worse.
    if (Math.abs(e.x - p.x) < e.hw + PLAYER.hitR && Math.abs(e.y - p.y) < e.hh + PLAYER.hitR) {
      if (hurtPlayer(w)) hurtEnemy(w, e, 2, false)
      if (!e.active) continue
    }
    if (q.state === 'fly' && Math.abs(e.x - q.x) < e.hw + PARTNER.hitR && Math.abs(e.y - q.y) < e.hh + PARTNER.hitR) {
      if (hurtPartner(w)) hurtEnemy(w, e, 1, false)
    }
  }
}
