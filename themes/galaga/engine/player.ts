/**
 * Space Voyagers: the two ships. The player's flying and firing, the tow,
 * and the partner: flying alongside, firing at what is in front of it,
 * limping off, being lifted by the captor's beam, hanging, docking.
 */
import { CAPTOR, DUET, PARTNER, PICKUP, PLAYER, TALK } from './balance.ts'
import { startDuet } from './combat.ts'
import { PARTNER_CUE } from './cuemap.ts'
import type { Input, WeaponId, World } from './types.ts'
import { fireInterval, volley } from './weapons.ts'
import { clampPlayer, cue, emit, spawnShot } from './world.ts'

/** How far ahead of a ship's centre its nose is. */
export const NOSE = 14

/** Launch one volley from (x, y). `owner`: 0 the player, 1 the partner. */
export function fireVolley(w: World, x: number, y: number, weapon: WeaponId, level: number, owner: number): void {
  const specs = volley(weapon, level)
  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i]!
    const s = spawnShot(w)
    if (!s) break
    s.kind = sp.kind; s.owner = owner
    s.x = x + sp.dx; s.y = y + sp.dy; s.vx = sp.vx; s.vy = sp.vy
    s.dmg = sp.dmg; s.pierce = sp.pierce; s.hw = sp.hw; s.hh = sp.hh; s.grow = sp.grow; s.life = sp.life
    w.stats.shotsFired++
  }
  emit(w, 'shot', x, y, weapon, owner)
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step)
}

export function stepPlayer(w: World, input: Input): void {
  const p = w.player
  if (p.invuln > 0) p.invuln--
  p.sincePizza++
  if (p.magnet > 0 && --p.magnet === 0) emit(w, 'powerOff', p.x, p.y, 'magnet')
  if (p.quarter > 0 && --p.quarter === 0) emit(w, 'powerOff', p.x, p.y, 'quarter')
  if (p.fireT > 0) p.fireT--

  if (p.towing > 0) {
    // On the hook: drawn back to the start, no control and no harm.
    p.x = approach(p.x, w.w / 2, 1.6)
    p.y = approach(p.y, w.h - PLAYER.startFromBottom, 1.6)
    if (--p.towing === 0) {
      p.hull = PLAYER.towHull
      p.invuln = PLAYER.invuln + 30
      emit(w, 'towed', p.x, p.y, '', p.hull)
    }
    return
  }

  let mx = 0
  let my = 0
  if (input.hasTarget) {
    mx = input.tx - p.x
    my = input.ty - p.y
    const d = Math.hypot(mx, my)
    if (d > PLAYER.speed) { mx *= PLAYER.speed / d; my *= PLAYER.speed / d }
  } else {
    mx = Math.max(-1, Math.min(1, input.dx || 0))
    my = Math.max(-1, Math.min(1, input.dy || 0))
    const d = Math.hypot(mx, my)
    const k = d > 1 ? PLAYER.speed / d : PLAYER.speed
    mx *= k; my *= k
  }
  p.x += mx
  p.y += my
  clampPlayer(w)

  // The ending card has the field: the guns are quiet under it.
  if (w.stage === 'ending') return
  if (input.duet) startDuet(w)

  if (input.fire && p.fireT <= 0) {
    const duet = w.duet > 0
    const level = duet ? DUET.level : p.level
    fireVolley(w, p.x, p.y - NOSE, p.weapon, level, 0)
    // Docked, the two ships are one: the partner's guns go off with the player's.
    const q = w.partner
    if (q.state === 'docked') fireVolley(w, q.x, q.y - NOSE, p.weapon, level, 1)
    p.fireT = fireInterval(p.weapon, duet)
    p.volleys++
  }
}

/** Is there something to shoot above (x, y), within `half` px either side? */
export function targetAhead(w: World, x: number, y: number, half: number): boolean {
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (e.active && e.state !== 'wait' && e.y < y && e.y > -4 && Math.abs(e.x - x) < half + e.hw) return true
  }
  const b = w.boss
  return b.active && b.state !== 'enter' && b.state !== 'dying' && Math.abs(b.x + b.wx - x) < half + b.whw
}

/** Is a captor on its way down for the partner, or over it with the beam? */
function beamComing(w: World): boolean {
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (e.active && e.role === 'captor' && !e.carrying && (e.state === 'hover' || (e.state === 'dive' && e.mode === 1))) return true
  }
  return false
}

/** The nearest enemy's sideways distance from x, among those within `range`; 0 when there is none. */
function leanTo(w: World, x: number, range: number): number {
  let best = 0
  let bestD = range
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.active || e.state === 'wait' || e.y < 0) continue
    const d = Math.abs(e.x - x)
    if (d < bestD) { bestD = d; best = e.x - x }
  }
  return best
}

/**
 * Which way the partner should step to get out of the way of what is plainly coming at it: a
 * shot that will cross its row within `PARTNER.dodgeTicks` close to where it is, or a body on
 * its way down just above it. -1 left, 1 right, 0 nothing to dodge.
 */
