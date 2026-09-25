/**
 * THE FURNACE in play (sector 3, EMBER FIELDS): a three-legged walker
 * that strides in over the basalt. Stomps: a leg lifts, then slams, and a
 * wall of heat rolls along the ground toward the ship
 * (`furnaceStompSchedule`); the danger band below its crest is hatched at
 * the ship's plane — fly above it (`shockwaveHits`). Its knees glow: break
 * one and it drops to a kneel, the wheel stalls and the belly hatch opens
 * over the core (`furnaceCoreOpen`); with every knee gone it stays open.
 * It also fans fire from its grille and lobs lava at marked spots.
 * Phase 2: four stomps a salvo, and kamikazes out of the chimney.
 */
import * as THREE from 'three'
import {
  FURNACE_KNEEL, furnaceCoreOpen, furnaceStompSchedule, stunBossClock, type Stomp,
} from '../../bosses'
import { DMG } from '../../balance'
import { createFurnace } from '../../models/bosses'
import { P } from '../../models/core'
import { GROUND_Y, LANE_Y_LO, rand, type Ctx } from '../ctx'
import type { BossBrain, BossRt } from './types'
import { approach, clamp01, fan, param } from './util'

/** Root-space points on the model (scale and lift of the model applied). */
const FEET: [number, number][] = [[-11.3, 6.5], [11.3, 6.5], [0, -13]]
const GRILLE: [number, number, number] = [0, 8.2, 5.9]
const CHIMNEY: [number, number, number] = [0, 16.9, 0]
const LIFT_LEAD = 0.5

