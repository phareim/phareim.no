<template>
  <div class="sfx-wrap">
    <canvas ref="canvas" class="sfx-canvas"></canvas>
    <div ref="flashEl" class="sfx-flash"></div>
    <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
  </div>
</template>

<script setup lang="ts">
/**
 * Star Fox C — SYNTHWAVE. An on-rails 3D corridor shooter in three.js,
 * behind the landing overlay. Same contract as rtype/Shooter.vue:
 * full-viewport canvas, attract mode (autopilot) until Enter/tap, events
 * up to Landing.vue for the HUD:
 *   score(n)  distance(km)  health(hp, max)  power(level)
 *   sector(n, phase)  boss(hp, max, active)  started  restart
 *   over      — the moment the run ends (unlocks theme navigation)
 *   death     — after the explosion (shows the GAME OVER card)
 *
 * The run is endless sectors: TRAVEL (~80 s) → WARNING → BOSS (a gunship
 * with a weak core and its own health meter) → CLEAR (bonus + heal) →
 * next sector, harder. The ship has 100 HP; rings heal. Tuning lives in
 * balance.ts so plain node tests can pin it.
 *
 * The world streams toward the player down -Z. The Arwing flies inside a
 * screen-space box, banks into lateral moves, and the camera lags behind
 * it so the world feels heavy. Synthwave dressing: striped sun, gradient
 * sky dome, scrolling magenta/cyan grid with a heartbeat pulse, mountain
 * silhouettes, fog the colour of the sky.
 */
import * as THREE from 'three'
import EscHold from '../base/EscHold.vue'
import {
  HP_MAX, DMG, HEAL_RING, HEAL_CLEAR,
  type SectorPhase, advanceSector, bossMaxHp, sectorClearBonus,
  bossAttackInterval, BOSS_ENRAGE_RATE, bossFanCount, bossFanSpread,
  bossMinions, sectorPalette,
  enemyFireInterval, boltSpeedBonus, enemyShootChance,
  formationSize, pickEnemyKind, worldSpeedFor, spawnPace,
  applyDamage, heal,
} from './balance'

const emit = defineEmits<{
  score: [n: number]
  distance: [km: number]
  health: [hp: number, max: number]
  power: [level: number]
  sector: [n: number, phase: SectorPhase]
  boss: [hp: number, max: number, active: boolean]
  started: []
  restart: []
  over: []
  death: []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const flashEl = ref<HTMLDivElement | null>(null)

// ---- palette ---------------------------------------------------------
const COL_BG = 0x0b0616
const COL_FOG = 0x1a0b2e
const COL_CYAN = 0x2ff3ff
const COL_PINK = 0xff2fa0
const COL_GOLD = 0xffd23f

// ---- world tuning ----------------------------------------------------
const SPAWN_Z = -230
const KILL_Z = 18
// Wide corridor: the camera sits a little further back so the edges stay
// framed while the ship has room to dodge.
let laneX = 11
const LANE_Y_LO = -1.5
const LANE_Y_HI = 6.0
// Attract mode keeps the ship low, clear of the HUD dock at the bottom.
// Landscape: lower fifth. Portrait: lower-right, below the hint text (2026-09-05).
const ATTRACT_Y = -2.0
const ATTRACT_Y_PORTRAIT = -3.0
const ATTRACT_X_PORTRAIT = 3.0
const ATTRACT_LOOK_UP_PORTRAIT = 1.6
const FIRE_INTERVAL = 1 / 6
const ROLL_DUR = 0.55
const MULT_STEPS = [1, 2, 3, 4, 6, 8]
const MAX_PARTICLES = 420
const MAX_LASERS = 48
// Boss spreads need more bolts in the air than the old aimed shots.
const MAX_BOLTS = 64
const MAX_ENEMIES = 28
const MAX_PILLARS = 16
const MAX_ROCKS = 10
const MAX_RINGS = 6
const MAX_POWERUPS = 3
const MAX_WAVES = 3

// ---- run state --------------------------------------------------------
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let raf = 0
let last = 0
let W = 0
let H = 0
let portrait = false

let gameStarted = false
let gameOver = false
// Esc tap pauses (EscHold owns Escape); a 3 s hold quits into game over.
const paused = ref(false)
let score = 0
let lastScoreSent = -1
let distance = 0
let lastKm = 0
let hp = HP_MAX
let elapsed = 0
// Endless sectors: TRAVEL → WARNING → BOSS → CLEAR → next sector.
let sector = 1
let phase: SectorPhase = 'travel'
let phaseT = 0
let lastPhaseSent: SectorPhase | '' = ''
let lastSectorSent = 0
let worldSpeed = 26
let shake = 0
let flash = 0
let pulseT = 0 // heartbeat clock for the grid
let invulnUntil = 0
let deathAt = 0
let deathEmitted = false
let fireT = 0
let killCount = 0
let mult = 1
let streakT = 0
let enemySpawnT = 1.5
let obstacleSpawnT = 1.0
let ringSpawnT = 3.0
let powerSpawnT = 9.0
// Weapon level 1–3, raised by gold power-up cores, lowered a step per hit.
let weaponLevel = 1

// per-frame difficulty cache (computed once in update(), read in updateSpawns)
let diffSpeed = 42
let diffEnemy = 2.1
let diffObstacle = 1.5
const LASER_OFFS = [-3.1, 3.1]

const keys = new Set<string>()

// ---- ship state -------------------------------------------------------
let shipRoot: THREE.Group
let shipBank: THREE.Group
let shipMeshes: THREE.Object3D[] = []
let engineGlow: THREE.Sprite
let shipX = 0
let shipY = 0.5
let shipTX = 0 // touch steer target
let shipTY = 0.5
let shipVisible = true
let rollT = -1 // <0 = not rolling, else 0..1 progress
let rollDir = 1
let lastLeftTap = 0
let lastRightTap = 0

// ---- environment ------------------------------------------------------
let gridMat: THREE.ShaderMaterial
let skyMat: THREE.ShaderMaterial
let sunMat: THREE.ShaderMaterial
let sunMesh: THREE.Mesh
let sunHalo: THREE.Sprite
let glowTex: THREE.CanvasTexture
let stars: THREE.Points
let mountainMesh: THREE.InstancedMesh
let mountainEdgeMesh: THREE.InstancedMesh
const dummy = new THREE.Object3D()
const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()
const tmpC = new THREE.Color()

interface Mountain { side: number; x: number; w: number; h: number; z: number; yaw: number }
let mountainParallaxX = 0
let mountainParallaxY = 0
let reducedMotion: MediaQueryList | null = null
const mountains: Mountain[] = []

// ---- pools --------------------------------------------------------------
let laserMesh: THREE.InstancedMesh

const laserDummy = new THREE.Object3D()
let laserCursor = 0
// Gold bolts (weapon level 2+) hit the boss core twice as hard.
const laserState: { active: boolean; x: number; y: number; z: number; dmg: number }[] = []

interface Bolt { mesh: THREE.Mesh; active: boolean; vx: number; vy: number; vz: number }
const bolts: Bolt[] = []

interface Enemy {
  root: THREE.Group
  body: THREE.Mesh
  active: boolean
  kind: 'drone' | 'sniper' | 'kamikaze'
  x: number; y: number; z: number
  vx: number
  vy: number
  wob: number
  wobSpeed: number
  fireT: number
  shoots: boolean
}
const enemies: Enemy[] = []

interface Pillar { i: number; active: boolean; x: number; w: number; top: number; z: number }
let pillarMesh: THREE.InstancedMesh
const pillars: Pillar[] = []

interface Rock { i: number; active: boolean; x: number; y: number; r: number; z: number; spin: number }
let rockMesh: THREE.InstancedMesh
const rocks: Rock[] = []

interface Ring { root: THREE.Group; torus: THREE.Mesh; mat: THREE.MeshBasicMaterial; active: boolean; x: number; y: number; z: number; flash: number; spin: number }
const rings: Ring[] = []

interface PowerUp { root: THREE.Group; core: THREE.Mesh; halo: THREE.Sprite; active: boolean; x: number; y: number; z: number; spin: number }
const powerups: PowerUp[] = []

interface Wave { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; active: boolean }
const waves: Wave[] = []

// particles: one Points cloud, CPU-integrated
let pGeo: THREE.BufferGeometry
let pPos: Float32Array
let pCol: Float32Array
let pVel: Float32Array
let pLife: Float32Array
let pCursor = 0

// ---- helpers --------------------------------------------------------------
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo)
}

function addScore(n: number) {
  if (!gameStarted || gameOver) return
  score += n
  if (score !== lastScoreSent) {
    lastScoreSent = score
    emit('score', score)
  }
}

function emitHealth() {
  emit('health', hp, HP_MAX)
}

function emitSector(force = false) {
  if (force || sector !== lastSectorSent || phase !== lastPhaseSent) {
    lastSectorSent = sector
    lastPhaseSent = phase
    emit('sector', sector, phase)
  }
}

function emitBoss() {
  emit('boss', boss.hp, boss.max, boss.active)
}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(47,243,255,0.55)')
  grad.addColorStop(1, 'rgba(47,243,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---- scene ---------------------------------------------------------------
function buildScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(COL_BG)
  scene.fog = new THREE.Fog(COL_FOG, 60, 340)

  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200)
  camera.position.set(0, 3.6, 10.5)
  camera.lookAt(0, 1.2, -40)

  scene.add(new THREE.HemisphereLight(0x9a7bff, 0x0b0616, 1.0))
  const key = new THREE.DirectionalLight(0xff2fa0, 1.4)
  key.position.set(-6, 10, -20)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x2ff3ff, 0.9)
  fill.position.set(6, -2, 8)
  scene.add(fill)

  buildSky()
  buildSun()
  buildGrid()
  buildStars()
  buildMountains()
  buildShip()
  buildLasers()
  buildBolts()
  buildEnemies()
  buildPillars()
  buildRocks()
  buildRings()
  buildPowerups()
  buildBoss()
  buildParticles()
  buildWaves()
}

