/**
 * The lab's grid pages (enemies, capsules, props, fx) and the biome page.
 */
import * as THREE from 'three'
import { eachLight, type ModelLight } from '../models/core'
import { ENEMY_INFO, ENEMY_MODEL_IDS, createEnemyModel, demoEnemyState, type EnemyModel } from '../models/enemies'
import { BIOME_IDS, type BiomeId } from '../pixel'
import { CAPSULE_IDS, CAPSULE_INFO, createCapsule, createRing, drawCapsuleLabel } from '../models/capsules'
import { PROPS, createPropField, geyserJet, type PropField } from '../models/props'
import { createDebris, createChargeOrb, createBombShell, createShockwave, createShieldBubble, createMuzzleFlash, createEngineTrail } from '../models/fx'
import { buildPlayerShip, makeGlowTexture } from '../../ships/three'
import { shipById, STARTER_SHIP } from '../../ships/ships'
import type { Backdrop } from './backdrop'
import type { LabLabel, LabPage, LabParams } from './pages'

type PageFn = (p: LabParams, scene: THREE.Scene, camera: THREE.PerspectiveCamera, backdrop: Backdrop) => LabPage

export interface GridItem {
  obj: THREE.Object3D
  label: string
  /** Scale in the grid (big models shrink to fit their cell). */
  scale?: number
  lights?: ModelLight[]
  /** Extra world-space lights (fx). */
  extraLights?: (add: (x: number, y: number, z: number, r: number, c: string, a: number) => void) => void
  update?(t: number, dt: number): void
  /** Turn on the turntable (default true). */
  spin?: boolean
  /** Height offset inside the cell. */
  dy?: number
}

/**
 * Lay items out in a grid facing the camera. `D` is the distance from the
 * camera; `far` pushes the grid out to game distance.
 */
export function gridPage(title: string, p: LabParams, scene: THREE.Scene, camera: THREE.PerspectiveCamera, backdrop: Backdrop, items: GridItem[], cols: number, cellW: number, cellH: number, biome: BiomeId): LabPage {
  backdrop.setBiome(p.biome && p.biome !== 'all' ? p.biome : biome)
  if (p.only) {
    items = items.filter(it => it.label.includes(p.only))
    cols = Math.min(cols, items.length)
  }
  const rows = Math.ceil(items.length / cols)
  const D = Math.max(p.only ? 9 : 0, (cols * cellW * 1.3) / 1.92) * (p.far ? 2.6 : 1)
  const k = 1
  const cy = 2
  camera.position.set(0, cy + 1.4, 0)
  camera.lookAt(0, cy, -D)
  const spots: THREE.Vector3[] = []
  items.forEach((it, i) => {
    const r = Math.floor(i / cols)
    const inRow = Math.min(cols, items.length - r * cols)
    const c = i % cols
    const x = (c - (inRow - 1) / 2) * cellW * k
    const y = cy + ((rows - 1) / 2 - r) * cellH * k + (it.dy ?? 0)
    const pos = new THREE.Vector3(x, y, -D)
    spots.push(pos)
    it.obj.position.copy(pos)
    it.obj.scale.setScalar(it.scale ?? 1)
    scene.add(it.obj)
  })
  let offset = 0
  return {
    title,
    get offset() { return offset },
    update(t, dt) {
      offset += dt * 12
      for (const it of items) {
        if (it.spin !== false) it.obj.rotation.y = p.spin ? t * 0.7 : p.yaw
        it.update?.(t, dt)
      }
    },
    lights(add) {
      for (const it of items) {
        if (it.lights) eachLight(it.lights, add, it.scale ?? 1)
        it.extraLights?.(add)
      }
    },
    labels() {
      const out: LabLabel[] = []
      if (p.far) return out
      items.forEach((it, i) => out.push({ x: spots[i]!.x, y: spots[i]!.y - cellH * 0.46, z: spots[i]!.z, text: it.label }))
      return out
    },
  }
}

