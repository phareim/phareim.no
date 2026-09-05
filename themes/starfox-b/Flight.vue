<template>
  <canvas ref="canvas" class="sfxb-canvas"></canvas>
  <div ref="flashEl" class="sfxb-flash"></div>
</template>

<script setup lang="ts">
/**
 * Star Fox — NEON VECTOR variant (starfox-b).
 *
 * An on-rails 3D "corridor" shooter in three.js, behind the landing overlay.
 * Same contract as rtype/Shooter.vue: full-viewport canvas, attract mode
 * (autopilot) until Enter/tap, events up to Landing.vue for the HUD:
 *   score(n)  distance(km)  lives(n)  started  restart
 *   over      — the moment the run ends (unlocks theme navigation)
 *   death     — after the explosion (shows the GAME OVER card)
 *
 * The look: black / deep navy void, everything as stroked outline geometry
 * (EdgesGeometry + LineSegments) in electric cyan for the player/world and
 * hot orange for enemies, one scrolling Tron grid floor, a Points starfield,
 * fog fading the lines into black. No textures, no shadows, no
 * post-processing — the "glow" is a second additive line pass on the hero
 * shapes. All pools are fixed-size; nothing allocates per frame.
 */
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

const emit = defineEmits<{
  score: [n: number]
  distance: [km: number]
  lives: [n: number]
  started: []
  restart: []
  over: []
  death: []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const flashEl = ref<HTMLDivElement | null>(null)

// ---------------------------------------------------------------- palette

const BG = 0x05060c
const CYAN = 0x19f0ff
const CYAN_DIM = 0x0a3a44
const ORANGE = 0xff7a1a
const ICE = 0xe0fbff

// ---------------------------------------------------------------- tuning

const SHIP_X = 7        // half-width of the flight box
const SHIP_Y_MIN = -3.4
const SHIP_Y_MAX = 4.4
const FIRE_INTERVAL = 1 / 6
const ROLL_TIME = 0.5
const MULT_STEPS = [1, 2, 3, 4, 6, 8]
const SPAWN_Z = -150
const KILL_Z = 8        // recycle once behind the camera
const MAX_SHOTS = 24
const MAX_ESHOTS = 40
const MAX_ENEMIES = 14
const MAX_OBSTACLES = 16
const MAX_RINGS = 10
const MAX_DEBRIS = 240
const STAR_COUNT = 340

// ---------------------------------------------------------------- state

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let raf = 0
let last = 0
let lastKm = 0
let portrait = false
let viewW = 1
let viewH = 1

let gameStarted = false
let gameOver = false
let score = 0
let distance = 0
let lives = 3
let worldSpeed = 22
let elapsed = 0

let shipX = 0
let shipY = -2.4
let targetX = 0
let targetY = -2.4
let bank = 0
let pitch = 0

let fireCd = 0
let spaceHeld = false
let rollT = -1            // <0 idle, else 0..1 progress through the barrel roll
let invulnT = 0
let shakeT = 0
let deathT = 0
let flashA = 0

let killCount = 0
let streakT = 0
let spawnT = 0.3
let ringT = 2.5
let demoFireT = 0.5

const keys = new Set<string>()
const lastArrowTap: Record<string, number> = {}

// ---------------------------------------------------------------- three.js objects

let shipGroup: THREE.Group
let shipLines: LineSegments2
let shipGlow: LineSegments2
let grid: THREE.GridHelper
let stars: THREE.Points
let starPos: Float32Array
let starDepth: Float32Array
let debris: THREE.Points
let debrisPos: Float32Array
let debrisVel: Float32Array
let debrisLife: Float32Array
let debrisMax = 0

// shared geometries / materials (one instance each, disposed on unmount)
let geoLaser: THREE.BoxGeometry
let geoEShot: THREE.SphereGeometry
let geoEnemy: THREE.EdgesGeometry
let geoGate: THREE.EdgesGeometry
let geoPyramid: THREE.EdgesGeometry
let geoPillar: THREE.EdgesGeometry
let geoRing: LineSegmentsGeometry
let matLaser: THREE.MeshBasicMaterial
let matEShot: THREE.MeshBasicMaterial
let matEnemy: THREE.LineBasicMaterial
let matGate: THREE.LineBasicMaterial
let matPyramid: THREE.LineBasicMaterial
let matPillar: THREE.LineBasicMaterial
let matRing: LineMaterial
let matRingGlow: LineMaterial
let matShip: LineMaterial
let matShipGlow: LineMaterial

interface Shot { m: THREE.Mesh; active: boolean; vx: number; vy: number; vz: number; life: number }
interface EShot { m: THREE.Mesh; active: boolean; vx: number; vy: number; vz: number; life: number }
interface Enemy { l: THREE.LineSegments; active: boolean; fireT: number; canShoot: boolean; wob: number; wobSpeed: number; hx: number; hy: number }
interface Obstacle { l: THREE.LineSegments; active: boolean; kind: number; r: number }
interface Ring { l: LineSegments2; active: boolean; flash: number }

const shots: Shot[] = []
const eshots: EShot[] = []
const enemies: Enemy[] = []
const obstacles: Obstacle[] = []
const rings: Ring[] = []

// scratch vectors — reused every frame, never allocated in the loop
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()

// ---------------------------------------------------------------- helpers

// Half-width of the flight box, orientation-aware: the portrait camera
// (z=13, fov 72) only spans ~5.3 world units each way at the ship plane.
function shipXMax(): number {
  return portrait ? 3.6 : SHIP_X
}

function lineMat(color: number, opacity: number, additive: boolean): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    fog: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  })
}

