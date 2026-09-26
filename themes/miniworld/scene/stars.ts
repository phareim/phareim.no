/**
 * Stjerneengen (2026-09-26): a meadow with blocky hills, trampolines and a
 * hedge round it. After a 3-2-1 the stars pop up one after another — on
 * the grass, on the hill tops, and high over the trampolines — each with a
 * sparkle and a 'star' sound when you catch it. 45 seconds, then
 * 'stars-end' with the count.
 */
import * as THREE from 'three'
import type { RuntimeEvent } from './contracts'
import { Blocks, blocksMesh, hash2, rng } from './blocks'
import { C, SKIES, blockMaterial } from './look'
import { createWorld, addStatic, box } from './physics'
import type { Body } from './physics'
import { zone } from './place'
import type { PlaceScene } from './place'
import type { Particles } from './play'
import { SPR } from './play'

export const STARS_SECONDS = 45
const HALF = 30
const MAX_LIVE = 6

export interface StarsScene extends PlaceScene {
  readonly ended: boolean
}

function starGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const r = i % 2 ? 0.45 : 1.05
    const x = Math.cos(a) * r, y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
  }
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: false })
  g.translate(0, 0, -0.14)
  return g
}

export function buildStars(particles: Particles, emit: (e: RuntimeEvent) => void): StarsScene {
  const group = new THREE.Group()
  group.name = 'stars'
  const world = createWorld({ killY: -20 })
  const b = new Blocks()
  const R = rng(4545)
  const spots: THREE.Vector3[] = []

  // The meadow: a checker of two greens with flowers, a hedge ring, a moat of sky.
  for (let x = -HALF; x < HALF; x += 2) for (let z = -HALF; z < HALF; z += 2) {
    const c = ((x + z) / 2) & 1 ? C.grass : C.grass2
    b.quad([x, 0, z + 2], [x + 2, 0, z + 2], [x + 2, 0, z], [x, 0, z], [0, 1, 0], hash2(x, z, 1) < 0.05 ? C.grassDark : c)
    if (hash2(x, z, 2) < 0.12) b.block(x + 1, 0, z + 1, 0.3, 0.3, 0.3, ['#ff6fb0', '#ffd84f', '#ffffff', '#b89aff'][Math.floor(hash2(x, z, 3) * 4)]!)
  }
  b.box(-HALF, -3, -HALF, HALF, -0.02, HALF, '#b89a78')
  addStatic(world, box(-HALF, -3, -HALF, HALF, 0, HALF))
  // Hedge wall.
  for (const [x0, z0, x1, z1] of [[-HALF, -HALF, HALF, -HALF + 1.5], [-HALF, HALF - 1.5, HALF, HALF], [-HALF, -HALF, -HALF + 1.5, HALF], [HALF - 1.5, -HALF, HALF, HALF]] as const) {
    b.box(x0, 0, z0, x1, 2.4, z1, '#3fae7a', { top: '#5fcf94' })
    addStatic(world, box(x0, 0, z0, x1, 3.2, z1))
  }
  // Hills: stepped blocks (0.5 steps you can walk up) and taller plateaus.
  const hills: [number, number, number, number][] = [[-14, -12, 10, 4], [14, -14, 8, 5], [-12, 14, 8, 3], [16, 12, 10, 4], [0, -2, 6, 2]]
  for (const [hx, hz, size, steps] of hills) {
    for (let k = 0; k < steps; k++) {
      const s = size - k * 1.6
      if (s < 1.5) break
      const top = (k + 1) * 0.5
      b.box(hx - s / 2, 0, hz - s / 2, hx + s / 2, top, hz + s / 2, k & 1 ? '#6fd494' : '#7fe0a0', { top: k === steps - 1 ? '#9ff0b8' : undefined, bottom: false })
      addStatic(world, box(hx - s / 2, -1, hz - s / 2, hx + s / 2, top, hz + s / 2))
      if (k === steps - 1) spots.push(new THREE.Vector3(hx, top + 1.2, hz))
    }
  }
  // Tall plateaus with trampolines beside them.
  const tall: [number, number, number][] = [[-22, 0, 4.5], [22, -2, 5], [0, 22, 4], [2, -22, 4.5]]
  for (const [px, pz, h] of tall) {
    b.box(px - 2.5, 0, pz - 2.5, px + 2.5, h, pz + 2.5, '#b89a78', { top: C.grass, bottom: false })
    addStatic(world, box(px - 2.5, -1, pz - 2.5, px + 2.5, h, pz + 2.5))
    spots.push(new THREE.Vector3(px, h + 1.2, pz))
    const tx = px + (px === 0 ? 5 : -Math.sign(px) * 5), tz = pz
    b.block(tx, 0, tz, 2.6, 0.35, 2.6, '#4a3a6a')
    b.block(tx, 0.35, tz, 2.2, 0.1, 2.2, '#4fb8ff', { top: '#6fd0ff' })
    const tb = addStatic(world, box(tx - 1.3, 0, tz - 1.3, tx + 1.3, 0.45, tz + 1.3, 'bounce'))
    tb.bounce = 22
    // A star high above the trampoline.
    spots.push(new THREE.Vector3(tx, 5.2, tz))
  }
  // Ground spots on a loose grid, off the hills.
  for (let k = 0; k < 40; k++) {
    const x = (R() - 0.5) * (HALF * 2 - 8), z = (R() - 0.5) * (HALF * 2 - 8)
    let clear = true
    for (const [hx, hz, size] of hills) if (Math.abs(x - hx) < size / 2 + 1 && Math.abs(z - hz) < size / 2 + 1) clear = false
    for (const [px, pz] of tall) if (Math.abs(x - px) < 4 && Math.abs(z - pz) < 4) clear = false
    if (clear) spots.push(new THREE.Vector3(x, 1.2, z))
  }
  // A few trees in the corners, and the door home.
  for (const [x, z] of [[-25, -25], [25, -25], [25, 25], [-25, 25]]) {
    b.block(x, 0, z, 0.8, 2.4, 0.8, C.trunk)
    b.block(x, 2.2, z, 3.2, 2, 3.2, C.leaf, { top: C.leaf2 })
    addStatic(world, box(x - 0.4, 0, z - 0.4, x + 0.4, 4.2, z + 0.4))
  }
  const doorX = 0, doorZ = HALF - 2
  b.block(doorX - 1.3, 0, doorZ, 0.4, 3.2, 0.4, '#7a4fd0')
  b.block(doorX + 1.3, 0, doorZ, 0.4, 3.2, 0.4, '#7a4fd0')
  b.block(doorX, 3.2, doorZ, 3.0, 0.4, 0.4, '#7a4fd0')
  const glow = new Blocks()
  glow.box(doorX - 1.1, 0, doorZ - 0.05, doorX + 1.1, 3.2, doorZ + 0.05, '#bff0ff')

  const mesh = blocksMesh(b, blockMaterial(), { cast: true, receive: true })!
  const glowMesh = blocksMesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true }))!
  group.add(mesh, glowMesh)

  // ------------------------------------------------ stars

  const starGeo = starGeometry()
  const starMat = new THREE.MeshBasicMaterial({ color: '#ffd84f' })
  const stars = new THREE.InstancedMesh(starGeo, starMat, MAX_LIVE)
  stars.frustumCulled = false
  group.add(stars)
  const live = Array.from({ length: MAX_LIVE }, () => ({ on: false, x: 0, y: 0, z: 0, age: 0, life: 0, spot: -1 }))
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const s3 = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  let phase: 'count' | 'run' | 'done' = 'count'
  let clock = 0
  let left = STARS_SECONDS
  let count = 0
  let spawnT = 0
  let hud = ''
  const say = (text: string) => { if (text !== hud) { hud = text; emit({ type: 'hud', text }) } }

  const pop = () => {
    const slot = live.find(s => !s.on)
    if (!slot) return
    let k = -1
    for (let tries = 0; tries < 12; tries++) {
      const c = Math.floor(Math.random() * spots.length)
      if (!live.some(s => s.on && s.spot === c)) { k = c; break }
    }
    if (k < 0) return
    const p = spots[k]!
    slot.on = true; slot.spot = k; slot.x = p.x; slot.y = p.y; slot.z = p.z; slot.age = 0; slot.life = 6 + Math.random() * 2
    particles.burst(p.x, p.y, p.z, 10, ['#ffd84f', '#fff1b0', '#ffffff'], { speed: 4, size: 0.25, life: 0.6, sprite: SPR.sparkle, grav: 0, up: 0 })
  }

  const self: StarsScene = {
    group,
    world,
    zones: [zone('exit', 'Gå ut', doorX, doorZ - 1.2, 3.4, 2.4, -1, 4)],
    spawn: { x: 0, y: 0, z: 12, yaw: Math.PI },
    sky: SKIES.meadow,
    cam: { min: 5, max: 22, dist: 12, pitch: 0.5 },
    camCollide: true,
    get ended() { return phase === 'done' },
    update(dt, t, body: Body) {
      clock += dt
      if (phase === 'count') {
        const n = 3 - Math.floor(clock)
        if (n > 0) say(`${n}`)
        else { phase = 'run'; say('SAMLE STJERNER!'); spawnT = 0; for (let k = 0; k < 3; k++) pop() }
      } else if (phase === 'run') {
        left -= dt
        spawnT -= dt
        let liveN = 0
        for (const s of live) if (s.on) liveN++
        if (spawnT <= 0 || liveN < 2) { pop(); spawnT = 0.9 + Math.random() * 0.8 }
        if (clock > 5) say(`STJERNER: ${count} · ${Math.max(0, Math.ceil(left))} S`)
        if (left <= 0) {
          phase = 'done'
          for (const s of live) s.on = false
          say(`FERDIG! ${count} STJERNER`)
          emit({ type: 'sfx', name: 'finish' })
          particles.burst(body.x, body.y + 3, body.z, 50, ['#ffd84f', '#fff1b0', '#ff8ac8', '#8fd8ff'], { speed: 8, size: 0.3, life: 1.6, sprite: SPR.star, up: 5 })
          emit({ type: 'stars-end', result: { stars: count } })
        }
      }
      // Stars: grow in, spin, bob, blink out at the end of their life.
      const bx = body.x, by = body.y + 1.2, bz = body.z
      for (let i = 0; i < MAX_LIVE; i++) {
        const s = live[i]!
        if (s.on) {
          s.age += dt
          if (s.age > s.life) {
            s.on = false
            particles.burst(s.x, s.y, s.z, 6, ['#fff1b0'], { speed: 2, size: 0.18, life: 0.4, sprite: SPR.sparkle, grav: 0, up: 0 })
          } else {
            const dx = s.x - bx, dy = s.y - by, dz = s.z - bz
            if (dx * dx + dy * dy * 0.6 + dz * dz < 2.2) {
              s.on = false
              count++
              emit({ type: 'sfx', name: 'star' })
              particles.burst(s.x, s.y, s.z, 16, ['#ffd84f', '#fff1b0', '#ffffff', '#ff9f3f'], { speed: 6, size: 0.3, life: 0.7, sprite: SPR.star, grav: 4 })
              say(`STJERNER: ${count} · ${Math.max(0, Math.ceil(left))} S`)
            }
          }
        }
        if (!s.on) { m4.makeScale(0, 0, 0); stars.setMatrixAt(i, m4); continue }
        const grow = Math.min(1, s.age * 4)
        const blink = s.life - s.age < 1.2 && Math.floor(s.age * 8) % 2 === 0 ? 0.7 : 1
        q.setFromAxisAngle(up, t * 2.5 + i)
        v.set(s.x, s.y + Math.sin(t * 3 + i) * 0.15, s.z)
        s3.setScalar(grow * blink)
        m4.compose(v, q, s3)
        stars.setMatrixAt(i, m4)
      }
      stars.instanceMatrix.needsUpdate = true
    },
    dispose() {
      mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose()
      glowMesh.geometry.dispose(); (glowMesh.material as THREE.Material).dispose()
      starGeo.dispose(); starMat.dispose(); stars.dispose()
    },
  }
  return self
}
