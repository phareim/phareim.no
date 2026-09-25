/**
 * The Hollow's fighters in play: one pool per kind on the new models
 * (models/enemies.ts, built up front so nothing is created mid-run), the
 * spawn helpers the encounter script calls (formations on curved entry
 * paths, hornets from behind, carriers, turret rows, missiles), hits,
 * blasts, kills and the target list the wingmen and the charge lock read.
 * Per-kind movement lives in ./behaviours.ts; the rival and Dingo's
 * chasers in ./setpieces.ts.
 */
import { DMG, ENEMY_STATS, GNAT, MISSILE, POD, bulwarkShieldOpen, formationSlot, laneY, type EnemyKind, type EntryPath } from '../balance'
import { CHARGE, bombDamage } from '../arsenal'
import { createEnemyModel, ENEMY_INFO, type EnemyModel, type EnemyState } from '../models/enemies'
import { P, eachLight } from '../models/core'
import type { WingTarget } from '../wingmanAi'
import { stepEnemy } from './behaviours'
import { GROUND_Y, KILL_Z, SPAWN_Z, clamp, live, rand, scoreKill, type Ctx } from './ctx'

export interface Enemy {
  kind: EnemyKind
  model: EnemyModel
  anim: EnemyState
  active: boolean
  uid: number
  hp: number
  maxHp: number
  radius: number
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  /** measured lateral speed (the wingmen lead their shots by it) */
  lat: number
  /** age in seconds */
  t: number
  /** behaviour state and scratch timers */
  st: number
  a: number; b: number; c: number; n: number
  side: number
  /** 0 none, 1 a formation path, 2 launched from a point */
  entry: number
  path: EntryPath
  sx: number; sy: number
  ex: number; ey: number
  delay: number
  wob: number
  wobSpeed: number
  fireT: number
  sinceShot: number
  shoots: boolean
  /** lancer sightline */
  aimOn: boolean
  aimX: number; aimY: number; aimZ: number
  flashT: number
  /** bulwark: seconds its broken shield stays down */
  shieldT: number
  invuln: boolean
  /** uid of the carrier that launched it */
  owner: number
  /** −1 the player, 0–2 a wing slot */
  target: number
  missiles: boolean
  /** 0 normal, 1 Dingo's chaser, 2 the rival */
  role: number
  /** mid-field station: it slows to a crawl at holdZ for holdT s, then comes on */
  holdZ: number
  holdT: number
  bank: number
}

export interface Enemies {
  /** Everything the wingmen and the charge lock can aim at (refreshed each frame). */
  readonly targets: WingTarget[]
  /** The same, less Dingo's chasers (saving him is the player's job). */
  readonly wingTargets: WingTarget[]
  readonly count: number
  spawn(kind: EnemyKind, x: number, y: number, z: number): Enemy | null
  /** `xn`, `yn` normalised (x × laneX, y by laneY). */
  formation(kinds: readonly EnemyKind[], path: EntryPath, xn: number, yn: number): void
  hornet(side: number, yn: number, missiles: boolean, xn?: number): void
  carrier(xn: number, yn: number, missiles: boolean): void
  turrets(xs: readonly number[]): void
  missile(x: number, y: number, z: number, target: number): void
  /** A laser at (x, y, z): uid hit, −1 stopped by a shield, 0 nothing. */
  laserHit(x: number, y: number, z: number, dmg: number, owner: number, skipUid: number): number
  blast(x: number, y: number, z: number, r: number, mode: 'bomb' | 'charge'): void
  touching(x: number, y: number, z: number, r: number): boolean
  /** World position of a target id (enemies, boss parts). */
  locate(id: number, out: { x: number; y: number; z: number }): boolean
  damage(e: Enemy, dmg: number, owner: number): void
  kill(e: Enemy, owner: number, quiet?: boolean): void
  /** Gone without a trace (flew off). */
  remove(e: Enemy): void
  clearMissiles(): void
  countKind(kind: EnemyKind): number
  /** Aimed shot from (x, y, z) at the player or a wingman (aggro). */
  fireAimed(x: number, y: number, z: number, mul: number, dmg?: number): void
  update(dt: number): void
  clear(): void
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
  /** Lancer sightlines for the stage HUD. */
  eachAim(cb: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => void): void
  readonly list: readonly Enemy[]
  /** Kills this run: by the player (lasers, orb, bomb, rams) and by the wingmen. */
  readonly kills: { player: number; wing: number }
}

