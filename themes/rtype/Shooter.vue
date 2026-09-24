<template>
  <canvas ref="canvas" class="rtype-canvas"></canvas>
  <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup>
import EscHold from '../base/EscHold.vue'
import { safeBottom } from '../base/safeBottom'
import { createPixelStage, makeCanvas } from '../base/pixel/stage'
import { drawText, mix, silhouette, sprite, textWidth } from '../base/pixel/sprites'
import { CRATE, CRYSTAL_DOWN, CRYSTAL_UP, DRONE, ENEMY_SHOT, GUNSHIP, POD, ROCK, ROCK_TW, SHIP_ROWS, caveBack, hash1, hexFrame, line, ridgeStrip, ring, rockTexture, weaverFrame } from './pixel'
import { readShipDef } from '~/composables/useShip'
import { useSound } from '~/composables/useSound'

const sound = useSound()
// Throttles: auto-fire and multi-kills would otherwise be a wall of noise.
let lastPewSfx = 0
let lastBoomSfx = 0
let lastTickSfx = 0
function pewSfx() {
  const now = performance.now()
  if (now - lastPewSfx < 90) return
  lastPewSfx = now
  sound.sfx.shoot()
}
function boomSfx(big = false) {
  const now = performance.now()
  if (now - lastBoomSfx < 90) return
  lastBoomSfx = now
  sound.sfx.explosion(big)
}
function tickSfx() {
  const now = performance.now()
  if (now - lastTickSfx < 70) return
  lastTickSfx = now
  sound.sfx.hit()
}
let lastZapSfx = 0
function pewSfxEnemy() {
  const now = performance.now()
  if (now - lastZapSfx < 200) return
  lastZapSfx = now
  sound.sfx.enemyShoot()
}
/**
 * R-Type — an endless R-Type (1987) style side-scrolling shooter, drawn in
 * Neon Shrine's pixel look (2026-09-24, ./pixel.ts): a flight through the
 * shrine caves on the shared pixel stage (themes/base/pixel/), lit by a
 * light map — crystals, the engine, shots and beams light the rock.
 * Same contract as galaga/Galaga.vue and breakout/Breakout.vue: a
 * full-viewport canvas behind the landing overlay, Enter/tap to start,
 * events up to Landing.vue for the HUD. Before the game starts the canvas
 * plays itself (attract mode with a simple autopilot) so the page is alive.
 *
 * Signature mechanics: the FORCE POD (orbiting orb, Shift or double-tap to
 * launch/return, second gun while attached) and the CHARGE BEAM (hold fire
 * >0.8s, release for a piercing wave beam).
 *
 * Orientation (2026-09-05): the game is simulated in WORLD space where the
 * ship always flies +x and the cave walls sit at low/high y. On a landscape
 * screen world == screen. On a portrait screen (taller than wide) the world
 * is rotated 90° so +x points UP: W = screen height, H = screen width, and
 * the pixel stage turns the whole scene once (resize(…, rotate)). Only
 * input (keys, touch) and the upright HUD text need the orientation.
 */
const emit = defineEmits(['score', 'distance', 'lives', 'death', 'restart', 'started'])

const canvas = ref(null)
let stage = null // Neon Shrine's pixel stage (themes/base/pixel/stage.ts)
let animationFrameId = null
let gameRunning = false
let W = 0 // world width (forward axis)
let H = 0 // world height (lateral axis)
let SW = 0 // screen width
let SH = 0 // screen height
let portrait = false // screen taller than wide -> world rotated, ship flies up
let dpr = 1
let bottomBand = 0 // --app-safe-bottom in CSS px; 0 in a browser tab
// Ship limits that keep it and the HUD line under it out of the bottom band
// (landscape: high world y; portrait: low world x). Band 0 = the old limits.
const shipMinX = () => portrait && bottomBand ? bottomBand + 36 : 16
const shipMaxY = () => !portrait && bottomBand ? H - bottomBand - 36 : H - 20

const CYAN = '#2ff3ff' // Neon Dreams design system: cyan is the player & the interface
const ORANGE = '#ff7a1a'
const GOLD = '#ffd23f' // Neon Dreams design system: gold is the reward (combo x4+)
const LIVES = 2
const SHIP_SPEED = 430 // px/s
const BULLET_SPEED = 780
const FIRE_INTERVAL = 0.16 // s between shots while firing
const CHARGE_TIME = 0.8 // s of holding fire for a full charge beam
const BOSS_EVERY = 45 // seconds between bosses
const MAX_PARTICLES = 300
const BEAM_LAYERS = [[-10, CYAN, 3], [0, '#ffffff', 4], [10, CYAN, 3]]

// Game state
let ship = { x: 0, y: 0, alive: true }
let bullets = [] // player shots, travel right
let beams = [] // active charge beams, travel right, pierce
let ebullets = [] // enemy shots, aimed, travel mostly left
let enemies = []
let boss = null
let particles = []
let shockwaves = []
let starsFar = []
let starsMid = []
let starsNear = []
let force = { attached: true, angle: 0, x: 0, y: 0 }
let pickups = []
let pickupIndex = 0
let pickupTimer = 8
let upgrades = { gun: null, beam: null, force: null }
let pickupNotice = null
const POWERUPS = [
  { slot: 'gun', mode: 'spread', label: 'G · SPREAD' },
  { slot: 'beam', mode: 'wide', label: 'B · WIDE' },
  { slot: 'force', mode: 'twin', label: 'F · TWIN' },
  { slot: 'gun', mode: 'rapid', label: 'G · RAPID' },
  { slot: 'beam', mode: 'quick', label: 'B · QUICK' },
  { slot: 'force', mode: 'seeker', label: 'F · SEEKER' },
]
const chargeTime = () => upgrades.beam?.mode === 'quick' ? 0.4 : CHARGE_TIME
function resetPowerups() {
  pickups = []; pickupIndex = 0; pickupTimer = 8
  upgrades = { gun: null, beam: null, force: null }; pickupNotice = null
}

let fireAlt = false // alternate nose/pod gun while attached
let score = 0
let lastScoreSent = -1
let distPx = 0
let lastDistSent = -1
let lives = LIVES
let gameOver = false
let gameStarted = false
// Esc tap pauses (EscHold owns Escape); a 3 s hold quits into game over.
const paused = ref(false)
let keys = {}
let keyFire = false
let touchFire = false
let fireT = 0
let chargeT = 0
let elapsed = 0 // s since (re)start, drives difficulty + boss timer
let spawnT = 0 // s until next spawn
let nextBossAt = BOSS_EVERY
let lastTime = 0
let shake = 0
let invulnUntil = 0
let respawnAt = 0
let deathAt = 0
let deathEmitted = false
let bossCount = 0
const MULT_STEPS = [1, 2, 3, 4, 6, 8]
let multIdx = 0
let mult = 1
let killCount = 0
let multPop = null // { x, y, t, text } rising "x4!" pop near the ship
let beamFlash = 0 // additive flash along the beam, decays fast
let beamShakeT = 0 // holds the shake up for 120 ms after a beam fires
let lastWorld = 90

// Terrain: angular mountain faces over a slowly varying cave envelope.
let scrollX = 0
let terrainSeedA = 1.7
let terrainSeedB = 4.2
let terrainPhase = 0

// ---------------------------------------------------------------- orientation

// Screen (client) -> world.
function toWorld(cx, cy) {
  return portrait ? { x: SH - cy, y: cx } : { x: cx, y: cy }
}

// ---------------------------------------------------------------- setup

function setupCanvas() {
  const c = canvas.value
  if (!c) return
  dpr = window.devicePixelRatio || 1
  SW = c.offsetWidth
  SH = c.offsetHeight
  portrait = SH > SW
  W = portrait ? SH : SW
  H = portrait ? SW : SH
  bottomBand = safeBottom()
  if (!stage) stage = createPixelStage(c)
  // About 3 CSS px per pixel: the ship keeps its old ~40 px size. The
  // minimums measure the world (forward × lateral); portrait turns it.
  const phone = Math.min(SW, SH) < 500
  stage.resize(SW, SH, dpr, phone ? 260 : 400, phone ? 140 : 250, portrait)
  backdropKey = ''
  ship.x = Math.max(shipMinX(), 40, W * 0.18)
  ship.y = ship.y || H / 2
  ship.y = clamp(ship.y, 30, Math.min(H - 30, shipMaxY()))
}

