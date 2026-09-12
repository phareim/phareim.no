<template>
  <canvas ref="canvas" class="galaga-canvas"></canvas>
  <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup>
import { MACHINE_FONT } from '~/themes/base/fonts'
import EscHold from '../base/EscHold.vue'
import { readShipDef } from '~/composables/useShip'
import {
  HULL_MAX, DMG, HEAL_BOSS, INVULN_TIME, BULLET_LEVEL_MAX, PITY_TIME_MS,
  MAX_FALLING_POWERUPS, MAX_PARTICLES,
  applyDamage, heal,
  waveIntervalFor, enemySpeedMul, enemyFireFirstFor, enemyRefireWindowFor,
  boltSpeedFor, shootChanceFor, waveCountFor, heavyHpFor, scoutHpFor,
  bossEveryFor, bossMaxHpFor, bossAttackFor, bossFanCount, bossBountyFor,
  ENEMY_STATS, POWERUP_LETTERS, POWERUP_DURATION,
  pickPowerup, intensityFor,
} from './balance'
import { createGalagaAudio, TRACK_NAMES } from './audio'
const emit = defineEmits(['score', 'death', 'restart', 'started'])

// The Hangar ship, read live: the same hull the profile shows.
let shipDef = readShipDef()

const canvas = ref(null)
let ctx = null
let animationFrameId = null
let gameRunning = false

// Game state
let player = { x: 0, y: 0, width: 44, height: 36, speed: 5 }
let bullets = []
let enemyBullets = []
let enemies = []
let bosses = []
let stars = []
let particles = []
let powerups = []
let shockwaves = []
let score = 0
let gameOver = false
let gameStarted = false
// Esc tap pauses (EscHold owns Escape); a 3 s hold quits into game over.
const paused = ref(false)
let keys = {}
let lastShotTime = 0
let waveTimer = 0
let waveInterval = 2500
let bulletLevel = 1
let powerupTimer = 0
let powerupInterval = 12000
let bossTimer = 0
let bossNum = 0
let playerGlow = 0 // powerup pickup glow effect
let shield = false // player shield active (pre-hull layer vs bullets)
let aegis = 0 // upgraded shield hits remaining (0 = none)
let shieldFlash = 0 // flash effect when shield absorbs a hit
let deathExplosion = null // multi-phase death explosion
let bgShapes = [] // parallax background geometric shapes
let smoothParallaxX = 0 // smoothed parallax offset (lerps toward target)

// --- Hull / power-bar (2026-09-12): 5 segments instead of one-hit death.
let hull = HULL_MAX
let invulnUntil = 0 // ms timestamp: blink-invulnerability after a hull hit
let lastFrameTime = 0
// --- Timed powerups (seconds of active play left).
let dualTimer = 0 // D: escort doubling the fan, sacrificed on a hit
let rearTimer = 0 // R: rear guard firing backwards
let tempoTimer = 0 // T: slow-mo on enemies and their bullets
let magnetTimer = 0 // M: attracts falling powerups, brakes nearby bullets
let comboTimer = 0 // C: 2x score baseline while active
let lastShieldTime = 0 // pity clock: force S when low hull + long drought
// --- Chain combo: kills inside a 1.5 s window raise the multiplier.
let comboCount = 0
let lastKillTime = 0
function chainBonus() {
  if (comboCount >= 6) return 2
  if (comboCount >= 4) return 1
  if (comboCount >= 2) return 0
  return 0
}
function scoreMult(now) {
  const base = comboTimer > 0 ? 2 : 1
  return Math.min(4, base + chainBonus())
}
function addScore(base, now) {
  score += base * scoreMult(now)
  emit('score', score)
}
function registerKill(now) {
  if (now - lastKillTime < 1500) comboCount++
  else comboCount = 1
  lastKillTime = now
  if (comboCount === 3 || comboCount === 4 || comboCount === 6) {
    triggerShockwave(player.x, player.y - 60, '#ffd23f', false)
    audio?.play('combo')
  }
}
// --- Juice: shake, hit-stop, warp, muzzle.
let shake = 0 // 0..1 screen shake magnitude
let hitStopUntil = 0 // ms timestamp: world frozen, draw continues
let warpT = 0 // seconds of warp-stretch after a wave spawns
let muzzleT = 0 // frame counter for the muzzle flash
// --- Deep background: nebulae, planet, station (all dark, all slow).
let nebulae = []
let planet = null
let station = null
// --- Radio: full sequencer, M / top-right tap cycles the station.
let audio = null
let radioIndex = 0
try {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('galagaRadio') : null
  radioIndex = Math.max(0, TRACK_NAMES.indexOf(stored))
  if (!stored) radioIndex = 0
} catch {
  radioIndex = 0
}
function currentTrackName() {
  return TRACK_NAMES[radioIndex] ?? TRACK_NAMES[0]
}
function cycleRadio() {
  radioIndex = (radioIndex + 1) % TRACK_NAMES.length
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem('galagaRadio', currentTrackName())
  } catch {
    // storage unavailable — the station lives for this run only
  }
  if (audio && gameStarted && !gameOver) audio.playTrack(radioIndex)
}
function pushParticle(p) {
  if (particles.length >= MAX_PARTICLES) particles.shift()
  particles.push(p)
}
function fxScale() {
  let s = 1
  if (typeof canvas !== 'undefined' && canvas.value && canvas.value.width < 600) s *= 0.6
  if (reducedMotion) s *= 0.5
  return s
}

// Enemy shapes as pixel-art style draw functions
const enemyShapes = [
  // Classic invader
  (ctx, x, y, size, color) => {
    ctx.fillStyle = color
    const s = size / 8
    ctx.fillRect(x - 3 * s, y - s, 6 * s, 2 * s)
    ctx.fillRect(x - 4 * s, y - 2 * s, 8 * s, s)
    ctx.fillRect(x - 2 * s, y - 3 * s, 4 * s, s)
    ctx.fillRect(x - 4 * s, y + s, 2 * s, s)
    ctx.fillRect(x + 2 * s, y + s, 2 * s, s)
    ctx.fillStyle = '#000'
    ctx.fillRect(x - 2 * s, y - s, s, s)
    ctx.fillRect(x + s, y - s, s, s)
  },
  // Diamond
  (ctx, x, y, size, color) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x, y - size / 2)
    ctx.lineTo(x + size / 2, y)
    ctx.lineTo(x, y + size / 2)
    ctx.lineTo(x - size / 2, y)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.stroke()
  },
  // Hexagon
  (ctx, x, y, size, color) => {
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6
      const px = x + (size / 2) * Math.cos(angle)
      const py = y + (size / 2) * Math.sin(angle)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.stroke()
  },
  // Crab invader
  (ctx, x, y, size, color) => {
    ctx.fillStyle = color
    const s = size / 8
    ctx.fillRect(x - 3 * s, y - 2 * s, 6 * s, 3 * s)
    ctx.fillRect(x - s, y - 3 * s, 2 * s, s)
    ctx.fillRect(x - 5 * s, y - s, 2 * s, 2 * s)
    ctx.fillRect(x + 3 * s, y - s, 2 * s, 2 * s)
    ctx.fillRect(x - 3 * s, y + s, s, s)
    ctx.fillRect(x + 2 * s, y + s, s, s)
    ctx.fillStyle = '#000'
    ctx.fillRect(x - 2 * s, y - s, s, s)
    ctx.fillRect(x + s, y - s, s, s)
  },
  // Triangle ship
  (ctx, x, y, size, color) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x, y - size / 2)
    ctx.lineTo(x + size / 2, y + size / 3)
    ctx.lineTo(x - size / 2, y + size / 3)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(x, y - size / 6, size / 8, 0, Math.PI * 2)
    ctx.fill()
  },
  // Skull-like
  (ctx, x, y, size, color) => {
    ctx.fillStyle = color
    const r = size / 2
    ctx.beginPath()
    ctx.arc(x, y - r * 0.2, r * 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(x - r * 0.5, y + r * 0.3, r, r * 0.4)
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.18, 0, Math.PI * 2)
    ctx.arc(x + r * 0.3, y - r * 0.3, r * 0.18, 0, Math.PI * 2)
    ctx.fill()
  }
]

let waveNumber = 0
let reducedMotion = false

