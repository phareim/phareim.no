/**
 * THE CROWN in play (sector 5, THE HOLLOW CROWN): the mothership sinks
 * into view above the sky. Phase 1: a ring of six turrets fires staggered
 * volleys and slow spirals with a gap, and launches hornets that come in
 * from behind; the turrets flash on the stage before a volley. Phase 2
 * (every turret down): the eye opens — the eye beam charges along a dotted
 * line, then sweeps across the lanes slower than the ship
 * (`crownBeamLane`), plus fans and missiles. Phase 3 (the eye gone): it
 * turns and runs (`CROWN_CHASE`), the corridor speeds up, and you chase it
 * through its own debris and rear mines to shoot the heart between its
 * engines. MEGA COBRA's final duel comes before all this (encounters.ts
 * holds WARNING until the duel is decided).
 */
import * as THREE from 'three'
import {
  CROWN_CHASE, crownBeamFromLeft, crownBeamLane, crownRearMineLanes, laneFloat, laneX,
} from '../../bosses'
import { DMG, LANES, laneY, loopTempo } from '../../balance'
import { createCrown } from '../../models/bosses'
import { P } from '../../models/core'
import { LANE_Y_HI, LANE_Y_LO, rand, type Ctx } from '../ctx'
import type { BossBrain, BossRt } from './types'
import { activeT, approach, dueShots, fan, param, smooth } from './util'

const BASE_Y = 2
const MINE_HEIGHTS = [0.12, 0.5, 0.88] as const