function initStars() {
  starsFar = []
  starsMid = []
  starsNear = []
  for (let i = 0; i < 60; i++) starsFar.push({ x: Math.random() * W, y: Math.random() * H })
  for (let i = 0; i < 32; i++) starsMid.push({ x: Math.random() * W, y: Math.random() * H })
  for (let i = 0; i < 16; i++) starsNear.push({ x: Math.random() * W, y: Math.random() * H })
}

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

function resetTerrain() {
  scrollX = 0
  terrainPhase = 0
  terrainSeedA = 1.7 + Math.random() * 5
  terrainSeedB = 4.2 + Math.random() * 5
}

function gapFrac() {
  if (!gameStarted) return 0.92 // attract mode: calm and shallow
  return Math.max(0.55, 0.85 - elapsed * 0.0025) // 85% -> 55% over ~2 min
}

function centerY() {
  return H * 0.5 + Math.sin(scrollX * 0.0016 + 1.3) * H * 0.06
}

function noiseY(wx, seed) {
  return Math.sin(wx * 0.004 + seed + terrainPhase)
    + 0.5 * Math.sin(wx * 0.009 + seed * 1.7 + terrainPhase * 1.3)
    + 0.25 * Math.sin(wx * 0.021 + seed * 2.3 + terrainPhase * 0.7)
}

function rawCeilYAt(sx) {
  if (!gameStarted) return H * 0.05 + Math.sin((sx + scrollX) * 0.004 + terrainPhase) * H * 0.015
  const gap = H * gapFrac()
  return centerY() - gap / 2 + noiseY(sx + scrollX, terrainSeedA) * H * 0.045
}

function rawFloorYAt(sx) {
  if (!gameStarted) return H * 0.95 + Math.sin((sx + scrollX) * 0.004 + terrainPhase + 2) * H * 0.015
  const gap = H * gapFrac()
  return centerY() + gap / 2 + noiseY(sx + scrollX, terrainSeedB) * H * 0.045
}

// World-anchored angular ridges: the collision surface is the rendered mesh edge.
const TERRAIN_STEP = 64
function wallYAt(sx, side) {
  const wx = sx + scrollX
  const col = Math.floor(wx / TERRAIN_STEP)
  const t = wx / TERRAIN_STEP - col
  const sample = n => {
    const x = n * TERRAIN_STEP - scrollX
    const raw = side === 'ceil' ? rawCeilYAt(x) : rawFloorYAt(x)
    const peak = hash(n * 7 + (side === 'ceil' ? 31 : 79)) ** 3
    return raw + (side === 'ceil' ? 1 : -1) * peak * H * (gameStarted ? .07 : .035)
  }
  return sample(col) * (1 - t) + sample(col + 1) * t
}
function ceilYAt(x) { return wallYAt(x, 'ceil') }
function floorYAt(x) { return wallYAt(x, 'floor') }
function insideTerrain(x, y, r) {
  return [-r, 0, r].some(dx => y - r < ceilYAt(x + dx) || y + r > floorYAt(x + dx))
}

// ---------------------------------------------------------------- state

// The Hangar ship, read live: the same hull the profile shows.
let shipDef = readShipDef()

function resetGame() {
  if (!canvas.value) return
  shipDef = readShipDef()
  score = 0
  lastScoreSent = -1
  distPx = 0
  lastDistSent = -1
  lives = LIVES
  elapsed = 0
  spawnT = 0.8
  nextBossAt = BOSS_EVERY
  bossCount = 0
  boss = null
  bullets = []
  beams = []
  ebullets = []
  enemies = []
  particles = []
  shockwaves = []
  shake = 0
  gameOver = false
  gameStarted = true
  paused.value = false
  keys = {}
  keyFire = false
  ship.x = Math.max(shipMinX(), 40, W * 0.18)
  ship.y = H / 2
  ship.alive = true
  force.attached = true
  force.angle = 0
  fireT = 0
  chargeT = 0
  invulnUntil = 0
  respawnAt = 0
  deathAt = 0
  deathEmitted = false
  multIdx = 0
  mult = 1
  killCount = 0
  multPop = null
  beamFlash = 0
  beamShakeT = 0
  resetTerrain()
  resetPowerups()
  sound.unlock()
  sound.sfx.uiStart()
  sound.music.start('rtype')
  emit('restart')
  emit('started')
  emit('score', 0)
  emit('distance', 0)
  emit('lives', lives)
}

// Attract mode: the game plays itself behind the card until Enter/tap.
function startDemo() {
  gameStarted = false
  sound.music.stop()
  gameOver = false
  paused.value = false
  keys = {}
  keyFire = false
  lives = LIVES
  score = 0
  distPx = 0
  elapsed = 0
  spawnT = 1.2
  boss = null
  bossCount = 0
  nextBossAt = BOSS_EVERY
  bullets = []
  beams = []
  ebullets = []
  enemies = []
  particles = []
  shockwaves = []
  ship.x = Math.max(shipMinX(), 40, W * 0.18)
  ship.y = H / 2
  ship.alive = true
  force.attached = true
  fireT = 0
  chargeT = 0
  invulnUntil = 0
  multIdx = 0
  mult = 1
  killCount = 0
  multPop = null
  beamFlash = 0
  beamShakeT = 0
  resetTerrain()
  resetPowerups()
}

function difficulty() {
  const m = distPx / 50 // meters
  return {
    m,
    world: 150 + Math.min(170, m * 0.4),
    spawnEvery: Math.max(0.5, 1.5 - m * 0.0024),
    speedMul: 1 + Math.min(0.9, m / 900),
    hpBonus: Math.floor(m / 400),
    eshot: 160 + Math.min(160, elapsed * (160 / 180)), // 160 -> 320 px/s over 3 min
  }
}

// ---------------------------------------------------------------- spawn

function corridorClampY(y, x) {
  const lo = ceilYAt(x) + 24
  const hi = floorYAt(x) - 24
  if (lo > hi) return (lo + hi) / 2
  return clamp(y, lo, hi)
}

function spawnYAvoidCenter() {
  // While idle the profile card sits center screen: keep spawns readable
  // by pushing them into the top/bottom thirds.
  const y = Math.random() * H
  if (!gameStarted && y > H * 0.32 && y < H * 0.68) {
    const pushed = y < H / 2 ? Math.random() * H * 0.28 + 10 : H * 0.72 + Math.random() * H * 0.24
    return corridorClampY(pushed, W)
  }
  return corridorClampY(y, W)
}

function spawnWave(d) {
  if (elapsed < 20) {
    // Opening stretch: fast drones only, no gunships — a mediocre human
    // should survive ~45 s.
    const n = 2 + Math.floor(Math.random() * 2)
    const y0 = spawnYAvoidCenter()
    for (let i = 0; i < n; i++) {
      enemies.push({
        kind: 'drone', x: W + 30 + i * 60, y: corridorClampY(y0 + (Math.random() - 0.5) * 120, W),
        vx: (210 + Math.random() * 90) * d.speedMul, size: 13,
        hp: 1 + Math.min(2, d.hpBonus), t: Math.random() * 10, phase: Math.random() * Math.PI * 2, score: 50,
      })
    }
    return
  }
  const roll = Math.random()
  if (roll < 0.42) {
    // Weaver formation: 5–8 spinners in a sine wave.
    const n = 5 + Math.floor(Math.random() * 4)
    const baseY = spawnYAvoidCenter()
    const amp = 40 + Math.random() * 70
    const freq = 1.6 + Math.random() * 1.4
    const phase = Math.random() * Math.PI * 2
    const speed = (150 + Math.random() * 60) * d.speedMul
    for (let i = 0; i < n; i++) {
      enemies.push({
        kind: 'weaver', x: W + 30 + i * 46, baseY, amp, freq, phase: phase + i * 0.45,
        y: baseY, vx: speed, size: 15, hp: 1 + (d.hpBonus > 1 ? 1 : 0), t: Math.random() * 10,
        score: 75,
      })
    }
  } else if (roll < 0.7) {
    // Drone pair/triple: fast diamonds, straight with a wobble.
    const n = 2 + Math.floor(Math.random() * 2)
    const y0 = spawnYAvoidCenter()
    for (let i = 0; i < n; i++) {
      enemies.push({
        kind: 'drone', x: W + 30 + i * 60, y: corridorClampY(y0 + (Math.random() - 0.5) * 120, W),
        vx: (210 + Math.random() * 90) * d.speedMul, size: 13,
        hp: 1 + Math.min(2, d.hpBonus), t: Math.random() * 10, phase: Math.random() * Math.PI * 2, score: 50,
      })
    }
  } else if (roll < 0.88) {
    // Hexagon: slower, more HP, drifts toward the ship's lane.
    enemies.push({
      kind: 'hex', x: W + 40, y: spawnYAvoidCenter(),
      vx: (110 + Math.random() * 50) * d.speedMul, size: 19,
      hp: 2 + Math.min(3, d.hpBonus), t: 0, score: 100,
    })
  } else {
    // Gunship: slow tanky, parks at 70% width and fires aimed shots.
    enemies.push({
      kind: 'gunship', x: W + 50, y: corridorClampY(H * 0.2 + Math.random() * H * 0.6, W),
      vx: (80 + Math.random() * 30) * d.speedMul, size: 24,
      hp: 4 + Math.min(5, d.hpBonus + bossCount), t: 0, score: 250,
      shotT: 1.2 + Math.random(), parked: false, vy: 0,
    })
  }
}

