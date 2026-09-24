<template>
  <canvas ref="canvas" class="galaga-canvas"></canvas>
  <Intercom :line="intercom" :shown="intercomShown" />
  <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup>
import { safeBottom } from '~/themes/base/safeBottom'
import EscHold from '../base/EscHold.vue'
import Intercom from './Intercom.vue'
import { readShipDef } from '~/composables/useShip'
import { readStoredPlayer } from '~/composables/useLeaderboard'
import {
  HULL_MAX, DMG, HEAL_BOSS, INVULN_TIME, BULLET_LEVEL_MAX, PITY_TIME_MS,
  MAX_FALLING_POWERUPS, MAX_PARTICLES,
  applyDamage, heal,
  waveIntervalFor, enemySpeedMul, enemyFireFirstFor, enemyRefireWindowFor,
  boltSpeedFor, shootChanceFor, waveCountFor, heavyHpFor, scoutHpFor,
  bossEveryFor, bossMaxHpFor, bossAttackFor, bossFanCount, bossBountyFor,
  bossRingEvery, bossRingCount, BOSS_ENRAGE_MUL, BOSS_WAVE_SLOWDOWN,
  ENEMY_STATS, POWERUP_LETTERS, POWERUP_NAMES, POWERUP_DURATION,
  SYNC, syncGain,
  pickPowerup, intensityFor,
} from './balance'
import {
  volley, applyWeaponPickup, pickTarget, steer, clampLevel,
  FIRE_INTERVAL, WEAPON_NAMES, SEEKER_LIFE,
} from './weapons'
import {
  createDirector, sectorFor, callsignFrom, visibleChars,
} from './story'
import { createPixelStage } from '../base/pixel/stage'
import { bigTextWidth, drawBigText, drawText, textWidth } from '../base/pixel/sprites'
import { arcTop, createGalagaArt, dot, paintNebula, paintPlanet, paintSpace, ring as pxRing, rockSprite } from './pixel'
import { createGalagaAudio } from './audio'
const emit = defineEmits(['score', 'death', 'restart', 'started'])

// The Hangar ship, read live: the same hull the profile shows.
let shipDef = readShipDef()

const canvas = ref(null)
let stage = null // Neon Shrine's pixel stage (themes/base/pixel/stage.ts)
let art = null // pixel art for the stage's pixel size (./pixel.ts)
let spaceLayer = null // the dithered night, painted per size
let animationFrameId = null
let gameRunning = false
// Pixel ratio the canvas is backed at (1–3, as the stage); game logic
// works in CSS pixels, W() × H().
let dpr = 1
function W() { return canvas.value.width / dpr }
function H() { return canvas.value.height / dpr }
// The site's bottom band in CSS px (0 in a browser tab): the ship, its
// clamp and the phone boss bar stay above it; the backdrop runs through.
let band = 0

// --- Clock (2026-09-23): the world steps at a fixed 60 Hz on a simulated
// clock, so 120 Hz screens do not run the game twice as fast and pause
// freezes every timer (waves, boss, powerups, intercom) with the world.
const STEP_MS = 1000 / 60
let simNow = 0
let lastReal = 0
let stepAcc = 0

// Game state
let player = { x: 0, y: 0, width: 44, height: 36, speed: 5, bank: 0, prevX: 0, prevY: 0 }
let bullets = []
let enemyBullets = []
let enemies = []
let bosses = []
let stars = []
let particles = []
let powerups = []
let shockwaves = []
let pops = [] // floating pickup / bounty text
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
let weapon = 'spread'
let volleyIndex = 0
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
let invulnUntil = 0 // sim ms: blink-invulnerability after a hull hit
let lastFrameTime = 0
// --- Timed powerups (seconds of active play left).
let dualTimer = 0 // D: escort doubling the fan, sacrificed on a hit
let rearTimer = 0 // R: rear guard firing backwards
let tempoTimer = 0 // T: slow-mo on enemies and their bullets
let magnetTimer = 0 // M: attracts falling powerups, brakes nearby bullets
let comboTimer = 0 // C: 2x score baseline while active
let lastShieldTime = 0 // pity clock: force S when low hull + long drought
// --- SYNC overdrive: kills charge the meter, Shift (or a two-finger tap)
// hands the guns to Claude for SYNC.duration seconds.
let syncMeter = 0
let syncTimer = 0
// --- Sectors: each boss ends one. sectorIndex = bosses killed this run.
let sectorIndex = 0
let bannerT = 0 // seconds left on the SECTOR banner
let warnT = 0 // seconds left on the boss WARNING banner
let warnName = ''
let runCount = 0
let bestBefore = 0 // stored high score when the run began
// --- Chain combo: kills inside a 1.5 s window raise the multiplier.
let comboCount = 0
let lastKillTime = 0
function chainBonus() {
  if (comboCount >= 6) return 2
  if (comboCount >= 4) return 1
  return 0
}
function scoreMult() {
  const base = comboTimer > 0 ? 2 : 1
  return Math.min(4, base + chainBonus())
}
function addScore(base) {
  const before = score
  score += base * scoreMult()
  emit('score', score)
  if (bestBefore > 0 && before <= bestBefore && score > bestBefore) director.cue('best', simNow)
}
function registerKill(now) {
  if (now - lastKillTime < 1500) comboCount++
  else comboCount = 1
  lastKillTime = now
  if (comboCount === 3 || comboCount === 4 || comboCount === 6) {
    ring(player.x, player.y - 30, 90 + comboCount * 15, '#ffd23f')
    audio?.play('combo')
  }
  if (scoreMult() >= 4) director.cue('combo:4', now)
}
// --- Juice: shake, hit-stop, warp, muzzle.
let shake = 0 // 0..1 screen shake magnitude
let hitStopUntil = 0 // sim ms: world frozen, draw continues
let warpT = 0 // seconds of warp-stretch after a wave spawns
let muzzleT = 0 // frame counter for the muzzle flash
// --- Deep background: nebulae, planet, station (all dark, all slow).
let nebulae = []
let planet = null
let station = null
// --- Radio: the global site-wide station lives in RadioWidget (M cycles
// it). The local audio object is SFX only.
let audio = null
const radio = useRadio()
// --- Intercom: the story director picks lines; the view shows one.
const director = createDirector()
const intercom = ref(null)
const intercomShown = ref(0)
const { inputMode } = useInputMode()
function isTouch() { return inputMode.value === 'touch' }

function pushParticle(p) {
  if (particles.length >= MAX_PARTICLES) particles.shift()
  particles.push(p)
}
function fxScale() {
  let s = 1
  if (canvas.value && W() < 600) s *= 0.6
  if (reducedMotion) s *= 0.5
  return s
}
function pop(x, y, text, color = '#ffd23f') {
  if (pops.length > 6) pops.shift()
  pops.push({ x, y, text, color, life: 1 })
}

let waveNumber = 0
let reducedMotion = false

function initStars() {
  stars = []
  if (!canvas.value) return
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * W(),
      y: Math.random() * H(),
      speed: 0.3 + Math.random() * 1.5,
      size: Math.random() < 0.3 ? 2 : 1,
      brightness: 0.3 + Math.random() * 0.7,
      twinkle: Math.random() * Math.PI * 2,
    })
  }
}

// Drifting rocks at different depths; ./pixel.ts paints each one once.
function createBgShape(startY) {
  if (!canvas.value) return null
  const depth = .3 + Math.random() * .7
  return { x: Math.random() * W(),
    y: startY ?? -350, depth, speed: .35 + depth * .85,
    size: (160 + Math.random() * 220) * (.6 + depth * .4),
    rotation: Math.random() * Math.PI * 2 }
}

function initBgShapes() {
  if (!canvas.value) return
  bgShapes = Array.from({ length: 6 }, (_, i) => createBgShape(i / 6 * (H() + 400) - 200))
  bgShapes.sort((a, b) => a.depth - b.depth)
}

// Deep background: slow dark nebulae (tinted per sector), one ringed
// planet, one station — relay station Kestrel, where the story starts.
// Positions and radii are CSS px; the pixel images come from ./pixel.ts.
function initDeepField() {
  if (!canvas.value || typeof document === 'undefined' || !stage) return
  const w = W(), h = H()
  const tints = sectorFor(sectorIndex).tints
  nebulae = tints.map((t, i) => {
    const r = 120 + Math.random() * 160
    return {
      tint: t, r, salt: i * 17 + 3,
      img: paintNebula(t, r / stage.k, i * 17 + 3, i === 3 ? 1.2 : 1),
      x: Math.random() * w, y: (i / tints.length) * (h + r * 2) - r,
      speed: 0.05 + Math.random() * 0.07,
    }
  })
  const pr = Math.min(150, w * 0.28)
  planet = { x: w * 0.82, y: -140, r: pr, speed: 0.06, ringTilt: 0.35, img: paintPlanet(pr / stage.k, 0.35) }
  station = { x: w * 0.16, y: h * 0.3, size: Math.min(90, w * 0.2), speed: 0.09, blink: 0 }
}

// A new sector re-tints the nebulae where they are.
function retintNebulae() {
  if (typeof document === 'undefined' || !stage) return
  const tints = sectorFor(sectorIndex).tints
  nebulae.forEach((n, i) => {
    n.tint = tints[i % tints.length]
    n.img = paintNebula(n.tint, n.r / stage.k, n.salt, i === 3 ? 1.2 : 1)
  })
}

function readBest() {
  try {
    return parseInt(localStorage.getItem('galagaHighScore') || '0', 10) || 0
  } catch {
    return 0
  }
}

