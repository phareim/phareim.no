<template>
  <canvas ref="canvas"></canvas>
</template>

<script setup>
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

const enemyColors = ['#ff0055', '#ffcc00', '#4dffb8', '#ff6600', '#ff0055', '#00ccff']

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

const bgShapeTypes = ['triangle', 'hexagon', 'diamond', 'circle', 'cross', 'ring']
const bgShapeColors = [
  [255, 0, 100],   // pink
  [0, 200, 255],   // cyan
  [255, 100, 0],   // orange
  [100, 255, 100], // green
  [180, 0, 255],   // purple
  [255, 200, 0],   // yellow
]

function createBgShape(startY) {
  if (!canvas.value) return null
  const w = canvas.value.width
  const depth = 0.15 + Math.random() * 0.45 // 0.15 = far, 0.6 = closer
  return {
    x: Math.random() * (w + 200) - 100,
    y: startY !== undefined ? startY : -(80 + Math.random() * 200),
    depth,
    speed: 0.2 + depth * 1.2,
    size: 200 + (1 - depth) * 350 + Math.random() * 150, // further = bigger
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.003,
    type: bgShapeTypes[Math.floor(Math.random() * bgShapeTypes.length)],
    color: bgShapeColors[Math.floor(Math.random() * bgShapeColors.length)],
    alpha: 0.03 + depth * 0.07 // further = more faded, closer = slightly more visible
  }
}

function initBgShapes() {
  bgShapes = []
  if (!canvas.value) return
  const h = canvas.value.height
  for (let i = 0; i < 6; i++) {
    const shape = createBgShape(Math.random() * (h + 400) - 200)
    if (shape) bgShapes.push(shape)
  }
}