function spawnBoss(d) {
  bossCount++
  if (gameStarted) sound.sfx.ufo()
  const hp = 26 + bossCount * 14 + Math.floor(d.m / 60)
  boss = {
    x: W + 120, y: H / 2, ringR: 64, coreR: 17,
    angle: 0, gap: 0.85, hp, maxHp: hp, t: 0,
    shotT: 1.6, burstT: 4, entering: true,
    beamHit: new Map(),
  }
}

// ---------------------------------------------------------------- effects

function spawnParticles(x, y, color, count, spread) {
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) particles.shift()
    const a = Math.random() * Math.PI * 2
    const s = 40 + Math.random() * (spread || 220)
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      decay: 1.4 + Math.random() * 1.6,
      size: 2 + Math.random() * 3,
      color,
    })
  }
}

function spawnShards(x, y, color, count) {
  // Outline shards: short rotating line segments in the victim's colour.
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) particles.shift()
    const a = Math.random() * Math.PI * 2
    const s = 60 + Math.random() * 220
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      decay: 1.2 + Math.random() * 1.4,
      shard: true,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 10,
      len: 4 + Math.random() * 7,
      color,
    })
  }
}

function addKillScore(base, x, y) {
  killCount++
  if (killCount % 8 === 0 && multIdx < MULT_STEPS.length - 1) {
    multIdx++
    mult = MULT_STEPS[multIdx]
    multPop = { x: x !== undefined ? x : ship.x + 30, y: y !== undefined ? y : ship.y - 30, t: 0, text: 'x' + mult + '!' }
    if (gameStarted) sound.sfx.powerup()
  }
  if (gameStarted) {
    score += base * mult
    if (score !== lastScoreSent) { lastScoreSent = score; emit('score', score) }
  }
}

function triggerShockwave(x, y, color) {
  shockwaves.push({ x, y, radius: 6, life: 1, color: color || ORANGE })
}

function explode(x, y, big) {
  spawnParticles(x, y, '#ffffff', big ? 10 : 6, 160)
  spawnParticles(x, y, ORANGE, big ? 26 : 14, 320)
  spawnParticles(x, y, CYAN, big ? 14 : 8, 240)
  triggerShockwave(x, y)
  shake = Math.min(1, shake + (big ? 0.9 : 0.4))
}

function fireBeam() {
  beams.push({ x: ship.x + 24, y: ship.y, vx: 950, life: 1.4, t: 0, width: upgrades.beam?.mode === 'wide' ? 95 : 60, damage: upgrades.beam?.mode === 'wide' ? 6 : 4 })
  spawnParticles(ship.x + 24, ship.y, CYAN, 12, 200)
  shake = Math.min(1, shake + 0.55)
  beamShakeT = 0.12 // 120 ms screen shake
  beamFlash = 1
  if (gameStarted) sound.sfx.beam()
}

function shootVolley() {
  const spread = upgrades.gun?.mode === 'spread'
  for (const vy of spread ? [-180, 0, 180] : [0]) {
    bullets.push({ x: ship.x + 22, y: ship.y - 3, vx: BULLET_SPEED, vy })
  }
  fireAlt = !fireAlt
  const mode = upgrades.force?.mode
  if ((force.attached && fireAlt) || mode) {
    for (const vy of mode === 'twin' ? [-110, 110] : [0]) {
      bullets.push({ x: force.x + 8, y: force.y, vx: BULLET_SPEED, vy, seeker: mode === 'seeker' })
    }
  }
}
function fireOnce() {
  if (!gameStarted || gameOver || !ship.alive || paused.value) return
  shootVolley()
  sound.sfx.shoot()
  fireT = 0
}
function dropPickup(x, y) {
  if (!gameStarted || gameOver || pickups.length >= 3) return
  const spec = POWERUPS[pickupIndex++ % POWERUPS.length]
  pickups.push({ ...spec, x: clamp(x, ship.x + 90, W - 30), y: corridorClampY(y, x), life: 12 })
}
function updatePowerups(dt, world) {
  if (!gameStarted || gameOver || !ship.alive) return
  for (const slot of ['gun', 'beam', 'force']) {
    if (upgrades[slot] && (upgrades[slot].time -= dt) <= 0) upgrades[slot] = null
  }
  if (pickupNotice && (pickupNotice.time -= dt) <= 0) pickupNotice = null
  pickupTimer -= dt
  if (pickupTimer <= 0) { dropPickup(W - 40, H * (.3 + hash(pickupIndex + 9) * .4)); pickupTimer = 9 }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]
    p.x -= world * .7 * dt
    p.y = corridorClampY(p.y, p.x)
    p.life -= dt
    if (Math.hypot(p.x - ship.x, p.y - ship.y) < 30) {
      upgrades[p.slot] = { mode: p.mode, label: p.label, time: 20 }
      pickupNotice = { label: p.label, time: 2.5 }
      spawnParticles(p.x, p.y, GOLD, 16, 150)
      triggerShockwave(p.x, p.y, GOLD)
      pickups.splice(i, 1)
    } else if (p.life <= 0 || p.x < -30) pickups.splice(i, 1)
  }
}

function killEnemyAt(i) {
  const e = enemies[i]
  explode(e.x, e.y, e.kind === 'gunship')
  if (gameStarted) boomSfx(e.kind === 'gunship')
  spawnShards(e.x, e.y, ORANGE, e.kind === 'gunship' ? 14 : 8)
  addKillScore(e.score, e.x, e.y)
  enemies.splice(i, 1)
}

function onShipHit(now) {
  if (now < invulnUntil || !ship.alive) return
  explode(ship.x, ship.y, true)
  spawnShards(ship.x, ship.y, CYAN, 12)
  multIdx = 0 // taking a hit resets the streak multiplier to x1
  mult = 1
  killCount = 0
  multPop = null
  if (!gameStarted) {
    // Autopilot got clipped: respawn quietly, the show goes on.
    ship.alive = false
    respawnAt = now + 1.0
    invulnUntil = now + 3.0
    return
  }
  upgrades = { gun: null, beam: null, force: null }
  pickups = []
  chargeT = 0
  lives--
  emit('lives', lives)
  ship.alive = false
  if (lives <= 0) {
    gameOver = true
    deathAt = now
    sound.sfx.explosion(true)
    sound.sfx.gameOver()
    sound.music.stop()
  } else {
    sound.sfx.lifeLost()
    respawnAt = now + 1.2
    invulnUntil = respawnAt + 2.5 // 2.5 s blinking invulnerability after respawn
  }
}

// ---------------------------------------------------------------- Esc pause / hold-quit

function escActive() {
  return gameStarted && !gameOver
}

function togglePause() {
  if (!gameStarted || gameOver) return
  paused.value = !paused.value
  keys = {}
  keyFire = false
  if (paused.value) sound.music.stop(false)
  else sound.music.start('rtype')
}

// A 3 s Escape hold cancels the run: the same death as losing the last ship,
// so the landing shows GAME OVER with the run's score. Times are in seconds
// (update() works in nowMs / 1000).
function quitToGameOver() {
  if (!gameStarted || gameOver) return
  paused.value = false
  keys = {}
  keyFire = false
  explode(ship.x, ship.y, true)
  spawnShards(ship.x, ship.y, CYAN, 12)
  lives = 0
  emit('lives', lives)
  ship.alive = false
  gameOver = true
  deathAt = performance.now() / 1000
  sound.sfx.explosion(true)
  sound.sfx.gameOver()
  sound.music.stop()
}

