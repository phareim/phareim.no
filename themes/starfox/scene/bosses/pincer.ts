/**
 * THE PINCER in play (sector 1, CORAL COAST): the crab carrier rises out
 * of the sea and skims the water. Its claws sweep lanes: the claw heats
 * pink and the lanes it will cover are hatched at the ship's plane, then
 * it lunges and the claws close across them (`pincerPattern` /
 * `pincerClawSweep` keep a lane open). The core in the maw only takes
 * damage while it roars. Breaking a claw stops that claw sweeping.
 * Phase 2: both claws sweep at once, and it broods drones.
 */
import * as THREE from 'three'
import {
  clawCovers, laneAt, pincerClawSweep, pincerPattern, type ClawPattern, type ClawSweep,
} from '../../bosses'
import { DMG, LANES } from '../../balance'
import { createPincer } from '../../models/bosses'
import { P } from '../../models/core'
import { GROUND_Y, LANE_Y_HI, LANE_Y_LO, live, rand, type Ctx } from '../ctx'
import type { BossBrain, BossRt } from './types'
import { activeT, approach, dueShots, fan, param, smooth, teleU } from './util'

/** How close the lunge brings it (root z) while the claws are out. */
const LUNGE_Z = -19

export function createPincerBrain(ctx: Ctx): BossBrain {
  const model = createPincer()
  const mouth = new THREE.Vector3()
  const aim = { x: 0, y: 0, z: 0 }
  const full: ClawPattern = { left: 1000, right: 1000 }
  const sweep: ClawSweep = { stage: 'telegraph', left: 0, right: 0 }
  const cont: ClawSweep = { stage: 'telegraph', left: 0, right: 0 }
  let pattern: ClawPattern = { left: 0, right: 0 }
  let sweepStep = 0
  let sweeping = false
  let clawHit = false
  let lunge = 0
  let maw = 0
  let mawTo = 0
  let shots = 0
  let sway = 0

  function baseY(rt: BossRt) {
    // the legs skim the water at y ≈ −5 at any scale
    return GROUND_Y + 5 * rt.k
  }

  function mouthPos(rt: BossRt) {
    const core = rt.parts.find(p => p.role === 'core')
    if (core) mouth.set(core.wx, core.wy, core.wz + 1)
    else mouth.set(rt.x, rt.y, rt.z + 6)
    return mouth
  }

  function clawsAlive(rt: BossRt): [boolean, boolean] {
    const l = rt.parts.find(p => p.model.id === 'claw-l')
    const r = rt.parts.find(p => p.model.id === 'claw-r')
    return [!!l?.alive, !!r?.alive]
  }

  function reach(n: number) {
    return Math.min(1, n / 3.2)
  }

  const brain: BossBrain = {
    model,
    enter(rt) {
      rt.y = baseY(rt) - 9
      sweeping = false
      lunge = 0
      maw = 0
      mawTo = 0
      sway = 0
      sweepStep = 0
    },
    move(rt, dt) {
      const by = baseY(rt)
      if (!rt.arrived) {
        rt.y = by - 9 * (1 - smooth(rt.entry * 1.4))
        if (Math.random() < 0.5) ctx.fx.sparks(rt.x + rand(-8, 8) * rt.k, GROUND_Y + 0.3, rt.z + rand(-2, 6), P.cyan, 2, 5)
      } else if (rt.y < by) rt.y = approach(rt.y, by, 3, dt)
      // sway, but centred while the claws are out (the lanes are the corridor's)
      const swayTo = sweeping ? 0 : Math.sin(rt.t * 0.45) * ctx.laneX * 0.28
      sway = approach(sway, swayTo, sweeping ? 4 : 1.5, dt)
      rt.x = sway
      rt.z = rt.arrived ? rt.parkZ + (LUNGE_Z - rt.parkZ) * smooth(lunge) : rt.z
      maw = approach(maw, mawTo, 7, dt)
      model.maw(maw)
    },
    stage(rt, atk, st) {
      if (atk.id === 'clawSweep') {
        if (st === 'begin') {
          pattern = pincerPattern(sweepStep++, rt.phase, clawsAlive(rt))
          sweeping = pattern.left + pattern.right > 0
          clawHit = false
        } else if (st === 'recover') {
          sweeping = false
        }
      } else if (atk.id === 'spit' || atk.id === 'roar' || atk.id === 'brood') {
        if (st === 'begin') shots = 0
        if (atk.id === 'roar') {
          if (st === 'begin') mawTo = 0.35
          else if (st === 'active') {
            mawTo = 1
            const m = mouthPos(rt)
            fan(ctx, m.x, m.y, m.z, param(atk, 'fan', 5), param(atk, 'spread', 0.8), 0.95, DMG.bossSpread)
            ctx.shake = Math.max(ctx.shake, 0.45)
            ctx.fx.sparks(m.x, m.y, m.z, P.hot, 16, 10)
          } else mawTo = 0
        }
        if (atk.id === 'spit') mawTo = st === 'recover' ? 0 : 0.3
        if (atk.id === 'brood' && st === 'active') {
          for (const s of [-1, 1]) ctx.enemies.spawn('drone', rt.x + s * 5 * rt.k, rt.y + 3 * rt.k, rt.z + 6)
          ctx.fx.sparks(rt.x, rt.y + 3 * rt.k, rt.z + 4, P.cyan, 18, 8)
        }
      }
    },
    tick(rt, atk, dt) {
      if (atk.id === 'clawSweep') {
        if (!sweeping) return
        const t = rt.clock.atkT
        pincerClawSweep(t, pattern, rt.sector, sweep)
        pincerClawSweep(t, full, rt.sector, cont)
        const f = cont.left / 1000
        const stg = cont.stage
        // tell: heat and a lunge wind-up; then the lunge follows the sweep
        const heat = stg === 'telegraph' ? teleU(rt) : stg === 'done' ? 0 : 1
        model.glow(-1, pattern.left > 0 ? heat : 0)
        model.glow(1, pattern.right > 0 ? heat : 0)
        model.claw(-1, reach(pattern.left) * f)
        model.claw(1, reach(pattern.right) * f)
        const snap = stg === 'hold' ? 0.5 + 0.5 * Math.sin(rt.t * 18) : stg === 'extend' ? 1 : 0
        model.pinch(-1, pattern.left > 0 ? snap : 0)
        model.pinch(1, pattern.right > 0 ? snap : 0)
        lunge = stg === 'telegraph' ? 0.25 * teleU(rt) : stg === 'done' ? approach(lunge, 0, 3, dt) : Math.max(lunge, Math.min(1, f * 1.4))
        if (stg === 'retract') lunge = f
        if (!clawHit && (stg === 'extend' || stg === 'hold') && live(ctx) && ctx.player.visible) {
          const lane = laneAt(ctx.player.x, ctx.laneX)
          if (clawCovers(sweep, lane)) {
            clawHit = true
            ctx.player.damage(DMG.claw)
            ctx.shake = Math.max(ctx.shake, 0.8)
          }
        }
        return
      }
      if (atk.id === 'spit' && rt.clock.stage === 'active') {
        const due = dueShots(activeT(rt), param(atk, 'bolts', 3), 0.16)
        while (shots < due) {
          shots++
          rt.aim(aim)
          const m = mouthPos(rt)
          ctx.shots.bolt(m.x, m.y, m.z, aim.x, aim.y, aim.z, 1, DMG.bossBolt)
        }
      }
      if (atk.id === 'roar' && rt.clock.stage === 'active' && rt.enraged) {
        // enraged, it spits while roaring
        const due = dueShots(activeT(rt), 3, 0.8)
        while (shots < due) {
          shots++
          rt.aim(aim)
          const m = mouthPos(rt)
          ctx.shots.bolt(m.x, m.y, m.z, aim.x, aim.y, aim.z, 0.9, DMG.bossBolt)
        }
      }
    },
    partDown(rt, part) {
      if (part.role === 'claw') {
        const side = part.model.id === 'claw-l' ? -1 : 1
        model.glow(side, 0)
        ctx.fx.sparks(part.wx, part.wy, part.wz, P.red, 30, 12)
        if (side < 0) pattern.left = 0
        else pattern.right = 0
      }
    },
    phase() { /* the wheel adds brood; both claws sweep (pincerPattern) */ },
    abort() {
      sweeping = false
      mawTo = 0
      lunge = 0
      for (const s of [-1, 1] as const) { model.glow(s, 0); model.claw(s, 0); model.pinch(s, 0) }
    },
    dying(rt, u, dt) {
      // it sinks, tilting, claws flailing
      rt.y -= (1 + 10 * u) * dt
      model.root.rotation.z = 0.35 * u
      model.root.rotation.x = -0.25 * u
      model.claw(-1, 0.5 + 0.5 * Math.sin(rt.t * 9))
      model.claw(1, 0.5 + 0.5 * Math.sin(rt.t * 8 + 1))
      mawTo = 1
      maw = approach(maw, 1, 5, dt)
      model.maw(maw)
      if (Math.random() < 0.6) ctx.fx.sparks(rt.x + rand(-9, 9) * rt.k, GROUND_Y + 0.2, rt.z + rand(-3, 6), P.cyan, 4, 8)
    },
    hud(rt, h) {
      const atk = rt.clock.attack
      if (!atk || atk.id !== 'clawSweep' || !sweeping) return
      const stg = cont.stage
      if (stg === 'done' || stg === 'retract') return
      const col = h.pulse ? P.hot : P.red
      const z = -7
      if (pattern.left > 0) h.laneBox(0, pattern.left - 1, z, LANE_Y_LO - 0.5, LANE_Y_HI + 0.5, col)
      if (pattern.right > 0) h.laneBox(LANES - pattern.right, LANES - 1, z, LANE_Y_LO - 0.5, LANE_Y_HI + 0.5, col)
    },
  }
  return brain
}
