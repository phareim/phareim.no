/**
 * The encounter script in play: one `createEncounterRunner` per sector
 * (encounters.ts) turned into spawns, cues and set pieces. The attract
 * screen gets a quiet spawner of its own. `force` starts a set piece on
 * demand (the debug hook).
 */
import { firesMissiles, laneY, rivalHp } from '../balance'
import {
  OUTCOME_CUES, createEncounterRunner, ringGateLine, type EncounterEvent, type EncounterRunner, type SetPieceId, type SetPieceOutcome,
} from '../encounters'
import { ENTRY_PATHS } from '../balance'
import { loopOf, sectorIndex } from '../ids'
import { SPAWN_Z, rand, type Ctx } from './ctx'

export interface Encounters {
  readonly runner: EncounterRunner | null
  start(sector: number): void
  update(dt: number): void
  /** A set piece ended in the scene (Dingo saved, Cobra down, …). */
  resolve(id: SetPieceId, outcome: SetPieceOutcome): boolean
  /** Start a set piece now (debug). */
  force(id: string): boolean
  clear(): void
}

export function createEncounters(ctx: Ctx): Encounters {
  let runner: EncounterRunner | null = null
  let demoEnemyT = 2
  let demoObstacleT = 1
  let demoRingT = 3

  function handle(ev: EncounterEvent) {
    if (ev.story) ctx.story.cue(ev.story)
    switch (ev.type) {
      case 'formation': ctx.enemies.formation(ev.kinds, ev.path, ev.x, ev.y); break
      case 'enemy':
        if (ev.behind || ev.kind === 'dasher') ctx.enemies.hornet(ev.x < 0 ? -1 : 1, ev.y, !!ev.missiles, ev.x)
        else ctx.enemies.spawn(ev.kind, ev.x * ctx.laneX, laneY(ev.y), SPAWN_Z)
        break
      case 'carrier': ctx.enemies.carrier(ev.x, ev.y, ev.missiles); break
      case 'turrets': ctx.enemies.turrets(ev.xs); break
      case 'ringGate': ctx.pickups.ringGate(ev.xs, ev.ys, ev.spacing); break
      case 'goldRing': ctx.pickups.ring(ev.x, ev.y, true); break
      case 'ring': ctx.pickups.ring(ev.x, ev.y, false); break
      case 'capsule': ctx.pickups.capsule(ev.capsule, ev.x * ctx.laneX, laneY(ev.y)); break
      case 'obstacle': ctx.obstacles.spawn(ev.obstacle, ev.x); break
      case 'ambush': ctx.out.alert('▼ BEHIND ▼'); break
      case 'setPiece':
        if (ev.phase === 'end') {
          if (ev.id === 'dingoTrouble') ctx.sets.endDingo(ev.outcome ?? 'done')
          if (ev.id === 'rivalDuel') ctx.sets.endRival(ev.outcome ?? 'done')
        }
        break
      case 'dingoTrouble': ctx.sets.dingo(ev.chasers, ev.side); break
      case 'rival': ctx.sets.rival(ev.mode, ev.hp, ev.side); break
      case 'warning': ctx.run.warning(); break
    }
  }

  function demo(dt: number) {
    demoEnemyT -= dt
    if (demoEnemyT <= 0) {
      demoEnemyT = rand(3, 4.2)
      const path = ENTRY_PATHS[Math.floor(Math.random() * ENTRY_PATHS.length)]!
      ctx.enemies.formation(['drone', 'drone', 'drone'], path, rand(-0.6, 0.6), rand(0.5, 0.9))
    }
    demoObstacleT -= dt
    if (demoObstacleT <= 0) {
      demoObstacleT = rand(2, 3.2)
      ctx.obstacles.spawn(Math.random() < 0.6 ? 'pillar' : 'rock', Math.random() < 0.5 ? rand(-1, -0.45) : rand(0.45, 1))
    }
    demoRingT -= dt
    if (demoRingT <= 0) {
      demoRingT = rand(5, 8)
      ctx.pickups.ring(rand(-0.3, 0.3), ctx.portrait ? 0.28 : 0.42, false)
    }
  }

  return {
    get runner() { return runner },
    start(sector) {
      runner = createEncounterRunner(sectorIndex(sector), loopOf(sector), Math.random, {
        squad: () => ctx.squad.aliveIds,
        rivalGone: () => ctx.rivalGone,
      })
    },
    update(dt) {
      if (!ctx.started) { demo(dt); return }
      if (ctx.over || ctx.phase !== 'travel' || !runner) return
      const evs = runner.step(dt)
      for (let i = 0; i < evs.length; i++) handle(evs[i]!)
    },
    resolve(id, outcome) {
      if (runner?.resolve(id, outcome)) return true
      // Not the runner's (a forced set piece): say the ending ourselves.
      const cue = OUTCOME_CUES[id]?.[outcome]
      if (cue) ctx.story.cue(cue)
      return false
    },
    force(id) {
      const side: -1 | 1 = Math.random() < 0.5 ? -1 : 1
      const s = ctx.sector
      switch (id) {
        case 'rings': {
          const l = ringGateLine(7, Math.random)
          ctx.pickups.ringGate(l.xs, l.ys, 16)
          ctx.story.cue('set:rings')
          return true
        }
        case 'turrets': ctx.enemies.turrets([-0.8, -0.3, 0.3, 0.8]); ctx.story.cue('set:turrets'); return true
        case 'carrier': ctx.enemies.carrier(0, 0.62, firesMissiles(s)); ctx.story.cue('set:carrier'); return true
        case 'ambush':
          ctx.story.cue('warn:behind')
          ctx.out.alert('▼ BEHIND ▼')
          for (let i = 0; i < 3; i++) ctx.enemies.hornet(side, 0.35 + 0.12 * i, firesMissiles(s))
          return true
        case 'dingoTrouble': case 'dingo':
          ctx.story.cue('dingo:trouble')
          ctx.sets.dingo(3, side)
          return true
        case 'cobra': case 'flyby':
          ctx.story.cue('cobra:flyby')
          ctx.sets.rival('flyby', 1, side)
          return true
        case 'rivalDuel': case 'duel':
          ctx.story.cue('cobra:arrive')
          ctx.sets.rival('duel', rivalHp(s, false), side)
          return true
        case 'final':
          ctx.story.cue('cobra:duel')
          ctx.sets.rival('final', rivalHp(s, true), side)
          return true
      }
      return false
    },
    clear() {
      runner = null
      demoEnemyT = 2
    },
  }
}