function resetGame() {
  if (!canvas.value) return
  shipDef = readShipDef()
  const now = simNow
  player.x = W() / 2
  player.y = H() - 60 - band
  player.bank = 0
  player.prevX = player.x
  player.prevY = player.y
  bullets = []
  enemyBullets = []
  enemies = []
  bosses = []
  powerups = []
  particles = []
  shockwaves = []
  pops = []
  score = 0
  gameOver = false
  gameStarted = true
  paused.value = false
  keys = {}
  waveNumber = 0
  waveInterval = waveIntervalFor(0)
  waveTimer = now - waveInterval // first wave spawns right away
  bulletLevel = 1
  weapon = 'spread'
  volleyIndex = 0
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
  syncMeter = 0
  syncTimer = 0
  const oldSector = sectorIndex
  sectorIndex = 0
  if (oldSector !== 0) retintNebulae()
  bannerT = 3
  warnT = 0
  bestBefore = readBest()
  runCount++
  // The intercom: callsign from the Hall of Fame animal, then the briefing.
  director.resetRun()
  director.setVars({
    cs: callsignFrom(readStoredPlayer()?.name),
    run: runCount,
    sync: isTouch() ? 'tap with two fingers' : 'press shift',
  })
  if (!director.cue('start:first', now)) director.cue('start:again', now)
  // SFX starts on the gesture that begins the run (browser policy); the
  // shared radio resumes its station instead of restarting it.
  try {
    if (!audio) audio = createGalagaAudio()
    if (audio) audio.start()
  } catch {
    audio = null
  }
  radio.ensurePlaying()
  radio.setIntensity(0, false)
  emit('restart')
  emit('started')
  emit('score', 0)
}

function makeEnemy(base) {
  return {
    age: 0, slot: 0, flash: 0, hasFired: false,
    shootChance: 1, lockY: 0, baseX: base.x ?? 0,
    seed: Math.random() * 2, heading: Math.PI / 2,
    ...base,
  }
}

function spawnWave() {
  if (!canvas.value) return
  const w = W(), h = H()
  const now = simNow
  const pattern = waveNumber++ % 7
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
  const before = enemies.length
  if (pattern === 0) {
    // Scouts from above, V formation; veterans (2 HP) from wave 6.
    const count = waveCountFor(waveNumber, w)
    const hp = scoutHpFor(waveNumber)
    for (let i = 0; i < count; i++) {
      enemies.push(mk('scout', {
        x: 40 + (count === 1 ? (w - 80) / 2 : i / (count - 1) * (w - 80)),
        y: -28 - Math.abs(i - (count - 1) / 2) * 28,
        vx: 0, vy: 1.15, size: 28, color: '#ff2fa0',
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
        size: 32, color: '#ff2fa0',
        movementType: 'formation', slot: i, direction,
        heading: direction === 1 ? 0 : Math.PI,
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
          vx: 0, vy: 0.5, size: 56, color: '#ff70bc',
          movementType: 'straight', hp: ENEMY_STATS.bulwark.hp, maxHp: ENEMY_STATS.bulwark.hp,
        }))
      } else {
        const hp = heavyHpFor(waveNumber)
        enemies.push(mk('heavy', {
          x: 60 + i / (count - 1) * (w - 120), y: -52 - i * 30,
          vx: 0, vy: 0.7, size: 52, color: '#ff70bc',
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
          vx: 0, vy: 1.5, size: 26, color: '#ff2fa0',
          movementType: 'dive', lockY: h * 0.35,
        }))
      } else {
        const bx = 40 + i / (count - 1) * (w - 80)
        enemies.push(mk('weaver', {
          x: bx, y: -30 - i * 26, baseX: bx,
          vx: 0, vy: 1.0, size: 30, color: '#ff2fa0',
          movementType: 'weave',
        }))
      }
    }
  } else if (pattern === 5) {
    // Snipers: slow lane-seekers with the fastest bolts (max 2 alive).
    const alive = enemies.filter(e => e.kind === 'sniper').length
    const count = Math.min(2, Math.max(1, waveCountFor(waveNumber, w) - 3)) - alive
    for (let i = 0; i < count; i++) {
      enemies.push(mk('sniper', {
        x: 60 + Math.random() * (w - 120), y: -30 - i * 40,
        vx: 0, vy: 0.55, size: 26, color: '#ff70bc',
        movementType: 'sniper',
      }))
    }
  } else {
    // Stingers and splitters: fast edge darts plus pods with mites.
    const count = waveCountFor(waveNumber, w)
    const direction = Math.random() < 0.5 ? 1 : -1
    for (let i = 0; i < count; i++) {
      if (waveNumber >= 8 && i === count - 1) {
        enemies.push(mk('splitter', {
          x: 50 + Math.random() * (w - 100), y: -40,
          vx: 0, vy: 0.9, size: 40, color: '#ff70bc',
          movementType: 'straight',
        }))
      } else {
        enemies.push(mk('stinger', {
          x: direction === 1 ? -26 - i * 40 : w + 26 + i * 40,
          y: h * .2, vx: direction * 4.2, vy: 1.0,
          size: 26, color: '#ff2fa0',
          movementType: 'formation', slot: i, direction,
          heading: direction === 1 ? 0 : Math.PI,
          spawnX: direction === 1 ? -26 - i * 40 : w + 26 + i * 40, spawnY: h * .2,
        }))
      }
    }
  }
  // Claude names each new kind the first time it shows up.
  const kinds = new Set(enemies.slice(before).map(e => e.kind))
  for (const k of kinds) director.cue(`meet:${k}`, now)
  if (waveNumber === 10) director.cue('wave:10', now)
  if (waveNumber === 25) director.cue('wave:25', now)
  if (sectorIndex >= 2 && Math.random() < 0.25) director.cue('taunt', now)
  warpT = reducedMotion ? 0 : 0.5
  radio.setIntensity(intensityFor(waveNumber, bosses.length > 0), bosses.length > 0)
  audio?.play('waveStart')
}

function spawnBoss() {
  if (!canvas.value) return
  const w = W()
  const h = H()
  const hp = bossMaxHpFor(bossNum, waveNumber)
  const atk = bossAttackFor(bossNum)
  const sector = sectorFor(sectorIndex)
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
    name: sector.boss,
    color: '#ff2fa0',
    shootCooldown: atk.base + Math.random() * atk.spread,
    lastShot: simNow,
    arrived: false,
    dirChangeTimer: 0,
    volleys: 0,
    flash: 0,
    enraged: false,
  })
  warnT = reducedMotion ? 1.6 : 2.6
  warnName = sector.boss
  director.cue(sectorIndex === 4 ? 'boss:conductor' : bossNum === 0 ? 'boss:1' : 'boss:n', simNow)
  bossNum++
  radio.setIntensity(3, true)
  audio?.play('warning')
  audio?.play('bossStinger')
}

function spawnParticles(x, y, color, count = 8) {
  const s = fxScale()
  const n = Math.max(2, Math.round(count * s))
  const glow = glowFor(color)
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 / n) * i + Math.random() * 0.5
    const speed = 1.5 + Math.random() * 4
    pushParticle({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      color,
      glow,
      size: 3 + Math.random() * 4
    })
  }
}

// Glow sprite for a neon colour, so sparks draw additively.
function glowFor(color) {
  if (color === '#2ff3ff' || color === '#cfe9ff') return 'cyan'
  if (color === '#ffd23f') return 'gold'
  if (color === '#ffffff' || color === '#f2e9ff') return 'white'
  if (color === '#ff2fa0' || color === '#ff70bc') return 'pink'
  return null
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
      size: 2 + Math.random() * (size / 8),
      spin: Math.random() * Math.PI,
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
      decay: 0.008 + Math.random() * 0.01,
      color: `rgba(${60 + Math.floor(Math.random() * 40)}, ${30 + Math.floor(Math.random() * 30)}, ${90 + Math.floor(Math.random() * 50)}, 0.45)`,
      size: 6 + Math.random() * 10,
      smoke: true,
    })
  }
}

// A hot white flash at an impact: one additive glow that shrinks away.
function spawnFlash(x, y, size, glow = 'white') {
  pushParticle({ x, y, vx: 0, vy: 0, life: 1, decay: 0.12, color: '#ffffff', glow, size, flash: true })
}

function triggerShockwave(x, y, color = '#ff2fa0', lethal = true) {
  shockwaves.push({ x, y, radius: 0, maxRadius: Math.max(W(), H()), speed: 12, life: 1, color, lethal })
}

// Small cosmetic ring at a kill.
function ring(x, y, r, color = '#ff70bc') {
  shockwaves.push({ x, y, radius: r * 0.2, maxRadius: r, speed: 2.4, life: 1, color, lethal: false, thin: true })
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
    if (!boss.arrived) continue // the entry shield holds
    boss.hp -= 5
    boss.flash = 4
    spawnParticles(boss.x, boss.y, '#ffd23f', 10)
    if (boss.hp <= 0) killBoss(j, now)
  }
}

// Single kill entry point: damage an enemy by index, killing it past 0 HP.
function damageEnemy(index, amount, now) {
  const e = enemies[index]
  e.hp -= amount
  e.flash = 4
  if (e.hp <= 0) {
    killEnemy(index, now)
    return true
  }
  return false
}

