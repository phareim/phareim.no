<template>
  <canvas ref="canvas"></canvas>
</template>

<script setup>
const emit = defineEmits(['score', 'death', 'restart', 'started'])

const canvas = ref(null)
let ctx = null
let animationFrameId = null

// Canvas dimensions
let W = 0
let H = 0

// Tile size - bigger for more visual impact
const TILE = 58

// ---- Sprite loading ----
const sprites = {}
const spriteFiles = [
  'tile1', 'tile2', 'tile3', 'tile5', 'tile7', 'tile10',
  'fruit1', 'fruit2', 'fruit3', 'fruit4',
  'spike', 'rock1', 'plant1', 'plant3', 'sign1'
]
let spritesLoaded = false

function loadSprites() {
  let loaded = 0
  const total = spriteFiles.length
  spriteFiles.forEach(name => {
    const img = new Image()
    img.onload = () => {
      loaded++
      if (loaded === total) spritesLoaded = true
    }
    img.src = `/game/${name}.png`
    sprites[name] = img
  })
}

// ---- Character sprite system ----
const characters = {
  redhat: {
    idle: { count: 10, frames: [] },
    run: { count: 8, frames: [] },
    jump: { count: 12, frames: [] },
    dead: { count: 10, frames: [] }
  },
  flatboy: {
    idle: { count: 15, frames: [] },
    run: { count: 15, frames: [] },
    jump: { count: 15, frames: [] },
    dead: { count: 15, frames: [] }
  }
}

let activeCharacter = 'redhat'
let charSpritesLoaded = false

function loadCharacterSprites() {
  let loaded = 0
  let total = 0

  // Count total frames
  for (const [charName, anims] of Object.entries(characters)) {
    for (const [animName, animData] of Object.entries(anims)) {
      total += animData.count
    }
  }

  for (const [charName, anims] of Object.entries(characters)) {
    for (const [animName, animData] of Object.entries(anims)) {
      animData.frames = []
      for (let i = 1; i <= animData.count; i++) {
        const img = new Image()
        img.onload = () => {
          loaded++
          if (loaded >= total) charSpritesLoaded = true
        }
        img.onerror = () => {
          loaded++
          if (loaded >= total) charSpritesLoaded = true
        }
        img.src = `/game/${charName}/${animName}_(${i}).png`
        animData.frames.push(img)
      }
    }
  }
}

// ---- Game state ----
const PLAYER_W = TILE * 0.9
const PLAYER_H = TILE * 1.1

let player = { x: 0, y: 0, width: PLAYER_W, height: PLAYER_H, vy: 0, vx: 0, grounded: false, speed: 5, facing: 1, animFrame: 0, animTimer: 0, state: 'idle' }
let platforms = []
let decorations = []
let enemies = []
let fruits = []
let spikes = []
let particles = []
let clouds = []
let hills = []
let score = 0
let gameOver = false
let gameStarted = false
let keys = {}
let cameraX = 0
let groundY = 0
let spawnTimer = 0
let fruitTimer = 0
let platformTimer = 0
let spikeTimer = 0
let decorTimer = 0
let distance = 0

// Colors
const SKY_TOP = '#5c94fc'
const SKY_BOTTOM = '#87ceeb'

// Fruit types for collectibles
const fruitTypes = ['fruit1', 'fruit2', 'fruit3', 'fruit4']

// Cloud layer for parallax
function initClouds() {
  clouds = []
  for (let i = 0; i < 14; i++) {
    clouds.push({
      x: Math.random() * W * 3,
      y: 30 + Math.random() * (H * 0.35),
      width: 70 + Math.random() * 120,
      speed: 0.15 + Math.random() * 0.25,
      layer: Math.random() > 0.5 ? 0 : 1
    })
  }
}

// Background hills for parallax
function initHills() {
  hills = []
  for (let i = 0; i < 20; i++) {
    hills.push({
      x: i * 300 + Math.random() * 100,
      width: 220 + Math.random() * 220,
      height: 70 + Math.random() * 90,
      color: i % 3 === 0 ? '#2d8b2d' : i % 3 === 1 ? '#3aa03a' : '#34963a',
      layer: Math.random() > 0.5 ? 0 : 1
    })
  }
}

