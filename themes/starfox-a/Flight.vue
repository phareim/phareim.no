<template>
  <canvas ref="canvas" class="sfxa-canvas"></canvas>
  <div ref="flashEl" class="sfxa-flash"></div>
</template>

<script setup lang="ts">
/**
 * Star Fox "SUPER FX" — an on-rails 3D corridor shooter in three.js, behind
 * the landing overlay. Same contract as rtype/Shooter.vue:
 * full-viewport canvas, attract mode (autopilot) until Enter/tap, events up
 * to Landing.vue for the HUD:
 *   score(n)  distance(km)  lives(n)  started  restart
 *   over      — the moment the run ends (unlocks theme navigation)
 *   death     — after the explosion (shows the GAME OVER card)
 *
 * The look is the SNES original: flat-shaded low-poly polygons, a ~16 colour
 * palette, one directional light + dim ambient, fog, and the whole scene
 * rendered into a ~1/3-resolution render target blitted with NEAREST so the
 * pixels are chunky and crisp.
 *
 * Corridor model: the ship sits near z=0 inside a clamped screen-space box;
 * the world streams toward +Z. Everything ahead spawns far in the fog
 * (z=-SPAWN_Z) and is recycled behind the camera. Pooled arrays everywhere,
 * InstancedMesh for anything repeated, shared geometries/materials, zero
 * per-frame allocation in the hot loop.
 */
import * as THREE from 'three'

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

// ---------------------------------------------------------------- constants

const SPAWN_Z = 235
const SHIP_Z = 0
let boundX = 7.5
const BOUND_Y_MIN = -2.8
const BOUND_Y_MAX = 4.2
const SHIP_SPEED = 15
const FIRE_INTERVAL = 1 / 6 // twin lasers, ~6/s
const ROLL_TIME = 0.55 // one full 360deg roll
const ROLL_COOLDOWN = 1.0
const INVULN_TIME = 1.4
const DEATH_TIME = 0.9 // explosion before 'death'
const MAX_LIVES = 3
const RT_SCALE = 1 / 3

// Corneria palette (~16 colours)
const C_SKY = 0x101d4e
const C_HORIZON = 0x9fc3e8
const C_GROUND = 0x5e9c52
const C_GROUND_DARK = 0x4a7f43
const C_BAR = 0x548c49
const C_STEEL = 0x7d8aa0
const C_STEEL_DARK = 0x4a5568
const C_SAND = 0xd9c27a
const C_STONE = 0xb8b0a0
const C_CLOUD = 0xe8eef7
const C_SUN = 0xfff3c4
const C_WHITE = 0xe8ecf2
const C_BLUE = 0x3b6fd6
const C_RED = 0xd23b2e
const C_CANOPY = 0x16294d
const C_LASER = 0xffb52e
const C_LASER_CORE = 0xfff3c4
const C_ENEMY = 0x6b7280
const C_ENEMY_DARK = 0x3d434e
const C_ENEMY_EYE = 0xff7a1a
const C_RING = 0xffd94a
const C_SHOT = 0xff5a3c

// ---------------------------------------------------------------- state

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene = new THREE.Scene()
let camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera()
let rt: THREE.WebGLRenderTarget | null = null
let quadScene: THREE.Scene = new THREE.Scene()
let quadCam: THREE.OrthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
let raf = 0
let last = 0
let elapsed = 0

let gameStarted = false
let gameOver = false // run ended, GAME OVER card showing
let shipAlive = true
let deadT = 0
let overEmitted = false

let score = 0
let lastScoreSent = -1
let distance = 0 // world units travelled
let lastKm = -1
let lives = MAX_LIVES

let shipX = 0
let shipY = -1
let bank = 0 // smoothed visual bank
let pitch = 0
let rollT = -1 // <0 = not rolling, else 0..ROLL_TIME
let rollCooldown = 0
let invulnT = 0
let fireT = 0
let firing = false // held space / touching
let shake = 0
let flashV = 0
let streak = 0
let lastKillT = -10
let mult = 1

// spawn timers
let enemyT = 1.2
let obstacleT = 0.6
let ringT = 2.0

const keys = new Set<string>()
// double-tap detection for Left/Right keys -> barrel roll
let lastDirKey = ''
let lastDirT = -10

// touch steering: displacement of the drag from finger-down, in px
let touchStartX = 0
let touchStartY = 0
let touchStartT = 0
let touchDX = 0
let touchDY = 0
let touching = false
let touchFire = false
let lastTapT = -10

// ---------------------------------------------------------------- entities

interface Bolt { active: boolean; x: number; y: number; z: number }
interface EShot { active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number }
interface Enemy { active: boolean; x: number; y: number; z: number; hp: number; fireT: number; weaveP: number; weaveA: number }
interface Obstacle { active: boolean; kind: number; x: number; y: number; z: number; s: number; passed: boolean }
interface Ring { active: boolean; x: number; y: number; z: number; flash: number; mesh: THREE.Mesh | null }
interface DebrisP { active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; maxLife: number; spin: number; rx: number; ry: number }
interface Bar { z: number }
interface Patch { x: number; z: number; s: number }
interface Cloud { x: number; y: number; z: number; speed: number }

const KIND_ARCH = 0
const KIND_BLOCK = 1
const KIND_PYR = 2

const MAX_BOLTS = 40
const MAX_ESHOTS = 24
const MAX_ENEMIES = 9
const MAX_OBSTACLES = 14
const MAX_RINGS = 5
const MAX_DEBRIS = 90
const N_BARS = 24
const N_PATCHES = 22
const N_CLOUDS = 8
const N_FAR_PYR = 14

const bolts: Bolt[] = []
const eshots: EShot[] = []
const enemies: Enemy[] = []
const obstacles: Obstacle[] = []
const rings: Ring[] = []
const debris: DebrisP[] = []
const bars: Bar[] = []
const patches: Patch[] = []
const clouds: Cloud[] = []

