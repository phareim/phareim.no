export interface Platform { x: number; y: number; w: number; h: number }
export interface Hazard { x: number; y: number; w: number; h: number }
export interface Beacon { x: number; y: number; lit: boolean }
export interface World {
  player: { x: number; y: number; vx: number; vy: number; grounded: boolean; facing: number }
  platforms: Platform[]
  hazards: Hazard[]
  beacons: Beacon[]
  width: number
  time: number
  deaths: number
  checkpoint: number
  won: boolean
}
export interface Input { left: boolean; right: boolean; jump: boolean }