const POOL: Record<EnemyKind, number> = {
  drone: 18, kamikaze: 6, weaver: 6, sniper: 6, dasher: 6, bulwark: 3, splitter: 4, mite: 8,
  carrier: 2, turret: 8, missile: 6, rival: 1,
}
const MAX_TARGETS = 90
/** Models a little larger than built, so they read at mid-field pixel size (collision scales too). */
const SCALE: Partial<Record<EnemyKind, number>> = {
  drone: 1.8, kamikaze: 1.6, weaver: 1.5, sniper: 1.7, dasher: 1.5, bulwark: 1.45, splitter: 1.6, mite: 1.7, turret: 1.35, missile: 1.6, rival: 1.3,
}
/** Past the ship an enemy has had its chance; it goes before it fills the camera. */
const PAST_Z = 6
const FORMATION_Z = -150

export function createEnemies(ctx: Ctx): Enemies {
  const list: Enemy[] = []
  for (const kind of Object.keys(POOL) as EnemyKind[]) {
    for (let i = 0; i < POOL[kind]; i++) {
      const model = createEnemyModel(kind)
      model.root.scale.setScalar(SCALE[kind] ?? 1)
      model.root.visible = false
      ctx.scene.add(model.root)
      list.push(blank(kind, model))
    }
  }
  const targets: WingTarget[] = []
  const wingTargets: WingTarget[] = []
  const targetPool: WingTarget[] = []
  for (let i = 0; i < MAX_TARGETS; i++) targetPool.push({ id: 0, kind: 'drone', x: 0, y: 0, z: 0, vx: 0, onShip: false })
  let uid = 0
  const chaserIds = new Set<number>()
  const kills = { player: 0, wing: 0 }
  let count = 0
  const met = new Set<EnemyKind>()

  function spawn(kind: EnemyKind, x: number, y: number, z: number): Enemy | null {
    let e: Enemy | null = null
    for (const v of list) if (v.kind === kind && !v.active) { e = v; break }
    if (!e) return null
    const s = ENEMY_STATS[kind]
    e.active = true
    e.uid = ++uid
    e.hp = e.maxHp = s.hp
    e.radius = ENEMY_INFO[kind].radius * (SCALE[kind] ?? 1)
    e.holdZ = rand(-54, -30)
    e.holdT = rand(2.5, 4.5)
    e.x = x; e.y = y; e.z = z
    e.vx = e.vy = e.vz = 0
    e.lat = 0
    e.t = 0
    e.st = 0
    e.a = e.b = e.c = e.n = 0
    e.side = x < 0 ? -1 : 1
    e.entry = 0
    e.delay = 0
    e.wob = Math.random() * 6.28
    e.wobSpeed = rand(1.5, 3)
    e.fireT = rand(1, 2.5)
    e.sinceShot = 9
    e.shoots = kind !== 'mite' && kind !== 'dasher' && kind !== 'missile' && Math.random() < shootChance()
    e.aimOn = false
    e.flashT = 0
    e.shieldT = 0
    e.invuln = false
    e.owner = 0
    e.target = -1
    e.missiles = false
    e.role = 0
    e.bank = 0
    e.anim.open = 0
    e.anim.charge = 0
    e.anim.hurt = 0
    e.anim.bank = 0
    e.anim.boost = 0
    e.model.root.visible = true
    e.model.root.position.set(x, y, z)
    e.model.root.rotation.set(0, 0, 0)
    e.model.flash(false)
    if (kind === 'turret') e.model.setBiome?.(ctx.env.biome)
    count++
    if (live(ctx) && !met.has(kind)) {
      met.add(kind)
      ctx.story.meet(kind)
    }
    return e
  }

  function shootChance(): number {
    return Math.min(0.95, 0.65 + 0.06 * (Math.max(1, ctx.sector) - 1))
  }

  function deactivate(e: Enemy) {
    if (!e.active) return
    e.active = false
    e.aimOn = false
    e.model.root.visible = false
    count--
  }

  function fireAimed(x: number, y: number, z: number, mul: number, dmg: number = DMG.bolt) {
    const slotI = ctx.squad.aggro()
    const w = slotI >= 0 ? ctx.squad.members[slotI] : null
    if (w && w.alive) ctx.shots.bolt(x, y, z, w.x, w.y, w.z, mul, dmg)
    else ctx.shots.bolt(x, y, z, ctx.player.x, ctx.player.y, 0, mul, dmg)
  }

  function kill(e: Enemy, owner: number, quiet = false) {
    if (!e.active) return
    const k = e.kind
    const x = e.x, y = e.y, z = e.z
    deactivate(e)
    const size = k === 'carrier' ? 3 : k === 'rival' ? 2.5 : k === 'mite' || k === 'missile' ? 0.5 : e.radius
    ctx.fx.explode(x, y, z, ENEMY_INFO[k].accent, size)
    if (k === 'carrier' || k === 'rival') { ctx.shake = Math.max(ctx.shake, 1); ctx.flash = Math.max(ctx.flash, 0.5); ctx.flashColor = P.gold }
    if (quiet) return
    if (k === 'splitter') {
      for (let i = 0; i < POD.mites; i++) {
        const m = spawn('mite', x + (i === 0 ? -POD.spread : POD.spread), y, z)
        if (m) m.shoots = false
      }
    }
    if (k === 'carrier') ctx.pickups.capsule(null, x, y, z)
    if (e.role === 1) ctx.sets.chaserDown()
    if (e.role === 2) ctx.sets.rivalDown()
    if (live(ctx)) {
      scoreKill(ctx, ENEMY_STATS[k].score)
      if (owner >= 0) kills.wing++
      else kills.player++
      ctx.sfx.boom(k === 'carrier' || k === 'rival')
      if (owner >= 0) ctx.squad.credit(owner)
    }
  }

  function damage(e: Enemy, dmg: number, owner: number) {
    if (!e.active || e.invuln) return
    e.hp -= dmg
    e.flashT = 0.07
    e.model.flash(true)
    if (e.role === 2) ctx.sets.rivalHit(e)
    if (e.hp <= 0) kill(e, owner)
    else ctx.fx.sparks(e.x, e.y, e.z, P.white, 4, 6)
  }

  function shieldClosed(e: Enemy): boolean {
    return e.kind === 'bulwark' && e.shieldT <= 0 && !bulwarkShieldOpen(e.fireT, e.sinceShot)
  }

  function gatherTargets() {
    targets.length = 0
    chaserIds.clear()
    for (const e of list) {
      if (!e.active || e.invuln || targets.length >= MAX_TARGETS - 8) continue
      const t = targetPool[targets.length]!
      t.id = e.uid
      t.kind = e.kind
      t.x = e.x; t.y = e.y; t.z = e.z
      t.vx = e.lat
      t.onShip = e.kind === 'missile' && e.target < 0
      if (e.role === 1) chaserIds.add(e.uid)
      targets.push(t)
    }
    ctx.boss.targets(targets, targetPool)
    wingTargets.length = 0
    for (const t of targets) if (!chaserIds.has(t.id)) wingTargets.push(t)
  }

  function ramCheck(e: Enemy) {
    const p = ctx.player
    const reach = e.radius + 0.7
    if (p.visible && Math.abs(e.z) < e.radius + 0.6) {
      const dx = e.x - p.x, dy = e.y - p.y
      if (dx * dx + dy * dy < reach * reach) {
        if (p.rolling && e.kind !== 'carrier' && e.kind !== 'rival') { kill(e, -1); return }
        p.damage(e.kind === 'missile' ? DMG.missile : DMG.ram)
        if (e.kind === 'bulwark' || e.kind === 'carrier' || e.kind === 'rival') damage(e, 1, -1)
        else kill(e, -1, e.kind === 'missile')
        return
      }
    }
    const sq = ctx.squad.members
    for (let i = 0; i < sq.length; i++) {
      const w = sq[i]!
      if (!w.alive || Math.abs(e.z - w.z) > e.radius + 0.6) continue
      const dx = e.x - w.x, dy = e.y - w.y
      if (dx * dx + dy * dy < reach * reach) {
        ctx.squad.damage(i, e.kind === 'missile' ? DMG.missile : DMG.ram)
        if (e.kind !== 'bulwark' && e.kind !== 'carrier' && e.kind !== 'rival') kill(e, -1, e.kind === 'missile')
        return
      }
    }
  }

  const enemies: Enemies = {
    kills,
    targets,
    wingTargets,
    list,
    get count() { return count },
    spawn,
    formation(kinds, path, xn, yn) {
      const n = kinds.length
      for (let i = 0; i < n; i++) {
        const s = formationSlot(i, n, xn, yn)
        const e = spawn(kinds[i]!, s.x * ctx.laneX, laneY(s.y), FORMATION_Z - i * 4)
        if (!e) continue
        e.entry = 1
        e.path = path
        e.sx = s.x
        e.sy = s.y
        e.delay = i * GNAT.stagger
        stepEnemy(ctx, e, 0, !ctx.started)
      }
    },
    hornet(side, yn, missiles, xn) {
      const e = spawn('dasher', 0, laneY(yn), 16)
      if (!e) return
      e.side = side
      e.missiles = missiles
      if (xn !== undefined) e.a = xn
      e.x = clamp(ctx.player.x + side * 3.5, -ctx.laneX - 2, ctx.laneX + 2)
    },
    carrier(xn, yn, missiles) {
      const e = spawn('carrier', xn * ctx.laneX, laneY(yn) + 1.5, -180)
      if (e) e.missiles = missiles
    },
    turrets(xs) {
      for (let i = 0; i < xs.length; i++) spawn('turret', xs[i]! * ctx.laneX, GROUND_Y, SPAWN_Z - i * 0.5)
    },
    missile(x, y, z, target) {
      if (enemies.countKind('missile') >= MISSILE.maxAlive) return
      const e = spawn('missile', x, y, z)
      if (!e) return
      e.target = target
      e.vx = rand(-3, 3)
      e.vy = rand(-2, 4)
      e.vz = MISSILE.speed
      e.hp = 1
    },
    laserHit(x, y, z, dmg, owner, skipUid) {
      for (const e of list) {
        if (!e.active || e.invuln || e.uid === skipUid) continue
        const r = e.radius + 0.3
        const dz = z - e.z
        if (dz > r + 1.2 || dz < -r - 1.2) continue
        const dx = x - e.x, dy = y - (e.kind === 'turret' ? e.y + 1.4 : e.y)
        if (dx * dx + dy * dy > r * r) continue
        if (shieldClosed(e)) {
          ctx.fx.sparks(x, y, z, P.gold, 5, 6)
          ctx.sfx.tick()
          return -1
        }
        damage(e, dmg, owner)
        return e.uid
      }
      return 0
    },
    blast(x, y, z, r, mode) {
      for (const e of list) {
        if (!e.active || e.invuln) continue
        const rr = r + e.radius * 0.5
        const dx = e.x - x, dy = e.y - y, dz = e.z - z
        if (dx * dx + dy * dy + dz * dz > rr * rr) continue
        if (e.kind === 'bulwark') e.shieldT = 4
        damage(e, mode === 'bomb' ? bombDamage(e.kind) : CHARGE.damage, -1)
      }
    },
    touching(x, y, z, r) {
      for (const e of list) {
        if (!e.active || e.invuln || e.kind === 'missile') continue
        const rr = r + e.radius
        const dx = e.x - x, dy = e.y - y, dz = e.z - z
        if (dx * dx + dy * dy + dz * dz < rr * rr) return true
      }
      return false
    },
    locate(id, out) {
      if (id < 0) return ctx.boss.locate(id, out)
      for (const e of list) {
        if (e.active && e.uid === id) { out.x = e.x; out.y = e.y; out.z = e.z; return true }
      }
      return false
    },
    damage,
    kill,
    remove: deactivate,
    clearMissiles() {
      for (const e of list) if (e.active && e.kind === 'missile') kill(e, -1, true)
    },
    countKind(kind) {
      let n = 0
      for (const e of list) if (e.active && e.kind === kind) n++
      return n
    },
    fireAimed,
    update(dt) {
      const demo = !ctx.started
      for (const e of list) {
        if (!e.active) continue
        e.t += dt
        if (e.flashT > 0) {
          e.flashT -= dt
          if (e.flashT <= 0) e.model.flash(false)
        }
        const px = e.x
        if (e.role === 1) ctx.sets.stepChaser(e, dt)
        else if (e.role === 2) ctx.sets.stepRival(e, dt)
        else stepEnemy(ctx, e, dt, demo)
        if (!e.active) continue
        e.lat = dt > 0 ? (e.x - px) / dt : 0
        const past = e.z > PAST_Z && !(e.kind === 'dasher' && e.st === 0)
        if (past || e.z > KILL_Z || e.y > 60 || e.z < SPAWN_Z - 120) { deactivate(e); continue }
        e.model.root.position.set(e.x, e.y, e.z)
        e.anim.bank = e.bank
        e.model.animate(ctx.now, dt, e.anim)
        if (!demo && !ctx.over && e.role !== 1) ramCheck(e)
      }
      gatherTargets()
    },
    clear() {
      for (const e of list) deactivate(e)
      targets.length = 0
      wingTargets.length = 0
      met.clear()
      if (!live(ctx)) { kills.player = 0; kills.wing = 0 }
    },
    lights(add) {
      for (const e of list) if (e.active) eachLight(e.model.lights, add)
    },
    eachAim(cb) {
      for (const e of list) if (e.active && e.aimOn) cb(e.x, e.y, e.z, e.aimX, e.aimY, e.aimZ)
    },
  }
  return enemies
}

function blank(kind: EnemyKind, model: EnemyModel): Enemy {
  return {
    kind, model, anim: { open: 0, charge: 0, hurt: 0, bank: 0, boost: 0 }, active: false, uid: 0, hp: 1, maxHp: 1, radius: 1,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, lat: 0, t: 0, st: 0, a: 0, b: 0, c: 0, n: 0, side: 1,
    entry: 0, path: 'dropTop', sx: 0, sy: 0, ex: 0, ey: 0, delay: 0, wob: 0, wobSpeed: 2,
    fireT: 1, sinceShot: 9, shoots: true, aimOn: false, aimX: 0, aimY: 0, aimZ: 0, flashT: 0, shieldT: 0,
    invuln: false, owner: 0, target: -1, missiles: false, role: 0, bank: 0, holdZ: -50, holdT: 0,
  }
}