function buildSky() {
  const geo = new THREE.SphereGeometry(600, 24, 16)
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x060310) },
      mid: { value: new THREE.Color(0x2b0f4d) },
      hor: { value: new THREE.Color(0x6b1450) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 hor;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.32, h));
        col = mix(col, top, smoothstep(0.28, 0.85, h));
        col = mix(vec3(0.023, 0.012, 0.06), col, smoothstep(-0.25, 0.0, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  scene.add(new THREE.Mesh(geo, skyMat))
}

function buildSun() {
  const geo = new THREE.CircleGeometry(55, 48)
  sunMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(COL_GOLD) },
      bottom: { value: new THREE.Color(COL_PINK) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 top; uniform vec3 bottom;
      void main() {
        vec2 p = vUv - 0.5;
        if (length(p) > 0.5) discard;
        float y = vUv.y;
        // horizontal cut-out bands, thicker toward the bottom
        float band = fract(y * 11.0);
        if (band < (1.0 - y) * 0.42) discard;
        vec3 col = mix(bottom, top, pow(y, 1.4));
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  const sun = new THREE.Mesh(geo, sunMat)
  sun.position.set(0, 14, -460)
  sun.renderOrder = -2
  scene.add(sun)
  sunMesh = sun

  // soft halo behind the sun (additive sprite, procedural texture)
  glowTex = makeGlowTexture()
  const haloMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: COL_PINK,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  })
  const halo = new THREE.Sprite(haloMat)
  halo.position.set(0, 14, -465)
  halo.scale.set(260, 260, 1)
  halo.renderOrder = -3
  scene.add(halo)
  sunHalo = halo
}

function placeSun() {
  if (portrait) {
    sunMesh.position.set(0, 260, -460)
    sunMesh.scale.setScalar(0.5)
    sunHalo.position.set(0, 260, -465)
    sunHalo.scale.set(130, 130, 1)
  } else {
    sunMesh.position.set(300, 30, -460)
    sunMesh.scale.setScalar(1)
    sunHalo.position.set(300, 30, -465)
    sunHalo.scale.set(260, 260, 1)
  }
  sunMesh.lookAt(0, camera.position.y, camera.position.z)
}

