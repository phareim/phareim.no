/**
 * The sector boss, for now: the old DREADNOUGHT, a gunship that parks at
 * z ≈ −60 and strafes while four turrets work an attack wheel (aimed
 * bursts → spread fan → minions → mine-seed). Only the gold core takes
 * damage; turrets can be shot off and grow back. A placeholder until the
 * five sector bosses (bosses.ts, models/bosses) replace it; its turrets
 * already reach the wingmen as `part` targets.
 */
import * as THREE from 'three'
import {
  BOSS_ENRAGE_RATE, BOSS_NAME, BOSS_WHEEL_LEN, DMG, bossAttackInterval, bossFanCount, bossFanSpread, bossMaxHp, bossMinions,
} from '../balance'
import { P, geo, glowMat, hullMat, mesh } from '../models/core'
import type { WingTarget } from '../wingmanAi'
import { SPAWN_Z, addScore, rand, type Ctx } from './ctx'

export interface DreadBoss {
  readonly active: boolean
  readonly dying: boolean
  start(): void
  update(dt: number): void
  clear(): void
  /** Push the turrets (`part`) and the core as targets. */
  targets(list: WingTarget[], pool: WingTarget[]): void
  locate(id: number, out: { x: number; y: number; z: number }): boolean
  laserHit(x: number, y: number, z: number, dmg: number): boolean
  blast(x: number, y: number, z: number, r: number, coreDmg: number, partDmg: number): void
  touching(x: number, y: number, z: number, r: number): boolean
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
  readonly name: string
  /** Debug: the core takes whatever hull it has left. */
  finish(): void
}

const BOSS_Z = -60
const CORE = { x: 0, y: 0.4, z: 6.2, r: 2.8 }
const TURRET_SPOTS: [number, number, number][] = [[-10.5, 0.6, 3.2], [10.5, 0.6, 3.2], [-5.5, 2.4, 2.0], [5.5, 2.4, 2.0]]
const ID_TURRET = -1
const ID_CORE = -100

