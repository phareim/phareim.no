/**
 * The sector boss in play (2026-09-25): one director for the five bosses
 * (coast THE PINCER, woods THE MOTH, ember THE FURNACE, lake THE TWINS,
 * space THE CROWN; ECHO loops replay them with more HP and faster clocks).
 *
 * The director owns what they share: parts with HP from bosses.ts
 * (`bossParts`), the HP bar (`bossBarMax`, in-bar parts only), phases and
 * enrage, the attack clock (`tickBossClock`), laser and blast hits against
 * the model's hit spheres (a core only takes damage while its model says
 * it is open: maw, panel, kneel, lit twin, eye, heart; a closed one pings),
 * wingman targets (parts as `part`, open cores as `core`), the entrance,
 * the chain-explosion death, the bar on the HUD, and `bossDownCues` → CLEAR
 * through `ctx.run.bossDown()`. Each boss's brain (scene/bosses/<id>.ts)
 * moves and poses it, runs its attack wheel and draws its telegraphs.
 *
 * Nothing allocates per frame: models and brains are built once per boss
 * and reset; hit spheres are refreshed into the part records once a frame.
 */
import * as THREE from 'three'
import {
  BOSS_DEFS, BOSS_LASER_DAMAGE, bossBarMax, bossEnraged, bossParts, bossPhase, createBossClock, drainTo, laneX as laneCentreX,
  tickBossClock, twinsPhase, type BossPartRole,
} from '../bosses'
import { LANES } from '../balance'
import { bossOf, sectorIndex, type BossId } from '../ids'
import { bossIntroCue, bossPhaseCue, sectorFor } from '../story'
import { P, eachLight } from '../models/core'
import type { AnyBoss, BossPart } from '../models/bosses'
import { drawText, textWidth } from '../../base/pixel/sprites'
import type { PixelStage } from '../../base/pixel/stage'
import { projectTo } from '../pixel'
import type { WingTarget } from '../wingmanAi'
import { addScore, live, rand, type Ctx } from './ctx'
import { createHazards, type Hazards } from './bosses/hazards'
import type { BossBrain, BossRt, HudKit, RtPart } from './bosses/types'
import { createPincerBrain } from './bosses/pincer'
import { createMothBrain } from './bosses/moth'
import { createFurnaceBrain } from './bosses/furnace'
import { createTwinsBrain } from './bosses/twins'
import { createCrownBrain } from './bosses/crown'

export interface Boss {
  readonly active: boolean
  readonly dying: boolean
  readonly id: BossId | null
  readonly name: string
  /** World-speed multiplier while the fight runs (the Crown's chase). */
  readonly speedMul: number
  /** Start this sector's boss (or `id`, for the debug hook). */
  start(id?: BossId): void
  update(dt: number): void
  clear(): void
  /** Push the live parts (`part`) and open cores (`core`) as targets. */
  targets(list: WingTarget[], pool: WingTarget[]): void
  locate(id: number, out: { x: number; y: number; z: number }): boolean
  laserHit(x: number, y: number, z: number, dmg: number): boolean
  blast(x: number, y: number, z: number, r: number, coreDmg: number, partDmg: number): void
  touching(x: number, y: number, z: number, r: number): boolean
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
  /** Telegraphs and weak-point marks on the stage's HUD layer. */
  hud(stage: PixelStage): void
  /** Debug: the fatal parts take whatever they have left. */
  finish(): void
  /** Debug: drain the bar to the start of phase `n`. */
  setPhase(n: number): number
  /** Debug: drain the bar to `frac` of its full length. */
  setHp(frac: number): number
  /** Debug: a snapshot for `state()`. */
  state(): Record<string, unknown> | null
}

