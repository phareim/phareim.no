/**
 * Space Voyagers II: every number the fight is tuned by. Metres, seconds,
 * radians per second; damage in points. DESIGN.md says why the numbers are
 * what they are; `tests/voyagers2-*.test.mjs` hold the ones that matter.
 */
import type { ShipKind } from './types.ts'

export const TICK = 1 / 60
const DEG = Math.PI / 180

export interface ShipClass {
  /** Shown on the target display. */
  label: string
  r: number
  cruise: number
  max: number
  burn: number
  /** Slowest it can go (brake held). */
  min: number
  /** m/s² towards the speed it wants. */
  accel: number
  /** Turn rates at cruise: pitch, yaw, roll (rad/s). */
  pitch: number
  yaw: number
  roll: number
  /** Seconds of afterburner in a full tank, and seconds to refill it. */
  fuel: number
  refuel: number
  shield: number
  armour: number
  core: number
  /** Guns: points a bolt, bolts a second (both guns), the cost of one bolt from a full capacitor, and refill a second. */
  gunDmg: number
  gunRate: number
  gunCost: number
  gunRecharge: number
  /** Gun mounts, left/right offset in metres. */
  gunSpread: number
  missiles: number
  decoys: number
  /** Score for a kill. */
  points: number
  /** Turrets: count and where they point (ship frame). */
  turrets?: { at: [number, number, number]; dir: [number, number, number]; cone: number }[]
  /** A fighter's tail gun is lighter than a big ship's battery: points a bolt and bolts a second (default `TURRET`). */
  tdmg?: number
  trate?: number
  /** Big ships: they do not dogfight. */
  capital?: boolean
}

