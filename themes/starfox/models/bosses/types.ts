/**
 * The boss model contract (2026-09-25). Game logic owns health, timing and
 * attacks; a boss model owns how it looks and moves. Collision runs against
 * `cores` and `parts`: each is a hit sphere in its node's local space, and
 * `partWorld` gives its centre in world space (the pose moves them).
 *
 * Scale: about 20 units wide, parked around z ≈ −60 in a lane ±11 wide,
 * facing +Z (the player). The root's origin is the boss's centre of mass.
 */
import type * as THREE from 'three'
import type { Model } from '../core'

export type BossId = 'pincer' | 'moth' | 'furnace' | 'twins' | 'crown'

export interface BossPart {
  /** Stable id: 'core', 'claw-l', 'wing-0', 'knee-2', … (per boss, below). */
  id: string
  /** 'core' parts take the damage that ends the fight; 'part's are breakable pieces. */
  kind: 'core' | 'part'
  /** The part's node: hidden (or swapped to wreckage) when destroyed. */
  node: THREE.Object3D
  /** Hit sphere centre in `node`'s local space. */
  x: number
  y: number
  z: number
  /** Hit radius in world units. */
  r: number
  alive: boolean
  /**
   * Whether hits count right now: a core behind a closed maw, closed
   * belly or closed eye is not open. Parts are open while alive.
   */
  open: boolean
}

export interface BossModel extends Model {
  id: BossId
  cores: BossPart[]
  parts: BossPart[]
  part(id: string): BossPart | undefined
  /** Break a part (claw, wing panel, knee, twin, turret…): hides it, drops its lights. */
  setPartDestroyed(id: string): void
  /** Everything back: parts alive, pose neutral, lights on. */
  reset(): void
  /** World-space centre of a part's hit sphere (writes and returns `out`). */
  partWorld(p: BossPart, out: THREE.Vector3): THREE.Vector3
  /** Model lab only: drive every pose in a loop so the boss shows all its moves. */
  demo(t: number): void
}

/** THE PINCER — a crab carrier skimming the water. Parts: 'claw-l', 'claw-r'; core: 'core' (in the maw). */
export interface PincerModel extends BossModel {
  id: 'pincer'
  /** Sweep a claw across its lane: 0 = folded at the side, 1 = fully across the front. side −1 = left, 1 = right. */
  claw(side: -1 | 1, sweep: number): void
  /** Close the claw's pincer tips: 0 open, 1 shut. */
  pinch(side: -1 | 1, amount: number): void
  /** Telegraph a sweep: the claw heats up, 0 cold … 1 hot pink (above 0.5 the whole claw glows). */
  glow(side: -1 | 1, amount: number): void
  /** The maw: 0 shut (core covered, `open` false), 1 wide (the roar; core open above 0.6). */
  maw(open: number): void
}

/** THE MOTH — four wing panels over the core. Parts: 'wing-0' (upper left), 'wing-1' (upper right), 'wing-2' (lower left), 'wing-3' (lower right); core: 'core'. */
export interface MothModel extends BossModel {
  id: 'moth'
  /** Wing beat phase in radians (the model maps sin(phase) to the flap). */
  beat(phase: number): void
  /** Shoot off wing panel i (0–3): it falls away; the core opens as panels go. */
  dropPanel(i: number): void
}

/** THE FURNACE — a three-legged walker. Parts: 'leg-0', 'leg-1', 'leg-2' and 'knee-0'…'knee-2' (weak points); core: 'core' (belly). */
export interface FurnaceModel extends BossModel {
  id: 'furnace'
  /** Walk cycle phase in radians: the legs step in turn. */
  legs(phase: number): void
  /** Raise (0→1) a leg for a stomp; set back to 0 to slam it down. */
  stomp(leg: number, lift: number): void
  /** Break knee i: it glows out and the leg buckles; the belly opens. */
  breakKnee(i: number): void
  /** The belly hatch: 0 shut, 1 open (the core's `open`). */
  belly(open: number): void
}

/** THE TWINS — two mirrored ships. Parts: 'ship-a', 'ship-b'; cores: 'core-a', 'core-b'. Move `ships[i]` freely (they are children of root). */
export interface TwinsModel extends BossModel {
  id: 'twins'
  ships: [THREE.Group, THREE.Group]
  /** Which twin's core is lit (and open): 0, 1, or null for neither. */
  lit(which: 0 | 1 | null): void
}

/** THE HOLLOW CROWN — the mothership. Parts: 'turret-0'…'turret-5' (the ring), 'hull-0'…'hull-3' (plates shed in phase 3); core: 'eye'. */
export interface CrownModel extends BossModel {
  id: 'crown'
  /** 1 turret ring, 2 eye fight, 3 the run (plates loose, engines hot). */
  phase(n: 1 | 2 | 3): void
  /** The eye's lids: 0 shut, 1 open (the core's `open`). */
  eye(open: number): void
}

export type AnyBoss = PincerModel | MothModel | FurnaceModel | TwinsModel | CrownModel