// Initialize ground and starting platforms
function initPlatforms() {
  platforms = []
  decorations = []
  for (let x = -200; x < W * 3; x += TILE) {
    platforms.push({ x, y: groundY, width: TILE, height: TILE, type: 'groundTop' })
    platforms.push({ x, y: groundY + TILE, width: TILE, height: TILE, type: 'groundFill' })
  }
  addFloatingPlatform(280, groundY - TILE * 2.5, 3)
  addFloatingPlatform(550, groundY - TILE * 3.5, 2)
}

function addFloatingPlatform(baseX, y, count) {
  for (let i = 0; i < count; i++) {
    let type = 'platformMid'
    if (count === 1) type = 'platformSingle'
    else if (i === 0) type = 'platformLeft'
    else if (i === count - 1) type = 'platformRight'
    platforms.push({ x: baseX + i * TILE, y, width: TILE, height: TILE, type })
  }
}

function spawnPlatformCluster() {
  const baseX = cameraX + W + 100 + Math.random() * 300
  const baseY = groundY - TILE * (2 + Math.random() * 2.5)
  const count = 1 + Math.floor(Math.random() * 4)
  addFloatingPlatform(baseX, baseY, count)
}

function spawnEnemy() {
  const x = cameraX + W + 50
  enemies.push({
    x,
    y: groundY - TILE * 0.65,
    width: TILE * 0.65,
    height: TILE * 0.65,
    vx: -(1.2 + Math.random() * 0.8),
    frame: 0,
    frameTimer: 0,
    alive: true
  })
}

function spawnFruit() {
  const x = cameraX + W + 50 + Math.random() * 300
  const y = groundY - TILE * (1.5 + Math.random() * 3)
  const type = fruitTypes[Math.floor(Math.random() * fruitTypes.length)]
  fruits.push({ x, y, width: 32, height: 32, type, bobOffset: Math.random() * Math.PI * 2 })
}

function spawnSpike() {
  const x = cameraX + W + 200 + Math.random() * 400
  spikes.push({ x, y: groundY - TILE * 0.55, width: TILE * 0.8, height: TILE * 0.55 })
}

function spawnDecoration() {
  const x = cameraX + W + Math.random() * 500
  const types = ['plant1', 'plant3', 'rock1', 'sign1']
  const type = types[Math.floor(Math.random() * types.length)]
  const size = type === 'rock1' ? TILE * 0.7 : type === 'sign1' ? TILE * 0.65 : TILE * 0.55
  decorations.push({ x, y: groundY - size, width: size * (type === 'rock1' ? 1.4 : 1), height: size, type })
}

function addParticle(x, y, color) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 7,
      vy: -Math.random() * 6 - 2,
      life: 30 + Math.random() * 20,
      color,
      size: 3 + Math.random() * 5
    })
  }
}