function killEnemy(index, now) {
  const e = enemies[index]
  spawnFlash(e.x, e.y, e.size * 1.6, 'pink')
  spawnShatter(e.x, e.y, e.color, e.size)
  spawnParticles(e.x, e.y, '#ff70bc', 6)
  spawnSmoke(e.x, e.y, 3)
  ring(e.x, e.y, e.size * 1.1)
  registerKill(now)
  addScore(ENEMY_STATS[e.kind]?.score ?? (e.maxHp > 1 ? 250 : 100))
  chargeSync(syncGain(syncMeter, e.maxHp ?? 1))
  enemies.splice(index, 1)
  // Splitters pop into two diving mites (never spawned directly).
  if (e.kind === 'splitter' && canvas.value) {
    for (const dir of [-1, 1]) {
      enemies.push(makeEnemy({
        kind: 'mite', x: e.x + dir * 14, y: e.y,
        vx: dir * 1.2, vy: 1.6, size: 18, color: '#ff2fa0',
        movementType: 'straight', hp: 1, maxHp: 1,
        shootCooldown: 1e9, lastShot: now, shootChance: 0,
      }))
    }
  }
  audio?.play('kill')
}

// Boss kill: gold shockwave cinematic — flash, shake, hit-stop, bounty, heal,
// and the next sector.
function killBoss(j, now) {
  const boss = bosses[j]
  spawnFlash(boss.x, boss.y, boss.size * 2.2, 'gold')
  spawnShatter(boss.x, boss.y, '#ffffff', boss.size)
  spawnShatter(boss.x, boss.y, boss.color, boss.size)
  spawnParticles(boss.x, boss.y, '#ffd23f', 20)
  spawnSmoke(boss.x, boss.y, 12)
  triggerShockwave(boss.x, boss.y, '#ffd23f')
  if (!reducedMotion) {
    shake = Math.min(1, shake + 0.9)
    hitStopUntil = now + 90
  }
  const bounty = bossBountyFor(boss.num ?? 0)
  addScore(bounty)
  pop(boss.x, boss.y, `+${bounty * scoreMult()}`)
  hull = heal(hull, HEAL_BOSS)
  audio?.play('bossKill')
  bosses.splice(j, 1)
  if (bosses.length === 0) radio.setIntensity(intensityFor(waveNumber, false), false)
  // The Cantor carried a voice; the band clears and the next sector opens.
  director.cue(sectorIndex === 4 ? 'boss:down:conductor' : 'boss:down', now)
  sectorIndex++
  const n = sectorIndex + 1
  director.cue(n <= 6 ? `sector:${n}` : 'sector:deep', now, { n })
  bannerT = 3
  retintNebulae()
}

function triggerDeathExplosion(x, y) {
  deathExplosion = { x, y, phase: 0, timer: 0, flash: 1 }
  spawnFlash(x, y, 160, 'white')
  // Neon core — pink and cyan expanding fragments
  const s = fxScale()
  const colors = ['#ff2fa0', '#ff70bc', '#2ff3ff', '#f2e9ff', '#ffffff']
  for (let i = 0; i < Math.round(60 * s); i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.5 + Math.random() * 3.5
    const color = colors[Math.floor(Math.random() * colors.length)]
    pushParticle({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.006 + Math.random() * 0.01,
      color, glow: glowFor(color),
      size: 5 + Math.random() * 10
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
      color: shipDef.colors.hull,
      size: 3 + Math.random() * 5,
      spin: Math.random() * Math.PI,
    })
  }
  spawnSmoke(x, y, 25)
  shockwaves.push({ x, y, radius: 0, maxRadius: 400, speed: 7, life: 1, color: '#ff2fa0', lethal: false })
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
  radio.suspend(paused.value)
}

function endRun() {
  gameOver = true
  syncTimer = 0
  triggerDeathExplosion(player.x, player.y)
  // The radio keeps playing through game over — only the SFX death stinger.
  audio?.play('death')
  emit('death', { sector: sectorIndex + 1, sectorName: sectorFor(sectorIndex).name, wave: waveNumber })
}

// A 3 s Escape hold cancels the run: the same death as a collision, so the
// landing shows GAME OVER with the run's score.
function quitToGameOver() {
  if (!gameStarted || gameOver) return
  paused.value = false
  keys = {}
  audio?.suspend(false)
  radio.suspend(false)
  director.hush(simNow)
  endRun()
}

// A hull hit: escort sacrificed first, then a segment, a weapon step and
// brief invulnerability. Returns true when the run ends.
function hitPlayer(now, source) {
  if (!gameStarted || gameOver || now < invulnUntil) return false
  if (dualTimer > 0) {
    // The escort takes the hit instead — even against a ram.
    dualTimer = 0
    spawnShatter(player.x - player.width * 0.85, player.y, shipDef.colors.hull, 30)
    spawnFlash(player.x - player.width * 0.85, player.y, 50, 'cyan')
    audio?.play('shield')
    invulnUntil = now + 600
    comboCount = 0
    director.cue('escort:lost', now)
    return false
  }
  hull = applyDamage(hull, DMG[source] ?? 1)
  bulletLevel = Math.max(1, bulletLevel - 1)
  comboCount = 0
  shake = reducedMotion ? 0 : Math.min(1, shake + 0.5)
  spawnFlash(player.x, player.y, 70, 'pink')
  audio?.play('hullHit')
  if (hull <= 0) {
    // The last word cuts whatever was playing.
    director.hush(now)
    director.cue('death', now)
    endRun()
    return true
  }
  if (hull === 2) director.cue('hull:2', now)
  if (hull === 1) director.cue('hull:1', now)
  invulnUntil = now + INVULN_TIME * 1000
  return false
}

function tickTimers(dt) {
  if (dualTimer > 0) dualTimer = Math.max(0, dualTimer - dt)
  if (rearTimer > 0) rearTimer = Math.max(0, rearTimer - dt)
  if (tempoTimer > 0) tempoTimer = Math.max(0, tempoTimer - dt)
  if (magnetTimer > 0) magnetTimer = Math.max(0, magnetTimer - dt)
  if (comboTimer > 0) comboTimer = Math.max(0, comboTimer - dt)
  if (syncTimer > 0) syncTimer = Math.max(0, syncTimer - dt)
  if (bannerT > 0) bannerT = Math.max(0, bannerT - dt)
  if (warnT > 0) warnT = Math.max(0, warnT - dt)
}

// --- SYNC -------------------------------------------------------------

function chargeSync(next) {
  if (syncTimer > 0) return
  const was = syncMeter
  syncMeter = next
  if (was < 1 && syncMeter >= 1) {
    audio?.play('syncReady')
    if (!director.cue('sync:ready', simNow)) director.cue('sync:ready:again', simNow)
  }
}

function activateSync() {
  if (!gameStarted || gameOver || paused.value || syncMeter < 1 || syncTimer > 0) return false
  syncMeter = 0
  syncTimer = SYNC.duration
  // Claude clears the air first: every enemy bolt turns into a gold spark.
  for (const b of enemyBullets) {
    pushParticle({ x: b.x, y: b.y, vx: 0, vy: -1.2, life: 1, decay: 0.04, color: '#ffd23f', glow: 'gold', size: 10 })
  }
  // Flat points (no multiplier), through addScore for the best-score check.
  if (enemyBullets.length) addScore(enemyBullets.length * SYNC.cancelScore / scoreMult())
  enemyBullets = []
  shockwaves.push({ x: player.x, y: player.y, radius: 0, maxRadius: Math.max(W(), H()), speed: 16, life: 1, color: '#2ff3ff', lethal: false })
  spawnFlash(player.x, player.y, 120, 'gold')
  playerGlow = 1
  audio?.play('sync')
  director.cue('sync:on', simNow)
  return true
}

// --- Firing -------------------------------------------------------------

function fire(now) {
  const interval = FIRE_INTERVAL[weapon] * (syncTimer > 0 ? SYNC.fireMul : 1)
  if (now - lastShotTime <= interval) return
  const shots = volley(weapon, bulletLevel, {
    escort: dualTimer > 0,
    escortDx: -player.width * 0.85,
    rear: rearTimer > 0,
    sync: syncTimer > 0,
    index: volleyIndex++,
  })
  let seekers = 0
  for (const s of shots) {
    bullets.push({
      x: player.x + s.dx, y: player.y - player.height / 2 + s.dy,
      vx: s.vx, vy: s.vy, dmg: s.dmg, pierce: s.pierce, kind: s.kind,
      life: s.kind === 'seeker' ? SEEKER_LIFE : 0, hits: null, target: null,
    })
    if (s.kind === 'seeker') seekers++
  }
  muzzleT = 3
  audio?.play(weapon === 'laser' ? 'laser' : 'shoot')
  if (seekers) audio?.play('seeker')
  lastShotTime = now
}

// A bullet's hit test against a circle; lances are long, so they test as a
// short vertical capsule.
function bulletHits(b, cx, cy, r) {
  const dx = b.x - cx
  let dy = b.y - cy
  if (b.kind === 'lance') dy = Math.max(0, Math.abs(dy) - 14)
  return dx * dx + dy * dy < r * r
}

// After a hit: piercing shots remember the target and fly on.
function consumeBullet(i, target) {
  const b = bullets[i]
  if (b.pierce > 0) {
    b.pierce--
    ;(b.hits ??= []).push(target)
  } else {
    bullets.splice(i, 1)
  }
}