// three objects
let shipGroup: THREE.Group | null = null
let engineGlow: THREE.Mesh | null = null
let boltIM: THREE.InstancedMesh | null = null
let eshotIM: THREE.InstancedMesh | null = null
let enemyBodyIM: THREE.InstancedMesh | null = null
let enemyWingIM: THREE.InstancedMesh | null = null
let debrisIM: THREE.InstancedMesh | null = null
let archIM: THREE.InstancedMesh | null = null
let blockIM: THREE.InstancedMesh | null = null
let pyrIM: THREE.InstancedMesh | null = null
let barIM: THREE.InstancedMesh | null = null
let patchIM: THREE.InstancedMesh | null = null
let cloudIM: THREE.InstancedMesh | null = null
let farPyrIM: THREE.InstancedMesh | null = null

const dummy = new THREE.Object3D()
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0)

// ---------------------------------------------------------------- helpers

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

function worldSpeed(): number {
  if (!gameStarted) return 30
  return 36 + Math.min(24, distance * 0.006)
}

function difficulty(): number {
  // 0 at start -> 1 after ~4000 units
  return Math.min(1, distance / 4000)
}

function currentMult(): number {
  return Math.min(8, 1 + Math.floor(streak / 3))
}

function addScore(n: number): void {
  score += n * mult
  if (score !== lastScoreSent) {
    lastScoreSent = score
    emit('score', score)
  }
}

function spawnDebris(x: number, y: number, z: number, count: number, power: number): void {
  let spawned = 0
  for (let i = 0; i < debris.length && spawned < count; i++) {
    const d = debris[i]
    if (d.active) continue
    d.active = true
    d.x = x; d.y = y; d.z = z
    const a = Math.random() * Math.PI * 2
    const b = Math.random() * Math.PI - Math.PI / 2
    const sp = rand(0.4, 1) * power
    d.vx = Math.cos(a) * Math.cos(b) * sp
    d.vy = Math.sin(b) * sp
    d.vz = Math.sin(a) * Math.cos(b) * sp + 6
    d.maxLife = rand(0.4, 1.0)
    d.life = d.maxLife
    d.spin = rand(-8, 8)
    d.rx = Math.random() * Math.PI
    d.ry = Math.random() * Math.PI
    spawned++
  }
}

function hurtShip(): void {
  if (!gameStarted || gameOver || !shipAlive) return
  if (rollT >= 0 || invulnT > 0) return // rolling or blinking: immune
  lives--
  emit('lives', Math.max(0, lives))
  shake = 1
  flashV = 0.9
  spawnDebris(shipX, shipY, SHIP_Z - 1, 14, 10)
  if (lives <= 0) {
    // third hit: run ends NOW, explosion plays, 'death' follows
    shipAlive = false
    deadT = DEATH_TIME
    if (shipGroup) shipGroup.visible = false
    spawnDebris(shipX, shipY, SHIP_Z - 1, 60, 16)
    shake = 1.6
    flashV = 1
    if (!overEmitted) {
      overEmitted = true
      emit('over')
    }
  } else {
    invulnT = INVULN_TIME
  }
}

function barrelRoll(): void {
  if (!gameStarted || gameOver || !shipAlive) return
  if (rollT >= 0 || rollCooldown > 0) return
  rollT = 0
  rollCooldown = ROLL_COOLDOWN + ROLL_TIME
}

function fireLasers(): void {
  // twin bolts from the wingtips
  let spawned = 0
  for (let i = 0; i < bolts.length && spawned < 2; i++) {
    const b = bolts[i]
    if (b.active) continue
    b.active = true
    b.x = shipX + (spawned === 0 ? -0.95 : 0.95)
    b.y = shipY - 0.1
    b.z = SHIP_Z - 1.5
    spawned++
  }
}

// ---------------------------------------------------------------- scene build

function lambert(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true })
}