// ---- Drawing functions ----

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H)
  gradient.addColorStop(0, SKY_TOP)
  gradient.addColorStop(0.65, SKY_BOTTOM)
  gradient.addColorStop(1, '#a8d8a8')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)

  // Sun
  ctx.save()
  ctx.fillStyle = '#fff7a0'
  ctx.shadowColor = '#fbd000'
  ctx.shadowBlur = 50
  ctx.beginPath()
  ctx.arc(W - 120, 90, 45, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawCloud(cloud) {
  const x = cloud.x - cameraX * (cloud.layer === 0 ? 0.1 : 0.2)
  const y = cloud.y
  const w = cloud.width
  ctx.fillStyle = cloud.layer === 0 ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(x, y, w * 0.22, 0, Math.PI * 2)
  ctx.arc(x + w * 0.18, y - w * 0.1, w * 0.28, 0, Math.PI * 2)
  ctx.arc(x + w * 0.4, y - w * 0.05, w * 0.24, 0, Math.PI * 2)
  ctx.arc(x + w * 0.55, y, w * 0.2, 0, Math.PI * 2)
  ctx.arc(x + w * 0.2, y + w * 0.06, w * 0.18, 0, Math.PI * 2)
  ctx.arc(x + w * 0.38, y + w * 0.06, w * 0.16, 0, Math.PI * 2)
  ctx.fill()
}

function drawHill(hill) {
  const parallax = hill.layer === 0 ? 0.15 : 0.3
  const x = hill.x - cameraX * parallax
  ctx.fillStyle = hill.color
  ctx.beginPath()
  ctx.moveTo(x - hill.width / 2, groundY)
  ctx.quadraticCurveTo(x, groundY - hill.height, x + hill.width / 2, groundY)
  ctx.closePath()
  ctx.fill()
}

function drawSprite(spriteName, x, y, w, h) {
  const img = sprites[spriteName]
  if (img && spritesLoaded) {
    ctx.drawImage(img, x, y, w, h)
  }
}

function drawBlock(p) {
  const x = p.x - cameraX
  const y = p.y
  if (x < -TILE * 2 || x > W + TILE * 2) return

  if (p.type === 'groundTop') {
    drawSprite('tile2', x, y, TILE, TILE)
  } else if (p.type === 'groundFill') {
    drawSprite('tile10', x, y, TILE, TILE)
  } else if (p.type === 'platformLeft') {
    drawSprite('tile1', x, y, TILE, TILE)
  } else if (p.type === 'platformMid') {
    drawSprite('tile3', x, y, TILE, TILE)
  } else if (p.type === 'platformRight') {
    drawSprite('tile5', x, y, TILE, TILE)
  } else if (p.type === 'platformSingle') {
    drawSprite('tile2', x, y, TILE, TILE)
  }
}

function drawDecoration(d) {
  const x = d.x - cameraX
  if (x < -TILE * 2 || x > W + TILE * 2) return
  drawSprite(d.type, x, d.y, d.width, d.height)
}

function drawPlayer() {
  if (!charSpritesLoaded) return

  const x = player.x - cameraX
  const y = player.y
  const w = player.width
  const h = player.height

  const charData = characters[activeCharacter]
  const anim = charData[player.state]
  if (!anim || !anim.frames.length) return

  const frame = anim.frames[player.animFrame % anim.frames.length]
  if (!frame || !frame.complete) return

  ctx.save()

  // Flip if facing left
  if (player.facing < 0) {
    ctx.translate(x + w / 2, 0)
    ctx.scale(-1, 1)
    ctx.translate(-(x + w / 2), 0)
  }

  // Draw the sprite frame, slightly larger than hitbox for visual appeal
  const drawW = w * 1.6
  const drawH = h * 1.4
  const drawX = x - (drawW - w) / 2
  const drawY = y - (drawH - h) + h * 0.05
  ctx.drawImage(frame, drawX, drawY, drawW, drawH)

  ctx.restore()
}

function drawEnemy(e) {
  const x = e.x - cameraX
  const y = e.y
  if (x < -TILE || x > W + TILE) return

  const w = e.width
  const h = e.height
  const wobble = Math.sin(Date.now() * 0.005 + e.x) * 2

  // Body - mushroom/goomba style
  ctx.fillStyle = '#8B4513'
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h * 0.35, w * 0.52, Math.PI, 0)
  ctx.fill()
  ctx.fillRect(x + w * 0.08, y + h * 0.35, w * 0.84, h * 0.4)

  // Darker cap
  ctx.fillStyle = '#6B3410'
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h * 0.25, w * 0.57, Math.PI + 0.3, -0.3)
  ctx.fill()

  // Eyes - angry
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + w * 0.18, y + h * 0.28, w * 0.22, h * 0.2)
  ctx.fillRect(x + w * 0.58, y + h * 0.28, w * 0.22, h * 0.2)
  ctx.fillStyle = '#000'
  ctx.fillRect(x + w * 0.25, y + h * 0.32, w * 0.12, h * 0.14)
  ctx.fillRect(x + w * 0.62, y + h * 0.32, w * 0.12, h * 0.14)
  // Angry eyebrows
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.translate(x + w * 0.28, y + h * 0.24)
  ctx.rotate(-0.3)
  ctx.fillRect(0, 0, w * 0.2, h * 0.05)
  ctx.restore()
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.translate(x + w * 0.72, y + h * 0.24)
  ctx.rotate(0.3)
  ctx.fillRect(-w * 0.2, 0, w * 0.2, h * 0.05)
  ctx.restore()

  // Feet
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(x + w * 0.05, y + h * 0.7 + wobble, w * 0.3, h * 0.3)
  ctx.fillRect(x + w * 0.6, y + h * 0.7 - wobble, w * 0.3, h * 0.3)
}