export function createFurnaceBrain(ctx: Ctx): BossBrain {
  const model = createFurnace()
  const v = new THREE.Vector3()
  const aim = { x: 0, y: 0, z: 0 }
  const q = { x: 0, y: 0, r: 0 }
  let stomps: Stomp[] = []
  let fired = 0
  const legLift = [0, 0, 0]
  let kneelT = 0
  let kneelDrop = 0
  let hatch = 0
  let waveUntil = 0
  let waveTop = 0
  let walkPh = 0
  let sway = 0

  function point(rt: BossRt, p: readonly [number, number, number]) {
    return v.set(rt.x + p[0] * rt.k, rt.y + p[1] * rt.k, rt.z + p[2] * rt.k)
  }

  function kneesAlive(rt: BossRt): boolean[] {
    const out = [true, true, true]
    for (const p of rt.parts) if (p.role === 'knee') out[Number(p.model.id.charAt(5))] = p.alive
    return out
  }

  function baseY(rt: BossRt) {
    return GROUND_Y + 5 * rt.k
  }

  const brain: BossBrain = {
    model,
    enter(rt) {
      rt.y = baseY(rt)
      stomps = []
      fired = 0
      legLift.fill(0)
      kneelT = 0
      kneelDrop = 0
      hatch = 0
      waveUntil = 0
      walkPh = 0
      sway = 0
    },
    move(rt, dt) {
      // walks in, then shuffles side to side
      const walking = !rt.arrived
      if (walking) walkPh += dt * 3.2
      const swayTo = Math.sin(rt.t * 0.32) * ctx.laneX * 0.22
      const dx = swayTo - sway
      sway = approach(sway, swayTo, 1, dt)
      if (rt.arrived && Math.abs(dx) > 0.05) walkPh += dt * 1.2
      rt.x = sway
      if (kneelT > 0) kneelT = Math.max(0, kneelT - dt)
      kneelDrop = approach(kneelDrop, kneelT > 0 ? 1 : 0, 4, dt)
      rt.y = baseY(rt) - 1.3 * rt.k * kneelDrop + (walking ? Math.abs(Math.sin(walkPh)) * 0.3 : 0)
      if (walking && Math.sin(walkPh) * Math.sin(walkPh - dt * 3.2) < 0) {
        ctx.shake = Math.max(ctx.shake, 0.25)
        ctx.fx.sparks(rt.x + rand(-10, 10) * rt.k, GROUND_Y + 0.2, rt.z + 6 * rt.k, P.orange, 10, 7)
      }
      model.legs(walkPh)
      for (let i = 0; i < 3; i++) if (legLift[i]! > 0) model.stomp(i, legLift[i]!)
      let alive = 0
      for (const p of rt.parts) if (p.role === 'knee' && p.alive) alive++
      hatch = approach(hatch, furnaceCoreOpen(alive, kneelT) ? 1 : 0, 5, dt)
      model.belly(hatch)
    },
    stage(rt, atk, st) {
      switch (atk.id) {
        case 'stomp':
          if (st === 'begin') {
            stomps = furnaceStompSchedule(rt.sector, rt.phase, kneesAlive(rt))
            fired = 0
            if (stomps.length) {
              const last = stomps[stomps.length - 1]!
              waveTop = last.top
              waveUntil = rt.t + rt.clock.timing.telegraph + last.at + Math.abs(rt.z) / last.speed + 0.3
            }
          }
          break
        case 'flame':
          if (st === 'active') {
            const g = point(rt, GRILLE)
            const dy = (ctx.player.y - g.y) / Math.max(10, Math.abs(g.z))
            fan(ctx, g.x, g.y, g.z, param(atk, 'fan', 7), param(atk, 'spread', 0.9), 0.9, DMG.bossSpread, 0, dy)
            ctx.fx.sparks(g.x, g.y, g.z, P.orange, 24, 10)
          }
          break
        case 'lavaLob':
          if (st === 'begin') {
            const c = point(rt, CHIMNEY)
            const n = param(atk, 'lobs', 3)
            const blast = param(atk, 'blast', 2.5)
            for (let i = 0; i < n; i++) {
              rt.aim(aim)
              const tx = Math.max(-ctx.laneX, Math.min(ctx.laneX, aim.x + (i === 0 ? 0 : rand(-2.5, 2.5))))
              const ty = Math.max(LANE_Y_LO, aim.y + rand(-1, 1))
              rt.hazards.lob(c.x, c.y, c.z, tx, ty, 0, rt.clock.timing.telegraph + i * 0.15, rt.clock.timing.active, blast)
            }
          }
          if (st === 'active') {
            const c = point(rt, CHIMNEY)
            ctx.fx.sparks(c.x, c.y, c.z, P.orange, 30, 12)
            ctx.shake = Math.max(ctx.shake, 0.3)
          }
          break
        case 'vent':
          if (st === 'active') {
            const c = point(rt, CHIMNEY)
            for (const s of [-1, 1]) ctx.enemies.spawn('kamikaze', c.x + s * 3, c.y - 4, c.z + 4)
            ctx.fx.sparks(c.x, c.y, c.z, P.hot, 20, 10)
          }
          break
        default:
          break
      }
    },
    tick(rt, atk) {
      if (atk.id !== 'stomp' || !stomps.length) return
      const tA = rt.clock.atkT - rt.clock.timing.telegraph
      // each leg lifts toward its next stomp, then slams
      legLift[0] = 0; legLift[1] = 0; legLift[2] = 0
      for (let i = fired; i < stomps.length; i++) {
        const s = stomps[i]!
        if (legLift[s.leg]! > 0) continue
        legLift[s.leg] = Math.max(0.001, clamp01((tA - (s.at - LIFT_LEAD)) / (LIFT_LEAD * 0.8)))
      }
      while (fired < stomps.length && tA >= stomps[fired]!.at) {
        const s = stomps[fired++]!
        legLift[s.leg] = 0
        model.stomp(s.leg, 0)
        const f = FEET[s.leg]!
        const fx = rt.x + f[0] * rt.k * 1.0
        const fz = rt.z + f[1] * rt.k
        rt.hazards.wave(fz, s.speed, s.top)
        ctx.fx.sparks(fx, GROUND_Y + 0.3, fz, P.orange, 26, 12)
        ctx.fx.sparks(fx, GROUND_Y + 0.3, fz, P.gold, 14, 8)
        ctx.fx.flashLight(fx, GROUND_Y + 1, fz, 8, P.orange, 0.4)
        ctx.shake = Math.max(ctx.shake, 0.55)
        ctx.sfx.boom(true)
      }
    },
    partDown(rt, part) {
      if (part.role !== 'knee') return
      // it drops to a kneel: the wheel stalls and the belly opens
      kneelT = FURNACE_KNEEL.open
      stunBossClock(rt.clock, FURNACE_KNEEL.stun)
      brain.abort(rt)
      ctx.fx.sparks(part.wx, part.wy, part.wz, P.orange, 40, 14)
      ctx.shake = Math.max(ctx.shake, 0.9)
    },
    phase() { /* four stomps a salvo, vents in the wheel */ },
    abort() {
      stomps = []
      fired = 0
      for (let i = 0; i < 3; i++) { legLift[i] = 0; model.stomp(i, 0) }
    },
    dying(rt, u, dt) {
      // the legs give, the kiln crashes to the ground and tips forward
      for (let i = 0; i < 3; i++) model.stomp(i, Math.min(1, u * 1.6))
      model.belly(1)
      rt.y = approach(rt.y, GROUND_Y - 2 * rt.k, 1.5 * u, dt)
      model.root.rotation.x = 0.45 * u * u
      model.root.rotation.z = 0.15 * Math.sin(u * 7) * u
      if (Math.random() < 0.6) ctx.fx.sparks(rt.x + rand(-6, 6) * rt.k, rt.y + rand(4, 12) * rt.k, rt.z + 2, P.orange, 3, 6)
    },
    hud(rt, h) {
      const stomping = rt.clock.attack?.id === 'stomp' && rt.clock.stage !== 'recover'
      if (!stomping && rt.t > waveUntil) return
      // the band a wave sweeps at the ship's plane: stay above its crest
      const col = h.pulse ? P.orange : P.gold
      h.laneBox(0, 4, -6, LANE_Y_LO - 0.8, waveTop, col)
      if (h.project(0, waveTop + 1.6, -6, 1, q)) h.text('UP', q.x, q.y - 4, col)
    },
  }
  return brain
}