export function createCrownBrain(ctx: Ctx): BossBrain {
  const model = createCrown()
  const v = new THREE.Vector3()
  const aim = { x: 0, y: 0, z: 0 }
  const q = { x: 0, y: 0, r: 0 }
  let shots = 0
  let eyeU = 0
  let eyeTo = 0
  let chase = false
  let turn = 0
  let beamFromLeft = true
  let beamOn = false
  let spiralGap = 0
  let mineStep = 0
  let debrisT = 0
  let shed = 0
  let sway = 0

  function part(rt: BossRt, id: string) {
    for (const p of rt.parts) if (p.model.id === id) return p
    return null
  }

  function eyePos(rt: BossRt) {
    const e = part(rt, 'eye')
    if (e) return v.set(e.wx, e.wy, e.wz + 1)
    return v.set(rt.x, rt.y, rt.z + 3 * rt.k)
  }

  function heartPos(rt: BossRt) {
    const h = part(rt, 'heart')
    if (h) return v.set(h.wx, h.wy, h.wz + 1)
    return v.set(rt.x, rt.y, rt.z + 6 * rt.k)
  }

  /** A hull chunk from near (x, y, z) that reaches the ship's plane in a lane. */
  function chunkAt(rt: BossRt, x: number, y: number, z: number, size: number) {
    const lane = Math.floor(Math.random() * LANES)
    const tx = laneX(lane, ctx.laneX) + rand(-0.8, 0.8)
    const ty = laneY(rand(0.1, 0.9))
    const vz = 8
    const T = Math.max(1.5, -z / (vz + ctx.worldSpeed))
    rt.hazards.chunk(x, y, z, (tx - x) / T, (ty - y) / T, vz, size)
  }

  function shedPlate(rt: BossRt) {
    if (shed >= 4) return
    const id = `hull-${shed++}`
    const mp = model.part(id)
    if (!mp || !mp.alive) return
    model.partWorld(mp, v)
    model.setPartDestroyed(id)
    ctx.fx.explode(v.x, v.y, v.z, P.purple, 1.6)
    chunkAt(rt, v.x, v.y, v.z, 1.8 * Math.max(0.7, rt.k))
  }

  const brain: BossBrain = {
    model,
    enter(rt) {
      rt.y = BASE_Y + 22
      shots = 0
      eyeU = 0
      eyeTo = 0
      chase = false
      turn = 0
      beamOn = false
      mineStep = 0
      debrisT = 0
      shed = 0
      sway = 0
      model.phase(1)
      model.eye(0)
    },
    move(rt, dt) {
      if (!rt.arrived) rt.y = BASE_Y + 22 * (1 - smooth(rt.entry * 1.15))
      else rt.y = approach(rt.y, BASE_Y + Math.sin(rt.t * 0.6) * 0.6, 2, dt)
      sway = approach(sway, (chase ? Math.sin(rt.t * 0.9) * 0.45 : Math.sin(rt.t * 0.35) * 0.2) * ctx.laneX, 1, dt)
      rt.x = sway
      eyeU = approach(eyeU, eyeTo, 2.5, dt)
      if (part(rt, 'eye')?.alive) model.eye(eyeU)
      if (chase) {
        turn = Math.min(1, turn + dt / 1.4)
        const u = smooth(turn)
        model.root.rotation.y = Math.PI * u
        model.root.rotation.z = Math.sin(rt.t * 2.3) * 0.05 * u
        rt.z = approach(rt.z, CROWN_CHASE.fleeZ, 0.8, dt)
        rt.speedMul = 1 + (CROWN_CHASE.speedMul - 1) * u
        if (u >= 1 && rt.arrived) {
          debrisT -= dt
          if (debrisT <= 0) {
            debrisT = CROWN_CHASE.debrisEvery / loopTempo(rt.sector)
            chunkAt(rt, rt.x + rand(-7, 7) * rt.k, rt.y + rand(-5, 5) * rt.k, rt.z + 4, rand(0.8, 1.3) * Math.max(0.7, rt.k))
          }
          // engine wash toward the ship: it is running
          for (let i = -1; i <= 1; i++) ctx.fx.sparks(rt.x + i * 2.6 * rt.k, rt.y, rt.z + 6 * rt.k, i === 0 ? P.pink : P.hot, 1, 6)
        }
      }
    },
    stage(rt, atk, st) {
      if (st === 'begin') shots = 0
      switch (atk.id) {
        case 'spiral':
          if (st === 'begin') spiralGap = Math.floor(Math.random() * param(atk, 'bolts', 16))
          break
        case 'launch':
          if (st === 'active') {
            ctx.out.alert('▼ BEHIND ▼')
            for (const s of [-1, 1]) ctx.enemies.hornet(s, 0.45, false)
            ctx.fx.sparks(rt.x, rt.y - 4 * rt.k, rt.z + 3, P.red, 20, 9)
          }
          break
        case 'beam':
          if (st === 'begin') {
            beamFromLeft = crownBeamFromLeft(laneFloat(ctx.player.x, ctx.laneX))
            eyeTo = 1
          } else if (st === 'active') beamOn = true
          else { beamOn = false; rt.hazards.beam(false) }
          break
        case 'eyeFan':
          if (st === 'active') {
            const e = eyePos(rt)
            const dy = (ctx.player.y - e.y) / Math.max(10, Math.abs(e.z))
            fan(ctx, e.x, e.y, e.z, param(atk, 'fan', 9), param(atk, 'spread', 1.0), 0.95, DMG.bossSpread, 0, dy)
            ctx.fx.sparks(e.x, e.y, e.z, P.hot, 20, 10)
          }
          break
        case 'missiles':
          if (st === 'active') {
            const n = param(atk, 'count', 3)
            for (let i = 0; i < n; i++) {
              const s = i % 2 ? 1 : -1
              const slot = i === 0 ? -1 : ctx.squad.aggro()
              ctx.enemies.missile(rt.x + s * 12 * rt.k, rt.y - 1, rt.z + 4, slot)
            }
          }
          break
        case 'debris':
          if (st === 'active') {
            shedPlate(rt)
            for (let i = 0; i < 2; i++) chunkAt(rt, rt.x + rand(-8, 8) * rt.k, rt.y + rand(-5, 5) * rt.k, rt.z + 4, rand(0.9, 1.4) * Math.max(0.7, rt.k))
          }
          break
        case 'rearMines':
          if (st === 'active') {
            const row = crownRearMineLanes(mineStep++, param(atk, 'mines', 4))
            const h = heartPos(rt)
            for (let l = 0; l < LANES; l++) {
              if (!row[l]) continue
              for (const y of MINE_HEIGHTS) rt.hazards.orb(h.x, h.y, h.z + 2, laneX(l, ctx.laneX), laneY(y), 1)
            }
            ctx.fx.sparks(h.x, h.y, h.z, P.red, 20, 9)
          }
          break
        default:
          break
      }
    },
    tick(rt, atk) {
      const st = rt.clock.stage
      if (atk.id === 'ringVolley' && st === 'active') {
        let n = 0
        for (const p of rt.parts) if (p.role === 'turret' && p.alive) n++
        const due = dueShots(activeT(rt), n, param(atk, 'stagger', 0.12))
        let k = 0
        for (const p of rt.parts) {
          if (p.role !== 'turret' || !p.alive) continue
          if (k++ < shots) continue
          if (shots >= due) break
          shots++
          rt.aim(aim)
          ctx.shots.bolt(p.wx, p.wy, p.wz + 1, aim.x, aim.y, aim.z, 1, DMG.bossBolt)
        }
      } else if (atk.id === 'spiral' && st === 'active') {
        const n = param(atk, 'bolts', 16)
        const gap = param(atk, 'gap', 3)
        const spin = param(atk, 'spin', 1.2)
        const due = dueShots(activeT(rt), n, rt.clock.timing.active / n)
        const e = eyePos(rt)
        while (shots < due) {
          const i = shots++
          if (((i - spiralGap + n) % n) < gap) continue
          const a = (i / n) * Math.PI * 2 + activeT(rt) * spin
          const r = 4.8 * rt.k
          ctx.shots.boltDir(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, e.z, Math.cos(a) * 0.12, Math.sin(a) * 0.09 + (ctx.player.y - e.y) / 80, 0.85, DMG.bossSpread)
        }
      } else if (atk.id === 'beam') {
        if (beamOn && st === 'active') {
          const e = eyePos(rt)
          rt.hazards.beam(true, e.x, e.y, e.z, crownBeamLane(activeT(rt), beamFromLeft))
        }
      } else if (atk.id === 'heartShot' && st === 'active') {
        const due = dueShots(activeT(rt), param(atk, 'bolts', 3), 0.18)
        while (shots < due) {
          shots++
          rt.aim(aim)
          const h = heartPos(rt)
          ctx.shots.bolt(h.x, h.y, h.z, aim.x, aim.y, aim.z, 1.05, DMG.bossBolt)
        }
      }
    },
    partDown(rt, p) {
      if (p.role === 'turret') ctx.fx.sparks(p.wx, p.wy, p.wz, P.red, 16, 9)
      if (p.role === 'eye') {
        beamOn = false
        rt.hazards.beam(false)
        ctx.fx.shock(p.wx, p.wy, p.wz, 16, 0.6)
      }
    },
    phase(rt, n) {
      if (n === 2) {
        model.phase(2)
        eyeTo = 1
      } else if (n >= 3) {
        model.phase(3)
        chase = true
        turn = 0
        debrisT = 1.5
        beamOn = false
        rt.hazards.beam(false)
      }
    },
    abort(rt) {
      beamOn = false
      rt.hazards.beam(false)
    },
    dying(rt, u, dt) {
      // it breaks apart: plates shear off, it tumbles away and down
      if (shed < 4 && u > 0.15 + shed * 0.15) {
        const id = `hull-${shed++}`
        const mp = model.part(id)
        if (mp && mp.alive) {
          model.partWorld(mp, v)
          model.setPartDestroyed(id)
          ctx.fx.explode(v.x, v.y, v.z, P.purple, 2)
        }
      }
      model.root.rotation.z += dt * 0.6 * u
      model.root.rotation.x += dt * 0.3 * u
      rt.y -= dt * 4 * u
      rt.z -= dt * 6 * u
      if (Math.random() < 0.7) ctx.fx.sparks(rt.x + rand(-9, 9) * rt.k, rt.y + rand(-7, 7) * rt.k, rt.z + 3, Math.random() < 0.5 ? P.gold : P.hot, 3, 8)
    },
    hud(rt, h) {
      const atk = rt.clock.attack
      if (!atk) return
      const st = rt.clock.stage
      if (atk.id === 'ringVolley' && st === 'telegraph') {
        for (const p of rt.parts) {
          if (p.role !== 'turret' || !p.alive) continue
          if (h.project(p.wx, p.wy, p.wz, p.wr, q)) h.corners(q.x, q.y, q.r + 1 + h.pulse, h.pulse ? P.red : P.white)
        }
      }
      if (atk.id === 'beam' && st === 'telegraph') {
        // the charge line: from the eye to where the beam starts
        const lane = crownBeamLane(0, beamFromLeft)
        const e = eyePos(rt)
        if (!h.project(e.x, e.y, e.z, 1, q)) return
        const ex = q.x, ey = q.y
        const bx = laneX(lane, ctx.laneX)
        const col = h.pulse ? P.hot : P.pink
        if (h.project(bx, (LANE_Y_LO + LANE_Y_HI) / 2, -4, 1, q)) h.dotted(ex, ey, q.x, q.y, col)
        const l = Math.round(lane)
        h.laneBox(l, l, -5, LANE_Y_LO - 0.5, LANE_Y_HI + 0.5, col)
      }
    },
  }
  return brain
}
