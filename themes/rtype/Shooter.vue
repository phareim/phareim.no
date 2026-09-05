<template>
  <canvas ref="canvas" class="rtype-canvas"></canvas>
</template>

<script setup>
/**
 * R-Type — an endless R-Type (1987) style side-scrolling space shooter in
 * NEON VECTOR style (stroked outlines + glow, canvas primitives only).
 * Same contract as hacker/SpaceInvaders.vue and breakout/Breakout.vue: a
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
 * draw() applies the rotation once. Only input (keys, touch) and upright
 * text need to know about the orientation.
 */
const emit = defineEmits(['score', 'distance', 'lives', 'death', 'restart', 'started'])

const canvas = ref(null)
let ctx = null
let animationFrameId = null
let gameRunning = false
let W = 0 // world width (forward axis)
let H = 0 // world height (lateral axis)
let SW = 0 // screen width
let SH = 0 // screen height
let portrait = false // screen taller than wide -> world rotated, ship flies up
let dpr = 1

const CYAN = '#19f0ff'
const ORANGE = '#ff7a1a'
const BG = '#05060c'
const LIVES = 3
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
let polys = [] // slow drifting outline polygons, 3 parallax depths
let force = { attached: true, angle: 0, x: 0, y: 0 }
let fireAlt = false // alternate nose/pod gun while attached
let score = 0
let lastScoreSent = -1
let distPx = 0
let lastDistSent = -1
let lives = LIVES
let gameOver = false
let gameStarted = false
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

// Terrain: smooth organic cave walls (summed sines, slowly drifting phases).
let scrollX = 0
let terrainSeedA = 1.7
let terrainSeedB = 4.2
let terrainPhase = 0

// ---------------------------------------------------------------- orientation

// World -> screen. Portrait: (x, y) -> (y, SH - x), i.e. +x is up.
function applyWorldTransform() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (portrait) {
    ctx.translate(0, SH)
    ctx.rotate(-Math.PI / 2)
  }
}

// Screen (client) -> world.
function toWorld(cx, cy) {
  return portrait ? { x: SH - cy, y: cx } : { x: cx, y: cy }
}

// Draw text that reads horizontally on screen regardless of orientation.
// (wx, wy) is the world anchor; fn draws at (0, 0).
function upright(wx, wy, fn) {
  ctx.save()
  ctx.translate(wx, wy)
  if (portrait) ctx.rotate(Math.PI / 2)
  fn()
  ctx.restore()
}

// ---------------------------------------------------------------- setup

function setupCanvas() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  SW = c.offsetWidth
  SH = c.offsetHeight
  portrait = SH > SW
  W = portrait ? SH : SW
  H = portrait ? SW : SH
  c.width = Math.round(SW * dpr)
  c.height = Math.round(SH * dpr)
  ctx = c.getContext('2d')
  applyWorldTransform()
  ship.x = Math.max(40, W * 0.18)
  ship.y = ship.y || H / 2
  ship.y = clamp(ship.y, 30, H - 30)
}

function initStars() {
  starsFar = []
  starsMid = []
  starsNear = []
  for (let i = 0; i < 60; i++) starsFar.push({ x: Math.random() * W, y: Math.random() * H })
  for (let i = 0; i < 32; i++) starsMid.push({ x: Math.random() * W, y: Math.random() * H })
  for (let i = 0; i < 16; i++) starsNear.push({ x: Math.random() * W, y: Math.random() * H })
}

function makePolyVertices() {
  const count = 4 + Math.floor(Math.random() * 5)
  const angles = []
  for (let i = 0; i < count; i++) angles.push(Math.random() * Math.PI * 2)
  angles.sort((a, b) => a - b)
  return angles.map(a => ({ angle: a, r: 0.5 + Math.random() * 0.5 }))
}