function buildGrid() {
  const geo = new THREE.PlaneGeometry(600, 800, 1, 1)
  gridMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uOffset: { value: 0 },
      uPulse: { value: 0 },
      magenta: { value: new THREE.Color(COL_PINK) },
      cyan: { value: new THREE.Color(COL_CYAN) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying vec3 vWorld;
      uniform float uOffset; uniform float uPulse;
      uniform vec3 magenta; uniform vec3 cyan;
      void main() {
        vec2 gp = vec2(vWorld.x, vWorld.z - uOffset);
        vec2 q = abs(fract(gp / 4.0) - 0.5) * 4.0;
        float line = 1.0 - smoothstep(0.0, 0.14, min(q.x, q.y));
        float centre = 1.0 - smoothstep(0.0, 0.6, abs(vWorld.x));
        float dist = length(vWorld - cameraPosition);
        float fade = exp(-dist * 0.009);
        float beat = 0.72 + 0.28 * uPulse;
        vec3 col = magenta * line + cyan * centre * (line * 0.9 + 0.08);
        float a = clamp((line * 0.85 + centre * 0.12) * fade * beat, 0.0, 1.0);
        gl_FragColor = vec4(col * beat, a);
      }`,
  })
  const grid = new THREE.Mesh(geo, gridMat)
  grid.rotation.x = -Math.PI / 2
  grid.position.set(0, -5, -260)
  grid.renderOrder = -1
  scene.add(grid)
}

function buildStars() {
  const n = 220
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rand(-280, 280)
    pos[i * 3 + 1] = rand(8, 220)
    pos[i * 3 + 2] = rand(-520, -60)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xcfe9ff,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.85,
    fog: false,
    depthWrite: false,
  })
  stars = new THREE.Points(geo, mat)
  scene.add(stars)
}

function buildMountains() {
  // A ridged height field gives each massif shoulders, gullies and subsidiary
  // summits. Shared geometry keeps all 44 mountains in a single draw call.
  const columns = 24
  const rows = 18
  const positions: number[] = []
  const indices: number[] = []
  for (let z = 0; z <= rows; z++) {
    for (let x = 0; x <= columns; x++) {
      const px = x / columns * 2 - 1
      const pz = z / rows * 2 - 1
      const envelope = Math.pow(Math.max(0, 1 - px * px), 1.2)
        * Math.pow(Math.max(0, 1 - pz * pz), 1.5)
      const spine = pz + 0.19 * Math.sin(px * 5.7) - 0.1 * px
      const ridge = Math.exp(-Math.abs(spine) * 3.4)
      const peaks = 0.62 + 0.2 * Math.sin(px * 5.1 + 0.7)
        + 0.11 * Math.sin(px * 11.3 - 1.2)
      const gullies = 0.07 * Math.sin(px * 27 + pz * 9)
        + 0.035 * Math.sin(px * 43 - pz * 17)
      const height = envelope * Math.max(0.04, 0.16 + ridge * peaks + gullies)
      positions.push(px, height, pz)
      if (x < columns && z < rows) {
        const a = z * (columns + 1) + x
        const b = a + columns + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  }
  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  indexed.setIndex(indices)
  const geo = indexed.toNonIndexed()
  indexed.dispose()
  geo.computeVertexNormals()
  // Same look as the shared 2D mountains (mountainTerrain.js): near-black
  // violet faces with a violet wireframe over them, unlit so the lines read.
  const mat = new THREE.MeshLambertMaterial({
    color: 0x0d0718,
    emissive: 0x070410,
    flatShading: true,
  })
  mountainMesh = new THREE.InstancedMesh(geo, mat, 44)
  mountainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  // Violet mesh lines over the dark faces — the 3D version of the shared
  // terrain's stroked triangulation.
  mountainEdgeMesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0xb169f5,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    }),
    44,
  )
  mountainEdgeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  for (let i = 0; i < 44; i++) {
    const side = i % 2 === 0 ? -1 : 1
    mountains.push({
      side,
      x: side * rand(26, 110),
      w: rand(14, 34),
      h: rand(10, 42),
      z: rand(-410, -90),
      yaw: rand(-0.6, 0.6),
    })
  }
  // Instances move through a large volume; a bound from their first frame
  // would incorrectly cull the entire range later in the flight.
  mountainMesh.frustumCulled = false
  mountainEdgeMesh.frustumCulled = false
  scene.add(mountainMesh)
  scene.add(mountainEdgeMesh)
}

function edgeLines(mesh: THREE.Mesh, color: number, opacity: number): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 20)
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  const lines = new THREE.LineSegments(edges, mat)
  lines.position.copy(mesh.position)
  lines.rotation.copy(mesh.rotation)
  lines.scale.copy(mesh.scale)
  return lines
}

function buildShip() {
  shipRoot = new THREE.Group()
  shipBank = new THREE.Group()
  shipRoot.add(shipBank)
  shipMeshes = []

  const chrome = new THREE.MeshStandardMaterial({
    color: 0x232c44,
    metalness: 0.85,
    roughness: 0.35,
    flatShading: true,
  })
  const dark = new THREE.MeshStandardMaterial({
    color: 0x11162a,
    metalness: 0.6,
    roughness: 0.5,
    flatShading: true,
  })
  const glowCyan = new THREE.MeshBasicMaterial({ color: COL_CYAN })
  const glowPink = new THREE.MeshBasicMaterial({ color: COL_PINK })

  // fuselage: nose spike forward (-Z)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 6), chrome)
  nose.rotation.x = -Math.PI / 2
  nose.position.z = -0.6
  shipBank.add(nose)
  shipMeshes.push(nose, edgeLines(nose, COL_CYAN, 0.9))
  shipBank.add(shipMeshes[shipMeshes.length - 1])

  // cockpit hump
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), chrome)
  cockpit.position.set(0, 0.42, 0.4)
  cockpit.scale.set(1, 0.7, 1.6)
  shipBank.add(cockpit)
  shipBank.add(edgeLines(cockpit, COL_CYAN, 0.9))

  // main wings, swept
  const wingGeo = new THREE.BoxGeometry(3.4, 0.12, 1.1)
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, dark)
    wing.position.set(s * 1.7, -0.05, 0.7)
    wing.rotation.y = s * -0.35
    wing.rotation.z = s * -0.12
    shipBank.add(wing)
    const el = edgeLines(wing, COL_CYAN, 0.75)
    shipBank.add(el)
    // wingtip gun
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.0, 6), chrome)
    gun.rotation.x = Math.PI / 2
    gun.position.set(s * 3.1, 0.05, -0.1)
    shipBank.add(gun)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), s < 0 ? glowCyan : glowPink)
    tip.position.set(s * 3.1, 0.05, -1.1)
    shipBank.add(tip)
  }

  // tail fins
  const finGeo = new THREE.BoxGeometry(0.1, 1.0, 0.9)
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, chrome)
    fin.position.set(s * 0.5, 0.5, 1.4)
    fin.rotation.z = s * -0.25
    shipBank.add(fin)
    shipBank.add(edgeLines(fin, COL_CYAN, 0.7))
  }

  // engine glow sprite
  const engMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: COL_CYAN,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  engineGlow = new THREE.Sprite(engMat)
  engineGlow.position.set(0, -0.05, 1.7)
  engineGlow.scale.set(0.7, 0.7, 1)
  shipBank.add(engineGlow)

  shipRoot.position.set(0, 0.5, 0)
  scene.add(shipRoot)
}

function buildLasers() {
  const geo = new THREE.BoxGeometry(0.14, 0.14, 2.4)
  // White base: each bolt gets its real colour per instance (cyan wings,
  // gold core at weapon level 2+).
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  laserMesh = new THREE.InstancedMesh(geo, mat, MAX_LASERS)
  laserMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  laserMesh.frustumCulled = false
  for (let i = 0; i < MAX_LASERS; i++) {
    laserState.push({ active: false, x: 0, y: -999, z: 0, dmg: 1 })
    laserDummy.position.set(0, -999, 0)
    laserDummy.updateMatrix()
    laserMesh.setMatrixAt(i, laserDummy.matrix)
    laserMesh.setColorAt(i, tmpC.set(COL_CYAN))
  }
  laserMesh.instanceMatrix.needsUpdate = true
  if (laserMesh.instanceColor) laserMesh.instanceColor.needsUpdate = true
  scene.add(laserMesh)
}

function fireOne(x: number, color: number) {
  const slot = laserCursor
  const st = laserState[slot]!
  laserCursor = (laserCursor + 1) % MAX_LASERS
  laserMesh.setColorAt(slot, tmpC.set(color))
  if (laserMesh.instanceColor) laserMesh.instanceColor.needsUpdate = true
  st.active = true
  st.x = x
  st.y = shipY + 0.05
  st.z = -1.2
  st.dmg = color === COL_GOLD ? 2 : 1
}

function fireInterval(): number {
  return FIRE_INTERVAL / (weaponLevel >= 3 ? 1.6 : weaponLevel === 2 ? 1.25 : 1)
}

function fireLaser() {
  for (const s of LASER_OFFS) fireOne(shipX + s, COL_CYAN)
  if (weaponLevel >= 2) fireOne(shipX, COL_GOLD)
  if (weaponLevel >= 3) {
    fireOne(shipX - 0.6, COL_GOLD)
    fireOne(shipX + 0.6, COL_GOLD)
    // Muzzle sparkle on the full spread.
    burst(shipX, shipY, -1.2, COL_GOLD, 2, 3)
  }
}

function buildBolts() {
  const geo = new THREE.SphereGeometry(0.24, 8, 6)
  const boltMat = new THREE.MeshBasicMaterial({ color: COL_PINK })
  for (let i = 0; i < MAX_BOLTS; i++) {
    const mesh = new THREE.Mesh(geo, boltMat)
    mesh.visible = false
    scene.add(mesh)
    bolts.push({ mesh, active: false, vx: 0, vy: 0, vz: 0 })
  }
}

function fireBolt(fromX: number, fromY: number, fromZ: number, speedMul = 1) {
  let b: Bolt | null = null
  for (const x of bolts) { if (!x.active) { b = x; break } }
  if (!b) return
  tmpV.set(shipX - fromX, shipY - fromY, 0 - fromZ).normalize()
  const speed = (worldSpeed + 26 + boltSpeedBonus(sector)) * speedMul
  b.active = true
  b.vx = tmpV.x * speed
  b.vy = tmpV.y * speed
  b.vz = tmpV.z * speed
  b.mesh.position.set(fromX, fromY, fromZ)
  b.mesh.visible = true
}

/** A bolt along an explicit direction (boss spread fans). */
function fireBoltDir(fromX: number, fromY: number, fromZ: number, dx: number, dy: number, speedMul = 1) {
  let b: Bolt | null = null
  for (const x of bolts) { if (!x.active) { b = x; break } }
  if (!b) return
  tmpV.set(dx, dy, 1).normalize()
  const speed = (worldSpeed + 26 + boltSpeedBonus(sector)) * speedMul
  b.active = true
  // +Z is toward the player; the bolt update adds its own forward drift.
  b.vx = tmpV.x * speed
  b.vy = tmpV.y * speed
  b.vz = tmpV.z * speed
  b.mesh.position.set(fromX, fromY, fromZ)
  b.mesh.visible = true
}

function buildEnemies() {
  const bodyGeo = new THREE.OctahedronGeometry(0.95)
  const wingGeo = new THREE.BoxGeometry(2.6, 0.14, 0.7)
  const goldBodyMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a1a,
    emissive: COL_GOLD,
    emissiveIntensity: 0.35,
    metalness: 0.5,
    roughness: 0.4,
    flatShading: true,
  })
  const pinkBodyMat = new THREE.MeshStandardMaterial({
    color: 0x8a1a5a,
    emissive: COL_PINK,
    emissiveIntensity: 0.35,
    metalness: 0.5,
    roughness: 0.4,
    flatShading: true,
  })
  const goldWingMat = new THREE.MeshBasicMaterial({ color: COL_GOLD })
  const pinkWingMat = new THREE.MeshBasicMaterial({ color: COL_PINK })
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const root = new THREE.Group()
    const gold = i % 3 !== 2
    const body = new THREE.Mesh(bodyGeo, gold ? goldBodyMat : pinkBodyMat)
    body.rotation.y = Math.PI / 4
    root.add(body)
    const wing = new THREE.Mesh(wingGeo, gold ? goldWingMat : pinkWingMat)
    root.add(wing)
    root.visible = false
    scene.add(root)
    enemies.push({ root, body, active: false, kind: 'drone', x: 0, y: 0, z: 0, vx: 0, vy: 0, wob: Math.random() * 6.28, wobSpeed: rand(1.5, 3), fireT: rand(1, 2.5), shoots: true })
  }
}

function spawnEnemy(x: number, y: number, z: number, shoots: boolean, kind: 'drone' | 'sniper' | 'kamikaze' = 'drone') {
  let e: Enemy | null = null
  for (const v of enemies) { if (!v.active) { e = v; break } }
  if (!e) return
  e.active = true
  e.kind = kind
  e.x = clamp(x, -laneX, laneX)
  e.y = clamp(y, LANE_Y_LO, LANE_Y_HI)
  e.z = z
  e.vx = rand(-3, 3)
  e.vy = 0
  const iv = enemyFireInterval(sector)
  e.fireT = kind === 'sniper' ? rand(iv.lo * 0.55, iv.hi * 0.6) : rand(iv.lo, iv.hi)
  e.shoots = shoots
  // Kamikazes read as small darts; snipers share the drone look but
  // shoot sooner (their fireT above) and with faster bolts.
  e.body.scale.setScalar(kind === 'kamikaze' ? 0.7 : 1)
  e.root.visible = true
  e.root.position.set(e.x, e.y, e.z)
}

function spawnFormation() {
  const cx = rand(-(laneX - 2.5), laneX - 2.5)
  const cy = rand(-0.5, 5)
  const chance = enemyShootChance(sector)
  const n = formationSize(sector)
  for (let i = 0; i < n; i++) {
    spawnEnemy(cx + (i - (n - 1) / 2) * 3.2, cy + (i % 2) * 1.2, SPAWN_Z - i * 7, Math.random() < chance, pickEnemyKind(sector))
  }
}

function killEnemy(e: Enemy, now: number) {
  void now
  e.active = false
  e.root.visible = false
  burst(e.x, e.y, e.z, COL_GOLD, 26, 14)
  burst(e.x, e.y, e.z, COL_PINK, 14, 9)
  spawnWave(e.x, e.y, e.z)
  killCount++
  streakT = 3.0
  const idx = Math.min(Math.floor(killCount / 2), MULT_STEPS.length - 1)
  mult = MULT_STEPS[idx] ?? 1
  addScore(100 * mult)
}

function buildPillars() {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1c0f38,
    emissive: 0xff2fa0,
    emissiveIntensity: 0.12,
    metalness: 0.3,
    roughness: 0.7,
    flatShading: true,
  })
  pillarMesh = new THREE.InstancedMesh(geo, mat, MAX_PILLARS)
  pillarMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  pillarMesh.frustumCulled = false
  for (let i = 0; i < MAX_PILLARS; i++) {
    pillars.push({ i, active: false, x: 0, w: 3, top: 0, z: 0 })
    dummy.position.set(0, -999, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    pillarMesh.setMatrixAt(i, dummy.matrix)
  }
  pillarMesh.instanceMatrix.needsUpdate = true
  scene.add(pillarMesh)
}

function spawnPillar() {
  let p: Pillar | null = null
  for (const v of pillars) { if (!v.active) { p = v; break } }
  if (!p) return
  p.active = true
  p.x = rand(-laneX, laneX)
  p.w = rand(2.2, 4.2)
  const h = rand(5, 15)
  p.top = -5 + h
  p.z = SPAWN_Z - rand(0, 40)
}

function buildRocks() {
  const geo = new THREE.OctahedronGeometry(1)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x241243,
    emissive: 0x2ff3ff,
    emissiveIntensity: 0.08,
    metalness: 0.4,
    roughness: 0.6,
    flatShading: true,
  })
  rockMesh = new THREE.InstancedMesh(geo, mat, MAX_ROCKS)
  rockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  rockMesh.frustumCulled = false
  for (let i = 0; i < MAX_ROCKS; i++) {
    rocks.push({ i, active: false, x: 0, y: 0, r: 1.5, z: 0, spin: rand(0.4, 1.6) })
    dummy.position.set(0, -999, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    rockMesh.setMatrixAt(i, dummy.matrix)
  }
  rockMesh.instanceMatrix.needsUpdate = true
  scene.add(rockMesh)
}

function spawnRock() {
  let r: Rock | null = null
  for (const v of rocks) { if (!v.active) { r = v; break } }
  if (!r) return
  r.active = true
  r.x = rand(-laneX, laneX)
  r.y = rand(LANE_Y_LO, LANE_Y_HI)
  r.r = rand(1.0, 2.2)
  r.z = SPAWN_Z - rand(0, 40)
}

function buildRings() {
  const geo = new THREE.TorusGeometry(2.2, 0.2, 10, 28)
  for (let i = 0; i < MAX_RINGS; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: COL_PINK, transparent: true, opacity: 0.95 })
    const torus = new THREE.Mesh(geo, mat)
    const root = new THREE.Group()
    root.add(torus)
    const haloMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: COL_PINK,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const halo = new THREE.Sprite(haloMat)
    halo.scale.set(7, 7, 1)
    root.add(halo)
    root.visible = false
    scene.add(root)
    rings.push({ root, torus, mat, active: false, x: 0, y: 0, z: 0, flash: 0, spin: 0 })
  }
}

function spawnRing(demo = false) {
  let r: Ring | null = null
  for (const v of rings) { if (!v.active) { r = v; break } }
  if (!r) return
  r.active = true
  r.x = rand(-(laneX - 2), laneX - 2)
  r.y = demo ? rand(-2.6, -2.0) : rand(-0.5, 5)
  r.z = SPAWN_Z - rand(0, 30)
  r.flash = 0
  r.root.visible = true
  r.root.position.set(r.x, r.y, r.z)
}

function collectRing(r: Ring) {
  r.flash = 1
  addScore(50 * mult)
  if (hp < HP_MAX) {
    hp = heal(hp, HEAL_RING)
    emitHealth()
  }
  burst(r.x, r.y, r.z, COL_PINK, 30, 12)
  burst(r.x, r.y, r.z, 0xffffff, 12, 8)
  flash = Math.max(flash, 0.35)
}

function buildPowerups() {
  // Gold cores drifting down the corridor: fly through one to step the
  // weapons up (twin cyan → +gold core → full gold spread, faster).
  const geo = new THREE.OctahedronGeometry(0.9)
  for (let i = 0; i < MAX_POWERUPS; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8a6a1a,
      emissive: COL_GOLD,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.35,
      flatShading: true,
    })
    const core = new THREE.Mesh(geo, mat)
    const root = new THREE.Group()
    root.add(core)
    const haloMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: COL_GOLD,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const halo = new THREE.Sprite(haloMat)
    halo.scale.set(6, 6, 1)
    root.add(halo)
    root.visible = false
    scene.add(root)
    powerups.push({ root, core, halo, active: false, x: 0, y: 0, z: 0, spin: 0 })
  }
}

function spawnPowerup(demo = false) {
  let p: PowerUp | null = null
  for (const v of powerups) { if (!v.active) { p = v; break } }
  if (!p) return
  p.active = true
  p.x = rand(-(laneX - 2), laneX - 2)
  p.y = demo ? rand(-2.6, -2.0) : rand(-0.5, 5)
  p.z = SPAWN_Z - rand(0, 30)
  p.spin = 0
  p.root.visible = true
  p.root.position.set(p.x, p.y, p.z)
}

function collectPowerup(p: PowerUp) {
  p.active = false
  p.root.visible = false
  weaponLevel = Math.min(3, weaponLevel + 1)
  addScore(150 * mult)
  burst(p.x, p.y, p.z, COL_GOLD, 34, 13)
  burst(p.x, p.y, p.z, 0xffffff, 14, 8)
  spawnWave(p.x, p.y, p.z)
  flash = Math.max(flash, 0.5)
  emit('power', weaponLevel)
}

// ---- sector boss: a gunship with a weak core ---------------------------------
// The DREADNOUGHT parks at z ≈ -60 and strafes while its turrets work
// through an attack wheel (aimed bursts → spread fan → minions). Lasers
// only hurt the gold core; turrets can be shot off and grow back.
const BOSS_Z = -60
const BOSS_NAME = 'DREADNOUGHT'

interface BossTurret {
  mesh: THREE.Mesh
  alive: boolean
  respawnT: number
  ox: number
}

const boss = {
  active: false,
  hp: 0,
  max: 0,
  root: null as unknown as THREE.Group,
  core: null as unknown as THREE.Mesh,
  coreMat: null as unknown as THREE.MeshStandardMaterial,
  turrets: [] as BossTurret[],
  x: 0,
  y: 2,
  z: BOSS_Z,
  t: 0,
  attackT: 0,
  attackStep: 0,
  deathT: -1,
  deathTick: 0,
  lastHpSent: -1,
}

function buildBoss() {
  const root = new THREE.Group()
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x2a1040,
    emissive: COL_PINK,
    emissiveIntensity: 0.18,
    metalness: 0.6,
    roughness: 0.45,
    flatShading: true,
  })
  const hull = new THREE.Mesh(new THREE.OctahedronGeometry(6), hullMat)
  hull.scale.set(1.6, 0.75, 1)
  hull.rotation.y = Math.PI / 4
  root.add(hull)
  root.add(edgeLines(hull, COL_PINK, 0.8))

  // side pods
  const podGeo = new THREE.OctahedronGeometry(2.2)
  for (const s of [-1, 1]) {
    const pod = new THREE.Mesh(podGeo, hullMat)
    pod.position.set(s * 10.5, -1, 1)
    root.add(pod)
  }

  // the weak core: gold, front and centre
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a1a,
    emissive: COL_GOLD,
    emissiveIntensity: 1.0,
    metalness: 0.4,
    roughness: 0.3,
    flatShading: true,
  })
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.7), coreMat)
  core.position.set(0, 0.4, 6.2)
  root.add(core)

  // turrets on the pods, tracked separately so they can die and regrow
  const turretGeo = new THREE.OctahedronGeometry(0.9)
  for (const s of [-1, 1]) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8a1a5a,
      emissive: COL_PINK,
      emissiveIntensity: 0.7,
      metalness: 0.5,
      roughness: 0.4,
      flatShading: true,
    })
    const mesh = new THREE.Mesh(turretGeo, mat)
    mesh.position.set(s * 10.5, 0.6, 3.2)
    root.add(mesh)
    boss.turrets.push({ mesh, alive: true, respawnT: 0, ox: s * 10.5 })
  }

  boss.root = root
  boss.core = core
  boss.coreMat = coreMat
  root.visible = false
  scene.add(root)
}

function startBoss() {
  boss.max = bossMaxHp(sector)
  boss.hp = boss.max
  boss.lastHpSent = -1
  boss.active = true
  boss.t = 0
  boss.attackT = 2.0
  boss.attackStep = 0
  boss.deathT = -1
  boss.x = 0
  boss.y = 2
  boss.z = SPAWN_Z - 40
  for (const t of boss.turrets) {
    t.alive = true
    t.respawnT = 0
    t.mesh.visible = true
  }
  boss.root.visible = true
  emitBoss()
}

function deactivateBoss() {
  if (!boss.active) return
  boss.active = false
  boss.deathT = -1
  if (boss.root) boss.root.visible = false
  emitBoss()
}

function bossAttack(now: number) {
  void now
  const aliveTurrets = boss.turrets.filter(t => t.alive)
  const step = boss.attackStep % 3
  boss.attackStep++
  if (step === 0) {
    // aimed bursts from each living turret; from sector 2 the core joins in
    for (const t of aliveTurrets) fireBolt(boss.x + t.ox, boss.y + 0.6, boss.z)
    if (aliveTurrets.length === 0 || sector >= 2) fireBolt(boss.x, boss.y, boss.z, sector >= 2 ? 1.15 : 1)
  } else if (step === 1) {
    // spread fan from the core — dodge the gaps, not the bolts
    const n = bossFanCount(sector)
    const spread = bossFanSpread(sector)
    for (let i = 0; i < n; i++) {
      const dx = (i / (n - 1) - 0.5) * spread
      fireBoltDir(boss.x, boss.y + 0.4, boss.z + 6, dx, 0, sector >= 3 ? 1.0 : 0.9)
    }
  } else {
    // minion screen peeling off the hull — grows teeth per sector
    for (const m of bossMinions(sector)) {
      spawnEnemy(boss.x + m.dx, boss.y + rand(-1, 1), boss.z + 10, Math.random() < 0.7, m.kind)
    }
  }
}

function damageBoss(dmg: number) {
  if (!boss.active || boss.deathT >= 0) return
  boss.hp = Math.max(0, boss.hp - dmg)
  if (boss.hp !== boss.lastHpSent) {
    boss.lastHpSent = boss.hp
    emitBoss()
  }
  if (boss.hp <= 0) {
    boss.deathT = 1.2
    boss.deathTick = 0
    shake = 1.2
  }
}

function killBoss() {
  const bonus = sectorClearBonus(sector)
  addScore(bonus)
  hp = heal(hp, HEAL_CLEAR)
  emitHealth()
  burst(boss.x, boss.y, boss.z, COL_GOLD, 90, 20)
  burst(boss.x, boss.y, boss.z, COL_PINK, 70, 16)
  burst(boss.x, boss.y, boss.z, 0xffffff, 40, 12)
  spawnWave(boss.x, boss.y, boss.z)
  flash = 1
  shake = 1.4
  deactivateBoss()
  phase = 'clear'
  phaseT = 0
  emitSector()
}

function updateBoss(dt: number, now: number) {
  if (!boss.active) return
  boss.t += dt
  const motion = reducedMotion?.matches ? 0.25 : 1
  if (boss.z < BOSS_Z) {
    // entrance: cruise in from deep field
    boss.z = Math.min(BOSS_Z, boss.z + 55 * dt)
  } else if (boss.deathT >= 0) {
    // death throes: chained explosions, then the CLEAR banner
    boss.deathT -= dt
    boss.deathTick -= dt
    if (boss.deathTick <= 0) {
      boss.deathTick = 0.18
      burst(boss.x + rand(-8, 8), boss.y + rand(-3, 3), boss.z + rand(-4, 6), Math.random() < 0.5 ? COL_GOLD : COL_PINK, 30, 14)
      shake = Math.max(shake, 0.8)
    }
    if (boss.deathT <= 0) killBoss()
  } else {
    // strafe + bob; steering the ship still matters (bolts track it)
    boss.x = Math.sin(boss.t * 0.5) * laneX * 0.55 * motion
    boss.y = 2 + Math.sin(boss.t * 0.8) * 1.2 * motion
    boss.core.rotation.y += dt * 2.4
    boss.coreMat.emissiveIntensity = 0.85 + Math.sin(now * 6) * 0.3
    const enraged = boss.hp < boss.max * 0.3
    boss.attackT -= dt * (enraged ? BOSS_ENRAGE_RATE : 1)
    if (boss.attackT <= 0) {
      boss.attackT = bossAttackInterval(sector)
      bossAttack(now)
    }
  }
  // regrow shot-off turrets
  for (const t of boss.turrets) {
    if (!t.alive) {
      t.respawnT -= dt
      if (t.respawnT <= 0) {
        t.alive = true
        t.mesh.visible = true
        burst(boss.x + t.ox, boss.y + 0.6, boss.z, COL_PINK, 16, 8)
      }
    }
    t.mesh.rotation.y += dt * 1.8
  }
  boss.root.position.set(boss.x, boss.y, boss.z)
}

function buildParticles() {
  pGeo = new THREE.BufferGeometry()
  pPos = new Float32Array(MAX_PARTICLES * 3)
  pCol = new Float32Array(MAX_PARTICLES * 3)
  pVel = new Float32Array(MAX_PARTICLES * 3)
  pLife = new Float32Array(MAX_PARTICLES)
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pPos[i * 3 + 1] = -9999
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3))
  const mat = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const pts = new THREE.Points(pGeo, mat)
  pts.frustumCulled = false
  scene.add(pts)
}

function burst(x: number, y: number, z: number, color: number, count: number, speed: number) {
  tmpC.set(color)
  for (let k = 0; k < count; k++) {
    const i = pCursor
    pCursor = (pCursor + 1) % MAX_PARTICLES
    pPos[i * 3] = x
    pPos[i * 3 + 1] = y
    pPos[i * 3 + 2] = z
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(rand(-1, 1))
    const sp = speed * rand(0.3, 1)
    pVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp
    pVel[i * 3 + 1] = Math.cos(ph) * sp
    pVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp
    pLife[i] = rand(0.5, 1.1)
    pCol[i * 3] = tmpC.r
    pCol[i * 3 + 1] = tmpC.g
    pCol[i * 3 + 2] = tmpC.b
  }
  pGeo.attributes.color.needsUpdate = true
}

function buildWaves() {
  const geo = new THREE.RingGeometry(0.6, 1.0, 40)
  for (let i = 0; i < MAX_WAVES; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: COL_CYAN,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.visible = false
    scene.add(mesh)
    waves.push({ mesh, mat, t: 0, active: false })
  }
}

function spawnWave(x: number, y: number, z: number) {
  let w: Wave | null = null
  for (const v of waves) { if (!v.active) { w = v; break } }
  if (!w) return
  w.active = true
  w.t = 0
  w.mesh.position.set(x, y, z)
  w.mesh.visible = true
}

// ---- damage / death ---------------------------------------------------------
function onShipHit(now: number, dmg: number) {
  if (now < invulnUntil || rollT >= 0 || !shipVisible) return
  killCount = 0
  mult = 1
  streakT = 0
  hp = applyDamage(hp, dmg)
  emitHealth()
  flash = 1
  shake = 0.7
  burst(shipX, shipY, 0, COL_CYAN, 30, 12)
  spawnWave(shipX, shipY, 0)
  if (hp <= 0) {
    weaponLevel = 1
    gameOver = true
    deathAt = now + 0.9
    deathEmitted = false
    shipVisible = false
    shipRoot.visible = false
    burst(shipX, shipY, 0, COL_GOLD, 90, 18)
    burst(shipX, shipY, 0, COL_PINK, 70, 14)
    burst(shipX, shipY, 0, 0xffffff, 40, 10)
    spawnWave(shipX, shipY, 0)
    shake = 1.4
    flash = 1
    deactivateBoss()
    emit('over')
  } else {
    invulnUntil = now + 1.0
    // A hit costs a weapon step as well as health.
    if (weaponLevel > 1) {
      weaponLevel--
      emit('power', weaponLevel)
    }
  }
}

function resetWorld() {
  for (let i = 0; i < MAX_LASERS; i++) {
    const st = laserState[i]!
    st.active = false
    st.y = -999
    laserDummy.position.set(0, -999, 0)
    laserDummy.updateMatrix()
    laserMesh.setMatrixAt(i, laserDummy.matrix)
  }
  laserMesh.instanceMatrix.needsUpdate = true
  for (const b of bolts) { b.active = false; b.mesh.visible = false }
  for (const e of enemies) { e.active = false; e.root.visible = false }
  for (const p of pillars) {
    p.active = false
    dummy.position.set(0, -999, 0)
    dummy.scale.set(1, 1, 1)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    pillarMesh.setMatrixAt(p.i, dummy.matrix)
  }
  pillarMesh.instanceMatrix.needsUpdate = true
  for (const r of rocks) {
    r.active = false
    dummy.position.set(0, -999, 0)
    dummy.scale.set(1, 1, 1)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    rockMesh.setMatrixAt(r.i, dummy.matrix)
  }
  rockMesh.instanceMatrix.needsUpdate = true
  for (const r of rings) { r.active = false; r.root.visible = false; r.flash = 0 }
  for (const p of powerups) { p.active = false; p.root.visible = false }
  deactivateBoss()
  for (const w of waves) { w.active = false; w.mesh.visible = false }
  for (let i = 0; i < MAX_PARTICLES; i++) { pLife[i] = 0; pPos[i * 3 + 1] = -9999 }
  enemySpawnT = 1.5
  obstacleSpawnT = 1.0
  ringSpawnT = 3.0
  powerSpawnT = 9.0
  weaponLevel = 1
}

function startGame() {
  if (gameOver) emit('restart')
  resetWorld()
  touchSteer.active = false
  touchSteer.id = -1
  keys.clear()
  gameStarted = true
  gameOver = false
  paused.value = false
  score = 0
  lastScoreSent = -1
  distance = 0
  lastKm = 0
  hp = HP_MAX
  sector = 1
  phase = 'travel'
  phaseT = 0
  applySectorPalette(1)
  lastPhaseSent = ''
  lastSectorSent = 0
  elapsed = 0
  killCount = 0
  mult = 1
  streakT = 0
  fireT = 0
  rollT = -1
  shake = 0
  flash = 0
  invulnUntil = performance.now() / 1000 + 1.5
  deathEmitted = false
  shipX = 0
  shipY = 0.5
  shipTX = 0
  shipTY = 0.5
  shipVisible = true
  shipRoot.visible = true
  emit('started')
  emit('score', 0)
  emit('distance', 0)
  emitHealth()
  emitSector(true)
  emitBoss()
  emit('power', weaponLevel)
}

// ---- autopilot ---------------------------------------------------------------
function autopilot(dt: number, now: number) {
  // steer toward the nearest ring, away from the nearest obstacle
  let tx = (portrait ? ATTRACT_X_PORTRAIT : 0) + Math.sin(now * 0.5) * (portrait ? 1.2 : 3.0)
  const attractY = portrait ? ATTRACT_Y_PORTRAIT : ATTRACT_Y
  let ty = attractY + Math.sin(now * 0.7) * 0.2
  let bestZ = -Infinity
  for (const r of rings) {
    if (!r.active || r.z > -4) continue
    if (r.z > bestZ) { bestZ = r.z; tx = r.x }
  }
  for (const p of pillars) {
    if (!p.active || p.z < -70 || p.z > -4) continue
    if (Math.abs(p.x - shipX) < 4.5 && shipY < p.top + 1.2) {
      tx = shipX < p.x ? p.x - 6 : p.x + 6
    }
  }
  for (const r of rocks) {
    if (!r.active || r.z < -70 || r.z > -4) continue
    if (Math.abs(r.x - shipX) < 4 && Math.abs(r.y - shipY) < 3.5) {
      tx = shipX < r.x ? r.x - 5.5 : r.x + 5.5
    }
  }
  tx = clamp(tx, -laneX, laneX)
  ty = clamp(ty, attractY - 0.3, LANE_Y_HI)
  const k = 1 - Math.exp(-4 * dt)
  shipX += (tx - shipX) * k
  shipY += (ty - shipY) * k
  fireT += dt
  if (fireT >= 0.5) {
    fireT = 0
    fireLaser()
  }
}

// ---- update -------------------------------------------------------------------
function difficulty(): { speed: number; enemy: number; obstacle: number } {
  const d = clamp(elapsed / 120, 0, 1) // full ramp over 2 min
  const pace = spawnPace(sector)
  return {
    speed: worldSpeedFor(elapsed, sector),
    enemy: (2.1 - 1.2 * d) * pace,
    obstacle: (1.5 - 0.7 * d) * pace,
  }
}

/** Endless sectors: TRAVEL → WARNING → BOSS → CLEAR → next sector. */
function updateSector(dt: number) {
  phaseT += dt
  const next = advanceSector(phase, phaseT)
  if (next === phase) return
  phaseT = 0
  if (phase === 'warning' && next === 'boss') startBoss()
  phase = next
  if (phase === 'travel') {
    sector++
    applySectorPalette(sector)
  }
  emitSector()
}

function update(dt: number, now: number) {
  const demo = !gameStarted
  const dd = difficulty()
  diffSpeed = dd.speed
  diffEnemy = dd.enemy
  diffObstacle = dd.obstacle
  pulseT += dt
  const beat = Math.pow(Math.max(0, Math.sin(pulseT * 2.4)), 6)
  gridMat.uniforms.uPulse.value = 0.25 + beat
  gridMat.uniforms.uOffset.value = (gridMat.uniforms.uOffset.value + worldSpeed * dt) % 4.0

  // scroll speed: the boss parks the corridor into an arena crawl
  if (gameOver) {
    worldSpeed += (14 - worldSpeed) * Math.min(1, dt * 2)
  } else if (demo) {
    worldSpeed += (26 - worldSpeed) * Math.min(1, dt * 2)
  } else if (phase === 'boss') {
    worldSpeed += (16 - worldSpeed) * Math.min(1, dt * 2)
  } else {
    worldSpeed = diffSpeed
  }

  if (!demo && !gameOver) {
    elapsed += dt
    updateSector(dt)
    distance += worldSpeed * dt
    const km = Math.floor(distance / 100)
    if (km !== lastKm) {
      lastKm = km
      emit('distance', km)
      addScore(2)
    }
    if (streakT > 0) {
      streakT -= dt
      if (streakT <= 0) {
        killCount = 0
        mult = 1
      }
    }
  }

  // ---- ship movement ----
  if (shipVisible && !gameOver) {
    if (demo) {
      autopilot(dt, now)
    } else if (!touchSteer.active) {
      const l = keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0
      const r = keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0
      const u = keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0
      const d = keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0
      const dx = r - l
      const dy = u - d
      shipX = clamp(shipX + dx * 13 * dt, -laneX, laneX)
      shipY = clamp(shipY + dy * 11 * dt, LANE_Y_LO, LANE_Y_HI)
      shipTX = shipX
      shipTY = shipY
    } else {
      const k = 1 - Math.exp(-12 * dt)
      shipX += (clamp(shipTX, -laneX, laneX) - shipX) * k
      shipY += (clamp(shipTY, LANE_Y_LO, LANE_Y_HI) - shipY) * k
    }
    // bank + pitch from lateral/vertical input (keyboard) or follow error (touch)
    const keyBank = ((keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0) - (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0)) * 0.55
    const followBank = touchSteer.active ? clamp((shipTX - shipX) * -0.12, -0.7, 0.7) : 0
    const pitchTarget = ((keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0)) * -0.18
    shipBank.rotation.z += ((keyBank + followBank) - shipBank.rotation.z) * Math.min(1, dt * 8)
    shipBank.rotation.x += (pitchTarget - shipBank.rotation.x) * Math.min(1, dt * 8)
    // barrel roll overrides
    if (rollT >= 0) {
      rollT += dt / ROLL_DUR
      if (rollT >= 1) {
        rollT = -1
        shipBank.rotation.y = 0
      } else {
        shipBank.rotation.z = rollDir * rollT * Math.PI * 2 + keyBank
        shipBank.rotation.y = Math.sin(rollT * Math.PI) * 0.4 * rollDir
      }
    }
    shipRoot.position.x = shipX
    shipRoot.position.y = shipY + Math.sin(now * 2.1) * 0.08
    // invulnerability blink
    shipRoot.visible = shipVisible && (now >= invulnUntil || Math.floor(now * 12) % 2 === 0)
    // engine flicker
    const es = 0.7 + Math.sin(now * 31) * 0.08 + worldSpeed * 0.002
    engineGlow.scale.set(es, es, 1)

    // firing (faster at higher weapon levels)
    const wantFire = keys.has('Space') || touchSteer.active || demo
    if (!demo && (wantFire)) {
      fireT += dt
      let step = fireInterval()
      while (fireT >= step) {
        fireT -= step
        fireLaser()
        step = fireInterval()
      }
    }
    if (!wantFire) fireT = Math.min(fireT, fireInterval())
  }

  updateSpawns(dt, demo)
  updateLasers(dt)
  updateEnemies(dt, now, demo)
  updateBolts(dt, now, demo)
  updatePillars(dt, now, demo)
  updateRocks(dt, now, demo)
  updateRings(dt, now, demo)
  updatePowerups(dt, now, demo)
  updateBoss(dt, now)
  updateParticles(dt)
  updateWaves(dt)
  updateMountains(dt)
  updateCamera(dt, now)

  // delayed death event after the explosion plays
  if (gameOver && !deathEmitted && now >= deathAt) {
    deathEmitted = true
    emit('death')
  }

  // screen flash overlay
  if (flash > 0) {
    flash = Math.max(0, flash - dt * 2.2)
    if (flashEl.value) flashEl.value.style.opacity = String(flash * 0.55)
  } else if (flashEl.value && flashEl.value.style.opacity !== '0') {
    flashEl.value.style.opacity = '0'
  }
}

function updateSpawns(dt: number, demo: boolean) {
  if (gameOver) return
  // WARNING drains the field; the boss brings its own minions, but rings
  // keep trickling as the in-fight heal source.
  const draining = !demo && phase === 'warning'
  const bossFight = !demo && phase === 'boss'
  if (!draining && !bossFight) {
    enemySpawnT -= dt * (demo ? 0.5 : 1)
    if (enemySpawnT <= 0) {
      enemySpawnT = (demo ? 3.2 : diffEnemy) * rand(0.7, 1.3)
      spawnFormation()
    }
    obstacleSpawnT -= dt * (demo ? 0.5 : 1)
    if (obstacleSpawnT <= 0) {
      obstacleSpawnT = (demo ? 2.6 : diffObstacle) * rand(0.7, 1.3)
      if (Math.random() < 0.55) spawnPillar()
      else spawnRock()
    }
  }
  if (!draining) {
    ringSpawnT -= dt
    if (ringSpawnT <= 0) {
      ringSpawnT = bossFight ? rand(7, 10) : rand(5, 8.5)
      spawnRing(demo)
    }
  }
  if (!draining && !bossFight) {
    powerSpawnT -= dt
    if (powerSpawnT <= 0) {
      powerSpawnT = rand(11, 17)
      spawnPowerup(demo)
    }
  }
}

function updateLasers(dt: number) {
  const vz = -(worldSpeed + 150)
  for (let i = 0; i < MAX_LASERS; i++) {
    const st = laserState[i]!
    if (!st.active) continue
    st.z += vz * dt
    if (st.z < SPAWN_Z - 20) {
      st.active = false
      laserDummy.position.set(0, -999, 0)
      laserDummy.updateMatrix()
      laserMesh.setMatrixAt(i, laserDummy.matrix)
      continue
    }
    // hit enemies
    for (const e of enemies) {
      if (!e.active) continue
      const dx = st.x - e.x
      const dy = st.y - e.y
      const dz = st.z - e.z
      if (dx * dx + dy * dy < 2.6 && Math.abs(dz) < 2.4) {
        st.active = false
        laserDummy.position.set(0, -999, 0)
        laserDummy.updateMatrix()
        laserMesh.setMatrixAt(i, laserDummy.matrix)
        killEnemy(e, 0)
        break
      }
    }
    if (!st.active) continue
    // hit the boss: gold core (weak point) or a turret (shoots it off)
    if (boss.active && boss.deathT < 0 && st.z < boss.z + 14 && st.z > boss.z - 14) {
      const cdz = st.z - (boss.z + 6.2)
      if (Math.abs(cdz) < 3.2) {
        const cdx = st.x - boss.x
        const cdy = st.y - (boss.y + 0.4)
        if (cdx * cdx + cdy * cdy < 2.8 * 2.8) {
          st.active = false
          laserDummy.position.set(0, -999, 0)
          laserDummy.updateMatrix()
          laserMesh.setMatrixAt(i, laserDummy.matrix)
          damageBoss(st.dmg)
          burst(st.x, st.y, st.z, COL_GOLD, 10, 8)
          addScore(25)
        }
      }
      if (st.active) {
        for (const t of boss.turrets) {
          if (!t.alive) continue
          const tdz = st.z - (boss.z + 3.2)
          if (Math.abs(tdz) > 2.8) continue
          const tdx = st.x - (boss.x + t.ox)
          const tdy = st.y - (boss.y + 0.6)
          if (tdx * tdx + tdy * tdy < 2.2 * 2.2) {
            st.active = false
            laserDummy.position.set(0, -999, 0)
            laserDummy.updateMatrix()
            laserMesh.setMatrixAt(i, laserDummy.matrix)
            t.alive = false
            t.mesh.visible = false
            t.respawnT = 8
            burst(st.x, st.y, st.z, COL_PINK, 18, 9)
            spawnWave(st.x, st.y, st.z)
            addScore(150 * mult)
            break
          }
        }
      }
    }
    if (!st.active) continue
    // hit pillars
    for (const p of pillars) {
      if (!p.active) continue
      if (Math.abs(st.z - p.z) < 2 && Math.abs(st.x - p.x) < p.w / 2 + 0.3 && st.y < p.top) {
        st.active = false
        burst(st.x, st.y, st.z, COL_CYAN, 6, 6)
        laserDummy.position.set(0, -999, 0)
        laserDummy.updateMatrix()
        laserMesh.setMatrixAt(i, laserDummy.matrix)
        break
      }
    }
    if (!st.active) continue
    // hit rocks
    for (const r of rocks) {
      if (!r.active) continue
      tmpV.set(st.x - r.x, st.y - r.y, st.z - r.z)
      if (tmpV.lengthSq() < (r.r + 0.6) * (r.r + 0.6)) {
        st.active = false
        burst(st.x, st.y, st.z, COL_CYAN, 8, 7)
        r.active = false
        burst(r.x, r.y, r.z, COL_CYAN, 20, 10)
        addScore(25 * mult)
        laserDummy.position.set(0, -999, 0)
        laserDummy.updateMatrix()
        laserMesh.setMatrixAt(i, laserDummy.matrix)
        break
      }
    }
    if (!st.active) continue
    // shoot enemy bolts (+10)
    for (const b of bolts) {
      if (!b.active) continue
      tmpV.set(st.x - b.mesh.position.x, st.y - b.mesh.position.y, st.z - b.mesh.position.z)
      if (tmpV.lengthSq() < 1.4) {
        st.active = false
        b.active = false
        b.mesh.visible = false
        burst(st.x, st.y, st.z, COL_PINK, 8, 7)
        addScore(10)
        laserDummy.position.set(0, -999, 0)
        laserDummy.updateMatrix()
        laserMesh.setMatrixAt(i, laserDummy.matrix)
        break
      }
    }
    if (st.active) {
      laserDummy.position.set(st.x, st.y, st.z)
      laserDummy.updateMatrix()
      laserMesh.setMatrixAt(i, laserDummy.matrix)
    }
  }
  laserMesh.instanceMatrix.needsUpdate = true
}

function updateEnemies(dt: number, now: number, demo: boolean) {
  for (const e of enemies) {
    if (!e.active) continue
    // Kamikazes trade their weave for a dive at the ship.
    const diving = e.kind === 'kamikaze' && !demo && e.z > -140 && e.z < -4
    e.z += worldSpeed * (diving ? 1.1 : 0.6) * dt
    e.wob += e.wobSpeed * dt
    if (diving) {
      e.x += clamp(shipX - e.x, -1, 1) * 6 * dt
      e.y += clamp(shipY - e.y, -1, 1) * 5 * dt
    } else {
      e.x += (e.vx + Math.sin(e.wob) * 2.2) * dt
    }
    if (e.x < -laneX - 1 || e.x > laneX + 1) e.vx *= -1
    e.x = clamp(e.x, -laneX - 1.5, laneX + 1.5)
    e.root.position.set(e.x, e.y + Math.sin(e.wob * 1.3) * 0.3, e.z)
    e.body.rotation.z += dt * (diving ? 4 : 1.5)
    if (e.z > KILL_Z) {
      e.active = false
      e.root.visible = false
      continue
    }
    // fire aimed shots (snipers shoot sooner and faster)
    if (e.shoots && !demo && !gameOver && e.z > -170 && e.z < -18) {
      e.fireT -= dt
      if (e.fireT <= 0) {
        const iv = enemyFireInterval(sector)
        e.fireT = e.kind === 'sniper' ? rand(iv.lo * 0.55, iv.hi * 0.6) : rand(iv.lo, iv.hi)
        fireBolt(e.x, e.y, e.z, e.kind === 'sniper' ? 1.35 : 1)
      }
    }
    // ram the player
    if (!demo && !gameOver && shipVisible && Math.abs(e.z) < 1.6) {
      const dx = e.x - shipX
      const dy = e.y - shipY
      if (dx * dx + dy * dy < 2.9) {
        killEnemy(e, now)
        onShipHit(now, DMG.ram)
      }
    }
  }
}

function updateBolts(dt: number, now: number, demo: boolean) {
  for (const b of bolts) {
    if (!b.active) continue
    b.mesh.position.x += b.vx * dt
    b.mesh.position.y += b.vy * dt
    b.mesh.position.z += (b.vz + worldSpeed * 0.5) * dt
    const p = b.mesh.position
    if (p.z > 14 || Math.abs(p.x) > 30 || Math.abs(p.y) > 25) {
      b.active = false
      b.mesh.visible = false
      continue
    }
    if (!demo && !gameOver && shipVisible && rollT < 0) {
      tmpV.set(p.x - shipX, p.y - shipY, p.z - 0)
      if (tmpV.lengthSq() < 1.44) {
        b.active = false
        b.mesh.visible = false
        onShipHit(now, DMG.bolt)
      }
    }
  }
}

function updatePillars(dt: number, now: number, demo: boolean) {
  for (const p of pillars) {
    if (!p.active) continue
    p.z += worldSpeed * dt
    if (p.z > KILL_Z) {
      p.active = false
      dummy.position.set(0, -999, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      pillarMesh.setMatrixAt(p.i, dummy.matrix)
      continue
    }
    const h = p.top + 5
    dummy.position.set(p.x, -5 + h / 2, p.z)
    dummy.scale.set(p.w, h, p.w)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    pillarMesh.setMatrixAt(p.i, dummy.matrix)
    if (!demo && !gameOver && shipVisible && Math.abs(p.z) < 1.4) {
      if (Math.abs(shipX - p.x) < p.w / 2 + 0.8 && shipY < p.top + 0.8) {
        onShipHit(now, DMG.pillar)
      }
    }
  }
  pillarMesh.instanceMatrix.needsUpdate = true
}

function updateRocks(dt: number, now: number, demo: boolean) {
  for (const r of rocks) {
    if (!r.active) continue
    r.z += worldSpeed * 0.9 * dt
    if (r.z > KILL_Z) {
      r.active = false
      dummy.position.set(0, -999, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      rockMesh.setMatrixAt(r.i, dummy.matrix)
      continue
    }
    dummy.position.set(r.x, r.y, r.z)
    dummy.scale.set(r.r, r.r * 1.2, r.r)
    dummy.rotation.set(now * r.spin, now * r.spin * 0.7, 0)
    dummy.updateMatrix()
    rockMesh.setMatrixAt(r.i, dummy.matrix)
    if (!demo && !gameOver && shipVisible) {
      tmpV.set(r.x - shipX, r.y - shipY, r.z - 0)
      if (tmpV.lengthSq() < (r.r + 0.9) * (r.r + 0.9)) {
        r.active = false
        burst(r.x, r.y, r.z, COL_PINK, 24, 11)
        onShipHit(now, DMG.rock)
      }
    }
  }
  rockMesh.instanceMatrix.needsUpdate = true
}

function updateRings(dt: number, now: number, demo: boolean) {
  void now
  for (const r of rings) {
    if (!r.active) continue
    const prevZ = r.z
    r.z += worldSpeed * dt
    r.spin += dt * 1.2
    r.root.position.set(r.x, r.y, r.z)
    r.torus.rotation.y = r.spin
    if (r.flash > 0) {
      r.flash = Math.max(0, r.flash - dt * 2.5)
      const s = 1 + r.flash * 0.9
      r.torus.scale.set(s, s, s)
      r.mat.color.setRGB(1, 0.4 + r.flash * 0.6, 0.75 + r.flash * 0.25)
    }
    // fly-through detection as the ring crosses the ship plane
    if (prevZ < 0 && r.z >= 0 && r.flash <= 0) {
      const dx = shipX - r.x
      const dy = shipY - r.y
      if (shipVisible && !gameOver && dx * dx + dy * dy < 2.2 * 2.2) {
        if (!demo) collectRing(r)
        else { r.flash = 1; burst(r.x, r.y, r.z, COL_PINK, 18, 9) }
      }
    }
    if (r.z > 12) {
      r.active = false
      r.root.visible = false
      r.flash = 0
      r.torus.scale.set(1, 1, 1)
      r.mat.color.set(COL_PINK)
    }
  }
}

function updatePowerups(dt: number, now: number, demo: boolean) {
  for (const p of powerups) {
    if (!p.active) continue
    const prevZ = p.z
    p.z += worldSpeed * dt
    p.spin += dt * 2.2
    p.core.rotation.y = p.spin
    p.core.rotation.x = Math.sin(p.spin * 0.7) * 0.4
    p.core.position.y = Math.sin(now * 3 + p.spin) * 0.25
    p.root.position.set(p.x, p.y, p.z)
    // fly-through detection as the core crosses the ship plane
    if (prevZ < 0 && p.z >= 0) {
      const dx = shipX - p.x
      const dy = shipY - p.y
      if (shipVisible && !gameOver && dx * dx + dy * dy < 2.4 * 2.4) {
        collectPowerup(p)
        continue
      }
    }
    if (p.z > 12) {
      p.active = false
      p.root.visible = false
    }
  }
  void demo
}

function updateParticles(dt: number) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (pLife[i] <= 0) continue
    pLife[i] -= dt
    if (pLife[i] <= 0) {
      pPos[i * 3 + 1] = -9999
      continue
    }
    pPos[i * 3] += pVel[i * 3] * dt
    pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt
    pPos[i * 3 + 2] += (pVel[i * 3 + 2] + worldSpeed * 0.5) * dt
  }
  pGeo.attributes.position.needsUpdate = true
}

function updateWaves(dt: number) {
  for (const w of waves) {
    if (!w.active) continue
    w.t += dt * 2.2
    if (w.t >= 1) {
      w.active = false
      w.mesh.visible = false
      continue
    }
    const s = 1 + w.t * 9
    w.mesh.scale.set(s, s, s)
    w.mat.opacity = 0.7 * (1 - w.t)
  }
}

function updateMountains(dt: number) {
  const motion = reducedMotion?.matches ? 0 : 1
  const follow = 1 - Math.exp(-3.5 * dt)
  mountainParallaxX += (-shipX * 1.8 * motion - mountainParallaxX) * follow
  mountainParallaxY += (-shipY * 0.45 * motion - mountainParallaxY) * follow
  for (let i = 0; i < mountains.length; i++) {
    const m = mountains[i]!
    m.z += worldSpeed * 0.85 * dt * motion
    if (m.z > -90) {
      m.z -= 320
      m.x = m.side * rand(26, 110)
      m.w = rand(14, 34)
      m.h = rand(10, 42)
    }
    // Near slopes move farther than the distant ridges; steering leaves
    // the sun and stars still, providing a stable reference for depth.
    const depth = THREE.MathUtils.clamp((m.z + 410) / 320, 0, 1)
    dummy.position.set(
      m.x + mountainParallaxX * (0.2 + depth * 0.8),
      -7 + mountainParallaxY * depth,
      m.z,
    )
    dummy.scale.set(m.w, m.h, m.w * 0.8)
    dummy.rotation.set(0, m.yaw, 0)
    dummy.updateMatrix()
    mountainMesh.setMatrixAt(i, dummy.matrix)
    mountainEdgeMesh.setMatrixAt(i, dummy.matrix)
  }
  mountainMesh.instanceMatrix.needsUpdate = true
  mountainEdgeMesh.instanceMatrix.needsUpdate = true
}

/** Hard-cut the backdrop palette on a new sector: mountains, grid, fog, sky. */
function applySectorPalette(s: number) {
  if (!mountainMesh || !gridMat || !skyMat || !scene) return
  const p = sectorPalette(s)
  ;(mountainMesh.material as THREE.MeshLambertMaterial).color.set(p.face)
  ;(mountainEdgeMesh.material as THREE.MeshBasicMaterial).color.set(p.edge)
  ;(gridMat.uniforms.magenta.value as THREE.Color).set(p.grid)
  ;(scene.fog as THREE.Fog).color.set(p.fog)
  ;(skyMat.uniforms.hor.value as THREE.Color).set(p.sky)
}

function updateCamera(dt: number, now: number) {
  const fx = portrait ? 0.45 : 0.5
  const fy = portrait ? 0.45 : 0.5
  const k = 1 - Math.exp(-4.5 * dt)
  tmpV2.set(
    shipX * fx + Math.sin(now * 1.3) * 0.15,
    (portrait ? 6.5 : 3.8) + shipY * 0.28 * fy + Math.sin(now * 1.7) * 0.12,
    portrait ? 14 : 11.5,
  )
  camera.position.lerp(tmpV2, k)
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 2.4)
    const s = shake * shake * 0.9
    camera.position.x += rand(-s, s)
    camera.position.y += rand(-s, s)
  }
  tmpV.set(shipX * 0.75, 1.0 + shipY * 0.3 + (portrait && !gameStarted ? ATTRACT_LOOK_UP_PORTRAIT : 0), -40)
  camera.lookAt(tmpV)
}

// ---- frame ------------------------------------------------------------------
function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
  last = now
  // Paused: freeze the world behind the PAUSED pill, keep rendering it.
  if (!paused.value) update(dt, now / 1000)
  renderer!.render(scene, camera)
}

function resize() {
  if (!renderer) return
  W = window.innerWidth
  H = window.innerHeight
  portrait = H > W
  laneX = portrait ? 6.5 : 11
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(W, H, false)
  camera.aspect = W / H
  camera.fov = portrait ? 80 : 62
  camera.updateProjectionMatrix()
  if (sunMesh && sunHalo) placeSun()
}

// ---- Esc pause / hold-quit -----------------------------------------------------
function escActive(): boolean {
  return gameStarted && !gameOver
}

function togglePause(): void {
  if (!gameStarted || gameOver) return
  paused.value = !paused.value
  keys.clear()
  touchSteer.active = false
  touchSteer.id = -1
}

// A 3 s Escape hold cancels the run: the same death as losing the last
// shield, so the landing shows MISSION FAILED with the run's score. Times
// here are in seconds (frame() passes now / 1000).
function quitToGameOver(): void {
  if (!gameStarted || gameOver) return
  paused.value = false
  keys.clear()
  touchSteer.active = false
  touchSteer.id = -1
  killCount = 0
  mult = 1
  streakT = 0
  hp = 0
  weaponLevel = 1
  emitHealth()
  deactivateBoss()
  gameOver = true
  deathAt = performance.now() / 1000 + 0.9
  deathEmitted = false
  shipVisible = false
  shipRoot.visible = false
  burst(shipX, shipY, 0, COL_CYAN, 30, 12)
  burst(shipX, shipY, 0, COL_GOLD, 90, 18)
  burst(shipX, shipY, 0, COL_PINK, 70, 14)
  spawnWave(shipX, shipY, 0)
  shake = 1.4
  flash = 1
  emit('over')
}

// ---- input --------------------------------------------------------------------
function doRoll(dir: number) {
  if (!gameStarted || gameOver || !shipVisible || rollT >= 0) return
  rollT = 0
  rollDir = dir >= 0 ? 1 : -1
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Enter' && (!gameStarted || (gameOver && deathEmitted))) {
    startGame()
    return
  }
  // Escape belongs to EscHold (tap = pause, 3 s hold = quit); P pauses too.
  if (e.code === 'Escape') return
  if (e.code === 'KeyP' && !e.repeat) {
    if (gameStarted && !gameOver) togglePause()
    return
  }
  if (!gameStarted || gameOver) return
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault()
  if (e.repeat) return
  keys.add(e.code)
  const now = performance.now()
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    if (now - lastLeftTap < 280) doRoll(-1)
    lastLeftTap = now
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    if (now - lastRightTap < 280) doRoll(1)
    lastRightTap = now
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    const l = keys.has('ArrowLeft') || keys.has('KeyA')
    const r = keys.has('ArrowRight') || keys.has('KeyD')
    doRoll(r && !l ? 1 : l && !r ? -1 : 1)
  }
}
function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.code)
}

const touchSteer = { active: false, id: -1, startX: 0, startY: 0, baseX: 0, baseY: 0 }
let tapStart: { x: number; y: number; t: number } | null = null
let lastTapEnd = 0

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.closest) return false
  return !!el.closest('a, button, input, .social-links, .flip-container, .theme-pager')
}

function onTouchStart(e: TouchEvent) {
  if (isTypingTarget(e.target)) return
  const t = e.touches[0]!
  tapStart = { x: t.clientX, y: t.clientY, t: performance.now() }
  if (!gameStarted || gameOver) return // tap-to-start handled on touchend
  e.preventDefault()
  touchSteer.active = true
  touchSteer.id = t.identifier
  touchSteer.startX = t.clientX
  touchSteer.startY = t.clientY
  touchSteer.baseX = shipX
  touchSteer.baseY = shipY
  shipTX = shipX
  shipTY = shipY
  fireT = FIRE_INTERVAL // fire promptly on touch
}

function onTouchMove(e: TouchEvent) {
  if (!touchSteer.active) return
  for (let i = 0; i < e.touches.length; i++) {
    const t = e.touches[i]!
    if (t.identifier !== touchSteer.id) continue
    e.preventDefault()
    const dx = t.clientX - touchSteer.startX
    const dy = t.clientY - touchSteer.startY
    // displacement relative to touchdown, scaled to the screen
    shipTX = touchSteer.baseX + (dx / Math.max(1, W)) * laneX * 3
    shipTY = touchSteer.baseY - (dy / Math.max(1, H)) * 20
  }
}

function onTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  let isTap = false
  if (tapStart && t) {
    const moved = Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y)
    isTap = moved < 14 && performance.now() - tapStart.t < 400
  }
  tapStart = null
  let stillDown = false
  for (let i = 0; i < e.touches.length; i++) {
    if (e.touches[i]!.identifier === touchSteer.id) stillDown = true
  }
  if (!stillDown) {
    touchSteer.active = false
    touchSteer.id = -1
  }
  if (!gameStarted || gameOver) {
    if (isTap && !isTypingTarget(e.target) && (!gameStarted || deathEmitted)) startGame()
    return
  }
  if (isTap) {
    const now = performance.now()
    if (now - lastTapEnd < 350) doRoll(1)
    lastTapEnd = now
  }
}

function onTouchCancel(e: TouchEvent) {
  onTouchEnd(e)
}

function onBlur() {
  keys.clear()
  touchSteer.active = false
  touchSteer.id = -1
}

// ---- lifecycle -----------------------------------------------------------------
onMounted(() => {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value!, antialias: false, powerPreference: 'low-power' })
  } catch { return }
  if (!renderer) return
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  buildScene()
  applySectorPalette(1)
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('touchstart', onTouchStart, { passive: false })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  window.addEventListener('touchcancel', onTouchCancel)
  window.addEventListener('blur', onBlur)
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
  window.removeEventListener('touchcancel', onTouchCancel)
  window.removeEventListener('blur', onBlur)
  laserMesh?.dispose()
  pillarMesh?.dispose()
  rockMesh?.dispose()
  mountainMesh?.dispose()
  mountainEdgeMesh?.dispose()
  scene?.traverse((o) => {    const m = o as THREE.Mesh
    m.geometry?.dispose?.()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach(x => x.dispose())
    else mat?.dispose?.()
  })
  glowTex?.dispose()
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer = null
})
</script>

<style>
.sfx-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.sfx-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 1;
}
.sfx-flash {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(ellipse at center, rgba(255, 47, 160, 0.55) 0%, rgba(47, 243, 255, 0.25) 60%, transparent 100%);
}
</style>