// ---------------------------------------------------------------- update

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function autopilot(dt, now) {
  // Simple dodge: find the nearest threat ahead, swim away from its lane.
  let threatY = null
  let bestX = Infinity
  for (let i = 0; i < ebullets.length; i++) {
    const b = ebullets[i]
    if (b.x > ship.x - 30 && b.x < ship.x + 430 && b.x < bestX) {
      bestX = b.x
      threatY = b.y
    }
  }
  if (threatY === null) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      if (e.x > ship.x && e.x < ship.x + 380 && e.x < bestX) {
        bestX = e.x
        threatY = e.y
      }
    }
  }
  let targetY = H / 2 + Math.sin(now * 0.7) * H * 0.1
  if (threatY !== null) targetY = ship.y < threatY ? ship.y - 130 : ship.y + 130
  // Respect the cave walls.
  const margin = 34
  targetY = clamp(targetY, ceilYAt(ship.x) + margin, floorYAt(ship.x) - margin)
  targetY = clamp(targetY, 24, Math.min(H - 24, shipMaxY()))
  if (ship.y < ceilYAt(ship.x) + 40 || ship.y > floorYAt(ship.x) - 40) {
    targetY = (ceilYAt(ship.x) + floorYAt(ship.x)) / 2
  }
  const targetX = clamp(Math.max(shipMinX(), 40, W * 0.18), 20, W * 0.45)
  ship.x += clamp(targetX - ship.x, -1, 1) * SHIP_SPEED * 0.5 * dt
  ship.y += clamp(targetY - ship.y, -1, 1) * SHIP_SPEED * 0.9 * dt
}

function update(nowMs) {
  const now = nowMs / 1000
  let dt = (nowMs - lastTime) / 1000
  if (!(dt > 0)) dt = 0.016
  dt = Math.min(dt, 0.05) // clamp to 50ms for frame-rate independence
  lastTime = nowMs
  const demo = !gameStarted
  const d = difficulty()

  // Scroll the world (attract mode drifts slower, stays calm).
  const world = demo ? 90 : d.world
  lastWorld = world
  distPx += demo ? 0 : world * dt
  if (!demo) {
    const m = Math.floor(distPx / 50)
    if (m !== lastDistSent) {
      lastDistSent = m
      emit('distance', m)
      score += 1 // distance trickle
      if (score !== lastScoreSent) { lastScoreSent = score; emit('score', score) }
    }
  }
  elapsed += dt

  // Cave walls flow past (position is a function of scrollX).
  scrollX += world * dt
  terrainPhase += dt * 0.25

  // Starfield: 3 parallax layers drift left at different rates.
  for (let i = 0; i < starsFar.length; i++) {
    const s = starsFar[i]
    s.x -= (world * 0.15 + 6) * dt
    if (s.x < -4) { s.x = W + 4; s.y = Math.random() * H }
  }
  for (let i = 0; i < starsMid.length; i++) {
    const s = starsMid[i]
    s.x -= (world * 0.35 + 10) * dt
    if (s.x < -4) { s.x = W + 4; s.y = Math.random() * H }
  }
  for (let i = 0; i < starsNear.length; i++) {
    const s = starsNear[i]
    s.x -= (world * 0.8 + 20) * dt
    if (s.x < -8) { s.x = W + 8; s.y = Math.random() * H }
  }


  // Respawn handling.
  if (!ship.alive && !gameOver && now >= respawnAt) {
    ship.alive = true
    ship.x = Math.max(shipMinX(), 40, W * 0.18)
    ship.y = H / 2
    force.attached = true
    force.angle = 0
  }

  // Ship movement.
  if (ship.alive && !gameOver) {
    if (demo) {
      autopilot(dt, now)
    } else {
      const up = keys['ArrowUp'] || keys['KeyW']
      const dn = keys['ArrowDown'] || keys['KeyS']
      const lf = keys['ArrowLeft'] || keys['KeyA']
      const rt = keys['ArrowRight'] || keys['KeyD']
      let mx = (rt ? 1 : 0) - (lf ? 1 : 0)
      let my = (dn ? 1 : 0) - (up ? 1 : 0)
      if (portrait) {
        // Up on the keyboard is forward (+x); left/right is lateral (y).
        const f = my
        my = mx
        mx = -f
      }
      if (touchActive && touchTarget.active) {
        const dx = touchTarget.x - ship.x
        const dy = touchTarget.y - ship.y
        const dead = 6
        mx = Math.abs(dx) > dead ? clamp(dx / 60, -1, 1) : 0
        my = Math.abs(dy) > dead ? clamp(dy / 60, -1, 1) : 0
        const sp = SHIP_SPEED * 1.15
        ship.x += mx * sp * dt
        ship.y += my * sp * dt
      } else {
        if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2 }
        ship.x += mx * SHIP_SPEED * dt
        ship.y += my * SHIP_SPEED * dt
      }
    }
    ship.x = clamp(ship.x, shipMinX(), W * 0.45)
    ship.y = clamp(ship.y, 20, shipMaxY())
    // Cave walls bite; the rendered angular rim is also the collision surface.
    if (!demo && now >= invulnUntil) {
      if (insideTerrain(ship.x, ship.y, 9)) {
        onShipHit(now)
      }
    }
  }

  // Force pod orbit / flight.
  force.angle += dt * 4.2
  if (force.attached) {
    force.x = ship.x + Math.cos(force.angle) * 30
    force.y = ship.y + Math.sin(force.angle) * 30
  } else {
    force.x += 900 * dt
    force.y += (ship.y - force.y) * Math.min(1, dt * 2)
    const maxX = ship.x + W * 0.45
    if (force.x > maxX) force.x = maxX
  }

  // Firing: hold for auto-fire, hold >0.8s then release for charge beam.
  updatePowerups(dt, world)
  const firing = demo || keyFire || touchFire
  if (firing && ship.alive && !gameOver) {
    chargeT += dt
    fireT += dt
    if (fireT >= (upgrades.gun?.mode === 'rapid' ? .075 : FIRE_INTERVAL)) {
      fireT = 0
      shootVolley()
      if (!demo) pewSfx()
    }
    if (demo && chargeT > 1.4) {
      // Autopilot shows off the beam now and then.
      fireBeam()
      chargeT = 0
    }
  } else {
    if (!demo && chargeT >= chargeTime() && ship.alive && !gameOver) fireBeam()
    chargeT = 0
    fireT = FIRE_INTERVAL // first shot immediate on press
  }

  // Player bullets.
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    if (b.seeker) {
      const target = enemies.filter(e => e.x > b.x).sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0] || boss
      if (target) b.vy += (clamp((target.y - b.y) * 5, -360, 360) - b.vy) * Math.min(1, dt * 8)
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.x > W + 20 || b.y < -30 || b.y > H + 30) bullets.splice(i, 1)
  }

  // Charge beams: fly right, pierce everything, eat enemy bullets.
  for (let i = beams.length - 1; i >= 0; i--) {
    const bm = beams[i]
    bm.t += dt
    bm.x += bm.vx * dt
    bm.life -= dt
    if (bm.life <= 0 || bm.x - 120 > W) { beams.splice(i, 1); continue }
    for (let j = ebullets.length - 1; j >= 0; j--) {
      const eb = ebullets[j]
      if (Math.abs(eb.x - bm.x) < 90 && Math.abs(eb.y - bm.y) < bm.width) {
        spawnParticles(eb.x, eb.y, CYAN, 2, 120)
        ebullets.splice(j, 1)
      }
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j]
      if (e.beamHit === bm) continue
      if (Math.abs(e.x - bm.x) < 70 && Math.abs(e.y - bm.y) < bm.width) {
        e.beamHit = bm
        e.hp -= bm.damage
        spawnParticles(e.x, e.y, '#ffffff', 6, 200)
        if (e.hp <= 0) killEnemyAt(j)
      }
    }
    if (boss && !boss.beamHit.has(bm)) {
      const dx = boss.x - bm.x
      const dy = boss.y - bm.y
      if (Math.abs(dx) < 90 && Math.hypot(dx, dy) < boss.ringR + 30) {
        boss.beamHit.set(bm, 1)
        boss.hp -= bm.damage
        spawnParticles(boss.x, boss.y, '#ffffff', 8, 240)
        if (boss.hp <= 0) killBoss()
      }
    }
  }

  // Spawning (slower + center-safe while idle; throttled during boss).
  spawnT -= dt
  if (spawnT <= 0 && !gameOver) {
    spawnWave(d)
    spawnT = (demo ? 2.2 : d.spawnEvery) * (boss ? 1.8 : 1) * (0.8 + Math.random() * 0.4)
  }

  // Boss timer: first at ~45s, then every ~45s, endless.
  if (!boss && elapsed >= nextBossAt && !gameOver) spawnBoss(d)
  if (boss) updateBoss(dt, d, now)

  // Enemies.
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]
    e.t += dt
    if (e.kind === 'weaver') {
      e.x -= e.vx * dt
      e.y = e.baseY + Math.sin(e.t * e.freq + e.phase) * e.amp
    } else if (e.kind === 'drone') {
      e.x -= e.vx * dt
      e.y += Math.sin(e.t * 3 + e.phase) * 40 * dt
    } else if (e.kind === 'hex') {
      e.x -= e.vx * dt
      e.y += Math.cos(e.t * 1.2) * 50 * dt
      e.y += clamp(ship.y - e.y, -1, 1) * 24 * dt
    } else if (e.kind === 'gunship') {
      if (!e.parked) {
        e.x -= e.vx * dt
        if (e.x < W * 0.72) e.parked = true
      } else {
        e.y += Math.sin(e.t * 0.9) * 46 * dt
      }
      if (e.parked && !demo && ship.alive && !gameOver) {
        e.shotT -= dt
        if (e.shotT <= 0) {
          e.shotT = Math.max(0.9, 1.9 - d.m * 0.001)
          const dx = ship.x - e.x
          const dy = ship.y - e.y
          const len = Math.hypot(dx, dy) || 1
          const sp = d.eshot
          ebullets.push({ x: e.x - 20, y: e.y, vx: dx / len * sp, vy: dy / len * sp })
          pewSfxEnemy()
        }
      }
    }
    // Sine-path followers never fly through the wall fill.
    if (e.kind === 'weaver' || e.kind === 'drone' || e.kind === 'hex' || e.kind === 'gunship') {
      e.y = corridorClampY(e.y, e.x)
    }
    if (e.x < -60) { enemies.splice(i, 1); continue }
    // Ram check.
    if (ship.alive && !gameOver && now >= invulnUntil) {
      const dx = e.x - ship.x
      const dy = e.y - ship.y
      const r = e.size * 0.6 + 11
      if (dx * dx + dy * dy < r * r) {
        onShipHit(now)
        e.hp -= 2
        spawnParticles(e.x, e.y, ORANGE, 6, 200)
        if (e.hp <= 0) killEnemyAt(i)
        continue
      }
    }
  }

  // Force pod: rams enemies while launched, eats enemy bullets always.
  if (ship.alive && !gameOver) {
    if (!force.attached) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j]
        const dx = e.x - force.x
        const dy = e.y - force.y
        const r = e.size * 0.6 + 12
        if (dx * dx + dy * dy < r * r) {
          e.hp -= 60 * dt
          if (Math.random() < 0.3) spawnParticles(force.x, force.y, CYAN, 1, 140)
          if (e.hp <= 0) killEnemyAt(j)
        }
      }
    }
    const eatR = force.attached ? 14 : 18
    for (let j = ebullets.length - 1; j >= 0; j--) {
      const eb = ebullets[j]
      const dx = eb.x - force.x
      const dy = eb.y - force.y
      if (dx * dx + dy * dy < eatR * eatR) {
        spawnParticles(eb.x, eb.y, CYAN, 3, 140)
        ebullets.splice(j, 1)
      }
    }
  }

  // Bullet vs enemy.
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    let consumed = false
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j]
      const dx = b.x - e.x
      const dy = b.y - e.y
      const r = e.size * 0.6 + 5
      if (dx * dx + dy * dy < r * r) {
        e.hp--
        spawnParticles(b.x, b.y, ORANGE, 3, 160)
        bullets.splice(i, 1)
        consumed = true
        if (e.hp <= 0) killEnemyAt(j)
        else if (gameStarted) tickSfx()
        break
      }
    }
    if (consumed) continue
    if (boss) {
      const dx = b.x - boss.x
      const dy = b.y - boss.y
      const dist = Math.hypot(dx, dy)
      if (dist < boss.ringR + 12) {
        // The ring blocks shots; the gap lets them through to the core.
        let ang = Math.atan2(dy, dx) - boss.angle
        while (ang > Math.PI) ang -= Math.PI * 2
        while (ang < -Math.PI) ang += Math.PI * 2
        const throughGap = Math.abs(ang) < boss.gap / 2
        if (Math.abs(dist - boss.ringR) < 12 && !throughGap) {
          spawnParticles(b.x, b.y, ORANGE, 3, 140)
          bullets.splice(i, 1)
        } else if (dist < boss.coreR + 6) {
          boss.hp--
          spawnParticles(b.x, b.y, '#ffffff', 4, 180)
          bullets.splice(i, 1)
          if (boss.hp <= 0) killBoss()
          else if (gameStarted) tickSfx()
        }
      }
    }
  }

  // Enemy bullets.
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
      ebullets.splice(i, 1)
      continue
    }
    if (insideTerrain(b.x, b.y, 2)) {
      // Enemy fire dies on the cave walls.
      spawnParticles(b.x, b.y, ORANGE, 2, 100)
      ebullets.splice(i, 1)
      continue
    }
    if (ship.alive && !gameOver && now >= invulnUntil) {
      const dx = b.x - ship.x
      const dy = b.y - ship.y
      if (dx * dx + dy * dy < 13 * 13) {
        ebullets.splice(i, 1)
        onShipHit(now)
      }
    }
  }

  // Boss vs ship ram.
  if (boss && ship.alive && !gameOver && now >= invulnUntil) {
    const dx = boss.x - ship.x
    const dy = boss.y - ship.y
    if (dx * dx + dy * dy < (boss.ringR + 8) * (boss.ringR + 8)) onShipHit(now)
  }

  // Particles, shockwaves, shake, beam flash, multiplier pop.
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.985
    p.vy *= 0.985
    if (p.shard) p.rot += p.rotV * dt
    p.life -= p.decay * dt
    if (p.life <= 0) particles.splice(i, 1)
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]
    sw.radius += 460 * dt
    sw.life -= 1.7 * dt
    if (sw.life <= 0) shockwaves.splice(i, 1)
  }
  shake = Math.max(0, shake - 2.6 * dt)
  if (beamShakeT > 0) {
    beamShakeT -= dt
    shake = Math.max(shake, 0.55) // hold the beam shake for its 120 ms
  }
  beamFlash = Math.max(0, beamFlash - 6 * dt)
  if (multPop) {
    multPop.t += dt
    if (multPop.t > 1) multPop = null
  }

  // Delayed death emit so the explosion plays out (breakout pattern).
  if (gameOver && !deathEmitted && now - deathAt > 0.9) {
    deathEmitted = true
    emit('death')
  }
}

