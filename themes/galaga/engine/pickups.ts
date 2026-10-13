/**
 * Space Voyagers: the twelve power-ups. What drops and when (at most three
 * falling, a pizza owed to a ship on its last valve, never a long dry spell),
 * what each does when taken, and the things some of them leave in the field:
 * the hairspray cloud and the trucker's rig a CB handset calls.
 */
import type { PickupId } from '../story/cues.ts'
import { CONVOY, LEVEL_MAX, PASS, PICKUP, PICKUP_IDS, PICKUP_WEIGHT, PLAYER, ROLES, SCORE } from './balance.ts'
import { addScore, hurtBoss, hurtEnemy } from './combat.ts'
import { PICK_CUE } from './cuemap.ts'
import { rand } from './rng.ts'
import type { Enemy, World } from './types.ts'
import { applyWeaponPickup } from './weapons.ts'
import { clearDanger, countActive, cue, emit, spawnPickup, spawnRig } from './world.ts'

/** The weight of each drop right now: the table in balance.ts with the rules applied. */
export function dropWeight(w: World, id: PickupId): number {
  const p = w.player
  let k = PICKUP_WEIGHT[id]
  switch (id) {
    case 'tube': if (p.level >= LEVEL_MAX) k *= 0.25; break
    case 'pizza':
      if (p.hull >= PLAYER.hull) k = p.bubble > 0 ? 0 : k * 0.4
      else if (p.hull <= 2) k *= 3
      break
    case 'bubble': if (p.bubble >= PICKUP.bubbleHits) k = 0; break
    case 'magnet': if (p.magnet > 0) k = 0; break
    case 'quarter': if (p.quarter > 0) k = 0; break
    case 'tracking': if (w.slow > 0) k = 0; break
    case 'hairspray': if (w.cloud.active) k = 0; break
  }
  return k
}

/** Choose a drop by weight. The first of a run is always a tube. */
export function chooseDrop(w: World): PickupId {
  if (w.drops === 0) return 'tube'
  let total = 0
  for (let i = 0; i < PICKUP_IDS.length; i++) total += dropWeight(w, PICKUP_IDS[i]!)
  let r = rand(w.rng) * total
  for (let i = 0; i < PICKUP_IDS.length; i++) {
    r -= dropWeight(w, PICKUP_IDS[i]!)
    if (r <= 0) return PICKUP_IDS[i]!
  }
  return 'tube'
}

/** Called for every enemy the player pops. */
export function maybeDrop(w: World, e: Enemy): void {
  if (e.bonus) return
  w.sinceDrop++
  if (countActive(w.pickups) >= PICKUP.maxFalling) return
  const p = w.player
  let id: PickupId | null = null
  if (p.hull <= 1 && p.sincePizza >= PICKUP.pizzaPity) id = 'pizza'
  else if (w.sinceDrop >= PICKUP.pityKills || rand(w.rng) < ROLES[e.role].drop) id = chooseDrop(w)
  if (!id) return
  if (spawnPickup(w, id, e.x, Math.max(10, e.y))) {
    w.sinceDrop = 0
    w.drops++
    if (id === 'pizza') p.sincePizza = 0
  }
}

