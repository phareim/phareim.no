/**
 * Space Voyagers: the people who turn up. The rescued friend flying along as
 * a third ship with a gun bigger than yours; Hans Duo, who clears half a wave
 * and takes the credit; and the passes friends make through the last fight
 * when the boss changes phase.
 */
import { CONVOY, DUO, PASS, PLAYER, TALK, WING_GUNS } from './balance.ts'
import { hurtBoss, popEnemy } from './combat.ts'
import { CAVALRY_CUE, DUO_CUE, RESCUE_CUE } from './cuemap.ts'
import { NOSE, targetAhead } from './player.ts'
import type { World } from './types.ts'
import { slotY } from './waves.ts'
import { clearDanger, cue, emit, spawnRig, spawnShot } from './world.ts'

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step)
}

/** The rescued ship: behind the player on the side the partner is not, firing its own gun. */
export function stepWing(w: World): void {
  const g = w.wing
  if (g.state !== 'flying') return
  const p = w.player
  g.t++
  if (w.stage === 'clear' || w.stage === 'ending' || w.stage === 'card') {
    // The boss is down: she peels off.
    g.y -= 3
    if (g.y < -40) g.state = 'off'
    return
  }
  const tx = Math.max(PLAYER.marginX, Math.min(w.w - PLAYER.marginX, p.x - w.partner.side * 38))
  g.x = approach(g.x, tx, 2.2)
  g.y = approach(g.y, Math.min(w.h - 14, p.y + 20), 2.2)
  if (g.t % TALK.chat === TALK.chat - 1) cue(w, RESCUE_CUE[g.id].chat)
  if (g.fireT > 0) { g.fireT--; return }
  const gun = WING_GUNS[g.id]
  if (!targetAhead(w, g.x, g.y, 18)) return
  g.fireT = gun.every
  for (let i = 0; i < gun.dxs.length; i++) {
    const s = spawnShot(w)
    if (!s) break
    s.kind = 'wing'; s.owner = 2
    s.x = g.x + gun.dxs[i]!; s.y = g.y - NOSE; s.vx = 0; s.vy = -gun.speed
    s.dmg = gun.dmg; s.pierce = gun.pierce; s.hw = gun.hw; s.hh = 5; s.grow = 0; s.life = 140
  }
  emit(w, 'shot', g.x, g.y - NOSE, 'wing', 2)
}

/** Hans Duo drops by: wave 2 of his sectors, once the formation has settled. */
export function maybeDuo(w: World): void {
  const cues = DUO_CUE[w.sector]
  if (!cues || w.duoDone || w.duo.active || w.toEnter > 0 || w.inForm < DUO.minWave) return
  const o = w.duo
  w.duoDone = true
  o.active = true
  o.x = -30
  o.y = slotY(w, w.formation.rows - 1) + 34
  o.quota = Math.floor(w.inForm * DUO.share)
  emit(w, 'duoIn', o.x, o.y, o.kind, o.quota)
  cue(w, cues.arrive)
}

export function stepDuo(w: World): void {
  const o = w.duo
  if (!o.active) return
  o.x += DUO.speed
  // He pops every other one he passes under, up to half the wave. No points: the credit is his.
  for (let i = 0; i < w.enemies.length && o.quota > 0; i++) {
    const e = w.enemies[i]!
    if (!e.active || e.state !== 'form' || Math.abs(e.x - o.x) > 4 || (e.id + e.row) % 2 !== 0) continue
    o.quota--
    popEnemy(w, e, false)
  }
  if (o.x > w.w + 30) {
    o.active = false
    emit(w, 'duoOut', o.x, o.y, o.kind)
    const cues = DUO_CUE[w.sector]
    if (cues) cue(w, cues.leave)
  }
}

/** The boss of the last fight changed phase: a friend is owed. `all`: everyone still to come. */
export function callCavalry(w: World, all: boolean): void {
  if (w.sector !== 5) return
  if (w.friends.length === 0) {
    if (!w.noCavalrySaid) {
      w.noCavalrySaid = true
      cue(w, 'cavalry.none')
    }
    return
  }
  w.passDue = all ? w.passQueue.length : Math.min(w.passQueue.length, w.passDue + 1)
}

export function stepPass(w: World): void {
  const a = w.pass
  const boss = w.boss
  if (!a.active) {
    const rigsOut = anyPassRig(w)
    if (w.passDue <= 0 || w.passQueue.length === 0 || rigsOut || !boss.active || boss.state === 'enter' || boss.state === 'dying') return
    const id = w.passQueue.shift()!
    w.passDue--
    emit(w, 'pass', 0, 0, id)
    cue(w, CAVALRY_CUE[id])
    const lane = Math.max(CONVOY.rigHw + 4, Math.min(w.w - CONVOY.rigHw - 4, boss.x + boss.wx))
    if (id === 'marge') {
      // A rig through its guns.
      spawnRig(w, 'rig-marge', 'pass', lane, w.h + CONVOY.rigHh + 6, -PASS.rigSpeed, CONVOY.rigHw, CONVOY.rigHh)
    } else if (id === 'duckie') {
      spawnRig(w, 'rig-duckie', 'pass', Math.max(22, lane - 22), w.h + CONVOY.rigHh + 6, -PASS.rigSpeed, CONVOY.rigHw, CONVOY.rigHh)
      spawnRig(w, 'rig-barton', 'pass', Math.min(w.w - 22, lane + 22), w.h + CONVOY.rigHh + 90, -PASS.rigSpeed, CONVOY.rigHw, CONVOY.rigHh)
    } else {
      // A strafing run across the field under the boss.
      a.active = true
      a.id = id
      a.kind = `stranded-${id}`
      a.vx = w.passQueue.length % 2 === 0 ? PASS.flySpeed : -PASS.flySpeed
      a.x = a.vx > 0 ? -24 : w.w + 24
      a.y = Math.min(w.h * 0.5, boss.y + boss.hh + 46)
      a.t = 0
      clearDanger(w, 0)
    }
    return
  }
  a.t++
  const before = a.x
  a.x += a.vx
  const wx = boss.x + boss.wx
  if (a.t % 5 === 0 && a.x > 8 && a.x < w.w - 8) {
    const s = spawnShot(w)
    if (s) {
      s.kind = 'wing'; s.owner = 2; s.x = a.x; s.y = a.y - NOSE; s.vx = 0; s.vy = -7
      s.dmg = 2; s.pierce = 0; s.hw = 3; s.hh = 5; s.grow = 0; s.life = 100
    }
  }
  // Passing under the weak spot she lands the big one.
  if ((before - wx) * (a.x - wx) <= 0) hurtBoss(w, boss.maxHp * PASS.dmgShare, true)
  if (a.x < -30 || a.x > w.w + 30) a.active = false
}

function anyPassRig(w: World): boolean {
  for (let i = 0; i < w.rigs.length; i++) if (w.rigs[i]!.active && w.rigs[i]!.job === 'pass') return true
  return false
}
