/**
 * The squad: three wingmen from `squadFor(callsign)` (HERON, BISON, DINGO,
 * or a reserve for a pilot who shares the player's animal), each flying
 * its WINGMEN slot on its own brain (wingmanAi.ts, stepped together with
 * `stepSquad` so they spread over targets). Own hull, death, respawn and
 * callouts; they draw part of the Hollow's aimed fire (`pickAggroTarget`)
 * and fire through the shared laser pool. The W capsule revives everyone.
 * Set pieces can take one over (Dingo's trouble).
 */
import * as THREE from 'three'
import { WINGMEN, WING_INVULN, pickAggroTarget, type WingId, type WingProfile } from '../balance'
import { wingFireMul } from '../arsenal'
import { createWingAi, stepSquad, turnRate, type SquadMember, type WingAi, type WingStep } from '../wingmanAi'
import { buildWingShip, WING_TRIMS, type WingShipModel } from '../models/allies'
import { createEngineTrail, type EngineTrail } from '../models/fx'
import { eachLight } from '../models/core'
import { LANE_Y_HI, LANE_Y_LO, clamp, live, type Ctx, type SquadHud } from './ctx'

export interface WingMember {
  id: WingId
  slot: number
  prof: WingProfile
  model: WingShipModel
  trail: EngineTrail
  ai: WingAi
  hp: number
  alive: boolean
  respawnT: number
  invulnUntil: number
  fireT: number
  x: number
  y: number
  z: number
  /** A set piece flies this one (Dingo's trouble): it heads for (tx, ty, tz). */
  trouble: boolean
  tx: number
  ty: number
  tz: number
}

export interface Squad {
  readonly members: WingMember[]
  /** Ids of the wingmen flying right now (slot order). */
  readonly aliveIds: WingId[]
  setup(ids: readonly WingId[]): void
  reset(): void
  update(dt: number): void
  damage(slot: number, dmg: number): void
  /** A blast at (x, y, z): every wingman inside `r` takes `dmg`. */
  blast(x: number, y: number, z: number, r: number, dmg: number): void
  kill(slot: number): void
  /** The W capsule: every downed wingman back at full hull. Returns how many. */
  reviveAll(): number
  /** Who an aimed shot goes for: a wing slot, or −1 for the player. */
  aggro(): number
  slotOf(id: WingId): number
  /** A wingman scored a kill (story: Heron counts). */
  credit(slot: number): void
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
  /** Trim colour of a slot. */
  trim(slot: number): string
  /** Something the HUD shows changed (a set piece took a wingman). */
  touch(): void
}

const CALLOUT_GAP = 2.6
/** The wing ships fly a little smaller and further ahead than their
 * WINGMEN slot depth, so none sits between the camera and the lead. */
const WING_SCALE = 0.72
const WING_Z_SHIFT = -3
const WING_X_SCALE = 1.3

/** The formation slot in the scene: the WINGMEN slot spread a little wider and never behind the lead. */
function slotX(p: WingProfile) { return p.slot.x * WING_X_SCALE }
function slotY(p: WingProfile) { return Math.max(p.slot.y, -0.6) }
function slotZ(p: WingProfile) { return Math.min(p.slot.z + WING_Z_SHIFT, -0.6) }

