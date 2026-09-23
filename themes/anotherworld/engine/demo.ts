import type { Input, World } from '../types'
import { tidePhase } from './actors'
import { BODY_H, HALF_W } from './util'
import { NONE } from './game'

// The attract loop: chapter I on autopilot behind the title, with the same
// physics the player gets. It swims up out of the pool before the
// tentacles wake, kicks the leeches, runs under the overhang, waits for the
// tide, and walks off the right edge. It never dies (the node tests check).

const lastAction = new WeakMap<World, boolean>()

function shouldWait(world: World, front: number): boolean {
  for (const hz of world.hazards) {
    if (hz.kind !== 'tide') continue
    if (front >= hz.x) continue
    if (hz.x - front > 220) continue
    const u = tidePhase(hz, world.time)
    // The crossing takes ~1.6 s; start just after the retreat.
    if (!(u >= 0.88 || u < 0.05)) return true
  }
  return false
}

export function demoInput(world: World): Input {
  const p = world.player
  if (world.dying || world.exit || p.mantle || p.landT > 0) return NONE

  if (p.swimming) {
    const w = world.water[0]
    const near = w ? p.y < w.y + 60 : true
    return { ...NONE, up: Math.floor(world.time * 3) % 2 === 0, right: near }
  }
  if (!p.grounded && p.vy < -50) return { ...NONE, right: true, up: true }

  const front = p.x + HALF_W

  // A leech ahead on this floor: stop short and kick it.
  for (const a of world.actors) {
    if (a.kind !== 'leech' || a.state === 'dead' || a.state === 'hang' || a.state === 'drop') continue
    const d = a.x - p.x
    if (d > 0 && d < 74 && Math.abs(a.y - p.y) < 4 && p.grounded) {
      const prev = lastAction.get(world) ?? false
      const kick = d < 44 && p.kickT <= 0 && !prev
      lastAction.set(world, kick)
      return { ...NONE, action: kick }
    }
  }
  lastAction.set(world, false)

  if (p.grounded && shouldWait(world, front)) return NONE
  let jump = false
  let edge: number | null = null
  for (const pl of world.platforms) {
    if (Math.abs(pl.y - p.y) <= 3 && p.x + HALF_W > pl.x && p.x - HALF_W < pl.x + pl.w) {
      const e = pl.x + pl.w
      edge = edge === null ? e : Math.max(edge, e)
    }
  }
  const lead = 20 + Math.max(0, p.vx) * 0.12
  if (edge !== null) {
    if (edge - front < lead && edge < world.width - 5) jump = true
  } else if (p.grounded) {
    jump = true
  }
  if (!jump) {
    for (const pl of world.platforms) {
      const gap = pl.x - front
      if (gap >= 0 && gap < 70 && pl.y < p.y - 6 && pl.y + pl.h > p.y - BODY_H + 6) {
        jump = true
        break
      }
    }
  }
  return { ...NONE, right: true, up: jump }
}