/** What a pick-up does. */
export function applyPickup(w: World, id: PickupId): void {
  const p = w.player
  w.stats.picks++
  addScore(w, SCORE.pick, false)
  emit(w, 'pick', p.x, p.y, id)
  cue(w, PICK_CUE[id], id === 'pizza' ? 'pizza.again' : undefined)
  switch (id) {
    case 'tube':
    case 'blaster':
    case 'disc':
    case 'boombox': {
      if (id === 'tube' && p.level >= LEVEL_MAX) addScore(w, SCORE.spareTube, false)
      const next = applyWeaponPickup(p.weapon, p.level, id)
      p.weapon = next.weapon
      p.level = next.level
      break
    }
    case 'pizza':
      p.sincePizza = 0
      if (p.hull < PLAYER.hull) {
        p.hull++
        emit(w, 'mend', p.x, p.y, '', p.hull)
      } else if (p.bubble < 1) {
        p.bubble = 1
        emit(w, 'power', p.x, p.y, 'bubble', p.bubble)
      }
      break
    case 'bubble':
      p.bubble = PICKUP.bubbleHits
      emit(w, 'power', p.x, p.y, 'bubble', p.bubble)
      break
    case 'cb': {
      // A rig comes up the lane the ship is in and flattens it.
      const x = Math.max(CONVOY.rigHw, Math.min(w.w - CONVOY.rigHw, p.x))
      spawnRig(w, 'rig-duckie', 'cb', x, w.h + CONVOY.rigHh + 6, -PICKUP.rigSpeed, CONVOY.rigHw, CONVOY.rigHh)
      emit(w, 'rig', x, w.h, 'rig-duckie')
      break
    }
    case 'mirrorball':
      clearDanger(w, 0)
      for (let i = 0; i < w.enemies.length; i++) {
        const e = w.enemies[i]!
        if (e.active && e.state !== 'wait' && !e.bonus) hurtEnemy(w, e, PICKUP.mirrorDmg, true)
      }
      hurtBoss(w, PICKUP.mirrorBossDmg, true)
      emit(w, 'power', p.x, p.y, 'mirrorball')
      break
    case 'tracking':
      w.slow = PICKUP.trackingTicks
      emit(w, 'power', p.x, p.y, 'tracking', w.slow)
      break
    case 'hairspray': {
      const c = w.cloud
      c.active = true
      c.x = p.x
      c.y = p.y - PICKUP.cloudAhead
      c.r = PICKUP.cloudR
      c.t = PICKUP.cloudTicks
      emit(w, 'power', c.x, c.y, 'hairspray', c.t)
      break
    }
    case 'magnet':
      p.magnet = PICKUP.magnetTicks
      emit(w, 'power', p.x, p.y, 'magnet', p.magnet)
      break
    case 'quarter':
      p.quarter = PICKUP.quarterTicks
      emit(w, 'power', p.x, p.y, 'quarter', p.quarter)
      break
  }
}

export function stepPickups(w: World): void {
  const p = w.player
  for (let i = 0; i < w.pickups.length; i++) {
    const k = w.pickups[i]!
    if (!k.active) continue
    k.age++
    k.y += PICKUP.fall
    if (p.magnet > 0 && p.towing === 0) {
      const dx = p.x - k.x
      const dy = p.y - k.y
      const d = Math.hypot(dx, dy) || 1
      k.x += dx / d * PICKUP.magnetPull
      k.y += dy / d * PICKUP.magnetPull
    }
    if (k.y > w.h + 12) { k.active = false; continue }
    if (p.towing === 0 && Math.abs(k.x - p.x) < PLAYER.pickR && Math.abs(k.y - p.y) < PLAYER.pickR) {
      k.active = false
      applyPickup(w, k.id)
    }
  }

  // The timed ones that live in the world rather than on the ship.
  if (w.slow > 0 && --w.slow === 0) emit(w, 'powerOff', 0, 0, 'tracking')
  const c = w.cloud
  if (c.active && --c.t <= 0) {
    c.active = false
    emit(w, 'powerOff', c.x, c.y, 'hairspray')
  }

  // Rigs that were called: a CB rig flattens its lane, a friend's rig rams the boss.
  const boss = w.boss
  for (let i = 0; i < w.rigs.length; i++) {
    const r = w.rigs[i]!
    if (!r.active || r.job === 'convoy') continue
    r.y += r.vy
    if (r.y + r.hh < -6) { r.active = false; continue }
    for (let k = 0; k < w.enemies.length; k++) {
      const e = w.enemies[k]!
      if (!e.active || e.state === 'wait' || e.bonus) continue
      if (Math.abs(e.x - r.x) < r.hw + e.hw && Math.abs(e.y - r.y) < r.hh + e.hh) hurtEnemy(w, e, PICKUP.rigDmg, r.job === 'cb')
    }
    if (!r.struck && boss.active && Math.abs(boss.x - r.x) < r.hw + boss.hw && Math.abs(boss.y - r.y) < r.hh + boss.hh) {
      r.struck = true
      // A friend's pass takes a share of the hull; the convoy's two rigs split theirs.
      if (r.job === 'cb') hurtBoss(w, PICKUP.rigBossDmg, true)
      else hurtBoss(w, boss.maxHp * PASS.dmgShare * (r.kind === 'rig-marge' ? 1 : 0.5), true)
    }
  }
}
