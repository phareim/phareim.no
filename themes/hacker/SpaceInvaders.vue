<template>
  <canvas ref="canvas" class="invaders-canvas"></canvas>
  <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup>
import { MACHINE_FONT } from '~/themes/base/fonts'
import EscHold from '../base/EscHold.vue'
const emit = defineEmits(['score', 'death', 'restart', 'started'])

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
let bossInterval = 25000
let playerGlow = 0 // powerup pickup glow effect
let shield = false // player shield active
let shieldFlash = 0 // flash effect when shield absorbs a hit
let deathExplosion = null // multi-phase death explosion
let bgShapes = [] // parallax background geometric shapes
let smoothParallaxX = 0 // smoothed parallax offset (lerps toward target)

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
  waveInterval = 2500
  waveTimer = now - waveInterval // first wave spawns right away
  bulletLevel = 1
  powerupTimer = now
  bossTimer = now
  playerGlow = 0
  shield = false
  shieldFlash = 0
  deathExplosion = null
  smoothParallaxX = 0
  emit('restart')
  emit('started')
  emit('score', 0)
}

function spawnWave() {
  if (!canvas.value) return
  const w = canvas.value.width, h = canvas.value.height
  const pattern = waveNumber++ % 4
  const heavy = pattern === 3
  const count = heavy ? 3 : Math.min(7, 4 + Math.floor(w / 350))
  const size = heavy ? 52 : pattern === 0 ? 28 : 32
  const direction = pattern === 2 ? -1 : 1
  for (let i = 0; i < count; i++) {
    const side = pattern === 1 || pattern === 2
    const x = side ? (direction === 1 ? -size - i * 44 : w + size + i * 44)
      : 40 + i / (count - 1) * (w - 80)
    enemies.push({ x, y: side ? h * .16 : -size - Math.abs(i - (count - 1) / 2) * 28,
      vx: direction * 2.1, vy: heavy ? .7 : 1.15,
      size, color: heavy ? '#ff70bc' : '#ff2fa0', shapeIdx: heavy ? 3 : side ? 4 : 0,
      movementType: side ? 'formation' : 'straight', age: 0, slot: i, direction,
      spawnX: x, spawnY: h * .16, hp: heavy ? 3 : 1, maxHp: heavy ? 3 : 1,
      shootCooldown: heavy ? 1800 : 2600 + i * 200,
      lastShot: performance.now() + 800, flash: 0,
    })
  }
}