function buildScene(): void {
  rings.length = 0 // drop disposed meshes from a previous mount
  scene = new THREE.Scene()
  scene.background = new THREE.Color(C_SKY)
  scene.fog = new THREE.Fog(C_HORIZON, 40, 225)

  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700)
  camera.position.set(0, 2.2, 8)

  scene.add(new THREE.AmbientLight(0x8fa3cc, 0.75))
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6)
  sun.position.set(-30, 60, 40)
  scene.add(sun)

  // --- sky gradient dome (fog-exempt) + flat sun disc -----------------
  const skyGeo = new THREE.PlaneGeometry(900, 340)
  const skyMat = new THREE.ShaderMaterial({
    fog: false,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(C_SKY) },
      mid: { value: new THREE.Color(C_HORIZON) },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 top; uniform vec3 mid; void main() { float t = smoothstep(0.0, 0.62, vUv.y); vec3 c = mix(mid, top, t); gl_FragColor = vec4(c, 1.0); }',
  })
  const sky = new THREE.Mesh(skyGeo, skyMat)
  sky.position.set(0, 90, -430)
  scene.add(sky)

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 12),
    new THREE.MeshBasicMaterial({ color: C_SUN, fog: false }),
  )
  sunDisc.position.set(55, 62, -425)
  scene.add(sunDisc)

  // --- ground ---------------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), lambert(C_GROUND))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -4, -240)
  scene.add(ground)

  // --- the Arwing (~30 faces of white/blue/red) ------------------------
  const mWhite = lambert(C_WHITE)
  const mBlue = lambert(C_BLUE)
  const mRed = lambert(C_RED)
  const mDark = lambert(C_CANOPY)
  shipGroup = new THREE.Group()

  // tapered diamond fuselage with a pointed nose
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.48, 3.2, 4), mWhite)
  fus.rotation.x = -Math.PI / 2
  fus.rotation.y = Math.PI / 4
  fus.position.set(0, 0, -0.2)
  shipGroup.add(fus)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 4), mBlue)
  nose.rotation.x = -Math.PI / 2
  nose.rotation.y = Math.PI / 4
  nose.position.set(0, 0, -2.25)
  shipGroup.add(nose)
  // swept anhedral wings: one quad (two triangles) per side
  const wingMat = new THREE.MeshLambertMaterial({ color: C_WHITE, flatShading: true, side: THREE.DoubleSide })
  for (const s of [-1, 1]) {
    const wingGeo = new THREE.BufferGeometry()
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      s * 0.45, 0, -0.5,
      s * 0.45, 0, 0.9,
      s * 2.6, -0.55, 1.1,
      s * 0.45, 0, -0.5,
      s * 2.6, -0.55, 1.1,
      s * 2.6, -0.55, 0.45,
    ], 3))
    wingGeo.computeVertexNormals()
    shipGroup.add(new THREE.Mesh(wingGeo, wingMat))
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.8), mRed)
    fin.position.set(s * 2.62, -0.2, 0.8)
    shipGroup.add(fin)
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 1.5), mBlue)
    pod.position.set(s * 1.25, -0.28, 0.35)
    shipGroup.add(pod)
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 5), mDark)
    gun.rotation.x = Math.PI / 2
    gun.position.set(s * 0.85, -0.1, -1.1)
    shipGroup.add(gun)
  }
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.0, 4), mDark)
  canopy.rotation.x = -Math.PI / 2
  canopy.rotation.y = Math.PI / 4
  canopy.scale.set(1, 0.55, 1)
  canopy.position.set(0, 0.42, -0.55)
  shipGroup.add(canopy)
  engineGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.3, 0.15),
    new THREE.MeshBasicMaterial({ color: C_LASER }),
  )
  engineGlow.position.set(0, 0, 1.35)
  shipGroup.add(engineGlow)
  shipGroup.scale.setScalar(0.62) // attract-sized: ~3 units wide, sits low
  shipGroup.position.set(shipX, shipY, SHIP_Z)
  scene.add(shipGroup)

  // --- instanced pools --------------------------------------------------
  const boltGeo = new THREE.BoxGeometry(0.14, 0.14, 2.4)
  const boltMat = new THREE.MeshBasicMaterial({ color: C_LASER })
  boltIM = new THREE.InstancedMesh(boltGeo, boltMat, MAX_BOLTS)
  boltIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  boltIM.frustumCulled = false
  scene.add(boltIM)

  const eshotGeo = new THREE.SphereGeometry(0.32, 6, 5)
  const eshotMat = new THREE.MeshBasicMaterial({ color: C_SHOT })
  eshotIM = new THREE.InstancedMesh(eshotGeo, eshotMat, MAX_ESHOTS)
  eshotIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  eshotIM.frustumCulled = false
  scene.add(eshotIM)

  const ebodyGeo = new THREE.ConeGeometry(0.62, 2.0, 5)
  enemyBodyIM = new THREE.InstancedMesh(ebodyGeo, lambert(C_ENEMY), MAX_ENEMIES)
  enemyBodyIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  enemyBodyIM.frustumCulled = false
  scene.add(enemyBodyIM)
  const ewingGeo = new THREE.BoxGeometry(2.4, 0.12, 0.8)
  enemyWingIM = new THREE.InstancedMesh(ewingGeo, lambert(C_ENEMY_DARK), MAX_ENEMIES)
  enemyWingIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  enemyWingIM.frustumCulled = false
  scene.add(enemyWingIM)

  const debrisGeo = new THREE.TetrahedronGeometry(0.35)
  debrisIM = new THREE.InstancedMesh(debrisGeo, lambert(C_ENEMY_EYE), MAX_DEBRIS)
  debrisIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  debrisIM.frustumCulled = false
  scene.add(debrisIM)

  const archGeo = new THREE.TorusGeometry(3.0, 0.7, 6, 10)
  archIM = new THREE.InstancedMesh(archGeo, lambert(C_STONE), MAX_OBSTACLES)
  archIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  archIM.frustumCulled = false
  scene.add(archIM)

  const blockGeo = new THREE.BoxGeometry(4, 1, 4) // scaled per instance
  blockIM = new THREE.InstancedMesh(blockGeo, lambert(C_STEEL), MAX_OBSTACLES)
  blockIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  blockIM.frustumCulled = false
  scene.add(blockIM)

  const pyrGeo = new THREE.ConeGeometry(3.2, 7, 4)
  pyrIM = new THREE.InstancedMesh(pyrGeo, lambert(C_SAND), MAX_OBSTACLES)
  pyrIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  pyrIM.frustumCulled = false
  scene.add(pyrIM)

  const barGeo = new THREE.BoxGeometry(90, 0.08, 1.1)
  barIM = new THREE.InstancedMesh(barGeo, lambert(C_BAR), N_BARS)
  barIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  barIM.frustumCulled = false
  scene.add(barIM)

  const patchGeo = new THREE.BoxGeometry(1, 0.06, 1)
  patchIM = new THREE.InstancedMesh(patchGeo, lambert(C_GROUND_DARK), N_PATCHES)
  patchIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  patchIM.frustumCulled = false
  scene.add(patchIM)

  const cloudGeo = new THREE.BoxGeometry(1, 1, 1)
  cloudIM = new THREE.InstancedMesh(cloudGeo, lambert(C_CLOUD), N_CLOUDS)
  cloudIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  cloudIM.frustumCulled = false
  scene.add(cloudIM)

  const farGeo = new THREE.ConeGeometry(14, 34, 4)
  farPyrIM = new THREE.InstancedMesh(farGeo, lambert(C_STEEL_DARK), N_FAR_PYR)
  farPyrIM.frustumCulled = false
  scene.add(farPyrIM)
  for (let i = 0; i < N_FAR_PYR; i++) {
    const side = i % 2 === 0 ? -1 : 1
    dummy.position.set(side * rand(90, 220), -4, -120 - i * 18)
    dummy.rotation.set(0, Math.PI / 4, 0)
    dummy.scale.setScalar(rand(0.7, 1.8))
    dummy.updateMatrix()
    farPyrIM.setMatrixAt(i, dummy.matrix)
  }
  farPyrIM.instanceMatrix.needsUpdate = true

  // --- rings (individual meshes: a few, and each needs its own flash) --
  const ringGeo = new THREE.TorusGeometry(2.2, 0.3, 6, 12)
  for (let i = 0; i < MAX_RINGS; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: C_RING, emissive: 0x000000, flatShading: true })
    const mesh = new THREE.Mesh(ringGeo, mat)
    mesh.visible = false
    scene.add(mesh)
    rings.push({ active: false, x: 0, y: 0, z: 0, flash: 0, mesh })
  }

  // --- pixelation rig: low-res target + fullscreen NEAREST quad --------
  quadScene = new THREE.Scene()
  quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  rt = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
    stencilBuffer: false,
  })
  // SNES palette: quantize to 6 levels/channel. The target holds LINEAR
  // values but the palette was picked in sRGB, so decode first, then
  // posterize. ShaderMaterial gets no automatic output conversion, which is
  // what we want here — c is already display-ready. (Posterizing the raw
  // linear values crushes everything below mid-grey to black, including the
  // deep-blue sky.)
  const quadMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: rt.texture } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tex; varying vec2 vUv; void main(){ vec3 c = texture2D(tex, vUv).rgb; c = pow(c, vec3(0.4545)); c = floor(c * 6.0 + 0.5) / 6.0; gl_FragColor = vec4(c, 1.0); }',
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat)
  quad.frustumCulled = false
  quadScene.add(quad)

  resetPools()
  seedAttract()
}