function update(now) {
  if (!canvas.value || !gameStarted) return
  simNow = now

  // Keep updating particles/shockwaves after death for explosion animation
  if (gameOver) {
    stepParticles()
    shockwaves = shockwaves.filter(sw => {
      sw.radius += sw.speed
      sw.life = Math.max(0, 1 - sw.radius / sw.maxRadius)
      return sw.life > 0
    })
    if (deathExplosion) {
      deathExplosion.timer++
      deathExplosion.flash = Math.max(0, deathExplosion.flash - 0.04)
    }
    // Behind the GAME OVER screen the swarm drifts on and its fire runs out.
    const hh = H()
    enemyBullets = enemyBullets.filter(b => {
      b.y += b.vy
      if (b.vx) b.x += b.vx
      return b.y < hh + 10 && b.y > -40
    })
    for (const e of enemies) {
      e.y += (e.vy || 1) * 0.6
      if (e.movementType === 'formation') e.x += e.vx * 0.6
    }
    for (const boss of bosses) boss.y -= 0.8
    pops = pops.filter(p => (p.life -= 0.018) > 0)
    return
  }
  const w = W()
  const h = H()
  const dt = Math.min(0.1, Math.max(0, (now - (lastFrameTime || now)) / 1000))
  lastFrameTime = now
  tickTimers(dt)
  if (warpT > 0) warpT = Math.max(0, warpT - dt)
  if (shake > 0) shake = Math.max(0, shake - dt * 2.5)

  // Decay player glow
  if (playerGlow > 0) playerGlow = Math.max(0, playerGlow - 0.02)

  // Player movement
  player.prevX = player.x
  player.prevY = player.y
  if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed
  if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed
  if (keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed
  if (keys['ArrowDown'] || keys['KeyS']) player.y += player.speed
  player.x = Math.max(player.width / 2, Math.min(w - player.width / 2, player.x))
  player.y = Math.max(player.height, Math.min(h - band - player.height / 2, player.y))

  // SYNC fires by itself: Claude has the trigger.
  if (keys['Space'] || syncTimer > 0) fire(now)
  if (muzzleT > 0) muzzleT--

  // Update bullets; seekers steer toward the nearest target ahead.
  const targets = enemies.filter(e => e.y > 0 && e.x > 0 && e.x < w)
  for (const boss of bosses) if (boss.arrived) targets.push(boss)
  bullets = bullets.filter(b => {
    if (b.kind === 'seeker') {
      if (!b.target || !targets.includes(b.target) || b.life % 12 === 0) b.target = pickTarget(b.x, b.y, targets)
      if (b.target) steer(b, b.target.x, b.target.y)
      else steer(b, b.x + b.vx, b.y - 40)
      if (b.life-- <= 0) return false
      // Trails yield to kill debris when the particle pool runs full.
      if (b.life % 2 === 0 && particles.length < MAX_PARTICLES * 0.7) pushParticle({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.7, decay: 0.07, color: '#2ff3ff', glow: 'cyan', size: 6 })
    }
    b.x += (b.vx || 0)
    b.y += b.vy
    return b.y > -40 && b.y < h + 20 && b.x > -20 && b.x < w + 20
  })

  // Update enemy bullets (magnet brakes nearby bullets, never steers them in)
  const bulletMul = tempoTimer > 0 ? 0.6 : 1
  enemyBullets = enemyBullets.filter(b => {
    if (magnetTimer > 0) {
      const dx = b.x - player.x, dy = b.y - player.y
      if (dx * dx + dy * dy < 60 * 60) {
        b.vy *= 0.97
        b.x += Math.sign(dx || 1) * 0.15
      }
    }
    b.y += b.vy * bulletMul
    if (b.vx) b.x += b.vx * bulletMul
    return b.y < h + 10 && b.y > -40 && b.x > -20 && b.x < w + 20
  })

  // Wave spawning — thinner while a Cantor is on the field.
  const interval = waveInterval * (bosses.length ? BOSS_WAVE_SLOWDOWN : 1)
  if (now - waveTimer > interval) {
    spawnWave()
    waveTimer = now
    waveInterval = waveIntervalFor(waveNumber)
  }

  // Boss spawning: the clock only runs while no boss is alive, so each
  // sector ends with exactly one Cantor.
  if (bosses.length) bossTimer = now
  else if (now - bossTimer > bossEveryFor(bossNum) * 1000) {
    spawnBoss()
    bossTimer = now
  }

  const foeMul = enemySpeedMul(waveNumber) * (tempoTimer > 0 ? 0.6 : 1)

  // Update enemies
  enemies = enemies.filter(enemy => {
    enemy.flash = Math.max(0, enemy.flash - 1)
    const px = enemy.x, py = enemy.y
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
      if (enemy.vx) enemy.x += enemy.vx * foeMul
    }
    if (enemy.movementType !== 'formation') enemy.x = Math.max(enemy.size / 2, Math.min(w - enemy.size / 2, enemy.x))
    // Heading follows the path (drawn for the kinds that turn).
    const mdx = enemy.x - px, mdy = enemy.y - py
    if (mdx * mdx + mdy * mdy > 0.01) {
      let d = Math.atan2(mdy, mdx) - enemy.heading
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      enemy.heading += d * 0.25
    }
    const canFire = enemy.y > enemy.size && enemy.x > enemy.size && enemy.x < w - enemy.size
    // Snipers telegraph: the aim line shows for the last half second.
    enemy.aiming = enemy.kind === 'sniper' && canFire && now - enemy.lastShot > enemy.shootCooldown - 500
    if (canFire && now - enemy.lastShot > enemy.shootCooldown) {
      if (Math.random() < (enemy.shootChance ?? 1)) {
        const fast = enemy.kind === 'sniper'
        if (enemy.kind === 'bulwark') {
          for (const sx of [-0.8, 0, 0.8]) enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.size / 2, vx: sx, vy: 2.8 * foeMul })
        } else {
          enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.size / 2, vy: (fast ? 4.0 : boltSpeedFor(waveNumber)) + Math.random() * 1.5, type: fast ? 'needle' : 'orb' })
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
    boss.flash = Math.max(0, boss.flash - 1)
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

    // Below half HP the Cantor enrages: faster guns, and from the third
    // one on it calls two mites to its side.
    if (!boss.enraged && boss.hp < boss.maxHp / 2) {
      boss.enraged = true
      if ((boss.num ?? 0) >= 2) {
        for (const dir of [-1, 1]) {
          enemies.push(makeEnemy({
            kind: 'mite', x: boss.x + dir * boss.size * 0.4, y: boss.y,
            vx: dir * 1.4, vy: 1.8, size: 18, color: '#ff2fa0',
            movementType: 'straight', hp: 1, maxHp: 1,
            shootCooldown: 1e9, lastShot: now, shootChance: 0,
          }))
        }
      }
    }
    // Damage smoke from the wings once it is hurting.
    if (boss.enraged && Math.random() < 0.08) {
      spawnSmoke(boss.x + (Math.random() - 0.5) * boss.size * 0.8, boss.y + (Math.random() - 0.3) * boss.size * 0.4, 1)
    }

    // Boss shooting — fan widens from boss #3 with an aimed middle bolt;
    // every few volleys a radial ring from boss #2.
    if (boss.arrived && now - boss.lastShot > boss.shootCooldown) {
      boss.volleys++
      const every = bossRingEvery(boss.num ?? 0)
      if (every && boss.volleys % every === 0) {
        const n = bossRingCount(boss.num ?? 0)
        const off = boss.volleys * 0.37
        for (let i = 0; i < n; i++) {
          const a = off + i / n * Math.PI * 2
          enemyBullets.push({ x: boss.x, y: boss.y + boss.size * .1, vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4 + 0.6, type: 'big' })
        }
      } else {
        const spread = (Math.random() - 0.5) * 1.5
        enemyBullets.push({ x: boss.x - boss.size * .36, y: boss.y + boss.size * .38, vy: 3 + Math.random() * 1.5, vx: spread, type: 'big' })
        enemyBullets.push({ x: boss.x + boss.size * .36, y: boss.y + boss.size * .38, vy: 3 + Math.random() * 1.5, vx: -spread, type: 'big' })
        if (bossFanCount(boss.num ?? 0) >= 3) {
          const aim = Math.max(-2, Math.min(2, (player.x - boss.x) * 0.01))
          enemyBullets.push({ x: boss.x, y: boss.y + boss.size * .4, vy: 3.5 + Math.random(), vx: aim, type: 'big' })
        }
      }
      boss.lastShot = now
      const atk = bossAttackFor(boss.num ?? 0)
      boss.shootCooldown = (atk.base + Math.random() * atk.spread) * (boss.enraged ? BOSS_ENRAGE_MUL : 1)
      boss.muzzle = 4
    }
    if (boss.muzzle > 0) boss.muzzle--

    return boss.hp > 0
  })

  // Bullet-enemy collisions
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    const dmg = b.dmg ?? 1
    let done = false

    // Check bosses
    for (let j = bosses.length - 1; j >= 0; j--) {
      const boss = bosses[j]
      if (b.hits?.includes(boss)) continue
      if (bulletHits(b, boss.x, boss.y, boss.size / 2 + 4)) {
        // Still on its way in: the Cantor's entry shield eats the shot.
        if (!boss.arrived) {
          spawnParticles(b.x, b.y, '#f2e9ff', 2)
          bullets.splice(i, 1)
          done = true
          break
        }
        boss.hp -= dmg
        boss.flash = 3
        spawnParticles(b.x, b.y, boss.color, 5)
        spawnSmoke(b.x, b.y, 2)
        consumeBullet(i, boss)
        chargeSync(Math.min(1, syncMeter + SYNC.perBossHit))
        audio?.play('bossHit')
        if (boss.hp <= 0) killBoss(j, now)
        done = true
        break
      }
    }
    if (done) continue

    // Check normal enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j]
      if (b.hits?.includes(e)) continue
      if (bulletHits(b, e.x, e.y, e.size / 2 + 4)) {
        consumeBullet(i, e)
        if (!damageEnemy(j, dmg, now)) {
          spawnParticles(b.x, b.y, e.color, 4)
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

  // Engine sparks off the nozzles.
  if (!reducedMotion && Math.random() < (syncTimer > 0 ? 0.6 : 0.25)) {
    pushParticle({
      x: player.x + (Math.random() - 0.5) * 6, y: player.y + player.height / 2 - 2,
      vx: (Math.random() - 0.5) * 0.4, vy: 2 + Math.random() * 2,
      life: 0.8, decay: 0.08, color: syncTimer > 0 ? '#ffd23f' : '#2ff3ff',
      glow: syncTimer > 0 ? 'gold' : 'cyan', size: 5,
    })
  }

  stepParticles()
  pops = pops.filter(p => {
    p.y -= 0.6
    p.life -= 0.018
    return p.life > 0
  })
}

function stepParticles() {
  particles = particles.filter(p => {
    p.x += p.vx
    p.y += p.vy
    p.life -= p.decay
    if (!p.flash) p.vy += p.smoke ? -0.005 : 0.02
    if (p.spin !== undefined) p.spin += 0.2
    return p.life > 0
  })
}

function applyPowerup(type, now) {
  const firstTime = director.cue(`pick:${type}`, now)
  pop(player.x, player.y - 40, POWERUP_NAMES[type] ?? type.toUpperCase())
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
  } else if (type === 'weapon' || type === 'laser' || type === 'homing') {
    const pick = type === 'weapon' ? 'weapon' : type
    const next = applyWeaponPickup(weapon, bulletLevel, pick)
    if (next.kind !== weapon && !firstTime) director.cue('pick:switch', now)
    weapon = next.kind
    bulletLevel = Math.min(BULLET_LEVEL_MAX, next.level)
    pops[pops.length - 1].text = `${WEAPON_NAMES[weapon]} LV${bulletLevel}`
    playerGlow = 1
    spawnFlash(player.x, player.y, 60, 'cyan')
    spawnParticles(player.x, player.y, '#2ff3ff', 24)
    ring(player.x, player.y, 60, '#2ff3ff')
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
  const w = W()
  const h = H()
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

// ---------------------------------------------------------------- draw
// Neon Shrine's pixel stage (themes/base/pixel): the rules stay in CSS px,
// everything is drawn in the stage's logical pixels, L() converts. Ships,
// rocks and the deep field are lit by the light map; bolts, sparks, rings,
// flames and stars glow after it. Text is the 5×7 font on the HUD layer.

function L(v) {
  return Math.round(v / stage.k)
}

const GLOW_HEX = { cyan: '#2ff3ff', pink: '#ff2fa0', gold: '#ffd23f', white: '#f2e9ff' }
const DIM = '#8f86b8'
const SLOT = '#3a2a5a'

// HUD text with the font's hard shadow; returns the width.
function hud(text, x, y, color, align = 'left') {
  const w = textWidth(text)
  const x0 = align === 'center' ? x - (w >> 1) : align === 'right' ? x - w : x
  drawText(stage.hud, text, x0, y, color, '#0b0616')
  return w
}

// A bar with a dark rim, filled `frac` of the way in `color`.
function hudBar(x, y, w, h, frac, color) {
  const g = stage.hud
  g.fillStyle = '#0b0616'
  g.fillRect(x - 1, y - 1, w + 2, h + 2)
  g.fillStyle = SLOT
  g.fillRect(x, y, w, h)
  g.fillStyle = color
  g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h)
}

// Phones and short landscape screens: two lines, about 8 % of a phone's height. Line 1 (score, sector,
// wave) stays left of the radio widget; line 2 starts at the radio's
// bottom edge: hull, weapon and level, SYNC bar, multiplier, capsule chips.
function drawHudPhone(now) {
  const g = stage.hud
  const vw = stage.vw
  const x0 = 4
  const scoreW = hud(`${score}`, x0, 4, '#2ff3ff')
  hud(`S${sectorFor(sectorIndex).num} W${waveNumber}`, x0 + scoreW + 6, 4, DIM)
  const y = Math.ceil(48 / stage.k)
  const blink = hull <= 1 && Math.floor(now / 300) % 2 === 0
  let x = x0
  for (let i = 0; i < HULL_MAX; i++) {
    const on = i < hull
    g.fillStyle = '#0b0616'
    g.fillRect(x - 1, y + 1, 7, 5)
    g.fillStyle = !on ? SLOT : hull >= 4 ? '#2ff3ff' : hull >= 2 ? '#ffd23f' : blink ? '#ff70bc' : '#ff2fa0'
    g.fillRect(x, y + 2, 5, 3)
    x += 6
  }
  x += 3
  x += hud(WEAPON_NAMES[weapon], x, y, '#2ff3ff') + 3
  const lv = syncTimer > 0 ? 5 : clampLevel(bulletLevel)
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i < lv ? (syncTimer > 0 ? '#ffd23f' : '#2ff3ff') : SLOT
    g.fillRect(x + i * 3, y + 3, 2, 2)
  }
  x += 17
  const live = syncTimer > 0
  const ready = !live && syncMeter >= 1
  let col = live || ready ? '#ffd23f' : '#2ff3ff'
  if (ready && Math.floor(now / 250) % 2 === 0) col = '#fff1b0'
  hudBar(x, y + 3, 16, 2, live ? syncTimer / SYNC.duration : syncMeter, col)
  x += 20
  const mult = scoreMult()
  if (mult > 1 && x + 12 < vw) x += hud(`X${mult}`, x, y, '#ffd23f') + 4
  const timed = [['D', dualTimer, 'dual'], ['R', rearTimer, 'rear'], ['T', tempoTimer, 'tempo'], ['M', magnetTimer, 'magnet'], ['C', comboTimer, 'combo']]
  for (const [letter, t, kind] of timed) {
    if (t <= 0 || x + 7 > vw) continue
    hud(letter, x, y, '#ffd23f')
    g.fillStyle = t < 3 && Math.floor(now / 200) % 2 ? '#5b2a1c' : '#ffd23f'
    g.fillRect(x, y + 8, Math.max(1, Math.round(5 * t / POWERUP_DURATION[kind])), 1)
    x += 8
  }
  const boss = bosses[0]
  // Short landscape: the boss bar takes the rest of line 2 (the bottom
  // corner belongs to the intercom).
  if (boss && H() < 520 && W() >= 640) {
    const nx = Math.max(x + 10, vw >> 1)
    const nw = hud(boss.name ?? 'CANTOR', nx, y, '#ff2fa0')
    hudBar(nx + nw + 4, y + 3, Math.max(20, vw - nx - nw - 8), 2, boss.hp / boss.maxHp, boss.flash ? '#ffffff' : '#ff2fa0')
    return
  }
  if (boss) {
    const bw = vw - 12
    const by = stage.vh - L(64 + band)
    hud(boss.name ?? 'CANTOR', 6, by, '#ff2fa0')
    hudBar(6, by + 9, bw, 2, boss.hp / boss.maxHp, boss.flash ? '#ffffff' : '#ff2fa0')
  }
}