function initStars() {
  stars = []
  if (!canvas.value) return
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * canvas.value.width,
      y: Math.random() * canvas.value.height,
      speed: 0.3 + Math.random() * 1.5,
      size: Math.random() < 0.3 ? 2 : 1,
      brightness: 0.3 + Math.random() * 0.7
    })
  }
}

// Small irregular heightfields: the same dark faces and violet triangle edges
// as mountainTerrain, seen from above as the ship passes over them.
function createBgShape(startY) {
  if (!canvas.value) return null
  const depth = .3 + Math.random() * .7
  const vertices = [{ x: 0, y: -.12, z: .5 + Math.random() * .4 }]
  const count = 9
  for (let ring = 1; ring <= 2; ring++) {
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2
      const radius = ring === 1 ? .4 : .75 + Math.random() * .25
      vertices.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
        z: ring === 1 ? .15 + Math.random() * .6 : 0 })
    }
  }
  const faces = []
  for (let i = 0; i < count; i++) {
    const a = 1 + i, b = 1 + (i + 1) % count, c = a + count, d = b + count
    faces.push([0, a, b], [a, c, d], [a, d, b])
  }
  return { x: Math.random() * canvas.value.width,
    y: startY ?? -350, depth, speed: .35 + depth * .85,
    size: (160 + Math.random() * 220) * (.6 + depth * .4),
    rotation: Math.random() * Math.PI * 2, rotSpeed: 0, vertices, faces }
}

function initBgShapes() {
  if (!canvas.value) return
  bgShapes = Array.from({ length: 6 }, (_, i) => createBgShape(i / 6 * (canvas.value.height + 400) - 200))
  bgShapes.sort((a, b) => a.depth - b.depth)
}

