/**
 * The squad's set pieces: Dingo's trouble (he breaks formation with gnats
 * glued to his tail; shoot them within DINGO_TROUBLE.time or he goes down)
 * and MEGA COBRA (a silent flyby in sector 2, a duel he escapes from in
 * sector 3, the final duel in sector 5). Both report back to the
 * encounter runner with `resolve`, which then sends the ending's cue.
 */
import {
  DINGO_TROUBLE, RIVAL, dingoTroubleOutcome, dingoWeave, laneY, rivalEscapes, rivalHitCue, rivalShouldRoll,
} from '../balance'
import { P } from '../models/core'
import type { Enemy } from './enemies'
import { clamp, live, rand, type Ctx } from './ctx'

export interface SetPieces {
  dingo(chasers: number, side: -1 | 1): void
  /** The runner ended Dingo's trouble (its deadline): settle it if still on. */
  endDingo(outcome: string): void
  rival(mode: 'flyby' | 'duel' | 'final', hp: number, side: -1 | 1): void
  endRival(outcome: string): void
  stepChaser(e: Enemy, dt: number): void
  chaserDown(): void
  stepRival(e: Enemy, dt: number): void
  rivalHit(e: Enemy): void
  rivalDown(): void
  update(dt: number): void
  clear(): void
  readonly dingoActive: boolean
  readonly rivalActive: boolean
}

const MODE_FLYBY = 0
const MODE_DUEL = 1
const MODE_FINAL = 2
const PH_ENTER = 0
const PH_FIGHT = 1
const PH_ESCAPE = 2