function spawnBoss() {
  if (!canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  const bossHp = Math.max(18, Math.floor(18 * Math.pow(1.35, bulletLevel - 1)))
  bosses.push({
    x: w / 2,
    y: -150,
    targetY: Math.min(h * .28, 150),
    vx: (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 1),
    vy: 1.5,
    size: Math.min(210, w * .46, h * .48),
    hp: bossHp,
    maxHp: bossHp,
    color: '#ff2fa0',
    shootCooldown: 600 + Math.random() * 800,
    lastShot: performance.now(),
    arrived: false,
    dirChangeTimer: 0
  })
}

function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5
    const speed = 1.5 + Math.random() * 4
    particles.push({
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

function spawnSmoke(x, y, count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.3 + Math.random() * 1
    particles.push({
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

function triggerShockwave(x, y) {
  shockwaves.push({ x, y, radius: 0, maxRadius: Math.max(canvas.value.width, canvas.value.height), speed: 12, life: 1 })
}

function triggerDeathExplosion(x, y) {
  deathExplosion = { x, y, phase: 0, timer: 0, flash: 1 }
  // Bright white flash at center
  particles.push({
    x, y, vx: 0, vy: 0,
    life: 1, decay: 0.02, color: '#ffffff', size: 90
  })
  // Neon core — pink and cyan expanding fragments
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.5 + Math.random() * 3.5
    const colors = ['#ff2fa0', '#ff70bc', '#2ff3ff', '#f2e9ff', '#ffffff']
    particles.push({
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
  for (let i = 0; i < 28; i++) {
    const angle = (Math.PI * 2 / 28) * i + Math.random() * 0.3
    const speed = 2.5 + Math.random() * 6
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.008 + Math.random() * 0.012,
      color: '#2ff3ff',
      size: 3 + Math.random() * 6
    })
  }
  // Expanding sparks ring
  for (let i = 0; i < 32; i++) {
    const angle = (Math.PI * 2 / 32) * i
    const speed = 5 + Math.random() * 4
    particles.push({
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
    life: 1
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
}

// A 3 s Escape hold cancels the run: the same death as a collision, so the
// landing shows GAME OVER with the run's score.
function quitToGameOver() {
  if (!gameStarted || gameOver) return
  paused.value = false
  keys = {}
  gameOver = true
  triggerDeathExplosion(player.x, player.y)
  emit('death')
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

  // Decay player glow
  if (playerGlow > 0) playerGlow = Math.max(0, playerGlow - 0.02)

  // Player movement
  if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed
  if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed
  if (keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed
  if (keys['ArrowDown'] || keys['KeyS']) player.y += player.speed
  player.x = Math.max(player.width / 2, Math.min(w - player.width / 2, player.x))
  player.y = Math.max(player.height, Math.min(h - player.height / 2, player.y))

  // Shooting
  if (keys['Space'] && now - lastShotTime > 180) {
    const n = bulletLevel
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
    lastShotTime = now
  }

  // Update bullets
  bullets = bullets.filter(b => {
    b.x += (b.vx || 0)
    b.y += b.vy
    return b.y > -10 && b.x > -10 && b.x < w + 10
  })

  // Update enemy bullets
  enemyBullets = enemyBullets.filter(b => {
    b.y += b.vy
    return b.y < h + 10
  })

  // Wave spawning
  if (now - waveTimer > waveInterval) {
    spawnWave()
    waveTimer = now
    waveInterval = Math.max(1200, waveInterval - 30)
  }

  // Boss spawning
  if (now - bossTimer > bossInterval) {
    spawnBoss()
    bossTimer = now
  }

  // Update enemies
  enemies = enemies.filter(enemy => {
    enemy.flash = Math.max(0, enemy.flash - 1)
    enemy.y += enemy.vy
    if (enemy.movementType === 'formation') {
      enemy.age++
      enemy.x = enemy.spawnX + enemy.vx * enemy.age
      enemy.y = enemy.spawnY + Math.sin(enemy.age * .012) * h * .13 + enemy.slot * 12
    }
    if (enemy.movementType !== 'formation') enemy.x = Math.max(enemy.size / 2, Math.min(w - enemy.size / 2, enemy.x))
    if (enemy.y > enemy.size && enemy.x > enemy.size && enemy.x < w - enemy.size && now - enemy.lastShot > enemy.shootCooldown) {
      enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.size / 2, vy: 2.5 + Math.random() * 1.5 })
      enemy.lastShot = now
      enemy.shootCooldown = 800 + Math.random() * 2500
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
      // Semi-random roaming in top half
      boss.dirChangeTimer += 1
      if (boss.dirChangeTimer > 60 + Math.random() * 80) {
        boss.vx = (Math.random() - 0.5) * 3
        boss.vy = (Math.random() - 0.5) * 1.5
        boss.dirChangeTimer = 0
      }
      boss.x += boss.vx
      boss.y += boss.vy
      // Keep in top half
      boss.x = Math.max(boss.size * .6, Math.min(w - boss.size * .6, boss.x))
      boss.y = Math.max(boss.size * .55 + 18, Math.min(h * 0.4, boss.y))
    }

    // Boss shooting — fires downward with slight random spread
    if (boss.arrived && now - boss.lastShot > boss.shootCooldown) {
      const spread = (Math.random() - 0.5) * 1.5
      enemyBullets.push({ x: boss.x - boss.size * .36, y: boss.y + boss.size * .38, vy: 3 + Math.random() * 1.5, vx: spread })
      enemyBullets.push({ x: boss.x + boss.size * .36, y: boss.y + boss.size * .38, vy: 3 + Math.random() * 1.5, vx: -spread })
      boss.lastShot = now
      boss.shootCooldown = 400 + Math.random() * 1200
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
        if (boss.hp <= 0) {
          // Boss killed — shockwave!
          spawnParticles(boss.x, boss.y, boss.color, 35)
          spawnSmoke(boss.x, boss.y, 12)
          triggerShockwave(boss.x, boss.y)
          score += 500
          emit('score', score)
          bosses.splice(j, 1)
        }
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
        e.hp--
        e.flash = 5
        if (e.hp > 0) {
          spawnParticles(b.x, b.y, e.color, 5)
          break
        }
        spawnParticles(e.x, e.y, e.color, 14)
        spawnSmoke(e.x, e.y, 5)
        enemies.splice(j, 1)
        score += e.maxHp > 1 ? 250 : 100
        emit('score', score)
        break
      }
    }
  }

  // Shockwave kills all enemies
  shockwaves.forEach(sw => {
    enemies = enemies.filter(e => {
      const dx = e.x - sw.x
      const dy = e.y - sw.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < sw.radius + 20 && dist > sw.radius - 30) {
        spawnParticles(e.x, e.y, e.color, 10)
        spawnSmoke(e.x, e.y, 4)
        score += e.maxHp > 1 ? 250 : 100
        emit('score', score)
        return false
      }
      return true
    })
  })

  // Update shockwaves
  shockwaves = shockwaves.filter(sw => {
    sw.radius += sw.speed
    sw.life = Math.max(0, 1 - sw.radius / sw.maxRadius)
    return sw.life > 0
  })

  // Shield flash decay
  if (shieldFlash > 0) shieldFlash = Math.max(0, shieldFlash - 0.05)

  // Enemy bullet-player collision (shield blocks bullets from above)
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i]
    // Check shield first — shield sits in front of the ship
    if (shield) {
      const shieldY = player.y - player.height / 2 - 12
      const shieldW = player.width * 1.2
      if (b.x > player.x - shieldW / 2 && b.x < player.x + shieldW / 2 &&
          b.y > shieldY - 8 && b.y < shieldY + 8) {
        // Shield absorbs the bullet
        shield = false
        shieldFlash = 1
        spawnParticles(b.x, shieldY, '#2ff3ff', 12)
        spawnParticles(b.x, shieldY, '#ffffff', 6)
        enemyBullets.splice(i, 1)
        continue
      }
    }
    const dx = b.x - player.x
    const dy = b.y - player.y
    if (dx * dx + dy * dy < (player.width / 2 + 3) * (player.width / 2 + 3)) {
      gameOver = true
      triggerDeathExplosion(player.x, player.y)
      emit('death')
      return
    }
  }

  // Enemy-player collision (shield does NOT help here)
  for (const e of enemies) {
    const dx = e.x - player.x
    const dy = e.y - player.y
    if (dx * dx + dy * dy < (e.size / 2 + player.width / 2) * (e.size / 2 + player.width / 2)) {
      gameOver = true
      triggerDeathExplosion(player.x, player.y)
      emit('death')
      return
    }
  }

  // Boss-player collision (shield does NOT help here)
  for (const boss of bosses) {
    const dx = boss.x - player.x
    const dy = boss.y - player.y
    if (dx * dx + dy * dy < (boss.size / 2 + player.width / 2) * (boss.size / 2 + player.width / 2)) {
      gameOver = true
      triggerDeathExplosion(player.x, player.y)
      emit('death')
      return
    }
  }

  // Powerup spawning
  if (now - powerupTimer > powerupInterval) {
    // Decide type: shield only if player doesn't have one active
    const canSpawnShield = !shield
    const type = canSpawnShield && Math.random() < 0.4 ? 'shield' : 'weapon'
    powerups.push({
      x: 40 + Math.random() * (w - 80),
      y: -20,
      vy: 1.2,
      size: 28,
      pulse: 0,
      type
    })
    powerupTimer = now
  }

  // Update powerups
  powerups = powerups.filter(p => {
    p.y += p.vy
    p.pulse += 0.08
    const dx = p.x - player.x
    const dy = p.y - player.y
    if (dx * dx + dy * dy < (p.size / 2 + player.width / 2) * (p.size / 2 + player.width / 2)) {
      if (p.type === 'shield') {
        shield = true
        // Blue shield activation burst
        spawnParticles(player.x, player.y - player.height / 2, '#2ff3ff', 16)
        spawnParticles(player.x, player.y - player.height / 2, '#ffffff', 8)
        playerGlow = 0.5
      } else {
        bulletLevel++
        playerGlow = 1
        // Bright cyan burst
        spawnParticles(player.x, player.y, '#2ff3ff', 24)
        // Expanding ring of sparks
        for (let i = 0; i < 30; i++) {
          const angle = (Math.PI * 2 / 30) * i
          const speed = 3 + Math.random() * 4
          const r = player.width * 0.6
          particles.push({
            x: player.x + Math.cos(angle) * r,
            y: player.y + Math.sin(angle) * r,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1, decay: 0.02 + Math.random() * 0.02,
            color: Math.random() < 0.5 ? '#2ff3ff' : '#ffffff',
            size: 3 + Math.random() * 3
          })
        }
        // Smoke cloud — larger, slower, fading particles
        for (let i = 0; i < 18; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = 0.5 + Math.random() * 2
          particles.push({
            x: player.x + (Math.random() - 0.5) * 20,
            y: player.y + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.5,
            life: 1, decay: 0.01 + Math.random() * 0.015,
            color: `rgba(0, ${150 + Math.floor(Math.random() * 105)}, ${200 + Math.floor(Math.random() * 55)}, 0.6)`,
            size: 6 + Math.random() * 8
          })
        }
        // Bright flash — one big particle at center
        particles.push({
          x: player.x, y: player.y,
          vx: 0, vy: 0,
          life: 1, decay: 0.05,
          color: '#ffffff',
          size: 40
        })
      }
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

function updateBackdrop() {
  if (!canvas.value || reducedMotion) return
  const h = canvas.value.height
  stars.forEach(star => {
    star.y += star.speed
    if (star.y > h) star.y = 0
  })
  bgShapes = bgShapes.filter(s => {
    s.y += s.speed
    return s.y < h + s.size
  })
  while (bgShapes.length < 6) bgShapes.push(createBgShape())
  bgShapes.sort((a, b) => a.depth - b.depth)
}

function draw() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height

  ctx.fillStyle = '#0b0616'
  ctx.fillRect(0, 0, w, h)

  // Compute parallax: player moves left → background shifts right (inverted)
  // Smooth interpolation for acceleration/deceleration feel
  const centerX = w / 2
  const targetParallaxX = gameStarted && !reducedMotion && !paused.value ? -(player.x - centerX) * 0.015 : 0
  if (!paused.value) smoothParallaxX += (targetParallaxX - smoothParallaxX) * 0.04

  // Stars (with subtle parallax based on star speed as depth proxy)
  stars.forEach(star => {
    const sx = star.x + smoothParallaxX * star.speed * 0.5
    ctx.fillStyle = `rgba(207, 233, 255, ${star.brightness * 0.5})`
    ctx.fillRect(sx, star.y, star.size, star.size)
  })

  // Background geometric shapes (parallax per-shape depth)
  bgShapes.forEach(s => drawBgShape(s, smoothParallaxX))

  // Shockwaves
  shockwaves.forEach(sw => {
    ctx.strokeStyle = `rgba(255, 47, 160, ${sw.life * 0.8})`
    ctx.lineWidth = 4 + sw.life * 8
    ctx.shadowColor = '#ff2fa0'
    ctx.shadowBlur = 20 * sw.life
    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
  })

  // Particles
  particles.forEach(p => {
    ctx.globalAlpha = p.life
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  })
  ctx.globalAlpha = 1

  if (!gameOver) {
    // Player ship with powerup glow
    const glowColor = playerGlow > 0 ? `rgba(47, 243, 255, ${playerGlow * 0.6})` : null
    if (glowColor) {
      ctx.shadowColor = '#2ff3ff'
      ctx.shadowBlur = 25 + playerGlow * 20
    } else {
      ctx.shadowColor = '#2ff3ff'
      ctx.shadowBlur = 10
    }
    ctx.fillStyle = playerGlow > 0.5 ? '#2ff3ff' : '#2ff3ff'
    ctx.beginPath()
    ctx.moveTo(player.x, player.y - player.height / 2)
    ctx.lineTo(player.x + player.width / 2, player.y + player.height / 2)
    ctx.lineTo(player.x + player.width / 4, player.y + player.height / 4)
    ctx.lineTo(player.x - player.width / 4, player.y + player.height / 4)
    ctx.lineTo(player.x - player.width / 2, player.y + player.height / 2)
    ctx.closePath()
    ctx.fill()

    // Extra wing details for the bigger ship
    ctx.fillStyle = playerGlow > 0.5 ? '#2ff3ff' : '#2ff3ff'
    ctx.fillRect(player.x - 3, player.y - player.height * 0.1, 6, player.height * 0.4)
    ctx.shadowBlur = 0

    // Shield in front of ship
    if (shield || shieldFlash > 0) {
      const shieldY = player.y - player.height / 2 - 12
      const shieldW = player.width * 1.2
      const shieldAlpha = shield ? 0.7 : shieldFlash * 0.8
      const shieldColor = shield ? '#2ff3ff' : '#ffffff'
      ctx.shadowColor = shieldColor
      ctx.shadowBlur = shield ? 12 : 25 * shieldFlash
      ctx.strokeStyle = shieldColor
      ctx.globalAlpha = shieldAlpha
      ctx.lineWidth = shield ? 3 : 2
      ctx.beginPath()
      // Curved shield arc
      ctx.ellipse(player.x, shieldY, shieldW / 2, 6, 0, Math.PI, 0)
      ctx.stroke()
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
      // Outer glow
      ctx.shadowColor = '#2ff3ff'
      ctx.shadowBlur = 14
      ctx.fillStyle = '#2ff3ff'
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
    ctx.shadowBlur = 8
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

  // Powerups — larger and glowier. No combo/multiplier in this game, so the
  // Neon Dreams reward colour (gold #ffd23f) shows here on both capsules,
  // with the page ground #0b0616 as the label ink.
  powerups.forEach(p => {
    const glow = 0.6 + 0.4 * Math.sin(p.pulse)
    const isShield = p.type === 'shield'
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
    ctx.fillText(isShield ? 'S' : 'P', 0, 1)
    ctx.restore()
    ctx.shadowBlur = 0
  })

  // Enemy bullets
  ctx.fillStyle = '#ff2fa0'
  ctx.shadowColor = '#ff2fa0'
  ctx.shadowBlur = 6
  enemyBullets.forEach(b => {
    ctx.fillRect(b.x - 2, b.y - 4, 4, 8)
  })
  ctx.shadowBlur = 0

  // Death explosion screen flash
  if (deathExplosion && deathExplosion.flash > 0) {
    ctx.fillStyle = `rgba(255, 47, 160, ${deathExplosion.flash * 0.4})`
    ctx.fillRect(0, 0, w, h)
  }
}

function gameLoop(now) {
  if (!gameRunning) return
  if (!paused.value) {
    updateBackdrop()
    update(now)
  }
  draw()
  animationFrameId = requestAnimationFrame(gameLoop)
}

function setupCanvas() {
  if (!canvas.value) return
  canvas.value.width = canvas.value.offsetWidth
  canvas.value.height = canvas.value.offsetHeight
  ctx = canvas.value.getContext('2d')
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
.invaders-canvas {
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