export function createBoss(ctx: Ctx): DreadBoss {
  const root = new THREE.Group()
  mesh(geo('dread/hull', g => {
    g.add(new THREE.OctahedronGeometry(6), new THREE.Matrix4().makeRotationY(Math.PI / 4).premultiply(new THREE.Matrix4().makeScale(1.6, 0.75, 1)))
    for (const s of [-1, 1]) g.add(new THREE.OctahedronGeometry(2.2), new THREE.Matrix4().makeTranslation(s * 10.5, -1, 1))
    g.box(0, -0.2, 0, 21, 0.5, 1.2)
  }), hullMat(P.plum), root)
  mesh(geo('dread/trim', g => {
    for (const s of [-1, 1]) g.box(s * 5, 0.9, 3.5, 3.5, 0.2, 0.2).box(s * 10.5, 1.2, 1, 0.3, 0.3, 2.6)
  }), glowMat(P.hot), root)
  const coreMat = glowMat(P.gold)
  const core = mesh(geo('dread/core', g => { g.add(new THREE.OctahedronGeometry(1.7)) }), coreMat, root)
  core.position.set(CORE.x, CORE.y, CORE.z)
  const turretGeo = geo('dread/turret', g => { g.add(new THREE.OctahedronGeometry(0.9)) })
  const turrets = TURRET_SPOTS.map(([ox, oy, oz]) => {
    const m = mesh(turretGeo, glowMat(P.hot), root)
    m.position.set(ox, oy, oz)
    return { mesh: m, alive: true, respawnT: 0, ox, oy, oz }
  })
  root.visible = false
  ctx.scene.add(root)

  let active = false
  let hp = 0
  let max = 0
  let x = 0
  let y = 2
  let z = BOSS_Z
  let t = 0
  let attackT = 0
  let step = 0
  let aimWing = false
  let deathT = -1
  let deathTick = 0
  let hpSent = -1

  function emit() {
    if (hp === hpSent && active) return
    hpSent = hp
    ctx.out.boss(Math.ceil(hp), max, active, BOSS_NAME)
  }

  function damage(n: number) {
    if (!active || deathT >= 0) return
    hp = Math.max(0, hp - n)
    emit()
    if (hp <= 0) {
      deathT = 1.2
      deathTick = 0
      ctx.shake = 1.2
    }
  }

  function kill() {
    ctx.fx.explode(x, y, z, P.gold, 3)
    ctx.fx.explode(x - 6, y, z + 2, P.hot, 2.5)
    ctx.fx.explode(x + 6, y, z + 2, P.hot, 2.5)
    ctx.fx.shock(x, y, z, 26, 0.9)
    ctx.flash = 1
    ctx.flashColor = P.gold
    ctx.shake = 1.4
    boss.clear()
    ctx.run.bossDown()
  }

  function attack() {
    const s = step % BOSS_WHEEL_LEN
    step++
    const sector = ctx.sector
    if (s === 0) {
      // Aimed bursts alternate between you and a wingman.
      aimWing = !aimWing
      const slot = aimWing ? ctx.squad.aggro() : -1
      const w = slot >= 0 ? ctx.squad.members[slot] : null
      const ax = w?.alive ? w.x : ctx.player.x
      const ay = w?.alive ? w.y : ctx.player.y
      const az = w?.alive ? w.z : 0
      for (const tr of turrets) if (tr.alive) ctx.shots.bolt(x + tr.ox, y + tr.oy, z + tr.oz, ax, ay, az, 1, DMG.bossBolt)
      if (sector >= 2) ctx.shots.bolt(x, y, z + 6, ax, ay, az, 1.15, DMG.bossBolt)
    } else if (s === 1) {
      const n = bossFanCount(sector)
      const spread = bossFanSpread(sector)
      for (let i = 0; i < n; i++) ctx.shots.boltDir(x, y + 0.4, z + 6, (i / (n - 1) - 0.5) * spread, 0, sector >= 3 ? 1 : 0.9, DMG.bossSpread)
    } else if (s === 2) {
      for (const m of bossMinions(sector)) ctx.enemies.spawn(m.kind, x + m.dx, y + rand(-1, 1), z + 10)
    } else {
      const n = sector >= 3 ? 5 : sector >= 2 ? 4 : 3
      for (let i = 0; i < n; i++) ctx.obstacles.spawnMine(x + rand(-8, 8), y + rand(-2, 2), z + 14 + i * 6)
      ctx.fx.sparks(x, y, z + 8, P.gold, 20, 10)
    }
  }

  const boss: DreadBoss = {
    name: BOSS_NAME,
    finish() { damage(hp) },
    get active() { return active },
    get dying() { return deathT >= 0 },
    start() {
      max = bossMaxHp(ctx.sector)
      hp = max
      hpSent = -1
      active = true
      t = 0
      attackT = 2
      step = 0
      aimWing = false
      deathT = -1
      x = 0
      y = 2
      z = SPAWN_Z - 40
      for (const tr of turrets) { tr.alive = true; tr.respawnT = 0; tr.mesh.visible = true }
      root.visible = true
      emit()
      const alive = ctx.squad.aliveIds
      if (alive.length) ctx.story.wing('boss', ctx.squad.slotOf(alive[Math.floor(Math.random() * alive.length)]!))
    },
    update(dt) {
      if (!active) return
      t += dt
      const motion = ctx.reduced ? 0.25 : 1
      if (z < BOSS_Z) z = Math.min(BOSS_Z, z + 55 * dt)
      else if (deathT >= 0) {
        deathT -= dt
        deathTick -= dt
        if (deathTick <= 0) {
          deathTick = 0.18
          ctx.fx.explode(x + rand(-8, 8), y + rand(-3, 3), z + rand(-4, 6), Math.random() < 0.5 ? P.gold : P.hot, 1.5)
          ctx.shake = Math.max(ctx.shake, 0.8)
          ctx.sfx.boom(true)
        }
        if (deathT <= 0) { kill(); return }
      } else {
        x = Math.sin(t * 0.5) * ctx.laneX * 0.55 * motion
        y = 2 + Math.sin(t * 0.8) * 1.2 * motion
        core.rotation.y += dt * 2.4
        attackT -= dt * (hp < max * 0.3 ? BOSS_ENRAGE_RATE : 1)
        if (attackT <= 0) {
          attackT = bossAttackInterval(ctx.sector)
          attack()
        }
      }
      for (const tr of turrets) {
        if (!tr.alive) {
          tr.respawnT -= dt
          if (tr.respawnT <= 0) {
            tr.alive = true
            tr.mesh.visible = true
            ctx.fx.sparks(x + tr.ox, y + tr.oy, z + tr.oz, P.hot, 16, 8)
          }
        }
        tr.mesh.rotation.y += dt * 1.8
      }
      root.position.set(x, y, z)
    },
    clear() {
      if (!active) return
      active = false
      deathT = -1
      root.visible = false
      emit()
    },
    targets(list, pool) {
      if (!active || deathT >= 0) return
      for (let i = 0; i < turrets.length; i++) {
        const tr = turrets[i]!
        if (!tr.alive || list.length >= pool.length) continue
        const w = pool[list.length]!
        w.id = ID_TURRET - i
        w.kind = 'part'
        w.x = x + tr.ox; w.y = y + tr.oy; w.z = z + tr.oz
        w.vx = 0
        w.onShip = false
        list.push(w)
      }
      if (list.length < pool.length) {
        const w = pool[list.length]!
        w.id = ID_CORE
        w.kind = 'core'
        w.x = x + CORE.x; w.y = y + CORE.y; w.z = z + CORE.z
        w.vx = 0
        w.onShip = false
        list.push(w)
      }
    },
    locate(id, out) {
      if (!active) return false
      if (id === ID_CORE) { out.x = x + CORE.x; out.y = y + CORE.y; out.z = z + CORE.z; return true }
      const tr = turrets[ID_TURRET - id]
      if (!tr || !tr.alive) return false
      out.x = x + tr.ox; out.y = y + tr.oy; out.z = z + tr.oz
      return true
    },
    laserHit(lx, ly, lz, dmg) {
      if (!active || deathT >= 0 || lz > z + 14 || lz < z - 14) return false
      const cdz = lz - (z + CORE.z)
      if (Math.abs(cdz) < 3.2) {
        const dx = lx - (x + CORE.x), dy = ly - (y + CORE.y)
        if (dx * dx + dy * dy < CORE.r * CORE.r) {
          damage(dmg)
          ctx.fx.sparks(lx, ly, lz, P.gold, 8, 8)
          addScore(ctx, 25)
          return true
        }
      }
      for (const tr of turrets) {
        if (!tr.alive || Math.abs(lz - (z + tr.oz)) > 2.8) continue
        const dx = lx - (x + tr.ox), dy = ly - (y + tr.oy)
        if (dx * dx + dy * dy < 2.2 * 2.2) {
          tr.alive = false
          tr.mesh.visible = false
          tr.respawnT = 8
          ctx.fx.explode(lx, ly, lz, P.hot, 1)
          addScore(ctx, 150 * ctx.mult)
          return true
        }
      }
      return false
    },
    blast(bx, by, bz, r, coreDmg, partDmg) {
      if (!active || deathT >= 0) return
      const cx = x + CORE.x - bx, cy = y + CORE.y - by, cz = z + CORE.z - bz
      if (cx * cx + cy * cy + cz * cz < (r + 6) * (r + 6)) damage(coreDmg)
      for (const tr of turrets) {
        if (!tr.alive) continue
        const dx = x + tr.ox - bx, dy = y + tr.oy - by, dz = z + tr.oz - bz
        if (dx * dx + dy * dy + dz * dz < (r + 1) * (r + 1) && partDmg > 0) {
          tr.alive = false
          tr.mesh.visible = false
          tr.respawnT = 8
          ctx.fx.explode(x + tr.ox, y + tr.oy, z + tr.oz, P.hot, 1)
        }
      }
    },
    touching(px, py, pz, r) {
      if (!active || deathT >= 0) return false
      const dx = px - x, dy = py - y, dz = pz - (z + 3)
      return Math.abs(dx) < 11 + r && Math.abs(dy) < 3 + r && Math.abs(dz) < 5 + r
    },
    lights(add) {
      if (!active) return
      add(x + CORE.x, y + CORE.y, z + CORE.z, 6, P.gold, 0.7 + 0.2 * Math.sin(ctx.now * 6))
      for (const tr of turrets) if (tr.alive) add(x + tr.ox, y + tr.oy, z + tr.oz, 1.6, P.hot, 0.6)
    },
  }
  return boss
}
