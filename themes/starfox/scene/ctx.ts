/**
 * The flight scene's shared context (OPERATION NIGHTLIGHT, 2026-09-25).
 *
 * Flight.vue was one 3000-line file; the scene now lives in ./scene as
 * systems that share one `Ctx`: the three.js scene and camera, the run's
 * state (score, hull, sector, phase, arsenal), the game clock, and a
 * reference to every other system. Each system is built with
 * `createX(ctx)` and hung on the context (`ctx.enemies = createEnemies(ctx)`),
 * so systems call each other through `ctx` at run time and only import
 * each other's types (no import cycles).
 *
 * Units: world units, the ship at z = 0 flying toward −z, the ground at
 * y = −5; the lane is ±`laneX` across (11 wide screens, 6.5 portrait) and
 * LANE_Y_LO…LANE_Y_HI high. `ctx.now` is the game clock in seconds: it
 * stops while paused, so every timer (invulnerability, respawns, the
 * intercom) freezes with the world.
 *
 * `ctx.out` is how the scene talks to the Vue shell (Flight.vue turns
 * the calls into emits for Landing.vue). Nothing in the frame loop
 * allocates: pools are built up front, per-frame scratch lives here.
 */
import type * as THREE from 'three'
import type { SectorPhase, WingId } from '../balance'
import type { ArsenalState } from '../arsenal'
import type { Speaker } from '../story'
import type { Env } from './env'
import type { Obstacles } from './obstacles'
import type { Shots } from './shots'
import type { Fx } from './fx'
import type { Player } from './player'
import type { Squad } from './squad'
import type { Enemies } from './enemies'
import type { Pickups } from './pickups'
import type { DreadBoss } from './boss'
import type { StoryGlue } from './storyGlue'
import type { Encounters } from './encounter'
import type { SetPieces } from './setpieces'
import type { Run } from './run'

export const SPAWN_Z = -230
export const KILL_Z = 18
export const GROUND_Y = -5
export const LANE_Y_LO = -1.5
export const LANE_Y_HI = 6
export const MULT_STEPS = [1, 2, 3, 4, 6, 8] as const

export interface SquadHud { id: WingId; hp: number; max: number; alive: boolean; respawn: number; trouble: boolean }
export interface ArsenalHud { laser: number; bombs: number; charge: number; shield: number; overdrive: number; wingOd: number }
export interface DeathSummary { sector: number; index: number; loop: number; name: string; survivors: string; score: number }
export interface IntercomView { id: number; who: Speaker; name: string; text: string }

/** What the scene tells the Vue shell. */
export interface Out {
  score(n: number): void
  distance(km: number): void
  health(hp: number, max: number): void
  sector(n: number, phase: SectorPhase): void
  boss(hp: number, max: number, active: boolean, name: string): void
  squad(list: SquadHud[]): void
  arsenal(a: ArsenalHud): void
  /** A short message in the dock (pickups, ALL GOLD). */
  toast(text: string): void
  /** A blinking warning in the dock (BEHIND). */
  alert(text: string): void
  /** A terse wingman callout in the dock ('HERON ▶ ENGAGING'). */
  callout(text: string): void
  /** Sector title card, e.g. 'SECTOR 2 · WHISPER WOODS'. */
  title(card: string): void
  intercom(line: IntercomView | null): void
  intercomShown(n: number): void
  started(): void
  restart(): void
  over(): void
  death(s: DeathSummary): void
}

/** Throttled sound effects (lasers and kills fire several times a second). */
export interface Sfx {
  laser(): void
  boom(big?: boolean): void
  zap(): void
  tick(): void
  hit(): void
  ring(): void
  powerup(): void
  roll(): void
  charge(): void
  beam(): void
}

export interface Ctx {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  glowTex: THREE.Texture
  rng: () => number
  reduced: boolean
  touch: boolean
  laneX: number
  portrait: boolean
  /** Game clock (s); stops while paused. */
  now: number
  // ---- the run
  started: boolean
  over: boolean
  god: boolean
  /** Debug: the wingmen hold their fire (screenshots of live enemies). */
  holdWings: boolean
  /** Runs started this page load (1 on the first). */
  runs: number
  score: number
  mult: number
  killCount: number
  streakT: number
  hp: number
  invulnUntil: number
  /** Absolute 1-based sector (6 = ECHO I's coast). */
  sector: number
  phase: SectorPhase
  phaseT: number
  worldSpeed: number
  elapsed: number
  distance: number
  arsenal: ArsenalState
  shake: number
  flash: number
  flashColor: string
  /** The three wingmen in slot order. */
  squadIds: [WingId, WingId, WingId]
  /** High score when the run began (for the `best` cue). */
  bestBefore: number
  // ---- systems
  env: Env
  obstacles: Obstacles
  shots: Shots
  fx: Fx
  player: Player
  squad: Squad
  enemies: Enemies
  pickups: Pickups
  boss: DreadBoss
  story: StoryGlue
  enc: Encounters
  sets: SetPieces
  run: Run
  out: Out
  sfx: Sfx
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo)
}

/** True while a run is on (started, not over). */
export function live(ctx: Ctx): boolean {
  return ctx.started && !ctx.over
}

let lastScoreSent = -1

export function addScore(ctx: Ctx, n: number): void {
  if (!live(ctx) || n <= 0) return
  const before = ctx.score
  ctx.score += n
  if (ctx.score !== lastScoreSent) {
    lastScoreSent = ctx.score
    ctx.out.score(ctx.score)
  }
  if (ctx.bestBefore > 0 && before <= ctx.bestBefore && ctx.score > ctx.bestBefore) ctx.story.cue('best')
}

export function resetScoreSent(): void {
  lastScoreSent = -1
}

/** A kill feeds the streak multiplier and scores `base × mult`. */
export function scoreKill(ctx: Ctx, base: number): void {
  ctx.killCount++
  ctx.streakT = 3
  const i = Math.min(Math.floor(ctx.killCount / 2), MULT_STEPS.length - 1)
  ctx.mult = MULT_STEPS[i] ?? 1
  addScore(ctx, base * ctx.mult)
}

export function breakStreak(ctx: Ctx): void {
  ctx.killCount = 0
  ctx.mult = 1
  ctx.streakT = 0
}

interface SoundLike {
  sfx: {
    laser(): void; explosion(big?: boolean): void; enemyShoot(): void; hit(): void; ring(): void
    powerup(): void; roll(): void; charge(): void; beam(): void
  }
}

export function createSfx(sound: SoundLike, isLive: () => boolean): Sfx {
  const last = { laser: 0, boom: 0, zap: 0, tick: 0 }
  const gate = (k: keyof typeof last, ms: number): boolean => {
    if (!isLive()) return false
    const now = performance.now()
    if (now - last[k] < ms) return false
    last[k] = now
    return true
  }
  return {
    laser() { if (gate('laser', 80)) sound.sfx.laser() },
    boom(big = false) { if (gate('boom', 100)) sound.sfx.explosion(big) },
    zap() { if (gate('zap', 220)) sound.sfx.enemyShoot() },
    tick() { if (gate('tick', 90)) sound.sfx.hit() },
    hit() { if (isLive()) sound.sfx.hit() },
    ring() { if (isLive()) sound.sfx.ring() },
    powerup() { if (isLive()) sound.sfx.powerup() },
    roll() { if (isLive()) sound.sfx.roll() },
    charge() { if (isLive()) sound.sfx.charge() },
    beam() { if (isLive()) sound.sfx.beam() },
  }
}
