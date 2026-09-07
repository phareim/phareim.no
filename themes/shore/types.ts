/**
 * Another Shore II — shared types.
 *
 * Two coordinate spaces:
 *  - stage units: where the figure lives. The figure is 22×52 stage units.
 *    Each shot has its own stage (width `stageW`), y points down.
 *  - frame units: the authored picture. Landscape frames are 320×200,
 *    portrait frames are 200×320. A shot places its stage in the frame with
 *    a uniform scale `s` and an anchor (stage y `stageY` sits at frame y
 *    `frameY`; stage x 0 sits at frame x 0, the stage spans the width).
 */

export type Vec = [number, number]

/** One flat-filled polygon: a palette index and a vertex list in frame units. */
export interface Poly {
  c: number
  pts: Vec[]
}

/** Solid axis-aligned block in stage units. Top face is walkable. */
export interface Solid {
  x: number
  y: number
  w: number
  h: number
  /** How the renderer draws it. `hidden` = collision only (scenery draws it). */
  look: 'slab' | 'ledge' | 'ground' | 'hidden'
  /** Palette index of the body; the top band uses its lit variant. */
  c?: number
}

export interface TideHazard {
  kind: 'tide'
  /** Slab the tide covers (stage units). */
  x: number
  w: number
  /** Slab top; the band is lethal once it rises above this. */
  y: number
  /** Cycle length in seconds and the lethal window inside it. */
  period: number
  coverFrom: number
  coverTo: number
  /** Where the sea surface rests (stage y) when the tide is out. */
  restY: number
}

export interface RockHazard {
  kind: 'rock'
  /** Trigger: figure x past this while the rock hangs. */
  triggerX: number
  /** Wedge footprint (stage units) and where it hangs from. */
  x: number
  w: number
  h: number
  hangY: number
  groundY: number
}

export type Hazard = TideHazard | RockHazard

export interface Composition {
  /** Uniform stage → frame scale. */
  s: number
  /** Stage y `stageY` is drawn at frame y `frameY`. */
  stageY: number
  frameY: number
  /** Painter-ordered scenery behind the stage. */
  back: Poly[]
  /** Painter-ordered scenery in front of the figure (foreground rock, the arch). */
  front: Poly[]
  /** Sea surface line in frame y, if the shot has water (moving highlight bands). */
  seaY?: number
  /** Colour indices used to extend the frame when the viewport is taller. */
  bleedTop: number
  bleedBottom: number
}

export interface Beast {
  /** Frame-unit polygons for the body (drawn in `back`), and the two heads. */
  headAway: Poly[]
  headTurned: Poly[]
  /** Stage x the figure must pass for the head to turn. */
  turnX: number
}

export interface TowerLamps {
  /** Frame-unit rectangles for the tower lamps, one per beacon, in landscape/portrait. */
  land: Vec[]
  port: Vec[]
  size: number
}

export interface Shot {
  id: string
  stageW: number
  solids: Solid[]
  hazards: Hazard[]
  /** Where the figure appears when entering from the left / from the right. */
  enterLeft: Vec
  enterRight: Vec
  /** Below this stage y the figure is lost (fall death). */
  abyssY: number
  /** Water surface in stage y for the tide pool (figure drawn behind the band). */
  waterY?: number
  /** Blocks walking off the left edge (the sea). */
  leftWall?: boolean
  land: Composition
  port: Composition
  beast?: Beast
  lamps?: TowerLamps
}

export interface Beacon {
  shot: number
  x: number
  y: number
  lit: boolean
}

export type DeathKind = 'fall' | 'tide' | 'rock'
export type Pose = 'idle' | 'run' | 'jump' | 'fall' | 'crouch' | 'land' | 'wade'

export interface Figure {
  x: number
  y: number
  vx: number
  vy: number
  grounded: boolean
  facing: 1 | -1
  crouch: boolean
  pose: Pose
  /** Seconds spent running, for the 12 fps key poses. */
  runTime: number
  airTime: number
  /** Highest point (smallest y) of the current flight, for landing recovery. */
  airTop: number
  /** Landing recovery left, seconds. */
  landTimer: number
  coyote: number
  jumpBuffer: number
  jumpHeld: boolean
}

export interface RockState {
  state: 'hanging' | 'falling' | 'landed'
  y: number
  vy: number
}

export interface World {
  shot: number
  figure: Figure
  beacons: Beacon[]
  checkpoint: number
  /** 0 dusk, 1 night, 2 storm, 3 dawn. */
  palette: number
  /** Lightning: draw the all-lit palette while time < flashUntil. */
  flashUntil: number
  stormSince: number
  rock: RockState
  beastTurned: boolean
  death: { kind: DeathKind; t: number; x: number; y: number } | null
  /** Seconds of black frame left (hard cut). */
  blackout: number
  /** What the black frame cuts to. */
  after: 'respawn' | 'loop' | null
  /** Seconds left of the figure surfacing at the start. */
  intro: number
  won: boolean
  time: number
  deaths: number
  attract: boolean
  loops: number
  /** Set for one step when the shot changed (renderer drops nothing, but tests read it). */
  cut: boolean
}

export interface Input {
  left: boolean
  right: boolean
  jump: boolean
  crouch: boolean
}