function updateBoss(dt, d, now) {
  boss.t += dt
  if (boss.entering) {
    boss.x -= 160 * dt
    if (boss.x <= W * 0.78) { boss.x = W * 0.78; boss.entering = false }
  } else {
    boss.y = H / 2 + Math.sin(boss.t * 0.7) * H * 0.22
    boss.x = W * 0.78 + Math.sin(boss.t * 0.4) * 30
  }
  boss.angle += dt * 0.65
  if (!gameStarted) return // attract-mode boss is scenery, it never shoots
  if (ship.alive && !gameOver && !boss.entering) {
    boss.shotT -= dt
    if (boss.shotT <= 0) {
      boss.shotT = Math.max(0.8, 1.4 - bossCount * 0.1)
      const dx = ship.x - boss.x
      const dy = ship.y - boss.y
      const len = Math.hypot(dx, dy) || 1
      const sp = d.eshot * 0.9
      ebullets.push({ x: boss.x - 30, y: boss.y, vx: dx / len * sp, vy: dy / len * sp })
    }
    boss.burstT -= dt
    if (boss.burstT <= 0) {
      boss.burstT = 4.2
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI * 2 / 8) * k + boss.angle
        ebullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * d.eshot * 0.6, vy: Math.sin(a) * d.eshot * 0.6 })
      }
    }
  }
}

function killBoss() {
  explode(boss.x, boss.y, true)
  triggerShockwave(boss.x, boss.y, CYAN)
  spawnShards(boss.x, boss.y, ORANGE, 20)
  spawnShards(boss.x, boss.y, CYAN, 10)
  addKillScore(2000, boss.x, boss.y)
  dropPickup(boss.x, boss.y)
  if (gameStarted) {
    boomSfx(true)
    sound.sfx.levelClear()
  }
  boss = null
  nextBossAt = elapsed + BOSS_EVERY
}