function resetPools(): void {
  bolts.length = 0
  for (let i = 0; i < MAX_BOLTS; i++) bolts.push({ active: false, x: 0, y: 0, z: 0 })
  eshots.length = 0
  for (let i = 0; i < MAX_ESHOTS; i++) eshots.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })
  enemies.length = 0
  for (let i = 0; i < MAX_ENEMIES; i++) enemies.push({ active: false, x: 0, y: 0, z: 0, hp: 1, fireT: 0, weaveP: 0, weaveA: 0 })
  obstacles.length = 0
  for (let i = 0; i < MAX_OBSTACLES; i++) obstacles.push({ active: false, kind: 0, x: 0, y: 0, z: 0, s: 1, passed: false })
  debris.length = 0
  for (let i = 0; i < MAX_DEBRIS; i++) debris.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, spin: 0, rx: 0, ry: 0 })
  bars.length = 0
  for (let i = 0; i < N_BARS; i++) bars.push({ z: 12 - i * 14 })
  patches.length = 0
  for (let i = 0; i < N_PATCHES; i++) patches.push({ x: rand(-120, 120), z: rand(-320, 12), s: rand(4, 14) })
  clouds.length = 0
  for (let i = 0; i < N_CLOUDS; i++) clouds.push({ x: rand(-80, 80), y: rand(14, 42), z: rand(-320, 0), speed: rand(1, 3) })
}

// ---------------------------------------------------------------- spawning

function attractBiasX(): number {
  // keep the centre calm in attract mode: action around the edges
  const s = Math.random() < 0.5 ? -1 : 1
  return s * rand(5.5, 8)
}

function spawnFormation(): void {
  let placed = 0
  const sz = gameStarted ? SPAWN_Z : 170
  const baseX = gameStarted ? rand(-(boundX - 2), boundX - 2) : attractBiasX()
  const baseY = rand(-0.5, 3.2)
  for (let i = 0; i < enemies.length && placed < 3; i++) {
    const e = enemies[i]
    if (e.active) continue
    e.active = true
    e.hp = difficulty() > 0.5 && placed === 0 ? 2 : 1
    e.x = baseX + (placed === 0 ? 0 : placed === 1 ? -2.6 : 2.6)
    e.y = baseY + (placed === 0 ? 0 : 1.2)
    e.z = -sz - (placed === 0 ? 0 : 6)
    e.fireT = rand(1.0, 2.4)
    e.weaveP = rand(0, Math.PI * 2)
    e.weaveA = rand(0.8, 2.0)
    placed++
  }
}

function spawnObstacle(): void {
  const sz = gameStarted ? SPAWN_Z : 170
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i]
    if (o.active) continue
    o.active = true
    const r = Math.random()
    if (r < 0.4) {
      o.kind = KIND_ARCH
      o.x = gameStarted ? rand(-(boundX - 1), boundX - 1) : attractBiasX()
      o.y = rand(-1.5, 3.0)
      o.s = rand(0.8, 1.2)
    } else if (r < 0.7) {
      o.kind = KIND_BLOCK
      const side = Math.random() < 0.5 ? -1 : 1
      o.x = gameStarted ? side * rand(7, 14) : side * rand(9, 16)
      o.s = rand(6, 15) // height
      o.y = -4 + o.s / 2
    } else {
      o.kind = KIND_PYR
      const side = Math.random() < 0.5 ? -1 : 1
      o.x = gameStarted ? side * rand(8, 20) : side * rand(10, 22)
      o.y = -4 + 3.5
      o.s = rand(0.8, 1.6)
    }
    o.z = -sz
    o.passed = false
    return
  }
}

function spawnRing(): void {
  const sz = gameStarted ? SPAWN_Z : 170
  for (let i = 0; i < rings.length; i++) {
    const g = rings[i]
    if (g.active) continue
    g.active = true
    g.x = gameStarted ? rand(-(boundX - 1), boundX - 1) : attractBiasX()
    g.y = rand(-1.8, 3.4)
    g.z = -sz
    g.flash = 0
    if (g.mesh) g.mesh.visible = true
    return
  }
}

function seedAttract(): void {
  // pre-populate the corridor so attract mode has action on frame one
  spawnObstacle()
  obstacles[0].z = -40
  spawnObstacle()
  obstacles[1].z = -85
  spawnObstacle()
  obstacles[2].z = -130
  spawnObstacle()
  obstacles[3].z = -175
  spawnRing()
  rings[0].z = -60
  spawnRing()
  rings[1].z = -150
  spawnFormation()
  for (const e of enemies) if (e.active) e.z += 60
}

function enemyFire(e: Enemy): void {
  const S = worldSpeed()
  for (let i = 0; i < eshots.length; i++) {
    const s = eshots[i]
    if (s.active) continue
    s.active = true
    s.x = e.x; s.y = e.y; s.z = e.z + 1
    const t = Math.max(0.3, (SHIP_Z - s.z) / (S + 30)) // time to reach the ship plane
    s.vx = (shipX - e.x) / t
    s.vy = (shipY - e.y) / t
    s.vz = S + 30
    return
  }
}

// ---------------------------------------------------------------- update

function steerShip(dt: number, t: number): void {
  if (!gameStarted || gameOver || !shipAlive) {
    if (!gameStarted && shipAlive) autopilot(dt, t)
    return
  }
  let dx = 0
  let dy = 0
  if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1
  if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1
  if (keys.has('ArrowUp') || keys.has('KeyW')) dy += 1
  if (keys.has('ArrowDown') || keys.has('KeyS')) dy -= 1
  if (touching) {
    dx += THREE.MathUtils.clamp(touchDX / 90, -1, 1)
    dy -= THREE.MathUtils.clamp(touchDY / 90, -1, 1)
  }
  shipX = THREE.MathUtils.clamp(shipX + dx * SHIP_SPEED * dt, -boundX, boundX)
  shipY = THREE.MathUtils.clamp(shipY + dy * SHIP_SPEED * 0.85 * dt, BOUND_Y_MIN, BOUND_Y_MAX)
}

