/**
 * Effects: 2 px sparks (one Points cloud), tumbling debris that falls to
 * the ground (models/fx.ts, instanced), expanding rings, the nova
 * shockwaves, and short light flashes for the stage's light map. Pooled;
 * `explode` is the standard enemy death.
 */
import * as THREE from 'three'
import { createDebris, createShockwave, type Debris, type Shockwave } from '../models/fx'
import { P } from '../models/core'
import { GROUND_Y, rand, type Ctx } from './ctx'

export interface Fx {
  sparks(x: number, y: number, z: number, color: string, count: number, speed: number): void
  /** Debris, sparks, a ring and a light flash; `size` 0.5 (mite) … 3 (boss). */
  explode(x: number, y: number, z: number, color: string, size: number): void
  /** An expanding ring; `size` scales its reach (none near the camera, where it would fill the screen). */
  wave(x: number, y: number, z: number, color: string, size?: number): void
  /** A nova-style shockwave growing to `radius`. */
  shock(x: number, y: number, z: number, radius: number, duration?: number): Shockwave | null
  flashLight(x: number, y: number, z: number, r: number, color: string, life: number): void
  update(dt: number): void
  clear(): void
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
}

const MAX_SPARKS = 420
const MAX_WAVES = 6
const MAX_FLASHES = 12

export function createFx(ctx: Ctx): Fx {
  // ---- sparks
  const pGeo = new THREE.BufferGeometry()
  const pPos = new Float32Array(MAX_SPARKS * 3)
  const pCol = new Float32Array(MAX_SPARKS * 3)
  const pVel = new Float32Array(MAX_SPARKS * 3)
  const pLife = new Float32Array(MAX_SPARKS)
  for (let i = 0; i < MAX_SPARKS; i++) pPos[i * 3 + 1] = -9999
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3))
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  pts.frustumCulled = false
  ctx.scene.add(pts)
  let pCursor = 0
  let sparksLive = 0
  const tmpC = new THREE.Color()

  // ---- debris
  const debris: Debris = createDebris(260)
  ctx.scene.add(debris.mesh)

  // ---- rings
  const ringGeo = new THREE.RingGeometry(0.6, 1.0, 24)
  const waves: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; active: boolean; color: string; size: number }[] = []
  for (let i = 0; i < MAX_WAVES; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: P.cyan, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const m = new THREE.Mesh(ringGeo, mat)
    m.visible = false
    ctx.scene.add(m)
    waves.push({ mesh: m, mat, t: 0, active: false, color: P.cyan, size: 1 })
  }

  // ---- shockwaves
  const shocks: Shockwave[] = [createShockwave(), createShockwave()]
  for (const s of shocks) ctx.scene.add(s.root)

  // ---- light flashes
  const flashes: { x: number; y: number; z: number; r: number; color: string; life: number; max: number }[] = []
  for (let i = 0; i < MAX_FLASHES; i++) flashes.push({ x: 0, y: 0, z: 0, r: 0, color: '#fff', life: 0, max: 1 })
  let flashCursor = 0

  function sparks(x: number, y: number, z: number, color: string, count: number, speed: number) {
    tmpC.set(color)
    for (let k = 0; k < count; k++) {
      const i = pCursor
      pCursor = (pCursor + 1) % MAX_SPARKS
      pPos[i * 3] = x
      pPos[i * 3 + 1] = y
      pPos[i * 3 + 2] = z
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(rand(-1, 1))
      const sp = speed * rand(0.3, 1)
      pVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp
      pVel[i * 3 + 1] = Math.cos(ph) * sp
      pVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp
      pLife[i] = rand(0.4, 0.9)
      pCol[i * 3] = tmpC.r
      pCol[i * 3 + 1] = tmpC.g
      pCol[i * 3 + 2] = tmpC.b
    }
    sparksLive = MAX_SPARKS
    pGeo.attributes.color!.needsUpdate = true
  }

  function wave(x: number, y: number, z: number, color: string, size = 1) {
    if (z > -10) return
    let w = waves[0]!
    for (const v of waves) { if (!v.active) { w = v; break } if (v.t > w.t) w = v }
    w.active = true
    w.t = 0
    w.mat.color.set(color)
    w.color = color
    w.size = size
    w.mesh.position.set(x, y, z)
    w.mesh.visible = true
  }

  function flashLight(x: number, y: number, z: number, r: number, color: string, life: number) {
    const f = flashes[flashCursor]!
    flashCursor = (flashCursor + 1) % MAX_FLASHES
    f.x = x; f.y = y; f.z = z; f.r = r; f.color = color; f.life = life; f.max = life
  }

  return {
    sparks,
    wave,
    flashLight,
    explode(x, y, z, color, size) {
      const n = Math.round(6 + size * 8)
      debris.spawn(x, y, z, color, Math.min(40, n), 8 + size * 4, 0.25 + size * 0.12)
      sparks(x, y, z, P.gold, Math.round(10 + size * 10), 10 + size * 3)
      sparks(x, y, z, color, Math.round(6 + size * 6), 7 + size * 2)
      wave(x, y, z, color)
      flashLight(x, y, z, 2.5 + size * 2, color, 0.35 + size * 0.1)
    },
    shock(x, y, z, radius, duration = 0.7) {
      const s = shocks[0]!.active ? shocks[1]! : shocks[0]!
      s.fire(x, y, z, radius, duration)
      return s
    },
    update(dt) {
      if (sparksLive > 0) {
        const vz = ctx.worldSpeed * 0.5
        for (let i = 0; i < MAX_SPARKS; i++) {
          if (pLife[i]! <= 0) continue
          pLife[i]! -= dt
          if (pLife[i]! <= 0) { pPos[i * 3 + 1] = -9999; continue }
          pPos[i * 3]! += pVel[i * 3]! * dt
          pPos[i * 3 + 1]! += pVel[i * 3 + 1]! * dt
          pPos[i * 3 + 2]! += (pVel[i * 3 + 2]! + vz) * dt
        }
        pGeo.attributes.position!.needsUpdate = true
      }
      debris.update(dt, ctx.env.biome === 'space' ? -400 : GROUND_Y, ctx.worldSpeed * 0.8)
      for (const w of waves) {
        if (!w.active) continue
        w.t += dt * 2.2
        if (w.t >= 1) { w.active = false; w.mesh.visible = false; continue }
        const s = 1 + w.t * 6 * w.size
        w.mesh.scale.set(s, s, s)
        w.mat.opacity = 0.7 * (1 - w.t)
        w.mesh.position.z += ctx.worldSpeed * 0.5 * dt
      }
      for (const s of shocks) s.update(dt)
      for (const f of flashes) if (f.life > 0) { f.life -= dt; f.z += ctx.worldSpeed * 0.5 * dt }
    },
    clear() {
      pLife.fill(0)
      for (let i = 0; i < MAX_SPARKS; i++) pPos[i * 3 + 1] = -9999
      pGeo.attributes.position!.needsUpdate = true
      debris.clear()
      for (const w of waves) { w.active = false; w.mesh.visible = false }
      for (const f of flashes) f.life = 0
    },
    lights(add) {
      for (const w of waves) if (w.active) add(w.mesh.position.x, w.mesh.position.y, w.mesh.position.z, 3 * w.mesh.scale.x, w.color, w.mat.opacity * 0.8)
      for (const f of flashes) if (f.life > 0) add(f.x, f.y, f.z, f.r, f.color, 0.9 * (f.life / f.max))
      for (const s of shocks) s.lights(add)
      debris.lights(add, 6)
    },
  }
}
