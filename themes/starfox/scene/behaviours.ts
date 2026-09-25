/**
 * How each kind of the Hollow's fighters moves and shoots, from the data
 * in balance.ts: gnats swoop in on curved entry paths and fly in
 * formation, spikes lock (blink) then dive, mantas strafe wide and drop
 * mines, lancers draw a sightline for half a second before a fast bolt,
 * hornets come from behind, overtake, turn and attack, bulwarks open
 * their shield only to fire, pods and mites, carriers park and launch
 * gnats, ground turrets aim up, missiles home and can be shot down.
 */
import {
  BULWARK, CARRIER, DMG, GNAT, HORNET, LANCER, MANTA, MISSILE, MITE, SPIKE, TURRET,
  bulwarkShieldOpen, enemyFireInterval, gnatEntry, laneY, steerHoming, turretInCone,
} from '../balance'
import type { Enemy } from './enemies'
import { GROUND_Y, clamp, live, rand, type Ctx } from './ctx'

const pt = { x: 0, y: 0 }
const steer = { x: 0, y: 0, z: 0 }
const aim = { x: 0, y: 0, z: 0 }
const FIRE_Z_FAR = -170
const FIRE_Z_NEAR = -18

/** Where an aimed shot from `e` goes (the player or a wingman); writes `aim`. */
function pickAim(ctx: Ctx, e: Enemy): void {
  const slot = e.target >= 0 ? e.target : -1
  const w = slot >= 0 ? ctx.squad.members[slot] : null
  if (w && w.alive) { aim.x = w.x; aim.y = w.y; aim.z = w.z } else { aim.x = ctx.player.x; aim.y = ctx.player.y; aim.z = 0 }
}

function aimedFire(ctx: Ctx, e: Enemy, dt: number, armed: boolean, mul = 1) {
  if (!e.shoots || !armed || e.z < FIRE_Z_FAR || e.z > FIRE_Z_NEAR) return
  e.fireT -= dt
  if (e.fireT > 0) return
  const iv = enemyFireInterval(ctx.sector)
  e.fireT = rand(iv.lo, iv.hi)
  ctx.enemies.fireAimed(e.x, e.y, e.z + e.radius, mul)
}

/** Formation entry (curved path) or a launch from a carrier; true while entering. */
function entry(ctx: Ctx, e: Enemy, dt: number): boolean {
  const u = (e.t - e.delay) / GNAT.entryTime
  if (u >= 1) { e.entry = 0; return false }
  const px = e.x
  if (e.entry === 1) {
    gnatEntry(e.path, Math.max(0, u), e.sx, e.sy, pt)
    e.x = pt.x * ctx.laneX
    e.y = laneY(pt.y)
  } else {
    const k0 = Math.max(0, u)
    const k = k0 * k0 * (3 - 2 * k0)
    e.x = e.ex + (e.sx * ctx.laneX - e.ex) * k
    e.y = e.ey + (laneY(e.sy) - e.ey) * k
  }
  if (dt > 0) e.bank = clamp(-(e.x - px) / dt * 0.05, -0.9, 0.9)
  e.z += ctx.worldSpeed * GNAT.driftMul * dt
  return true
}

function sway(e: Enemy, dt: number, amp: number) {
  e.wob += e.wobSpeed * dt
  e.x += Math.sin(e.wob) * amp * dt
  e.y += Math.cos(e.wob * 0.7) * 0.4 * dt
  e.bank = -Math.cos(e.wob) * 0.25
}

function edges(ctx: Ctx, e: Enemy) {
  const lim = ctx.laneX + 1.5
  if (e.x < -lim) { e.x = -lim; e.a = Math.abs(e.a) }
  if (e.x > lim) { e.x = lim; e.a = -Math.abs(e.a) }
}