export const enemiesPage: PageFn = (p, scene, camera, backdrop) => {
  const models: EnemyModel[] = ENEMY_MODEL_IDS.map(createEnemyModel)
  const items: GridItem[] = models.map(m => ({
    obj: m.root,
    label: ENEMY_INFO[m.kind].name,
    scale: m.kind === 'carrier' ? 0.42 : m.kind === 'mite' || m.kind === 'missile' ? 1.6 : 1,
    lights: m.lights,
    dy: m.kind === 'turret' ? -0.9 : 0,
    update(t, dt) {
      m.animate(t, dt, demoEnemyState(m.kind, t))
      if (p.flash) m.flash(Math.floor(t * 5) % 10 === 0)
    },
  }))
  return gridPage('ENEMIES', p, scene, camera, backdrop, items, 4, 5.4, 3.7, 'coast')
}


// ---------------------------------------------------------------- capsules

export const capsulesPage: PageFn = (p, scene, camera, backdrop) => {
  const caps = CAPSULE_IDS.map(createCapsule)
  const rings = [createRing('silver'), createRing('gold')]
  const items: GridItem[] = [
    ...caps.map(c => ({ obj: c.root, label: CAPSULE_INFO[c.type].name, lights: c.lights, spin: false, update: (t: number, dt: number) => c.animate(t, dt) })),
    ...rings.map(r => ({ obj: r.root, label: r.type === 'gold' ? 'GOLD RING' : 'SILVER RING', scale: 0.8, spin: false, lights: r.lights, update: (t: number, dt: number) => r.animate(t, dt) })),
  ]
  const page = gridPage('CAPSULES', p, scene, camera, backdrop, items, 4, 5, 4.2, 'coast')
  const v = new THREE.Vector3()
  page.draw = (hud, proj) => {
    if (!p.far) return
    // Far away the sprite is too small to read: the HUD badge takes over.
    for (const c of caps) {
      c.label.visible = false
      c.root.getWorldPosition(v)
      const q = proj(v.x, v.y, v.z)
      if (q) drawCapsuleLabel(hud, q.x, q.y, c.type)
    }
  }
  return page
}

// ---------------------------------------------------------------- props

export const propsPage: PageFn = (p, scene, camera, backdrop) => {
  if (p.biome && p.biome !== 'all') return corridor('PROPS · ' + p.biome.toUpperCase(), p, scene, camera, backdrop, p.biome, false)
  backdrop.setBiome('lake')
  const talls: PropField[] = []
  const floats: PropField[] = []
  const labels: LabLabel[] = []
  camera.position.set(0, 4, 8)
  camera.lookAt(0, 3, -26)
  BIOME_IDS.forEach((id, c) => {
    const x = (c - 2) * 7.2
    const tf = createPropField('tall', 2)
    const ff = createPropField('float', 1)
    tf.setBiome(id)
    ff.setBiome(id)
    scene.add(tf.root, ff.root)
    tf.set(0, x - (PROPS[id].tall.length > 1 ? 1.4 : 0), -3, -26, 2.2, 7, 0.3, 0)
    if (PROPS[id].tall.length > 1) tf.set(1, x + 1.9, -3, -29, 1.6, 5, 0.8, 1)
    ff.set(0, x, 8, -26, 1.5, 0, 0.5, 0)
    tf.commit()
    ff.commit()
    talls.push(tf)
    floats.push(ff)
    labels.push({ x, y: -4.4, z: -26, text: id.toUpperCase() })
  })
  let offset = 0
  return {
    title: 'PROPS',
    get offset() { return offset },
    update(t, dt) {
      offset += dt * 8
      BIOME_IDS.forEach((id, c) => {
        const x = (c - 2) * 7.2
        floats[c]!.set(0, x, 8 + Math.sin(t + c) * 0.3, -26, 1.5, 0, t * 0.6 + c, 0)
        floats[c]!.commit()
        if (id === 'ember') { talls[c]!.set(1, x + 1.9, -3, -29, 1.6, 1 + 9 * geyserJet(t), 0.8, 1); talls[c]!.commit() }
      })
    },
    lights(add) { for (const f of [...talls, ...floats]) f.lights(add) },
    labels() { return labels },
  }
}

// ---------------------------------------------------------------- fx