function drawFruit(f, time) {
  const x = f.x - cameraX
  const bob = Math.sin(time * 0.003 + f.bobOffset) * 4
  const y = f.y + bob
  if (x < -TILE || x > W + TILE) return

  ctx.save()
  ctx.shadowColor = '#fbd000'
  ctx.shadowBlur = 10
  drawSprite(f.type, x, y, f.width, f.height)
  ctx.restore()
}

function drawSpikeObj(s) {
  const x = s.x - cameraX
  if (x < -TILE || x > W + TILE) return
  drawSprite('spike', x, s.y, s.width, s.height)
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life / 50
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x - cameraX, p.y, p.size / 2, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.globalAlpha = 1
}

function drawScore() {
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.font = '16px "Press Start 2P", monospace'
  ctx.textAlign = 'left'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 2
  ctx.fillText(`SCORE  ${score}`, 20, 34)
  ctx.fillText(`DIST   ${Math.floor(distance)}m`, 20, 58)
  ctx.restore()
}

// ---- Update functions ----

function updatePlayer(dt) {
  // Determine movement state
  player.vx = 0
  if (keys['ArrowLeft'] || keys['KeyA']) {
    player.vx = -player.speed
    player.facing = -1
  }
  if (keys['ArrowRight'] || keys['KeyD']) {
    player.vx = player.speed
    player.facing = 1
  }
  player.x += player.vx

  // Jump
  if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && player.grounded) {
    player.vy = -12
    player.grounded = false
  }

  // Gravity
  player.vy += 0.55
  if (player.vy > 16) player.vy = 16
  player.y += player.vy

  // Prevent going too far left
  if (player.x < cameraX - 10) {
    player.x = cameraX - 10
  }

  // Platform collision (top only)
  player.grounded = false
  platforms.forEach(p => {
    if (
      player.x + player.width > p.x + 4 &&
      player.x < p.x + p.width - 4 &&
      player.y + player.height > p.y &&
      player.y + player.height < p.y + p.height / 2 + player.vy + 2 &&
      player.vy >= 0
    ) {
      player.y = p.y - player.height
      player.vy = 0
      player.grounded = true
    }
  })

  // Spike collision
  spikes.forEach(s => {
    if (
      player.x + player.width > s.x + 6 &&
      player.x < s.x + s.width - 6 &&
      player.y + player.height > s.y + 6
    ) {
      onDeath()
    }
  })

  // Fall off screen
  if (player.y > H + 50) {
    onDeath()
  }

  // Camera follows player
  const targetCameraX = player.x - W * 0.35
  if (targetCameraX > cameraX) {
    cameraX += (targetCameraX - cameraX) * 0.08
  }

  distance = Math.max(distance, (player.x - W * 0.35) / TILE)

  // Animation state machine
  let newState = 'idle'
  if (!player.grounded) {
    newState = 'jump'
  } else if (Math.abs(player.vx) > 0.5) {
    newState = 'run'
  }

  if (newState !== player.state) {
    player.state = newState
    player.animFrame = 0
    player.animTimer = 0
  }

  // Advance animation frame
  player.animTimer += dt
  const animSpeed = player.state === 'run' ? 50 : player.state === 'jump' ? 60 : 80
  if (player.animTimer > animSpeed) {
    player.animTimer = 0
    player.animFrame++
    const charData = characters[activeCharacter]
    const anim = charData[player.state]
    if (anim) {
      player.animFrame = player.animFrame % anim.count
    }
  }
}

