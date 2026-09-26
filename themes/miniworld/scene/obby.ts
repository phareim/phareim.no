/**
 * Obby-himmelen (2026-09-26): the obstacle courses in the sky, drawn from
 * the pure course data in obby-course.ts.
 *
 * Candy blocks over a sea of clouds; red kill bricks that pulse; sliders
 * and lifts; spinning red bars; checkpoint flags that turn green; a golden
 * finish under an arch that says MÅL. The timer starts when you step off
 * the start, the HUD says level, time and checkpoint, a fall or a kill
 * brick puts you back on the last flag, the finish sends 'obby-end'.
 */
import * as THREE from 'three'
import type { ObbyLevel } from '../types'
import type { RuntimeEvent } from './contracts'
import { Blocks, SignAtlas, blocksMesh, rng } from './blocks'
import { SKIES, blockMaterial, glowMaterial, toon } from './look'
import { createWorld, addStatic, addMover, box, mover } from './physics'
import type { Body, Box } from './physics'
import { zone } from './place'
import type { PlaceScene, Spot } from './place'
import { obbyCourse, OBBY_NAMES } from './obby-course'
import type { Plat } from './obby-course'
import type { Particles } from './play'
import { SPR } from './play'

export interface ObbyScene extends PlaceScene {
  readonly finished: boolean
}

function platBlocks(b: Blocks, p: Plat, ox: number, oy: number, oz: number) {
  const x0 = p.x - p.sx / 2 - ox, x1 = p.x + p.sx / 2 - ox, z0 = p.z - p.sz / 2 - oz, z1 = p.z + p.sz / 2 - oz
  const y1 = p.y - oy, y0 = y1 - p.sy
  const top = new THREE.Color(p.color).lerp(new THREE.Color('#ffffff'), 0.35)
  b.box(x0, y0, z0, x1, y1, z1, p.color, { top })
  // A white rim on the top edge makes the edge readable from far off.
  const r = 0.12
  b.box(x0, y1 - 0.02, z0, x1, y1 + 0.03, z0 + r, '#ffffff')
  b.box(x0, y1 - 0.02, z1 - r, x1, y1 + 0.03, z1, '#ffffff')
  b.box(x0, y1 - 0.02, z0, x0 + r, y1 + 0.03, z1, '#ffffff')
  b.box(x1 - r, y1 - 0.02, z0, x1, y1 + 0.03, z1, '#ffffff')
}

