/**
 * Space Voyagers: short cuts into the run, for the tests and for the lab
 * that takes the pictures. The game never calls these.
 */
import { SECTORS } from './balance.ts'
import { startBoss } from './bosses.ts'
import { go } from './flow.ts'
import type { BossKind, Enemy, Input, Role, Stage, WeaponId, World } from './types.ts'
import { clampLevel } from './weapons.ts'
import { slotX, slotY } from './waves.ts'
import { spawnEnemy } from './world.ts'
import { step } from './index.ts'

/** Take everything off the field and put the two ships back where they start. */
export function clearField(w: World): void {
  for (const pool of [w.enemies, w.shots, w.bolts, w.aims, w.zones, w.barriers, w.pickups, w.rigs]) {
    for (let i = 0; i < pool.length; i++) pool[i]!.active = false
  }
  w.boss.active = false
  w.boss.force = ''
  w.convoy.active = false
  w.wing.state = 'off'
  w.duo.active = false
  w.pass.active = false
  w.cloud.active = false
  w.slow = 0
  w.duet = 0
  const q = w.partner
  q.state = 'fly'
  q.captor = -1
  q.hits = 0
  q.dock = 0
  q.t = 0
  q.x = w.player.x + 52
  q.y = w.player.y + 4
}

export interface Jump {
  sector?: number
  voyage?: number
  /** The stage to begin; `wave` takes `wave` 1 to 4. */
  stage: Stage
  wave?: number
  /** Start this boss directly (the Deaf Star without Dark Fader first). */
  boss?: BossKind
}

/** Clear the field and begin a stage of a sector on the next tick. */
export function jumpTo(w: World, to: Jump): void {
  clearField(w)
  w.over = false
  if (to.voyage) w.voyage = to.voyage
  if (to.sector) w.sector = Math.max(1, Math.min(SECTORS.length, to.sector))
  const def = SECTORS[w.sector - 1]!
  w.gang = def.gang
  w.wave = to.stage === 'wave' ? Math.max(1, Math.min(4, to.wave ?? 1)) : 0
  w.eventStarted = false
  w.duoDone = false
  w.bossIdx = 0
  go(w, to.stage)
  if (to.stage === 'boss' && to.boss) {
    // Skip the stage's own first tick, which would start the sector's first boss.
    w.stageT = 0
    w.bossIdx = Math.max(0, def.bosses.indexOf(to.boss))
    startBoss(w, to.boss)
  }
}

export function arm(w: World, weapon: WeaponId, level: number): void {
  w.player.weapon = weapon
  w.player.level = clampLevel(level)
}

/** An empty field in which nothing is scheduled: put things in it by hand. */
export function sandbox(w: World, sector = 1): void {
  jumpTo(w, { sector, stage: 'idle' })
  w.stageT = 0
  const f = w.formation
  f.rows = 4
  f.top = 40 + (w.h - 320) * 0.1
}

/** Put an enemy in the formation at a slot, already formed up. */
export function place(w: World, role: Role, col: number, row: number): Enemy {
  const e = spawnEnemy(w, role, w.gang, slotX(w, col), slotY(w, row))
  if (!e) throw new Error('enemy pool is full')
  e.col = col
  e.row = row
  e.state = 'form'
  e.fireT = 1e9
  return e
}

/** Step `n` ticks with one input, or with what `pilot` returns each tick. */
export function run(w: World, n: number, pilot: Input | ((w: World) => Input)): void {
  for (let i = 0; i < n && !w.over; i++) step(w, typeof pilot === 'function' ? pilot(w) : pilot)
}
