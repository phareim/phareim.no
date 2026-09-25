/**
 * Capsules and rings. Capsules are the models in models/capsules.ts, one
 * of each type per pool slot (built up front); fly through one to take it
 * (arsenal.ts `applyCapsule`). Silver rings heal; gold rings sit off the
 * easy line, heal more, and three in one sector pay ALL GOLD.
 */
import { HP_MAX, heal, laneY } from '../balance'
import { CAPSULES, applyCapsule, collectRing, pickCapsule, shieldUp, type CapsuleType } from '../arsenal'
import { CAPSULE_IDS, createCapsule, createRing, CAPSULE_INFO, type CapsuleModel, type RingModel } from '../models/capsules'
import { P, eachLight } from '../models/core'
import { SPAWN_Z, addScore, live, rand, type Ctx } from './ctx'

export interface Pickups {
  /** A capsule at world (x, y, z); `type` null picks one by need. */
  capsule(type: CapsuleType | null, x: number, y: number, z?: number): void
  /** A ring at normalised (xn, yn). */
  ring(xn: number, yn: number, gold: boolean, z?: number): void
  ringGate(xs: readonly number[], ys: readonly number[], spacing: number): void
  update(dt: number): void
  clear(): void
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
  /** Visible capsules, for the HUD letter badge. */
  eachCapsule(cb: (x: number, y: number, z: number, type: CapsuleType, model: CapsuleModel) => void): void
  readonly count: number
}

const CAPSULE_SLOTS = 4
const SILVER = 12
const GOLD = 3
const PICK_R = 2.4

interface CapSlot { models: Record<CapsuleType, CapsuleModel>; active: boolean; type: CapsuleType; x: number; y: number; z: number }
interface RingSlot { m: RingModel; gold: boolean; active: boolean; x: number; y: number; z: number; flash: number }