function makePoly(anyY) {
  const depth = [0.2, 0.5, 0.85][Math.floor(Math.random() * 3)]
  return {
    x: Math.random() * (W + 200) - 100,
    y: anyY !== undefined ? anyY : Math.random() * H,
    depth,
    speed: 12 + depth * 46,
    size: 120 + (1 - depth) * 260 + Math.random() * 120,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.12,
    vertices: makePolyVertices(),
    orange: Math.random() < 0.25,
    alpha: 0.04 + depth * 0.08,
  }
}

function initPolys() {
  polys = []
  for (let i = 0; i < 9; i++) polys.push(makePoly())
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

function ceilYAt(sx) {
  if (!gameStarted) return H * 0.05 + Math.sin((sx + scrollX) * 0.004 + terrainPhase) * H * 0.015
  const gap = H * gapFrac()
  return centerY() - gap / 2 + noiseY(sx + scrollX, terrainSeedA) * H * 0.045
}

function floorYAt(sx) {
  if (!gameStarted) return H * 0.95 + Math.sin((sx + scrollX) * 0.004 + terrainPhase + 2) * H * 0.015
  const gap = H * gapFrac()
  return centerY() + gap / 2 + noiseY(sx + scrollX, terrainSeedB) * H * 0.045
}

// Stalactite/stalagmite spikes: deterministic per 110 px world column,
// suppressed in attract mode so the profile card stays readable.
function spikeLenAt(sx, side) {
  if (!gameStarted) return 0
  const col = Math.floor((sx + scrollX) / 110)
  const h = hash(col * 2 + (side === 'ceil' ? 0 : 1))
  if (h < 0.68) return 0
  return ((h - 0.68) / 0.32) * H * 0.1
}

function spikeCXAt(sx) {
  const col = Math.floor((sx + scrollX) / 110)
  return col * 110 + 55 - scrollX
}

function insideTerrain(x, y, r) {
  if (y - r < ceilYAt(x)) return true
  if (y + r > floorYAt(x)) return true
  const scx = spikeCXAt(x)
  if (Math.abs(x - scx) < 12) {
    if (y - r < ceilYAt(scx) + spikeLenAt(scx, 'ceil')) return true
    if (y + r > floorYAt(scx) - spikeLenAt(scx, 'floor')) return true
  }
  return false
}

// ---------------------------------------------------------------- state

function resetGame() {
  if (!canvas.value) return
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
  ship.x = Math.max(40, W * 0.18)
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
  emit('restart')
  emit('started')
  emit('score', 0)
  emit('distance', 0)
  emit('lives', lives)
}

// Attract mode: the game plays itself behind the card until Enter/tap.
function startDemo() {
  gameStarted = false
  gameOver = false
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
  ship.x = Math.max(40, W * 0.18)
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
  beams.push({ x: ship.x + 24, y: ship.y, vx: 950, life: 1.4, t: 0 })
  spawnParticles(ship.x + 24, ship.y, CYAN, 12, 200)
  shake = Math.min(1, shake + 0.55)
  beamShakeT = 0.12 // 120 ms screen shake
  beamFlash = 1
}

function fireOnce() {
  if (!gameStarted || gameOver || !ship.alive) return
  bullets.push({ x: ship.x + 22, y: ship.y - 3, vx: BULLET_SPEED, vy: 0 })
  if (force.attached) {
    fireAlt = !fireAlt
    if (fireAlt) bullets.push({ x: force.x + 8, y: force.y, vx: BULLET_SPEED, vy: 0 })
  }
  fireT = 0
}

function killEnemyAt(i) {
  const e = enemies[i]
  explode(e.x, e.y, e.kind === 'gunship')
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
  lives--
  emit('lives', lives)
  ship.alive = false
  if (lives <= 0) {
    gameOver = true
    deathAt = now
  } else {
    respawnAt = now + 1.2
    invulnUntil = respawnAt + 2.5 // 2.5 s blinking invulnerability after respawn
  }
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
  targetY = clamp(targetY, 24, H - 24)
  if (ship.y < ceilYAt(ship.x) + 40 || ship.y > floorYAt(ship.x) - 40) {
    targetY = (ceilYAt(ship.x) + floorYAt(ship.x)) / 2
  }
  const targetX = clamp(Math.max(40, W * 0.18), 20, W * 0.45)
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
  for (let i = 0; i < polys.length; i++) {
    const p = polys[i]
    p.x -= p.speed * (demo ? 0.5 : 1) * dt
    p.rotation += p.rotSpeed * dt
    if (p.x < -p.size) {
      const fresh = makePoly()
      fresh.x = W + p.size * 0.5
      polys[i] = fresh
    }
  }

  // Respawn handling.
  if (!ship.alive && !gameOver && now >= respawnAt) {
    ship.alive = true
    ship.x = Math.max(40, W * 0.18)
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
    ship.x = clamp(ship.x, 16, W * 0.45)
    ship.y = clamp(ship.y, 20, H - 20)
    // Cave walls bite (ship radius 9, spikes included).
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
  const firing = demo || keyFire || touchFire
  if (firing && ship.alive && !gameOver) {
    chargeT += dt
    fireT += dt
    if (fireT >= FIRE_INTERVAL) {
      fireT = 0
      bullets.push({ x: ship.x + 22, y: ship.y - 3, vx: BULLET_SPEED, vy: 0 })
      if (force.attached) {
        fireAlt = !fireAlt
        if (fireAlt) bullets.push({ x: force.x + 8, y: force.y, vx: BULLET_SPEED, vy: 0 })
      }
    }
    if (demo && chargeT > 1.4) {
      // Autopilot shows off the beam now and then.
      fireBeam()
      chargeT = 0
    }
  } else {
    if (!demo && chargeT >= CHARGE_TIME && ship.alive && !gameOver) fireBeam()
    chargeT = 0
    fireT = FIRE_INTERVAL // first shot immediate on press
  }

  // Player bullets.
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.x > W + 20) bullets.splice(i, 1)
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
      if (Math.abs(eb.x - bm.x) < 90 && Math.abs(eb.y - bm.y) < 60) {
        spawnParticles(eb.x, eb.y, CYAN, 2, 120)
        ebullets.splice(j, 1)
      }
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j]
      if (e.beamHit === bm) continue
      if (Math.abs(e.x - bm.x) < 70 && Math.abs(e.y - bm.y) < 60) {
        e.beamHit = bm
        e.hp -= 4
        spawnParticles(e.x, e.y, '#ffffff', 6, 200)
        if (e.hp <= 0) killEnemyAt(j)
      }
    }
    if (boss && !boss.beamHit.has(bm)) {
      const dx = boss.x - bm.x
      const dy = boss.y - bm.y
      if (Math.abs(dx) < 90 && Math.hypot(dx, dy) < boss.ringR + 30) {
        boss.beamHit.set(bm, 1)
        boss.hp -= 4
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
  boss = null
  nextBossAt = elapsed + BOSS_EVERY
}

// ---------------------------------------------------------------- draw

function stroke(color, width, glow) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.shadowColor = color
  ctx.shadowBlur = glow
}

