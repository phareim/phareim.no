/**
 * Everything that flies straight or homes: the lasers (player and the
 * three wingmen share one instanced pool, so every kill feeds the same
 * score), the Hollow's bolts (instanced; lasers can shoot them down), the
 * charge shot's homing orbs and the NOVA BOMB.
 */
import * as THREE from 'three'
import { DMG, boltSpeedBonus, steerHoming } from '../balance'
import { BOMB, CHARGE, bombFuse } from '../arsenal'
import { createBombShell, createChargeOrb, type BombShell, type ChargeOrb } from '../models/fx'
import { P, eachLight } from '../models/core'
import { SPAWN_Z, addScore, live, type Ctx } from './ctx'

export interface Shots {
  /** `owner` −1 player, 0–2 wing slot. `pierce` extra targets (overdrive). */
  laser(x: number, y: number, z: number, color: string, dmg: number, owner: number, pierce: number): void
  /** An aimed bolt from (x, y, z) at (tx, ty, tz). */
  bolt(x: number, y: number, z: number, tx: number, ty: number, tz: number, speedMul?: number, dmg?: number): void
  /** A bolt along a direction (+z toward the player). */
  boltDir(x: number, y: number, z: number, dx: number, dy: number, speedMul?: number, dmg?: number): void
  /** Fire the charge orb at a locked target id (0 = straight ahead). */
  orb(x: number, y: number, z: number, targetId: number): void
  bomb(x: number, y: number, z: number): void
  /** Every enemy bolt gone (the bomb). */
  clearBolts(): void
  update(dt: number): void
  clear(): void
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
  readonly bolts: number
  readonly lasers: number
}

const MAX_LASERS = 110
const MAX_BOLTS = 128
const LASER_SPEED = 150