export function stepEnemy(ctx: Ctx, e: Enemy, dt: number, demo: boolean): void {
  const ws = ctx.worldSpeed
  const armed = !demo && live(ctx)
  if (e.entry && entry(ctx, e, dt)) return
  switch (e.kind) {
    case 'drone':
      sway(e, dt, 2.2)
      e.z += ws * GNAT.driftMul * dt
      aimedFire(ctx, e, dt, armed)
      break

    case 'splitter':
      sway(e, dt, 1.6)
      e.z += ws * 0.6 * dt
      aimedFire(ctx, e, dt, armed)
      break

    case 'kamikaze':
      if (e.st === 0) {
        sway(e, dt, 1.5)
        e.z += ws * SPIKE.driftMul * dt
        if (armed && e.z > SPIKE.lockZ) {
          e.st = 1
          e.a = SPIKE.blink
          e.target = ctx.squad.aggro()
        }
      } else if (e.st === 1) {
        // The telegraph: it blinks while it picks you.
        e.a -= dt
        e.z += ws * 0.8 * dt
        e.anim.charge = Math.floor(e.t * 14) % 2
        if (e.a <= 0) e.st = 2
      } else {
        pickAim(ctx, e)
        e.x += clamp(aim.x - e.x, -1, 1) * SPIKE.turn.x * dt
        e.y += clamp(aim.y - e.y, -1, 1) * SPIKE.turn.y * dt
        e.z += (ws * SPIKE.driftMul + 12) * dt
        e.anim.charge = 1
        e.bank += dt * 8
      }
      break

    case 'mite':
      if (armed) {
        e.x += clamp(ctx.player.x - e.x, -1, 1) * MITE.turn.x * dt
        e.y += clamp(ctx.player.y - e.y, -1, 1) * MITE.turn.y * dt
      }
      e.z += ws * MITE.driftMul * dt
      e.bank += dt * 5
      break

    case 'weaver':
      if (e.st === 0) {
        e.st = 1
        e.a = rand(-4, 4)
        e.n = MANTA.minesEach
        e.b = rand(MANTA.mineEvery[0], MANTA.mineEvery[1])
        e.wobSpeed = rand(MANTA.sineRate[0], MANTA.sineRate[1])
      }
      e.wob += e.wobSpeed * dt
      e.x += (e.a + Math.sin(e.wob) * MANTA.sineAmp) * dt
      e.bank = -Math.cos(e.wob) * 0.5
      edges(ctx, e)
      e.z += ws * MANTA.driftMul * dt
      if (armed && e.n > 0 && e.z > MANTA.mineZ[0] && e.z < MANTA.mineZ[1]) {
        e.b -= dt
        if (e.b <= 0) {
          ctx.obstacles.spawnMine(e.x, e.y - 0.5, e.z + 2.5)
          e.n--
          e.b = rand(MANTA.mineEvery[0], MANTA.mineEvery[1])
        }
      }
      aimedFire(ctx, e, dt, armed)
      break

    case 'sniper':
      if (e.st === 0) {
        sway(e, dt, 1.0)
        e.z += ws * LANCER.driftMul * dt
        e.anim.charge = 0
        if (armed && e.z > LANCER.fireZ[0] && e.z < LANCER.fireZ[1]) {
          e.fireT -= dt
          if (e.fireT <= 0) {
            // The sightline: aim frozen at its start, half a second to move.
            e.target = ctx.squad.aggro()
            pickAim(ctx, e)
            e.aimX = aim.x; e.aimY = aim.y; e.aimZ = aim.z
            e.aimOn = true
            e.st = 1
            e.a = LANCER.sightline
          }
        }
      } else {
        e.a -= dt
        e.z += ws * LANCER.driftMul * 0.5 * dt
        e.anim.charge = Math.floor(e.t * 16) % 2 ? 1 : 0.5
        if (e.a <= 0) {
          if (armed) ctx.shots.bolt(e.x, e.y, e.z + 1, e.aimX, e.aimY, e.aimZ, LANCER.boltMul)
          e.aimOn = false
          e.st = 0
          e.fireT = rand(LANCER.reload[0], LANCER.reload[1])
        }
      }
      break

    case 'dasher':
      stepHornet(ctx, e, dt, armed)
      break

    case 'bulwark':
      if (e.st === 0) { e.st = 1; e.fireT = rand(BULWARK.fireEvery[0], BULWARK.fireEvery[1]) }
      sway(e, dt, 0.8)
      e.z += ws * BULWARK.driftMul * dt
      e.sinceShot += dt
      if (e.shieldT > 0) e.shieldT -= dt
      if (armed && e.z > FIRE_Z_FAR && e.z < FIRE_Z_NEAR) {
        e.fireT -= dt
        if (e.fireT <= 0) {
          ctx.enemies.fireAimed(e.x, e.y, e.z + e.radius, BULWARK.boltMul, DMG.bolt + 4)
          e.sinceShot = 0
          e.fireT = rand(BULWARK.fireEvery[0], BULWARK.fireEvery[1])
        }
      }
      {
        const open = e.shieldT > 0 || (armed && bulwarkShieldOpen(e.fireT, e.sinceShot)) ? 1 : 0
        e.anim.open = (e.anim.open ?? 0) + (open - (e.anim.open ?? 0)) * Math.min(1, dt * 14)
      }
      break

    case 'carrier':
      stepCarrier(ctx, e, dt, armed)
      break

    case 'turret':
      stepTurret(ctx, e, dt, armed)
      break

    case 'missile':
      stepMissile(ctx, e, dt)
      break

    default:
      e.z += ws * 0.6 * dt
  }
}