function autopilot(dt: number, t: number): void {
  // steer toward the nearest ring, away from the nearest threat
  let tx: number | null = null
  let ty: number | null = null
  let bestZ = -Infinity
  for (let i = 0; i < rings.length; i++) {
    const g = rings[i]
    if (!g.active || g.z > -10 || g.z < bestZ - 400) continue
    if (g.z > bestZ) { bestZ = g.z; tx = g.x; ty = g.y }
  }
  let threatX: number | null = null
  let threatY: number | null = null
  let threatZ = -Infinity
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i]
    if (!o.active) continue
    if (o.z < -140 || o.z > -8) continue
    if (o.z > threatZ) { threatZ = o.z; threatX = o.x; threatY = o.y }
  }
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]
    if (!e.active) continue
    if (e.z < -140 || e.z > -8) continue
    if (e.z > threatZ) { threatZ = e.z; threatX = e.x; threatY = e.y }
  }
  let mx = Math.sin(t * 0.5) * 3 // gentle wander keeps it alive with no targets
  let my = -2.4 + Math.cos(t * 0.35) * 0.3 // ship sits LOW, centre stays calm
  if (tx !== null && ty !== null) { mx = tx; my = Math.min(ty, -2.0) }
  if (threatX !== null && threatY !== null) {
    const ax = shipX - threatX
    const ay = shipY - threatY
    const d = Math.hypot(ax, ay) || 1
    if (d < 5) { mx = shipX + (ax / d) * 6; my = shipY + (ay / d) * 4 }
  }
  const k = Math.min(1, 3.2 * dt)
  shipX = THREE.MathUtils.clamp(shipX + (mx - shipX) * k, -boundX, boundX)
  shipY = THREE.MathUtils.clamp(shipY + (my - shipY) * k, BOUND_Y_MIN, -2.0)
  // fire occasionally, never takes damage (hurtShip gates on !gameStarted)
  fireT += dt
  if (fireT > 0.7 && shipAlive) {
    fireT = 0
    if (bolts.length > 0) fireLasers()
  }
}

function updateShipVisual(dt: number, t: number): void {
  if (!shipGroup) return
  // bank from lateral motion: track velocity via position delta
  const targetBank = steerVelX * -0.09
  bank = THREE.MathUtils.lerp(bank, THREE.MathUtils.clamp(targetBank, -0.9, 0.9), Math.min(1, 8 * dt))
  const targetPitch = THREE.MathUtils.clamp(steerVelY * 0.05, -0.35, 0.35)
  pitch = THREE.MathUtils.lerp(pitch, targetPitch, Math.min(1, 8 * dt))

  let roll = 0
  if (rollT >= 0) {
    rollT += dt
    const p = Math.min(1, rollT / ROLL_TIME)
    roll = p * Math.PI * 2 * rollDir
    if (p >= 1) { rollT = -1; roll = 0 }
  }
  rollCooldown = Math.max(0, rollCooldown - dt)
  shipGroup.position.set(shipX, shipY, SHIP_Z)
  shipGroup.rotation.set(pitch, 0, bank + roll)
  // blink while invulnerable
  if (shipAlive && invulnT > 0 && rollT < 0) {
    shipGroup.visible = Math.floor(t * 12) % 2 === 0
  } else if (shipAlive) {
    shipGroup.visible = true
  }
  if (engineGlow) {
    const f = 1 + Math.sin(t * 30) * 0.25 + (firing || touchFire ? 0.5 : 0)
    engineGlow.scale.set(f, f, 1)
  }
}

let steerVelX = 0
let steerVelY = 0
let prevShipX = 0
let prevShipY = -1
let rollDir = 1