export const fxPage: PageFn = (p, scene, camera, backdrop) => {
  const glowTex = makeGlowTexture()
  const debris = createDebris(200)
  scene.add(debris.mesh)
  const orb = createChargeOrb()
  const bomb = createBombShell()
  const wave = createShockwave()
  scene.add(wave.root)
  const ship = buildPlayerShip(shipById(STARTER_SHIP)!, glowTex)
  const bubble = createShieldBubble()
  ship.root.add(bubble.root)
  const muzzleShip = buildPlayerShip(shipById(STARTER_SHIP)!, glowTex)
  const flashL = createMuzzleFlash()
  const flashR = createMuzzleFlash()
  flashL.root.position.set(-3.1, 0.05, -1.4)
  flashR.root.position.set(3.1, 0.05, -1.4)
  flashL.root.rotation.y = flashR.root.rotation.y = Math.PI
  muzzleShip.bank.add(flashL.root, flashR.root)
  const trailShip = buildPlayerShip(shipById(STARTER_SHIP)!, glowTex)
  const trail = createEngineTrail()
  scene.add(trail.mesh)
  const debrisSpot = new THREE.Group()
  const waveSpot = new THREE.Group()
  const items: GridItem[] = [
    { obj: debrisSpot, label: 'DEBRIS', spin: false },
    { obj: orb.root, label: 'CHARGE', lights: orb.lights, spin: false, scale: 1.4 },
    { obj: bomb.root, label: 'BOMB', lights: bomb.lights, scale: 1.6 },
    { obj: waveSpot, label: 'SHOCKWAVE', spin: false, extraLights: add => wave.lights(add) },
    { obj: ship.root, label: 'SHIELD', spin: false },
    { obj: muzzleShip.root, label: 'MUZZLE', spin: false },
    { obj: trailShip.root, label: 'TRAIL', spin: false },
  ]
  const page = gridPage('FX', p, scene, camera, backdrop, items, 4, 7, 4.6, 'ember')
  for (const s of [ship, muzzleShip, trailShip]) { s.root.rotation.y = Math.PI + 0.5; s.root.scale.setScalar(0.7) }
  trailShip.root.rotation.y = 0.5
  const trailX = trailShip.root.position.x
  const trailY = trailShip.root.position.y
  let nextBurst = 0
  let nextWave = 0
  let nextShot = 0
  const v = new THREE.Vector3()
  const base = page.update.bind(page)
  const baseLights = page.lights.bind(page)
  page.update = (t, dt) => {
    base(t, dt)
    debrisSpot.getWorldPosition(v)
    if (t >= nextBurst) { debris.spawn(v.x, v.y + 1, v.z, P_CYCLE[Math.floor(t) % P_CYCLE.length]!, 26, 9); nextBurst = t + 1.8 }
    debris.update(dt, v.y - 1.8)
    orb.set(Math.min(1, (t % 2.5) / 1.6), t)
    bomb.animate(t)
    if (t >= nextWave) { waveSpot.getWorldPosition(v); wave.fire(v.x, v.y, v.z, 2.6, 0.9); nextWave = t + 1.8 }
    wave.update(dt)
    bubble.set(1, t)
    if (Math.floor(t * 1.3) % 3 === 0) bubble.hit()
    bubble.update(dt)
    if (t >= nextShot) { flashL.fire(); flashR.fire(); nextShot = t + 0.18 }
    flashL.update(dt)
    flashR.update(dt)
    trailShip.root.position.set(trailX + Math.sin(t * 1.3) * 1.2, trailY + Math.sin(t * 2) * 0.6, trailShip.root.position.z)
    trailShip.root.updateMatrixWorld()
    v.set(0, -0.05, 1.8)
    trailShip.bank.localToWorld(v)
    trail.update(dt, v.x, v.y, v.z, 14)
  }
  page.lights = (add) => {
    baseLights(add)
    debris.lights(add)
    for (const s of [ship, muzzleShip, trailShip]) { s.root.getWorldPosition(v); add(v.x, v.y, v.z, 1.4, '#2ff3ff', 0.4) }
    for (const f of [flashL, flashR]) if (f.root.visible) { f.root.getWorldPosition(v); add(v.x, v.y, v.z, 0.9, '#2ff3ff', 0.8) }
  }
  return page
}

const P_CYCLE = ['#ff2fa0', '#ffd23f', '#2ff3ff', '#ff8a3d']

// ---------------------------------------------------------------- biomes: the corridor

export const biomesPage: PageFn = (p, scene, camera, backdrop) =>
  corridor('BIOME · ' + (p.biome && p.biome !== 'all' ? p.biome : 'coast').toUpperCase(), p, scene, camera, backdrop, p.biome && p.biome !== 'all' ? p.biome : 'coast', true)