function stepHornet(ctx: Ctx, e: Enemy, dt: number, armed: boolean) {
  const root = e.model.root
  if (e.st === 0) {
    // Overtaking on the outside of the ship, nose away from us.
    e.z -= HORNET.overtakeSpeed * dt
    const tx = clamp(ctx.player.x + e.side * HORNET.sideOffset, -ctx.laneX - 2, ctx.laneX + 2)
    e.x += (tx - e.x) * Math.min(1, dt * 3)
    root.rotation.y = Math.PI
    e.anim.boost = 1
    e.bank = -e.side * 0.4
    if (e.z < HORNET.turnZ) { e.st = 1; e.a = 0 }
  } else if (e.st === 1) {
    e.a += dt
    const k = Math.min(1, e.a / HORNET.turnTime)
    root.rotation.y = Math.PI * (1 - k)
    e.z -= HORNET.overtakeSpeed * (1 - k) * dt
    e.bank = e.side * Math.sin(k * Math.PI) * 1.2
    e.anim.boost = 1 - k
    if (k >= 1) {
      e.st = 2
      e.n = e.missiles ? 1 : HORNET.attackBolts
      e.b = 0.2
      e.target = ctx.squad.aggro()
    }
  } else {
    root.rotation.y = 0
    e.z += ctx.worldSpeed * HORNET.driftMul * dt
    pickAim(ctx, e)
    e.x += clamp(aim.x - e.x, -1, 1) * 3 * dt
    e.bank *= 0.9
    if (armed && e.n > 0 && e.z < FIRE_Z_NEAR) {
      e.b -= dt
      if (e.b <= 0) {
        if (e.missiles) ctx.enemies.missile(e.x, e.y, e.z + 1, e.target)
        else ctx.shots.bolt(e.x, e.y, e.z + 1, aim.x, aim.y, aim.z, 1.2)
        e.n--
        e.b = HORNET.boltGap
      }
    }
  }
}

