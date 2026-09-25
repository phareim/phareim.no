/**
 * THE MOTH in play (sector 2, WHISPER WOODS): it drifts down out of the
 * canopy and hangs in the night air, beating its wings. Four wing panels
 * shield the core; each shot off falls away tumbling, and with one gone
 * the core is open. It dusts bolts at the squad, drops rows of spore
 * mines with a gap (`mothSporeRow`), and its wing beats push the ship
 * sideways (`mothWingPush`, always slower than the ship can steer): the
 * wings rise and hold, arrows at the screen's edge show the push, then
 * the gust. Phase 2 (the panels gone): one gap per row, and weavers.
 */
import * as THREE from 'three'
import { laneX, mothSporeRow, mothWingPush } from '../../bosses'
import { DMG, LANES, laneY } from '../../balance'
import { createMoth } from '../../models/bosses'
import { P } from '../../models/core'
import { clamp, live, rand, type Ctx } from '../ctx'
import type { BossBrain, BossRt } from './types'
import { activeT, approach, dueShots, param, smooth, teleU } from './util'

const SPORE_HEIGHTS = [0.12, 0.5, 0.88] as const

export function createMothBrain(ctx: Ctx): BossBrain {
  const model = createMoth()
  const sac = new THREE.Vector3()
  const aim = { x: 0, y: 0, z: 0 }
  let beatPh = 0
  let beatRate = 4.5
  let sporeStep = 0
  let pushDir: 1 | -1 = 1
  let shots = 0
  let windup = 0
  let sway = 0
  let fallSpin = 0

  function sacPos(rt: BossRt, i: number) {
    const x = i === 0 ? -1.3 : i === 1 ? 1.3 : 0
    const y = i === 2 ? -5.0 : -3.6
    return rt.world(model.root, x * 1.2, y * 1.2, 0.8, sac)
  }

  const brain: BossBrain = {
    model,
    enter(rt) {
      rt.y = 3 + 16
      beatPh = 0
      beatRate = 4.5
      sporeStep = 0
      pushDir = Math.random() < 0.5 ? 1 : -1
      windup = 0
      sway = 0
      fallSpin = 0
    },
    move(rt, dt) {
      const baseY = 3 * Math.max(0.8, rt.k)
      if (!rt.arrived) rt.y = baseY + 16 * (1 - smooth(rt.entry * 1.2))
      else rt.y = approach(rt.y, baseY + Math.sin(rt.t * 0.9) * 0.8, 2, dt)
      sway = approach(sway, Math.sin(rt.t * 0.55) * ctx.laneX * 0.35, 1.2, dt)
      rt.x = sway
      // wing beat: steady flap, a slow wind-up hold before a gust, fast during it
      beatPh += dt * beatRate
      model.beat(windup > 0 ? -Math.PI / 2 * windup + beatPh * (1 - windup) : beatPh)
    },
    stage(rt, atk, st) {
      if (st === 'begin') shots = 0
      switch (atk.id) {
        case 'wingBeat':
          if (st === 'begin') pushDir = ctx.player.x > 0 ? 1 : -1
          if (st === 'active') { windup = 0; beatRate = 14 }
          if (st === 'recover') { beatRate = 4.5 }
          break
        case 'sporeMines':
          if (st === 'begin') beatRate = 2.5
          if (st === 'active') {
            beatRate = 4.5
            const row = mothSporeRow(sporeStep++, rt.phase)
            const from = sacPos(rt, 2)
            for (let l = 0; l < LANES; l++) {
              if (!row[l]) continue
              for (const hgt of SPORE_HEIGHTS) rt.hazards.orb(from.x, from.y, from.z + 2, laneX(l, ctx.laneX), laneY(hgt), 0)
            }
            ctx.fx.sparks(from.x, from.y, from.z, P.mint, 24, 9)
          }
          break
        case 'swarm':
          if (st === 'active') {
            for (const s of [-1, 1]) ctx.enemies.spawn('weaver', rt.x + s * 7 * rt.k, rt.y, rt.z + 6)
            ctx.fx.sparks(rt.x, rt.y, rt.z + 4, P.purple, 20, 9)
          }
          break
        default:
          break
      }
    },
    tick(rt, atk, dt) {
      if (atk.id === 'wingBeat') {
        if (rt.clock.stage === 'telegraph') {
          windup = smooth(teleU(rt))
          beatRate = 1
        } else if (rt.clock.stage === 'active' && live(ctx)) {
          const push = mothWingPush(activeT(rt), rt.clock.timing.active, rt.alive('panel'), pushDir)
          // the corridor is narrower on a phone: the gust shrinks with it
          const k = ctx.laneX / 11
          ctx.player.x = clamp(ctx.player.x + push * k * dt, -ctx.laneX, ctx.laneX)
          if (Math.random() < 0.7) {
            ctx.fx.sparks(ctx.player.x - pushDir * 6 * k, ctx.player.y + rand(-2, 3), rand(-12, -2), P.lavender, 1, 3)
          }
        } else windup = approach(windup, 0, 6, dt)
        return
      }
      if (atk.id === 'dust' && rt.clock.stage === 'active') {
        const due = dueShots(activeT(rt), param(atk, 'bolts', 4), 0.18)
        while (shots < due) {
          const from = sacPos(rt, shots % 2)
          shots++
          rt.aim(aim)
          ctx.shots.bolt(from.x, from.y, from.z, aim.x, aim.y, aim.z, 0.95, DMG.bossBolt)
        }
      }
    },
    partDown(rt, part) {
      if (part.role === 'panel') ctx.fx.sparks(part.wx, part.wy, part.wz, P.jade, 30, 12)
    },
    phase() { /* one gap per spore row, weavers in the wheel */ },
    abort() {
      windup = 0
      beatRate = 4.5
    },
    dying(rt, u, dt) {
      // it spirals down into the canopy, dropping what is left of its wings
      let i = 0
      for (const p of rt.parts) {
        if (p.role !== 'panel') continue
        if (p.alive && u > 0.2 + i * 0.12) { p.alive = false; model.dropPanel(i) }
        i++
      }
      fallSpin += dt * (1 + 5 * u)
      model.root.rotation.z = Math.sin(fallSpin) * 0.6 * u
      model.root.rotation.x = 0.4 * u
      rt.y -= (0.5 + 12 * u * u) * dt
      beatRate = 9 * (1 - u) + 1
      if (Math.random() < 0.5) ctx.fx.sparks(rt.x + rand(-4, 4) * rt.k, rt.y + rand(-3, 3) * rt.k, rt.z + 2, P.mint, 2, 5)
    },
    hud(rt, h) {
      const atk = rt.clock.attack
      if (!atk || atk.id !== 'wingBeat' || rt.clock.stage === 'recover') return
      // arrows on the side the gust comes from, pointing where it pushes
      const s = pushDir > 0 ? '>>>' : '<<<'
      const col = h.pulse ? P.lavender : P.white
      const W = h.g.canvas.width
      const Hh = h.g.canvas.height
      const x = pushDir > 0 ? W * 0.18 : W * 0.82
      h.text(s, x, Hh * 0.42, col)
      h.text(s, x, Hh * 0.52, col)
      if (rt.clock.stage === 'telegraph') h.text('GUST', x, Hh * 0.47, P.lavender)
    },
  }
  return brain
}
