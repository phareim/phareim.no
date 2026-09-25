/**
 * A run from launch to the last explosion: the sector loop (TRAVEL, driven
 * by the encounter script, → WARNING → BOSS → CLEAR → warp → next sector),
 * the scroll speed, the streak and distance, the arsenal's timers and HUD,
 * and the end (death, or the 3 s Escape hold) with its game-over summary.
 */
import {
  CLEAR_TIME, HEAL_CLEAR, HP_MAX, WARNING_TIME, heal, sectorClearBonus, worldSpeedFor,
} from '../balance'
import { createArsenal, newSector, shieldUp, tickArsenal } from '../arsenal'
import { biomeOf, sectorIndex } from '../ids'
import { callsignFrom, sectorFor, sectorVars, squadFor, survivorsText } from '../story'
import { readStoredPlayer } from '~/composables/useLeaderboard'
import { addScore, breakStreak, live, resetScoreSent, type ArsenalHud, type Ctx, type DeathSummary } from './ctx'

export interface Run {
  start(): void
  end(reason: 'death' | 'quit'): void
  update(dt: number): void
  /** The encounter script reached WARNING. */
  warning(): void
  /** The boss is dead: CLEAR, bonus, heal, then the warp. */
  bossDown(): void
  /** Debug: jump straight to an absolute sector. */
  jump(sector: number): void
  arsenalDirty(): void
  readonly deathEmitted: boolean
}

interface SoundLike {
  unlock(): void
  sfx: { uiStart(): void; explosion(big?: boolean): void; gameOver(): void }
  music: { start(id: string): void; stop(fade?: boolean): void }
}

const WARP_LEAD = 1.0