export function createSetPieces(ctx: Ctx): SetPieces {
  // ---- Dingo's trouble
  let dSlot = -1
  let dT = 0
  let dSide: -1 | 1 = 1
  let dAlive = 0
  let dOn = false
  let dSparkT = 0
  let dAlertT = 0

  // ---- the rival
  let rival: Enemy | null = null
  let rMode = MODE_FLYBY
  let rPhase = PH_ENTER
  let duelT = 0
  let inLineT = 0
  let sinceRoll = 9
  let rollT = 0
  let rollDir = 1
  let attack = 0
  let telegraph = 0
  let burstLeft = 0
  let burstT = 0
  let lastFrac = 1
  let hpSent = -1

  function finishDingo(saved: boolean) {
    if (!dOn) return
    dOn = false
    const m = ctx.squad.members[dSlot]
    if (m) {
      m.trouble = false
      m.invulnUntil = ctx.now + 0.5
    }
    // Whoever is still on his tail goes back to being an ordinary gnat.
    for (const e of ctx.enemies.list) if (e.active && e.role === 1) { e.role = 0; e.entry = 0 }
    if (!saved && m && m.alive) ctx.squad.kill(dSlot)
    ctx.squad.touch()
  }

  function emitBar() {
    if (!rival || rMode === MODE_FLYBY) return
    const hp = Math.max(0, Math.ceil(rival.hp))
    if (hp === hpSent) return
    hpSent = hp
    ctx.out.boss(hp, rival.maxHp, true, 'MEGA COBRA')
  }

  function endRivalBar() {
    if (hpSent >= 0) ctx.out.boss(0, 0, false, '')
    hpSent = -1
  }

  function escape() {
    if (!rival || rPhase === PH_ESCAPE) return
    rPhase = PH_ESCAPE
    rival.invuln = true
    rival.anim.open = 0
    endRivalBar()
  }

  function rivalAttack(e: Enemy, dt: number) {
    if (burstLeft > 0) {
      burstT -= dt
      if (burstT <= 0) {
        burstT = RIVAL.burst.gap
        burstLeft--
        ctx.enemies.fireAimed(e.x, e.y, e.z + 2, RIVAL.burst.boltMul)
      }
      return
    }
    if (telegraph > 0) {
      telegraph -= dt
      e.anim.open = 1
      if (telegraph <= 0) {
        if (attack % 2 === 0) { burstLeft = RIVAL.burst.bolts; burstT = 0 }
        else {
          const n = RIVAL.spread.bolts
          for (let i = 0; i < n; i++) ctx.shots.boltDir(e.x, e.y, e.z + 2, (i / (n - 1) - 0.5) * RIVAL.spread.spread + (ctx.player.x - e.x) * 0.012, (ctx.player.y - e.y) * 0.012, RIVAL.spread.boltMul)
        }
        attack++
        e.fireT = rand(RIVAL.attackEvery[0], RIVAL.attackEvery[1])
      }
      return
    }
    e.anim.open = Math.max(0, (e.anim.open ?? 0) - dt * 3)
    e.fireT -= dt
    if (e.fireT <= 0) telegraph = attack % 2 === 0 ? RIVAL.burst.telegraph : RIVAL.spread.telegraph
  }

  return {
    get dingoActive() { return dOn },
    get rivalActive() { return !!rival },
    dingo(chasers, side) {
      const slot = ctx.squad.slotOf('dingo')
      const m = ctx.squad.members[slot]
      if (!m || !m.alive || dOn) return
      dSlot = slot
      dOn = true
      dT = 0
      dSide = side
      dAlive = 0
      dSparkT = 0
      m.trouble = true
      m.invulnUntil = ctx.now + DINGO_TROUBLE.time + 2
      ctx.squad.touch()
      for (let i = 0; i < chasers; i++) {
        const e = ctx.enemies.spawn(DINGO_TROUBLE.chaserKind, side * ctx.laneX * (1.2 + 0.2 * i), m.y + 2, -80 - i * 6)
        if (!e) continue
        e.role = 1
        e.n = i
        e.shoots = false
        dAlive++
      }
      dAlertT = 0
    },
    endDingo(outcome) {
      if (dOn) finishDingo(outcome === 'saved')
    },
    stepChaser(e, dt) {
      const m = ctx.squad.members[dSlot]
      if (!dOn || !m) { e.role = 0; return }
      const gap = DINGO_TROUBLE.gap * (e.n + 1)
      const k = 1 - Math.exp(-2.5 * dt)
      const tx = m.x + Math.sin(e.t * 2 + e.n) * 1.2
      const ty = m.y + 0.6 + Math.cos(e.t * 1.7 + e.n) * 0.6
      e.bank = clamp(-(tx - e.x) * 0.3, -0.8, 0.8)
      e.x += (tx - e.x) * k
      e.y += (ty - e.y) * k
      e.z += (m.z + gap - e.z) * k
      e.target = dSlot
    },
    chaserDown() {
      dAlive = Math.max(0, dAlive - 1)
    },
    rival(mode, hp, side) {
      if (rival) ctx.enemies.remove(rival)
      rMode = mode === 'flyby' ? MODE_FLYBY : mode === 'duel' ? MODE_DUEL : MODE_FINAL
      const e = ctx.enemies.spawn('rival', side * ctx.laneX * 1.8, laneY(0.75), rMode === MODE_FLYBY ? -58 : -140)
      if (!e) return
      rival = e
      e.role = 2
      e.side = side
      e.hp = e.maxHp = rMode === MODE_FLYBY ? 999 : hp
      e.invuln = rMode === MODE_FLYBY
      e.fireT = rand(RIVAL.attackEvery[0], RIVAL.attackEvery[1]) + 1
      rPhase = PH_ENTER
      duelT = 0
      inLineT = 0
      sinceRoll = 9
      rollT = 0
      attack = 0
      telegraph = 0
      burstLeft = 0
      lastFrac = 1
      hpSent = -1
      e.a = 0
      emitBar()
    },
    endRival(outcome) {
      if (!rival) return
      if (outcome === 'escape') escape()
    },
    stepRival(e, dt) {
      const t = e.t
      if (rMode === MODE_FLYBY) {
        const k = Math.min(1, t / RIVAL.flybyTime)
        const s = k * k * (3 - 2 * k)
        e.x = e.side * ctx.laneX * 1.8 * (1 - 2 * s)
        e.y = laneY(0.75) + Math.sin(k * Math.PI) * 2.5
        e.z = -58 + Math.sin(k * Math.PI) * 26
        e.anim.open = 1
        e.anim.boost = 1
        e.bank = -e.side * 0.7 + Math.sin(k * Math.PI * 2) * 0.3
        if (k >= 1) { ctx.enemies.remove(e); rival = null }
        return
      }
      if (rPhase === PH_ENTER) {
        // In from far ahead on its side, swinging into the lane.
        e.z += 45 * dt
        e.x += (ctx.player.x + e.side * 4 - e.x) * Math.min(1, dt * 1.2)
        e.y += (laneY(0.6) - e.y) * Math.min(1, dt * 1.5)
        e.anim.boost = 1
        e.anim.open = 1
        e.bank = -e.side * 0.6
        if (e.z > -55) { rPhase = PH_FIGHT; e.a = ctx.player.x; e.b = 1.2 }
        return
      }
      e.model.root.rotation.y = 0
      if (rPhase === PH_ESCAPE) {
        e.y += 14 * dt
        e.z -= 70 * dt
        e.anim.boost = 1
        e.bank += dt * 3
        if (e.z < -220 || e.y > 40) { ctx.enemies.remove(e); rival = null }
        return
      }
      duelT += dt
      sinceRoll += dt
      // Keep the range, slide across, roll out of a steady aim.
      const zT = -52 + Math.sin(t * 0.5) * 16
      e.z += (zT - e.z) * Math.min(1, dt * 1.5)
      e.y += (laneY(0.55) + Math.sin(t * 0.8) * 1.8 - e.y) * Math.min(1, dt * 2)
      e.b -= dt
      if (e.b <= 0) { e.b = rand(1.2, 1.8); e.a = clamp(ctx.player.x + rand(-7, 7), -ctx.laneX, ctx.laneX) }
      if (Math.abs(e.x - ctx.player.x) < RIVAL.lineX) inLineT += dt
      else inLineT = 0
      if (rollT <= 0 && rivalShouldRoll(inLineT, sinceRoll)) {
        rollT = RIVAL.roll
        rollDir = e.x > ctx.player.x ? 1 : -1
        if (Math.abs(e.x + rollDir * 6) > ctx.laneX) rollDir = -rollDir
        e.a = clamp(e.x + rollDir * 6, -ctx.laneX, ctx.laneX)
        sinceRoll = 0
        inLineT = 0
      }
      const speed = rollT > 0 ? RIVAL.speed * 2.2 : RIVAL.speed
      e.x += clamp(e.a - e.x, -speed * dt, speed * dt)
      if (rollT > 0) {
        rollT -= dt
        e.bank = rollDir * (1 - rollT / RIVAL.roll) * Math.PI * 2
      } else e.bank = clamp((e.a - e.x) * -0.08, -0.6, 0.6)
      e.anim.boost = rollT > 0 ? 1 : 0.3
      if (live(ctx)) rivalAttack(e, dt)
      emitBar()
      if (rivalEscapes(e.hp / e.maxHp, rMode === MODE_FINAL, duelT)) {
        ctx.enc.resolve('rivalDuel', 'escape')
        escape()
      }
    },
    rivalHit(e) {
      const f = e.hp / e.maxHp
      const cue = rivalHitCue(lastFrac, f)
      if (cue) ctx.story.cue(cue)
      lastFrac = f
      emitBar()
    },
    rivalDown() {
      rival = null
      endRivalBar()
      ctx.enc.resolve('rivalDuel', 'down')
    },
    update(dt) {
      if (!dOn) return
      const m = ctx.squad.members[dSlot]
      if (!m || !m.alive) { finishDingo(false); return }
      dT += dt
      const w = dingoWeave(dT, dSide)
      m.tx = w.x * ctx.laneX
      m.ty = laneY(w.y)
      m.tz = DINGO_TROUBLE.z
      // Tracers round him while they are on his tail; the dock keeps saying so.
      dAlertT -= dt
      if (dAlertT <= 0) { dAlertT = 2; ctx.out.alert('DINGO IN TROUBLE') }
      dSparkT -= dt
      if (dSparkT <= 0 && dAlive > 0) {
        dSparkT = 0.35
        ctx.fx.sparks(m.x + rand(-1, 1), m.y + rand(-0.5, 0.8), m.z + rand(-1, 1), P.hot, 4, 5)
      }
      const outcome = dingoTroubleOutcome(dAlive, dT)
      if (outcome !== 'running') {
        ctx.enc.resolve('dingoTrouble', outcome)
        finishDingo(outcome === 'saved')
      }
    },
    clear() {
      const m = ctx.squad.members[dSlot]
      if (dOn && m) { m.trouble = false; ctx.squad.touch() }
      dOn = false
      dAlive = 0
      if (rival) ctx.enemies.remove(rival)
      rival = null
      endRivalBar()
    },
  }
}
