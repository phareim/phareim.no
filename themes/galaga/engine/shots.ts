/**
 * Space Voyagers: everything that flies and hurts. Our shots (bolts, discs
 * that turn to the next target, arcs of bass), their shots, the lines shown
 * before an aimed shot, and the patches of field a boss lights up.
 */
import { DISC_TURN_RANGE, PARTNER, PICKUP, PLAYER, WEAPONS } from './balance.ts'
import { hurtBoss, hurtEnemy, hurtPartner, hurtPlayer, inBody } from './combat.ts'
import { enemyTime } from './player.ts'
import type { Barrier, Shot, World } from './types.ts'
import { emit, spawnBolt } from './world.ts'

const seen = (s: Shot, id: number): boolean => {
  for (let i = 0; i < s.seenN; i++) if (s.seen[i] === id) return true
  return false
}
const remember = (s: Shot, id: number): void => {
  if (s.seenN < s.seen.length) s.seen[s.seenN++] = id
}

/** Is x behind a door panel of this barrier (not in the gap)? */
export function doorBlocks(b: Barrier, x: number, fieldW: number): boolean {
  if (!b.active || b.shut <= 0) return false
  const left = (b.gapX - b.gapW / 2) * b.shut
  const right = fieldW - (fieldW - (b.gapX + b.gapW / 2)) * b.shut
  return x < left || x > right
}

/** A disc that has gone through a target turns to the nearest one it has not hit. */
function turnDisc(w: World, s: Shot): void {
  let best = -1
  let bestD = DISC_TURN_RANGE * DISC_TURN_RANGE
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.active || e.state === 'wait' || seen(s, e.id)) continue
    const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2
    if (d < bestD) { bestD = d; best = i }
  }
  if (best < 0) return
  const e = w.enemies[best]!
  const d = Math.sqrt(bestD) || 1
  s.vx = (e.x - s.x) / d * WEAPONS.disc.speed
  s.vy = (e.y - s.y) / d * WEAPONS.disc.speed
}

export function stepShots(w: World): void {
  const boss = w.boss
  const bossUp = boss.active && (boss.state === 'fight' || boss.state === 'ram')
  // A wall of a boss (CAL, the Deaf Star) stops what misses its weak spot. The weak spot is on its
  // face, so a shot coming up under it flies on over the body until it meets it.
  const armoured = bossUp && (boss.whw < boss.hw || boss.whh < boss.hh)
  for (let i = 0; i < w.shots.length; i++) {
    const s = w.shots[i]!
    if (!s.active) continue
    s.x += s.vx
    s.y += s.vy
    s.hw += s.grow
    if (--s.life <= 0 || s.y < -14 || s.y > w.h + 14 || s.x < -14 || s.x > w.w + 14) { s.active = false; continue }

    let stopped = false
    for (let k = 0; k < w.barriers.length && !stopped; k++) {
      const b = w.barriers[k]!
      if (b.active && s.y - s.hh < b.y + b.hh && s.y + s.hh > b.y - b.hh && doorBlocks(b, s.x, w.w)) {
        s.active = false
        stopped = true
        emit(w, 'hit', s.x, b.y + b.hh, 'door')
      }
    }
    if (stopped) continue

    for (let k = 0; k < w.enemies.length; k++) {
      const e = w.enemies[k]!
      if (!e.active || e.state === 'wait') continue
      if (Math.abs(s.y - e.y) >= s.hh + e.hh || Math.abs(s.x - e.x) >= s.hw + e.hw) continue
      if (seen(s, e.id)) continue
      const id = e.id
      hurtEnemy(w, e, s.dmg, true)
      if (s.pierce > 0) {
        s.pierce--
        remember(s, id)
        if (s.kind === 'disc') turnDisc(w, s)
      } else {
        s.active = false
        break
      }
    }
    if (!s.active || !bossUp) continue

    const wx = boss.x + boss.wx
    const wy = boss.y + boss.wy
    if (Math.abs(s.x - wx) < s.hw + boss.whw && Math.abs(s.y - wy) < s.hh + boss.whh) {
      if (seen(s, -1)) continue
      hurtBoss(w, s.dmg)
      if (s.pierce > 0) { s.pierce--; remember(s, -1) } else s.active = false
    } else if (armoured && s.kind !== 'bass' && Math.abs(s.x - wx) >= s.hw + boss.whw && inBody(boss, s.x, s.y, s.hw, s.hh)) {
      s.active = false
      emit(w, 'hit', s.x, s.y, 'armor')
    }
  }
}