function drawHud(now) {
  const g = stage.hud
  const vw = stage.vw
  // Phones and short landscape screens get the two-line layout.
  if (W() < 640 || H() < 520) return drawHudPhone(now)
  const phone = false
  const x0 = 5
  let y = 5
  // Score: top-centre on wide screens, first line of the block on phones
  // (the radio widget owns the top-right).
  if (phone) {
    // The score stays short enough to clear the radio; the rest starts below it.
    hud(`SCORE ${score}`, x0, y, '#2ff3ff')
    y = 22
  } else {
    hud(`SCORE ${score}`, vw >> 1, 5, '#2ff3ff', 'center')
    if (bestBefore > 0) hud(`HI ${Math.max(bestBefore, score)}`, vw >> 1, 14, DIM, 'center')
  }
  // Hull: 5 segments, cyan → gold → blinking pink under 2.
  const segW = 7, segH = 3, gap = 2
  const blink = hull <= 1 && Math.floor(now / 300) % 2 === 0
  for (let i = 0; i < HULL_MAX; i++) {
    const on = i < hull
    const col = !on ? SLOT : hull >= 4 ? '#2ff3ff' : hull >= 2 ? '#ffd23f' : blink ? '#ff70bc' : '#ff2fa0'
    g.fillStyle = '#0b0616'
    g.fillRect(x0 + i * (segW + gap) - 1, y + 1, segW + 2, segH + 2)
    g.fillStyle = col
    g.fillRect(x0 + i * (segW + gap), y + 2, segW, segH)
    if (on) { g.fillStyle = '#ffffff'; g.globalAlpha = 0.5; g.fillRect(x0 + i * (segW + gap), y + 2, segW, 1); g.globalAlpha = 1 }
  }
  const hullW = HULL_MAX * (segW + gap) - gap
  // Weapon: module name and five level pips beside the hull.
  const wx = x0 + hullW + 5
  const wy = y
  const nameW = hud(WEAPON_NAMES[weapon], wx, wy, '#2ff3ff')
  const lv = syncTimer > 0 ? 5 : clampLevel(bulletLevel)
  for (let i = 0; i < 5; i++) {
    const px = wx + nameW + 5 + i * 5
    g.fillStyle = '#0b0616'
    g.fillRect(px - 1, wy + 2, 5, 3)
    g.fillRect(px, wy + 1, 3, 5)
    g.fillStyle = i < lv ? (syncTimer > 0 ? '#ffd23f' : '#2ff3ff') : SLOT
    g.fillRect(px, wy + 3, 3, 1)
    g.fillRect(px + 1, wy + 2, 1, 3)
  }
  y += 10
  // SYNC meter: cyan while charging, gold and blinking when ready or live.
  const live = syncTimer > 0
  const ready = !live && syncMeter >= 1
  const frac = live ? syncTimer / SYNC.duration : syncMeter
  let col = live || ready ? '#ffd23f' : '#2ff3ff'
  if (ready && Math.floor(now / 250) % 2 === 0) col = '#fff1b0'
  hudBar(x0, y + 2, hullW, 2, frac, col)
  const syncLabel = live ? 'SYNC · CLAUDE HAS THE GUNS'
    : ready ? `SYNC READY · ${isTouch() ? '2-FINGER TAP' : 'SHIFT'}` : 'SYNC'
  const lw = textWidth(syncLabel)
  if (x0 + hullW + 5 + lw > vw - 3) {
    y += 7
    hud(syncLabel, x0, y, live || ready ? '#ffd23f' : DIM)
  } else hud(syncLabel, x0 + hullW + 5, y, live || ready ? '#ffd23f' : DIM)
  y += 10
  // Sector, wave, combo — then the timed capsules as letter chips with a
  // draining bar on the same row.
  const sector = sectorFor(sectorIndex)
  let cx = x0 + hud(`SECTOR ${sector.num} · WAVE ${waveNumber}`, x0, y, DIM) + 6
  const mult = scoreMult()
  if (mult > 1) cx += hud(`X${mult}`, cx, y, '#ffd23f') + 6
  const timed = [['D', dualTimer, 'dual'], ['R', rearTimer, 'rear'], ['T', tempoTimer, 'tempo'], ['M', magnetTimer, 'magnet'], ['C', comboTimer, 'combo']]
  for (const [letter, t, kind] of timed) {
    if (t <= 0) continue
    if (cx + 8 > vw - 2) { cx = x0; y += 11 }
    const f = t / POWERUP_DURATION[kind]
    hud(letter, cx + 1, y, '#ffd23f')
    g.fillStyle = t < 3 && Math.floor(now / 200) % 2 ? '#5b2a1c' : '#ffd23f'
    g.fillRect(cx, y + 8, Math.max(1, Math.round(7 * f)), 1)
    cx += 10
  }
  // Boss bar: top-centre under the score, named, nudged right of the
  // sector line; on phones above the bottom band.
  const boss = bosses[0]
  if (boss) {
    let bw = Math.min(180, vw - (phone ? 12 : 90))
    let bx = (vw - bw) >> 1
    if (!phone && bx < cx + 6) {
      bx = cx + 6
      bw = Math.max(60, Math.min(bw, vw - bx - 6))
    }
    const by = phone ? stage.vh - L(64 + band) : y
    hud(boss.name ?? 'CANTOR', bx, by, '#ff2fa0')
    hudBar(bx, by + 9, bw, 2, boss.hp / boss.maxHp, boss.flash ? '#ffffff' : '#ff2fa0')
  }
}

