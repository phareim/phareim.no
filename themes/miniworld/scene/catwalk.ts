/**
 * The catwalk (2026-09-26): Motevisning's stage. A pink runway in a purple
 * hall with spotlights, an audience of blocky shapes, and three animal
 * judges at a table at the end — Frøken Katt, Herr Bjørn, Kanin-Kari
 * (core/contests.ts JUDGES). The runtime walks the active person down the
 * runway (an autopilot, about three seconds), they strike a pose and wave,
 * and the camera watches from the judges' end. The UI shows the stars.
 */
import * as THREE from 'three'
import { Blocks, blocksMesh } from './blocks'
import { SKIES, blockMaterial, glowMaterial } from './look'
import { createWorld, addStatic, box } from './physics'
import type { Body } from './physics'
import { zone } from './place'
import type { PlaceScene, Drive } from './place'
import type { Particles } from './play'
import { SPR } from './play'

const RUN_Z0 = -9, RUN_Z1 = 5, RUN_Y = 0.8

function animal(kind: 'cat' | 'bear' | 'bunny'): Blocks {
  const b = new Blocks()
  const main = kind === 'cat' ? '#ff9f3f' : kind === 'bear' ? '#b07850' : '#f4f0ff'
  const second = kind === 'cat' ? '#fff1b0' : kind === 'bear' ? '#e0b088' : '#ffb0d8'
  b.block(0, 0, 0, 1.0, 1.1, 0.8, main)
  b.block(0, 1.1, 0, 1.1, 0.9, 0.9, main)
  b.block(0, 1.3, -0.46, 0.5, 0.35, 0.08, second)
  // Eyes and nose on the face (facing -z, toward the runway).
  b.box(-0.3, 1.6, -0.47, -0.14, 1.76, -0.44, '#2a2230')
  b.box(0.14, 1.6, -0.47, 0.3, 1.76, -0.44, '#2a2230')
  b.box(-0.07, 1.4, -0.52, 0.07, 1.5, -0.49, kind === 'bear' ? '#2a2230' : '#ff5fa8')
  if (kind === 'cat') {
    b.box(-0.5, 2.0, -0.2, -0.2, 2.35, 0.1, main); b.box(0.2, 2.0, -0.2, 0.5, 2.35, 0.1, main)
    b.box(-0.42, 2.0, -0.21, -0.28, 2.25, -0.18, second); b.box(0.28, 2.0, -0.21, 0.42, 2.25, -0.18, second)
  } else if (kind === 'bear') {
    b.box(-0.6, 1.85, -0.1, -0.3, 2.15, 0.2, main); b.box(0.3, 1.85, -0.1, 0.6, 2.15, 0.2, main)
    // A bow tie: he is a serious judge.
    b.box(-0.3, 1.0, -0.46, 0.3, 1.15, -0.41, '#ff3b5c')
  } else {
    b.box(-0.4, 2.0, -0.1, -0.15, 2.9, 0.1, main); b.box(0.15, 2.0, -0.1, 0.4, 2.9, 0.1, main)
    b.box(-0.34, 2.1, -0.11, -0.21, 2.8, -0.09, second); b.box(0.21, 2.1, -0.11, 0.34, 2.8, -0.09, second)
  }
  return b
}

export interface CatwalkScene extends PlaceScene {
  readonly walked: boolean
}