export function createRun(ctx: Ctx, sound: SoundLike): Run {
  const tick = { shieldDown: false, overdriveEnd: false, wingOdEnd: false }
  const hud: ArsenalHud = { laser: 0, bombs: 0, charge: 0, shield: 0, overdrive: 0, wingOd: 0 }
  let dirty = true
  let lastKm = 0
  let warped = false
  let deathAt = 0
  let deathEmitted = true
  let summary: DeathSummary | null = null

  function clearField() {
    ctx.enemies.clear()
    ctx.shots.clear()
    ctx.obstacles.clear()
    ctx.pickups.clear()
    ctx.fx.clear()
    ctx.sets.clear()
    ctx.boss.clear()
    ctx.enc.clear()
  }

  function enterSector(sector: number) {
    ctx.sector = sector
    ctx.phase = 'travel'
    ctx.phaseT = 0
    warped = false
    const biome = biomeOf(sector)
    ctx.env.setBiome(biome)
    ctx.obstacles.setBiome(biome)
    newSector(ctx.arsenal)
    ctx.enc.start(sector)
    const def = sectorFor(sector - 1)
    ctx.out.title(def.card)
    ctx.story.sector(sector - 1)
    ctx.out.sector(sector, 'travel')
    dirty = true
  }

  function emitArsenal() {
    const a = ctx.arsenal
    const charge = Math.round(ctx.player.charge * 8) / 8
    const shield = shieldUp(a) ? Math.ceil(a.shieldT) : 0
    const od = Math.ceil(a.overdriveT)
    const wod = Math.ceil(a.wingOdT)
    if (!dirty && hud.laser === a.laser && hud.bombs === a.bombs && hud.charge === charge && hud.shield === shield && hud.overdrive === od && hud.wingOd === wod) return
    dirty = false
    hud.laser = a.laser
    hud.bombs = a.bombs
    hud.charge = charge
    hud.shield = shield
    hud.overdrive = od
    hud.wingOd = wod
    ctx.out.arsenal(hud)
  }

  const run: Run = {
    get deathEmitted() { return deathEmitted },
    start() {
      if (ctx.over) ctx.out.restart()
      ctx.runs++
      clearField()
      resetScoreSent()
      ctx.started = true
      ctx.over = false
      ctx.score = 0
      breakStreak(ctx)
      ctx.hp = HP_MAX
      ctx.elapsed = 0
      ctx.distance = 0
      lastKm = 0
      ctx.arsenal = createArsenal()
      ctx.invulnUntil = ctx.now + 1.5
      ctx.shake = 0
      ctx.flash = 0
      deathEmitted = false
      summary = null
      const cs = callsignFrom(readStoredPlayer()?.name)
      ctx.squadIds = squadFor(cs)
      ctx.squad.setup(ctx.squadIds)
      ctx.player.reset()
      try {
        const v = parseInt(localStorage.getItem('starfoxHighScore') || '0', 10)
        ctx.bestBefore = Number.isNaN(v) ? 0 : v
      } catch { ctx.bestBefore = 0 }
      ctx.story.startRun(cs)
      sound.unlock()
      sound.sfx.uiStart()
      sound.music.start('starfox')
      ctx.out.started()
      ctx.out.score(0)
      ctx.out.distance(0)
      ctx.out.health(ctx.hp, HP_MAX)
      ctx.out.boss(0, 0, false, '')
      enterSector(1)
    },
    end(reason) {
      if (!live(ctx)) return
      const alive = ctx.squad.members.map(m => m.alive)
      ctx.over = true
      if (reason === 'quit') ctx.hp = 0
      ctx.out.health(0, HP_MAX)
      ctx.player.explode()
      ctx.sets.clear()
      ctx.boss.clear()
      ctx.story.death(alive)
      sound.sfx.explosion(true)
      sound.sfx.gameOver()
      sound.music.stop()
      ctx.out.over()
      const def = sectorFor(ctx.sector - 1)
      summary = {
        sector: ctx.sector, index: sectorIndex(ctx.sector), loop: def.loop, name: def.echo ? `${def.echo} · ${def.name}` : def.name,
        survivors: survivorsText(ctx.squadIds, alive), score: ctx.score,
      }
      deathAt = ctx.now + 0.9
      deathEmitted = false
    },
    update(dt) {
      const demo = !ctx.started
      const warpBoost = ctx.env.warp * 70
      if (ctx.over) ctx.worldSpeed += (14 - ctx.worldSpeed) * Math.min(1, dt * 2)
      else if (demo) ctx.worldSpeed += (26 - ctx.worldSpeed) * Math.min(1, dt * 2)
      else if (ctx.phase === 'boss') ctx.worldSpeed += (16 - ctx.worldSpeed) * Math.min(1, dt * 2)
      else ctx.worldSpeed = worldSpeedFor(ctx.elapsed, ctx.sector) + warpBoost
      if (ctx.over && !deathEmitted && ctx.now >= deathAt && summary) {
        deathEmitted = true
        ctx.out.death(summary)
      }
      if (!live(ctx)) return
      ctx.elapsed += dt
      ctx.phaseT += dt
      if (ctx.phase === 'warning' && ctx.phaseT >= WARNING_TIME) {
        ctx.phase = 'boss'
        ctx.phaseT = 0
        ctx.boss.start()
        ctx.out.sector(ctx.sector, 'boss')
      } else if (ctx.phase === 'clear') {
        if (!warped && ctx.phaseT >= CLEAR_TIME - WARP_LEAD) { warped = true; ctx.env.warpIn() }
        if (ctx.phaseT >= CLEAR_TIME) enterSector(ctx.sector + 1)
      }
      ctx.distance += ctx.worldSpeed * dt
      const km = Math.floor(ctx.distance / 100)
      if (km !== lastKm) {
        lastKm = km
        ctx.out.distance(km)
        addScore(ctx, 2)
      }
      if (ctx.streakT > 0) {
        ctx.streakT -= dt
        if (ctx.streakT <= 0) breakStreak(ctx)
      }
      tickArsenal(ctx.arsenal, dt, tick)
      if (tick.shieldDown) ctx.story.cue('shield:down')
      if (tick.shieldDown || tick.overdriveEnd || tick.wingOdEnd) dirty = true
      emitArsenal()
    },
    warning() {
      if (ctx.phase !== 'travel') return
      ctx.phase = 'warning'
      ctx.phaseT = 0
      ctx.out.sector(ctx.sector, 'warning')
    },
    bossDown() {
      if (!live(ctx)) return
      addScore(ctx, sectorClearBonus(ctx.sector))
      ctx.hp = heal(ctx.hp, HEAL_CLEAR)
      ctx.out.health(ctx.hp, HP_MAX)
      ctx.phase = 'clear'
      ctx.phaseT = 0
      warped = false
      ctx.out.sector(ctx.sector, 'clear')
      ctx.story.cue(sectorIndex(ctx.sector) === 4 ? 'ending' : 'clear', sectorVars(ctx.sector - 1))
    },
    jump(sector) {
      if (!live(ctx)) run.start()
      clearField()
      ctx.env.warpIn()
      enterSector(Math.max(1, Math.floor(sector)))
    },
    arsenalDirty() { dirty = true },
  }
  return run
}