// Sector title and boss warning: centred over-titles, drawn unshaken.
function drawBanners(now) {
  const g = stage.hud
  const vw = stage.vw
  const vh = stage.vh
  const big = vw < 200 ? 2 : 3
  if (bannerT > 0 && gameStarted && !gameOver) {
    const a = Math.min(1, bannerT / 0.5, (3 - bannerT) / 0.3)
    const sector = sectorFor(sectorIndex)
    g.globalAlpha = Math.max(0, a)
    const t = `SECTOR ${sector.num}`
    const y = Math.round(vh * 0.34)
    drawBigText(g, t, (vw - bigTextWidth(t, big)) >> 1, y, big, '#ff2fa0', '#0b0616')
    hud(sector.name, vw >> 1, y + 7 * big + 5, '#2ff3ff', 'center')
    g.globalAlpha = 1
  }
  if (warnT > 0 && !gameOver) {
    const on = reducedMotion || Math.floor(now / 220) % 2 === 0
    const yMid = Math.round(vh * 0.46)
    g.globalAlpha = Math.min(1, warnT / 0.4)
    // Hazard stripes above and below.
    g.fillStyle = '#2a0f28'
    g.fillRect(0, yMid - 14, vw, 28)
    g.fillStyle = '#ff2fa0'
    const off = reducedMotion ? 0 : Math.floor(now / 60) % 8
    for (let x = -8 + off; x < vw; x += 8) {
      g.fillRect(x, yMid - 14, 4, 1)
      g.fillRect(vw - x - 4, yMid + 13, 4, 1)
    }
    if (on) drawBigText(g, 'WARNING', (vw - bigTextWidth('WARNING', 2)) >> 1, yMid - 10, 2, '#ff2fa0', '#0b0616')
    hud(`${warnName} APPROACHING`, vw >> 1, yMid + 5, '#ffd23f', 'center')
    g.globalAlpha = 1
  }
}

// A bolt as a pixel streak along its velocity: hot head, coloured tail.
function streak(g, x, y, vx, vy, len, head, tail, wide) {
  const n = Math.hypot(vx, vy) || 1
  const dx = vx / n
  const dy = vy / n
  for (let i = 0; i < len; i++) {
    g.fillStyle = i < 2 ? head : tail
    const px = Math.round(x - dx * i)
    const py = Math.round(y - dy * i)
    g.fillRect(px, py, 1, 1)
    if (wide && i > 0) g.fillRect(px + (Math.abs(dy) > Math.abs(dx) ? 1 : 0), py + (Math.abs(dy) > Math.abs(dx) ? 0 : 1), 1, 1)
  }
}

// A dithered smoke puff: denser in the middle, thinning as it fades.
function puff(g, cx, cy, r, color, density) {
  g.fillStyle = color
  cx = Math.round(cx)
  cy = Math.round(cy)
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = (x * x + y * y) / (r * r + 0.01)
    if (d > 1) continue
    const th = ((((cx + x) & 3) * 4 + ((cy + y) & 3)) * 7 % 16) / 16
    if ((1 - d) * density > th) g.fillRect(cx + x, cy + y, 1, 1)
  }
}

function drawDeepField(g, px) {
  const k = stage.k
  if (spaceLayer) g.drawImage(spaceLayer, 0, 0)
  for (const n of nebulae) if (n.img) g.drawImage(n.img, L(n.x - n.r + px * 2), L(n.y - n.r))
  if (planet?.img) g.drawImage(planet.img, L(planet.x + px * 4) - (planet.img.width >> 1), L(planet.y) - (planet.img.height >> 1))
  if (station) {
    const spr = art.station(station.size)
    const sx = L(station.x + px * 6)
    const sy = L(station.y)
    g.drawImage(spr, sx - (spr.width >> 1), sy - (spr.height >> 1))
    const s = station.size / k
    const lit = Math.sin(station.blink) > 0
    g.fillStyle = lit ? '#ffd23f' : '#5b2a1c'
    for (let i = -1; i <= 1; i++) g.fillRect(Math.round(sx + i * s * 0.22), sy, 1, 1)
    if (lit) stage.light(sx, sy, s * 0.5, '#ffd23f', 0.35)
    const mast = Math.sin(station.blink * 3) > 0.6
    g.fillStyle = mast ? '#ff2fa0' : '#54259e'
    g.fillRect(Math.round(sx + s * 0.1), Math.round(sy - s * 0.42), 1, 1)
    if (mast) stage.light(sx + s * 0.1, sy - s * 0.42, 6, '#ff2fa0', 0.8)
  }
  // Stars: one pixel each, bright ones a small cross; stretched on warps.
  for (const star of stars) {
    const sx = L(star.x + px * star.speed * 0.5)
    const sy = L(star.y)
    const tw = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(simNow / 400 + star.twinkle)
    const b = star.brightness * tw
    g.fillStyle = b > 0.75 ? '#fff4ff' : b > 0.5 ? '#cfc6ff' : b > 0.3 ? '#8f86b8' : '#5a5285'
    const stretch = Math.round((star.stretch || 0) / k)
    g.fillRect(sx, sy, 1, 1 + stretch)
    if (star.size > 1 && b > 0.7 && !stretch) {
      g.fillStyle = '#8f86b8'
      g.fillRect(sx - 1, sy, 1, 1); g.fillRect(sx + 1, sy, 1, 1); g.fillRect(sx, sy - 1, 1, 1); g.fillRect(sx, sy + 1, 1, 1)
    }
    if (b > 0.5) stage.emit(sx, sy, 1, 1 + stretch)
  }
  // Drifting rocks, each at its own parallax depth.
  for (const shape of bgShapes) {
    const spr = rockSprite(shape, k)
    g.drawImage(spr, L(shape.x + px * shape.depth * 15) - (spr.width >> 1), L(shape.y) - Math.round(spr.height * 0.6))
  }
}

function drawPowerups(g, glowing) {
  for (const p of powerups) {
    const bob = Math.round(Math.sin(p.pulse) * 1)
    const x = L(p.x)
    const y = L(p.y) + bob
    const letter = POWERUP_LETTERS[p.type] ?? '?'
    const weaponCap = p.type === 'weapon' || p.type === 'laser' || p.type === 'homing'
    if (!glowing) {
      const c = art.capsule
      g.drawImage(c, x - (c.width >> 1), y - (c.height >> 1))
      stage.light(x, y, 14 + Math.sin(p.pulse) * 3, '#ffd23f', 0.75)
      continue
    }
    if (weaponCap) pxRing(g, x, y, Math.max(3, Math.round(art.capsule.width * 0.3)), '#2ff3ff')
    const w = textWidth(letter)
    drawText(g, letter, x - (w >> 1), y - 3, '#fff1b0', '#5b2a1c')
    const name = POWERUP_NAMES[p.type] ?? ''
    if (name) hud(name, x, y + (art.capsule.height >> 1) + 2, '#c4861c', 'center')
  }
}

