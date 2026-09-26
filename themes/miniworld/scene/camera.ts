/**
 * Mini World's camera (2026-09-26): a third-person orbit that follows the
 * player. Drag turns it, pinch and wheel zoom, and it pulls in when a wall
 * stands between it and the player (fast in, slow back out). A fixed mode
 * holds a framed view (house edit, the catwalk) and eases between the two.
 */
import * as THREE from 'three'
import type { PhysWorld } from './physics'
import { raycast } from './physics'

export interface OrbitCamera {
  readonly camera: THREE.PerspectiveCamera
  yaw: number
  pitch: number
  dist: number
  /** Camera-relative movement: forward (away from the camera) and right, in xz. */
  forward(out: { x: number; z: number }): void
  right(out: { x: number; z: number }): void
  /** Snap behind a facing (radians, 0 = +z) with no easing. */
  snap(tx: number, ty: number, tz: number, yaw: number): void
  /** Orbit input (radians and zoom factor), from InputState. */
  turn(dYaw: number, dPitch: number, zoom: number): void
  /** Hold a fixed view (or null to follow again). */
  fix(view: { pos: THREE.Vector3; look: THREE.Vector3 } | null): void
  update(dt: number, tx: number, ty: number, tz: number, world: PhysWorld | null, opts: { moving: boolean; facing: number; reducedMotion: boolean }): void
  setAspect(a: number): void
  /** Limits for the current place. */
  setRange(min: number, max: number, dist?: number): void
  /** A small dip on a hard landing (skipped with reduced motion). */
  bump(amount: number): void
}

export function createOrbitCamera(): OrbitCamera {
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 400)
  const target = new THREE.Vector3()
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  const fixPos = new THREE.Vector3()
  const fixLook = new THREE.Vector3()
  let fixed = false
  let blend = 0
  let actual = 11
  let minD = 4, maxD = 22
  let lastTurn = 0
  let dip = 0
  let clock = 0

  const self: OrbitCamera = {
    camera,
    yaw: 0,
    pitch: 0.42,
    dist: 11,
    forward(out) { out.x = -Math.sin(self.yaw); out.z = -Math.cos(self.yaw) },
    right(out) { out.x = Math.cos(self.yaw); out.z = -Math.sin(self.yaw) },
    snap(tx, ty, tz, yaw) {
      target.set(tx, ty, tz)
      self.yaw = yaw + Math.PI
      actual = self.dist
      blend = fixed ? 1 : 0
      place(0)
    },
    turn(dYaw, dPitch, zoom) {
      if (dYaw || dPitch) lastTurn = clock
      self.yaw += dYaw
      self.pitch = Math.max(-0.15, Math.min(1.25, self.pitch + dPitch))
      if (zoom !== 1) self.dist = Math.max(minD, Math.min(maxD, self.dist * zoom))
    },
    fix(view) {
      if (view) { fixed = true; fixPos.copy(view.pos); fixLook.copy(view.look) } else fixed = false
    },
    setAspect(a) { camera.aspect = a; camera.updateProjectionMatrix() },
    setRange(min, max, dist) {
      minD = min; maxD = max
      if (dist !== undefined) self.dist = dist
      self.dist = Math.max(minD, Math.min(maxD, self.dist))
    },
    bump(amount) { dip = Math.min(0.5, dip + amount) },
    update(dt, tx, ty, tz, world, opts) {
      clock += dt
      // Follow: tight in xz, a little softer in y (jumps do not jerk the view).
      const kx = 1 - Math.exp(-14 * dt), ky = 1 - Math.exp(-7 * dt)
      target.x += (tx - target.x) * kx
      target.z += (tz - target.z) * kx
      target.y += (ty - target.y) * ky
      // A gentle swing behind the player while they walk, unless the view was just turned.
      if (opts.moving && clock - lastTurn > 1.6) {
        const want = opts.facing + Math.PI
        let d = want - self.yaw
        d = Math.atan2(Math.sin(d), Math.cos(d))
        if (Math.abs(d) < 2.2) self.yaw += d * (1 - Math.exp(-0.7 * dt))
      }
      // Walls: pull in fast, ease out slowly.
      let want = self.dist
      if (world) {
        dir.set(Math.sin(self.yaw) * Math.cos(self.pitch), Math.sin(self.pitch), Math.cos(self.yaw) * Math.cos(self.pitch))
        const hit = raycast(world, target.x, target.y, target.z, dir.x, dir.y, dir.z, self.dist + 0.5, 0.25)
        want = Math.max(1.2, Math.min(self.dist, hit - 0.4))
      }
      actual = want < actual ? want : actual + (want - actual) * (1 - Math.exp(-3 * dt))
      if (opts.reducedMotion) dip = 0
      else dip *= Math.exp(-10 * dt)
      blend += ((fixed ? 1 : 0) - blend) * (1 - Math.exp(-5 * dt))
      if (Math.abs(blend - (fixed ? 1 : 0)) < 0.002) blend = fixed ? 1 : 0
      place(dip)
    },
  }

  const dir = new THREE.Vector3()
  function place(d: number) {
    const cp = Math.cos(self.pitch)
    pos.set(target.x + Math.sin(self.yaw) * cp * actual, target.y + Math.sin(self.pitch) * actual - d, target.z + Math.cos(self.yaw) * cp * actual)
    look.set(target.x, target.y - d * 0.5, target.z)
    if (blend > 0) {
      pos.lerp(fixPos, blend)
      look.lerp(fixLook, blend)
    }
    camera.position.copy(pos)
    camera.lookAt(look)
  }

  return self
}
