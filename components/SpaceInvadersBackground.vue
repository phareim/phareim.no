<template>
  <canvas ref="canvas"></canvas>
</template>

<script setup>
const emit = defineEmits(['score', 'death', 'restart'])

const canvas = ref(null)
let ctx = null
let animationFrameId = null
let gameRunning = false

// Game state
let player = { x: 0, y: 0, width: 30, height: 24, speed: 5 }
let bullets = []
let enemyBullets = []
let enemies = []
let stars = []
let particles = []
let powerups = []
let score = 0
let gameOver = false
let keys = {}
let lastShotTime = 0
let waveTimer = 0
let waveInterval = 2500
let bulletLevel = 1
let powerupTimer = 0
let powerupInterval = 12000

// Enemy shapes as pixel-art style draw functions
const enemyShapes = [
  // Classic invader
  (ctx, x, y, size, color) => {
    ctx.fillStyle = color
    const s = size / 8
    // Body
    ctx.fillRect(x - 3 * s, y - s, 6 * s, 2 * s)
    ctx.fillRect(x - 4 * s, y - 2 * s, 8 * s, s)
    ctx.fillRect(x - 2 * s, y - 3 * s, 4 * s, s)
    // Legs
    ctx.fillRect(x - 4 * s, y + s, 2 * s, s)
    ctx.fillRect(x + 2 * s, y + s, 2 * s, s)
    // Eyes
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
    // Claws
    ctx.fillRect(x - 5 * s, y - s, 2 * s, 2 * s)
    ctx.fillRect(x + 3 * s, y - s, 2 * s, 2 * s)
    // Feet
    ctx.fillRect(x - 3 * s, y + s, s, s)
    ctx.fillRect(x + 2 * s, y + s, s, s)
    // Eyes
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
    // Eyes
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
  const count = 80
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.value.width,
      y: Math.random() * canvas.value.height,
      speed: 0.3 + Math.random() * 1.5,
      size: Math.random() < 0.3 ? 2 : 1,
      brightness: 0.3 + Math.random() * 0.7
    })
  }
}

function resetGame() {
  if (!canvas.value) return
  player.x = canvas.value.width / 2
  player.y = canvas.value.height - 60
  bullets = []
  enemyBullets = []
  enemies = []
  powerups = []
  particles = []
  score = 0
  gameOver = false
  waveTimer = 0
  bulletLevel = 1
  powerupTimer = 0
  waveInterval = 2500
  emit('restart')
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
      case 0: // Straight down
        x = 40 + (i / (count - 1 || 1)) * (w - 80)
        y = -20 - i * 30
        vx = 0
        vy = baseSpeed
        movementType = 'straight'
        break
      case 1: // Sine wave
        x = 40 + (i / (count - 1 || 1)) * (w - 80)
        y = -20 - i * 35
        vx = 0
        vy = baseSpeed
        movementType = 'sine'
        break
      case 2: // V-formation
        x = w / 2 + (i - count / 2) * 45
        y = -20 - Math.abs(i - count / 2) * 30
        vx = 0
        vy = baseSpeed
        movementType = 'straight'
        break
      case 3: // Zigzag
        x = 40 + (i / (count - 1 || 1)) * (w - 80)
        y = -20 - i * 25
        vx = (Math.random() < 0.5 ? 1 : -1) * 1.5
        vy = baseSpeed * 0.7
        movementType = 'zigzag'
        break
    }

    enemies.push({
      x, y, vx, vy, size, color,
      shapeIdx,
      movementType,
      sineOffset: Math.random() * Math.PI * 2,
      sineAmplitude: 40 + Math.random() * 60,
      zigzagTimer: Math.random() * 100,
      hp: 1,
      shootCooldown: 1000 + Math.random() * 3000,
      lastShot: Date.now() + Math.random() * 2000,
      spawnX: x
    })
  }
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