export function buildCatwalk(particles: Particles): CatwalkScene {
  const group = new THREE.Group()
  group.name = 'catwalk'
  const world = createWorld({ killY: -20 })
  const b = new Blocks()
  const glow = new Blocks()
  // Hall floor, back wall with a curtain, side walls.
  b.box(-14, -1, -14, 14, 0, 14, '#3a2458', { top: '#4a2f6a' })
  addStatic(world, box(-14, -1, -14, 14, 0, 14))
  for (let k = 0; k < 14; k++) b.box(-7 + k, 0, -12.5, -6 + k, 9, -12, k & 1 ? '#c01874' : '#e0288a', { bottom: false })
  b.box(-14, 0, -13, 14, 11, -12.5, '#2a1a4c')
  addStatic(world, box(-14, 0, -13, 14, 11, -12))
  b.box(-14, 0, -12, -13, 9, 14, '#2a1a4c'); b.box(13, 0, -12, 14, 9, 14, '#2a1a4c')
  addStatic(world, box(-14, 0, -12, -13, 9, 14)); addStatic(world, box(13, 0, -12, 14, 9, 14))
  // The runway: pink with a white edge, lights along its sides.
  b.box(-1.8, 0, RUN_Z0 - 2, 1.8, RUN_Y, RUN_Z1 + 1, '#ff8ac8', { top: '#ffd0e4' })
  addStatic(world, box(-1.8, -1, RUN_Z0 - 2, 1.8, RUN_Y, RUN_Z1 + 1))
  for (let z = RUN_Z0 - 1.5; z <= RUN_Z1 + 0.5; z += 1.5) {
    glow.box(-1.95, 0.3, z - 0.15, -1.8, 0.6, z + 0.15, '#fff1b0')
    glow.box(1.8, 0.3, z - 0.15, 1.95, 0.6, z + 0.15, '#fff1b0')
  }
  // Stairs up at the back.
  b.box(-1.2, 0, RUN_Z0 - 3.2, 1.2, 0.4, RUN_Z0 - 2, '#ff8ac8')
  addStatic(world, box(-1.2, -1, RUN_Z0 - 3.2, 1.2, 0.4, RUN_Z0 - 2))
  // A truss of spotlights overhead.
  b.box(-6, 8, -10, 6, 8.3, -9.7, '#5a4a7a')
  b.box(-6, 8, 6, 6, 8.3, 6.3, '#5a4a7a')
  for (const x of [-4.5, -1.5, 1.5, 4.5]) for (const z of [-9.85, 6.15]) glow.box(x - 0.35, 7.3, z - 0.35, x + 0.35, 8, z + 0.35, ['#fff1b0', '#ff8ac8', '#8fd8ff', '#ffd84f'][(x + 4.5) / 3]!)
  // The audience: rows of blocky shapes in the dark on both sides.
  const aud = ['#6a4f9a', '#7a5fb0', '#5a3f8a', '#8a6fc0']
  for (let side = -1; side <= 1; side += 2) for (let row = 0; row < 2; row++) for (let k = 0; k < 7; k++) {
    const x = side * (5 + row * 2.2), z = -8 + k * 2
    // The judges sit on the right near the end: no audience there.
    if (side > 0 && z > -4) continue
    b.block(x, 0, z, 1, 1.6 + row * 0.4, 0.8, aud[(k + row) % aud.length]!)
    b.block(x, 1.6 + row * 0.4, z, 0.7, 0.6, 0.6, aud[(k + row + 1) % aud.length]!)
    addStatic(world, box(x - 0.5, 0, z - 0.4, x + 0.5, 2.6, z + 0.4))
  }
  // Judges' table beside the runway's end (right side), the judges behind it facing the runway.
  const jx = 3.9
  b.box(2.6, 0, -2.8, 3.2, 1.1, 5.2, '#fff8fc', { top: '#ffd84f' })
  addStatic(world, box(2.6, 0, -2.8, 3.2, 1.1, 5.2))
  const tz = RUN_Z1 + 4
  const judges: THREE.Mesh[] = []
  const kinds = ['cat', 'bear', 'bunny'] as const
  kinds.forEach((k, i) => {
    const m = blocksMesh(animal(k), blockMaterial(), { cast: true })!
    m.matrixAutoUpdate = true
    m.position.set(jx, 0.2, -1.5 + i * 2.5)
    group.add(m)
    judges.push(m)
  })

  const mesh = blocksMesh(b, blockMaterial(), { cast: true, receive: true })!
  const glowMesh = blocksMesh(glow, glowMaterial())!
  group.add(mesh, glowMesh)

  // Autopilot: stand, walk to the end, pose, wave.
  let t0 = -1
  let walked = false
  let burst = false
  const endZ = RUN_Z1 - 0.5
  // From the audience's end of the hall, straight down the runway: the model walks toward us.
  const view = { pos: new THREE.Vector3(-1.2, 5.2, tz + 5), look: new THREE.Vector3(0, 2, RUN_Z0 + 5) }

  const self: CatwalkScene = {
    group,
    world,
    zones: [zone('exit', 'Gå ut', 0, RUN_Z0 - 4.2, 3, 2, -1, 4)],
    spawn: { x: 0, y: RUN_Y, z: RUN_Z0 - 1, yaw: 0 },
    sky: SKIES.stage,
    cam: { min: 6, max: 14, dist: 9, pitch: 0.35 },
    view,
    camCollide: false,
    get walked() { return walked },
    autopilot(dt, t, body: Body): Drive | null {
      if (t0 < 0) t0 = t
      const s = t - t0
      if (s < 0.5) return { mx: 0, mz: 0, pose: 'idle', facing: 0 }
      if (!walked && body.z < endZ) {
        return { mx: -body.x * 0.5, mz: 0.55, facing: 0 }
      }
      if (!walked) { walked = true; t0 = t - 0.5 }
      if (!burst) {
        burst = true
        particles.burst(0, RUN_Y + 5, body.z, 40, ['#ff8ac8', '#ffd84f', '#ffffff', '#b89aff'], { speed: 7, size: 0.3, life: 1.8, sprite: SPR.heart, up: 2 })
      }
      const since = s - 0.5
      const pose = since < 1.2 ? 'cheer' : since < 3.2 ? 'wave' : 'dance'
      return { mx: 0, mz: 0, pose, facing: 0 }
    },
    update(dt, t) {
      judges.forEach((j, i) => {
        j.position.y = 0.2 + Math.max(0, Math.sin(t * 5 + i * 1.3)) * (walked ? 0.25 : 0.05)
        j.rotation.y = Math.PI / 2 + Math.sin(t * 1.5 + i) * 0.15
      })
    },
    dispose() {
      mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose()
      glowMesh.geometry.dispose(); (glowMesh.material as THREE.Material).dispose()
      for (const j of judges) { j.geometry.dispose(); (j.material as THREE.Material).dispose() }
    },
  }
  return self
}