/** Build the Arwing as an explicit stroked outline: fuselage, twin wings
 *  with tip guns, tail fin, cockpit. Nose points down -Z.
 *  Returns flat segment positions for LineSegmentsGeometry (fat lines). */
function buildArwingSegments(): number[] {
  const s: number[] = []
  const seg = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    s.push(x1, y1, z1, x2, y2, z2)
  }
  // fuselage spine + nose
  seg(0, 0.1, -1.9, 0, 0.1, 0.9)
  seg(0, 0.1, -1.9, -0.28, 0.18, -0.9)
  seg(0, 0.1, -1.9, 0.28, 0.18, -0.9)
  seg(-0.28, 0.18, -0.9, 0.28, 0.18, -0.9)
  seg(-0.28, 0.18, -0.9, -0.3, 0.1, 0.9)
  seg(0.28, 0.18, -0.9, 0.3, 0.1, 0.9)
  seg(-0.3, 0.1, 0.9, 0.3, 0.1, 0.9)
  // cockpit hump
  seg(-0.16, 0.2, -0.5, 0.16, 0.2, -0.5)
  seg(-0.16, 0.2, -0.5, 0, 0.48, 0.1)
  seg(0.16, 0.2, -0.5, 0, 0.48, 0.1)
  seg(0, 0.48, 0.1, -0.14, 0.22, 0.45)
  seg(0, 0.48, 0.1, 0.14, 0.22, 0.45)
  // wings (swept) with tip laser guns
  seg(-0.25, 0.05, 0.2, -2.1, 0.0, 1.05)
  seg(0.25, 0.05, 0.2, 2.1, 0.0, 1.05)
  seg(-0.25, 0.05, 0.75, -2.1, 0.0, 1.05)
  seg(0.25, 0.05, 0.75, 2.1, 0.0, 1.05)
  seg(-2.1, -0.12, 0.55, -2.1, -0.12, 1.35)
  seg(2.1, -0.12, 0.55, 2.1, -0.12, 1.35)
  seg(-2.1, -0.12, 0.55, -2.1, 0.12, 0.55)
  seg(2.1, -0.12, 0.55, 2.1, 0.12, 0.55)
  seg(-2.1, 0.12, 0.55, -2.1, 0.12, 1.35)
  seg(2.1, 0.12, 0.55, 2.1, 0.12, 1.35)
  seg(-2.1, -0.12, 1.35, -2.1, 0.12, 1.35)
  seg(2.1, -0.12, 1.35, 2.1, 0.12, 1.35)
  // gun barrels forward from the tips
  seg(-2.1, 0, 0.55, -2.1, 0, -0.5)
  seg(2.1, 0, 0.55, 2.1, 0, -0.5)
  // tail fin + tailplane
  seg(0, 0.12, 0.9, 0, 0.85, 1.25)
  seg(0, 0.85, 1.25, 0, 0.3, 1.3)
  seg(-0.7, 0.12, 1.05, 0.7, 0.12, 1.05)
  return s
}

function buildScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.Fog(BG, 70, 175)

  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400)
  camera.position.set(0, 2.4, 9.5)
  camera.lookAt(0, -0.4, -30)

  // ---- shared assets
  geoLaser = new THREE.BoxGeometry(0.1, 0.1, 1.5)
  geoEShot = new THREE.SphereGeometry(0.24, 6, 5)
  geoEnemy = new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.15))
  geoGate = new THREE.EdgesGeometry(new THREE.TorusGeometry(2.4, 0.14, 4, 4))
  geoPyramid = new THREE.EdgesGeometry(new THREE.ConeGeometry(1.7, 3.4, 4))
  geoPillar = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.6, 7, 1.6))
  {
    const ringEdges = new THREE.EdgesGeometry(new THREE.TorusGeometry(2.0, 0.1, 6, 36))
    geoRing = new LineSegmentsGeometry()
    geoRing.setPositions(ringEdges.getAttribute('position').array as Float32Array)
    ringEdges.dispose()
  }

  matLaser = new THREE.MeshBasicMaterial({ color: CYAN, fog: true })
  matEShot = new THREE.MeshBasicMaterial({ color: ORANGE, fog: true })
  matEnemy = lineMat(ORANGE, 0.95, true)
  matGate = lineMat(CYAN, 0.9, true)
  matPyramid = lineMat(CYAN, 0.9, true)
  matPillar = lineMat(0x0f8fa6, 0.9, true)
  matRing = new LineMaterial({ color: CYAN, linewidth: 2, transparent: true, fog: true, depthWrite: false })
  matRingGlow = new LineMaterial({ color: CYAN, linewidth: 5, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })
  matShip = new LineMaterial({ color: CYAN, linewidth: 2, transparent: true, fog: true, depthWrite: false })
  matShipGlow = new LineMaterial({ color: CYAN, linewidth: 7, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })

  // ---- the Arwing (fat lines: 2px core + 7px additive glow)
  shipGroup = new THREE.Group()
  const arwing = new LineSegmentsGeometry()
  arwing.setPositions(buildArwingSegments())
  shipLines = new LineSegments2(arwing, matShip)
  shipGlow = new LineSegments2(arwing, matShipGlow)
  shipLines.frustumCulled = false
  shipGlow.frustumCulled = false
  shipGroup.add(shipLines)
  shipGroup.add(shipGlow)
  shipGroup.position.set(0, -2.4, 0)
  scene.add(shipGroup)

  // ---- Tron grid floor
  grid = new THREE.GridHelper(400, 80, 0x19f0ff, 0x0f8fa6)
  const gridMat = grid.material as THREE.LineBasicMaterial
  gridMat.transparent = true
  gridMat.opacity = 0.85
  gridMat.blending = THREE.AdditiveBlending
  gridMat.depthWrite = false
  grid.position.y = -5.2
  scene.add(grid)

  // ---- starfield (one Points draw call, 3 parallax depths via per-star factor)
  starPos = new Float32Array(STAR_COUNT * 3)
  starDepth = new Float32Array(STAR_COUNT)
  for (let i = 0; i < STAR_COUNT; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 220
    starPos[i * 3 + 1] = Math.random() * 90 - 20
    starPos[i * 3 + 2] = -Math.random() * 220
    starDepth[i] = 0.25 + Math.random() * 0.75
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const starMat = new THREE.PointsMaterial({
    color: 0x9beeff, size: 0.55, sizeAttenuation: true,
    transparent: true, opacity: 0.85, fog: true, depthWrite: false,
  })
  stars = new THREE.Points(starGeo, starMat)
  scene.add(stars)

  // ---- debris (one Points draw call, fixed pool, vertex colours)
  debrisPos = new Float32Array(MAX_DEBRIS * 3)
  debrisVel = new Float32Array(MAX_DEBRIS * 3)
  debrisLife = new Float32Array(MAX_DEBRIS)
  const debrisCol = new Float32Array(MAX_DEBRIS * 3)
  for (let i = 0; i < MAX_DEBRIS; i++) {
    debrisPos[i * 3 + 2] = 9999
    debrisCol[i * 3] = 0.1
    debrisCol[i * 3 + 1] = 0.94
    debrisCol[i * 3 + 2] = 1
  }
  const debrisGeo = new THREE.BufferGeometry()
  debrisGeo.setAttribute('position', new THREE.BufferAttribute(debrisPos, 3))
  debrisGeo.setAttribute('color', new THREE.BufferAttribute(debrisCol, 3))
  const debrisMat = new THREE.PointsMaterial({
    size: 0.5, vertexColors: true, transparent: true, opacity: 0.95,
    fog: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  debris = new THREE.Points(debrisGeo, debrisMat)
  debris.frustumCulled = false
  scene.add(debris)

  // ---- pools
  for (let i = 0; i < MAX_SHOTS; i++) {
    const m = new THREE.Mesh(geoLaser, matLaser)
    m.visible = false
    scene.add(m)
    shots.push({ m, active: false, vx: 0, vy: 0, vz: 0, life: 0 })
  }
  for (let i = 0; i < MAX_ESHOTS; i++) {
    const m = new THREE.Mesh(geoEShot, matEShot)
    m.visible = false
    scene.add(m)
    eshots.push({ m, active: false, vx: 0, vy: 0, vz: 0, life: 0 })
  }
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const l = new THREE.LineSegments(geoEnemy, matEnemy)
    l.visible = false
    scene.add(l)
    enemies.push({ l, active: false, fireT: 0, canShoot: false, wob: Math.random() * 6.28, wobSpeed: 1 + Math.random() * 2, hx: 0, hy: 0 })
  }
  for (let i = 0; i < MAX_OBSTACLES; i++) {
    const l = new THREE.LineSegments(geoPyramid, matPyramid)
    l.visible = false
    scene.add(l)
    obstacles.push({ l, active: false, kind: 0, r: 1.7 })
  }
  for (let i = 0; i < MAX_RINGS; i++) {
    const l = new LineSegments2(geoRing, matRing)
    const g = new LineSegments2(geoRing, matRingGlow)
    g.frustumCulled = false
    l.frustumCulled = false
    l.visible = false
    l.add(g) // glow rides the core's transform
    scene.add(l)
    rings.push({ l, active: false, flash: 0 })
  }
}

// ---------------------------------------------------------------- spawning

function fireTwin() {
  let n = 0
  for (const s of shots) {
    if (s.active) continue
    s.active = true
    s.m.visible = true
    const side = n === 0 ? -2.1 : 2.1
    s.m.position.set(shipX + side * Math.cos(bank), shipY + side * Math.sin(bank), -1.2)
    s.vx = 0
    s.vy = 0
    s.vz = -170
    s.life = 1.25
    if (++n === 2) break
  }
  fireCd = FIRE_INTERVAL
}

function spawnEnemy(x: number, y: number, z: number, canShoot: boolean) {
  for (const e of enemies) {
    if (e.active) continue
    e.active = true
    e.l.visible = true
    e.l.position.set(x, y, z)
    e.canShoot = canShoot
    e.fireT = 1.2 + Math.random() * 1.6
    e.hx = 0
    e.hy = 0
    return
  }
}

function spawnFormation() {
  const cx = (Math.random() - 0.5) * 16 * (portrait ? 0.6 : 1)
  const cy = Math.random() * 5 - 2
  const n = 2 + Math.floor(Math.random() * 3)
  const sharp = gameStarted && Math.random() < 0.6
  for (let i = 0; i < n; i++) {
    spawnEnemy(cx + (i - (n - 1) / 2) * 3.2, cy + (i % 2) * 1.6, SPAWN_Z - i * 7, sharp && i === 0)
  }
}

function spawnObstacle() {
  for (const o of obstacles) {
    if (o.active) continue
    o.active = true
    o.l.visible = true
    const kind = Math.floor(Math.random() * 3)
    o.kind = kind
    if (kind === 0) {
      // gate: fly through the diamond hole
      o.l.geometry = geoGate
      o.l.material = matGate
      o.l.position.set(
        (Math.random() - 0.5) * 14 * (portrait ? 0.6 : 1),
        gameStarted ? Math.random() * 5 - 2 : -2.6 + Math.random() * 1.0,
        SPAWN_Z,
      )
      o.l.rotation.set(0, 0, 0)
      o.r = 2.4
    } else if (kind === 1) {
      // pyramid: solid, dodge it
      o.l.geometry = geoPyramid
      o.l.material = matPyramid
      o.l.position.set(
        (Math.random() - 0.5) * 15 * (portrait ? 0.6 : 1),
        gameStarted ? Math.random() * 4 - 2.4 : -2.6 + Math.random() * 1.0,
        SPAWN_Z,
      )
      o.l.rotation.set(Math.PI, Math.random() * 3, 0)
      o.r = 1.7
    } else {
      // pillar: tall slab from floor or ceiling
      o.l.geometry = geoPillar
      o.l.material = matPillar
      const top = Math.random() < 0.5
      o.l.position.set((Math.random() - 0.5) * 15 * (portrait ? 0.6 : 1), top ? 5.6 : -5.6, SPAWN_Z)
      o.l.rotation.set(0, 0, 0)
      o.r = 1.5
    }
    return
  }
}

function spawnRing() {
  for (const r of rings) {
    if (r.active) continue
    r.active = true
    r.flash = 0
    r.l.visible = true
    r.l.scale.setScalar(1)
    // attract mode keeps rings low/central so the card stays readable
    const y = gameStarted ? Math.random() * 6 - 2.6 : Math.random() * 1.4 - 3.4
    r.l.position.set((Math.random() - 0.5) * 13 * (portrait ? 0.6 : 1), y, SPAWN_Z)
    return
  }
}

function spawnEShot(x: number, y: number, z: number) {
  for (const s of eshots) {
    if (s.active) continue
    s.active = true
    s.m.visible = true
    s.m.position.set(x, y, z)
    tmpA.set(shipX - x, shipY - y, 6 - z).normalize().multiplyScalar(52)
    s.vx = tmpA.x
    s.vy = tmpA.y
    s.vz = tmpA.z
    s.life = 4
    return
  }
}

function burst(x: number, y: number, z: number, count: number, orange: boolean) {
  const col = debris.geometry.getAttribute('color') as THREE.BufferAttribute
  for (let k = 0; k < count; k++) {
    const i = debrisMax
    debrisMax = (debrisMax + 1) % MAX_DEBRIS
    debrisPos[i * 3] = x
    debrisPos[i * 3 + 1] = y
    debrisPos[i * 3 + 2] = z
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(2 * Math.random() - 1)
    const sp = 6 + Math.random() * 22
    debrisVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp
    debrisVel[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * sp
    debrisVel[i * 3 + 2] = Math.cos(ph) * sp + worldSpeed * 0.4
    debrisLife[i] = 0.5 + Math.random() * 0.7
    if (orange) col.setXYZ(i, 1, 0.48, 0.1)
    else col.setXYZ(i, 0.1, 0.94, 1)
  }
  col.needsUpdate = true
}

// ---------------------------------------------------------------- scoring / damage

function mult(): number {
  return MULT_STEPS[Math.min(Math.floor(killCount / 3), MULT_STEPS.length - 1)]
}

function addScore(n: number) {
  score += n
  emit('score', score)
}

function flashScreen(a: number, orange: boolean) {
  flashA = a
  const el = flashEl.value
  if (el) {
    el.style.background = orange ? 'rgba(255,122,26,0.55)' : 'rgba(25,240,255,0.4)'
    el.style.opacity = String(a)
  }
}

function hitShip() {
  if (rollT >= 0 || invulnT > 0 || gameOver) return
  if (!gameStarted) {
    // attract mode: pretty burst, no damage
    burst(shipX, shipY, 0, 14, false)
    return
  }
  lives -= 1
  emit('lives', Math.max(0, lives))
  killCount = 0
  streakT = 0
  invulnT = 1.4
  shakeT = 0.45
  flashScreen(0.9, true)
  burst(shipX, shipY, 0, 26, true)
  if (lives <= 0) beginDeath()
}

function beginDeath() {
  gameOver = true
  emit('over')
  deathT = 0.9
  shakeT = 0.9
  flashScreen(1, true)
  burst(shipX, shipY, 0, 90, true)
  burst(shipX, shipY, 0, 50, false)
  shipGroup.visible = false
}

function barrelRoll() {
  if (!gameStarted || gameOver || rollT >= 0 || !shipGroup.visible) return
  rollT = 0
}

// ---------------------------------------------------------------- reset / start

function clearPools() {
  for (const s of shots) { s.active = false; s.m.visible = false }
  for (const s of eshots) { s.active = false; s.m.visible = false }
  for (const e of enemies) { e.active = false; e.l.visible = false }
  for (const o of obstacles) { o.active = false; o.l.visible = false }
  for (const r of rings) { r.active = false; r.flash = 0; r.l.visible = false }
  for (let i = 0; i < MAX_DEBRIS; i++) { debrisLife[i] = 0; debrisPos[i * 3 + 2] = 9999 }
  debris.geometry.getAttribute('position').needsUpdate = true
}

function startGame() {
  if (gameOver) emit('restart')
  clearPools()
  gameStarted = true
  gameOver = false
  score = 0
  distance = 0
  lives = 3
  elapsed = 0
  shipX = 0
  shipY = -2.4
  targetX = 0
  targetY = -2.4
  bank = 0
  pitch = 0
  rollT = -1
  invulnT = 0
  shakeT = 0
  deathT = 0
  killCount = 0
  streakT = 0
  spawnT = 0.8
  ringT = 3
  fireCd = 0
  shipGroup.visible = true
  shipGroup.rotation.set(0, 0, 0)
  emit('started')
  emit('score', 0)
  emit('distance', 0)
  emit('lives', lives)
}

// ---------------------------------------------------------------- autopilot

function autopilot(dt: number) {
  // steer toward the nearest ring, away from the nearest threat, else wander low
  let tx = Math.sin(elapsed * 0.6) * 3
  let ty = -2.4 + Math.cos(elapsed * 0.45) * 0.5
  let bestRing: Ring | null = null
  for (const r of rings) {
    if (!r.active) continue
    const z = r.l.position.z
    if (z > -120 && z < -4 && (!bestRing || z > bestRing.l.position.z)) bestRing = r
  }
  if (bestRing) {
    tx = bestRing.l.position.x
    ty = THREE.MathUtils.clamp(bestRing.l.position.y, -3.0, -1.6)
  } else {
    for (const o of obstacles) {
      if (!o.active) continue
      const z = o.l.position.z
      if (z > -46 && z < -6) {
        const dx = targetX - o.l.position.x
        const dy = targetY - o.l.position.y
        if (Math.abs(dx) < 3.4 && Math.abs(dy) < 3.4) {
          tx = targetX + (dx >= 0 ? 4.5 : -4.5) * dt * 8
          ty = targetY + (dy >= 0 ? 2.5 : -2.5) * dt * 8
        }
      }
    }
  }
  targetX = THREE.MathUtils.clamp(tx, -shipXMax(), shipXMax())
  targetY = THREE.MathUtils.clamp(ty, SHIP_Y_MIN, -1.4)
  demoFireT -= dt
  if (demoFireT <= 0) {
    demoFireT = 0.7 + Math.random() * 0.6
    fireTwin()
  }
}

// ---------------------------------------------------------------- update

function update(dt: number) {
  elapsed += dt

  if (gameOver) {
    // explosion aftermath: world drifts slow until Enter/tap restarts
    worldSpeed = THREE.MathUtils.lerp(worldSpeed, 8, Math.min(1, 2 * dt))
    if (deathT > 0) {
      deathT -= dt
      if (deathT <= 0) emit('death')
    }
  } else {
    worldSpeed = gameStarted ? 42 + Math.min(38, distance * 0.004) : 28
  }

  if (!gameOver) distance += worldSpeed * dt

  // ---- steering targets
  if (!gameStarted && !gameOver) {
    autopilot(dt)
  } else if (gameStarted && !gameOver) {
    const kl = keys.has('ArrowLeft') || keys.has('a')
    const kr = keys.has('ArrowRight') || keys.has('d')
    const ku = keys.has('ArrowUp') || keys.has('w')
    const kd = keys.has('ArrowDown') || keys.has('s')
    const dx = (kr ? 1 : 0) - (kl ? 1 : 0)
    const dy = (ku ? 1 : 0) - (kd ? 1 : 0)
    targetX = THREE.MathUtils.clamp(targetX + dx * 16 * dt, -shipXMax(), shipXMax())
    targetY = THREE.MathUtils.clamp(targetY + dy * 13 * dt, SHIP_Y_MIN, SHIP_Y_MAX)
    if (touchSteer.active) {
      targetX = THREE.MathUtils.clamp(touchSteer.x, -shipXMax(), shipXMax())
      targetY = THREE.MathUtils.clamp(touchSteer.y, SHIP_Y_MIN, SHIP_Y_MAX)
    }
    fireCd -= dt
    if ((spaceHeld || touchSteer.active) && fireCd <= 0) fireTwin()
  }

  // ---- ship motion: fast follow + bank/pitch
  const f = Math.min(1, 11 * dt)
  const pvx = targetX - shipX
  const pvy = targetY - shipY
  shipX += pvx * f
  shipY += pvy * f
  const wantBank = THREE.MathUtils.clamp(-pvx * 0.16, -0.9, 0.9)
  const wantPitch = THREE.MathUtils.clamp(pvy * 0.1, -0.4, 0.4)
  bank = THREE.MathUtils.lerp(bank, wantBank, Math.min(1, 8 * dt))
  pitch = THREE.MathUtils.lerp(pitch, wantPitch, Math.min(1, 8 * dt))
  shipGroup.position.set(shipX, shipY, 0)
  if (rollT >= 0) {
    rollT += dt / ROLL_TIME
    if (rollT >= 1) rollT = -1
  }
  const rollAngle = rollT >= 0 ? rollT * Math.PI * 2 : 0
  shipGroup.rotation.set(pitch, 0, bank + rollAngle)
  // blink while invulnerable after a hit; hidden entirely after death
  shipGroup.visible = !gameOver &&
    (invulnT <= 0 || Math.floor(elapsed * 14) % 2 === 0 || !gameStarted)
  invulnT = Math.max(0, invulnT - dt)

  // ---- camera: lag behind the ship so the world feels heavy + shake
  shakeT = Math.max(0, shakeT - dt)
  const sh = shakeT > 0 ? shakeT * 1.6 : 0
  const shx = sh > 0 ? (Math.random() - 0.5) * sh : 0
  const shy = sh > 0 ? (Math.random() - 0.5) * sh : 0
  const cf = Math.min(1, 4.5 * dt)
  tmpA.set(shipX * 0.55, (portrait ? 5.2 : 3.0) + shipY * 0.42, portrait ? 13 : 9.5)
  camera.position.lerp(tmpA, cf)
  camera.position.x += shx
  camera.position.y += shy
  tmpB.set(shipX * 0.72, shipY * 0.55 + (portrait ? 2.2 : 1.5), -30)
  camera.lookAt(tmpB)

  // ---- grid scroll (cell = 5 world units; distance is the integral of speed)
  grid.position.z = distance % 5

  // ---- stars stream past
  const sp = starPos
  for (let i = 0; i < STAR_COUNT; i++) {
    sp[i * 3 + 2] += worldSpeed * starDepth[i] * dt * 1.6
    if (sp[i * 3 + 2] > 10) {
      sp[i * 3 + 2] = -220
      sp[i * 3] = (Math.random() - 0.5) * 220
      sp[i * 3 + 1] = Math.random() * 90 - 20
    }
  }
  stars.geometry.getAttribute('position').needsUpdate = true

  // ---- debris
  let debrisAlive = false
  for (let i = 0; i < MAX_DEBRIS; i++) {
    if (debrisLife[i] <= 0) continue
    debrisAlive = true
    debrisLife[i] -= dt
    if (debrisLife[i] <= 0) {
      debrisPos[i * 3 + 2] = 9999
      continue
    }
    debrisPos[i * 3] += debrisVel[i * 3] * dt
    debrisPos[i * 3 + 1] += debrisVel[i * 3 + 1] * dt
    debrisPos[i * 3 + 2] += debrisVel[i * 3 + 2] * dt
  }
  if (debrisAlive) debris.geometry.getAttribute('position').needsUpdate = true

  // ---- spawn director
  if (!gameOver) {
    spawnT -= dt
    ringT -= dt
    if (ringT <= 0) {
      ringT = gameStarted ? 4 + Math.random() * 3 : 3 + Math.random() * 2
      spawnRing()
    }
    if (spawnT <= 0) {
      if (gameStarted) {
        const density = Math.min(1, distance / 6000)
        spawnT = THREE.MathUtils.lerp(1.15, 0.4, density) * (0.7 + Math.random() * 0.6)
        const roll = Math.random()
        if (roll < 0.45) spawnFormation()
        else spawnObstacle()
      } else {
        spawnT = 1.4 + Math.random()
        if (Math.random() < 0.5) spawnFormation()
        else spawnObstacle()
      }
    }
  }

  // ---- player shots
  for (const s of shots) {
    if (!s.active) continue
    s.life -= dt
    const sz0 = s.m.position.z
    s.m.position.x += s.vx * dt
    s.m.position.y += s.vy * dt
    s.m.position.z += s.vz * dt
    if (s.life <= 0 || s.m.position.z < SPAWN_Z) {
      s.active = false
      s.m.visible = false
      continue
    }
    // vs enemies
    for (const e of enemies) {
      if (!e.active) continue
      const ep = e.l.position
      if (ep.z < s.m.position.z - 2.4 || ep.z > sz0 + 2.4) continue
      const dx = s.m.position.x - ep.x
      const dy = s.m.position.y - ep.y
      if (dx * dx + dy * dy < 2.9) {
        s.active = false
        s.m.visible = false
        e.active = false
        e.l.visible = false
        burst(ep.x, ep.y, ep.z, 22, true)
        killCount += 1
        streakT = 3
        addScore(100 * mult())
        break
      }
    }
  }

  // ---- enemies drift toward the player, wobble, sometimes shoot
  for (const e of enemies) {
    if (!e.active) continue
    const p = e.l.position
    const pz = p.z
    p.z += (worldSpeed * 0.92 + 9) * dt
    e.wob += e.wobSpeed * dt
    p.x += (Math.sin(e.wob) * 2.4 + e.hx - p.x) * Math.min(1, 0.6 * dt)
    if (gameStarted && !gameOver) {
      // slight homing toward the ship's lane
      e.hx = THREE.MathUtils.clamp(e.hx + Math.sign(shipX - p.x) * 1.4 * dt, -shipXMax(), shipXMax())
      p.y += Math.sign(shipY - p.y) * 0.5 * dt
    }
    e.l.rotation.z += 1.6 * dt
    e.l.rotation.x += 0.9 * dt
    if (e.canShoot && gameStarted && !gameOver) {
      e.fireT -= dt
      if (e.fireT <= 0 && p.z > SPAWN_Z + 20 && p.z < -30) {
        e.fireT = 1.6 + Math.random() * 1.4
        spawnEShot(p.x, p.y, p.z)
      }
    }
    if (p.z > KILL_Z) {
      e.active = false
      e.l.visible = false
      continue
    }
    // ram the player?
    if (gameStarted && !gameOver && rollT < 0) {
      const dx = p.x - shipX
      const dy = p.y - shipY
      if (p.z > -1.6 && pz < 1.6 && dx * dx + dy * dy < 3.2) {
        e.active = false
        e.l.visible = false
        burst(p.x, p.y, p.z, 24, true)
        hitShip()
      }
    }
  }

  // ---- enemy shots
  for (const s of eshots) {
    if (!s.active) continue
    s.life -= dt
    const pz = s.m.position.z
    s.m.position.x += s.vx * dt
    s.m.position.y += s.vy * dt
    s.m.position.z += s.vz * dt
    if (s.life <= 0 || s.m.position.z > 12) {
      s.active = false
      s.m.visible = false
      continue
    }
    if (gameStarted && !gameOver && rollT < 0) {
      const dx = s.m.position.x - shipX
      const dy = s.m.position.y - shipY
      if (s.m.position.z > -1.2 && pz < 1.2 && dx * dx + dy * dy < 1.7) {
        s.active = false
        s.m.visible = false
        burst(shipX, shipY, 0, 16, true)
        hitShip()
      }
    }
  }

  // ---- obstacles stream past; collide at the ship plane
  for (const o of obstacles) {
    if (!o.active) continue
    const p = o.l.position
    const pz = p.z
    p.z += worldSpeed * dt
    if (o.kind === 1) o.l.rotation.y += 0.5 * dt
    if (p.z > KILL_Z) {
      o.active = false
      o.l.visible = false
      continue
    }
    if (p.z < -1.2 || pz > 1.2 || rollT >= 0 || invulnT > 0) continue
    const dx = p.x - shipX
    const dy = p.y - shipY
    const d2 = dx * dx + dy * dy
    if (o.kind === 0) {
      // gate: safe inside the hole, clip = hit
      if (d2 < 2.9) continue // clean pass through the diamond
      if (d2 < 10.2) {
        o.active = false
        o.l.visible = false
        burst(shipX, shipY, 0, 18, false)
        hitShip()
      }
    } else if (o.kind === 2) {
      // pillar: short slab above/below the lane — hit only on its side
      if (Math.abs(dx) < 2.0 && (p.y > 0 ? shipY > 1.2 : shipY < -1.2)) {
        o.active = false
        o.l.visible = false
        burst(shipX, shipY, 0, 18, false)
        hitShip()
      }
    } else if (d2 < o.r * o.r) {
      o.active = false
      o.l.visible = false
      burst(shipX, shipY, 0, 18, false)
      hitShip()
    }
  }

  // ---- rings: fly through for bonus + flash
  for (const r of rings) {
    if (!r.active) continue
    const p = r.l.position
    const pz = p.z
    p.z += worldSpeed * dt
    p.y += Math.sin(elapsed * 2 + p.x) * 0.35 * dt
    r.l.rotation.z += 0.8 * dt
    if (r.flash > 0) {
      r.flash = Math.max(0, r.flash - dt * 2.2)
      r.l.scale.setScalar(1 + r.flash * 0.5)
    }
    if (p.z > KILL_Z) {
      r.active = false
      r.l.visible = false
      continue
    }
    if (p.z < -1.4 || pz > 1.4) continue
    const dx = p.x - shipX
    const dy = p.y - shipY
    if (dx * dx + dy * dy < 4.4) {
      r.flash = 1
      burst(p.x, p.y, p.z, 20, false)
      flashScreen(0.35, false)
      if (gameStarted) {
        killCount += 1
        streakT = 3
        addScore(50 * mult())
      }
      // let the flashing ring drift past before recycling
    }
  }

  // ---- streak decay
  if (streakT > 0) {
    streakT -= dt
    if (streakT <= 0) killCount = 0
  }

  // ---- flash overlay decay
  if (flashA > 0) {
    flashA = Math.max(0, flashA - dt * 2.4)
    const el = flashEl.value
    if (el) el.style.opacity = String(flashA * 0.85)
  }
}

// ---------------------------------------------------------------- frame / resize

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - last) / 1000 || 0)
  last = now
  update(dt)
  const km = Math.floor(distance / 100)
  if (km !== lastKm) {
    lastKm = km
    emit('distance', km)
  }
  renderer!.render(scene, camera)
}