function update(now) {
  if (!canvas.value || gameOver) return
  const w = canvas.value.width
  const h = canvas.value.height

  // Player movement
  if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed
  if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed
  if (keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed
  if (keys['ArrowDown'] || keys['KeyS']) player.y += player.speed
  player.x = Math.max(player.width / 2, Math.min(w - player.width / 2, player.x))
  player.y = Math.max(player.height, Math.min(h - player.height / 2, player.y))

  // Shooting — fan of bullets based on bulletLevel
  if (keys['Space'] && now - lastShotTime > 180) {
    const n = bulletLevel
    const bulletSpeed = 7
    if (n === 1) {
      bullets.push({ x: player.x, y: player.y - player.height / 2, vx: 0, vy: -bulletSpeed })
    } else {
      // Spread angle grows with level: 10° per extra bullet, max 70°
      const totalSpread = Math.min(n * 10, 70) * (Math.PI / 180)
      for (let i = 0; i < n; i++) {
        const angle = -Math.PI / 2 + (i / (n - 1) - 0.5) * totalSpread
        bullets.push({
          x: player.x,
          y: player.y - player.height / 2,
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
    // Gradually speed up waves
    waveInterval = Math.max(1200, waveInterval - 30)
  }

  // Update enemies
  enemies = enemies.filter(enemy => {
    enemy.y += enemy.vy

    if (enemy.movementType === 'sine') {
      enemy.x = enemy.spawnX + Math.sin(enemy.y * 0.02 + enemy.sineOffset) * enemy.sineAmplitude
    } else if (enemy.movementType === 'zigzag') {
      enemy.zigzagTimer += 0.05
      if (Math.sin(enemy.zigzagTimer) > 0.95) {
        enemy.vx = -enemy.vx
      }
      enemy.x += enemy.vx
    }

    // Clamp to screen
    enemy.x = Math.max(enemy.size, Math.min(w - enemy.size, enemy.x))

    // Enemy shooting
    if (now - enemy.lastShot > enemy.shootCooldown) {
      enemyBullets.push({ x: enemy.x, y: enemy.y + enemy.size / 2, vy: 2.5 + Math.random() * 1.5 })
      enemy.lastShot = now
      enemy.shootCooldown = 800 + Math.random() * 2500
    }

    return enemy.y < h + 40
  })

  // Bullet-enemy collisions
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
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

  // Enemy bullet-player collision
  for (const b of enemyBullets) {
    const dx = b.x - player.x
    const dy = b.y - player.y
    if (dx * dx + dy * dy < (player.width / 2 + 3) * (player.width / 2 + 3)) {
      gameOver = true
      spawnParticles(player.x, player.y, '#00ff41', 20)
      emit('death')
      return
    }
  }

  // Enemy-player collision
  for (const e of enemies) {
    const dx = e.x - player.x
    const dy = e.y - player.y
    if (dx * dx + dy * dy < (e.size / 2 + player.width / 2) * (e.size / 2 + player.width / 2)) {
      gameOver = true
      spawnParticles(player.x, player.y, '#00ff41', 20)
      emit('death')
      return
    }
  }

  // Powerup spawning
  if (now - powerupTimer > powerupInterval) {
    powerups.push({
      x: 40 + Math.random() * (w - 80),
      y: -15,
      vy: 1.2,
      size: 18,
      pulse: 0
    })
    powerupTimer = now
  }

  // Update powerups and check collection
  powerups = powerups.filter(p => {
    p.y += p.vy
    p.pulse += 0.08
    const dx = p.x - player.x
    const dy = p.y - player.y
    if (dx * dx + dy * dy < (p.size / 2 + player.width / 2) * (p.size / 2 + player.width / 2)) {
      bulletLevel++
      spawnParticles(p.x, p.y, '#00ffff', 12)
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
}

function draw() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height

  // Clear
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, w, h)

  // Stars
  stars.forEach(star => {
    ctx.fillStyle = `rgba(100, 255, 180, ${star.brightness * 0.5})`
    ctx.fillRect(star.x, star.y, star.size, star.size)
  })

  // Particles
  particles.forEach(p => {
    ctx.globalAlpha = p.life
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  })
  ctx.globalAlpha = 1

  if (!gameOver) {
    // Player ship
    ctx.fillStyle = '#00ff41'
    ctx.shadowColor = '#00ff41'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.moveTo(player.x, player.y - player.height / 2)
    ctx.lineTo(player.x + player.width / 2, player.y + player.height / 2)
    ctx.lineTo(player.x + player.width / 4, player.y + player.height / 4)
    ctx.lineTo(player.x - player.width / 4, player.y + player.height / 4)
    ctx.lineTo(player.x - player.width / 2, player.y + player.height / 2)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

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

  // Powerups
  powerups.forEach(p => {
    const glow = 0.6 + 0.4 * Math.sin(p.pulse)
    ctx.shadowColor = '#00ffff'
    ctx.shadowBlur = 12 * glow
    // Draw a rotating "P" badge
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.pulse * 0.5)
    // Diamond shape
    ctx.fillStyle = `rgba(0, 255, 255, ${0.7 + 0.3 * glow})`
    ctx.beginPath()
    const s = p.size / 2
    ctx.moveTo(0, -s)
    ctx.lineTo(s, 0)
    ctx.lineTo(0, s)
    ctx.lineTo(-s, 0)
    ctx.closePath()
    ctx.fill()
    // "P" letter
    ctx.fillStyle = '#0a0a0a'
    ctx.font = `bold ${p.size * 0.7}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('P', 0, 1)
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
  if (gameOver) {
    resetGame()
  }
}

function handleKeyUp(e) {
  keys[e.code] = false
}

function handleResize() {
  setupCanvas()
  initStars()
}

// Touch controls
let touchActive = false
const TOUCH_Y_OFFSET = 80 // ship appears above finger so it's visible

function isInteractiveElement(el) {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return true
  if (el.closest('a, button, .social-links, .profile-card')) return true
  return false
}

function handleTouchStart(e) {
  if (isInteractiveElement(e.target)) return // let links/buttons work
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
  resetGame()
  gameRunning = true
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