export function buildObby(level: ObbyLevel, particles: Particles, emit: (e: RuntimeEvent) => void): ObbyScene {
  const course = obbyCourse(level)
  const group = new THREE.Group()
  group.name = 'obby'
  const world = createWorld({ killY: course.killY })
  const statics = new Blocks()
  const kills = new Blocks()
  const glow = new Blocks()
  const signs = new Blocks(true)
  const atlas = new SignAtlas(256, 128)
  const movers: { mesh: THREE.Mesh; box: Box; p: Plat }[] = []
  const flags: { mat: THREE.MeshToonMaterial; x: number; y: number; z: number }[] = []
  const disposables: { dispose(): void }[] = []

  course.plats.forEach((p, i) => {
    if (p.move) {
      const b = new Blocks()
      platBlocks(b, p, p.x, p.y, p.z)
      const mesh = blocksMesh(b, blockMaterial(), { cast: true, receive: true })!
      mesh.matrixAutoUpdate = true
      group.add(mesh)
      const bx = box(p.x - p.sx / 2, p.y - p.sy, p.z - p.sz / 2, p.x + p.sx / 2, p.y, p.z + p.sz / 2, 'solid', i)
      addMover(world, mover(bx, p.move.ax, p.move.ay, p.move.az, p.move.period, p.move.phase))
      movers.push({ mesh, box: bx, p })
      return
    }
    if (p.kind === 'kill') {
      kills.box(p.x - p.sx / 2, p.y - p.sy, p.z - p.sz / 2, p.x + p.sx / 2, p.y, p.z + p.sz / 2, '#ff3b3b')
      addStatic(world, box(p.x - p.sx / 2, p.y - p.sy, p.z - p.sz / 2, p.x + p.sx / 2, p.y + 0.05, p.z + p.sz / 2, 'kill', i))
      // A solid floor under the strip, so the trench has a bottom you die on, not a hole.
      return
    }
    platBlocks(statics, p, 0, 0, 0)
    const bx = addStatic(world, box(p.x - p.sx / 2, p.y - p.sy, p.z - p.sz / 2, p.x + p.sx / 2, p.y, p.z + p.sz / 2, p.kind === 'bounce' ? 'bounce' : 'solid', i))
    if (p.kind === 'bounce') {
      bx.bounce = p.bounce
      // Springs on the corners.
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) statics.block(p.x + dx! * (p.sx / 2 - 0.25), p.y, p.z + dz! * (p.sz / 2 - 0.25), 0.3, 0.2, 0.3, '#ffd84f')
    }
    if (p.kind === 'check') {
      const fx = p.x + p.sx / 2 - 0.6, fz = p.z - p.sz / 2 + 0.6
      statics.block(fx, p.y, fz, 0.18, 3.2, 0.18, '#5a4a7a')
      const mat = toon('#c8c0e0')
      const fb = new Blocks()
      fb.tri([0, 3.1, 0], [0, 2.3, 0], [1.4, 2.7, 0], '#ffffff')
      fb.tri([0, 2.3, 0], [0, 3.1, 0], [1.4, 2.7, 0], '#ffffff')
      const g = fb.build()
      const flag = new THREE.Mesh(g, mat)
      flag.position.set(fx, p.y, fz)
      group.add(flag)
      flags.push({ mat, x: fx, y: p.y + 2.7, z: fz })
      disposables.push(g, mat)
    }
    if (p.kind === 'finish') {
      // An arch with MÅL on it and a checkered floor stripe.
      const ax = p.x, az = p.z
      statics.block(ax - 3, p.y, az, 0.8, 5, 0.8, '#ffd84f')
      statics.block(ax + 3, p.y, az, 0.8, 5, 0.8, '#ffd84f')
      statics.block(ax, p.y + 5, az, 7.4, 1.2, 0.8, '#ff5fa8')
      addStatic(world, box(ax - 3.4, p.y, az - 0.4, ax - 2.6, p.y + 5, az + 0.4))
      addStatic(world, box(ax + 2.6, p.y, az - 0.4, ax + 3.4, p.y + 5, az + 0.4))
      for (let k = 0; k < 8; k++) statics.box(ax - 4 + k, p.y, az + 1.5, ax - 3 + k, p.y + 0.04, az + 2.5, k & 1 ? '#3a2c4a' : '#ffffff')
      const s = atlas.add(['MÅL'], { bg: '#fff8fc', fg: '#ff5fa8', border: '#ff5fa8', scale: 3, pad: 2 })
      signs.at(ax, 0, az, 0, () => signs.panel(0, p.y + 5.6, 0.42, 1.0 * s.aspect, 1.0, '#ffffff', s.uv))
      signs.at(ax, 0, az, Math.PI, () => signs.panel(0, p.y + 5.6, 0.42, 1.0 * s.aspect, 1.0, '#ffffff', s.uv))
    }
    if (p.kind === 'start') {
      // The door home, on the left edge of the start (out of the camera's way), facing in.
      const dx = p.x - p.sx / 2 + 0.6, dz = p.z + 1.5
      statics.block(dx, p.y, dz - 1.3, 0.4, 3.2, 0.4, '#7a4fd0')
      statics.block(dx, p.y, dz + 1.3, 0.4, 3.2, 0.4, '#7a4fd0')
      statics.block(dx, p.y + 3.2, dz, 0.4, 0.4, 3.0, '#7a4fd0')
      glow.box(dx - 0.05, p.y, dz - 1.1, dx + 0.05, p.y + 3.2, dz + 1.1, '#bff0ff')
      const s = atlas.add(['TIL BYEN'], { bg: '#fff8fc', fg: '#7a4fd0', border: '#7a4fd0', scale: 2, pad: 2 })
      signs.at(dx, 0, dz, Math.PI / 2, () => signs.panel(0, p.y + 3.9, 0.25, 0.6 * s.aspect, 0.6, '#ffffff', s.uv))
    }
  })

  // Spinners: a post and a bar per arm.
  const spinMeshes: THREE.Mesh[] = []
  const barMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b' })
  const postMat = toon('#5a4a7a')
  disposables.push(barMat, postMat)
  for (const s of course.spinners) {
    world.spinners.push({ cx: s.x, cz: s.z, y0: s.y0, y1: s.y1, len: s.len, half: s.half, speed: s.speed, angle: s.angle })
    const g = new THREE.BoxGeometry(s.len * 2, s.y1 - s.y0 - 0.1, s.half * 2)
    const m = new THREE.Mesh(g, barMat)
    m.position.set(s.x, (s.y0 + s.y1) / 2 + 0.05, s.z)
    group.add(m)
    spinMeshes.push(m)
    disposables.push(g)
    statics.block(s.x, s.y0, s.z, 0.6, s.y1 - s.y0 + 0.3, 0.6, '#5a4a7a')
  }

  // A sea of clouds far below, and a few floating islands for depth.
  const clouds = new Blocks()
  const r = rng(level === 'easy' ? 1 : level === 'medium' ? 2 : 3)
  const bb = new THREE.Box3()
  for (const p of course.plats) bb.expandByPoint(new THREE.Vector3(p.x, p.y, p.z))
  const cy = course.killY + 4
  for (let k = 0; k < 90; k++) {
    const x = bb.min.x - 60 + r() * (bb.max.x - bb.min.x + 120), z = bb.min.z - 60 + r() * (bb.max.z - bb.min.z + 120)
    clouds.block(x, cy + r() * 2, z, 10 + r() * 14, 2 + r() * 2, 8 + r() * 12, '#ffffff', { top: '#ffffff' })
  }
  // No depth written: no outline ink across the cloud floor (platforms keep theirs).
  const cloudMesh = new THREE.Mesh(clouds.build(), new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false }))
  cloudMesh.renderOrder = -5
  group.add(cloudMesh)
  for (let k = 0; k < 6; k++) {
    const x = bb.min.x - 30 + r() * (bb.max.x - bb.min.x + 60), z = bb.min.z - 30 + r() * (bb.max.z - bb.min.z + 60)
    const d = Math.hypot(x - (bb.min.x + bb.max.x) / 2, z - (bb.min.z + bb.max.z) / 2)
    if (d < 25) continue
    const y = bb.min.y - 6 + r() * 14
    statics.block(x, y - 3, z, 6, 3, 6, '#b89a78', { top: '#7fe0a0' })
    statics.block(x, y - 5, z, 3.5, 2, 3.5, '#b89a78')
    statics.block(x + 1, y, z, 0.6, 1.8, 0.6, '#a8704a')
    statics.block(x + 1, y + 1.6, z, 2.2, 1.6, 2.2, '#4fc46f', { top: '#7fe07f' })
  }

  const staticMesh = blocksMesh(statics, blockMaterial(), { cast: true, receive: true })!
  const killMat = new THREE.MeshBasicMaterial({ vertexColors: true })
  const killMesh = blocksMesh(kills, killMat)
  const glowMesh = blocksMesh(glow, glowMaterial())
  const signMat = new THREE.MeshBasicMaterial({ map: atlas.texture, alphaTest: 0.5 })
  const signMesh = blocksMesh(signs, signMat)
  for (const m of [staticMesh, killMesh, glowMesh, signMesh]) if (m) group.add(m)
  disposables.push(atlas, killMat, signMat)

  // ------------------------------------------------ run state

  const start = course.plats[0]!
  const spawn: Spot = course.checkpoints[0]!
  const doorX = start.x - start.sx / 2 + 0.6, doorZ = start.z + 1.5
  let cp = 0
  let running = false
  let finished = false
  let time = 0
  let falls = 0
  let hud = ''
  let hudT = 0
  const nChecks = course.checkpoints.length - 1
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const sendHud = (force = false) => {
    const text = finished
      ? `${OBBY_NAMES[level]} · MÅL! · ${mmss(time)}`
      : `${OBBY_NAMES[level]} · ${mmss(time)} · SJEKKPUNKT ${cp}/${nChecks}`
    if (force || text !== hud) { hud = text; emit({ type: 'hud', text }) }
  }

  const self: ObbyScene = {
    group,
    world,
    zones: [zone('exit', 'Gå ut', doorX + 1, doorZ, 2.2, 3.2, start.y - 1, start.y + 4)],
    spawn,
    sky: SKIES.high,
    cam: { min: 5, max: 20, dist: 11, pitch: 0.5 },
    camCollide: true,
    get finished() { return finished },
    respawn(why) {
      if (why !== 'water') falls++
      emit({ type: 'sfx', name: 'respawn' })
      const c = course.checkpoints[cp]!
      return { x: c.x, y: c.y + 0.05, z: c.z, yaw: c.yaw }
    },
    update(dt, t, body: Body) {
      for (const m of movers) m.mesh.position.set(m.box.minX + m.p.sx / 2, m.box.maxY, m.box.minZ + m.p.sz / 2)
      for (let k = 0; k < spinMeshes.length; k++) spinMeshes[k]!.rotation.y = -world.spinners[k]!.angle
      killMat.color.setScalar(0.75 + 0.25 * Math.sin(t * 6))
      const g = body.onGround ? body.ground : null
      const tag = g ? g.tag : -1
      if (!running && !finished && tag > 0) running = true
      if (running && !finished) time += dt
      if (g && tag >= 0) {
        const p = course.plats[tag]
        if (p?.kind === 'check' && (p.check ?? 0) > cp) {
          cp = p.check!
          const f = flags[cp - 1]
          if (f) {
            f.mat.color.set('#4fe07f')
            particles.burst(f.x, f.y, f.z, 18, ['#4fe07f', '#fff8fc', '#ffd84f'], { speed: 5, size: 0.3, life: 0.9, sprite: SPR.sparkle, grav: 4 })
          }
          emit({ type: 'sfx', name: 'checkpoint' })
          sendHud(true)
        } else if (p?.kind === 'finish' && !finished) {
          finished = true
          running = false
          emit({ type: 'sfx', name: 'finish' })
          particles.burst(p.x, p.y + 3, p.z, 60, ['#ff4f6f', '#ffd84f', '#4fb8ff', '#7fe07f', '#ff8ac8', '#b89aff'], { speed: 9, size: 0.3, life: 2, up: 6 })
          sendHud(true)
          emit({ type: 'obby-end', result: { level, seconds: Math.round(time * 10) / 10, falls } })
        }
      }
      hudT -= dt
      if (hudT <= 0) { hudT = 0.25; sendHud() }
    },
    dispose() {
      group.traverse(o => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      staticMesh.material instanceof THREE.Material && staticMesh.material.dispose()
      for (const m of movers) (m.mesh.material as THREE.Material).dispose()
      ;(cloudMesh.material as THREE.Material).dispose()
      glowMesh && (glowMesh.material as THREE.Material).dispose()
      for (const d of disposables) d.dispose()
    },
  }
  sendHud(true)
  return self
}
