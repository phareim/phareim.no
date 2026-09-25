/**
 * What scene/boss.ts (the director) shares with each boss's brain in
 * scene/bosses/<id>.ts (2026-09-25).
 *
 * The director owns what every boss has in common: HP per part and the
 * bar, phases and enrage, the attack clock (bosses.ts), laser and blast
 * hits against the model's hit spheres, wingman targets, the entrance,
 * the death sequence and the HUD bar. A brain owns what makes the boss
 * itself: how it moves and poses, what each attack does in its telegraph
 * and active window, what a broken part changes, the telegraph marks on
 * the stage, and how it dies.
 */
import type * as THREE from 'three'
import type { BossAttackDef, BossClock, BossGate, BossPartRole } from '../../bosses'
import type { BossId } from '../../ids'
import type { AnyBoss, BossPart } from '../../models/bosses'
import type { Ctx } from '../ctx'
import type { Hazards } from './hazards'

/** One breakable piece or core in play (a row of bosses.ts's part table). */
export interface RtPart {
  /** index in `rt.parts` (the wingman/lock id is −1 − idx) */
  idx: number
  role: BossPartRole
  /** the model's hit sphere */
  model: BossPart
  hp: number
  max: number
  alive: boolean
  fatal: boolean
  inBar: boolean
  gate: BossGate
  score: number
  /** world hit sphere, refreshed once a frame */
  wx: number
  wy: number
  wz: number
  wr: number
}

/** The stage's HUD layer, in its own pixels, with projection from 3D. */
export interface HudKit {
  g: CanvasRenderingContext2D
  /** blink phase 0/1 at 8 Hz */
  pulse: number
  /** Project a world point: HUD pixel x/y and a radius (px); false when behind the camera. */
  project(x: number, y: number, z: number, r: number, out: { x: number; y: number; r: number }): boolean
  dotted(x0: number, y0: number, x1: number, y1: number, color: string): void
  corners(cx: number, cy: number, s: number, color: string): void
  text(s: string, cx: number, y: number, color: string): void
  /** A hatched danger box over lanes l0…l1 (inclusive) at depth z, from height y0 to y1. */
  laneBox(l0: number, l1: number, z: number, y0: number, y1: number, color: string): void
}

export interface BossRt {
  ctx: Ctx
  id: BossId
  model: AnyBoss
  hazards: Hazards
  clock: BossClock
  parts: RtPart[]
  /** absolute sector (ECHO loops scale from it) */
  sector: number
  phase: number
  enraged: boolean
  /** seconds since the boss appeared */
  t: number
  /** the entrance is over and the wheel runs */
  arrived: boolean
  /** entrance progress 0 → 1 (1 once parked) */
  entry: number
  /** where the entrance starts and ends (world z) */
  startZ: number
  parkZ: number
  /** root position (the brain moves it; the director applies it) */
  x: number
  y: number
  z: number
  /** portrait phones shrink the boss to the narrower corridor: laneX / 11 */
  k: number
  /** world-speed multiplier (the Crown's chase) */
  speedMul: number
  /** the root, for brains that turn it (the Crown) */
  root: THREE.Group
  /** An aimed target: alternates between the player and a wingman
   * (`pickAggroTarget`). Writes into `out`. */
  aim(out: { x: number; y: number; z: number }): void
  /** A world point on the model (node-local → world). */
  world(node: THREE.Object3D, x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3
  /** Live, in-bar parts of a role. */
  alive(role: BossPartRole): number
}

export interface BossBrain {
  readonly model: AnyBoss
  /** Put the model at its entrance start (rt.x/y/z are set by the director first). */
  enter(rt: BossRt): void
  /** Every frame: move and pose (entrance included). */
  move(rt: BossRt, dt: number): void
  /** The wheel entered a stage of `atk`. */
  stage(rt: BossRt, atk: BossAttackDef, stage: 'begin' | 'active' | 'recover'): void
  /** Every frame while an attack runs (its telegraph, active and recovery). */
  tick(rt: BossRt, atk: BossAttackDef, dt: number): void
  /** A part broke (not the final kill). */
  partDown(rt: BossRt, part: RtPart): void
  /** The phase went up. */
  phase(rt: BossRt, n: number): void
  /** The running attack was dropped (a stun, the death): undo its pose. */
  abort(rt: BossRt): void
  /** Death pose, `u` 0 → 1 over the death sequence. */
  dying(rt: BossRt, u: number, dt: number): void
  /** Telegraph marks on the stage's HUD layer. */
  hud(rt: BossRt, h: HudKit): void
}