function dodge(w: World, x: number, y: number): number {
  let push = 0
  let nearest = 1e9
  for (let i = 0; i < w.bolts.length; i++) {
    const b = w.bolts[i]!
    if (!b.active || b.frozen > 0 || b.vy <= 0) continue
    const t = (y - b.y) / b.vy
    if (t < 0 || t > PARTNER.dodgeTicks) continue
    const off = b.x + b.vx * t - x
    if (Math.abs(off) > PARTNER.hitR + b.r + 4 || t >= nearest) continue
    nearest = t
    push = off > 0 ? -1 : off < 0 ? 1 : x < w.w / 2 ? 1 : -1
  }
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!
    if (!e.active || e.bonus || e.frozen > 0 || e.state === 'form' || e.state === 'wait' || e.role === 'captor') continue
    const vy = e.y - e.py
    if (vy <= 0.3) continue
    const t = (y - e.y) / vy
    if (t < 0 || t > PARTNER.dodgeTicks) continue
    const off = e.x + (e.x - e.px) * t - x
    if (Math.abs(off) > PARTNER.hitR + e.hw + 4 || t >= nearest) continue
    nearest = t
    push = off > 0 ? -1 : off < 0 ? 1 : x < w.w / 2 ? 1 : -1
  }
  // Not into the wall: if there is no room that way, the other.
  if (push < 0 && x < PLAYER.marginX + 8) push = 1
  else if (push > 0 && x > w.w - PLAYER.marginX - 8) push = -1
  return push
}

export function stepPartner(w: World): void {
  const q = w.partner
  const p = w.player
  q.t++
  if (q.invuln > 0) q.invuln--
  if (q.fireT > 0) q.fireT--
  const baseY = Math.min(w.h - PLAYER.marginBottom, p.y + 4)

  switch (q.state) {
    case 'fly': {
      if (p.x < w.w / 2 - 20) q.side = 1
      else if (p.x > w.w / 2 + 20) q.side = -1
      let tx = p.x + q.side * PARTNER.offset
      let ty = baseY
      if (p.towing > 0) {
        // Towing: it flies to the player's nose and pulls.
        tx = p.x
        ty = p.y - 22
      } else {
        tx += Math.max(-20, Math.min(20, leanTo(w, tx, 40)))
        // It steps out of the way of what is plainly coming at it; that comes before a target.
        const away = dodge(w, q.x, q.y)
        if (away !== 0) tx = q.x + away * PARTNER.dodge
      }
      tx = Math.max(PLAYER.marginX, Math.min(w.w - PLAYER.marginX, tx))
      q.x = approach(q.x, tx, PARTNER.speed)
      q.y = approach(q.y, ty, PARTNER.speed)
      // A captor coming down for it jams its guns: saving it is the player's job.
      if (q.fireT <= 0 && p.towing === 0 && !beamComing(w) && targetAhead(w, q.x, q.y, PARTNER.aimX)) {
        const duet = w.duet > 0
        fireVolley(w, q.x, q.y - NOSE, p.weapon, duet ? DUET.level : p.level, 1)
        q.fireT = fireInterval(p.weapon, duet) * PARTNER.fireEvery
        q.volleys++
      }
      break
    }
    case 'limp': {
      // Off the bottom to mend, then back up.
      if (q.t < PARTNER.limpTicks - 50) q.y = Math.min(w.h + 40, q.y + 2)
      else q.y = approach(q.y, baseY, 1.6)
      if (q.t >= PARTNER.limpTicks) {
        q.state = 'fly'
        q.t = 0
        q.hits = 0
        q.invuln = PARTNER.invuln
        emit(w, 'back', q.x, q.y)
        cue(w, PARTNER_CUE[w.partnerPilot].back)
      }
      break
    }
    case 'beamed': {
      const c = w.enemies[q.captor]
      if (!c || !c.active || c.role !== 'captor') { q.state = 'fly'; q.captor = -1; q.t = 0; break }
      q.x = approach(q.x, c.x, CAPTOR.lift)
      q.y = approach(q.y, c.y + 22, CAPTOR.lift)
      if (Math.abs(q.x - c.x) < 1 && Math.abs(q.y - (c.y + 22)) < 1) {
        q.state = 'hanging'
        q.t = 0
        c.carrying = true
        w.stats.captures++
        emit(w, 'capture', q.x, q.y)
        cue(w, PARTNER_CUE[w.partnerPilot].captured)
      }
      break
    }
    case 'hanging': {
      const c = w.enemies[q.captor]
      if (!c || !c.active || !c.carrying) { q.state = 'fly'; q.captor = -1; q.t = 0; break }
      q.x = c.x
      q.y = c.y + 22
      if (q.t % TALK.hanging === TALK.hanging - 1) cue(w, PARTNER_CUE[w.partnerPilot].hanging)
      break
    }
    case 'docking': {
      const tx = dockX(w)
      q.x = approach(q.x, tx, 3.4)
      q.y = approach(q.y, p.y, 3.4)
      if (Math.abs(q.x - tx) < 2 && Math.abs(q.y - p.y) < 2) {
        q.state = 'docked'
        q.t = 0
        q.dock = PARTNER.dockTicks
        w.stats.docks++
        emit(w, 'docked', q.x, q.y, '', q.dock)
      }
      break
    }
    case 'docked': {
      q.x = dockX(w)
      q.y = p.y
      if (--q.dock <= 0) {
        q.state = 'fly'
        q.t = 0
        emit(w, 'undocked', q.x, q.y)
      }
      break
    }
  }
}

/** Where the docked ship sits: beside the player, on the side with room. */
function dockX(w: World): number {
  const q = w.partner
  const p = w.player
  if (p.x + PARTNER.dockOffset > w.w - 10) q.side = -1
  else if (p.x - PARTNER.dockOffset < 10) q.side = 1
  return p.x + q.side * PARTNER.dockOffset
}

/** TRACKING: how fast enemies and their shots run this tick. */
export function enemyTime(w: World): number {
  return w.slow > 0 ? PICKUP.trackingSlow : 1
}
