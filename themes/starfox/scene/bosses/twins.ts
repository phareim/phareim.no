/**
 * THE TWINS in play (sector 4, MIRROR LAKE): two mirrored ships fly in
 * from either side and circle each other over the water. Only the twin
 * with the lit core can be hurt; the light moves on a beat (`twinsLit`,
 * `twinsBeat`), and before each swap the lit core blinks while the
 * other twin is bracketed on the stage. They fire crossing walls of
 * light with one open lane each (`twinsCrossGaps`, `twinsWallGap`: the
 * next gap is always reachable), aimed bursts and mirrored fans, and in
 * phase 1 they trade sides. Kill both; the survivor is faster alone.
 */
import * as THREE from 'three'
import { twinsBeat, twinsCrossGaps, twinsLit, twinsWallGap } from '../../bosses'
import { DMG } from '../../balance'
import { createTwins } from '../../models/bosses'
import { P } from '../../models/core'
import { GROUND_Y, type Ctx } from '../ctx'
import type { BossBrain, BossRt } from './types'
import { activeT, approach, dueShots, fan, param, smooth } from './util'

const WALL_SPEED = 34
const SEP = 7
const COLORS = [P.cyan, P.hot] as const

export function createTwinsBrain(ctx: Ctx): BossBrain {
  const model = createTwins()
  const v = new THREE.Vector3()
  const aim = { x: 0, y: 0, z: 0 }
  const q = { x: 0, y: 0, r: 0 }
  const alive: [boolean, boolean] = [true, true]
  let litT = 0
  let lit: 0 | 1 = 0
  let warn = false
  let side = 1
  let swapU = -1
  let sep = SEP
  let gaps: number[] = []
  let walls = 0
  let shots = 0
  let crossStep = 0
  let spin = 0
  let fallY = 0

  function shipPos(rt: BossRt, i: number) {
    return rt.world(model.ships[i]!, 0, 0, 4.4, v)
  }

  function place(rt: BossRt, dt: number) {
    const k = Math.max(0.01, rt.k)
    const t = rt.t
    const lone = !alive[0] || !alive[1]
    for (let i = 0; i < 2; i++) {
      const s = model.ships[i]!
      if (!alive[i]) continue
      const sign = (i === 0 ? -1 : 1) * side
      let x: number, y: number, z: number
      if (lone) {
        // alone: a fast figure-eight across the whole corridor
        x = Math.sin(t * 1.25) * (ctx.laneX * 0.55) / k
        y = 1.5 + Math.sin(t * 2.5) * 2.2
        z = Math.sin(t * 0.9) * 2
      } else {
        const wob = Math.sin(t * 1.1 + i * Math.PI)
        x = sign * sep
        y = 1.5 + wob * 1.6
        z = Math.cos(t * 0.8 + i) * 2
        if (swapU >= 0) {
          // trade sides: through the middle, one high, one low
          const u = smooth(swapU)
          x = sign * sep * (1 - 2 * u)
          y += (i === 0 ? 1 : -1) * Math.sin(u * Math.PI) * 3.5
        }
      }
      if (!rt.arrived) x += (i === 0 ? -1 : 1) * 26 * (1 - smooth(rt.entry))
      s.position.x = approach(s.position.x, x, rt.arrived ? 6 : 30, dt)
      s.position.y = approach(s.position.y, y, 5, dt)
      s.position.z = approach(s.position.z, z, 4, dt)
      const bank = (x - s.position.x) * 0.08
      s.rotation.z = (i === 1 ? Math.PI : 0) + bank + (swapU >= 0 ? Math.sin(smooth(swapU) * Math.PI) * 1.2 * (i === 0 ? 1 : -1) : 0)
    }
  }

  const brain: BossBrain = {
    model,
    enter(rt) {
      rt.y = 1.2
      alive[0] = true
      alive[1] = true
      litT = 0
      lit = 0
      warn = false
      side = 1
      swapU = -1
      sep = SEP
      crossStep = 0
      spin = 0
      fallY = 0
      model.lit(null)
    },
    move(rt, dt) {
      rt.x = 0
      rt.y = 1.2 + Math.sin(rt.t * 0.7) * 0.4
      sep = approach(sep, rt.clock.attack?.id === 'cross' && rt.clock.stage !== 'recover' ? 9.5 : SEP, 2, dt)
      if (swapU >= 0) {
        swapU += dt / Math.max(0.3, rt.clock.timing.active)
        if (swapU >= 1) { swapU = -1; side = -side }
      }
      place(rt, dt)
      if (rt.arrived) {
        litT += dt
        const l = twinsLit(litT, twinsBeat(rt.sector), alive)
        lit = l.lit
        warn = l.warn
        const blink = warn && Math.floor(rt.t * 10) % 2 === 0
        model.lit(blink ? null : lit)
      }
    },
    stage(rt, atk, st) {
      if (st === 'begin') shots = 0
      switch (atk.id) {
        case 'cross':
          if (st === 'begin') {
            gaps = twinsCrossGaps(crossStep++, param(atk, 'walls', 4))
            walls = 0
          }
          break
        case 'mirrorFan':
          if (st === 'active') {
            for (let i = 0; i < 2; i++) {
              if (!alive[i]) continue
              const p = shipPos(rt, i)
              const dy = (ctx.player.y - p.y) / Math.max(10, Math.abs(p.z))
              const skew = (i === 0 ? 0.22 : -0.22) * side
              fan(ctx, p.x, p.y, p.z, param(atk, 'fan', 5), param(atk, 'spread', 0.7), 0.95, DMG.bossSpread, skew, dy)
              ctx.fx.sparks(p.x, p.y, p.z, COLORS[i]!, 12, 8)
            }
          }
          break
        case 'swap':
          if (st === 'active' && alive[0] && alive[1]) swapU = 0
          break
        default:
          break
      }
    },
    tick(rt, atk) {
      if (atk.id === 'cross' && rt.clock.stage !== 'telegraph') {
        const gap = twinsWallGap(rt.sector)
        const t = activeT(rt) + (rt.clock.stage === 'recover' ? rt.clock.t : 0)
        while (walls < gaps.length && t >= walls * gap) {
          const from = alive[walls % 2] ? walls % 2 : 1 - (walls % 2)
          const p = shipPos(rt, from)
          rt.hazards.wall(p.z + 2, WALL_SPEED, gaps[walls]!, COLORS[from]!)
          ctx.fx.sparks(p.x, p.y, p.z, COLORS[from]!, 16, 9)
          walls++
        }
      }
      if (atk.id === 'aimed' && rt.clock.stage === 'active') {
        const lone = !alive[0] || !alive[1]
        const n = param(atk, 'bolts', 3) * (lone ? 2 : 1)
        const due = dueShots(activeT(rt), n, lone ? 0.09 : 0.16)
        while (shots < due) {
          shots++
          const from = alive[lit] ? lit : 1 - lit
          const p = shipPos(rt, from)
          rt.aim(aim)
          ctx.shots.bolt(p.x, p.y, p.z, aim.x, aim.y, aim.z, lone ? 1.1 : 1, DMG.bossBolt)
        }
      }
    },
    partDown(rt, part) {
      const i = part.model.id === 'core-a' ? 0 : 1
      alive[i] = false
      const s = model.ships[i]!
      v.set(0, 0, 0)
      s.localToWorld(v)
      ctx.fx.explode(v.x, v.y, v.z, COLORS[i]!, 3)
      ctx.fx.shock(v.x, v.y, v.z, 14, 0.6)
      ctx.fx.sparks(v.x, GROUND_Y + 0.2, v.z, P.white, 30, 12)
      ctx.flash = Math.max(ctx.flash, 0.5)
      ctx.flashColor = COLORS[i]!
      swapU = -1
    },
    phase() { /* one left: it never swaps, and it is faster */ },
    abort() {
      swapU = -1
      sep = SEP
    },
    dying(rt, u, dt) {
      // the last twin spins out and dives into the lake
      spin += dt * (4 + 16 * u)
      fallY += dt * (1 + 14 * u * u)
      for (let i = 0; i < 2; i++) {
        if (!model.ships[i]!.visible) continue
        const s = model.ships[i]!
        s.rotation.z = spin
        s.position.y -= fallY * dt * 2
        if (Math.random() < 0.5) {
          v.set(0, 0, 0)
          s.localToWorld(v)
          ctx.fx.sparks(v.x, v.y, v.z, COLORS[i]!, 3, 6)
        }
      }
    },
    hud(rt, h) {
      if (!warn || !alive[0] || !alive[1]) return
      // before the swap: bracket the twin that lights up next
      const next = 1 - lit
      const p = shipPos(rt, next)
      if (!h.project(p.x, p.y, p.z, 3 * rt.k, q)) return
      const col = h.pulse ? COLORS[next]! : P.white
      h.corners(q.x, q.y, q.r + 2 + h.pulse, col)
      h.text('NEXT', q.x, q.y - q.r - 11, col)
    },
  }
  return brain
}