function drawBgShape(shape, offsetX) {
  const sx = shape.x + offsetX * shape.depth * 15
  const sy = shape.y
  const [r, g, b] = shape.color
  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(shape.rotation)
  ctx.globalAlpha = shape.alpha
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${shape.alpha * 0.3})`
  ctx.lineWidth = 1.5

  const s = shape.size / 2
  switch (shape.type) {
    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.lineTo(s * 0.87, s * 0.5)
      ctx.lineTo(-s * 0.87, s * 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    case 'hexagon':
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6
        const px = s * Math.cos(a)
        const py = s * Math.sin(a)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.lineTo(s * 0.6, 0)
      ctx.lineTo(0, s)
      ctx.lineTo(-s * 0.6, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    case 'circle':
      ctx.beginPath()
      ctx.arc(0, 0, s, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    case 'cross':
      ctx.lineWidth = s * 0.2
      ctx.beginPath()
      ctx.moveTo(-s, 0); ctx.lineTo(s, 0)
      ctx.moveTo(0, -s); ctx.lineTo(0, s)
      ctx.stroke()
      break
    case 'ring':
      ctx.lineWidth = s * 0.12
      ctx.beginPath()
      ctx.arc(0, 0, s, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2)
      ctx.stroke()
      break
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function resetGame() {
  if (!canvas.value) return
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
  waveTimer = 0
  bulletLevel = 1
  powerupTimer = 0
  bossTimer = 0
  waveInterval = 2500
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
  const w = canvas.value.width
  const count = 4 + Math.floor(Math.random() * 5) + Math.floor((bulletLevel - 1) * 1.5)
  const pattern = Math.floor(Math.random() * 4)
  const shapeIdx = Math.floor(Math.random() * enemyShapes.length)
  const color = enemyColors[Math.floor(Math.random() * enemyColors.length)]
  const size = 22 + Math.random() * 14

  for (let i = 0; i < count; i++) {
    let x, y, vx, vy, movementType
    const baseSpeed = 0.8 + Math.random() * 0.8

    switch (pattern) {
      case 0:
        x = 40 + (i / (count - 1 || 1)) * (w - 80)
        y = -20 - i * 30
        vx = 0; vy = baseSpeed; movementType = 'straight'; break
      case 1:
        x = 40 + (i / (count - 1 || 1)) * (w - 80)
        y = -20 - i * 35
        vx = 0; vy = baseSpeed; movementType = 'sine'; break
      case 2:
        x = w / 2 + (i - count / 2) * 45
        y = -20 - Math.abs(i - count / 2) * 30
        vx = 0; vy = baseSpeed; movementType = 'straight'; break
      case 3:
        x = 40 + (i / (count - 1 || 1)) * (w - 80)
        y = -20 - i * 25
        vx = (Math.random() < 0.5 ? 1 : -1) * 1.5
        vy = baseSpeed * 0.7; movementType = 'zigzag'; break
    }

    enemies.push({
      x, y, vx, vy, size, color, shapeIdx, movementType,
      sineOffset: Math.random() * Math.PI * 2,
      sineAmplitude: 40 + Math.random() * 60,
      zigzagTimer: Math.random() * 100,
      hp: 1,
      shootCooldown: 1000 + Math.random() * 3000,
      lastShot: performance.now() + Math.random() * 2000,
      spawnX: x
    })
  }
}

function spawnBoss() {
  if (!canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  const bossHp = Math.max(4, Math.floor(4 * Math.pow(1.5, bulletLevel - 1)))
  bosses.push({
    x: Math.random() * (w - 120) + 60,
    y: -60,
    targetY: 60 + Math.random() * (h * 0.3),
    vx: (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 1),
    vy: 1.5,
    size: 60,
    hp: bossHp,
    maxHp: bossHp,
    color: '#ff00ff',
    shootCooldown: 600 + Math.random() * 800,
    lastShot: performance.now(),
    arrived: false,
    dirChangeTimer: 0
  })
}

function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5
    const speed = 1 + Math.random() * 3
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      color,
      size: 2 + Math.random() * 3
    })
  }
}

function triggerShockwave(x, y) {
  shockwaves.push({ x, y, radius: 0, maxRadius: Math.max(canvas.value.width, canvas.value.height), speed: 12, life: 1 })
}

function triggerDeathExplosion(x, y) {
  deathExplosion = { x, y, phase: 0, timer: 0, flash: 1 }
  // Phase 1: bright white flash at center
  particles.push({
    x, y, vx: 0, vy: 0,
    life: 1, decay: 0.03, color: '#ffffff', size: 60
  })
  // Phase 2: fiery core — orange/yellow expanding fireball particles
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.5 + Math.random() * 2.5
    const colors = ['#ff6600', '#ff9900', '#ffcc00', '#ff3300', '#ffffff']
    particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.008 + Math.random() * 0.012,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8
    })
  }
  // Phase 3: green debris flying outward (ship fragments)
  for (let i = 0; i < 20; i++) {
    const angle = (Math.PI * 2 / 20) * i + Math.random() * 0.3
    const speed = 2 + Math.random() * 5
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.01 + Math.random() * 0.015,
      color: Math.random() < 0.5 ? '#00ff41' : '#00cc33',
      size: 3 + Math.random() * 5
    })
  }
  // Phase 4: expanding sparks ring
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 / 24) * i
    const speed = 4 + Math.random() * 3
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.015 + Math.random() * 0.01,
      color: '#00ff41',
      size: 2 + Math.random() * 2
    })
  }
  // Smoke cloud
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.3 + Math.random() * 1.2
    particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.3,
      life: 1, decay: 0.005 + Math.random() * 0.008,
      color: `rgba(100, 100, 100, 0.6)`,
      size: 8 + Math.random() * 12
    })
  }
  // Shockwave ring from player death
  shockwaves.push({
    x, y,
    radius: 0,
    maxRadius: 300,
    speed: 6,
    life: 1
  })
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
    stars.forEach(star => {
      star.y += star.speed
      if (star.y > canvas.value.height) {
        star.y = 0
        star.x = Math.random() * canvas.value.width
      }
    })
    bgShapes.forEach(s => {
      s.y += s.speed
      s.rotation += s.rotSpeed
    })
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
    enemy.y += enemy.vy
    if (enemy.movementType === 'sine') {
      enemy.x = enemy.spawnX + Math.sin(enemy.y * 0.02 + enemy.sineOffset) * enemy.sineAmplitude
    } else if (enemy.movementType === 'zigzag') {
      enemy.zigzagTimer += 0.05
      if (Math.sin(enemy.zigzagTimer) > 0.95) enemy.vx = -enemy.vx
      enemy.x += enemy.vx
    }
    enemy.x = Math.max(enemy.size, Math.min(w - enemy.size, enemy.x))
    if (now - enemy.lastShot > enemy.shootCooldown) {
      enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.size / 2, vy: 2.5 + Math.random() * 1.5 })
      enemy.lastShot = now
      enemy.shootCooldown = 800 + Math.random() * 2500
    }
    return enemy.y < h + 40
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
      boss.x = Math.max(boss.size, Math.min(w - boss.size, boss.x))
      boss.y = Math.max(boss.size, Math.min(h * 0.45, boss.y))
    }

    // Boss shooting — fires downward with slight random spread
    if (boss.arrived && now - boss.lastShot > boss.shootCooldown) {
      const spread = (Math.random() - 0.5) * 1.5
      enemyBullets.push({ x: boss.x - 15, y: boss.y + boss.size / 2, vy: 3 + Math.random() * 1.5, vx: spread })
      enemyBullets.push({ x: boss.x + 15, y: boss.y + boss.size / 2, vy: 3 + Math.random() * 1.5, vx: -spread })
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
        spawnParticles(b.x, b.y, boss.color, 5)
        bullets.splice(i, 1)
        bulletConsumed = true
        if (boss.hp <= 0) {
          // Boss killed — shockwave!
          spawnParticles(boss.x, boss.y, boss.color, 25)
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
        spawnParticles(e.x, e.y, e.color, 10)
        enemies.splice(j, 1)
        bullets.splice(i, 1)
        score += 100
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
        spawnParticles(e.x, e.y, e.color, 6)
        score += 100
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
        spawnParticles(b.x, shieldY, '#00ccff', 12)
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
        spawnParticles(player.x, player.y - player.height / 2, '#00ccff', 16)
        spawnParticles(player.x, player.y - player.height / 2, '#ffffff', 8)
        playerGlow = 0.5
      } else {
        bulletLevel++
        playerGlow = 1
        // Bright cyan burst
        spawnParticles(player.x, player.y, '#00ffff', 24)
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
            color: Math.random() < 0.5 ? '#00ffff' : '#ffffff',
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

  // Update stars
  stars.forEach(star => {
    star.y += star.speed
    if (star.y > h) {
      star.y = 0
      star.x = Math.random() * w
    }
  })

  // Update background shapes
  bgShapes = bgShapes.filter(s => {
    s.y += s.speed
    s.rotation += s.rotSpeed
    return s.y < h + s.size
  })
  // Replenish shapes
  while (bgShapes.length < 6) {
    const shape = createBgShape()
    if (shape) bgShapes.push(shape)
  }
}

function draw() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height

  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, w, h)

  // Compute parallax: player moves left → background shifts right (inverted)
  // Smooth interpolation for acceleration/deceleration feel
  const centerX = w / 2
  const targetParallaxX = gameStarted ? -(player.x - centerX) * 0.015 : 0
  smoothParallaxX += (targetParallaxX - smoothParallaxX) * 0.04

  // Stars (with subtle parallax based on star speed as depth proxy)
  stars.forEach(star => {
    const sx = star.x + smoothParallaxX * star.speed * 0.5
    ctx.fillStyle = `rgba(100, 255, 180, ${star.brightness * 0.5})`
    ctx.fillRect(sx, star.y, star.size, star.size)
  })

  // Background geometric shapes (parallax per-shape depth)
  bgShapes.forEach(s => drawBgShape(s, smoothParallaxX))

  // Shockwaves
  shockwaves.forEach(sw => {
    ctx.strokeStyle = `rgba(255, 0, 255, ${sw.life * 0.8})`
    ctx.lineWidth = 4 + sw.life * 8
    ctx.shadowColor = '#ff00ff'
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
    const glowColor = playerGlow > 0 ? `rgba(0, 255, 255, ${playerGlow * 0.6})` : null
    if (glowColor) {
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 25 + playerGlow * 20
    } else {
      ctx.shadowColor = '#00ff41'
      ctx.shadowBlur = 10
    }
    ctx.fillStyle = playerGlow > 0.5 ? '#00ffff' : '#00ff41'
    ctx.beginPath()
    ctx.moveTo(player.x, player.y - player.height / 2)
    ctx.lineTo(player.x + player.width / 2, player.y + player.height / 2)
    ctx.lineTo(player.x + player.width / 4, player.y + player.height / 4)
    ctx.lineTo(player.x - player.width / 4, player.y + player.height / 4)
    ctx.lineTo(player.x - player.width / 2, player.y + player.height / 2)
    ctx.closePath()
    ctx.fill()

    // Extra wing details for the bigger ship
    ctx.fillStyle = playerGlow > 0.5 ? '#00cccc' : '#00cc33'
    ctx.fillRect(player.x - 3, player.y - player.height * 0.1, 6, player.height * 0.4)
    ctx.shadowBlur = 0

    // Shield in front of ship
    if (shield || shieldFlash > 0) {
      const shieldY = player.y - player.height / 2 - 12
      const shieldW = player.width * 1.2
      const shieldAlpha = shield ? 0.7 : shieldFlash * 0.8
      const shieldColor = shield ? '#00ccff' : '#ffffff'
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
    ctx.fillStyle = '#00ff41'
    ctx.shadowColor = '#00ff41'
    ctx.shadowBlur = 6
    bullets.forEach(b => {
      ctx.fillRect(b.x - 2, b.y - 6, 4, 12)
    })
    ctx.shadowBlur = 0
  }

  // Enemies
  enemies.forEach(e => {
    ctx.shadowColor = e.color
    ctx.shadowBlur = 8
    enemyShapes[e.shapeIdx](ctx, e.x, e.y, e.size, e.color)
    ctx.shadowBlur = 0
  })

  // Bosses
  bosses.forEach(boss => {
    // Outer hull
    ctx.shadowColor = boss.color
    ctx.shadowBlur = 15
    ctx.fillStyle = boss.color
    ctx.beginPath()
    ctx.moveTo(boss.x, boss.y - boss.size / 2)
    ctx.lineTo(boss.x + boss.size / 2, boss.y)
    ctx.lineTo(boss.x + boss.size * 0.4, boss.y + boss.size / 3)
    ctx.lineTo(boss.x - boss.size * 0.4, boss.y + boss.size / 3)
    ctx.lineTo(boss.x - boss.size / 2, boss.y)
    ctx.closePath()
    ctx.fill()
    // Inner detail
    ctx.fillStyle = '#220033'
    ctx.beginPath()
    ctx.arc(boss.x, boss.y - boss.size * 0.1, boss.size * 0.2, 0, Math.PI * 2)
    ctx.fill()
    // Wings
    ctx.fillStyle = boss.color
    ctx.fillRect(boss.x - boss.size * 0.6, boss.y - 5, boss.size * 0.2, 10)
    ctx.fillRect(boss.x + boss.size * 0.4, boss.y - 5, boss.size * 0.2, 10)
    ctx.shadowBlur = 0

    // HP bar
    const barW = boss.size * 0.8
    const barH = 4
    const barX = boss.x - barW / 2
    const barY = boss.y - boss.size / 2 - 10
    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barY, barW, barH)
    ctx.fillStyle = '#ff00ff'
    ctx.fillRect(barX, barY, barW * (boss.hp / boss.maxHp), barH)
  })

  // Powerups — larger and glowier
  powerups.forEach(p => {
    const glow = 0.6 + 0.4 * Math.sin(p.pulse)
    const isShield = p.type === 'shield'
    const pColor = isShield ? '#00ccff' : '#00ffff'
    const pColorRgb = isShield ? '0, 200, 255' : '0, 255, 255'
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
    ctx.fillStyle = '#0a0a0a'
    ctx.font = `bold ${p.size * 0.55}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(isShield ? 'S' : 'P', 0, 1)
    ctx.restore()
    ctx.shadowBlur = 0
  })

  // Enemy bullets
  ctx.fillStyle = '#ff0055'
  ctx.shadowColor = '#ff0055'
  ctx.shadowBlur = 6
  enemyBullets.forEach(b => {
    ctx.fillRect(b.x - 2, b.y - 4, 4, 8)
  })
  ctx.shadowBlur = 0

  // Death explosion screen flash
  if (deathExplosion && deathExplosion.flash > 0) {
    ctx.fillStyle = `rgba(255, 150, 50, ${deathExplosion.flash * 0.4})`
    ctx.fillRect(0, 0, w, h)
  }
}

function gameLoop(now) {
  if (!gameRunning) return
  update(now)
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

function handleTouchStart(e) {
  if (isInteractiveElement(e.target)) return
  if (!gameStarted) {
    resetGame()
    return
  }
  if (gameOver) {
    resetGame()
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

function handleTouchEnd() {
  touchActive = false
  keys['Space'] = false
}

onMounted(() => {
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