function drawEnemies(g, now) {
  const k = stage.k
  const beat = Math.floor(now / 180)
  for (const e of enemies) {
    const frame = (beat + Math.floor(e.seed ?? 0)) % 2
    const spr = art.enemy(e.kind, e.size, frame, e.heading ?? Math.PI / 2, e.flash > 0)
    const x = L(e.x)
    const y = L(e.y)
    g.drawImage(spr, x - (spr.width >> 1), y - (spr.height >> 1))
    stage.light(x, y, Math.max(6, (e.size / k) * 0.9), '#ff2fa0', 0.35)
    if (e.maxHp > 1) {
      const n = e.maxHp
      const sx = x - Math.floor((n * 3 - 1) / 2)
      const py = y - Math.round(e.size / k / 2) - 3
      g.fillStyle = '#0b0616'
      g.fillRect(sx - 1, py - 1, n * 3 + 1, 3)
      for (let i = 0; i < n; i++) {
        g.fillStyle = i < e.hp ? '#ff70bc' : SLOT
        g.fillRect(sx + i * 3, py, 2, 1)
      }
    }
  }
}

function drawBosses(g, now) {
  const k = stage.k
  for (const boss of bosses) {
    const spr = art.boss(boss.size, false)
    const x = L(boss.x)
    const y = L(boss.y)
    g.drawImage(spr, x - (spr.width >> 1), y - (spr.height >> 1))
    if (boss.flash) {
      g.globalAlpha = 0.55
      g.drawImage(art.boss(boss.size, true), x - (spr.width >> 1), y - (spr.height >> 1))
      g.globalAlpha = 1
    }
    const s = boss.size / k
    const pulse = reducedMotion ? 0.8 : 0.7 + 0.3 * Math.sin(now / (boss.enraged ? 90 : 200))
    stage.light(x, y, s * 0.55 * pulse, '#ff2fa0', 0.9)
    if (boss.muzzle > 0) {
      stage.light(x - s * 0.36, y + s * 0.38, 12, '#ff2fa0', 1)
      stage.light(x + s * 0.36, y + s * 0.38, 12, '#ff2fa0', 1)
    }
  }
}

// The boss's reactor and muzzles glow after the light map.
function drawBossGlow(g, now) {
  const k = stage.k
  for (const boss of bosses) {
    const x = L(boss.x)
    const y = L(boss.y - boss.size * 0.02)
    const s = boss.size / k
    const pulse = reducedMotion ? 0.8 : 0.7 + 0.3 * Math.sin(now / (boss.enraged ? 90 : 200))
    dot(g, x, y, Math.max(1, Math.round(s * 0.06 * pulse)), '#ff2fa0')
    dot(g, x, y, Math.max(0, Math.round(s * 0.03 * pulse)), '#ffffff')
    if (boss.muzzle > 0) {
      dot(g, x - s * 0.36, y + s * 0.4, 2, '#ff70bc')
      dot(g, x + s * 0.36, y + s * 0.4, 2, '#ff70bc')
    }
  }
}

function drawPlayer(g, now) {
  const k = stage.k
  const invuln = now < invulnUntil
  // Bank toward the direction of travel; five roll steps.
  const vx = player.x - player.prevX
  player.bank += (Math.max(-1, Math.min(1, vx / 4)) - player.bank) * 0.2
  const bank = Math.max(-2, Math.min(2, Math.round(player.bank * 2)))
  const spr = art.ship(shipDef, bank)
  const x = L(player.x)
  const y = L(player.y)
  const hullCol = shipDef.colors.hull
  stage.light(x, y + 4, 14, hullCol, 0.6)
  stage.light(x, y + Math.round(17 / k) + 3, 8, syncTimer > 0 ? '#ffd23f' : '#2ff3ff', 0.9)
  if (playerGlow > 0) stage.light(x, y, 20 + playerGlow * 10, '#2ff3ff', playerGlow)
  if (syncTimer > 0) stage.light(x, y, 26, '#ffd23f', 0.7)
  if (dualTimer > 0) {
    const small = art.ship(shipDef, 0, true)
    const ex = L(player.x - player.width * 0.85)
    const ey = L(player.y + 10)
    g.drawImage(small, ex - (small.width >> 1), ey - (small.height >> 1))
    stage.light(ex, ey + 4, 6, '#2ff3ff', 0.8)
  }
  if (invuln && Math.floor(now / 100) % 2 === 0) return
  g.drawImage(spr, x - (spr.width >> 1), y - (spr.height >> 1))
  if (rearTimer > 0) {
    g.fillStyle = '#ffd23f'
    g.fillRect(x, y + Math.round(player.height / 2 / k) - 1, 1, 3)
  }
}

// Flames, muzzle flash, tether and shields: after the light map.
function drawPlayerGlow(g, now) {
  const k = stage.k
  const x = L(player.x)
  const y = L(player.y)
  const climbing = player.y < player.prevY
  const flame = Math.round(((climbing ? 16 : 10) + Math.random() * 6 + (syncTimer > 0 ? 6 : 0)) / k)
  const tail = syncTimer > 0 ? '#ffd23f' : '#2ff3ff'
  const fy = y + Math.round(15 / k)
  for (const dx of [-1, 1]) {
    const fx = x + dx * Math.max(1, Math.round(2.5 / k))
    for (let i = 0; i < flame; i++) {
      g.fillStyle = i < 1 ? '#ffffff' : i < flame * 0.5 ? tail : '#1a9fc4'
      g.fillRect(fx, fy + i, 1, 1)
    }
  }
  if (muzzleT > 0) dot(g, x, y - Math.round(player.height / 2 / k) - 2, 1, syncTimer > 0 ? '#fff1b0' : '#ffffff')
  if (dualTimer > 0) {
    const ex = L(player.x - player.width * 0.85)
    const ey = L(player.y + 10)
    g.fillStyle = shipDef.colors.hull
    g.globalAlpha = 0.5
    const n = Math.max(1, Math.round(Math.hypot(x - ex, y - ey) / 3))
    for (let i = 1; i < n; i++) g.fillRect(Math.round(ex + (x - ex) * i / n), Math.round(ey + (y - ey) * i / n), 1, 1)
    g.globalAlpha = 1
  }
  if (shield || aegis > 0 || shieldFlash > 0) {
    const active = shield || aegis > 0
    const sy = L(player.y - player.height / 2 - 12)
    const a = Math.round(player.width * 0.6 / k)
    g.globalAlpha = active ? 1 : Math.min(1, shieldFlash)
    arcTop(g, x, sy + 2, a, 2, active ? '#2ff3ff' : '#ffffff')
    if (aegis === 2) arcTop(g, x, sy, a - 2, 2, '#7ce4ff')
    g.globalAlpha = 1
    if (active) stage.light(x, sy, a + 4, '#2ff3ff', 0.5)
  }
}

function drawBullets(g) {
  const k = stage.k
  for (const b of bullets) {
    const x = L(b.x)
    const y = L(b.y)
    if (b.kind === 'lance') streak(g, x, y - Math.round(17 / k), 0, -1, Math.round(34 / k), '#ffffff', '#2ff3ff', true)
    else if (b.kind === 'seeker') streak(g, x, y, b.vx, b.vy, 4, '#ffffff', '#2ff3ff', false)
    else if (b.kind === 'rear' || b.vy > 0) streak(g, x, y + 3, 0, 1, Math.round(15 / k), '#fff1b0', '#ffd23f', false)
    else streak(g, x, y - 3, b.vx || 0, b.vy || -1, Math.round(17 / k), '#ffffff', '#2ff3ff', k < 2.5)
  }
  for (const b of enemyBullets) {
    const x = L(b.x)
    const y = L(b.y)
    if (b.type === 'needle') streak(g, x, y + 3, b.vx || 0, b.vy || 1, Math.round(15 / k), '#ffffff', '#ff2fa0', false)
    else {
      const r = Math.max(1, Math.round((b.type === 'big' ? 7 : 4.5) / k))
      dot(g, x, y, r, '#ff2fa0')
      g.fillStyle = '#ffffff'
      g.fillRect(x, y, 1, 1)
      if (r > 1) g.fillRect(x - 1, y - 1, 1, 1)
    }
  }
}

function bulletLights() {
  let n = 0
  for (const b of bullets) {
    if (n++ > 48) break
    stage.light(L(b.x), L(b.y), 6, b.kind === 'rear' ? '#ffd23f' : '#2ff3ff', 0.6)
  }
  for (const b of enemyBullets) stage.light(L(b.x), L(b.y), b.type === 'big' ? 9 : 6, '#ff2fa0', 0.8)
}

function drawParticles(g, glowing) {
  const k = stage.k
  for (const p of particles) {
    if (p.smoke) {
      if (glowing) continue
      puff(g, L(p.x), L(p.y), Math.max(1, Math.round(p.size * (1.6 - p.life * 0.6) / k)), '#43246e', p.life * 0.9)
      continue
    }
    if (!glowing) continue
    const a = Math.max(0, Math.min(1, p.life))
    if (p.glow) {
      const col = GLOW_HEX[p.glow] ?? '#ffffff'
      if (p.flash) {
        const r = Math.round((p.size * (0.4 + p.life * 0.6)) / k / 3)
        g.globalAlpha = a
        dot(g, L(p.x), L(p.y), Math.max(1, r), '#ffffff')
        g.globalAlpha = 1
        stage.light(L(p.x), L(p.y), Math.max(4, (p.size * 1.2) / k), col, a)
        continue
      }
      g.globalAlpha = a
      g.fillStyle = a > 0.6 ? '#ffffff' : col
      const n = p.size > 7 ? 2 : 1
      g.fillRect(L(p.x), L(p.y), n, n)
      g.globalAlpha = 1
      continue
    }
    g.globalAlpha = a
    g.fillStyle = p.color
    const n = Math.max(1, Math.round(p.size / k))
    g.fillRect(L(p.x) - (n >> 1), L(p.y) - (n >> 1), n, n)
  }
  g.globalAlpha = 1
}