function resize() {
  if (!renderer) return
  const W = window.innerWidth
  const H = window.innerHeight
  portrait = H > W
  viewW = W
  viewH = H
  const pr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(pr)
  renderer.setSize(W, H, false)
  camera.aspect = W / H
  camera.fov = portrait ? 72 : 62
  camera.updateProjectionMatrix()
  matShip?.resolution.set(W * pr, H * pr)
  matShipGlow?.resolution.set(W * pr, H * pr)
  matRing?.resolution.set(W * pr, H * pr)
  matRingGlow?.resolution.set(W * pr, H * pr)
}

// ---------------------------------------------------------------- input

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (!gameStarted || gameOver)) {
    startGame()
    return
  }
  if (!gameStarted) return
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault()
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if ((k === 'ArrowLeft' || k === 'ArrowRight') && !e.repeat) {
    const now = performance.now()
    if (now - (lastArrowTap[k] || 0) < 280 && gameStarted && !gameOver) barrelRoll()
    lastArrowTap[k] = now
  }
  if ((k === 'Shift' || e.key === 'Shift') && !e.repeat) barrelRoll()
  if (e.key === ' ') spaceHeld = true
  keys.add(k)
}

function onKeyUp(e: KeyboardEvent) {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  keys.delete(k)
  if (e.key === ' ') spaceHeld = false
}