export const SHIPS: Record<ShipKind, ShipClass> = {
  calzone: {
    label: 'CALZONE', r: 10, cruise: 260, max: 420, burn: 900, min: 90, accel: 260,
    pitch: 78 * DEG, yaw: 70 * DEG, roll: 170 * DEG, fuel: 6, refuel: 14,
    shield: 160, armour: 140, core: 100,
    gunDmg: 8, gunRate: 8, gunCost: 0.032, gunRecharge: 0.2, gunSpread: 3,
    missiles: 6, decoys: 6, points: 0,
    turrets: [{ at: [0, 3.9, 10.1], dir: [0, 0, 1], cone: 105 * DEG }],
  },
  moped: {
    label: 'MOPED', r: 8, cruise: 300, max: 480, burn: 1000, min: 120, accel: 320,
    pitch: 92 * DEG, yaw: 84 * DEG, roll: 200 * DEG, fuel: 5, refuel: 12,
    shield: 80, armour: 70, core: 50,
    gunDmg: 6, gunRate: 7, gunCost: 0.04, gunRecharge: 0.22, gunSpread: 2,
    missiles: 2, decoys: 2, points: 0,
  },
  rig: {
    label: 'TALL TALE', r: 16, cruise: 220, max: 340, burn: 700, min: 80, accel: 160,
    pitch: 52 * DEG, yaw: 46 * DEG, roll: 110 * DEG, fuel: 6, refuel: 16,
    shield: 160, armour: 160, core: 120,
    gunDmg: 12, gunRate: 6, gunCost: 0.04, gunRecharge: 0.2, gunSpread: 5,
    missiles: 4, decoys: 4, points: 0, tdmg: 5, trate: 5,
    turrets: [{ at: [0, 3, 8], dir: [0, 0, 1], cone: 100 * DEG }],
  },
  tug: {
    label: 'NOSTALGIA', r: 12, cruise: 250, max: 400, burn: 850, min: 90, accel: 220,
    pitch: 70 * DEG, yaw: 64 * DEG, roll: 150 * DEG, fuel: 6, refuel: 14,
    shield: 110, armour: 100, core: 80,
    gunDmg: 10, gunRate: 7, gunCost: 0.035, gunRecharge: 0.2, gunSpread: 3,
    missiles: 4, decoys: 4, points: 0,
  },
  pigeon: {
    label: 'CENTURY PIGEON', r: 12, cruise: 290, max: 470, burn: 1050, min: 110, accel: 300,
    pitch: 88 * DEG, yaw: 80 * DEG, roll: 190 * DEG, fuel: 7, refuel: 12,
    shield: 120, armour: 90, core: 70,
    gunDmg: 10, gunRate: 9, gunCost: 0.035, gunRecharge: 0.22, gunSpread: 3,
    missiles: 4, decoys: 4, points: 1500,
  },
  deepdish: {
    label: 'DEEP DISH', r: 180, cruise: 0, max: 40, burn: 40, min: 0, accel: 5,
    pitch: 2 * DEG, yaw: 2 * DEG, roll: 2 * DEG, fuel: 1, refuel: 1,
    shield: 1500, armour: 2500, core: 2000,
    gunDmg: 0, gunRate: 0, gunCost: 0, gunRecharge: 0, gunSpread: 0,
    missiles: 0, decoys: 0, points: 0, capital: true,
    turrets: [
      { at: [0, 40, -150], dir: [0, 0.4, -1], cone: 80 * DEG },
      { at: [0, 40, 150], dir: [0, 0.4, 1], cone: 80 * DEG },
      { at: [-150, 10, 0], dir: [-1, 0.3, 0], cone: 80 * DEG },
      { at: [150, 10, 0], dir: [1, 0.3, 0], cone: 80 * DEG },
    ],
  },
  hauler: {
    label: 'FREIGHTER', r: 40, cruise: 120, max: 160, burn: 160, min: 0, accel: 20,
    pitch: 10 * DEG, yaw: 10 * DEG, roll: 10 * DEG, fuel: 1, refuel: 1,
    shield: 200, armour: 400, core: 300,
    gunDmg: 0, gunRate: 0, gunCost: 0, gunRecharge: 0, gunSpread: 0,
    missiles: 0, decoys: 0, points: 0, capital: true,
  },
  rat: {
    label: 'RAT', r: 8, cruise: 300, max: 460, burn: 950, min: 120, accel: 300,
    pitch: 96 * DEG, yaw: 88 * DEG, roll: 210 * DEG, fuel: 4, refuel: 14,
    shield: 30, armour: 40, core: 25,
    gunDmg: 4, gunRate: 5, gunCost: 0.05, gunRecharge: 0.2, gunSpread: 2,
    missiles: 0, decoys: 0, points: 100,
  },
  bear: {
    label: 'BEAR', r: 10, cruise: 260, max: 400, burn: 850, min: 100, accel: 240,
    pitch: 80 * DEG, yaw: 72 * DEG, roll: 160 * DEG, fuel: 5, refuel: 14,
    shield: 60, armour: 80, core: 50,
    gunDmg: 6, gunRate: 5, gunCost: 0.05, gunRecharge: 0.2, gunSpread: 3,
    missiles: 2, decoys: 1, points: 200,
  },
  gorilla: {
    label: 'GORILLA', r: 13, cruise: 220, max: 340, burn: 700, min: 80, accel: 180,
    pitch: 56 * DEG, yaw: 50 * DEG, roll: 120 * DEG, fuel: 5, refuel: 16,
    shield: 100, armour: 140, core: 80,
    gunDmg: 8, gunRate: 4, gunCost: 0.05, gunRecharge: 0.2, gunSpread: 4,
    missiles: 2, decoys: 2, points: 350, tdmg: 4, trate: 4,
    turrets: [{ at: [0, 2, 6], dir: [0, 0, 1], cone: 80 * DEG }],
  },
  hound: {
    label: 'HOUND', r: 14, cruise: 200, max: 300, burn: 600, min: 80, accel: 150,
    pitch: 46 * DEG, yaw: 42 * DEG, roll: 100 * DEG, fuel: 4, refuel: 16,
    shield: 80, armour: 150, core: 80,
    gunDmg: 6, gunRate: 4, gunCost: 0.05, gunRecharge: 0.2, gunSpread: 4,
    missiles: 1, decoys: 0, points: 300, tdmg: 4, trate: 3,
    turrets: [{ at: [0, 2, 7], dir: [0, 0, 1], cone: 85 * DEG }],
  },
  parmesan: {
    label: 'GOLDEN GRATER', r: 11, cruise: 300, max: 480, burn: 1100, min: 110, accel: 320,
    pitch: 98 * DEG, yaw: 90 * DEG, roll: 220 * DEG, fuel: 8, refuel: 10,
    shield: 180, armour: 140, core: 90,
    gunDmg: 10, gunRate: 9, gunCost: 0.035, gunRecharge: 0.24, gunSpread: 3,
    missiles: 4, decoys: 6, points: 3000,
  },
  buffet: {
    label: 'THE BUFFET', r: 220, cruise: 30, max: 40, burn: 40, min: 0, accel: 5,
    pitch: 2 * DEG, yaw: 2 * DEG, roll: 2 * DEG, fuel: 1, refuel: 1,
    shield: 3000, armour: 3500, core: 2500,
    gunDmg: 0, gunRate: 0, gunCost: 0, gunRecharge: 0, gunSpread: 0,
    missiles: 0, decoys: 0, points: 10000, capital: true,
    turrets: [
      { at: [0, 50, -180], dir: [0, 0.5, -1], cone: 80 * DEG },
      { at: [0, 50, 180], dir: [0, 0.5, 1], cone: 80 * DEG },
      { at: [-120, 20, 0], dir: [-1, 0.3, 0], cone: 80 * DEG },
      { at: [120, 20, 0], dir: [1, 0.3, 0], cone: 80 * DEG },
    ],
  },
  outlet: {
    label: 'OUTLET', r: 70, cruise: 40, max: 60, burn: 60, min: 0, accel: 8,
    pitch: 4 * DEG, yaw: 4 * DEG, roll: 4 * DEG, fuel: 1, refuel: 1,
    shield: 900, armour: 900, core: 700,
    gunDmg: 0, gunRate: 0, gunCost: 0, gunRecharge: 0, gunSpread: 0,
    missiles: 0, decoys: 0, points: 2500, capital: true,
    turrets: [
      { at: [0, 18, -50], dir: [0, 0.4, -1], cone: 85 * DEG },
      { at: [0, 18, 50], dir: [0, 0.4, 1], cone: 85 * DEG },
    ],
  },
}

