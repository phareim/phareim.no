export interface Platform { x: number; y: number; w: number; h: number }

// A tide surge: a lit band that rises over a low slab on a fixed cycle.
// x/y/w/h is the lethal band at full rise (y is its top). The band is
// visible rising for 0.6 s before it kills; see tideLevel() in engine.ts.
export interface TideHazard {
  kind: 'tide'
  x: number; y: number; w: number; h: number
  period: number
  phase: number
}

// A rockfall: a wedge hanging under a cracked overhang. When the figure
// enters [triggerX, triggerX + triggerW] it drops; x/y/w/h is where it
// rests (y = top when landed), top is its current top. Once landed it is
// pushed into world.platforms and stays for the rest of the run.
export interface RockfallHazard {
  kind: 'rockfall'
  x: number; y: number; w: number; h: number
  triggerX: number; triggerW: number
  dropY: number
  top: number
  vy: number
  state: 'hanging' | 'falling' | 'landed'
}

export type Hazard = TideHazard | RockfallHazard
export type DeathCause = 'fall' | 'tide' | 'rockfall'

export interface Beacon { x: number; y: number; lit: boolean }
export interface World {
  player: {
    x: number; y: number; vx: number; vy: number
    grounded: boolean; facing: number
    /** seconds of landing crouch left; input is ignored while > 0 */
    crouch: number
    /** true while the current jump started from a near standstill (a hop) */
    hop: boolean
  }
  platforms: Platform[]
  hazards: Hazard[]
  beacons: Beacon[]
  width: number
  time: number
  deaths: number
  checkpoint: number
  won: boolean
  /** the death vignette in progress; the world is frozen for DEATH_TIME, then a hard cut */
  dying: { cause: DeathCause; t: number } | null
}
export interface Input { left: boolean; right: boolean; jump: boolean }
