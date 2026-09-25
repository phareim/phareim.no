/**
 * `?theme=starfox&debug=starfox` puts levers on `window.__starfox` for
 * screenshots and checks (only with that query parameter):
 *   sector(n)   jump to absolute sector n (starts a run if needed; sets the biome)
 *   boss()      skip to the boss fight of this sector; boss(true) finishes it
 *   give(type)  a capsule effect now: laser bomb shield wing overdrive, or gold / ring
 *   spawn(kind) one enemy of any kind a little ahead (formation for drone)
 *   setPiece(id) rings turrets carrier ambush dingo flyby duel final
 *   god(on)     no damage to the player;  hold(on)  the wingmen hold fire
 *   state()     phase, sector, hull, arsenal, squad, counts, fps and frame ms
 */
import { ENEMY_KINDS, laneY, type EnemyKind } from '../balance'
import { CAPSULE_TYPES, type CapsuleType } from '../arsenal'
import { SPAWN_Z, live, type Ctx } from './ctx'

export interface FrameStats {
  fps: number; frameMs: number; workMs: number
  /** split of workMs: scene update, three.js + palette pass, the 2D stage */
  updateMs: number; renderMs: number; stageMs: number
  /** the part of stageMs spent waiting for the GL frame (drawImage of the WebGL canvas) */
  readMs: number
  calls: number; tris: number; lights: number
}

export function installDebug(ctx: Ctx, stats: FrameStats): () => void {
  const api = {
    /** The scene context, for profiling in the console. */
    ctx,
    sector(n: number) { ctx.run.jump(n); return api.state() },
    boss(finish = false) {
      if (finish) { ctx.boss.finish(); return 'finish' }
      if (!live(ctx)) ctx.run.start()
      ctx.enemies.clear()
      ctx.phase = 'warning'
      ctx.phaseT = 99
      return 'boss'
    },
    give(type: string) {
      if (!live(ctx)) return 'no run'
      if ((CAPSULE_TYPES as readonly string[]).includes(type)) {
        ctx.pickups.capsule(type as CapsuleType, ctx.player.x, ctx.player.y, -6)
        return type
      }
      if (type === 'gold' || type === 'ring') {
        ctx.pickups.ring(ctx.player.x / ctx.laneX, (ctx.player.y + 1.5) / 7.5, type === 'gold', -8)
        return type
      }
      return `unknown: ${CAPSULE_TYPES.join(' ')} gold ring`
    },
    spawn(kind: string) {
      const k = kind as EnemyKind
      if (!(ENEMY_KINDS as readonly string[]).includes(k)) return `unknown: ${ENEMY_KINDS.join(' ')}`
      if (k === 'drone') ctx.enemies.formation(['drone', 'drone', 'drone', 'drone'], 'sweepLeft', 0, 0.55)
      else if (k === 'dasher') ctx.enemies.hornet(1, 0.45, false)
      else if (k === 'carrier') ctx.enemies.carrier(0, 0.62, false)
      else if (k === 'turret') ctx.enemies.turrets([-0.4, 0.4])
      else if (k === 'missile') ctx.enemies.missile(ctx.player.x + 4, ctx.player.y + 2, -70, -1)
      else if (k === 'rival') ctx.enc.force('duel')
      else ctx.enemies.spawn(k, ctx.player.x * 0.5, laneY(0.55), SPAWN_Z * 0.55)
      return k
    },
    setPiece(id: string) { return ctx.enc.force(id) },
    god(on = true) { ctx.god = !!on; return ctx.god },
    hold(on = true) { ctx.holdWings = !!on; return ctx.holdWings },
    state() {
      const sq = ctx.squad.members.map(m => ({ id: m.id, hp: Math.ceil(m.hp), alive: m.alive, trouble: m.trouble, x: +m.x.toFixed(1), y: +m.y.toFixed(1), z: +m.z.toFixed(1) }))
      const rival = ctx.enemies.list.find(e => e.active && e.kind === 'rival')
      const kinds: Record<string, number> = {}
      for (const e of ctx.enemies.list) if (e.active) kinds[e.kind + (e.role === 1 ? '*' : '')] = (kinds[e.kind + (e.role === 1 ? '*' : '')] ?? 0) + 1
      return {
        started: ctx.started, over: ctx.over, phase: ctx.phase, phaseT: +ctx.phaseT.toFixed(2), sector: ctx.sector,
        biome: ctx.env.biome, t: ctx.enc.runner ? +ctx.enc.runner.t.toFixed(1) : 0, setPiece: ctx.enc.runner?.setPiece ?? null,
        hp: ctx.hp, score: ctx.score, bombs: ctx.arsenal.bombs, laser: ctx.arsenal.laser, shield: ctx.arsenal.shieldHp,
        overdrive: +ctx.arsenal.overdriveT.toFixed(1), wingOd: +ctx.arsenal.wingOdT.toFixed(1), charge: ctx.player.charge, lock: ctx.player.lockId,
        squad: sq, enemies: ctx.enemies.count, kinds, rival: rival ? { x: +rival.x.toFixed(1), y: +rival.y.toFixed(1), z: +rival.z.toFixed(1), hp: rival.hp } : null, bolts: ctx.shots.bolts, lasers: ctx.shots.lasers, pickups: ctx.pickups.count,
        mines: ctx.obstacles.mines, boss: ctx.boss.active, speed: +ctx.worldSpeed.toFixed(1), warp: +ctx.env.warp.toFixed(2),
        line: ctx.story.director.spoken?.text ?? null,
        fps: +stats.fps.toFixed(1), frameMs: +stats.frameMs.toFixed(1), workMs: +stats.workMs.toFixed(1),
        updateMs: +stats.updateMs.toFixed(1), renderMs: +stats.renderMs.toFixed(1), stageMs: +stats.stageMs.toFixed(1), readMs: +stats.readMs.toFixed(1), calls: stats.calls, tris: stats.tris, lights: stats.lights,
      }
    },
  }
  ;(window as unknown as { __starfox?: unknown }).__starfox = api
  return () => { delete (window as unknown as { __starfox?: unknown }).__starfox }
}