function particleLights() {
  let n = 0
  for (const p of particles) {
    if (!p.glow || p.flash || n > 40) continue
    if (p.life < 0.4) continue
    n++
    stage.light(L(p.x), L(p.y), 5, GLOW_HEX[p.glow] ?? '#ffffff', p.life * 0.6)
  }
}

function drawGlowing(g, now) {
  // Shockwaves: pixel rings (gold for boss/nova/combo, pink otherwise).
  for (const sw of shockwaves) {
    const col = sw.color ?? '#ff2fa0'
    g.globalAlpha = Math.max(0, sw.life)
    const r = L(sw.radius)
    pxRing(g, L(sw.x), L(sw.y), r, col)
    if (!sw.thin && sw.life > 0.3) pxRing(g, L(sw.x), L(sw.y), r - 1, sw.life > 0.7 ? '#ffffff' : col)
  }
  g.globalAlpha = 1
  // Sniper telegraph: a flickering dotted sightline straight down.
  for (const e of enemies) {
    if (!e.aiming) continue
    const x = L(e.x)
    const on = Math.floor(now / 60) % 2
    g.fillStyle = '#ff2fa0'
    for (let y = L(e.y + e.size / 2) + on; y < stage.vh; y += 2) g.fillRect(x, y, 1, 1)
  }
  drawBossGlow(g, now)
  drawPowerups(g, true)
  if (!gameOver) drawPlayerGlow(g, now)
  drawBullets(g)
  drawParticles(g, true)
  // Tempo: a cold wash while slow-mo runs; SYNC: dithered gold at the edges.
  if (tempoTimer > 0) {
    g.globalAlpha = 0.07
    g.fillStyle = '#2ff3ff'
    g.fillRect(0, 0, stage.vw, stage.vh)
    g.globalAlpha = 1
  }
  if (syncTimer > 0) {
    // Gold light along the top and bottom edges, fading inwards in a dither.
    const a = 0.75 + (reducedMotion ? 0 : 0.25 * Math.sin(now / 120))
    g.fillStyle = '#ffd23f'
    for (let y = 0; y < 5; y++) {
      const f = (1 - y / 5) * a
      for (let x = 0; x < stage.vw; x++) {
        if (((x * 5 + y * 3) & 7) / 8 < f * (y === 0 ? 2 : 0.7)) {
          g.fillRect(x, y, 1, 1)
          g.fillRect(x, stage.vh - 1 - y, 1, 1)
        }
      }
    }
  }
}

function draw() {
  if (!stage || !art || !canvas.value) return
  const now = simNow
  const g = stage.begin()
  // Parallax: the player moves left → the background shifts right.
  const centerX = W() / 2
  const targetParallaxX = gameStarted && !reducedMotion && !paused.value ? -(player.x - centerX) * 0.015 : 0
  if (!paused.value) smoothParallaxX += (targetParallaxX - smoothParallaxX) * 0.04
  drawDeepField(g, smoothParallaxX)
  drawPowerups(g, false)
  drawEnemies(g, now)
  drawBosses(g, now)
  if (!gameOver) drawPlayer(g, now)
  drawParticles(g, false)
  bulletLights()
  particleLights()
  for (const sw of shockwaves) if (sw.thin) stage.light(L(sw.x), L(sw.y), Math.max(4, L(sw.radius)), sw.color ?? '#ff2fa0', sw.life * 0.5)
  // Floating pickup / bounty text.
  for (const p of pops) {
    stage.hud.globalAlpha = Math.min(1, p.life * 1.5)
    hud(p.text, L(p.x), L(p.y) - 3, p.color, 'center')
  }
  stage.hud.globalAlpha = 1
  if (gameStarted) {
    drawHud(now)
    drawBanners(now)
  }
  const sh = shake > 0 && !reducedMotion ? shake * 12 / stage.k : 0
  stage.present({
    ambient: gameStarted ? '#a79bd6' : '#8a7fbd',
    shakeX: sh ? (Math.random() - 0.5) * sh : 0,
    shakeY: sh ? (Math.random() - 0.5) * sh : 0,
    flash: deathExplosion && deathExplosion.flash > 0 ? { color: '#ff2fa0', a: deathExplosion.flash * 0.35 } : null,
    afterLight: g2 => drawGlowing(g2, now),
  })
}

// ---------------------------------------------------------------- loop

// Mirror the director's current line into the Intercom view.
function syncIntercom() {
  const cur = director.tick(simNow)
  const prev = intercom.value
  if ((cur?.id ?? 0) !== (prev?.id ?? 0)) {
    intercom.value = cur ? { id: cur.id, who: cur.who, text: cur.text } : null
    if (cur) audio?.play(cur.who === 'choir' ? 'choir' : 'comms')
  }
  const shown = cur ? (reducedMotion ? cur.text.length : visibleChars(cur, simNow)) : 0
  if (shown !== intercomShown.value) intercomShown.value = shown
}

function gameLoop(real) {
  if (!gameRunning) return
  const elapsed = lastReal ? Math.min(100, real - lastReal) : STEP_MS
  lastReal = real
  if (!paused.value) {
    // Fixed 60 Hz steps; a 1 ms tolerance keeps 60 Hz displays at exactly
    // one step per frame despite rAF jitter.
    stepAcc += elapsed
    let steps = 0
    while (stepAcc >= STEP_MS - 1 && steps < 4) {
      stepAcc -= STEP_MS
      steps++
      simNow += STEP_MS
      // Hit-stop freezes the world but keeps drawing (boss-kill beat).
      if (simNow >= hitStopUntil) {
        updateBackdrop()
        update(simNow)
      }
    }
    if (steps === 4) stepAcc = 0
  }
  syncIntercom()
  draw()
  animationFrameId = requestAnimationFrame(gameLoop)
}

function setupCanvas() {
  if (!canvas.value) return
  dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
  const cssW = canvas.value.offsetWidth
  const cssH = canvas.value.offsetHeight
  band = safeBottom()
  if (!stage) stage = createPixelStage(canvas.value)
  // Pixel size: 3 CSS px on wide screens (chunky like the portal), a bit
  // finer on phones so the ship stays ~20 px and the field wide enough.
  const scale = Math.max(1, Math.round((cssW < 640 ? 2.34 : 3) * dpr))
  const bw = Math.round(cssW * dpr)
  const bh = Math.round(cssH * dpr)
  stage.resize(cssW, cssH, dpr, bw / scale - 0.01, bh / scale - 0.01)
  if (!art || art.k !== stage.k) art = createGalagaArt(stage.k)
  spaceLayer = paintSpace(stage.vw, stage.vh)
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
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
    if (activateSync()) e.preventDefault()
    return
  }
  // M is owned globally by the RadioWidget (it cycles all six stations).
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
    else { audio?.suspend(true); radio.suspend(true) }
  } else if (!paused.value) {
    audio?.suspend(false)
    radio.suspend(false)
  }
}

// Touch controls
let touchActive = false
const TOUCH_Y_OFFSET = 80

function isInteractiveElement(el) {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return true
  if (el.closest('a, button, .social-links, .profile-card, .radio-widget')) return true
  return false
}

let tapStartX = 0
let tapStartY = 0

function handleTouchStart(e) {
  if (isInteractiveElement(e.target)) return
  if (!gameStarted || gameOver) {
    // Start on tap, not on touchstart, so a stray swipe does not launch
    // the game.
    tapStartX = e.touches[0].clientX
    tapStartY = e.touches[0].clientY
    return
  }
  // A second finger hands the guns to Claude.
  if (e.touches.length >= 2) {
    activateSync()
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
  // Lifting the second finger keeps the first one flying.
  if (e.touches.length > 0) return
  touchActive = false
  keys['Space'] = false
}

let idleCueTimer = null

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  setupCanvas()
  initStars()
  initBgShapes()
  // Don't auto-start — wait for Enter
  player.x = canvas.value ? W() / 2 : 0
  player.y = canvas.value ? H() - 60 - band : 0
  player.prevX = player.x
  player.prevY = player.y
  gameRunning = true
  gameStarted = false
  animationFrameId = requestAnimationFrame(gameLoop)
  // `?debug=galaga` exposes a few levers for screenshots and manual checks.
  if (location.search.includes('debug=galaga')) {
    window.__galaga = {
      boss: () => spawnBoss(),
      give: type => applyPowerup(type, simNow),
      sync: () => { syncMeter = 1; return activateSync() },
      wave: n => { waveNumber = n },
      state: () => ({ score, hull, weapon, bulletLevel, waveNumber, sectorIndex, syncMeter, enemies: enemies.length, bosses: bosses.length, simNow }),
    }
  }
  // Claude says hello once per page load while the attract screen waits.
  idleCueTimer = setTimeout(() => {
    if (!gameStarted) director.cue('idle', simNow, { start: isTouch() ? 'tap' : 'press enter' })
  }, 1400)

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
  if (idleCueTimer) clearTimeout(idleCueTimer)
  // SFX context only — the shared radio keeps playing across themes.
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
  height: var(--app-height, 100dvh);
  display: block;
  z-index: 1;
}
</style>