function updateEnemies() {
  enemies.forEach(e => {
    if (!e.alive) return
    e.x += e.vx

    // Player collision
    if (
      player.x + player.width > e.x + 6 &&
      player.x < e.x + e.width - 6 &&
      player.y + player.height > e.y + 4 &&
      player.y < e.y + e.height
    ) {
      if (player.vy > 0 && player.y + player.height < e.y + e.height * 0.5) {
        // Stomp!
        e.alive = false
        player.vy = -10
        score += 100
        emit('score', score)
        addParticle(e.x + e.width / 2, e.y, '#fbd000')
        addParticle(e.x + e.width / 2, e.y, '#ff6b00')
      } else {
        onDeath()
      }
    }

    if (e.x < cameraX - 200) {
      e.alive = false
    }
  })
  enemies = enemies.filter(e => e.alive)
}

function updateFruits() {
  fruits = fruits.filter(f => {
    const dx = player.x + player.width / 2 - (f.x + f.width / 2)
    const dy = player.y + player.height / 2 - (f.y + f.height / 2)
    if (Math.abs(dx) < 24 && Math.abs(dy) < 28) {
      score += 50
      emit('score', score)
      addParticle(f.x + f.width / 2, f.y, '#ff4444')
      addParticle(f.x + f.width / 2, f.y, '#fbd000')
      return false
    }
    return f.x > cameraX - 200
  })
}

function updateParticles() {
  particles.forEach(p => {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.2
    p.life--
  })
  particles = particles.filter(p => p.life > 0)
}

function updateSpawning(dt) {
  spawnTimer += dt
  fruitTimer += dt
  platformTimer += dt
  spikeTimer += dt
  decorTimer += dt

  if (spawnTimer > 2500 + Math.random() * 2000) {
    spawnEnemy()
    spawnTimer = 0
  }
  if (fruitTimer > 1200 + Math.random() * 1500) {
    spawnFruit()
    fruitTimer = 0
  }
  if (platformTimer > 1500 + Math.random() * 2000) {
    spawnPlatformCluster()
    platformTimer = 0
  }
  if (spikeTimer > 5000 + Math.random() * 5000) {
    spawnSpike()
    spikeTimer = 0
  }
  if (decorTimer > 2000 + Math.random() * 3000) {
    spawnDecoration()
    decorTimer = 0
  }

  // Extend ground ahead of camera
  const groundPlatforms = platforms.filter(p => p.type === 'groundTop')
  const maxGroundX = groundPlatforms.length > 0 ? Math.max(...groundPlatforms.map(p => p.x)) : 0
  if (maxGroundX < cameraX + W + 300) {
    const gap = Math.random() > 0.88
    const startX = maxGroundX + TILE
    const gapSize = gap ? TILE * 2 + Math.random() * TILE * 2 : 0
    for (let x = startX + gapSize; x < startX + gapSize + TILE * 10; x += TILE) {
      platforms.push({ x, y: groundY, width: TILE, height: TILE, type: 'groundTop' })
      platforms.push({ x, y: groundY + TILE, width: TILE, height: TILE, type: 'groundFill' })
    }
  }

  // Cleanup far off-screen objects
  platforms = platforms.filter(p => p.x > cameraX - TILE * 8)
  decorations = decorations.filter(d => d.x > cameraX - TILE * 4)
  spikes = spikes.filter(s => s.x > cameraX - TILE * 4)
}

function onDeath() {
  if (gameOver) return
  gameOver = true
  player.state = 'dead'
  player.animFrame = 0
  player.animTimer = 0
  emit('death')
}

function resetGame() {
  player = { x: 100, y: groundY - PLAYER_H, width: PLAYER_W, height: PLAYER_H, vy: 0, vx: 0, grounded: false, speed: 5, facing: 1, animFrame: 0, animTimer: 0, state: 'idle' }
  enemies = []
  fruits = []
  spikes = []
  particles = []
  decorations = []
  cameraX = 0
  score = 0
  distance = 0
  spawnTimer = 0
  fruitTimer = 0
  platformTimer = 0
  spikeTimer = 0
  decorTimer = 0
  gameOver = false
  initPlatforms()
  emit('score', 0)
  emit('restart')
}

// ---- Main loop ----

let lastTime = 0