// ---------------------------------------------------------------- draw
// Everything below draws in the stage's logical pixels, in world
// orientation (the stage turns the scene for portrait). L() takes a CSS
// world coordinate to the pixel grid; hudAt() maps a world point to the
// upright HUD layer. Rock, ship and enemies are lit by the light map;
// shots, beams, sparks and crystals glow.

function L(v) {
  return Math.round(v / stage.k)
}

// World point -> upright HUD pixel (portrait: screen (y, SH - x)).
function hudAt(wx, wy) {
  if (!stage.rotated) return { x: L(wx), y: L(wy) }
  return { x: L(wy), y: stage.hh - L(wx) }
}

function hudText(text, x, y, color, center = false) {
  const w = textWidth(text)
  drawText(stage.hud, text, Math.round(center ? x - w / 2 : x), Math.round(y), color, '#0b0616')
}

// --- backdrop: the far cave, parallax ridges, stars ---------------------

let backdropKey = ''
let backC = null
let ridges = [] // { c, speed, top }
function buildBackdrop() {
  const key = stage.vw + 'x' + stage.vh
  if (key === backdropKey) return
  backdropKey = key
  const vw = stage.vw
  const vh = stage.vh
  backC = caveBack(vw, vh)
  const w = 512
  const far = Math.max(8, Math.round(vh * 0.26))
  const mid = Math.max(6, Math.round(vh * 0.16))
  ridges = [
    // Quiet silhouettes: dark bodies with a faint rim, so only the real walls read as walls.
    { c: ridgeStrip(w, far, '#1c1030', '#2a1a4c', 3, true), speed: 0.2, top: true },
    { c: ridgeStrip(w, far, '#1c1030', '#2a1a4c', 7, false), speed: 0.2, top: false },
    { c: ridgeStrip(w, mid, '#140b26', '#43246e', 11, true), speed: 0.45, top: true },
    { c: ridgeStrip(w, mid, '#140b26', '#43246e', 13, false), speed: 0.45, top: false },
  ]
}

function drawBackdrop(g, now) {
  g.drawImage(backC, 0, 0)
  // Stars: far dim, mid bright, near streaks (their motion lives in update()).
  g.fillStyle = '#6a5fa0'
  for (let i = 0; i < starsFar.length; i++) g.fillRect(L(starsFar[i].x), L(starsFar[i].y), 1, 1)
  for (let i = 0; i < starsMid.length; i++) {
    const s = starsMid[i]
    g.fillStyle = Math.sin(now * 3 + i) > 0.6 ? '#fff4ff' : '#cfc6ff'
    g.fillRect(L(s.x), L(s.y), 1, 1)
  }
  const streak = Math.max(1, Math.round((3 + lastWorld * 0.03) / stage.k))
  for (let i = 0; i < starsNear.length; i++) {
    const s = starsNear[i]
    g.fillStyle = '#8f86b8'
    g.fillRect(L(s.x) + 1, L(s.y), streak, 1)
    g.fillStyle = '#fff4ff'
    g.fillRect(L(s.x), L(s.y), 1, 1)
  }
  const off = scrollX / stage.k
  for (const r of ridges) {
    const w = r.c.width
    let x = -Math.floor(off * r.speed) % w
    if (x > 0) x -= w
    const y = r.top ? 0 : stage.vh - r.c.height
    for (; x < stage.vw; x += w) g.drawImage(r.c, x, y)
  }
}

// --- terrain: rock walls with a lit rim, moss, drips and crystals --------

let rockTex = null
let terrC = null
let tg = null
let rockPat = null
let ceilA = new Int16Array(0)
let floorA = new Int16Array(0)
const CRYSTAL_LOOKS = [
  { pal: { x: '#b01874', X: '#ff2fa0' }, glow: '#ff2fa0' },
  { pal: { x: '#1a9fc4', X: '#2ff3ff' }, glow: '#2ff3ff' },
  { pal: { x: '#c4861c', X: '#ffd23f' }, glow: '#ffd23f' },
]

function drawTerrain(g) {
  const k = stage.k
  const vw = stage.vw
  const vh = stage.vh
  if (!terrC || terrC.width !== vw || terrC.height !== vh) {
    terrC = makeCanvas(vw, vh)
    tg = terrC.getContext('2d')
    rockPat = null
    ceilA = new Int16Array(vw + 1)
    floorA = new Int16Array(vw + 1)
  }
  if (!rockTex) rockTex = rockTexture()
  if (!rockPat) rockPat = tg.createPattern(rockTex, 'repeat')
  // World-anchored columns: column lx shows world pixel u = base + lx.
  const off = scrollX / k
  const base = Math.floor(off)
  const frac = off - base
  tg.globalCompositeOperation = 'source-over'
  tg.clearRect(0, 0, vw, vh)
  tg.fillStyle = '#000'
  for (let lx = 0; lx <= vw; lx++) {
    const x = (lx - frac + 0.5) * k
    const cy = Math.round(ceilYAt(x) / k)
    const fy = Math.round(floorYAt(x) / k)
    ceilA[lx] = cy
    floorA[lx] = fy
    if (cy > 0) tg.fillRect(lx, 0, 1, cy)
    if (fy < vh) tg.fillRect(lx, fy, 1, vh - fy)
  }
  tg.globalCompositeOperation = 'source-in'
  tg.save()
  tg.translate(-(((base % ROCK_TW) + ROCK_TW) % ROCK_TW), 0)
  tg.fillStyle = rockPat
  tg.fillRect(0, 0, vw + ROCK_TW, vh)
  tg.restore()
  tg.globalCompositeOperation = 'source-over'
  for (let lx = 0; lx < vw; lx++) {
    const u = base + lx
    const cy = ceilA[lx]
    const fy = floorA[lx]
    // Floor: lit top edge, moss on it.
    tg.fillStyle = ROCK.rim
    tg.fillRect(lx, fy, 1, 1)
    tg.fillStyle = ROCK.rockL
    tg.fillRect(lx, fy + 1, 1, 1)
    const m = hash1(u, 21)
    if (m > 0.5) {
      tg.fillStyle = m > 0.8 ? ROCK.moss : ROCK.mossD
      tg.fillRect(lx, fy - 1, 1, m > 0.9 ? 2 : 1)
      if (m > 0.9) { tg.fillStyle = ROCK.moss; tg.fillRect(lx, fy - 2, 1, 1) }
    }
    // Ceiling: a dark underside and drips.
    tg.fillStyle = ROCK.rockDD
    tg.fillRect(lx, cy - 1, 1, 1)
    const d = hash1(u, 22)
    if (d > 0.84) {
      const len = 1 + Math.floor(hash1(u, 23) * 4)
      tg.fillStyle = ROCK.rockD
      tg.fillRect(lx, cy, 1, len)
      tg.fillStyle = ROCK.rockL
      tg.fillRect(lx, cy + len - 1, 1, 1)
    }
  }
  g.drawImage(terrC, 0, 0)
  // Crystals at world-anchored spots on the rims; they light the rock round them.
  for (let lx = -4; lx < vw + 4; lx++) {
    const u = base + lx
    if (u % 23 !== 0) continue
    const h = hash1(u, 31)
    if (h < 0.3) continue
    const col = Math.max(0, Math.min(vw, lx))
    const look = CRYSTAL_LOOKS[Math.floor(hash1(u, 32) * 3)]
    const onFloor = hash1(u, 33) > 0.45
    const spr = sprite(onFloor ? CRYSTAL_UP : CRYSTAL_DOWN, look.pal)
    const x = lx - 2
    const y = onFloor ? floorA[col] - spr.height + 2 : ceilA[col] - 2
    g.drawImage(spr, x, y)
    stage.emit(x, y, spr.width, spr.height)
    stage.light(x + 2.5, y + 3, 22, look.glow, 0.85)
  }
}

// --- sprites ---------------------------------------------------------------

let shipSprKey = ''
let shipSpr = null
function shipSprite() {
  const c = shipDef.colors
  const key = shipDef.variant + c.hull + c.trim
  if (key !== shipSprKey) {
    shipSprKey = key
    shipSpr = sprite(SHIP_ROWS[shipDef.variant === 'vandal' ? 'vandal' : 'dart'], { c: c.hull, C: mix(c.hull, '#0b0616', 0.45), w: mix(c.hull, '#ffffff', 0.55), T: c.trim })
  }
  return shipSpr
}