function update(dt: number, t: number): void {
  const S = worldSpeed()
  distance += S * dt
  const km = Math.floor(distance / 100)
  if (km !== lastKm) { lastKm = km; emit('distance', km) }

  // streak decay
  if (t - lastKillT > 2.5 && streak > 0) {
    streak = 0
    mult = currentMult()
  }

  // firing
  firing = keys.has('Space')
  if ((firing || touchFire) && gameStarted && !gameOver && shipAlive) {
    fireT += dt
    while (fireT >= FIRE_INTERVAL) {
      fireT -= FIRE_INTERVAL
      fireLasers()
    }
  } else if (!gameStarted) {
    // autopilot drives its own fireT
  } else {
    fireT = Math.min(fireT, FIRE_INTERVAL)
  }

  steerShip(dt, t)
  steerVelX = (shipX - prevShipX) / Math.max(dt, 0.001)
  steerVelY = (shipY - prevShipY) / Math.max(dt, 0.001)
  prevShipX = shipX
  prevShipY = shipY
  invulnT = Math.max(0, invulnT - dt)
  updateShipVisual(dt, t)

  // --- spawns ----------------------------------------------------------
  const d = difficulty()
  if (gameStarted && !gameOver) {
    enemyT -= dt
    if (enemyT <= 0) { enemyT = THREE.MathUtils.lerp(2.6, 1.3, d); spawnFormation() }
    obstacleT -= dt
    if (obstacleT <= 0) { obstacleT = THREE.MathUtils.lerp(1.7, 0.85, d); spawnObstacle() }
    ringT -= dt
    if (ringT <= 0) { ringT = rand(2.6, 4.2); spawnRing() }
  } else if (!gameStarted) {
    // attract mode: calmer and sparser
    enemyT -= dt
    if (enemyT <= 0) { enemyT = 3.4; spawnFormation() }
    obstacleT -= dt
    if (obstacleT <= 0) { obstacleT = 2.4; spawnObstacle() }
    ringT -= dt
    if (ringT <= 0) { ringT = 3.0; spawnRing() }
  }

  // --- player bolts ----------------------------------------------------
  if (boltIM) {
    const vz = -(S + 170)
    for (let i = 0; i < bolts.length; i++) {
      const b = bolts[i]
      if (!b.active) { boltIM.setMatrixAt(i, ZERO_M); continue }
      b.z += vz * dt
      if (b.z < -SPAWN_Z - 20) { b.active = false; boltIM.setMatrixAt(i, ZERO_M); continue }
      dummy.position.set(b.x, b.y, b.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      boltIM.setMatrixAt(i, dummy.matrix)
    }
    boltIM.instanceMatrix.needsUpdate = true
  }

  // --- enemies ----------------------------------------------------------
  if (enemyBodyIM && enemyWingIM) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      if (!e.active) {
        enemyBodyIM.setMatrixAt(i, ZERO_M)
        enemyWingIM.setMatrixAt(i, ZERO_M)
        continue
      }
      e.z += (S + (gameStarted ? -8 : 6)) * dt
      e.weaveP += dt * 1.7
      const wx = e.x + Math.sin(e.weaveP) * e.weaveA * dt * 3
      e.x = THREE.MathUtils.clamp(wx, -14, 14)
      if (e.z > 14) { e.active = false; enemyBodyIM.setMatrixAt(i, ZERO_M); enemyWingIM.setMatrixAt(i, ZERO_M); continue }
      // fire aimed shots (never in attract mode)
      if (gameStarted && !gameOver && shipAlive && e.z > -190 && e.z < -20) {
        e.fireT -= dt
        if (e.fireT <= 0) {
          e.fireT = rand(1.6, 3.0) * (1 - d * 0.35)
          enemyFire(e)
        }
      }
      const ebank = Math.cos(e.weaveP) * -0.5
      dummy.position.set(e.x, e.y, e.z)
      dummy.rotation.set(Math.PI / 2, 0, ebank)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      enemyBodyIM.setMatrixAt(i, dummy.matrix)
      dummy.rotation.set(0, 0, ebank)
      dummy.updateMatrix()
      enemyWingIM.setMatrixAt(i, dummy.matrix)

      // bolts vs enemy
      if (gameStarted && shipAlive) {
        for (let j = 0; j < bolts.length; j++) {
          const b = bolts[j]
          if (!b.active) continue
          const pz = b.z + (S + 170) * dt // swept: bolt vz is -(S+170), pz is last frame's z
          if (e.z >= b.z - 1.2 && e.z <= pz + 1.2 && Math.abs(b.x - e.x) < 1.4 && Math.abs(b.y - e.y) < 1.4) {
            b.active = false
            e.hp--
            spawnDebris(b.x, b.y, b.z, 3, 7)
            if (e.hp <= 0) {
              e.active = false
              enemyBodyIM.setMatrixAt(i, ZERO_M)
              enemyWingIM.setMatrixAt(i, ZERO_M)
              spawnDebris(e.x, e.y, e.z, 22, 13)
              streak++
              lastKillT = t
              mult = currentMult()
              addScore(100)
            }
            break
          }
        }
      }
      // ram the player?
      if (gameStarted && !gameOver && shipAlive && rollT < 0 && invulnT <= 0) {
        if (Math.abs(e.z - SHIP_Z) < 1.6 && Math.hypot(e.x - shipX, e.y - shipY) < 1.1) {
          e.active = false
          enemyBodyIM.setMatrixAt(i, ZERO_M)
          enemyWingIM.setMatrixAt(i, ZERO_M)
          spawnDebris(e.x, e.y, e.z, 22, 13)
          hurtShip()
        }
      }
    }
    enemyBodyIM.instanceMatrix.needsUpdate = true
    enemyWingIM.instanceMatrix.needsUpdate = true
  }

  // --- enemy shots -------------------------------------------------------
  if (eshotIM) {
    for (let i = 0; i < eshots.length; i++) {
      const s = eshots[i]
      if (!s.active) { eshotIM.setMatrixAt(i, ZERO_M); continue }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.z += s.vz * dt
      if (s.z > 8 || Math.abs(s.x) > 30 || Math.abs(s.y) > 20) {
        s.active = false
        eshotIM.setMatrixAt(i, ZERO_M)
        continue
      }
      dummy.position.set(s.x, s.y, s.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      eshotIM.setMatrixAt(i, dummy.matrix)
      if (gameStarted && !gameOver && shipAlive && rollT < 0 && invulnT <= 0) {
        if (s.z >= SHIP_Z - 1.2 && s.z - s.vz * dt <= SHIP_Z + 1.2 && Math.hypot(s.x - shipX, s.y - shipY) < 0.7) {
          s.active = false
          eshotIM.setMatrixAt(i, ZERO_M)
          hurtShip()
        }
      }
    }
    eshotIM.instanceMatrix.needsUpdate = true
  }

  // --- obstacles ----------------------------------------------------------
  let ai = 0
  let bi = 0
  let pi = 0
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i]
    if (!o.active) continue
    o.z += S * dt
    if (o.z > 16) { o.active = false; continue }
    if (o.kind === KIND_ARCH && archIM) {
      dummy.position.set(o.x, o.y, o.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(o.s)
      dummy.updateMatrix()
      archIM.setMatrixAt(ai++, dummy.matrix)
      // collision: the stone band hurts, the hole (or threading it) pays
      if (gameStarted && !gameOver && shipAlive && Math.abs(o.z - SHIP_Z) < 1.2) {
        const dd = Math.hypot(shipX - o.x, shipY - o.y) / o.s
        if (dd > 2.1 && dd < 3.9) {
          if (rollT < 0 && invulnT <= 0) hurtShip()
        } else if (dd <= 2.1) {
          if (!o.passed) { o.passed = true; addScore(25) }
        }
      }
      if (Math.abs(o.z - SHIP_Z) > 2) o.passed = false
    } else if (o.kind === KIND_BLOCK && blockIM) {
      dummy.position.set(o.x, o.y, o.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, o.s, 1)
      dummy.updateMatrix()
      blockIM.setMatrixAt(bi++, dummy.matrix)
      if (gameStarted && !gameOver && shipAlive && rollT < 0 && invulnT <= 0) {
        if (Math.abs(o.z - SHIP_Z) < 2.5 && Math.abs(shipX - o.x) < 2.2 && shipY < o.y + o.s / 2 + 0.4) hurtShip()
      }
    } else if (o.kind === KIND_PYR && pyrIM) {
      dummy.position.set(o.x, o.y, o.z)
      dummy.rotation.set(0, Math.PI / 4, 0)
      dummy.scale.setScalar(o.s)
      dummy.updateMatrix()
      pyrIM.setMatrixAt(pi++, dummy.matrix)
      if (gameStarted && !gameOver && shipAlive && rollT < 0 && invulnT <= 0) {
        if (Math.abs(o.z - SHIP_Z) < 2.6 && Math.hypot(shipX - o.x, (shipY - o.y) * 0.8) < 3.0 * o.s) hurtShip()
      }
    }
  }
  if (archIM) {
    for (let i = ai; i < MAX_OBSTACLES; i++) archIM.setMatrixAt(i, ZERO_M)
    archIM.instanceMatrix.needsUpdate = true
  }
  if (blockIM) {
    for (let i = bi; i < MAX_OBSTACLES; i++) blockIM.setMatrixAt(i, ZERO_M)
    blockIM.instanceMatrix.needsUpdate = true
  }
  if (pyrIM) {
    for (let i = pi; i < MAX_OBSTACLES; i++) pyrIM.setMatrixAt(i, ZERO_M)
    pyrIM.instanceMatrix.needsUpdate = true
  }

  // --- rings ---------------------------------------------------------------
  for (let i = 0; i < rings.length; i++) {
    const g = rings[i]
    if (!g.active || !g.mesh) continue
    const prevZ = g.z
    g.z += S * dt
    if (g.z > 14) {
      g.active = false
      g.mesh.visible = false
      continue
    }
    g.flash = Math.max(0, g.flash - dt * 2.5)
    g.mesh.position.set(g.x, g.y, g.z)
    g.mesh.rotation.z += dt * 0.8
    const pop = 1 + g.flash * 0.9
    g.mesh.scale.setScalar(pop)
    const mat = g.mesh.material as THREE.MeshLambertMaterial
    mat.emissive.setRGB(g.flash, g.flash, g.flash * 0.9)
    // passed the ship plane?
    if (prevZ < SHIP_Z && g.z >= SHIP_Z && gameStarted && !gameOver && shipAlive) {
      if (Math.hypot(shipX - g.x, shipY - g.y) < 2.0) {
        g.flash = 1
        streak++
        lastKillT = t
        mult = currentMult()
        addScore(150)
      }
    }
  }

  // --- debris ----------------------------------------------------------------
  if (debrisIM) {
    for (let i = 0; i < debris.length; i++) {
      const d = debris[i]
      if (!d.active) { debrisIM.setMatrixAt(i, ZERO_M); continue }
      d.life -= dt
      if (d.life <= 0) { d.active = false; debrisIM.setMatrixAt(i, ZERO_M); continue }
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.z += (d.vz + S * 0.5) * dt
      d.rx += d.spin * dt
      d.ry += d.spin * 0.7 * dt
      dummy.position.set(d.x, d.y, d.z)
      dummy.rotation.set(d.rx, d.ry, 0)
      dummy.scale.setScalar(Math.max(0.05, d.life / d.maxLife))
      dummy.updateMatrix()
      debrisIM.setMatrixAt(i, dummy.matrix)
    }
    debrisIM.instanceMatrix.needsUpdate = true
  }

  // --- ground bars / patches / clouds (motion cues) ---------------------------
  if (barIM) {
    const span = N_BARS * 14
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i]
      b.z += S * dt
      if (b.z > 14) b.z -= span
      dummy.position.set(0, -3.93, b.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      barIM.setMatrixAt(i, dummy.matrix)
    }
    barIM.instanceMatrix.needsUpdate = true
  }
  if (patchIM) {
    for (let i = 0; i < patches.length; i++) {
      const p = patches[i]
      p.z += S * dt
      if (p.z > 14) { p.z -= 340; p.x = rand(-120, 120) }
      dummy.position.set(p.x, -3.95, p.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(p.s, 1, p.s)
      dummy.updateMatrix()
      patchIM.setMatrixAt(i, dummy.matrix)
    }
    patchIM.instanceMatrix.needsUpdate = true
  }
  if (cloudIM) {
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i]
      c.z += (S * 0.35 + c.speed) * dt
      if (c.z > 10) { c.z -= 340; c.x = rand(-80, 80); c.y = rand(14, 42) }
      dummy.position.set(c.x, c.y, c.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(14, 2.2, 5)
      dummy.updateMatrix()
      cloudIM.setMatrixAt(i, dummy.matrix)
    }
    cloudIM.instanceMatrix.needsUpdate = true
  }

  // --- death sequencing ---------------------------------------------------------
  if (!shipAlive && !gameOver) {
    deadT -= dt
    if (deadT <= 0) {
      gameOver = true
      emit('death')
    }
  }

  // --- camera: heavy smooth follow + shake ---------------------------------------
  const ck = Math.min(1, 5 * dt)
  const camTX = shipX * 0.55
  const camTY = gameStarted ? 2.3 + shipY * 0.45 : 2.0
  camera.position.x += (camTX - camera.position.x) * ck
  camera.position.y += (camTY - camera.position.y) * ck
  shake = Math.max(0, shake - dt * 2.4)
  const shx = shake > 0 ? (Math.random() - 0.5) * shake * 1.4 : 0
  const shy = shake > 0 ? (Math.random() - 0.5) * shake * 1.4 : 0
  camera.position.x += shx
  camera.position.y += shy
  camera.lookAt(shipX * 0.8, gameStarted ? shipY * 0.6 + 0.3 : 3.2, -30)
  if (shake > 0) {
    camera.position.x -= shx
    camera.position.y -= shy
  }

  // hit flash decay (DOM write only while visible)
  if (flashV > 0) {
    flashV = Math.max(0, flashV - dt * 2.6)
    if (flashEl.value) flashEl.value.style.opacity = String(flashV * 0.85)
  } else if (flashEl.value && flashEl.value.style.opacity !== '0') {
    flashEl.value.style.opacity = '0'
  }
}