// Steering by drag: displacement relative to finger-down maps to the flight
// box. Double-tap (two quick taps) = barrel roll. Starts only on TAP.
const touchSteer = { active: false, x: 0, y: 0 }
let touchDown: { x: number; y: number; sx: number; sy: number; t: number } | null = null
let lastTapT = 0

function isInteractive(el: EventTarget | null): boolean {
  const h = el as HTMLElement | null
  if (!h || !h.closest) return false
  return !!h.closest('a, button, .social-links, .flip-container, .theme-pager')
}

function onTouchStart(e: TouchEvent) {
  if (isInteractive(e.target)) return
  const t = e.touches[0]
  touchDown = { x: t.clientX, y: t.clientY, sx: targetX, sy: targetY, t: performance.now() }
  if (gameStarted && !gameOver) {
    touchSteer.active = true
    touchSteer.x = targetX
    touchSteer.y = targetY
    if (fireCd <= 0) fireTwin()
    e.preventDefault()
  }
}

function onTouchMove(e: TouchEvent) {
  if (!touchDown || !touchSteer.active) return
  if (isInteractive(e.target)) return
  e.preventDefault()
  const t = e.touches[0]
  const scaleX = shipXMax() * 2 / viewW
  const scaleY = (SHIP_Y_MAX - SHIP_Y_MIN) / viewH
  touchSteer.x = touchDown.sx + (t.clientX - touchDown.x) * scaleX * 1.6
  touchSteer.y = touchDown.sy - (t.clientY - touchDown.y) * scaleY * 1.6
}

