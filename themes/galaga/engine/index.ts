/**
 * Rex & Nova: Space Voyagers I, the engine. A pure simulation: no DOM, no
 * canvas, no clock but its own (a tick is 1/60 s) and no chance but its own
 * seeded Rng, so the same seed and the same inputs give the same run, tick
 * for tick. README.md beside this file is the guide.
 *
 *   const w = createWorld({ seed, height, pilot })
 *   step(w, input)            // once a tick
 *   for (const e of w.events) // what happened this tick
 */
import { stepBoss } from './bosses.ts'
import { stepScoreTimers } from './combat.ts'
import { stepEnemies } from './enemies.ts'
import { stepEncounter } from './encounters.ts'
import { stepFlow } from './flow.ts'
import { stepDuo, stepPass, stepWing } from './friends.ts'
import { stepPickups } from './pickups.ts'
import { stepPartner, stepPlayer } from './player.ts'
import { stepBolts, stepShots } from './shots.ts'
import type { Input, World } from './types.ts'
import { stepFormation, stepWaveDirector } from './waves.ts'

export { createWorld, POOL, playerTop } from './world.ts'
export type { WorldOptions } from './world.ts'
export { voyageProgress } from './flow.ts'
export type * from './types.ts'

export function makeInput(): Input {
  return { dx: 0, dy: 0, hasTarget: false, tx: 0, ty: 0, fire: false, duet: false }
}

/** Advance the world one tick. After GAME OVER it does nothing. */
export function step(w: World, input: Input): void {
  w.events.length = 0
  if (w.over) return
  w.tick++
  stepFlow(w)
  if (w.over) return
  stepFormation(w)
  stepWaveDirector(w)
  stepPlayer(w, input)
  stepPartner(w)
  stepWing(w)
  stepEnemies(w)
  stepBoss(w)
  stepEncounter(w)
  stepDuo(w)
  stepPass(w)
  stepShots(w)
  stepBolts(w)
  stepPickups(w)
  stepScoreTimers(w)
}

/** A 32-bit hash of everything that matters in the world: two runs that agree on it agree. */
export function hashWorld(w: World): number {
  let h = 0x811C9DC5
  const add = (v: number): void => {
    h ^= Math.round(v * 1000) | 0
    h = Math.imul(h, 0x01000193)
  }
  add(w.tick); add(w.score); add(w.rng.s); add(w.talkRng.s); add(w.sector); add(w.voyage); add(w.wave)
  add(w.stageT); add(w.chain); add(w.duet); add(w.duetMeter); add(w.slow); add(w.friends.length)
  const p = w.player
  add(p.x); add(p.y); add(p.hull); add(p.level); add(p.invuln); add(p.bubble); add(p.tows); add(p.fireT)
  const q = w.partner
  add(q.x); add(q.y); add(q.hits); add(q.t); add(q.dock)
  add(w.wing.x); add(w.wing.y); add(w.wing.bar); add(w.convoy.cargo)
  const b = w.boss
  if (b.active) { add(b.x); add(b.y); add(b.hp); add(b.phase); add(b.stepT) }
  for (const e of w.enemies) if (e.active) { add(e.id); add(e.x); add(e.y); add(e.hp); add(e.t) }
  for (const s of w.shots) if (s.active) { add(s.x); add(s.y) }
  for (const s of w.bolts) if (s.active) { add(s.x); add(s.y) }
  for (const z of w.zones) if (z.active) { add(z.x); add(z.y); add(z.warn); add(z.live) }
  for (const k of w.pickups) if (k.active) { add(k.x); add(k.y) }
  for (const r of w.rigs) if (r.active) { add(r.x); add(r.y) }
  return h >>> 0
}