export function createShots(ctx: Ctx): Shots {
  // ---- lasers
  const laserMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.14, 2.4), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_LASERS)
  laserMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  laserMesh.frustumCulled = false
  ctx.scene.add(laserMesh)
  const L = {
    on: new Uint8Array(MAX_LASERS), x: new Float32Array(MAX_LASERS), y: new Float32Array(MAX_LASERS), z: new Float32Array(MAX_LASERS),
    dmg: new Float32Array(MAX_LASERS), pierce: new Int8Array(MAX_LASERS), owner: new Int8Array(MAX_LASERS), last: new Int32Array(MAX_LASERS),
    color: new Array<string>(MAX_LASERS).fill(P.cyan),
  }
  const d = new THREE.Object3D()
  const tmpC = new THREE.Color()
  const hide = new THREE.Matrix4().makeTranslation(0, -999, 0)
  for (let i = 0; i < MAX_LASERS; i++) { laserMesh.setMatrixAt(i, hide); laserMesh.setColorAt(i, tmpC.set(P.cyan)) }
  let laserCursor = 0
  let lasersLive = 0

  // ---- bolts
  const boltMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: P.hot }), MAX_BOLTS)
  boltMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  boltMesh.frustumCulled = false
  ctx.scene.add(boltMesh)
  const B = {
    on: new Uint8Array(MAX_BOLTS), x: new Float32Array(MAX_BOLTS), y: new Float32Array(MAX_BOLTS), z: new Float32Array(MAX_BOLTS),
    vx: new Float32Array(MAX_BOLTS), vy: new Float32Array(MAX_BOLTS), vz: new Float32Array(MAX_BOLTS), dmg: new Float32Array(MAX_BOLTS),
  }
  for (let i = 0; i < MAX_BOLTS; i++) boltMesh.setMatrixAt(i, hide)
  let boltsLive = 0

  // ---- orbs and bombs
  const orbs: { m: ChargeOrb; on: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; target: number }[] = []
  for (let i = 0; i < 2; i++) {
    const m = createChargeOrb()
    m.root.visible = false
    ctx.scene.add(m.root)
    orbs.push({ m, on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, target: 0 })
  }
  const bombs: { m: BombShell; on: boolean; x: number; y: number; z: number; life: number }[] = []
  for (let i = 0; i < 2; i++) {
    const m = createBombShell()
    m.root.visible = false
    ctx.scene.add(m.root)
    bombs.push({ m, on: false, x: 0, y: 0, z: 0, life: 0 })
  }
  const steer = { x: 0, y: 0, z: 0 }
  const loc = { x: 0, y: 0, z: 0 }

  function killLaser(i: number) {
    L.on[i] = 0
    laserMesh.setMatrixAt(i, hide)
    lasersLive--
  }

  function freeBolt(): number {
    for (let i = 0; i < MAX_BOLTS; i++) if (!B.on[i]) return i
    return -1
  }

  function boltSpeed(mul: number): number {
    return (ctx.worldSpeed + 26 + boltSpeedBonus(ctx.sector)) * mul
  }

  function spawnBolt(i: number, x: number, y: number, z: number, dx: number, dy: number, dz: number, speed: number, dmg: number) {
    const l = Math.hypot(dx, dy, dz) || 1
    B.on[i] = 1
    B.x[i] = x; B.y[i] = y; B.z[i] = z
    B.vx[i] = (dx / l) * speed; B.vy[i] = (dy / l) * speed; B.vz[i] = (dz / l) * speed
    B.dmg[i] = dmg
    boltsLive++
    ctx.sfx.zap()
  }

  function killBolt(i: number) {
    B.on[i] = 0
    boltMesh.setMatrixAt(i, hide)
    boltsLive--
  }

  function orbBlast(o: typeof orbs[number]) {
    o.on = false
    o.m.root.visible = false
    ctx.fx.shock(o.x, o.y, o.z, CHARGE.blastRadius * 1.3, 0.4)
    ctx.fx.sparks(o.x, o.y, o.z, P.cyan, 24, 12)
    ctx.fx.flashLight(o.x, o.y, o.z, 6, P.cyan, 0.4)
    ctx.enemies.blast(o.x, o.y, o.z, CHARGE.blastRadius, 'charge')
    ctx.boss.blast(o.x, o.y, o.z, CHARGE.blastRadius, CHARGE.bossDamage, CHARGE.bossDamage)
    ctx.obstacles.blast(o.x, o.y, o.z, CHARGE.blastRadius)
    ctx.sfx.boom(false)
  }

  function bombBlast(b: typeof bombs[number]) {
    b.on = false
    b.m.root.visible = false
    ctx.fx.shock(b.x, b.y, b.z, BOMB.blastRadius, 0.7)
    ctx.fx.sparks(b.x, b.y, b.z, P.hot, 60, 20)
    ctx.fx.sparks(b.x, b.y, b.z, P.white, 30, 14)
    ctx.fx.flashLight(b.x, b.y, b.z, 20, P.hot, 0.7)
    ctx.enemies.blast(b.x, b.y, b.z, BOMB.blastRadius, 'bomb')
    ctx.enemies.clearMissiles()
    clearBolts()
    ctx.boss.blast(b.x, b.y, b.z, BOMB.blastRadius, BOMB.bossDamage, BOMB.partDamage)
    ctx.obstacles.blast(b.x, b.y, b.z, BOMB.blastRadius)
    ctx.flash = Math.max(ctx.flash, 0.8)
    ctx.flashColor = P.hot
    ctx.shake = Math.max(ctx.shake, 1)
    ctx.sfx.boom(true)
  }

  function clearBolts() {
    for (let i = 0; i < MAX_BOLTS; i++) if (B.on[i]) { ctx.fx.sparks(B.x[i]!, B.y[i]!, B.z[i]!, P.pink, 2, 4); killBolt(i) }
  }

  function updateLasers(dt: number) {
    if (lasersLive <= 0) return
    const vz = -(ctx.worldSpeed + LASER_SPEED)
    for (let i = 0; i < MAX_LASERS; i++) {
      if (!L.on[i]) continue
      L.z[i]! += vz * dt
      const x = L.x[i]!, y = L.y[i]!, z = L.z[i]!
      if (z < SPAWN_Z - 20) { killLaser(i); continue }
      const hit = ctx.enemies.laserHit(x, y, z, L.dmg[i]!, L.owner[i]!, L.last[i]!)
      if (hit !== 0) {
        if (hit > 0 && L.pierce[i]! > 0) { L.pierce[i]!--; L.last[i] = hit }
        else { killLaser(i); continue }
      }
      if (ctx.boss.laserHit(x, y, z, L.dmg[i]!)) { killLaser(i); continue }
      if (ctx.obstacles.laserHit(x, y, z) !== 0) { killLaser(i); continue }
      if (boltsLive > 0) {
        let shot = false
        for (let k = 0; k < MAX_BOLTS; k++) {
          if (!B.on[k]) continue
          const dx = x - B.x[k]!, dy = y - B.y[k]!, dz = z - B.z[k]!
          if (dx * dx + dy * dy + dz * dz < 1.4) {
            ctx.fx.sparks(x, y, z, P.hot, 6, 6)
            killBolt(k)
            addScore(ctx, 10)
            ctx.sfx.tick()
            shot = true
            break
          }
        }
        if (shot) { killLaser(i); continue }
      }
      d.position.set(x, y, z)
      d.updateMatrix()
      laserMesh.setMatrixAt(i, d.matrix)
    }
    laserMesh.instanceMatrix.needsUpdate = true
  }

  function updateBolts(dt: number) {
    if (boltsLive <= 0) return
    const on = live(ctx)
    const p = ctx.player
    const sq = ctx.squad.members
    const drift = ctx.worldSpeed * 0.5
    for (let i = 0; i < MAX_BOLTS; i++) {
      if (!B.on[i]) continue
      B.x[i]! += B.vx[i]! * dt
      B.y[i]! += B.vy[i]! * dt
      B.z[i]! += (B.vz[i]! + drift) * dt
      const x = B.x[i]!, y = B.y[i]!, z = B.z[i]!
      if (z > 14 || Math.abs(x) > 34 || y > 26 || y < -6) { killBolt(i); continue }
      if (on) {
        if (p.visible) {
          const dx = x - p.x, dy = y - p.y
          if (dx * dx + dy * dy + z * z < 1.44) {
            if (p.rolling) { ctx.fx.sparks(x, y, z, P.white, 4, 6); killBolt(i); continue }
            killBolt(i)
            p.damage(B.dmg[i]!)
            continue
          }
        }
        let hitWing = false
        for (let k = 0; k < sq.length; k++) {
          const w = sq[k]!
          if (!w.alive) continue
          const dx = x - w.x, dy = y - w.y, dz = z - w.z
          if (dx * dx + dy * dy + dz * dz < 1.44) { ctx.squad.damage(k, B.dmg[i]!); hitWing = true; break }
        }
        if (hitWing) { killBolt(i); continue }
      }
      d.position.set(x, y, z)
      d.rotation.set(0, ctx.now * 6, ctx.now * 4)
      d.updateMatrix()
      boltMesh.setMatrixAt(i, d.matrix)
    }
    d.rotation.set(0, 0, 0)
    boltMesh.instanceMatrix.needsUpdate = true
  }

  function updateOrbs(dt: number) {
    for (const o of orbs) {
      if (!o.on) continue
      o.life -= dt
      if (o.target !== 0 && ctx.enemies.locate(o.target, loc)) {
        steerHoming(o.vx, o.vy, o.vz, loc.x - o.x, loc.y - o.y, loc.z - o.z, CHARGE.turnRate, dt, steer)
        o.vx = steer.x; o.vy = steer.y; o.vz = steer.z
        const dx = loc.x - o.x, dy = loc.y - o.y, dz = loc.z - o.z
        if (dx * dx + dy * dy + dz * dz < 2.2 * 2.2) { orbBlast(o); continue }
      } else o.target = 0
      o.x += o.vx * dt
      o.y += o.vy * dt
      o.z += o.vz * dt
      if (ctx.enemies.touching(o.x, o.y, o.z, 1.6) || ctx.boss.touching(o.x, o.y, o.z, 2) || o.life <= 0 || o.z < SPAWN_Z) { orbBlast(o); continue }
      o.m.root.position.set(o.x, o.y, o.z)
      o.m.set(1, ctx.now)
    }
  }

  function updateBombs(dt: number) {
    for (const b of bombs) {
      if (!b.on) continue
      b.life -= dt
      b.z -= BOMB.speed * dt
      b.m.root.position.set(b.x, b.y, b.z)
      b.m.animate(ctx.now)
      if (b.life <= 0 || ctx.enemies.touching(b.x, b.y, b.z, BOMB.contactRadius) || ctx.boss.touching(b.x, b.y, b.z, BOMB.contactRadius)) bombBlast(b)
    }
  }

  return {
    get bolts() { return boltsLive },
    get lasers() { return lasersLive },
    laser(x, y, z, color, dmg, owner, pierce) {
      const i = laserCursor
      laserCursor = (laserCursor + 1) % MAX_LASERS
      if (!L.on[i]) lasersLive++
      L.on[i] = 1
      L.x[i] = x; L.y[i] = y; L.z[i] = z
      L.dmg[i] = dmg
      L.pierce[i] = pierce
      L.owner[i] = owner
      L.last[i] = 0
      L.color[i] = color
      laserMesh.setColorAt(i, tmpC.set(color))
      if (laserMesh.instanceColor) laserMesh.instanceColor.needsUpdate = true
    },
    bolt(x, y, z, tx, ty, tz, mul = 1, dmg = DMG.bolt) {
      const i = freeBolt()
      if (i < 0) return
      spawnBolt(i, x, y, z, tx - x, ty - y, tz - z, boltSpeed(mul), dmg)
    },
    boltDir(x, y, z, dx, dy, mul = 1, dmg = DMG.bolt) {
      const i = freeBolt()
      if (i < 0) return
      spawnBolt(i, x, y, z, dx, dy, 1, boltSpeed(mul), dmg)
    },
    orb(x, y, z, target) {
      const o = orbs[0]!.on ? orbs[1]! : orbs[0]!
      if (o.on) orbBlast(o)
      o.on = true
      o.x = x; o.y = y; o.z = z
      o.vx = 0; o.vy = 0; o.vz = -CHARGE.speed
      o.life = CHARGE.life
      o.target = target
      o.m.root.visible = true
      o.m.root.position.set(x, y, z)
      ctx.sfx.beam()
    },
    bomb(x, y, z) {
      const b = bombs[0]!.on ? bombs[1]! : bombs[0]!
      if (b.on) bombBlast(b)
      b.on = true
      b.x = x; b.y = y; b.z = z
      b.life = bombFuse()
      b.m.root.visible = true
      b.m.root.position.set(x, y, z)
    },
    clearBolts,
    update(dt) {
      updateLasers(dt)
      updateBolts(dt)
      updateOrbs(dt)
      updateBombs(dt)
    },
    clear() {
      for (let i = 0; i < MAX_LASERS; i++) { L.on[i] = 0; laserMesh.setMatrixAt(i, hide) }
      lasersLive = 0
      laserMesh.instanceMatrix.needsUpdate = true
      for (let i = 0; i < MAX_BOLTS; i++) { B.on[i] = 0; boltMesh.setMatrixAt(i, hide) }
      boltsLive = 0
      boltMesh.instanceMatrix.needsUpdate = true
      for (const o of orbs) { o.on = false; o.m.root.visible = false }
      for (const b of bombs) { b.on = false; b.m.root.visible = false }
    },
    lights(add) {
      if (lasersLive > 0) for (let i = 0; i < MAX_LASERS; i++) if (L.on[i]) add(L.x[i]!, L.y[i]!, L.z[i]!, 1.4, L.color[i]!, 0.8)
      if (boltsLive > 0) for (let i = 0; i < MAX_BOLTS; i++) if (B.on[i]) add(B.x[i]!, B.y[i]!, B.z[i]!, 1.2, P.hot, 0.85)
      for (const o of orbs) if (o.on) eachLight(o.m.lights, add)
      for (const b of bombs) if (b.on) eachLight(b.m.lights, add)
    },
  }
}