/** The game's view down the lane: props streaming past, a few enemies, the ship. */
function corridor(title: string, p: LabParams, scene: THREE.Scene, camera: THREE.PerspectiveCamera, backdrop: Backdrop, biome: BiomeId, withShips: boolean): LabPage {
  backdrop.setBiome(biome)
  camera.position.set(0, 3.8, 11.5)
  camera.lookAt(0, 1, -40)
  const tall = createPropField('tall', 10)
  const float = createPropField('float', 5)
  tall.setBiome(biome)
  float.setBiome(biome)
  scene.add(tall.root, float.root)
  const SPEED = 30
  const tallZ = Array.from({ length: 10 }, (_, i) => -20 - i * 24)
  const floatZ = Array.from({ length: 5 }, (_, i) => -30 - i * 45)
  const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) }
  const extras: GridItem[] = []
  const enemyModels: EnemyModel[] = []
  let ship: ReturnType<typeof buildPlayerShip> | null = null
  let trail: ReturnType<typeof createEngineTrail> | null = null
  const turret = createEnemyModel('turret')
  turret.setBiome?.(biome)
  if (biome !== 'space') scene.add(turret.root)
  if (withShips) {
    for (const kind of ['drone', 'drone', 'drone', 'weaver'] as const) {
      const m = createEnemyModel(kind)
      m.root.rotation.y = 0
      enemyModels.push(m)
      scene.add(m.root)
    }
    ship = buildPlayerShip(shipById(STARTER_SHIP)!, makeGlowTexture())
    scene.add(ship.root)
    trail = createEngineTrail()
    scene.add(trail.mesh)
  }
  let offset = 0
  const v = new THREE.Vector3()
  return {
    title,
    get offset() { return offset },
    update(t, dt) {
      offset += dt * SPEED
      for (let i = 0; i < tallZ.length; i++) {
        tallZ[i]! += dt * SPEED
        if (tallZ[i]! > 14) tallZ[i]! -= 240
        const side = i % 2 ? 1 : -1
        const x = side * (3.5 + rnd(i, 1) * 9)
        const isGeyser = tall.variants[i % tall.variants.length]!.id === 'geyser'
        const h = isGeyser ? 1 + 11 * geyserJet(t, i * 0.37) : 5 + rnd(i, 2) * 10
        tall.set(i, x, -5, tallZ[i]!, 2.2 + rnd(i, 3) * 2, h, rnd(i, 4) * 6)
      }
      for (let i = 0; i < floatZ.length; i++) {
        floatZ[i]! += dt * SPEED
        if (floatZ[i]! > 14) floatZ[i]! -= 225
        float.set(i, (rnd(i, 5) - 0.5) * 18, -1 + rnd(i, 6) * 7, floatZ[i]!, 1 + rnd(i, 7) * 1.2, 0, t * 0.8 + i)
      }
      tall.commit()
      float.commit()
      const tz = ((-60 + t * SPEED) % 200) - 100
      turret.root.position.set(6, -5, tz > 10 ? tz - 200 : tz)
      turret.animate(t, dt)
      enemyModels.forEach((m, i) => {
        const a = t * 0.8 + i * 1.3
        m.root.position.set(Math.sin(a) * 6 + (i - 1.5) * 3, 2.5 + Math.cos(a * 1.3) * 1.5, -34 - i * 3)
        m.animate(t, dt, { bank: -Math.cos(a) * 0.5 })
      })
      if (ship && trail) {
        ship.root.position.set(Math.sin(t * 0.9) * 3, 0.5 + Math.sin(t * 1.4) * 0.6, 0)
        ship.bank.rotation.z = -Math.cos(t * 0.9) * 0.5
        v.set(0, -0.05, 1.8)
        ship.root.updateMatrixWorld()
        ship.bank.localToWorld(v)
        trail.update(dt, v.x, v.y, v.z, SPEED)
      }
    },
    lights(add) {
      tall.lights(add)
      float.lights(add)
      eachLight(turret.lights, add)
      for (const m of enemyModels) eachLight(m.lights, add)
      if (ship) add(ship.root.position.x, ship.root.position.y, 1.3, 2.4, '#2ff3ff', 0.75)
      void extras
    },
    labels() { return [] },
  }
}