function stepCarrier(ctx: Ctx, e: Enemy, dt: number, armed: boolean) {
  e.anim.hurt = 1 - e.hp / e.maxHp
  if (e.st === 0) {
    e.z += Math.max(ctx.worldSpeed * CARRIER.driftMul, 14) * dt
    if (e.z >= CARRIER.parkZ) {
      e.z = CARRIER.parkZ
      e.st = 1
      e.a = 0
      e.b = CARRIER.firstLaunch
      e.c = CARRIER.missileEvery
    }
  } else if (e.st === 1) {
    e.a += dt
    e.x += Math.sin(e.t * 0.6) * 1.5 * dt
    e.y += Math.cos(e.t * 0.9) * 0.4 * dt
    e.bank = Math.sin(e.t * 0.6) * 0.08
    e.n = Math.max(0, e.n - dt)
    e.anim.open = e.n > 0 ? 1 : Math.max(0, (e.anim.open ?? 0) - dt * 2)
    if (armed) {
      e.b -= dt
      if (e.b <= 0) {
        e.b = CARRIER.launchEvery
        let own = 0
        for (const o of ctx.enemies.list) if (o.active && o.owner === e.uid) own++
        for (let i = 0; i < CARRIER.launchCount && own < CARRIER.maxGnats; i++, own++) {
          const g = ctx.enemies.spawn('drone', e.x + (i ? 2 : -2), e.y - 1.2, e.z + 4)
          if (!g) break
          g.owner = e.uid
          g.entry = 2
          g.ex = g.x
          g.ey = g.y
          g.sx = clamp(e.x / ctx.laneX + rand(-0.6, 0.6), -0.85, 0.85)
          g.sy = rand(0.25, 0.8)
          e.n = 0.7
        }
      }
      if (e.missiles) {
        e.c -= dt
        if (e.c <= 0) {
          e.c = CARRIER.missileEvery
          ctx.enemies.missile(e.x, e.y - 1, e.z + 5, ctx.squad.aggro())
        }
      }
    }
    if (e.a >= CARRIER.holdTime) e.st = 2
  } else {
    // Still alive after its hold: it climbs away.
    e.y += 7 * dt
    e.z -= 12 * dt
  }
}

function stepTurret(ctx: Ctx, e: Enemy, dt: number, armed: boolean) {
  e.z += ctx.worldSpeed * TURRET.driftMul * dt
  e.y = GROUND_Y
  const p = ctx.player
  const dx = p.x - e.x
  const dz = -e.z
  e.model.aim?.(Math.atan2(dx, dz), Math.atan2(p.y - (e.y + 1.6), Math.hypot(dx, dz)))
  if (e.st === 0 && e.t < dt * 1.5) e.fireT = rand(0.4, 1.4)
  if (!armed) return
  if (e.st === 1) {
    e.b -= dt
    if (e.b <= 0) {
      ctx.shots.bolt(e.x, e.y + 1.8, e.z + 1.2, p.x, p.y, 0, TURRET.boltMul)
      e.n--
      e.b = TURRET.burstGap
      if (e.n <= 0) e.st = 0
    }
    return
  }
  e.fireT -= dt
  if (e.fireT <= 0 && turretInCone(e.x, e.z, p.x)) {
    e.st = 1
    e.n = TURRET.burst
    e.b = 0
    e.fireT = rand(TURRET.fireEvery[0], TURRET.fireEvery[1])
  }
}

function stepMissile(ctx: Ctx, e: Enemy, dt: number) {
  if (e.t > MISSILE.life) { ctx.enemies.kill(e, -1, true); return }
  pickAim(ctx, e)
  if (e.t > MISSILE.arm) {
    steerHoming(e.vx, e.vy, e.vz, aim.x - e.x, aim.y - e.y, aim.z - e.z, MISSILE.turnRate, dt, steer)
    e.vx = steer.x; e.vy = steer.y; e.vz = steer.z
  }
  e.x += e.vx * dt
  e.y += e.vy * dt
  e.z += e.vz * dt
  const root = e.model.root
  root.position.set(e.x, e.y, e.z)
  root.lookAt(e.x + e.vx, e.y + e.vy, e.z + e.vz)
  const dx = aim.x - e.x, dy = aim.y - e.y, dz = aim.z - e.z
  if (live(ctx) && dx * dx + dy * dy + dz * dz < MISSILE.proximity * MISSILE.proximity) {
    const w = e.target >= 0 ? ctx.squad.members[e.target] : null
    if (w && w.alive) ctx.squad.damage(e.target, DMG.missile)
    else ctx.player.damage(DMG.missile)
    ctx.enemies.kill(e, -1, true)
  }
  if (e.z > 8) ctx.enemies.kill(e, -1, true)
}