function onTouchEnd(e: TouchEvent) {  if (!touchDown) {
    touchSteer.active = false
    return
  }
  const t = e.changedTouches[0]
  const moved = Math.hypot(t.clientX - touchDown.x, t.clientY - touchDown.y)
  const quick = performance.now() - touchDown.t < 350
  const wasTap = moved < 15 && quick
  touchDown = null
  touchSteer.active = false
  if (isInteractive(e.target)) return
  if (!gameStarted || gameOver) {
    if (wasTap) startGame()
  } else if (wasTap) {
    const now = performance.now()
    if (now - lastTapT < 350) barrelRoll()
    lastTapT = now
  }
}

// ---------------------------------------------------------------- lifecycle

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value!, antialias: true, powerPreference: 'low-power' })
  buildScene()
  resize()
  // pre-warm: simulate 6 s of attract mode so gates/rings/enemies are
  // already on screen in the first frame (spawns start at z=-150 in fog)
  for (let i = 0; i < 360; i++) update(1 / 60)
  // demo kills during warm-up must not leak onto the HUD
  score = 0
  killCount = 0
  streakT = 0
  lastKm = 0
  emit('score', 0)
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('touchstart', onTouchStart, { passive: false })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  last = performance.now()
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
  scene?.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose?.()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach(x => x.dispose())
    else mat?.dispose?.()
  })
  renderer?.dispose()
  renderer = null
})
</script>

<style>
.sfxb-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 1;
}

.sfxb-flash {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0;
}
</style>