function drawTerrain(demo) {
  const step = 8
  // Wall fill: very dark navy near the rim fading to black at the edge.
  let g = ctx.createLinearGradient(0, 0, 0, H * 0.4)
  g.addColorStop(0, '#05060c')
  g.addColorStop(1, '#0b1220')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(0, 0)
  for (let x = 0; x <= W; x += step) ctx.lineTo(x, ceilYAt(x))
  ctx.lineTo(W, 0)
  ctx.closePath()
  ctx.fill()
  g = ctx.createLinearGradient(0, H, 0, H * 0.6)
  g.addColorStop(0, '#05060c')
  g.addColorStop(1, '#0b1220')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= W; x += step) ctx.lineTo(x, floorYAt(x))
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()
  // Rims: glowing cyan outlines.
  ctx.globalAlpha = demo ? 0.5 : 1
  stroke(CYAN, 2, 10)
  ctx.beginPath()
  for (let x = 0; x <= W; x += step) {
    const y = ceilYAt(x)
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.beginPath()
  for (let x = 0; x <= W; x += step) {
    const y = floorYAt(x)
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.shadowBlur = 0
  // Stalactites / stalagmites: outline triangles.
  if (gameStarted) {
    const colW = 110
    const first = Math.floor(scrollX / colW) - 1
    const last = Math.floor((scrollX + W) / colW) + 1
    for (let col = first; col <= last; col++) {
      const scx = col * colW + 55 - scrollX
      const hc = hash(col * 2)
      if (hc >= 0.68) {
        const len = ((hc - 0.68) / 0.32) * H * 0.1
        const cy = ceilYAt(scx)
        ctx.fillStyle = '#0b1220'
        ctx.beginPath()
        ctx.moveTo(scx - 11, cy)
        ctx.lineTo(scx + 11, cy)
        ctx.lineTo(scx, cy + len)
        ctx.closePath()
        ctx.fill()
        stroke(CYAN, 1, 6)
        ctx.stroke()
        ctx.shadowBlur = 0
      }
      const hf = hash(col * 2 + 1)
      if (hf >= 0.68) {
        const len = ((hf - 0.68) / 0.32) * H * 0.1
        const fy = floorYAt(scx)
        ctx.fillStyle = '#0b1220'
        ctx.beginPath()
        ctx.moveTo(scx - 11, fy)
        ctx.lineTo(scx + 11, fy)
        ctx.lineTo(scx, fy - len)
        ctx.closePath()
        ctx.fill()
        stroke(CYAN, 1, 6)
        ctx.stroke()
        ctx.shadowBlur = 0
      }
    }
  }
}

function drawShip(now) {
  const blink = now < invulnUntil && Math.floor(now * 12) % 2 === 0
  if (blink) return
  const x = ship.x
  const y = ship.y
  // Engine flame: flickering triangle behind the ship.
  const fl = 12 + Math.random() * 14
  ctx.save()
  ctx.globalAlpha *= 0.9
  stroke(ORANGE, 2, 12)
  ctx.beginPath()
  ctx.moveTo(x - 16, y - 5)
  ctx.lineTo(x - 16 - fl, y)
  ctx.lineTo(x - 16, y + 5)
  ctx.stroke()
  stroke(CYAN, 1.5, 8)
  ctx.beginPath()
  ctx.moveTo(x - 16, y - 2)
  ctx.lineTo(x - 16 - fl * 0.5, y)
  ctx.lineTo(x - 16, y + 2)
  ctx.stroke()
  // Hull: sleek dart.
  stroke(CYAN, 2, 14)
  ctx.beginPath()
  ctx.moveTo(x + 22, y)
  ctx.lineTo(x - 4, y - 9)
  ctx.lineTo(x - 12, y - 15)
  ctx.lineTo(x - 10, y - 4)
  ctx.lineTo(x - 16, y)
  ctx.lineTo(x - 10, y + 4)
  ctx.lineTo(x - 12, y + 15)
  ctx.lineTo(x - 4, y + 9)
  ctx.closePath()
  ctx.stroke()
  // Cockpit core.
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = CYAN
  ctx.shadowBlur = 10
  ctx.fillRect(x + 2, y - 1.5, 6, 3)
  ctx.shadowBlur = 0
  ctx.restore()
}

function drawForce() {
  const { x, y } = force
  stroke(CYAN, 2, 14)
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + force.angle * 0.7
    const px = x + Math.cos(a) * 8
    const py = y + Math.sin(a) * 8
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = CYAN
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(x, y, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  if (!force.attached) {
    // Trail while flying free.
    stroke(CYAN, 1.5, 8)
    ctx.beginPath()
    ctx.moveTo(x - 8, y)
    ctx.lineTo(x - 60, y)
    ctx.stroke()
  }
}

function drawEnemy(e) {
  stroke(ORANGE, 2, 10)
  if (e.kind === 'drone') {
    // Outline diamond.
    ctx.beginPath()
    ctx.moveTo(e.x, e.y - e.size)
    ctx.lineTo(e.x + e.size, e.y)
    ctx.lineTo(e.x, e.y + e.size)
    ctx.lineTo(e.x - e.size, e.y)
    ctx.closePath()
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = ORANGE
    ctx.shadowBlur = 8
    ctx.fillRect(e.x - 1.5, e.y - 1.5, 3, 3)
    ctx.shadowBlur = 0
  } else if (e.kind === 'weaver') {
    // Spinner: rotating triangle pair.
    for (const dir of [1, -1]) {
      const a = e.t * 3 * dir + e.phase
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const ta = a + (Math.PI * 2 / 3) * i
        const px = e.x + Math.cos(ta) * e.size
        const py = e.y + Math.sin(ta) * e.size
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
  } else if (e.kind === 'hex') {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6 + e.t * 0.8
      const px = e.x + Math.cos(a) * e.size
      const py = e.y + Math.sin(a) * e.size
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
    stroke('#ffffff', 1, 6)
    ctx.beginPath()
    ctx.arc(e.x, e.y, 3, 0, Math.PI * 2)
    ctx.stroke()
  } else if (e.kind === 'gunship') {
    // Slow tanky hull with a barrel.
    const s = e.size
    ctx.beginPath()
    ctx.moveTo(e.x - s, e.y - s * 0.55)
    ctx.lineTo(e.x + s * 0.4, e.y - s * 0.55)
    ctx.lineTo(e.x + s, e.y)
    ctx.lineTo(e.x + s * 0.4, e.y + s * 0.55)
    ctx.lineTo(e.x - s, e.y + s * 0.55)
    ctx.closePath()
    ctx.stroke()
    stroke(ORANGE, 2, 10)
    ctx.beginPath()
    ctx.moveTo(e.x - s, e.y)
    ctx.lineTo(e.x - s - 12, e.y)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
}

function drawBoss() {
  const b = boss
  // Rotating polygon ring with a gap; the core is only hittable through it.
  stroke(ORANGE, 3, 16)
  ctx.beginPath()
  const sides = 10
  let prevInGap = false
  for (let i = 0; i <= sides; i++) {
    const a = b.angle + (Math.PI * 2 / sides) * i
    let da = a - b.angle
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    const inGap = Math.abs(da) < b.gap / 2
    const px = b.x + Math.cos(a) * b.ringR
    const py = b.y + Math.sin(a) * b.ringR
    if (i === 0 || inGap || prevInGap) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
    prevInGap = inGap
  }
  ctx.stroke()
  // Gap markers.
  stroke('#ffffff', 2, 10)
  for (const s of [-1, 1]) {
    const a = b.angle + s * b.gap / 2
    ctx.beginPath()
    ctx.moveTo(b.x + Math.cos(a) * (b.ringR - 8), b.y + Math.sin(a) * (b.ringR - 8))
    ctx.lineTo(b.x + Math.cos(a) * (b.ringR + 8), b.y + Math.sin(a) * (b.ringR + 8))
    ctx.stroke()
  }
  // Core.
  const pulse = 0.7 + 0.3 * Math.sin(b.t * 5)
  stroke(ORANGE, 2, 18 * pulse)
  ctx.beginPath()
  ctx.arc(b.x, b.y, b.coreR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = ORANGE
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.arc(b.x, b.y, 4 * pulse, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  // HP bar.
  const bw = 130
  ctx.fillStyle = 'rgba(255, 122, 26, 0.25)'
  ctx.fillRect(b.x - bw / 2, b.y - b.ringR - 18, bw, 4)
  ctx.fillStyle = ORANGE
  ctx.fillRect(b.x - bw / 2, b.y - b.ringR - 18, bw * Math.max(0, b.hp / b.maxHp), 4)
}

function draw() {
  if (!ctx) return
  const demo = !gameStarted
  const now = performance.now() / 1000

  applyWorldTransform()
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  if (shake > 0) {
    const m = shake * 7
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
  }

  // Starfield: 3 parallax layers — far dim dots, mid dots, near streaks.
  ctx.fillStyle = 'rgba(25, 240, 255, 0.25)'
  for (let i = 0; i < starsFar.length; i++) {
    const s = starsFar[i]
    ctx.fillRect(s.x, s.y, 1, 1)
  }
  ctx.fillStyle = 'rgba(25, 240, 255, 0.5)'
  for (let i = 0; i < starsMid.length; i++) {
    const s = starsMid[i]
    ctx.fillRect(s.x, s.y, 2, 2)
  }
  const streakLen = 3 + lastWorld * 0.03
  stroke('rgba(224, 251, 255, 0.7)', 1.5, 0)
  ctx.shadowBlur = 0
  for (let i = 0; i < starsNear.length; i++) {
    const s = starsNear[i]
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.lineTo(s.x + streakLen, s.y)
    ctx.stroke()
    ctx.fillStyle = '#e0fbff'
    ctx.fillRect(s.x - 1, s.y - 1, 2, 2)
  }

  // Drifting irregular outline polygons, very dim.
  for (let i = 0; i < polys.length; i++) {
    const p = polys[i]
    const s = p.size / 2
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.globalAlpha = p.alpha
    stroke(p.orange ? ORANGE : CYAN, 1.5, 0)
    ctx.shadowBlur = 0
    ctx.beginPath()
    for (let j = 0; j < p.vertices.length; j++) {
      const v = p.vertices[j]
      const px = Math.cos(v.angle) * v.r * s
      const py = Math.sin(v.angle) * v.r * s
      if (j === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }
  ctx.shadowBlur = 0

  ctx.globalAlpha = demo ? 0.5 : 1

  // Terrain walls: navy fill, glowing cyan rims, outline spikes.
  drawTerrain(demo)
  ctx.globalAlpha = demo ? 0.5 : 1
  ctx.shadowBlur = 0

  // Shockwaves.
  for (let i = 0; i < shockwaves.length; i++) {
    const sw = shockwaves[i]
    ctx.globalAlpha = (demo ? 0.5 : 1) * sw.life * 0.8
    stroke(sw.color, 2 + sw.life * 6, 16 * sw.life)
    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = demo ? 0.5 : 1
  ctx.shadowBlur = 0

  // Particles: dots and outline shards (short line segments).
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    ctx.globalAlpha = (demo ? 0.5 : 1) * Math.max(0, p.life)
    if (p.shard) {
      stroke(p.color, 1.5, 6)
      const dx = Math.cos(p.rot) * p.len
      const dy = Math.sin(p.rot) * p.len
      ctx.beginPath()
      ctx.moveTo(p.x - dx, p.y - dy)
      ctx.lineTo(p.x + dx, p.y + dy)
      ctx.stroke()
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
  }
  ctx.globalAlpha = demo ? 0.5 : 1

  // Enemies + boss.
  for (let i = 0; i < enemies.length; i++) drawEnemy(enemies[i])
  if (boss) drawBoss()
  ctx.shadowBlur = 0

  // Enemy bullets: orange ring bullets with a bright core, ~8 px.
  stroke(ORANGE, 2.5, 12)
  for (let i = 0; i < ebullets.length; i++) {
    const b = ebullets[i]
    ctx.beginPath()
    ctx.arc(b.x, b.y, 8, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = ORANGE
  ctx.shadowBlur = 10
  for (let i = 0; i < ebullets.length; i++) {
    const b = ebullets[i]
    ctx.beginPath()
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0

  // Player bullets: white-hot cores with cyan glow.
  ctx.shadowColor = CYAN
  ctx.shadowBlur = 12
  ctx.fillStyle = CYAN
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i]
    ctx.fillRect(b.x - 5, b.y - 2, 10, 4)
  }
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i]
    ctx.fillRect(b.x - 4, b.y - 1, 8, 2)
  }

  // Charge beams: fat sine wave, pierces everything.
  for (let i = 0; i < beams.length; i++) {
    const bm = beams[i]
    const a = Math.min(1, bm.life)
    ctx.globalAlpha = (demo ? 0.5 : 1) * a
    for (const [off, color, wdt] of BEAM_LAYERS) {
      stroke(color, wdt, 18)
      ctx.beginPath()
      for (let x = -20; x <= 110; x += 8) {
        const y = bm.y + off * 0.4 + Math.sin(x * 0.09 + bm.t * 22) * 10
        if (x === -20) ctx.moveTo(bm.x + x, y)
        else ctx.lineTo(bm.x + x, y)
      }
      ctx.stroke()
    }
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = demo ? 0.5 : 1

  // Beam flash: brief additive band along each beam.
  if (beamFlash > 0 && beams.length > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = beamFlash * 0.22
    ctx.fillStyle = CYAN
    for (let i = 0; i < beams.length; i++) {
      const bm = beams[i]
      ctx.fillRect(bm.x - 140, bm.y - 34, 260, 68)
    }
    ctx.restore()
    ctx.globalAlpha = demo ? 0.5 : 1
  }

  // Ship, force pod, and the near-ship FORCE/BEAM indicators.
  if (ship.alive && !gameOver) {
    drawShip(now)
    drawForce()
    ctx.shadowBlur = 0
    // Small canvas HUD under the ship: force state + charge bars + multiplier.
    const full = Math.floor(clamp(chargeT / CHARGE_TIME, 0, 1) * 5)
    const bars = '▮'.repeat(full) + '▯'.repeat(5 - full)
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = CYAN
    ctx.globalAlpha = (demo ? 0.5 : 1) * 0.85
    const hud = `FORCE ${force.attached ? '●' : '○'}  BEAM ${bars}  x${mult}`
    // Below the ship on screen, left-aligned from 34 px left of it.
    if (portrait) upright(ship.x - 22, ship.y - 34, () => ctx.fillText(hud, 0, 0))
    else upright(ship.x - 34, ship.y + 22, () => ctx.fillText(hud, 0, 0))
    ctx.globalAlpha = demo ? 0.5 : 1
    // Multiplier rise pop near the ship.
    if (multPop) {
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = CYAN
      ctx.shadowBlur = 12
      ctx.globalAlpha = (demo ? 0.5 : 1) * Math.max(0, 1 - multPop.t)
      const rise = multPop.t * 40 // rises on screen: -y in landscape, +x in portrait
      if (portrait) upright(multPop.x + rise, multPop.y, () => ctx.fillText(multPop.text, 0, 0))
      else upright(multPop.x, multPop.y - rise, () => ctx.fillText(multPop.text, 0, 0))
      ctx.globalAlpha = demo ? 0.5 : 1
      ctx.shadowBlur = 0
    }
  }

  ctx.restore()
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}

function gameLoop(now) {
  if (!gameRunning) return
  update(now)
  draw()
  animationFrameId = requestAnimationFrame(gameLoop)
}

// ---------------------------------------------------------------- input

function isInteractiveElement(el) {
  if (!el || !el.closest) return false
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return true
  if (el.closest('a, button, .social-links, .flip-container, .theme-pager')) return true
  return false
}

function toggleForce() {
  if (!gameStarted || gameOver || !ship.alive) return
  if (force.attached) {
    force.attached = false
    force.x = ship.x + 24
    force.y = ship.y
  } else {
    force.attached = true
  }
}

function handleKeyDown(e) {
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
  initPolys()
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
    // Start on tap, not on touchstart, so a horizontal swipe can still
    // switch theme without launching the game.
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
  initPolys()
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
  height: 100dvh;
  display: block;
  z-index: 1;
}
</style>