/** Turn rates scale with speed: slow turns tighter, afterburner wide. Multiplier at min, cruise, max, burn. */
export const TURN_AT_SPEED = { min: 1.25, cruise: 1, max: 0.85, burn: 0.55 }
/** Seconds for a turn rate to reach what the stick asks (a little weight in the ship). */
export const TURN_LAG = 0.12

export const SHIELD = {
  /** Seconds after a hit before a shield comes back, and points a second it then comes back by (fraction of full). */
  wait: 3,
  regen: 0.06,
}

export const GUN = {
  speed: 1600,
  life: 1.3,
  /** Turret bolts. */
  turretSpeed: 1500,
  turretLife: 1.1,
  /** Shots carry the shooter's velocity, so a bolt from a fast ship still goes straight. */
  inherit: 1,
  /** An AI fires when its nose is within its own aim error plus this of the lead point. */
  aiCone: 2 * DEG,
  /** The gun lead the player is helped with: bolts bend toward the lead point inside this cone (radians), keys and touch. */
  assistKeys: 2.5 * DEG,
  assistTouch: 6 * DEG,
}

export const MISSILE = {
  /** Image-lock: hold the target within this cone for this long. */
  lockCone: 14 * DEG,
  lockTime: 1.2,
  /** Lock falls off this fast when the target leaves the cone. */
  lockDecay: 2,
  speed: 700,
  turn: 95 * DEG,
  life: 7,
  arm: 0.25,
  dmg: 85,
  /** A seeker launched with no lock just flies straight (a dart). */
  dartDmg: 60,
  cool: 0.8,
  /** Chance a decoy pulls a missile off, if dropped while the missile is still this far out. */
  decoyChance: 0.75,
  decoyRange: 900,
  decoyLife: 3,
  torpedoSpeed: 260,
  torpedoDmg: 600,
}

export const TURRET = {
  rate: 7,
  dmg: 7,
  /** Range the turrets open fire at. */
  range: 1300,
  /** How fast a turret swings (rad/s). */
  slew: 160 * DEG,
}

/** The back seat when it runs on its own: how well the partner shoots and how soon a decoy goes. */
export const PARTNER = {
  rex: { aimError: 0.8 * DEG, react: 0.5, burst: 1.6, rest: 0.5, decoyDelay: 0.9 },
  nova: { aimError: 0.45 * DEG, react: 0.35, burst: 1.2, rest: 0.6, decoyDelay: 0.6 },
}

export const SPACE = {
  /** A fight happens within this of the nav point; past it the AI comes home. */
  arena: 6000,
  /** Autopilot lights when no enemy is within this. */
  autoClear: 4500,
  /** A nav counts as reached within this. */
  navReach: 1500,
  /** Landing: within this of the carrier, below this speed. */
  landRange: 1200,
}

export const SCORE = {
  /** A kill by the turret counts the same; the partner's own kills too. */
  missionWon: 2500,
  /** Per protected ship still alive at the end. */
  saved: 1000,
  /** Taking the Calzone home in one piece. */
  landed: 500,
}