export function createPickups(ctx: Ctx): Pickups {
  const caps: CapSlot[] = []
  for (let i = 0; i < CAPSULE_SLOTS; i++) {
    const models = {} as Record<CapsuleType, CapsuleModel>
    for (const t of CAPSULE_IDS) {
      const m = createCapsule(t)
      m.root.visible = false
      ctx.scene.add(m.root)
      models[t] = m
    }
    caps.push({ models, active: false, type: 'laser', x: 0, y: 0, z: 0 })
  }
  const rings: RingSlot[] = []
  for (let i = 0; i < SILVER + GOLD; i++) {
    const gold = i >= SILVER
    const m = createRing(gold ? 'gold' : 'silver')
    m.root.visible = false
    ctx.scene.add(m.root)
    rings.push({ m, gold, active: false, x: 0, y: 0, z: 0, flash: 0 })
  }
  let count = 0

  function need(): CapsuleType {
    let down = 0
    for (const m of ctx.squad.members) if (!m.alive) down++
    return pickCapsule({ hp: ctx.hp, bombs: ctx.arsenal.bombs, laser: ctx.arsenal.laser, wingsDown: down, shieldOn: shieldUp(ctx.arsenal) })
  }

  function takeCapsule(c: CapSlot) {
    c.active = false
    c.models[c.type].root.visible = false
    count--
    const info = CAPSULE_INFO[c.type]
    ctx.fx.sparks(c.x, c.y, c.z, info.color, 30, 12)
    ctx.fx.sparks(c.x, c.y, c.z, P.white, 12, 8)
    ctx.fx.wave(c.x, c.y, c.z, info.color)
    ctx.flash = Math.max(ctx.flash, 0.35)
    ctx.flashColor = info.color
    if (!live(ctx)) return
    const r = applyCapsule(ctx.arsenal, c.type)
    addScore(ctx, r.score * ctx.mult)
    if (r.respawnWing && ctx.squad.reviveAll() > 0) ctx.story.cue('wing:rally')
    if (r.cue) ctx.story.cue(r.cue)
    const a = ctx.arsenal
    const label = c.type === 'laser' ? ['TWIN', 'TWIN+', 'HYPER'][a.laser - 1]! : c.type === 'bomb' ? `NOVA BOMB ${a.bombs}` : CAPSULES[c.type].name
    ctx.out.toast(label)
    ctx.sfx.powerup()
    ctx.run.arsenalDirty()
  }

  function takeRing(r: RingSlot) {
    r.flash = 1
    ctx.fx.sparks(r.x, r.y, r.z, r.gold ? P.gold : P.lavender, 26, 12)
    ctx.flash = Math.max(ctx.flash, r.gold ? 0.45 : 0.3)
    ctx.flashColor = r.gold ? P.gold : P.pink
    if (!live(ctx)) return
    const res = collectRing(ctx.arsenal, r.gold ? 'gold' : 'silver')
    addScore(ctx, res.score * (r.gold ? 1 : ctx.mult))
    if (ctx.hp < HP_MAX) {
      ctx.hp = heal(ctx.hp, res.heal)
      ctx.out.health(ctx.hp, HP_MAX)
    }
    if (res.cue) ctx.story.cue(res.cue)
    if (r.gold) {
      ctx.out.toast(res.cue === 'gold:all' ? 'ALL GOLD · +3000' : `GOLD RING ${ctx.arsenal.gold}/3`)
      ctx.run.arsenalDirty()
    }
    ctx.sfx.ring()
  }

  function ring(xn: number, yn: number, gold: boolean, z = SPAWN_Z - rand(0, 20)) {
    let r: RingSlot | null = null
    for (const v of rings) if (v.gold === gold && !v.active) { r = v; break }
    if (!r) return
    r.active = true
    r.x = xn * ctx.laneX
    r.y = laneY(yn)
    r.z = z
    r.flash = 0
    r.m.root.visible = true
    r.m.root.scale.setScalar(1)
    r.m.root.position.set(r.x, r.y, r.z)
  }

  return {
    get count() { return count },
    capsule(type, x, y, z = SPAWN_Z - rand(0, 20)) {
      let c: CapSlot | null = null
      for (const v of caps) if (!v.active) { c = v; break }
      if (!c) return
      c.type = type ?? need()
      c.active = true
      c.x = x; c.y = y; c.z = z
      const m = c.models[c.type]
      m.root.visible = true
      m.root.position.set(x, y, z)
      count++
    },
    ring,
    ringGate(xs, ys, spacing) {
      for (let i = 0; i < xs.length; i++) ring(xs[i]!, ys[i]!, false, SPAWN_Z - i * spacing)
    },
    update(dt) {
      const ws = ctx.worldSpeed
      const p = ctx.player
      const t = ctx.now
      for (const c of caps) {
        if (!c.active) continue
        const pz = c.z
        c.z += ws * dt
        const m = c.models[c.type]
        m.root.position.set(c.x, c.y, c.z)
        m.animate(t, dt)
        if (pz < 0 && c.z >= 0 && p.visible && !ctx.over) {
          const dx = p.x - c.x, dy = p.y - c.y
          if (dx * dx + dy * dy < PICK_R * PICK_R) { takeCapsule(c); continue }
        }
        if (c.z > 12) { c.active = false; m.root.visible = false; count-- }
      }
      for (const r of rings) {
        if (!r.active) continue
        const pz = r.z
        r.z += ws * dt
        r.m.root.position.set(r.x, r.y, r.z)
        r.m.animate(t, dt)
        if (r.flash > 0) {
          r.flash = Math.max(0, r.flash - dt * 2.5)
          r.m.root.scale.setScalar(1 + r.flash * 0.9)
        }
        if (pz < 0 && r.z >= 0 && r.flash <= 0 && p.visible && !ctx.over) {
          const dx = p.x - r.x, dy = p.y - r.y
          if (dx * dx + dy * dy < 2.2 * 2.2) takeRing(r)
        }
        if (r.z > 12) { r.active = false; r.m.root.visible = false }
      }
    },
    clear() {
      for (const c of caps) { c.active = false; c.models[c.type].root.visible = false }
      count = 0
      for (const r of rings) { r.active = false; r.m.root.visible = false }
    },
    lights(add) {
      for (const c of caps) if (c.active) eachLight(c.models[c.type].lights, add)
      for (const r of rings) if (r.active) eachLight(r.m.lights, add)
    },
    eachCapsule(cb) {
      for (const c of caps) if (c.active) cb(c.x, c.y, c.z, c.type, c.models[c.type])
    },
  }
}