// Deep background: slow dark nebulae, one planet arc, one station silhouette.
function initDeepField() {
  if (!canvas.value) return
  const w = canvas.value.width, h = canvas.value.height
  const tints = [
    { c: '42,18,69', a: 0.14 }, { c: '80,20,80', a: 0.10 },
    { c: '20,80,110', a: 0.10 }, { c: '30,16,60', a: 0.16 },
  ]
  nebulae = tints.map((t, i) => {
    const r = 120 + Math.random() * 160
    const off = document.createElement('canvas')
    off.width = off.height = Math.ceil(r * 2)
    const g = off.getContext('2d')
    const grad = g.createRadialGradient(r, r, 0, r, r, r)
    grad.addColorStop(0, `rgba(${t.c},${t.a})`)
    grad.addColorStop(1, `rgba(${t.c},0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, r * 2, r * 2)
    return {
      img: off, r,
      x: Math.random() * w, y: (i / tints.length) * (h + r * 2) - r,
      speed: 0.05 + Math.random() * 0.07,
    }
  })
  planet = {
    x: w * 0.82, y: -140, r: Math.min(150, w * 0.28),
    speed: 0.06, ringTilt: 0.35,
  }
  station = {
    x: w * 0.16, y: h * 0.3, size: Math.min(90, w * 0.2),
    speed: 0.09, blink: 0,
  }
}

function drawBgShape(shape, offsetX) {
  ctx.save()
  ctx.translate(shape.x + offsetX * shape.depth * 15, shape.y)
  const cos = Math.cos(shape.rotation), sin = Math.sin(shape.rotation)
  const points = shape.vertices.map(v => ({
    x: (v.x * cos - v.y * sin) * shape.size / 2,
    y: (v.x * sin + v.y * cos) * shape.size * .35 - v.z * shape.size * .3,
  }))
  for (const face of shape.faces) {
    const [a, b, c] = face.map(i => points[i])
    const light = shape.vertices[face[1]].z
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath()
    ctx.fillStyle = `rgb(${12 + light * 8}, ${6 + light * 4}, ${26 + light * 16})`
    ctx.fill()
    ctx.strokeStyle = `rgba(177,105,245,${.16 + light * .23 + shape.depth * .08})`
    ctx.lineWidth = .75
    ctx.stroke()
  }
  ctx.restore()
}

function resetGame() {
  if (!canvas.value) return
  shipDef = readShipDef()
  const now = performance.now()
  player.x = canvas.value.width / 2
  player.y = canvas.value.height - 60
  bullets = []
  enemyBullets = []
  enemies = []
  bosses = []
  powerups = []
  particles = []
  shockwaves = []
  score = 0
  gameOver = false
  gameStarted = true
  paused.value = false
  keys = {}
  waveNumber = 0
  waveInterval = waveIntervalFor(0)
  waveTimer = now - waveInterval // first wave spawns right away
  bulletLevel = 1
  powerupTimer = now
  bossTimer = now
  bossNum = 0
  playerGlow = 0
  shield = false
  aegis = 0
  shieldFlash = 0
  deathExplosion = null
  smoothParallaxX = 0
  hull = HULL_MAX
  invulnUntil = 0
  lastFrameTime = now
  dualTimer = 0
  rearTimer = 0
  tempoTimer = 0
  magnetTimer = 0
  comboTimer = 0
  lastShieldTime = now
  comboCount = 0
  lastKillTime = 0
  shake = 0
  hitStopUntil = 0
  warpT = 0
  // The radio starts on the gesture that begins the run (browser policy).
  try {
    if (!audio) audio = createGalagaAudio()
    if (audio && audio.start()) {
      audio.setIntensity(0, false)
      audio.playTrack(radioIndex)
    }
  } catch {
    audio = null
  }
  emit('restart')
  emit('started')
  emit('score', 0)
}

function makeEnemy(base) {
  return {
    age: 0, slot: 0, flash: 0, hasFired: false,
    shootChance: 1, lockY: 0, baseX: base.x ?? 0,
    ...base,
  }
}

function spawnWave() {
  if (!canvas.value) return
  const w = canvas.value.width, h = canvas.value.height
  const now = performance.now()
  const pattern = waveNumber++ % 7
  const speedMul = enemySpeedMul(waveNumber) * 1 // tempo applies in update
  void speedMul
  const firstShot = enemyFireFirstFor(waveNumber)
  const mk = (kind, o) => makeEnemy({
    kind,
    hp: o.hp ?? ENEMY_STATS[kind].hp,
    maxHp: o.hp ?? ENEMY_STATS[kind].hp,
    shootCooldown: firstShot + Math.random() * 400,
    lastShot: now + 800,
    shootChance: shootChanceFor(waveNumber),
    flash: 0,
    ...o,
  })
  if (pattern === 0) {
    // Scouts from above, V formation; veterans (2 HP) from wave 6.
    const count = waveCountFor(waveNumber, w)
    const hp = scoutHpFor(waveNumber)
    for (let i = 0; i < count; i++) {
      enemies.push(mk('scout', {
        x: 40 + (count === 1 ? (w - 80) / 2 : i / (count - 1) * (w - 80)),
        y: -28 - Math.abs(i - (count - 1) / 2) * 28,
        vx: 0, vy: 1.15, size: 28, color: '#ff2fa0', shapeIdx: 0,
        movementType: 'straight', hp, maxHp: hp,
      }))
    }
  } else if (pattern === 1 || pattern === 2) {
    // Curved squadrons from the edges.
    const direction = pattern === 1 ? 1 : -1
    const count = waveCountFor(waveNumber, w)
    for (let i = 0; i < count; i++) {
      enemies.push(mk('squadron', {
        x: direction === 1 ? -32 - i * 44 : w + 32 + i * 44,
        y: h * .16, vx: direction * 2.1, vy: 1.15,
        size: 32, color: '#ff2fa0', shapeIdx: 4,
        movementType: 'formation', slot: i, direction,
        spawnX: direction === 1 ? -32 - i * 44 : w + 32 + i * 44, spawnY: h * .16,
      }))
    }
  } else if (pattern === 3) {
    // Heavies — alternating armoured ships and bulwarks (bulwarks from wave 12).
    const bulwarkWave = waveNumber >= 12 && waveNumber % 2 === 0
    const count = 3
    for (let i = 0; i < count; i++) {
      if (bulwarkWave) {
        enemies.push(mk('bulwark', {
          x: 60 + i / (count - 1) * (w - 120), y: -56 - i * 30,
          vx: 0, vy: 0.5, size: 56, color: '#ff70bc', shapeIdx: 2,
          movementType: 'straight', hp: ENEMY_STATS.bulwark.hp, maxHp: ENEMY_STATS.bulwark.hp,
        }))
      } else {
        const hp = heavyHpFor(waveNumber)
        enemies.push(mk('heavy', {
          x: 60 + i / (count - 1) * (w - 120), y: -52 - i * 30,
          vx: 0, vy: 0.7, size: 52, color: '#ff70bc', shapeIdx: 3,
          movementType: 'straight', hp, maxHp: hp,
        }))
      }
    }
  } else if (pattern === 4) {
    // Divers and weavers: fast darts plus sinus weavers.
    const count = waveCountFor(waveNumber, w)
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) {
        enemies.push(mk('diver', {
          x: 40 + Math.random() * (w - 80), y: -30 - i * 26,
          vx: 0, vy: 1.5, size: 26, color: '#ff2fa0', shapeIdx: 1,
          movementType: 'dive', lockY: h * 0.35,
        }))
      } else {
        const bx = 40 + i / (count - 1) * (w - 80)
        enemies.push(mk('weaver', {
          x: bx, y: -30 - i * 26, baseX: bx,
          vx: 0, vy: 1.0, size: 30, color: '#ff2fa0', shapeIdx: 5,
          movementType: 'weave',
        }))
      }
    }
  } else if (pattern === 5) {
    // Snipers: slow lane-seekers with the fastest bolts (max 2).
    const alive = enemies.filter(e => e.kind === 'sniper').length
    const count = Math.min(2, Math.max(1, waveCountFor(waveNumber, w) - 3)) - Math.min(2, alive)
    for (let i = 0; i < Math.max(1, count); i++) {
      enemies.push(mk('sniper', {
        x: 60 + Math.random() * (w - 120), y: -30 - i * 40,
        vx: 0, vy: 0.55, size: 26, color: '#ff70bc', shapeIdx: 4,
        movementType: 'sniper',
      }))
    }
  } else {
    // Stingers and splitters: fast edge darts plus skulls with mites.
    const count = waveCountFor(waveNumber, w)
    const direction = Math.random() < 0.5 ? 1 : -1
    for (let i = 0; i < count; i++) {
      if (waveNumber >= 8 && i === count - 1) {
        enemies.push(mk('splitter', {
          x: 50 + Math.random() * (w - 100), y: -40,
          vx: 0, vy: 0.9, size: 40, color: '#ff70bc', shapeIdx: 5,
          movementType: 'straight',
        }))
      } else {
        enemies.push(mk('stinger', {
          x: direction === 1 ? -26 - i * 40 : w + 26 + i * 40,
          y: h * .2, vx: direction * 4.2, vy: 1.0,
          size: 26, color: '#ff2fa0', shapeIdx: 1,
          movementType: 'formation', slot: i, direction,
          spawnX: direction === 1 ? -26 - i * 40 : w + 26 + i * 40, spawnY: h * .2,
        }))
      }
    }
  }
  warpT = reducedMotion ? 0 : 0.5
  audio?.setIntensity(intensityFor(waveNumber, bosses.length > 0), bosses.length > 0)
  audio?.play('waveStart')
}

function spawnBoss() {
  if (!canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  const hp = bossMaxHpFor(bossNum, waveNumber)
  const atk = bossAttackFor(bossNum)
  bosses.push({
    x: w / 2,
    y: -150,
    targetY: Math.min(h * .28, 150),
    vx: (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 1),
    vy: 1.5,
    size: Math.min(210, w * .46, h * .48),
    hp,
    maxHp: hp,
    num: bossNum,
    color: '#ff2fa0',
    shootCooldown: atk.base + Math.random() * atk.spread,
    lastShot: performance.now(),
    arrived: false,
    dirChangeTimer: 0
  })
  bossNum++
  audio?.setIntensity(3, true)
  audio?.play('bossStinger')
}

function spawnParticles(x, y, color, count = 8) {
  const s = fxScale()
  const n = Math.max(2, Math.round(count * s))
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 / n) * i + Math.random() * 0.5
    const speed = 1.5 + Math.random() * 4
    pushParticle({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.015 + Math.random() * 0.025,
      color,
      size: 3 + Math.random() * 5
    })
  }
}

// Kill shatter: directional debris in the victim's colour (Invaders' idea,
// adapted to procedural shapes).
function spawnShatter(x, y, color, size) {
  const s = fxScale()
  const n = Math.max(3, Math.round(Math.min(12, 4 + size / 6) * s))
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 5
    pushParticle({
      x: x + (Math.random() - 0.5) * size * 0.5,
      y: y + (Math.random() - 0.5) * size * 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
      color,
      size: 2 + Math.random() * (size / 8)
    })
  }
}

function spawnSmoke(x, y, count = 6) {
  const s = fxScale()
  const n = Math.max(1, Math.round(count * s))
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.3 + Math.random() * 1
    pushParticle({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.4,
      life: 1,
      decay: 0.006 + Math.random() * 0.01,
      color: `rgba(${80 + Math.floor(Math.random() * 80)}, ${80 + Math.floor(Math.random() * 60)}, ${80 + Math.floor(Math.random() * 60)}, 0.5)`,
      size: 6 + Math.random() * 10
    })
  }
}

function triggerShockwave(x, y, color = '#ff2fa0', lethal = true) {
  shockwaves.push({ x, y, radius: 0, maxRadius: Math.max(canvas.value.width, canvas.value.height), speed: 12, life: 1, color, lethal })
}

// Nova blast: instant screen bomb from the N capsule.
function novaBlast(now) {
  triggerShockwave(player.x, player.y - 100, '#ffd23f')
  spawnShatter(player.x, player.y - 100, '#ffd23f', 60)
  audio?.play('nova')
  for (let j = enemies.length - 1; j >= 0; j--) {
    damageEnemy(j, 2, now)
  }
  for (let j = bosses.length - 1; j >= 0; j--) {
    const boss = bosses[j]
    boss.hp -= 5
    spawnParticles(boss.x, boss.y, '#ffd23f', 10)
    if (boss.hp <= 0) killBoss(j, now)
  }
}

// Single kill entry point: damage an enemy by index, killing it past 0 HP.
function damageEnemy(index, amount, now) {
  const e = enemies[index]
  e.hp -= amount
  e.flash = 5
  if (e.hp <= 0) {
    killEnemy(index, now)
    return true
  }
  return false
}

function killEnemy(index, now) {
  const e = enemies[index]
  spawnShatter(e.x, e.y, e.color, e.size)
  spawnSmoke(e.x, e.y, 4)
  registerKill(now)
  addScore(ENEMY_STATS[e.kind]?.score ?? (e.maxHp > 1 ? 250 : 100), now)
  enemies.splice(index, 1)
  // Splitters pop into two diving mites (never spawned directly).
  if (e.kind === 'splitter' && canvas.value) {
    for (const dir of [-1, 1]) {
      enemies.push(makeEnemy({
        kind: 'mite', x: e.x + dir * 14, y: e.y,
        vx: dir * 1.2, vy: 1.6, size: 18, color: '#ff2fa0', shapeIdx: 1,
        movementType: 'straight', hp: 1, maxHp: 1,
        shootCooldown: 1e9, lastShot: now, shootChance: 0,
      }))
    }
  }
  audio?.play('kill')
}

// Boss kill: gold shockwave cinematic — flash, shake, hit-stop, bounty, heal.
function killBoss(j, now) {
  const boss = bosses[j]
  spawnShatter(boss.x, boss.y, '#ffffff', boss.size)
  spawnShatter(boss.x, boss.y, boss.color, boss.size)
  spawnSmoke(boss.x, boss.y, 12)
  triggerShockwave(boss.x, boss.y, '#ffd23f')
  if (!reducedMotion) {
    shake = Math.min(1, shake + 0.9)
    hitStopUntil = now + 90
  }
  addScore(bossBountyFor(boss.num ?? 0), now)
  hull = heal(hull, HEAL_BOSS)
  audio?.play('bossKill')
  bosses.splice(j, 1)
  if (bosses.length === 0) audio?.setIntensity(intensityFor(waveNumber, false), false)
}

function triggerDeathExplosion(x, y) {
  deathExplosion = { x, y, phase: 0, timer: 0, flash: 1 }
  // Bright white flash at center
  pushParticle({
    x, y, vx: 0, vy: 0,
    life: 1, decay: 0.02, color: '#ffffff', size: 90
  })
  // Neon core — pink and cyan expanding fragments
  const s = fxScale()
  for (let i = 0; i < Math.round(60 * s); i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.5 + Math.random() * 3.5
    const colors = ['#ff2fa0', '#ff70bc', '#2ff3ff', '#f2e9ff', '#ffffff']
    pushParticle({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.006 + Math.random() * 0.01,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 5 + Math.random() * 12
    })
  }
  // Cyan debris flying outward (ship fragments)
  for (let i = 0; i < Math.round(28 * s); i++) {
    const angle = (Math.PI * 2 / 28) * i + Math.random() * 0.3
    const speed = 2.5 + Math.random() * 6
    pushParticle({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.008 + Math.random() * 0.012,
      color: '#2ff3ff',
      size: 3 + Math.random() * 6
    })
  }
  // Expanding sparks ring
  for (let i = 0; i < Math.round(32 * s); i++) {
    const angle = (Math.PI * 2 / 32) * i
    const speed = 5 + Math.random() * 4
    pushParticle({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.012 + Math.random() * 0.01,
      color: '#2ff3ff',
      size: 2 + Math.random() * 3
    })
  }
  // Heavy smoke cloud
  spawnSmoke(x, y, 25)
  // Shockwave ring from player death
  shockwaves.push({
    x, y,
    radius: 0,
    maxRadius: 400,
    speed: 7,
    life: 1,
    color: '#ff2fa0',
  })
}

// ---------------------------------------------------------------- Esc pause / hold-quit

function escActive() {
  return gameStarted && !gameOver
}

function togglePause() {
  if (!gameStarted || gameOver) return
  paused.value = !paused.value
  keys = {}
  audio?.suspend(paused.value)
}

// A 3 s Escape hold cancels the run: the same death as a collision, so the
// landing shows GAME OVER with the run's score.
function quitToGameOver() {
  if (!gameStarted || gameOver) return
  paused.value = false
  keys = {}
  audio?.suspend(false)
  gameOver = true
  triggerDeathExplosion(player.x, player.y)
  audio?.fadeMusic(1.5)
  audio?.play('death')
  emit('death')
}

// A hull hit: escort sacrificed first, then a segment, a weapon step and
// brief invulnerability. Returns true when the run ends.
function hitPlayer(now, source) {
  if (!gameStarted || gameOver || now < invulnUntil) return false
  if (dualTimer > 0) {
    // The escort takes the hit instead — even against a ram.
    dualTimer = 0
    spawnShatter(player.x - player.width * 0.7, player.y, '#2ff3ff', 30)
    audio?.play('shield')
    invulnUntil = now + 600
    comboCount = 0
    return false
  }
  hull = applyDamage(hull, DMG[source] ?? 1)
  bulletLevel = Math.max(1, bulletLevel - 1)
  comboCount = 0
  shake = reducedMotion ? 0 : Math.min(1, shake + 0.5)
  audio?.play('hullHit')
  if (hull <= 0) {
    gameOver = true
    triggerDeathExplosion(player.x, player.y)
    audio?.fadeMusic(1.5)
    audio?.play('death')
    emit('death')
    return true
  }
  invulnUntil = now + INVULN_TIME * 1000
  return false
}

function tickTimers(dt) {
  if (dualTimer > 0) dualTimer = Math.max(0, dualTimer - dt)
  if (rearTimer > 0) rearTimer = Math.max(0, rearTimer - dt)
  if (tempoTimer > 0) tempoTimer = Math.max(0, tempoTimer - dt)
  if (magnetTimer > 0) magnetTimer = Math.max(0, magnetTimer - dt)
  if (comboTimer > 0) comboTimer = Math.max(0, comboTimer - dt)
}

function update(now) {
  if (!canvas.value || !gameStarted) return

  // Keep updating particles/shockwaves after death for explosion animation
  if (gameOver) {
    particles = particles.filter(p => {
      p.x += p.vx
      p.y += p.vy
      p.life -= p.decay
      p.vy += 0.02
      return p.life > 0
    })
    shockwaves = shockwaves.filter(sw => {
      sw.radius += sw.speed
      sw.life = Math.max(0, 1 - sw.radius / sw.maxRadius)
      return sw.life > 0
    })
    if (deathExplosion) {
      deathExplosion.timer++
      deathExplosion.flash = Math.max(0, deathExplosion.flash - 0.04)
    }
    return
  }
  const w = canvas.value.width
  const h = canvas.value.height
  const dt = Math.min(0.1, Math.max(0, (now - (lastFrameTime || now)) / 1000))
  lastFrameTime = now
  tickTimers(dt)
  if (warpT > 0) warpT = Math.max(0, warpT - dt)
  if (shake > 0) shake = Math.max(0, shake - dt * 2.5)

  // Decay player glow
  if (playerGlow > 0) playerGlow = Math.max(0, playerGlow - 0.02)

  // Player movement
  if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed
  if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed
  if (keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed
  if (keys['ArrowDown'] || keys['KeyS']) player.y += player.speed
  player.x = Math.max(player.width / 2, Math.min(w - player.width / 2, player.x))
  player.y = Math.max(player.height, Math.min(h - player.height / 2, player.y))

  // Shooting (rear guard adds a backwards bolt in the same volley)
  if (keys['Space'] && now - lastShotTime > 180) {
    const streams = dualTimer > 0 ? bulletLevel + 1 : bulletLevel
    const n = Math.min(streams, BULLET_LEVEL_MAX + 1)
    const bulletSpeed = 7
    if (n === 1) {
      bullets.push({ x: player.x, y: player.y - player.height / 2, vx: 0, vy: -bulletSpeed })
    } else {
      const totalSpread = Math.min(n * 10, 70) * (Math.PI / 180)
      for (let i = 0; i < n; i++) {
        const angle = -Math.PI / 2 + (i / (n - 1) - 0.5) * totalSpread
        bullets.push({
          x: player.x, y: player.y - player.height / 2,
          vx: Math.cos(angle) * bulletSpeed,
          vy: Math.sin(angle) * bulletSpeed
        })
      }
    }
    if (rearTimer > 0) bullets.push({ x: player.x, y: player.y + player.height / 2, vx: 0, vy: bulletSpeed })
    muzzleT = 3
    audio?.play('shoot')
    lastShotTime = now
  }
  if (muzzleT > 0) muzzleT--

  // Update bullets
  bullets = bullets.filter(b => {
    b.x += (b.vx || 0)
    b.y += b.vy
    return b.y > -10 && b.y < h + 10 && b.x > -10 && b.x < w + 10
  })

  // Update enemy bullets (magnet brakes nearby bullets, never steers them in)
  enemyBullets = enemyBullets.filter(b => {
    if (magnetTimer > 0) {
      const dx = b.x - player.x, dy = b.y - player.y
      if (dx * dx + dy * dy < 60 * 60) {
        b.vy *= 0.97
        b.x += Math.sign(dx || 1) * 0.15
      }
    }
    b.y += b.vy
    return b.y < h + 10
  })

  // Wave spawning
  if (now - waveTimer > waveInterval) {
    spawnWave()
    waveTimer = now
    waveInterval = waveIntervalFor(waveNumber)
  }

  // Boss spawning (tightens with every boss)
  if (now - bossTimer > bossEveryFor(bossNum) * 1000) {
    spawnBoss()
    bossTimer = now
  }

  const foeMul = enemySpeedMul(waveNumber) * (tempoTimer > 0 ? 0.6 : 1)

  // Update enemies
  enemies = enemies.filter(enemy => {
    enemy.flash = Math.max(0, enemy.flash - 1)
    if (enemy.movementType === 'formation') {
      enemy.age++
      enemy.x += enemy.vx * foeMul
      enemy.y = enemy.spawnY + Math.sin(enemy.age * .012) * h * .13 + enemy.slot * 12
      if (enemy.kind === 'stinger' && !enemy.hasFired && ((enemy.direction === 1 && enemy.x > w / 2) || (enemy.direction === -1 && enemy.x < w / 2))) {
        enemy.hasFired = true
        enemyBullets.push({ x: enemy.x, y: enemy.y + 10, vy: 3.5 * foeMul })
      }
    } else if (enemy.movementType === 'dive') {
      if (enemy.y < enemy.lockY) {
        enemy.y += enemy.vy * foeMul
      } else {
        const dx = player.x - enemy.x
        enemy.vx = Math.max(-2.5, Math.min(2.5, dx * 0.02))
        enemy.x += enemy.vx * foeMul
        enemy.y += 4.5 * foeMul
      }
    } else if (enemy.movementType === 'weave') {
      enemy.age++
      enemy.y += enemy.vy * foeMul
      enemy.x = enemy.baseX + Math.sin(enemy.age * .05) * w * .12
    } else if (enemy.movementType === 'sniper') {
      enemy.y += enemy.vy * foeMul
      const dx = player.x - enemy.x
      if (Math.abs(dx) > 30) enemy.x += Math.sign(dx) * 0.6 * foeMul
    } else {
      enemy.y += enemy.vy * foeMul
      enemy.x = Math.max(enemy.size / 2, Math.min(w - enemy.size / 2, enemy.x))
    }
    if (enemy.movementType !== 'formation') enemy.x = Math.max(enemy.size / 2, Math.min(w - enemy.size / 2, enemy.x))
    if (enemy.y > enemy.size && enemy.x > enemy.size && enemy.x < w - enemy.size
        && now - enemy.lastShot > enemy.shootCooldown) {
      if (Math.random() < (enemy.shootChance ?? 1)) {
        const fast = enemy.kind === 'sniper'
        if (enemy.kind === 'bulwark') {
          for (const sx of [-0.8, 0, 0.8]) enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.size / 2, vx: sx, vy: 2.8 * foeMul })
        } else {
          enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.size / 2, vy: (fast ? 4.0 : boltSpeedFor(waveNumber)) + Math.random() * 1.5 })
        }
        enemy.lastShot = now
        enemy.shootCooldown = (fast ? 1400 : 800) + Math.random() * enemyRefireWindowFor(waveNumber)
      } else {
        enemy.lastShot = now
        enemy.shootCooldown = 400 + Math.random() * 400
      }
    }
    return enemy.y < h + enemy.size && (enemy.movementType !== 'formation' || (enemy.direction === 1 ? enemy.x < w + enemy.size : enemy.x > -enemy.size))
  })

  // Update bosses
  bosses = bosses.filter(boss => {
    // Move to target Y, then roam
    if (!boss.arrived) {
      boss.y += boss.vy
      if (boss.y >= boss.targetY) {
        boss.arrived = true
        boss.vy = 0
      }
    } else {
      // Semi-random roaming in top half (slowed by tempo)
      const tMul = tempoTimer > 0 ? 0.6 : 1
      boss.dirChangeTimer += 1
      if (boss.dirChangeTimer > 60 + Math.random() * 80) {
        boss.vx = (Math.random() - 0.5) * 3
        boss.vy = (Math.random() - 0.5) * 1.5
        boss.dirChangeTimer = 0
      }
      boss.x += boss.vx * tMul
      boss.y += boss.vy * tMul
      // Keep in top half
      boss.x = Math.max(boss.size * .6, Math.min(w - boss.size * .6, boss.x))
      boss.y = Math.max(boss.size * .55 + 18, Math.min(h * 0.4, boss.y))
    }

    // Boss shooting — fan widens from boss #3 with an aimed middle bolt
    if (boss.arrived && now - boss.lastShot > boss.shootCooldown) {
      const spread = (Math.random() - 0.5) * 1.5
      enemyBullets.push({ x: boss.x - boss.size * .36, y: boss.y + boss.size * .38, vy: 3 + Math.random() * 1.5, vx: spread })
      enemyBullets.push({ x: boss.x + boss.size * .36, y: boss.y + boss.size * .38, vy: 3 + Math.random() * 1.5, vx: -spread })
      if (bossFanCount(boss.num ?? 0) >= 3) {
        const aim = Math.max(-2, Math.min(2, (player.x - boss.x) * 0.01))
        enemyBullets.push({ x: boss.x, y: boss.y + boss.size * .4, vy: 3.5 + Math.random(), vx: aim })
      }
      boss.lastShot = now
      const atk = bossAttackFor(boss.num ?? 0)
      boss.shootCooldown = atk.base + Math.random() * atk.spread
    }

    return boss.hp > 0
  })

  // Update enemy bullets (with vx for boss aimed bullets)
  enemyBullets = enemyBullets.filter(b => {
    if (b.vx) b.x += b.vx
    return b.y < h + 10 && b.x > -20 && b.x < w + 20
  })

  // Bullet-enemy collisions
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    let bulletConsumed = false

    // Check bosses
    for (let j = bosses.length - 1; j >= 0; j--) {
      const boss = bosses[j]
      const dx = b.x - boss.x
      const dy = b.y - boss.y
      if (dx * dx + dy * dy < (boss.size / 2 + 4) * (boss.size / 2 + 4)) {
        boss.hp--
        spawnParticles(b.x, b.y, boss.color, 7)
        spawnSmoke(b.x, b.y, 3)
        bullets.splice(i, 1)
        bulletConsumed = true
        audio?.play('bossHit')
        if (boss.hp <= 0) killBoss(j, now)
        break
      }
    }
    if (bulletConsumed) continue

    // Check normal enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j]
      const dx = b.x - e.x
      const dy = b.y - e.y
      if (dx * dx + dy * dy < (e.size / 2 + 4) * (e.size / 2 + 4)) {
        bullets.splice(i, 1)
        if (!damageEnemy(j, 1, now)) {
          spawnParticles(b.x, b.y, e.color, 5)
          audio?.play('armourTick')
        }
        break
      }
    }
  }

  // Shockwave kills all normal enemies in the ring (cosmetic combo rings skip this)
  shockwaves.forEach(sw => {
    if (sw.lethal === false) return
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j]
      const dx = e.x - sw.x
      const dy = e.y - sw.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < sw.radius + 20 && dist > sw.radius - 30) damageEnemy(j, e.hp, now)
    }
  })

  // Update shockwaves
  shockwaves = shockwaves.filter(sw => {
    sw.radius += sw.speed
    sw.life = Math.max(0, 1 - sw.radius / sw.maxRadius)
    return sw.life > 0
  })

  // Shield flash decay
  if (shieldFlash > 0) shieldFlash = Math.max(0, shieldFlash - 0.05)

  // Enemy bullet-player collision (shield/aegis block bullets from above)
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i]
    // Check shield first — shield sits in front of the ship
    if (shield || aegis > 0) {
      const shieldY = player.y - player.height / 2 - 12
      const shieldW = player.width * 1.2
      if (b.x > player.x - shieldW / 2 && b.x < player.x + shieldW / 2 &&
          b.y > shieldY - 8 && b.y < shieldY + 8) {
        // Shield absorbs the bullet
        if (aegis > 0) aegis--
        else shield = false
        shieldFlash = 1
        spawnParticles(b.x, shieldY, '#2ff3ff', 12)
        spawnParticles(b.x, shieldY, '#ffffff', 6)
        audio?.play('shield')
        enemyBullets.splice(i, 1)
        continue
      }
    }
    const dx = b.x - player.x
    const dy = b.y - player.y
    if (dx * dx + dy * dy < (player.width / 2 + 3) * (player.width / 2 + 3)) {
      enemyBullets.splice(i, 1)
      if (hitPlayer(now, 'bolt')) return
    }
  }

  // Enemy-player collision (shield does NOT help here — the escort does)
  for (let j = enemies.length - 1; j >= 0; j--) {
    const e = enemies[j]
    const dx = e.x - player.x
    const dy = e.y - player.y
    if (dx * dx + dy * dy < (e.size / 2 + player.width / 2) * (e.size / 2 + player.width / 2)) {
      const wasInvuln = now < invulnUntil
      if (hitPlayer(now, 'ram')) return
      // A survived ram still destroys the rammer (no free passes) — unless
      // the player was invulnerable, which blocks the hit outright.
      if (!wasInvuln) damageEnemy(j, e.hp, now)
    }
  }

  // Boss-player collision (shield does NOT help here)
  for (const boss of bosses) {
    const dx = boss.x - player.x
    const dy = boss.y - player.y
    if (dx * dx + dy * dy < (boss.size / 2 + player.width / 2) * (boss.size / 2 + player.width / 2)) {
      if (hitPlayer(now, 'ram')) return
    }
  }

  // Powerup spawning (weighted table + pity for a low hull)
  if (now - powerupTimer > powerupInterval) {
    const falling = powerups.length
    if (falling < MAX_FALLING_POWERUPS) {
      let type = pickPowerup(waveNumber, { shieldActive: shield, aegisActive: aegis > 0, hullFull: hull >= HULL_MAX })
      if (hull <= 1 && now - lastShieldTime > PITY_TIME_MS && aegis === 0) type = 'shield'
      powerups.push({
        x: 40 + Math.random() * (w - 80),
        y: -20,
        vy: 1.2,
        size: 28,
        pulse: 0,
        type
      })
    }
    powerupTimer = now
  }

  // Update powerups (magnet attracts falling capsules toward the ship)
  powerups = powerups.filter(p => {
    p.y += p.vy
    p.pulse += 0.08
    if (magnetTimer > 0) p.x += Math.max(-2, Math.min(2, (player.x - p.x) * 0.03))
    const dx = p.x - player.x
    const dy = p.y - player.y
    if (dx * dx + dy * dy < (p.size / 2 + player.width / 2) * (p.size / 2 + player.width / 2)) {
      applyPowerup(p.type, now)
      return false
    }
    return p.y < h + 20
  })

  // Update particles
  particles = particles.filter(p => {
    p.x += p.vx
    p.y += p.vy
    p.life -= p.decay
    p.vy += 0.02
    return p.life > 0
  })

}

function applyPowerup(type, now) {
  if (type === 'shield') {
    if (hull < HULL_MAX) {
      hull = heal(hull, 1)
      spawnParticles(player.x, player.y - player.height / 2, '#2ff3ff', 16)
    } else if (!shield && aegis === 0) {
      shield = true
      spawnParticles(player.x, player.y - player.height / 2, '#2ff3ff', 16)
      spawnParticles(player.x, player.y - player.height / 2, '#ffffff', 8)
    } else {
      bulletLevel = Math.min(BULLET_LEVEL_MAX, bulletLevel + 1)
      spawnParticles(player.x, player.y, '#2ff3ff', 24)
    }
    playerGlow = 0.5
    lastShieldTime = now
    audio?.play('shield')
  } else if (type === 'aegis') {
    aegis = 2
    shield = false
    playerGlow = 0.5
    spawnParticles(player.x, player.y - player.height / 2, '#2ff3ff', 16)
    spawnParticles(player.x, player.y - player.height / 2, '#ffffff', 8)
    lastShieldTime = now
    audio?.play('shield')
  } else if (type === 'weapon') {
    bulletLevel = Math.min(BULLET_LEVEL_MAX, bulletLevel + 1)
    playerGlow = 1
    spawnParticles(player.x, player.y, '#2ff3ff', 24)
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 / 30) * i
      const speed = 3 + Math.random() * 4
      const r = player.width * 0.6
      pushParticle({
        x: player.x + Math.cos(angle) * r,
        y: player.y + Math.sin(angle) * r,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, decay: 0.02 + Math.random() * 0.02,
        color: Math.random() < 0.5 ? '#2ff3ff' : '#ffffff',
        size: 3 + Math.random() * 3
      })
    }
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 2
      pushParticle({
        x: player.x + (Math.random() - 0.5) * 20,
        y: player.y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 1, decay: 0.01 + Math.random() * 0.015,
        color: `rgba(0, ${150 + Math.floor(Math.random() * 105)}, ${200 + Math.floor(Math.random() * 55)}, 0.6)`,
        size: 6 + Math.random() * 8
      })
    }
    pushParticle({
      x: player.x, y: player.y,
      vx: 0, vy: 0,
      life: 1, decay: 0.05,
      color: '#ffffff',
      size: 40
    })
    audio?.play('pickup')
  } else if (type === 'dual') {
    dualTimer = POWERUP_DURATION.dual
    playerGlow = 1
    spawnParticles(player.x, player.y, '#2ff3ff', 20)
    audio?.play('pickup')
  } else if (type === 'rear') {
    rearTimer = POWERUP_DURATION.rear
    playerGlow = 0.7
    spawnParticles(player.x, player.y, '#ffd23f', 16)
    audio?.play('pickup')
  } else if (type === 'tempo') {
    tempoTimer = POWERUP_DURATION.tempo
    spawnParticles(player.x, player.y, '#2ff3ff', 16)
    audio?.play('pickup')
  } else if (type === 'nova') {
    novaBlast(now)
  } else if (type === 'magnet') {
    magnetTimer = POWERUP_DURATION.magnet
    spawnParticles(player.x, player.y, '#ff70bc', 16)
    audio?.play('pickup')
  } else if (type === 'combo') {
    comboTimer = POWERUP_DURATION.combo
    spawnParticles(player.x, player.y, '#ffd23f', 20)
    audio?.play('combo')
  }
}

function updateBackdrop() {
  if (!canvas.value || reducedMotion) return
  const w = canvas.value.width
  const h = canvas.value.height
  const warpMul = warpT > 0 ? 4 : 1
  const warpStretch = warpT > 0 ? 10 : 0
  stars.forEach(star => {
    star.y += star.speed * warpMul
    star.stretch = warpStretch * star.speed
    if (star.y > h) {
      star.y = 0
      star.stretch = 0
    }
  })
  bgShapes = bgShapes.filter(s => {
    s.y += s.speed
    return s.y < h + s.size
  })
  while (bgShapes.length < 6) bgShapes.push(createBgShape())
  bgShapes.sort((a, b) => a.depth - b.depth)
  // Deep field drifts far slower than the rocks.
  for (const n of nebulae) {
    n.y += n.speed
    if (n.y - n.r > h) n.y = -n.r
  }
  if (planet) {
    planet.y += planet.speed
    if (planet.y - planet.r > h) {
      planet.y = -planet.r
      planet.x = w * (0.15 + Math.random() * 0.7)
    }
  }
  if (station) {
    station.y += station.speed
    station.blink += 0.02
    if (station.y - station.size > h) {
      station.y = -station.size
      station.x = w * (0.1 + Math.random() * 0.8)
    }
  }
}

function drawHud(now) {
  const w = canvas.value.width
  // Hull bar: 5 segments, cyan → gold → blinking pink under 2.
  const segW = 26, segH = 7, gap = 5
  const x0 = 12, y0 = 12
  const blink = hull <= 1 && Math.floor(now / 300) % 2 === 0
  for (let i = 0; i < HULL_MAX; i++) {
    const on = i < hull
    ctx.fillStyle = !on ? 'rgba(80,60,110,0.5)'
      : hull >= 4 ? '#2ff3ff' : hull >= 2 ? '#ffd23f' : blink ? '#ff70bc' : '#ff2fa0'
    ctx.fillRect(x0 + i * (segW + gap), y0, segW, segH)
  }
  // Wave + combo under the hull.
  ctx.font = `10px ${MACHINE_FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(207,233,255,0.55)'
  ctx.fillText(`WAVE ${waveNumber}`, x0, y0 + segH + 5)
  const mult = scoreMult(now)
  if (mult > 1) {
    ctx.fillStyle = '#ffd23f'
    ctx.fillText(`x${mult} COMBO`, x0, y0 + segH + 19)
  }
  // Radio: station name, M / tap cycles.
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(207,233,255,0.55)'
  ctx.fillText(`♪ ${currentTrackName()} [M]`, w - 12, y0 + 1)
}

function draw() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  const now = performance.now()

  ctx.fillStyle = '#0b0616'
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  if (shake > 0 && !reducedMotion) {
    ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12)
  }

  // Compute parallax: player moves left → background shifts right (inverted)
  // Smooth interpolation for acceleration/deceleration feel
  const centerX = w / 2
  const targetParallaxX = gameStarted && !reducedMotion && !paused.value ? -(player.x - centerX) * 0.015 : 0
  if (!paused.value) smoothParallaxX += (targetParallaxX - smoothParallaxX) * 0.04

  // Deep field first: nebulae, planet arc, station silhouette.
  for (const n of nebulae) {
    ctx.drawImage(n.img, n.x - n.r + smoothParallaxX * 2, n.y - n.r)
  }
  if (planet) {
    const px = planet.x + smoothParallaxX * 4
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.fillStyle = '#150a28'
    ctx.beginPath()
    ctx.arc(px, planet.y, planet.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,47,160,0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(px, planet.y, planet.r * 1.5, planet.r * 0.32, planet.ringTilt, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,112,188,0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(px, planet.y, planet.r * 1.2, planet.r * 0.26, planet.ringTilt, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  if (station) {
    const sx = station.x + smoothParallaxX * 6
    const s = station.size
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.fillStyle = '#0a0518'
    ctx.beginPath()
    ctx.moveTo(sx - s / 2, station.y)
    ctx.lineTo(sx + s / 2, station.y - s * 0.18)
    ctx.lineTo(sx + s * 0.3, station.y + s * 0.2)
    ctx.lineTo(sx - s * 0.3, station.y + s * 0.2)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(177,105,245,0.4)'
    ctx.lineWidth = 1
    ctx.stroke()
    const lit = Math.sin(station.blink) > 0
    ctx.fillStyle = lit ? 'rgba(255,210,63,0.8)' : 'rgba(255,210,63,0.3)'
    for (let i = -1; i <= 1; i++) ctx.fillRect(sx + i * s * 0.22 - 1.5, station.y - 2, 3, 3)
    ctx.restore()
  }

  // Stars (with subtle parallax based on star speed as depth proxy;
  // stretched vertically while a warp is running).
  const mobileFx = w < 600
  stars.forEach(star => {
    const sx = star.x + smoothParallaxX * star.speed * 0.5
    ctx.fillStyle = `rgba(207, 233, 255, ${star.brightness * 0.5})`
    const stretch = star.stretch || 0
    ctx.fillRect(sx, star.y, star.size, star.size + stretch)
  })

  // Background geometric shapes (parallax per-shape depth)
  bgShapes.forEach(s => drawBgShape(s, smoothParallaxX))

  // Shockwaves (gold for boss/nova/combo, pink otherwise)
  shockwaves.forEach(sw => {
    const col = sw.color ?? '#ff2fa0'
    const glow = col === '#ffd23f' ? '#ffd23f' : '#ff2fa0'
    ctx.strokeStyle = col.startsWith('#')
      ? col + Math.round(sw.life * 0.8 * 255).toString(16).padStart(2, '0')
      : `rgba(255, 47, 160, ${sw.life * 0.8})`
    ctx.lineWidth = mobileFx ? 4 : 4 + sw.life * 8
    if (!mobileFx && !reducedMotion) {
      ctx.shadowColor = glow
      ctx.shadowBlur = 20 * sw.life
    }
    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
  })

  // Particles
  const noGlow = mobileFx || reducedMotion
  particles.forEach(p => {
    ctx.globalAlpha = p.life
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  })
  ctx.globalAlpha = 1
  void noGlow

  if (!gameOver) {
    // Player ship with powerup glow, in the Hangar ship's colours. The
    // vandal flies wider wings, matching its 3D striker silhouette.
    const hull = shipDef.colors.hull
    const trim = shipDef.colors.trim
    const wide = shipDef.variant === 'vandal' ? 1.25 : 1
    const invuln = performance.now() < invulnUntil
    const glowColor = playerGlow > 0 ? `rgba(47, 243, 255, ${playerGlow * 0.6})` : null
    ctx.save()
    if (invuln && Math.floor(now / 120) % 2 === 0) ctx.globalAlpha = 0.35
    if (glowColor) {
      ctx.shadowColor = hull
      ctx.shadowBlur = 25 + playerGlow * 20
    } else if (!mobileFx) {
      ctx.shadowColor = hull
      ctx.shadowBlur = 10
    }
    ctx.fillStyle = hull
    ctx.beginPath()
    ctx.moveTo(player.x, player.y - player.height / 2)
    ctx.lineTo(player.x + player.width / 2 * wide, player.y + player.height / 2)
    ctx.lineTo(player.x + player.width / 4 * wide, player.y + player.height / 4)
    ctx.lineTo(player.x - player.width / 4 * wide, player.y + player.height / 4)
    ctx.lineTo(player.x - player.width / 2 * wide, player.y + player.height / 2)
    ctx.closePath()
    ctx.fill()

    // Cockpit bar in the ship's trim colour.
    ctx.fillStyle = trim
    ctx.fillRect(player.x - 3, player.y - player.height * 0.1, 6, player.height * 0.4)
    ctx.shadowBlur = 0
    // Muzzle flash: one hot frame at the nose per volley.
    if (muzzleT > 0) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(player.x - 2, player.y - player.height / 2 - 8, 4, 8)
    }
    // Rear guard barrel.
    if (rearTimer > 0) {
      ctx.fillStyle = '#ffd23f'
      ctx.fillRect(player.x - 2, player.y + player.height / 2 - 2, 4, 8)
    }
    // Dual escort: a small wingman to port, sacrificed on the next hit.
    if (dualTimer > 0) {
      const ex = player.x - player.width * 0.85
      ctx.fillStyle = hull
      ctx.beginPath()
      ctx.moveTo(ex, player.y - 12)
      ctx.lineTo(ex + 11, player.y + 12)
      ctx.lineTo(ex - 11, player.y + 12)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = trim
      ctx.fillRect(ex - 1.5, player.y - 4, 3, 12)
    }
    ctx.restore()

    // Shield in front of ship (double arc while AEGIS holds two hits)
    if (shield || aegis > 0 || shieldFlash > 0) {
      const shieldY = player.y - player.height / 2 - 12
      const shieldW = player.width * 1.2
      const active = shield || aegis > 0
      const shieldAlpha = active ? 0.7 : shieldFlash * 0.8
      const shieldColor = active ? '#2ff3ff' : '#ffffff'
      ctx.shadowColor = shieldColor
      ctx.shadowBlur = active ? 12 : 25 * shieldFlash
      ctx.strokeStyle = shieldColor
      ctx.globalAlpha = shieldAlpha
      ctx.lineWidth = active ? 3 : 2
      ctx.beginPath()
      // Curved shield arc
      ctx.ellipse(player.x, shieldY, shieldW / 2, 6, 0, Math.PI, 0)
      ctx.stroke()
      if (aegis === 2) {
        ctx.beginPath()
        ctx.ellipse(player.x, shieldY - 5, shieldW / 2 - 6, 5, 0, Math.PI, 0)
        ctx.stroke()
      }
      // Inner glow fill
      ctx.fillStyle = `rgba(0, 200, 255, ${shieldAlpha * 0.2})`
      ctx.beginPath()
      ctx.ellipse(player.x, shieldY, shieldW / 2, 6, 0, Math.PI, 0)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
    }

    // Player bullets
    bullets.forEach(b => {
      const rear = b.vy > 0
      const col = rear ? '#ffd23f' : '#2ff3ff'
      // Outer glow
      if (!mobileFx) {
        ctx.shadowColor = col
        ctx.shadowBlur = 14
      }
      ctx.fillStyle = col
      ctx.fillRect(b.x - 3, b.y - 8, 6, 16)
      // Hot white core
      ctx.shadowBlur = 0
      ctx.fillStyle = '#cfe9ff'
      ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(b.x - 0.75, b.y - 6, 1.5, 12)
    })
    ctx.shadowBlur = 0
  }

  // Enemies
  enemies.forEach(e => {
    ctx.shadowColor = e.color
    ctx.shadowBlur = mobileFx ? 0 : 8
    ctx.save()
    ctx.translate(e.x, e.y)
    if (e.movementType === 'formation') ctx.rotate(e.direction * Math.PI / 2)
    enemyShapes[e.shapeIdx](ctx, 0, 0, e.size, e.flash ? '#ffffff' : e.color)
    ctx.restore()
    if (e.maxHp > 1) {
      ctx.strokeStyle = '#ff2fa0'
      ctx.lineWidth = 1
      ctx.strokeRect(e.x - e.size * .28, e.y - e.size * .38, e.size * .56, e.size * .62)
      ctx.fillStyle = '#0b0616'
      ctx.fillRect(e.x - 8, e.y - 6, 16, 9)
      ctx.fillStyle = '#ff70bc'
      for (let i = 0; i < e.hp; i++) ctx.fillRect(e.x - 8 + i * 6, e.y - 4, 4, 5)
    }
    ctx.shadowBlur = 0
  })

  // Bosses
  bosses.forEach(boss => {
    // Twin armoured wings, recessed reactor and four engine pods.
    ctx.save()
    ctx.translate(boss.x, boss.y)
    ctx.scale(boss.size, boss.size)
    ctx.lineWidth = 1.3 / boss.size
    ctx.shadowColor = boss.color
    ctx.shadowBlur = 10
    const panel = (points, fill = '#23102e') => {
      ctx.beginPath()
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = boss.color; ctx.stroke()
    }
    for (const side of [-1, 1]) {
      ctx.save(); ctx.scale(side, 1)
      panel([[.08,-.28],[.3,-.4],[.56,-.12],[.53,.27],[.35,.38],[.19,.08]])
      panel([[.22,-.23],[.33,-.29],[.46,-.08],[.41,.19],[.28,.1]], '#13091f')
      for (const x of [.26, .43]) {
        panel([[x-.035,-.27],[x+.035,-.27],[x+.04,-.43],[x-.04,-.43]])
        ctx.fillStyle = '#ff70bc'; ctx.fillRect(x-.023,-.47,.046,.04)
      }
      panel([[.3,.12],[.41,.12],[.41,.38],[.3,.38]], '#120826')
      ctx.fillStyle = '#ff70bc'; ctx.fillRect(.32,.32,.07,.05)
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(.24+i*.07,-.13); ctx.lineTo(.28+i*.06,-.02); ctx.stroke()
      }
      ctx.restore()
    }
    panel([[0,-.4],[.2,-.17],[.15,.23],[0,.4],[-.15,.23],[-.2,-.17]], '#301037')
    panel([[0,-.21],[.085,-.08],[.065,.1],[0,.17],[-.065,.1],[-.085,-.08]], '#ff2fa0')
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#ff70bc'
    ctx.beginPath(); ctx.moveTo(0,-.36); ctx.lineTo(0,-.24); ctx.moveTo(0,.2); ctx.lineTo(0,.33); ctx.stroke()
    ctx.restore()

    // HP bar
    const barW = boss.size * 0.8
    const barH = 4
    const barX = boss.x - barW / 2
    const barY = boss.y - boss.size / 2 - 10
    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barY, barW, barH)
    ctx.fillStyle = '#ff2fa0'
    ctx.fillRect(barX, barY, barW * (boss.hp / boss.maxHp), barH)
  })

  // Powerups — gold diamonds with a per-type letter. S heals/shields,
  // P feeds the fan; D/R/A/T/N/M/C are the new capsules.
  powerups.forEach(p => {
    const glow = 0.6 + 0.4 * Math.sin(p.pulse)
    const pColor = '#ffd23f'
    const pColorRgb = '255, 210, 63'
    ctx.shadowColor = pColor
    ctx.shadowBlur = 20 + 15 * glow
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.pulse * 0.5)
    // Outer glow ring
    ctx.strokeStyle = `rgba(${pColorRgb}, ${0.3 * glow})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, p.size * 0.75, 0, Math.PI * 2)
    ctx.stroke()
    // Diamond shape
    ctx.fillStyle = `rgba(${pColorRgb}, ${0.8 + 0.2 * glow})`
    ctx.beginPath()
    const s = p.size / 2
    ctx.moveTo(0, -s)
    ctx.lineTo(s, 0)
    ctx.lineTo(0, s)
    ctx.lineTo(-s, 0)
    ctx.closePath()
    ctx.fill()
    // Letter
    ctx.fillStyle = '#0b0616'
    ctx.font = `bold ${p.size * 0.55}px ${MACHINE_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(POWERUP_LETTERS[p.type] ?? '?', 0, 1)
    ctx.restore()
    ctx.shadowBlur = 0
  })

  // Enemy bullets
  ctx.fillStyle = '#ff2fa0'
  ctx.shadowColor = '#ff2fa0'
  ctx.shadowBlur = mobileFx ? 0 : 6
  enemyBullets.forEach(b => {
    ctx.fillRect(b.x - 2, b.y - 4, 4, 8)
  })
  ctx.shadowBlur = 0

  // Tempo tint: cold wash while slow-mo runs.
  if (tempoTimer > 0) {
    ctx.fillStyle = 'rgba(47, 243, 255, 0.05)'
    ctx.fillRect(0, 0, w, h)
  }

  // Death explosion screen flash
  if (deathExplosion && deathExplosion.flash > 0) {
    ctx.fillStyle = `rgba(255, 47, 160, ${deathExplosion.flash * 0.4})`
    ctx.fillRect(0, 0, w, h)
  }

  ctx.restore()

  // Canvas HUD: hull segments, wave, combo, radio (screen space, unshaken).
  if (gameStarted) drawHud(now)
}

function gameLoop(now) {
  if (!gameRunning) return
  if (!paused.value) {
    // Hit-stop freezes the world but keeps drawing (boss-kill beat).
    if (now >= hitStopUntil) {
      updateBackdrop()
      update(now)
    }
  }
  draw()
  animationFrameId = requestAnimationFrame(gameLoop)
}

function setupCanvas() {
  if (!canvas.value) return
  canvas.value.width = canvas.value.offsetWidth
  canvas.value.height = canvas.value.offsetHeight
  ctx = canvas.value.getContext('2d')
  initDeepField()
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
  if (e.code === 'KeyM' && !e.repeat) {
    cycleRadio()
    return
  }
  keys[e.code] = true
  if (e.code === 'Space') e.preventDefault()

  if (!gameStarted && e.code === 'Enter') {
    resetGame()
    return
  }
  if (gameOver && e.code === 'Enter') {
    resetGame()
  }
}

function handleKeyUp(e) {
  keys[e.code] = false
}

function handleResize() {
  setupCanvas()
  initStars()
  initBgShapes()
}

function handleVisibility() {
  if (typeof document === 'undefined') return
  if (document.hidden) {
    if (gameStarted && !gameOver && !paused.value) togglePause()
    else audio?.suspend(true)
  } else if (!paused.value) {
    audio?.suspend(false)
  }
}

// Touch controls
let touchActive = false
const TOUCH_Y_OFFSET = 80

function isInteractiveElement(el) {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return true
  if (el.closest('a, button, .social-links, .profile-card')) return true
  return false
}

function isRadioTap(clientX, clientY) {
  if (!canvas.value) return false
  const r = canvas.value.getBoundingClientRect()
  return clientY - r.top < 44 && clientX - r.left > r.width - 150
}

let tapStartX = 0
let tapStartY = 0

function handleTouchStart(e) {
  if (isInteractiveElement(e.target)) return
  if (!gameStarted || gameOver) {
    // Start on tap, not on touchstart, so a horizontal swipe can still
    // switch theme without launching the game.
    tapStartX = e.touches[0].clientX
    tapStartY = e.touches[0].clientY
    return
  }
  const t = e.touches[0]
  if (isRadioTap(t.clientX, t.clientY)) {
    cycleRadio()
    return
  }
  touchActive = true
  keys['Space'] = true
  const touch = e.touches[0]
  player.x = touch.clientX
  player.y = touch.clientY - TOUCH_Y_OFFSET
}

function handleTouchMove(e) {
  if (!touchActive) return
  if (isInteractiveElement(e.target)) return
  e.preventDefault()
  const touch = e.touches[0]
  player.x = touch.clientX
  player.y = touch.clientY - TOUCH_Y_OFFSET
}

function handleTouchEnd(e) {
  if (!touchActive && (!gameStarted || gameOver) && !isInteractiveElement(e.target)) {
    const t = e.changedTouches[0]
    if (Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 15) resetGame()
  }
  touchActive = false
  keys['Space'] = false
}

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  setupCanvas()
  initStars()
  initBgShapes()
  // Don't auto-start — wait for Enter
  player.x = canvas.value ? canvas.value.width / 2 : 0
  player.y = canvas.value ? canvas.value.height - 60 : 0
  gameRunning = true
  gameStarted = false
  animationFrameId = requestAnimationFrame(gameLoop)

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', handleResize)
  window.addEventListener('touchstart', handleTouchStart, { passive: false })
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd)
  document.addEventListener('visibilitychange', handleVisibility)
})

onBeforeUnmount(() => {
  gameRunning = false
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  audio?.dispose()
  audio = null
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
  document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<style scoped>
/* Full-viewport playfield behind the landing overlay. */
.galaga-canvas {
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
