/**
 * What every Mini World place (town, house, obby, meadow, catwalk) hands
 * the runtime (2026-09-26): its meshes, its physics world, its zones and
 * where you stand when you arrive.
 */
import type * as THREE from 'three'
import type { ZoneId, AvatarPose } from './contracts'
import type { PhysWorld, Body } from './physics'
import type { SkyLook } from './look'

export interface Zone {
  id: ZoneId
  /** Norwegian word on the action button ("Gå inn", "Handle", "Spill"…). */
  label: string
  minX: number; minY: number; minZ: number
  maxX: number; maxY: number; maxZ: number
  /** Fires by walking in (doors out of contests), not by the action button. */
  auto?: boolean
}

export function zone(id: ZoneId, label: string, cx: number, cz: number, sx: number, sz: number, y0 = -1, y1 = 4, auto = false): Zone {
  return { id, label, minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2, minY: y0, maxY: y1, auto }
}

export function inZone(z: Zone, x: number, y: number, zz: number): boolean {
  return x >= z.minX && x <= z.maxX && zz >= z.minZ && zz <= z.maxZ && y >= z.minY && y <= z.maxY
}

export interface Spot { x: number; y: number; z: number; yaw: number }

/** What an autopilot (the catwalk) wants this frame instead of the player's input. */
export interface Drive { mx: number; mz: number; pose?: AvatarPose; facing?: number }

export interface PlaceScene {
  readonly group: THREE.Group
  world: PhysWorld
  zones: Zone[]
  spawn: Spot
  sky: SkyLook
  /** Camera zoom limits, start distance and pitch. */
  cam?: { min: number; max: number; dist: number; pitch?: number }
  /** A fixed camera view (catwalk), or null to follow the player. */
  view?: { pos: THREE.Vector3; look: THREE.Vector3 } | null
  /** The camera pulls in in front of walls (false in rooms with no ceiling). */
  camCollide?: boolean
  /** Where to put the player after a fall, a kill brick or the sea (null: the place's spawn). */
  respawn?(why: 'fell' | 'killed' | 'water', body: Body): Spot | null
  /** Drive the player (catwalk), or null for the player's own input. */
  autopilot?(dt: number, t: number, body: Body): Drive | null
  /** Per frame, after physics. */
  update(dt: number, t: number, body: Body): void
  dispose(): void
}