function gameLoop(timestamp) {
  if (!canvas.value) return
  animationFrameId = requestAnimationFrame(gameLoop)

  const dt = lastTime ? Math.min(timestamp - lastTime, 50) : 16
  lastTime = timestamp

  // Draw sky
  drawSky()

  // Parallax hills (back layer)
  hills.filter(h => h.layer === 0).forEach(drawHill)
  // Parallax clouds (back layer)
  clouds.filter(c => c.layer === 0).forEach(drawCloud)
  // Parallax hills (front layer)
  hills.filter(h => h.layer === 1).forEach(drawHill)
  // Parallax clouds (front layer)
  clouds.filter(c => c.layer === 1).forEach(drawCloud)

  if (gameStarted && !gameOver) {
    updatePlayer(dt)
    updateEnemies()
    updateFruits()
    updateParticles()
    updateSpawning(dt)
  }

  // Draw decorations (behind platforms)
  decorations.forEach(drawDecoration)

  // Draw world
  platforms.forEach(drawBlock)
  spikes.forEach(drawSpikeObj)
  fruits.forEach(f => drawFruit(f, timestamp))
  enemies.forEach(drawEnemy)

  if (gameStarted) {
    drawPlayer()
    drawParticles()
    drawScore()
  }

  // Move clouds
  clouds.forEach(c => {
    c.x += c.speed
    if (c.x - cameraX * (c.layer === 0 ? 0.1 : 0.2) > W + 300) {
      c.x = cameraX * (c.layer === 0 ? 0.1 : 0.2) - 200
      c.y = 30 + Math.random() * (H * 0.35)
    }
  })
}

function startGame() {
  if (gameStarted && !gameOver) return
  if (gameOver) {
    resetGame()
  }
  // Pick random character each session
  activeCharacter = Math.random() > 0.5 ? 'redhat' : 'flatboy'
  gameStarted = true
  player.x = 100
  player.y = groundY - player.height
  emit('started')
}

function handleKeyDown(e) {
  keys[e.code] = true
  if (e.code === 'Enter') {
    e.preventDefault()
    startGame()
  }
}

function handleKeyUp(e) {
  keys[e.code] = false
}

// Touch controls
let touchStartX = 0
let touchActive = false

function handleTouchStart(e) {
  if (!gameStarted || gameOver) {
    startGame()
    return
  }
  touchActive = true
  touchStartX = e.touches[0].clientX
  if (e.touches[0].clientY < H * 0.5) {
    keys['Space'] = true
  }
}

function handleTouchMove(e) {
  if (!touchActive) return
  const x = e.touches[0].clientX
  const diff = x - touchStartX
  keys['ArrowLeft'] = diff < -20
  keys['ArrowRight'] = diff > 20
  if (e.touches[0].clientY < H * 0.4) {
    keys['Space'] = true
  }
}

function handleTouchEnd() {
  touchActive = false
  keys['ArrowLeft'] = false
  keys['ArrowRight'] = false
  keys['Space'] = false
}

function resize() {
  if (!canvas.value) return
  W = canvas.value.offsetWidth
  H = canvas.value.offsetHeight
  canvas.value.width = W
  canvas.value.height = H
  groundY = H - TILE * 1.5
  player.y = Math.min(player.y, groundY - player.height)
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  ctx.imageSmoothingEnabled = true

  loadSprites()
  loadCharacterSprites()
  resize()
  groundY = H - TILE * 1.5
  player.x = 100
  player.y = groundY - player.height

  initClouds()
  initHills()
  initPlatforms()

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', resize)
  canvas.value.addEventListener('touchstart', handleTouchStart, { passive: true })
  canvas.value.addEventListener('touchmove', handleTouchMove, { passive: true })
  canvas.value.addEventListener('touchend', handleTouchEnd)

  animationFrameId = requestAnimationFrame(gameLoop)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', resize)
  if (canvas.value) {
    canvas.value.removeEventListener('touchstart', handleTouchStart)
    canvas.value.removeEventListener('touchmove', handleTouchMove)
    canvas.value.removeEventListener('touchend', handleTouchEnd)
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>

<style scoped>
canvas {
  width: 100vw;
  height: 100vh;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}
</style>