/** Model part ids for each boss's part roles, in bosses.ts order. */
const PART_IDS: Record<BossId, Partial<Record<BossPartRole, string[]>>> = {
  pincer: { core: ['core'], claw: ['claw-l', 'claw-r'] },
  moth: { core: ['core'], panel: ['wing-0', 'wing-1', 'wing-2', 'wing-3'] },
  furnace: { core: ['core'], knee: ['knee-0', 'knee-1', 'knee-2'] },
  twins: { twin: ['core-a', 'core-b'] },
  crown: { turret: ['turret-0', 'turret-1', 'turret-2', 'turret-3', 'turret-4', 'turret-5'], eye: ['eye'], heart: ['heart'] },
}

const DEATH_TIME = 2.8
const ENTRANCE_DIST = 150
const RING_EVERY = 13

export function createBoss(ctx: Ctx): Boss {
  const hazards: Hazards = createHazards(ctx)
  const brains = new Map<BossId, BossBrain>()
  const tmp = new THREE.Vector3()
  const blockers: { part: BossPart; wx: number; wy: number; wz: number; wr: number }[] = []

  let brain: BossBrain | null = null
  let model: AnyBoss | null = null
  let active = false
  let deathT = -1
  let deathTick = 0
  let barMax = 0
  let barSent = -1
  let name = ''
  let lastDt = 1 / 60
  let flashT = 0
  let flashCool = 0
  let aimWing = false
  let ringT = RING_EVERY

  function buildBrain(id: BossId): BossBrain {
    let b = brains.get(id)
    if (b) return b
    switch (id) {
      case 'pincer': b = createPincerBrain(ctx); break
      case 'moth': b = createMothBrain(ctx); break
      case 'furnace': b = createFurnaceBrain(ctx); break
      case 'twins': b = createTwinsBrain(ctx); break
      case 'crown': b = createCrownBrain(ctx); break
    }
    b.model.root.visible = false
    ctx.scene.add(b.model.root)
    brains.set(id, b)
    return b
  }

  const rt: BossRt = {
    ctx, id: 'pincer', model: null as unknown as AnyBoss, hazards, clock: createBossClock(), parts: [],
    sector: 1, phase: 1, enraged: false, t: 0, arrived: false, entry: 0, startZ: -200, parkZ: -60,
    x: 0, y: 0, z: -200, k: 1, speedMul: 1, root: null as unknown as THREE.Group,
    aim(out) {
      aimWing = !aimWing
      const slot = aimWing ? ctx.squad.aggro() : -1
      const w = slot >= 0 ? ctx.squad.members[slot] : null
      if (w && w.alive) { out.x = w.x; out.y = w.y; out.z = w.z }
      else { out.x = ctx.player.x; out.y = ctx.player.y; out.z = 0 }
    },
    world(node, x, y, z, out) {
      node.updateWorldMatrix(true, false)
      return node.localToWorld(out.set(x, y, z))
    },
    alive(role) {
      let n = 0
      for (const p of rt.parts) if (p.role === role && p.alive) n++
      return n
    },
  }

  function bar(): number {
    let n = 0
    for (const p of rt.parts) if (p.inBar) n += Math.max(0, p.hp)
    return n
  }

  function emit(force = false) {
    const b = active ? Math.ceil(bar()) : 0
    if (!force && b === barSent) return
    barSent = b
    ctx.out.boss(b, barMax, active, name)
  }

  function refreshSpheres() {
    if (!model) return
    model.root.updateMatrixWorld(true)
    const k = rt.k
    for (const p of rt.parts) {
      tmp.set(p.model.x, p.model.y, p.model.z).applyMatrix4(p.model.node.matrixWorld)
      p.wx = tmp.x; p.wy = tmp.y; p.wz = tmp.z
      p.wr = p.model.r * k
    }
    for (const b of blockers) {
      tmp.set(b.part.x, b.part.y, b.part.z).applyMatrix4(b.part.node.matrixWorld)
      b.wx = tmp.x; b.wy = tmp.y; b.wz = tmp.z
      b.wr = b.part.r * k
    }
  }

  function updatePhase() {
    const frac = barMax > 0 ? bar() / barMax : 0
    rt.enraged = bossEnraged(rt.id, frac)
    const n = rt.id === 'twins'
      ? twinsPhase([rt.parts[0]?.alive ?? false, rt.parts[1]?.alive ?? false])
      : bossPhase(rt.id, frac, rt.sector)
    if (n > rt.phase) {
      rt.phase = n
      brain?.phase(rt, n)
      const cue = bossPhaseCue(rt.sector - 1, n)
      if (cue) ctx.story.cue(cue)
      ctx.shake = Math.max(ctx.shake, 0.5)
    }
  }

  function flash() {
    if (!model || flashCool > 0) return
    model.flash(true)
    flashT = 0.06
    flashCool = 0.22
  }

  function startDeath() {
    if (deathT >= 0) return
    deathT = 0
    deathTick = 0
    brain?.abort(rt)
    hazards.beam(false)
    ctx.shake = 1.2
    ctx.flash = Math.max(ctx.flash, 0.4)
    ctx.flashColor = P.white
  }

  function destroyPart(p: RtPart) {
    if (!p.alive || !model) return
    p.alive = false
    p.hp = 0
    ctx.fx.explode(p.wx, p.wy, p.wz, p.role === 'twin' ? P.white : P.hot, p.fatal ? 2.2 : 1.4)
    ctx.fx.flashLight(p.wx, p.wy, p.wz, 6, P.gold, 0.4)
    ctx.sfx.boom(true)
    ctx.shake = Math.max(ctx.shake, 0.6)
    if (p.score > 0) addScore(ctx, p.score * ctx.mult)
    const allFatalDown = rt.parts.every(q => !q.fatal || !q.alive)
    if (allFatalDown) {
      emit()
      startDeath()
      return
    }
    model.setPartDestroyed(p.model.id)
    brain?.partDown(rt, p)
    flash()
    updatePhase()
    emit()
  }

  function damagePart(p: RtPart, dmg: number) {
    if (!p.alive || deathT >= 0) return
    p.hp -= dmg
    if (p.hp <= 0) { destroyPart(p); return }
    if (p.fatal || p.model.kind === 'core') { addScore(ctx, 10); flash() }
    updatePhase()
    emit()
  }

  function kill() {
    const x = rt.x, y = rt.y, z = rt.z
    const k = rt.k
    ctx.fx.explode(x, y, z + 2, P.gold, 3)
    ctx.fx.explode(x - 7 * k, y + 1, z + 3, P.hot, 2.5)
    ctx.fx.explode(x + 7 * k, y - 1, z + 3, P.hot, 2.5)
    ctx.fx.shock(x, y, z, 30 * k, 0.9)
    ctx.fx.flashLight(x, y, z, 30, P.white, 0.8)
    ctx.flash = 1
    ctx.flashColor = P.gold
    ctx.shake = 1.4
    ctx.sfx.boom(true)
    boss.clear()
    ctx.run.bossDown()
  }

  function updateDeath(dt: number) {
    deathT += dt
    deathTick -= dt
    const u = Math.min(1, deathT / DEATH_TIME)
    brain?.dying(rt, u, dt)
    if (deathTick <= 0) {
      deathTick = 0.13 + u * 0.08
      const p = rt.parts[Math.floor(Math.random() * rt.parts.length)]
      const k = rt.k
      const ex = p && Math.random() < 0.6 ? p.wx + rand(-2, 2) * k : rt.x + rand(-9, 9) * k
      const ey = p && Math.random() < 0.6 ? p.wy + rand(-2, 2) * k : rt.y + rand(-3, 5) * k
      const ez = rt.z + rand(-3, 6) * k
      ctx.fx.explode(ex, ey, ez, Math.random() < 0.5 ? P.gold : P.hot, 1.2 + u * 1.2)
      ctx.shake = Math.max(ctx.shake, ctx.reduced ? 0.3 : 0.8)
      ctx.sfx.boom(true)
      if (model && Math.random() < 0.35) { model.flash(true); flashT = 0.05 }
    }
    if (deathT >= DEATH_TIME) kill()
  }

  // ---- the HUD kit: projection and pixel marks on the stage's HUD layer
  const hp = { x: 0, y: 0, r: 0 }
  const hq = { x: 0, y: 0, r: 0 }
  const corner = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]
  let hudStage: PixelStage | null = null
  let kx = 1
  let ky = 1
  const kit: HudKit = {
    g: null as unknown as CanvasRenderingContext2D,
    pulse: 0,
    project(x, y, z, r, out) {
      if (!hudStage || !projectTo(out, ctx.camera, hudStage.vw, hudStage.vh, x, y, z, r, 1, 200)) return false
      out.x *= kx
      out.y *= ky
      out.r *= kx
      return true
    },
    dotted(x0, y0, x1, y1, color) {
      const g = kit.g
      const dx = x1 - x0, dy = y1 - y0
      const n = Math.min(600, Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))))
      g.fillStyle = color
      const on = Math.floor(ctx.now * 20) % 3
      for (let i = 0; i <= n; i++) {
        if ((i + on) % 3 === 2) continue
        g.fillRect(Math.round(x0 + (dx * i) / n), Math.round(y0 + (dy * i) / n), 1, 1)
      }
    },
    corners(cx, cy, s, color) {
      const g = kit.g
      const x0 = Math.round(cx - s), y0 = Math.round(cy - s), x1 = Math.round(cx + s), y1 = Math.round(cy + s)
      g.fillStyle = color
      const l = 3
      g.fillRect(x0, y0, l, 1); g.fillRect(x0, y0, 1, l)
      g.fillRect(x1 - l + 1, y0, l, 1); g.fillRect(x1, y0, 1, l)
      g.fillRect(x0, y1, l, 1); g.fillRect(x0, y1 - l + 1, 1, l)
      g.fillRect(x1 - l + 1, y1, l, 1); g.fillRect(x1, y1 - l + 1, 1, l)
    },
    text(s, cx, y, color) {
      drawText(kit.g, s, Math.round(cx - textWidth(s) / 2), Math.round(y), color, P.ink)
    },
    laneBox(l0, l1, z, y0, y1, color) {
      const half = ctx.laneX / LANES
      const xa = laneCentreX(l0, ctx.laneX) - half
      const xb = laneCentreX(l1, ctx.laneX) + half
      for (let i = 0; i < 4; i++) {
        if (!kit.project(i === 0 || i === 3 ? xa : xb, i < 2 ? y0 : y1, z, 1, hp)) return
        corner[i]!.x = hp.x
        corner[i]!.y = hp.y
      }
      const a = corner[0]!, b = corner[1]!, c = corner[2]!, d = corner[3]!
      kit.dotted(a.x, a.y, b.x, b.y, color)
      kit.dotted(b.x, b.y, c.x, c.y, color)
      kit.dotted(c.x, c.y, d.x, d.y, color)
      kit.dotted(d.x, d.y, a.x, a.y, color)
      // hatch: slanted strokes across the box
      const w = Math.abs(b.x - a.x)
      const n = Math.max(2, Math.floor(w / 8))
      for (let i = 1; i < n; i++) {
        const u = i / n
        const u2 = Math.min(1, u + 0.12)
        kit.dotted(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, d.x + (c.x - d.x) * u2, d.y + (c.y - d.y) * u2, color)
      }
    },
  }

  const boss: Boss = {
    get active() { return active },
    get dying() { return deathT >= 0 },
    get id() { return active ? rt.id : null },
    get name() { return name },
    get speedMul() { return active && deathT < 0 ? rt.speedMul : 1 },
    start(forceId) {
      if (active) boss.clear()
      const id = forceId ?? bossOf(ctx.sector)
      brain = buildBrain(id)
      model = brain.model
      rt.id = id
      rt.model = model
      rt.root = model.root
      rt.sector = ctx.sector
      rt.phase = 1
      rt.enraged = false
      rt.t = 0
      rt.arrived = false
      rt.entry = 0
      rt.speedMul = 1
      rt.k = ctx.laneX / 11
      rt.parkZ = BOSS_DEFS[id].parkZ
      rt.startZ = rt.parkZ - ENTRANCE_DIST
      rt.x = 0
      rt.y = 0
      rt.z = rt.startZ
      rt.clock = createBossClock(1.0)
      model.reset()
      model.root.rotation.set(0, 0, 0)
      model.root.scale.setScalar(rt.k)
      // parts from the table, matched to the model's hit spheres
      rt.parts.length = 0
      const ids = PART_IDS[id]
      for (const def of bossParts(id, ctx.sector)) {
        const names = ids[def.role] ?? []
        for (let i = 0; i < def.count; i++) {
          const mp = model.part(names[i] ?? '')
          if (!mp) continue
          rt.parts.push({
            idx: rt.parts.length, role: def.role, model: mp, hp: def.hp, max: def.hp, alive: true,
            fatal: def.fatal, inBar: def.inBar, gate: def.gate, score: def.score, wx: 0, wy: 0, wz: 0, wr: mp.r,
          })
        }
      }
      // every other hit sphere on the model stops lasers (legs, twin hulls, hull plates)
      blockers.length = 0
      for (const mp of [...model.parts, ...model.cores]) {
        if (rt.parts.some(p => p.model === mp)) continue
        blockers.push({ part: mp, wx: 0, wy: 0, wz: 0, wr: mp.r })
      }
      barMax = bossBarMax(id, ctx.sector)
      name = sectorFor(ctx.sector - 1).bossName
      active = true
      deathT = -1
      flashT = 0
      flashCool = 0
      aimWing = false
      ringT = RING_EVERY
      hazards.clear()
      brain.enter(rt)
      model.root.position.set(rt.x, rt.y, rt.z)
      model.root.visible = true
      barSent = -1
      emit(true)
      ctx.story.cue(bossIntroCue(ctx.sector - 1))
      const alive = ctx.squad.aliveIds
      if (alive.length) ctx.story.wing('boss', ctx.squad.slotOf(alive[Math.floor(Math.random() * alive.length)]!))
    },
    update(dt) {
      if (!active || !brain || !model) return
      lastDt = dt
      rt.t += dt
      if (flashT > 0) { flashT -= dt; if (flashT <= 0) model.flash(false) }
      if (flashCool > 0) flashCool -= dt
      if (deathT >= 0) {
        updateDeath(dt)
        if (!active) return
      } else {
        if (!rt.arrived) {
          rt.z = Math.min(rt.parkZ, rt.z + BOSS_DEFS[rt.id].entranceSpeed * dt)
          rt.entry = (rt.z - rt.startZ) / (rt.parkZ - rt.startZ)
          if (rt.z >= rt.parkZ) { rt.arrived = true; rt.entry = 1 }
        } else if (live(ctx)) {
          const ev = tickBossClock(rt.clock, rt.id, dt, rt.phase, rt.sector, rt.enraged)
          const atk = rt.clock.attack
          if (ev && atk) brain.stage(rt, atk, ev)
          if (atk) brain.tick(rt, atk, dt)
          ringT -= dt
          if (ringT <= 0) {
            ringT = RING_EVERY
            ctx.pickups.ring(rand(-0.6, 0.6), rand(0.3, 0.7), false)
          }
        }
      }
      brain.move(rt, dt)
      model.animate(rt.t, dt)
      model.root.position.set(rt.x, rt.y, rt.z)
      hazards.update(dt)
      refreshSpheres()
    },
    clear() {
      hazards.clear()
      if (!active) return
      active = false
      deathT = -1
      if (model) { model.flash(false); model.root.visible = false }
      brain?.abort(rt)
      emit(true)
    },
    targets(list, pool) {
      if (!active || deathT >= 0) return
      let cores = 0
      for (const p of rt.parts) {
        if (!p.alive || list.length >= pool.length) continue
        const core = p.model.kind === 'core'
        if (core && !p.model.open) continue
        const w = pool[list.length]!
        w.id = -1 - p.idx
        w.kind = core ? 'core' : 'part'
        w.x = p.wx; w.y = p.wy; w.z = p.wz
        w.vx = 0
        w.onShip = false
        list.push(w)
        if (core) cores++
      }
      // Nothing open and nothing to break: keep the wingmen on a closed core, waiting.
      if (cores === 0 && list.length < pool.length) {
        let p: RtPart | null = null
        let parts = 0
        for (const q of rt.parts) {
          if (!q.alive) continue
          if (q.model.kind === 'part') parts++
          else if (!p) p = q
        }
        if (p && parts === 0) {
          const w = pool[list.length]!
          w.id = -1 - p.idx
          w.kind = 'core'
          w.x = p.wx; w.y = p.wy; w.z = p.wz
          w.vx = 0
          w.onShip = false
          list.push(w)
        }
      }
    },
    locate(id, out) {
      if (!active) return false
      const p = rt.parts[-1 - id]
      if (!p || !p.alive) return false
      out.x = p.wx; out.y = p.wy; out.z = p.wz
      return true
    },
    laserHit(lx, ly, lz, dmg) {
      if (!active) return false
      const step = (ctx.worldSpeed + 150) * lastDt
      if (hazards.laserHit(lx, ly, lz, step)) return true
      if (deathT >= 0 || !model) return false
      const reach = 24 * rt.k
      if (lz > rt.z + reach || lz + step < rt.z - reach) return false
      const z1 = lz + step
      // open cores and live parts
      for (const p of rt.parts) {
        if (!p.alive || !p.model.open) continue
        if (p.wz + p.wr < lz || p.wz - p.wr > z1) continue
        const dx = lx - p.wx, dy = ly - p.wy
        if (dx * dx + dy * dy < p.wr * p.wr) {
          ctx.fx.sparks(lx, ly, p.wz + p.wr * 0.5, p.model.kind === 'core' ? P.gold : P.hot, 6, 7)
          damagePart(p, dmg * BOSS_LASER_DAMAGE)
          return true
        }
      }
      // closed cores ping
      for (const p of rt.parts) {
        if (!p.alive || p.model.open) continue
        if (p.wz + p.wr < lz || p.wz - p.wr > z1) continue
        const dx = lx - p.wx, dy = ly - p.wy
        if (dx * dx + dy * dy < p.wr * p.wr) {
          ctx.fx.sparks(lx, ly, p.wz + p.wr, P.white, 3, 5)
          ctx.sfx.tick()
          return true
        }
      }
      // hull
      for (const b of blockers) {
        if (!b.part.alive || !b.part.node.visible) continue
        if (b.wz + b.wr < lz || b.wz - b.wr > z1) continue
        const dx = lx - b.wx, dy = ly - b.wy
        if (dx * dx + dy * dy < b.wr * b.wr) {
          ctx.fx.sparks(lx, ly, b.wz + b.wr * 0.6, P.lavender, 2, 4)
          return true
        }
      }
      return false
    },
    blast(bx, by, bz, r, coreDmg, partDmg) {
      if (!active) return
      hazards.blast(bx, by, bz, r)
      if (deathT >= 0) return
      for (const p of rt.parts) {
        if (!p.alive || !p.model.open) continue
        const dx = p.wx - bx, dy = p.wy - by, dz = p.wz - bz
        const rr = r + p.wr
        if (dx * dx + dy * dy + dz * dz < rr * rr) damagePart(p, p.model.kind === 'core' ? coreDmg : partDmg)
      }
    },
    touching(x, y, z, r) {
      if (!active || deathT >= 0) return false
      for (const p of rt.parts) {
        if (!p.alive) continue
        const dx = p.wx - x, dy = p.wy - y, dz = p.wz - z, rr = r + p.wr
        if (dx * dx + dy * dy + dz * dz < rr * rr) return true
      }
      for (const b of blockers) {
        if (!b.part.alive) continue
        const dx = b.wx - x, dy = b.wy - y, dz = b.wz - z, rr = r + b.wr
        if (dx * dx + dy * dy + dz * dz < rr * rr) return true
      }
      const dx = rt.x - x, dy = rt.y - y, dz = rt.z - z, rr = r + 5 * rt.k
      return dx * dx + dy * dy + dz * dz < rr * rr
    },
    lights(add) {
      if (!active) { hazards.lights(add); return }
      if (model) eachLight(model.lights, add, rt.k)
      hazards.lights(add)
    },
    hud(stage) {
      if (!active || !brain) return
      hudStage = stage
      kit.g = stage.hud
      kx = stage.hw / stage.vw
      ky = stage.hh / stage.vh
      kit.pulse = Math.floor(ctx.now * 8) % 2
      hazards.hud(kit)
      if (deathT >= 0 || !rt.arrived) return
      brain.hud(rt, kit)
      // open weak points: gold corners
      for (const p of rt.parts) {
        if (!p.alive || p.model.kind !== 'core' || !p.model.open) continue
        if (!kit.project(p.wx, p.wy, p.wz, p.wr, hq)) continue
        kit.corners(hq.x, hq.y, hq.r + 2 + kit.pulse, kit.pulse ? P.gold : P.sunPale)
      }
    },
    finish() {
      if (!active || deathT >= 0) return
      for (const p of rt.parts) {
        if (p.fatal && p.alive) destroyPart(p)
        if (deathT >= 0) break
      }
    },
    setPhase(n) {
      if (!active || deathT >= 0) return rt.phase
      const def = BOSS_DEFS[rt.id]
      if (rt.id === 'twins') {
        if (n >= 2 && rt.parts[0]?.alive) damagePart(rt.parts[0]!, rt.parts[0]!.hp)
        return rt.phase
      }
      if (rt.id === 'crown') {
        // phase 2: every turret down; phase 3: the eye too
        for (const p of rt.parts) if (p.alive && (p.role === 'turret' || (n >= 3 && p.role === 'eye'))) damagePart(p, p.hp)
        return rt.phase
      }
      if (rt.id === 'moth' && n >= 2) for (const p of rt.parts) if (p.alive && p.role === 'panel') damagePart(p, p.hp)
      if (rt.id === 'furnace' && n >= 2) { const kn = rt.parts.find(p => p.alive && p.role === 'knee'); if (kn) damagePart(kn, kn.hp) }
      // the rest comes off the core, so the breakable parts left stay up
      const at = def.phaseAt[n - 2]
      const core = rt.parts.find(p => p.fatal && p.alive)
      if (at !== undefined && core && barMax > 0 && bar() / barMax > at) damagePart(core, Math.min(core.hp - 1, bar() - Math.floor(at * barMax) + 1))
      return rt.phase
    },
    setHp(frac) {
      if (!active || deathT >= 0) return 0
      const target = Math.max(1, Math.round(Math.max(0, Math.min(1, frac)) * barMax))
      const next = drainTo(rt.parts, target)
      for (let i = 0; i < rt.parts.length; i++) {
        const p = rt.parts[i]!
        const d = p.hp - next[i]!
        if (d > 0) damagePart(p, d)
      }
      updatePhase()
      emit()
      return barMax > 0 ? bar() / barMax : 0
    },
    state() {
      if (!active) return null
      return {
        id: rt.id, name, phase: rt.phase, enraged: rt.enraged, arrived: rt.arrived, dying: deathT >= 0,
        bar: Math.ceil(bar()), max: barMax, x: +rt.x.toFixed(1), y: +rt.y.toFixed(1), z: +rt.z.toFixed(1),
        attack: rt.clock.attack?.id ?? null, stage: rt.clock.stage, hazards: hazards.count,
        parts: rt.parts.map(p => `${p.model.id}:${Math.ceil(p.hp)}${p.alive ? (p.model.open ? '' : '·shut') : '·dead'}`),
      }
    },
  }

  return boss
}