// ---------------------------------------------------------------- frame

function frame(now: number): void {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - last) / 1000 || 0)
  last = now
  elapsed += dt
  update(dt, elapsed)
  if (renderer && rt) {
    renderer.setRenderTarget(rt)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.render(quadScene, quadCam)
  }
}

function resize(): void {
  if (!renderer || !rt) return
  const W = window.innerWidth
  const H = window.innerHeight
  renderer.setPixelRatio(1)
  renderer.setSize(W, H, false)
  const aspect = W / Math.max(1, H)
  camera.aspect = aspect
  boundX = aspect < 0.8 ? 4.4 : aspect < 1.2 ? 6 : 7.5
  // portrait: pull back + widen so the corridor reads on a phone
  if (aspect < 0.8) {
    camera.fov = 80
    camera.position.z = 10.5
  } else if (aspect < 1.2) {
    camera.fov = 72
    camera.position.z = 10
  } else {
    camera.fov = 62
    camera.position.z = 11
  }
  camera.updateProjectionMatrix()
  rt.setSize(
    Math.max(2, Math.round(W * RT_SCALE)),
    Math.max(2, Math.round(H * RT_SCALE)),
  )
}

// ---------------------------------------------------------------- game flow

function resetRun(): void {
  score = 0
  lastScoreSent = -1
  distance = 0
  lastKm = -1
  lives = MAX_LIVES
  shipX = 0
  shipY = -1
  prevShipX = shipX
  prevShipY = shipY
  bank = 0
  pitch = 0
  steerVelX = 0
  steerVelY = 0
  rollT = -1
  rollCooldown = 0
  invulnT = 0
  fireT = 0
  shake = 0
  flashV = 0
  streak = 0
  mult = 1
  lastKillT = -10
  shipAlive = true
  deadT = 0
  overEmitted = false
  enemyT = 1.4
  obstacleT = 0.8
  ringT = 1.6
  for (const b of bolts) b.active = false
  for (const s of eshots) s.active = false
  for (const e of enemies) e.active = false
  for (const o of obstacles) o.active = false
  for (const d of debris) d.active = false
  for (const g of rings) {
    g.active = false
    g.flash = 0
    if (g.mesh) g.mesh.visible = false
  }
  if (shipGroup) {
    shipGroup.visible = true
    shipGroup.position.set(shipX, shipY, SHIP_Z)
  }
  if (flashEl.value) flashEl.value.style.opacity = '0'
}