function drawShip(now) {
  const blink = now < invulnUntil && Math.floor(now * 12) % 2 === 0
  if (blink) return
  const g = stage.g
  const spr = shipSprite()
  const cx = L(ship.x)
  const cy = L(ship.y)
  const x0 = cx - Math.floor(spr.width * 0.55)
  const y0 = cy - Math.floor(spr.height / 2)
  // Engine flame behind the tail: flickering pixels in orange and the ship's glow.
  const fl = 2 + Math.floor(Math.random() * 4)
  g.fillStyle = '#ff8a3d'
  g.fillRect(x0 - fl, cy - 1, fl, 3)
  g.fillStyle = shipDef.colors.glow || '#ffd23f'
  g.fillRect(x0 - Math.ceil(fl / 2), cy, Math.ceil(fl / 2), 1)
  g.drawImage(spr, x0, y0)
  stage.emit(x0 - fl, cy - 1, fl, 3)
  stage.light(x0 - 2, cy, 16, '#ff8a3d', 0.8)
  stage.light(cx, cy, 14, shipDef.colors.hull, 0.45)
}

function drawForce() {
  const g = stage.g
  const trim = shipDef.colors.trim
  const spr = sprite(POD, { T: trim, U: mix(trim, '#0b0616', 0.45) })
  const x = L(force.x)
  const y = L(force.y)
  if (!force.attached) {
    g.fillStyle = CYAN
    g.fillRect(x - Math.round(60 / stage.k), y, Math.round(52 / stage.k), 1)
  }
  g.drawImage(spr, x - 3, y - 3)
  // A spark turning round the pod.
  const a = force.angle * 0.7
  g.fillStyle = '#ffffff'
  g.fillRect(Math.round(x + Math.cos(a) * 4), Math.round(y + Math.sin(a) * 4), 1, 1)
  stage.emit(x - 3, y - 3, 7, 7)
  stage.light(x, y, 12, trim, 0.8)
}

function drawEnemy(g, e, now) {
  let rows
  if (e.kind === 'drone') rows = DRONE[Math.floor(now * 6 + (e.phase || 0)) % 2]
  else if (e.kind === 'weaver') rows = weaverFrame((e.t * 3 + e.phase) / (Math.PI * 2 / 3))
  else if (e.kind === 'hex') rows = hexFrame((e.t * 0.8) / (Math.PI / 3))
  else rows = GUNSHIP
  const spr = sprite(rows)
  const x = L(e.x) - Math.floor(spr.width / 2)
  const y = L(e.y) - Math.floor(spr.height / 2)
  g.drawImage(spr, x, y)
  stage.light(L(e.x), L(e.y), Math.max(8, e.size / stage.k * 1.6), '#ff8a3d', 0.55)
}

function drawBoss(g) {
  const b = boss
  const cx = L(b.x)
  const cy = L(b.y)
  const R = Math.max(6, L(b.ringR))
  const sides = 10
  const gapHalf = b.gap / 2
  const inGap = a => {
    let da = a - b.angle
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    return Math.abs(da) < gapHalf
  }
  // The ring: ten plates with outline, orange face and a gold top edge.
  for (const [w, col, rr] of [[4, '#0b0616', R], [2, '#ff8a3d', R], [1, '#ffd23f', R - 1]]) {
    for (let i = 0; i < sides; i++) {
      const a0 = b.angle + (Math.PI * 2 / sides) * i
      const a1 = a0 + Math.PI * 2 / sides
      if (inGap(a0) || inGap(a1) || inGap((a0 + a1) / 2)) continue
      line(g, cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr, col, w)
    }
  }
  // Gap markers.
  for (const sd of [-1, 1]) {
    const a = b.angle + sd * gapHalf
    line(g, cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3), cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3), '#ffffff', 1)
  }
  // Core: a pulsing orb.
  const pulse = 0.7 + 0.3 * Math.sin(b.t * 5)
  const cr = Math.max(3, L(b.coreR))
  ring(g, cx, cy, cr + 1, '#0b0616')
  for (let r2 = cr; r2 >= 1; r2--) ring(g, cx, cy, r2, r2 > cr - 2 ? '#9e1638' : '#ff8a3d')
  g.fillStyle = '#ffffff'
  const pr = Math.max(1, Math.round(2 * pulse))
  g.fillRect(cx - pr + 1, cy - pr + 1, pr * 2 - 1, pr * 2 - 1)
  stage.emit(cx - pr, cy - pr, pr * 2, pr * 2)
  stage.light(cx, cy, R * 1.6, '#ff8a3d', 0.5 + 0.4 * pulse)
  // HP bar above the ring.
  const bw = Math.round(130 / stage.k)
  const by = cy - R - 6
  g.fillStyle = '#0b0616'
  g.fillRect(cx - (bw >> 1) - 1, by - 1, bw + 2, 4)
  g.fillStyle = '#5b2a1c'
  g.fillRect(cx - (bw >> 1), by, bw, 2)
  g.fillStyle = '#ff8a3d'
  g.fillRect(cx - (bw >> 1), by, Math.round(bw * Math.max(0, b.hp / b.maxHp)), 2)
}

// --- glowing things (after the light map) -----------------------------------

function drawGlowing(g) {
  // Shockwaves: pixel rings.
  for (let i = 0; i < shockwaves.length; i++) {
    const sw = shockwaves[i]
    g.globalAlpha = Math.max(0, sw.life)
    ring(g, L(sw.x), L(sw.y), L(sw.radius), sw.color)
    if (sw.life > 0.6) ring(g, L(sw.x), L(sw.y), L(sw.radius) - 1, '#ffffff')
  }
  g.globalAlpha = 1
  // Particles: dots and shards.
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5))
    if (p.shard) {
      const len = Math.max(1, p.len / stage.k)
      const dx = Math.cos(p.rot) * len
      const dy = Math.sin(p.rot) * len
      line(g, L(p.x) - dx, L(p.y) - dy, L(p.x) + dx, L(p.y) + dy, p.color, 1)
    } else {
      const n = Math.max(1, Math.round(p.size / stage.k))
      g.fillStyle = p.color
      g.fillRect(L(p.x) - (n >> 1), L(p.y) - (n >> 1), n, n)
    }
  }
  g.globalAlpha = 1
  // Enemy shots: orange orbs with a white core.
  const es = sprite(ENEMY_SHOT, { O: '#ff3b5c' })
  for (let i = 0; i < ebullets.length; i++) g.drawImage(es, L(ebullets[i].x) - 2, L(ebullets[i].y) - 2)
  // Player shots: cyan bolts, white-hot core.
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i]
    const x = L(b.x)
    const y = L(b.y)
    g.fillStyle = CYAN
    g.fillRect(x - 2, y, 4, 1)
    g.fillStyle = '#ffffff'
    g.fillRect(x - 1, y, 2, 1)
  }
  // Charge beams: a fat sine wave in three layers.
  for (let i = 0; i < beams.length; i++) {
    const bm = beams[i]
    g.globalAlpha = Math.min(1, bm.life)
    for (const [off, color, wdt] of BEAM_LAYERS) {
      let px = null
      let py = null
      for (let x = -20; x <= 110; x += 6) {
        const wy = bm.y + off * 0.4 + Math.sin(x * 0.09 + bm.t * 22) * (bm.width * 0.35)
        const lx = L(bm.x + x)
        const ly = L(wy)
        if (px !== null) line(g, px, py, lx, ly, color, wdt > 3 ? 2 : 1)
        px = lx
        py = ly
      }
    }
  }
  g.globalAlpha = 1

}

function drawLights() {
  for (let i = 0; i < bullets.length; i++) if (i % 2 === 0) stage.light(L(bullets[i].x), L(bullets[i].y), 7, CYAN, 0.8)
  for (let i = 0; i < ebullets.length; i++) stage.light(L(ebullets[i].x), L(ebullets[i].y), 8, '#ff8a3d', 0.8)
  for (let i = 0; i < beams.length; i++) {
    const bm = beams[i]
    // The first instant of a beam flares brighter and wider (beamFlash).
    for (let x = -20; x <= 110; x += 40) stage.light(L(bm.x + x), L(bm.y), 26 + beamFlash * 20, CYAN, Math.min(1, bm.life + beamFlash))
  }
  for (let i = 0; i < shockwaves.length; i++) {
    const sw = shockwaves[i]
    stage.light(L(sw.x), L(sw.y), Math.max(6, L(sw.radius) * 1.2), sw.color, sw.life * 0.7)
  }
  // Charging: the nose gathers light.
  if (ship.alive && !gameOver && chargeT > 0.1) {
    const c = clamp(chargeT / chargeTime(), 0, 1)
    stage.light(L(ship.x) + 6, L(ship.y), 6 + c * 16, CYAN, 0.4 + c * 0.6)
  }
}