export function createSquad(ctx: Ctx): Squad {
  const members: WingMember[] = []
  const aliveIds: WingId[] = []
  const stepMembers: SquadMember[] = []
  const stepOf: WingMember[] = []
  const inputs: SquadMember[] = []
  const avoid = { x: 0, y: 0 }
  const ev = new THREE.Vector3()
  const hud: SquadHud[] = []
  let hudDirty = true
  let lastCallout = -10

  function build(id: WingId, slot: number): WingMember {
    const model = buildWingShip(id)
    model.root.scale.setScalar(WING_SCALE)
    ctx.scene.add(model.root)
    const trail = createEngineTrail(WING_TRIMS[id][0], 7, 0.26, 2.4)
    ctx.scene.add(trail.mesh)
    const prof = WINGMEN[id]
    return {
      id, slot, prof, model, trail, ai: createWingAi(id), hp: prof.hp, alive: true, respawnT: 0, invulnUntil: 0, fireT: 0,
      x: slotX(prof), y: slotY(prof), z: slotZ(prof), trouble: false, tx: 0, ty: 0, tz: 0,
    }
  }

  function makeInput(m: WingMember): SquadMember {
    return {
      ai: m.ai,
      input: {
        dt: 0, now: 0, buddy: { x: 0, y: 0 }, ship: { x: 0, y: 0, hp: 100 }, formation: { x: 0, y: 0 },
        lane: { xMax: 11, yLo: LANE_Y_LO, yHi: LANE_Y_HI }, targets: ctx.enemies.wingTargets, demo: false,
      },
    }
  }

  function refreshAlive() {
    aliveIds.length = 0
    for (const m of members) if (m.alive) aliveIds.push(m.id)
    hudDirty = true
  }

  function formationX(m: WingMember) { return clamp(ctx.player.x + slotX(m.prof), -ctx.laneX, ctx.laneX) }
  function formationY(m: WingMember) { return clamp(ctx.player.y + slotY(m.prof), LANE_Y_LO, LANE_Y_HI) }

  function respawn(m: WingMember, invuln: number) {
    m.alive = true
    m.hp = m.prof.hp
    m.x = formationX(m)
    m.y = formationY(m)
    m.z = slotZ(m.prof)
    Object.assign(m.ai, createWingAi(m.id))
    m.invulnUntil = ctx.now + invuln
    m.model.root.visible = true
    m.model.down(false)
    m.trail.reset(m.x, m.y, m.z + 1.5)
    m.trail.mesh.visible = true
    ctx.fx.sparks(m.x, m.y, m.z, WING_TRIMS[m.id][0], 24, 10)
  }

  function emitHud() {
    hudDirty = false
    for (let i = 0; i < members.length; i++) {
      const m = members[i]!
      const h = hud[i] ?? (hud[i] = { id: m.id, hp: 0, max: 0, alive: true, respawn: 0, trouble: false })
      h.id = m.id
      h.hp = Math.ceil(m.hp)
      h.max = m.prof.hp
      h.alive = m.alive
      h.respawn = Math.ceil(m.respawnT)
      h.trouble = m.trouble
    }
    hud.length = members.length
    ctx.out.squad(hud)
  }

  function say(m: WingMember, step: WingStep) {
    if (!step.sayKey || step.sayKey === 'lock' || step.sayKey === 'hit' || step.sayKey === 'down' || step.sayKey === 'online') return
    if (step.sayKey === 'cover') ctx.story.wing('cover', m.slot)
    if (ctx.now - lastCallout < CALLOUT_GAP || !step.say) return
    lastCallout = ctx.now
    ctx.out.callout(`${m.prof.name} ▶ ${step.say}`)
  }

  const squad: Squad = {
    members,
    aliveIds,
    setup(ids) {
      const same = members.length === ids.length && members.every((m, i) => m.id === ids[i])
      if (!same) {
        for (const m of members) {
          ctx.scene.remove(m.model.root)
          ctx.scene.remove(m.trail.mesh)
          m.trail.mesh.geometry.dispose()
        }
        members.length = 0
        inputs.length = 0
        ids.forEach((id, i) => {
          const m = build(id, i)
          members.push(m)
          inputs.push(makeInput(m))
        })
      }
      squad.reset()
    },
    reset() {
      for (const m of members) {
        m.trouble = false
        respawn(m, 1.5)
        m.fireT = 0
      }
      lastCallout = -10
      refreshAlive()
    },
    update(dt) {
      const demo = !ctx.started || ctx.over
      const p = ctx.player
      stepMembers.length = 0
      stepOf.length = 0
      for (let i = 0; i < members.length; i++) {
        const m = members[i]!
        if (!m.alive) {
          if (live(ctx)) {
            const before = Math.ceil(m.respawnT)
            m.respawnT -= dt
            if (m.respawnT <= 0) {
              respawn(m, WING_INVULN)
              refreshAlive()
              ctx.story.wing('back', m.slot)
            } else if (Math.ceil(m.respawnT) !== before) hudDirty = true
          }
          continue
        }
        const si = inputs[i]!
        const inp = si.input
        inp.dt = dt
        inp.now = ctx.now
        inp.buddy.x = m.x
        inp.buddy.y = m.y
        inp.ship.x = p.x
        inp.ship.y = p.y
        inp.ship.hp = ctx.hp
        inp.formation.x = formationX(m)
        inp.formation.y = formationY(m)
        inp.lane.xMax = ctx.laneX
        inp.targets = ctx.enemies.wingTargets
        inp.demo = demo || m.trouble
        stepMembers.push(si)
        stepOf.push(m)
      }
      const steps = stepSquad(stepMembers)
      const wingMul = wingFireMul(ctx.arsenal)
      for (let k = 0; k < steps.length; k++) {
        const m = stepOf[k]!
        const step = steps[k]!
        let tx = step.tx
        let ty = step.ty
        let rate = turnRate(m.ai, step.mode)
        let tz = slotZ(m.prof)
        if (m.trouble) {
          tx = m.tx
          ty = m.ty
          tz = m.tz
          rate = 3
        } else {
          ctx.obstacles.avoid(tx, ty, avoid)
          tx = clamp(avoid.x, -ctx.laneX, ctx.laneX)
          ty = clamp(avoid.y, LANE_Y_LO, LANE_Y_HI)
          if (!demo) say(m, step)
        }
        const kk = 1 - Math.exp(-rate * dt)
        const bankTarget = clamp((tx - m.x) * -0.12, -0.7, 0.7)
        m.x += (tx - m.x) * kk
        m.y += (ty - m.y) * kk
        m.z += (tz - m.z) * (1 - Math.exp(-2 * dt))
        const bank = m.model.bank
        bank.rotation.z += (bankTarget - bank.rotation.z) * Math.min(1, dt * 8)
        const t = ctx.now
        m.model.root.position.set(m.x, m.y + Math.sin(t * 2.1 + m.slot * 1.3) * 0.08, m.z)
        m.model.root.visible = t >= m.invulnUntil || Math.floor(t * 12) % 2 === 0
        m.model.animate(t, dt, wingMul > 1 ? 1 : 0)
        m.model.root.updateMatrixWorld()
        ev.copy(m.model.engine)
        bank.localToWorld(ev)
        m.trail.update(dt, ev.x, ev.y, ev.z, ctx.worldSpeed * 0.6)
        if (live(ctx) && !m.trouble) {
          m.fireT += dt
          const iv = m.prof.fireInterval / wingMul
          if (m.fireT >= iv) {
            if (step.fire) {
              m.fireT = 0
              ctx.shots.laser(m.x, m.y + 0.05, m.z - 1.2, WING_TRIMS[m.id][0], 1, m.slot, 0)
            } else m.fireT = iv
          }
        }
      }
      if (hudDirty) emitHud()
    },
    damage(slot, dmg) {
      const m = members[slot]
      if (!m || !m.alive || !live(ctx) || ctx.now < m.invulnUntil) return
      m.hp -= dmg
      hudDirty = true
      if (m.hp <= 0) { squad.kill(slot); return }
      m.invulnUntil = ctx.now + 0.6
      ctx.fx.sparks(m.x, m.y, m.z, WING_TRIMS[m.id][0], 12, 8)
    },
    blast(x, y, z, r, dmg) {
      for (let i = 0; i < members.length; i++) {
        const m = members[i]!
        if (!m.alive) continue
        const dx = m.x - x, dy = m.y - y, dz = m.z - z
        if (dx * dx + dy * dy + dz * dz < r * r) squad.damage(i, dmg)
      }
    },
    kill(slot) {
      const m = members[slot]
      if (!m || !m.alive) return
      m.alive = false
      m.hp = 0
      m.trouble = false
      m.respawnT = m.prof.respawn
      m.model.root.visible = false
      m.trail.mesh.visible = false
      ctx.fx.explode(m.x, m.y, m.z, WING_TRIMS[m.id][0], 1.6)
      ctx.shake = Math.max(ctx.shake, 0.6)
      ctx.sfx.boom(true)
      refreshAlive()
      if (live(ctx)) ctx.story.wing('down', slot)
    },
    reviveAll() {
      let n = 0
      for (const m of members) {
        if (m.alive) { m.hp = m.prof.hp; continue }
        respawn(m, WING_INVULN)
        n++
      }
      refreshAlive()
      return n
    },
    aggro() {
      const id = pickAggroTarget(aliveIds, Math.random())
      if (!id) return -1
      for (const m of members) if (m.id === id) return m.slot
      return -1
    },
    slotOf(id) {
      for (const m of members) if (m.id === id) return m.slot
      return -1
    },
    credit(slot) {
      if (members[slot]?.id === 'heron') ctx.story.wing('kill', slot)
    },
    lights(add) {
      for (const m of members) {
        if (!m.alive || !m.model.root.visible) continue
        eachLight(m.model.lights, add)
      }
    },
    touch() { hudDirty = true },
    trim(slot) {
      const m = members[slot]
      return m ? WING_TRIMS[m.id][0] : '#ffd23f'
    },
  }
  return squad
}