function startGame(): void {
  if (gameOver) emit('restart')
  resetRun()
  gameStarted = true
  gameOver = false
  emit('started')
  emit('score', 0)
  emit('distance', 0)
  emit('lives', lives)
}

// ---------------------------------------------------------------- input

function onKeyDown(e: KeyboardEvent): void {
  const c = e.code
  if (c === 'Enter' && (!gameStarted || gameOver)) { startGame(); return }
  if (!gameStarted || gameOver) return
  if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault()
  if (c === 'ShiftLeft' || c === 'ShiftRight') {
    if (!e.repeat) {
      rollDir = shipX > 0 ? -1 : 1
      barrelRoll()
    }
    return
  }
  // quick double-tap of Left/Right also rolls
  if ((c === 'ArrowLeft' || c === 'ArrowRight' || c === 'KeyA' || c === 'KeyD') && !e.repeat) {
    const now = performance.now()
    if (c === lastDirKey && now - lastDirT < 280) {
      rollDir = c === 'ArrowLeft' || c === 'KeyA' ? -1 : 1
      barrelRoll()
    }
    lastDirKey = c
    lastDirT = now
  }
  keys.add(c)
}

function onKeyUp(e: KeyboardEvent): void {
  keys.delete(e.code)
}

// Start on TAP, not touchstart, so a horizontal swipe on the idle game still
// changes theme (the shell listens on document).
function isInteractiveElement(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null
  return !!e && !!e.closest && !!e.closest('a, button, input, .social-links, .flip-container, .theme-pager')
}

function onTouchStart(e: TouchEvent): void {
  if (isInteractiveElement(e.target)) return
  const t = e.touches[0]
  if (!t) return
  touchStartX = t.clientX
  touchStartY = t.clientY
  touchStartT = performance.now()
  touchDX = 0
  touchDY = 0
  if (gameStarted && !gameOver) {
    touching = true
    touchFire = true // auto-fire while a finger is down
    e.preventDefault()
  }
}

function onTouchMove(e: TouchEvent): void {
  if (!touching) return
  const t = e.touches[0]
  if (!t) return
  e.preventDefault()
  touchDX = t.clientX - touchStartX
  touchDY = t.clientY - touchStartY
}

function onTouchEnd(e: TouchEvent): void {
  if (isInteractiveElement(e.target)) {
    touching = false
    touchFire = false
    touchDX = 0
    touchDY = 0
    return
  }
  const t = e.changedTouches[0]
  const moved = t ? Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) : 999
  const quick = performance.now() - touchStartT < 350
  const isTap = moved < 14 && quick
  if (!gameStarted || gameOver) {
    if (isTap) startGame()
  } else if (isTap) {
    // quick double-tap = barrel roll
    const now = performance.now()
    if (now - lastTapT < 350) {
      rollDir = 1
      barrelRoll()
    }
    lastTapT = now
  }
  touching = false
  touchFire = false
  touchDX = 0
  touchDY = 0
}

// ---------------------------------------------------------------- lifecycle

onMounted(() => {
  // module-level state survives unmount: reset to attract mode before rebuild
  gameStarted = false
  gameOver = false
  elapsed = 0
  keys.clear()
  touching = false
  touchFire = false
  firing = false
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value!, antialias: false, powerPreference: 'low-power' })
  buildScene()
  resetRun() // needs shipGroup/flashEl
  // attract timers: action starts fast
  enemyT = 1.2
  obstacleT = 0.6
  ringT = 2.0
  seedAttract()
  resize()
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
  for (const s of [scene, quadScene]) {
    s.traverse((o) => {
      const m = o as THREE.Mesh
      if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose()
      const geo = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined
      geo?.dispose?.()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach(x => x.dispose())
      else mat?.dispose?.()
    })
  }
  rt?.dispose()
  rt = null
  renderer?.forceContextLoss()
  renderer?.dispose()
  renderer = null
  rings.length = 0
  scene = new THREE.Scene()
  quadScene = new THREE.Scene()
})
</script>

<style>
.sfxa-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 1;
  image-rendering: pixelated;
}

.sfxa-flash {
  position: absolute;
  inset: 0;
  background: rgba(255, 70, 40, 0.9);
  opacity: 0;
  pointer-events: none;
  z-index: 2;
}
</style>