function stepAims(w: World, dt: number): void {
  for (let i = 0; i < w.aims.length; i++) {
    const a = w.aims[i]!
    if (!a.active) continue
    if (a.owner >= 0) {
      const e = w.enemies[a.owner]!
      if (!e.active || e.id !== a.ownerId) { a.active = false; continue }
      if (e.frozen > 0) continue
      // The line turns with its owner: it always passes through the point it was aimed at.
      a.x = e.x
      a.y = e.y + (a.kind === 'diver' ? 0 : e.hh)
    }
    a.warn -= dt
    if (a.warn > 0) continue
    if (a.kind === 'diver') { a.active = false; continue }
    const dx = a.tx - a.x
    const dy = a.ty - a.y
    const d = Math.hypot(dx, dy) || 1
    spawnBolt(w, 'aimed', a.x, a.y, dx / d * a.speed, dy / d * a.speed, 3)
    if (a.burst > 0) { a.burst--; a.warn = 9 } else a.active = false
  }
}

export function stepBolts(w: World): void {
  const dt = enemyTime(w)
  const p = w.player
  const q = w.partner
  const c = w.cloud
  stepAims(w, dt)
  for (let i = 0; i < w.bolts.length; i++) {
    const b = w.bolts[i]!
    if (!b.active) continue
    if (b.frozen > 0) {
      // Held in the hairspray: when it lets go the shot is spent.
      if (--b.frozen === 0) b.active = false
      continue
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.life -= dt
    if (b.kind === 'mine' && b.stopAt > 0 && b.y >= b.stopAt) { b.vx = 0; b.vy = 0; b.stopAt = 0 }
    if (b.life <= 0 || b.y > w.h + 10 || b.y < -30 || b.x < -10 || b.x > w.w + 10) { b.active = false; continue }

    if (b.kind === 'aimed') {
      let stopped = false
      for (let k = 0; k < w.barriers.length && !stopped; k++) {
        const d = w.barriers[k]!
        if (d.active && Math.abs(b.y - d.y) < d.hh + b.r && doorBlocks(d, b.x, w.w)) stopped = true
      }
      if (stopped) { b.active = false; continue }
    }
    if (c.active && (b.x - c.x) ** 2 + (b.y - c.y) ** 2 < c.r * c.r) {
      b.frozen = PICKUP.holdTicks
      continue
    }
    // A rig is cover: it stops their shots and lets ours through.
    let covered = false
    for (let k = 0; k < w.rigs.length && !covered; k++) {
      const r = w.rigs[k]!
      if (r.active && Math.abs(b.x - r.x) < r.hw + b.r && Math.abs(b.y - r.y) < r.hh + b.r) covered = true
    }
    if (covered) { b.active = false; continue }

    const rr = b.r + PLAYER.hitR
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) {
      if (hurtPlayer(w)) b.active = false
      if (!b.active) continue
    }
    if (q.state === 'fly') {
      const qr = b.r + PARTNER.hitR
      if ((b.x - q.x) ** 2 + (b.y - q.y) ** 2 < qr * qr && hurtPartner(w)) b.active = false
    }
  }

  // The lit patches: shown, then live. They hurt the player only; the partner flies through.
  const r = PLAYER.hitR
  for (let i = 0; i < w.zones.length; i++) {
    const z = w.zones[i]!
    if (!z.active) continue
    if (z.warn > 0) {
      z.warn -= dt
      if (z.warn <= 0) { z.warn = 0; emit(w, 'zoneLive', z.x + z.w / 2, z.y + z.h / 2, z.kind) }
      continue
    }
    z.x += z.vx * dt
    z.y += z.vy * dt
    z.live -= dt
    if (z.live <= 0 || z.y > w.h + 2) { z.active = false; continue }
    if (p.x > z.x - r && p.x < z.x + z.w + r && p.y > z.y - r && p.y < z.y + z.h + r) hurtPlayer(w)
  }
}