// --- HUD (upright, screen space) ---------------------------------------------

function drawHud(demo) {
  const h = stage.hud
  // Pickup letters and names, upright over their crates.
  for (const p of pickups) {
    const at = hudAt(p.x, p.y)
    hudText(p.slot[0].toUpperCase(), at.x + 1, at.y - 3, GOLD, true)
    hudText(p.mode.toUpperCase(), at.x, at.y + 8, GOLD, true)
  }
  // Active upgrades, top left of the screen (standard weapons show nothing).
  if (!demo && !gameOver) {
    const x = L(20)
    let y = L(24)
    for (const slot of ['gun', 'beam', 'force']) {
      const u = upgrades[slot]
      if (!u) continue
      hudText(`${u.label} ${Math.ceil(u.time)}S`, x, y, GOLD)
      y += 9
    }
    if (pickupNotice) hudText(`${pickupNotice.label} · 20S`, x, y, GOLD)
  }
  if (!ship.alive || gameOver) return
  // Under the ship: the force pod's state and five charge pips, and the
  // multiplier once it counts.
  const col = mult >= 4 ? GOLD : CYAN
  const at = portrait ? hudAt(ship.x - 22, ship.y - 20) : hudAt(ship.x - 20, ship.y + 20)
  const x = at.x
  const y = at.y
  h.fillStyle = '#0b0616'
  h.fillRect(x, y, 5, 5)
  h.fillStyle = col
  if (force.attached) h.fillRect(x, y, 4, 4)
  else { h.fillRect(x, y, 4, 1); h.fillRect(x, y + 3, 4, 1); h.fillRect(x, y, 1, 4); h.fillRect(x + 3, y, 1, 4) }
  const full = Math.floor(clamp(chargeT / chargeTime(), 0, 1) * 5)
  for (let i = 0; i < 5; i++) {
    const px = x + 7 + i * 3
    h.fillStyle = '#0b0616'
    h.fillRect(px + 1, y + 1, 2, 4)
    h.fillStyle = i < full ? (full === 5 ? '#ffffff' : col) : '#3a2f70'
    h.fillRect(px, y, 2, 4)
  }
  if (mult > 1) hudText('X' + mult, x + 24, y - 2, col)
  if (multPop) {
    const rise = multPop.t * 40
    const p = portrait ? hudAt(multPop.x + rise, multPop.y) : hudAt(multPop.x, multPop.y - rise)
    if (multPop.t < 0.8 || Math.floor(multPop.t * 20) % 2) hudText(multPop.text.toUpperCase(), p.x, p.y - 3, col, true)
  }
}

function draw() {
  if (!stage) return
  const demo = !gameStarted
  const now = performance.now() / 1000
  buildBackdrop()
  const g = stage.begin()
  drawBackdrop(g, now)
  drawTerrain(g)
  // Enemies, boss, pickups: lit.
  for (let i = 0; i < enemies.length; i++) drawEnemy(g, enemies[i], now)
  if (boss) drawBoss(g)
  const crate = sprite(CRATE)
  for (const p of pickups) {
    g.drawImage(crate, L(p.x) - 5, L(p.y) - 5)
    stage.light(L(p.x), L(p.y), 12, GOLD, 0.8)
  }
  if (ship.alive && !gameOver) {
    drawShip(now)
    drawForce()
  }
  drawLights()
  drawHud(demo)
  const sx = shake > 0 ? (Math.random() - 0.5) * shake * 7 / stage.k : 0
  const sy = shake > 0 ? (Math.random() - 0.5) * shake * 7 / stage.k : 0
  stage.present({
    // The cave is dim; what glows lights it. Attract mode sits darker.
    ambient: demo ? '#6a5f9c' : '#8a7dbf',
    shakeX: sx,
    shakeY: sy,
    afterLight: g2 => drawGlowing(g2),
  })
}

function gameLoop(now) {
  if (!gameRunning) return
  if (paused.value) {
    // Frozen frame behind the PAUSED pill; keep the clock fresh for resume.
    lastTime = now
    draw()
  } else {
    update(now)
    draw()
  }
  animationFrameId = requestAnimationFrame(gameLoop)
}

// ---------------------------------------------------------------- input

function isInteractiveElement(el) {
  if (!el || !el.closest) return false
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return true
  if (el.closest('a, button, .social-links, .flip-container')) return true
  return false
}

function toggleForce() {
  if (!gameStarted || gameOver || !ship.alive || paused.value) return
  sound.sfx.hold()
  if (force.attached) {
    force.attached = false
    force.x = ship.x + 24
    force.y = ship.y
  } else {
    force.attached = true
  }
}

function handleKeyDown(e) {
  // Escape belongs to EscHold (tap = pause, 3 s hold = quit); P pauses too.
  if (e.code === 'Escape') return
  if (e.code === 'KeyP' && !e.repeat) {
    if (gameStarted && !gameOver) {
      e.preventDefault()
      togglePause()
    }
    return
  }
  keys[e.code] = true
  if (e.code === 'Space') {
    e.preventDefault()
    if (!e.repeat) { keyFire = true; fireOnce() }
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (!e.repeat) toggleForce()
    return
  }
  if (!gameStarted || gameOver) {
    if (e.code === 'Enter') resetGame()
  }
}

function handleKeyUp(e) {
  keys[e.code] = false
  if (e.code === 'Space') keyFire = false
}

function handleResize() {
  setupCanvas()
  initStars()
  resetTerrain()
  ship.y = corridorClampY(ship.y, ship.x)
}

let touchActive = false
let touchTarget = { x: 0, y: 0, active: false }
let tapStartX = 0
let tapStartY = 0
let tapStartTime = 0
let lastTapTime = 0
const TOUCH_X_OFFSET = -60 // landscape: ship sits left of and above the finger
const TOUCH_Y_OFFSET = -90
const TOUCH_AHEAD = 90 // portrait: ship sits this far ahead (up) of the finger

function setTouchTarget(cx, cy) {
  if (portrait) {
    const w = toWorld(cx, cy)
    touchTarget.x = w.x + TOUCH_AHEAD
    touchTarget.y = w.y
  } else {
    touchTarget.x = cx + TOUCH_X_OFFSET
    touchTarget.y = cy + TOUCH_Y_OFFSET
  }
}

function handleTouchStart(e) {
  if (isInteractiveElement(e.target)) return
  const t = e.touches[0]
  tapStartX = t.clientX
  tapStartY = t.clientY
  tapStartTime = performance.now()
  if (!gameStarted || gameOver) {
    // Start on tap, not on touchstart, so a stray swipe does not launch
    // the game.
    return
  }
  touchActive = true
  touchFire = true // auto-fire while touching
  setTouchTarget(t.clientX, t.clientY)
  touchTarget.active = true
  fireOnce()
}

function handleTouchMove(e) {
  if (!touchActive) return
  if (isInteractiveElement(e.target)) return
  e.preventDefault()
  const t = e.touches[0]
  setTouchTarget(t.clientX, t.clientY)
}

function handleTouchEnd(e) {
  if (isInteractiveElement(e.target)) {
    touchActive = false
    touchFire = false
    touchTarget.active = false
    return
  }
  const t = e.changedTouches[0]
  const isTap = t && Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 15 && performance.now() - tapStartTime < 400
  if (!gameStarted || gameOver) {
    if (isTap) resetGame()
  } else if (isTap) {
    // Double-tap launches / returns the force pod.
    const now = performance.now()
    if (now - lastTapTime < 350) toggleForce()
    lastTapTime = now
  }
  touchActive = false
  touchFire = false
  touchTarget.active = false
}

onMounted(() => {
  setupCanvas()
  initStars()
  startDemo()
  gameRunning = true
  lastTime = performance.now()
  animationFrameId = requestAnimationFrame(gameLoop)

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', handleResize)
  window.addEventListener('touchstart', handleTouchStart, { passive: false })
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd)
})

onBeforeUnmount(() => {
  gameRunning = false
  sound.music.stop()
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
})
</script>

<style scoped>
/* Full-viewport playfield behind the landing overlay. */
.rtype-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: var(--app-height, 100dvh);
  display: block;
  z-index: 1;
}
</style>
