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

// Tile size - big and chunky
const TILE = 68

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
    img.onload = () => { loaded++; if (loaded === total) spritesLoaded = true }
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
  for (const anims of Object.values(characters)) {
    for (const animData of Object.values(anims)) total += animData.count
  }
  for (const [charName, anims] of Object.entries(characters)) {
    for (const [animName, animData] of Object.entries(anims)) {
      animData.frames = []
      for (let i = 1; i <= animData.count; i++) {
        const img = new Image()
        img.onload = img.onerror = () => { loaded++; if (loaded >= total) charSpritesLoaded = true }
        img.src = `/game/${charName}/${animName}_(${i}).png`
        animData.frames.push(img)
      }
    }
  }
}

// ---- Game state ----
const PLAYER_W = TILE * 0.9
const PLAYER_H = TILE * 1.1

let player = { x: 0, y: 0, width: PLAYER_W, height: PLAYER_H, vy: 0, vx: 0, grounded: false, speed: 5.5, facing: 1, animFrame: 0, animTimer: 0, state: 'idle', invincible: 0, coins: 0 }
let platforms = []
let decorations = []
let enemies = []
let fruits = []
let spikes = []
let particles = []
let floatingTexts = []
let springs = []
let movingPlatforms = []

// Parallax layers
let bgMountains = []
let bgTrees = []
let bgBushes = []
let clouds = []
let birds = []

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
let springTimer = 0
let movPlatTimer = 0
let distance = 0
let difficulty = 1 // increases over time

const SKY_TOP = '#4a8ae6'
const SKY_BOTTOM = '#87ceeb'
const fruitTypes = ['fruit1', 'fruit2', 'fruit3', 'fruit4']

// ---- Parallax background init ----

function initBgMountains() {
  bgMountains = []
  for (let i = 0; i < 12; i++) {
    bgMountains.push({
      x: i * 500 + Math.random() * 200 - 500,
      width: 350 + Math.random() * 300,
      height: 120 + Math.random() * 100,
      color: ['#5a7a5a', '#4a6a4a', '#6a8a6a', '#3d5c3d'][Math.floor(Math.random() * 4)],
      snow: Math.random() > 0.5
    })
  }
}

function initBgTrees() {
  bgTrees = []
  for (let i = 0; i < 30; i++) {
    bgTrees.push({
      x: i * 180 + Math.random() * 80 - 300,
      height: 50 + Math.random() * 60,
      width: 30 + Math.random() * 25,
      shade: Math.random() * 0.3
    })
  }
}

function initBgBushes() {
  bgBushes = []
  for (let i = 0; i < 40; i++) {
    bgBushes.push({
      x: i * 130 + Math.random() * 60 - 200,
      width: 40 + Math.random() * 50,
      height: 20 + Math.random() * 25
    })
  }
}

function initClouds() {
  clouds = []
  for (let i = 0; i < 16; i++) {
    clouds.push({
      x: Math.random() * W * 3 - W,
      y: 20 + Math.random() * (H * 0.3),
      width: 80 + Math.random() * 140,
      speed: 0.1 + Math.random() * 0.3,
      layer: i < 6 ? 0 : i < 11 ? 1 : 2
    })
  }
}

function initBirds() {
  birds = []
  for (let i = 0; i < 5; i++) {
    birds.push({
      x: Math.random() * W * 2,
      y: 40 + Math.random() * H * 0.25,
      speed: 0.8 + Math.random() * 1.2,
      wingPhase: Math.random() * Math.PI * 2,
      size: 4 + Math.random() * 4
    })
  }
}

// ---- Init world ----

function initPlatforms() {
  platforms = []
  decorations = []
  springs = []
  movingPlatforms = []
  for (let x = -200; x < W * 3; x += TILE) {
    platforms.push({ x, y: groundY, width: TILE, height: TILE, type: 'groundTop' })
    platforms.push({ x, y: groundY + TILE, width: TILE, height: TILE, type: 'groundFill' })
  }
  addFloatingPlatform(300, groundY - TILE * 2.5, 3)
  addFloatingPlatform(600, groundY - TILE * 3.5, 2)
  // Starting coins trail
  for (let i = 0; i < 5; i++) {
    fruits.push({ x: 180 + i * 50, y: groundY - TILE * 1.2, width: 34, height: 34, type: fruitTypes[i % 4], bobOffset: i * 0.8 })
  }
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
  // Sometimes put fruits on platform
  if (Math.random() > 0.4) {
    for (let i = 0; i < count; i++) {
      if (Math.random() > 0.5) {
        fruits.push({ x: baseX + i * TILE + TILE / 2 - 17, y: baseY - 42, width: 34, height: 34, type: fruitTypes[Math.floor(Math.random() * 4)], bobOffset: Math.random() * Math.PI * 2 })
      }
    }
  }
}

function spawnMovingPlatform() {
  const x = cameraX + W + 100 + Math.random() * 200
  const y = groundY - TILE * (2 + Math.random() * 2)
  const horizontal = Math.random() > 0.4
  movingPlatforms.push({
    x, y, startX: x, startY: y,
    width: TILE * 2, height: TILE * 0.6,
    horizontal,
    range: horizontal ? 80 + Math.random() * 100 : 50 + Math.random() * 70,
    speed: 1 + Math.random() * 1.5,
    phase: Math.random() * Math.PI * 2
  })
}

function spawnSpring() {
  const x = cameraX + W + 200 + Math.random() * 400
  springs.push({ x, y: groundY - TILE * 0.4, width: TILE * 0.5, height: TILE * 0.4, compressed: 0 })
}

function spawnEnemy() {
  const x = cameraX + W + 50
  const types = ['goomba', 'goomba', 'fly']
  const type = types[Math.floor(Math.random() * types.length)]
  const isFlying = type === 'fly'
  enemies.push({
    x,
    y: isFlying ? groundY - TILE * (2 + Math.random() * 2) : groundY - TILE * 0.7,
    width: TILE * 0.7,
    height: TILE * 0.7,
    vx: -(1.2 + Math.random() * difficulty * 0.4),
    type,
    flyY: 0, flyPhase: Math.random() * Math.PI * 2,
    alive: true
  })
}

function spawnFruit() {
  const x = cameraX + W + 50 + Math.random() * 300
  const y = groundY - TILE * (1.5 + Math.random() * 3)
  fruits.push({ x, y, width: 34, height: 34, type: fruitTypes[Math.floor(Math.random() * 4)], bobOffset: Math.random() * Math.PI * 2 })
}

function spawnSpike() {
  const x = cameraX + W + 200 + Math.random() * 400
  spikes.push({ x, y: groundY - TILE * 0.55, width: TILE * 0.8, height: TILE * 0.55 })
}

function spawnDecoration() {
  const x = cameraX + W + Math.random() * 500
  const types = ['plant1', 'plant3', 'rock1', 'sign1']
  const type = types[Math.floor(Math.random() * types.length)]
  const size = type === 'rock1' ? TILE * 0.8 : type === 'sign1' ? TILE * 0.7 : TILE * 0.6
  decorations.push({ x, y: groundY - size, width: size * (type === 'rock1' ? 1.4 : 1), height: size, type })
}

function addParticle(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 7 - 2,
      life: 30 + Math.random() * 20,
      color,
      size: 3 + Math.random() * 5
    })
  }
}

function addFloatingText(x, y, text, color = '#fff') {
  floatingTexts.push({ x, y, text, color, life: 60, vy: -2 })
}

// ---- Drawing functions ----

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H)
  gradient.addColorStop(0, SKY_TOP)
  gradient.addColorStop(0.55, SKY_BOTTOM)
  gradient.addColorStop(0.85, '#b8e8b8')
  gradient.addColorStop(1, '#8bc88b')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)

  // Sun with rays
  ctx.save()
  const sunX = W - 130
  const sunY = 85
  // Rays
  ctx.globalAlpha = 0.15
  ctx.fillStyle = '#fff7a0'
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Date.now() * 0.0001
    ctx.beginPath()
    ctx.moveTo(sunX, sunY)
    ctx.lineTo(sunX + Math.cos(angle) * 120, sunY + Math.sin(angle) * 120)
    ctx.lineTo(sunX + Math.cos(angle + 0.15) * 120, sunY + Math.sin(angle + 0.15) * 120)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // Sun disc
  ctx.fillStyle = '#fff7a0'
  ctx.shadowColor = '#fbd000'
  ctx.shadowBlur = 60
  ctx.beginPath()
  ctx.arc(sunX, sunY, 48, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawMountain(m) {
  const x = m.x - cameraX * 0.05
  const baseY = groundY + 20
  ctx.fillStyle = m.color
  ctx.beginPath()
  ctx.moveTo(x - m.width / 2, baseY)
  ctx.lineTo(x - m.width * 0.1, baseY - m.height)
  ctx.lineTo(x + m.width * 0.05, baseY - m.height * 0.95)
  ctx.lineTo(x + m.width * 0.15, baseY - m.height * 0.85)
  ctx.lineTo(x + m.width / 2, baseY)
  ctx.closePath()
  ctx.fill()
  // Snow cap
  if (m.snow) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath()
    ctx.moveTo(x - m.width * 0.1, baseY - m.height)
    ctx.lineTo(x - m.width * 0.06, baseY - m.height * 0.85)
    ctx.lineTo(x + m.width * 0.05, baseY - m.height * 0.82)
    ctx.lineTo(x + m.width * 0.12, baseY - m.height * 0.88)
    ctx.lineTo(x + m.width * 0.05, baseY - m.height * 0.95)
    ctx.closePath()
    ctx.fill()
  }
}

function drawBgTree(t) {
  const x = t.x - cameraX * 0.2
  const baseY = groundY + 10
  // Trunk
  ctx.fillStyle = `rgba(80, 50, 30, ${0.5 + t.shade})`
  ctx.fillRect(x - t.width * 0.15, baseY - t.height * 0.5, t.width * 0.3, t.height * 0.5)
  // Foliage - layered circles
  ctx.fillStyle = `rgba(40, ${100 + t.shade * 60}, 40, ${0.6 + t.shade})`
  ctx.beginPath()
  ctx.arc(x, baseY - t.height * 0.65, t.width * 0.5, 0, Math.PI * 2)
  ctx.arc(x - t.width * 0.25, baseY - t.height * 0.5, t.width * 0.35, 0, Math.PI * 2)
  ctx.arc(x + t.width * 0.25, baseY - t.height * 0.5, t.width * 0.35, 0, Math.PI * 2)
  ctx.arc(x, baseY - t.height * 0.85, t.width * 0.35, 0, Math.PI * 2)
  ctx.fill()
}

function drawBgBush(b) {
  const x = b.x - cameraX * 0.35
  const baseY = groundY + 5
  ctx.fillStyle = 'rgba(50, 140, 50, 0.7)'
  ctx.beginPath()
  ctx.arc(x, baseY - b.height * 0.5, b.width * 0.35, 0, Math.PI * 2)
  ctx.arc(x + b.width * 0.3, baseY - b.height * 0.4, b.width * 0.3, 0, Math.PI * 2)
  ctx.arc(x - b.width * 0.25, baseY - b.height * 0.35, b.width * 0.25, 0, Math.PI * 2)
  ctx.fill()
}

function drawCloud(cloud) {
  const parallaxSpeeds = [0.08, 0.15, 0.25]
  const alphas = [0.4, 0.65, 0.9]
  const x = cloud.x - cameraX * parallaxSpeeds[cloud.layer]
  const y = cloud.y
  const w = cloud.width
  ctx.fillStyle = `rgba(255, 255, 255, ${alphas[cloud.layer]})`
  ctx.beginPath()
  ctx.arc(x, y, w * 0.2, 0, Math.PI * 2)
  ctx.arc(x + w * 0.16, y - w * 0.1, w * 0.26, 0, Math.PI * 2)
  ctx.arc(x + w * 0.38, y - w * 0.06, w * 0.22, 0, Math.PI * 2)
  ctx.arc(x + w * 0.52, y, w * 0.18, 0, Math.PI * 2)
  ctx.arc(x + w * 0.18, y + w * 0.05, w * 0.16, 0, Math.PI * 2)
  ctx.arc(x + w * 0.36, y + w * 0.05, w * 0.14, 0, Math.PI * 2)
  ctx.fill()
}

function drawBird(bird, time) {
  const x = bird.x - cameraX * 0.12
  const y = bird.y + Math.sin(time * 0.002 + bird.wingPhase) * 8
  const wing = Math.sin(time * 0.008 + bird.wingPhase) * bird.size
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x - bird.size, y + wing)
  ctx.quadraticCurveTo(x - bird.size * 0.3, y - Math.abs(wing) * 0.5, x, y)
  ctx.quadraticCurveTo(x + bird.size * 0.3, y - Math.abs(wing) * 0.5, x + bird.size, y + wing)
  ctx.stroke()
}

function drawSprite(spriteName, x, y, w, h) {
  const img = sprites[spriteName]
  if (img && spritesLoaded) ctx.drawImage(img, x, y, w, h)
}

function drawBlock(p) {
  const x = p.x - cameraX
  if (x < -TILE * 2 || x > W + TILE * 2) return
  const tileMap = { groundTop: 'tile2', groundFill: 'tile10', platformLeft: 'tile1', platformMid: 'tile3', platformRight: 'tile5', platformSingle: 'tile2' }
  const sprite = tileMap[p.type]
  if (sprite) drawSprite(sprite, x, p.y, TILE, TILE)
}

function drawDecoration(d) {
  const x = d.x - cameraX
  if (x < -TILE * 2 || x > W + TILE * 2) return
  drawSprite(d.type, x, d.y, d.width, d.height)
}

function drawMovingPlatform(mp) {
  const x = mp.x - cameraX
  if (x < -TILE * 3 || x > W + TILE * 3) return
  // Platform body with nice visuals
  ctx.fillStyle = '#8a6030'
  ctx.fillRect(x, mp.y, mp.width, mp.height)
  ctx.fillStyle = '#6a4420'
  ctx.fillRect(x, mp.y + mp.height * 0.7, mp.width, mp.height * 0.3)
  ctx.fillStyle = '#a87840'
  ctx.fillRect(x + 2, mp.y + 2, mp.width - 4, mp.height * 0.3)
  // Edge bolts
  ctx.fillStyle = '#ccc'
  ctx.beginPath()
  ctx.arc(x + 6, mp.y + mp.height / 2, 3, 0, Math.PI * 2)
  ctx.arc(x + mp.width - 6, mp.y + mp.height / 2, 3, 0, Math.PI * 2)
  ctx.fill()
  // Chain line hint
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  if (mp.horizontal) {
    ctx.moveTo(mp.startX - cameraX, mp.y + mp.height / 2)
    ctx.lineTo(mp.startX + mp.range - cameraX, mp.y + mp.height / 2)
  } else {
    ctx.moveTo(x + mp.width / 2, mp.startY)
    ctx.lineTo(x + mp.width / 2, mp.startY + mp.range)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

function drawSpring(s) {
  const x = s.x - cameraX
  if (x < -TILE || x > W + TILE) return
  const compression = s.compressed
  // Base
  ctx.fillStyle = '#666'
  ctx.fillRect(x, s.y + s.height * 0.7, s.width, s.height * 0.3)
  // Coil
  ctx.strokeStyle = '#e52521'
  ctx.lineWidth = 3
  const coilTop = s.y + compression * 5
  for (let i = 0; i < 4; i++) {
    const cy = coilTop + (s.height * 0.7 - compression * 5) * (i / 4)
    ctx.beginPath()
    ctx.moveTo(x + 3, cy)
    ctx.lineTo(x + s.width - 3, cy + 4)
    ctx.stroke()
  }
  // Top pad
  ctx.fillStyle = '#e52521'
  ctx.fillRect(x - 2, coilTop - 4, s.width + 4, 8)
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
  // Invincibility flash
  if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) {
    ctx.globalAlpha = 0.5
  }
  if (player.facing < 0) {
    ctx.translate(x + w / 2, 0)
    ctx.scale(-1, 1)
    ctx.translate(-(x + w / 2), 0)
  }
  const drawW = w * 1.7
  const drawH = h * 1.5
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

  if (e.type === 'fly') {
    // Flying enemy - bat/bird
    const wing = Math.sin(Date.now() * 0.01 + e.flyPhase) * 12
    ctx.fillStyle = '#4a2a6a'
    ctx.beginPath()
    ctx.arc(x + w / 2, y + h / 2, w * 0.35, 0, Math.PI * 2)
    ctx.fill()
    // Wings
    ctx.fillStyle = '#6a3a8a'
    ctx.beginPath()
    ctx.moveTo(x + w * 0.2, y + h * 0.4)
    ctx.quadraticCurveTo(x - w * 0.2, y + h * 0.2 + wing, x - w * 0.3, y + h * 0.5 + wing)
    ctx.lineTo(x + w * 0.3, y + h * 0.5)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x + w * 0.8, y + h * 0.4)
    ctx.quadraticCurveTo(x + w * 1.2, y + h * 0.2 - wing, x + w * 1.3, y + h * 0.5 - wing)
    ctx.lineTo(x + w * 0.7, y + h * 0.5)
    ctx.fill()
    // Eyes
    ctx.fillStyle = '#ff4444'
    ctx.beginPath()
    ctx.arc(x + w * 0.38, y + h * 0.4, 3, 0, Math.PI * 2)
    ctx.arc(x + w * 0.62, y + h * 0.4, 3, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Goomba
    const wobble = Math.sin(Date.now() * 0.005 + e.x) * 2
    ctx.fillStyle = '#8B4513'
    ctx.beginPath()
    ctx.arc(x + w / 2, y + h * 0.35, w * 0.52, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(x + w * 0.08, y + h * 0.35, w * 0.84, h * 0.4)
    ctx.fillStyle = '#6B3410'
    ctx.beginPath()
    ctx.arc(x + w / 2, y + h * 0.25, w * 0.57, Math.PI + 0.3, -0.3)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(x + w * 0.18, y + h * 0.28, w * 0.22, h * 0.2)
    ctx.fillRect(x + w * 0.58, y + h * 0.28, w * 0.22, h * 0.2)
    ctx.fillStyle = '#000'
    ctx.fillRect(x + w * 0.25, y + h * 0.32, w * 0.12, h * 0.14)
    ctx.fillRect(x + w * 0.62, y + h * 0.32, w * 0.12, h * 0.14)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(x + w * 0.05, y + h * 0.7 + wobble, w * 0.3, h * 0.3)
    ctx.fillRect(x + w * 0.6, y + h * 0.7 - wobble, w * 0.3, h * 0.3)
  }
}

function drawFruit(f, time) {
  const x = f.x - cameraX
  const bob = Math.sin(time * 0.003 + f.bobOffset) * 5
  const y = f.y + bob
  if (x < -TILE || x > W + TILE) return
  ctx.save()
  ctx.shadowColor = '#fbd000'
  ctx.shadowBlur = 12
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

function drawFloatingTexts() {
  floatingTexts.forEach(ft => {
    ctx.save()
    ctx.globalAlpha = ft.life / 60
    ctx.fillStyle = ft.color
    ctx.font = 'bold 14px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 3
    ctx.fillText(ft.text, ft.x - cameraX, ft.y)
    ctx.restore()
  })
}

function drawHUD() {
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.font = '16px "Press Start 2P", monospace'
  ctx.textAlign = 'left'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 2
  ctx.fillText(`SCORE  ${score}`, 20, 34)
  ctx.fillText(`DIST   ${Math.floor(distance)}m`, 20, 58)
  // Fruit counter
  ctx.fillStyle = '#fbd000'
  ctx.fillText(`x${player.coins}`, W - 80, 34)
  ctx.restore()
  // Draw a little fruit icon
  drawSprite('fruit1', W - 120, 16, 26, 26)
}

// ---- Update functions ----

function updatePlayer(dt) {
  player.vx = 0
  if (keys['ArrowLeft'] || keys['KeyA']) { player.vx = -player.speed; player.facing = -1 }
  if (keys['ArrowRight'] || keys['KeyD']) { player.vx = player.speed; player.facing = 1 }
  player.x += player.vx

  if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && player.grounded) {
    player.vy = -13
    player.grounded = false
  }

  player.vy += 0.58
  if (player.vy > 16) player.vy = 16
  player.y += player.vy

  if (player.x < cameraX - 10) player.x = cameraX - 10

  if (player.invincible > 0) player.invincible--

  // Platform collision
  player.grounded = false
  const allPlats = [...platforms]
  // Add moving platforms as collidable
  movingPlatforms.forEach(mp => {
    allPlats.push({ x: mp.x, y: mp.y, width: mp.width, height: mp.height, type: 'moving' })
  })
  allPlats.forEach(p => {
    if (
      player.x + player.width > p.x + 4 &&
      player.x < p.x + p.width - 4 &&
      player.y + player.height > p.y &&
      player.y + player.height < p.y + p.height / 2 + player.vy + 3 &&
      player.vy >= 0
    ) {
      player.y = p.y - player.height
      player.vy = 0
      player.grounded = true
    }
  })

  // Spring collision
  springs.forEach(s => {
    if (
      player.x + player.width > s.x &&
      player.x < s.x + s.width &&
      player.y + player.height > s.y &&
      player.y + player.height < s.y + s.height + 6 &&
      player.vy >= 0
    ) {
      player.vy = -18
      player.grounded = false
      s.compressed = 3
      addParticle(s.x + s.width / 2, s.y, '#e52521', 4)
    }
  })

  // Spike collision
  if (player.invincible <= 0) {
    spikes.forEach(s => {
      if (player.x + player.width > s.x + 6 && player.x < s.x + s.width - 6 && player.y + player.height > s.y + 6) {
        onDeath()
      }
    })
  }

  if (player.y > H + 50) onDeath()

  // Camera
  const targetCameraX = player.x - W * 0.35
  if (targetCameraX > cameraX) cameraX += (targetCameraX - cameraX) * 0.08

  distance = Math.max(distance, (player.x - W * 0.35) / TILE)
  difficulty = 1 + distance / 50

  // Animation state machine
  let newState = 'idle'
  if (!player.grounded) newState = 'jump'
  else if (Math.abs(player.vx) > 0.5) newState = 'run'

  if (newState !== player.state) { player.state = newState; player.animFrame = 0; player.animTimer = 0 }
  player.animTimer += dt
  const animSpeed = player.state === 'run' ? 45 : player.state === 'jump' ? 55 : 75
  if (player.animTimer > animSpeed) {
    player.animTimer = 0
    player.animFrame++
    const anim = characters[activeCharacter][player.state]
    if (anim) player.animFrame %= anim.count
  }
}

function updateEnemies() {
  enemies.forEach(e => {
    if (!e.alive) return
    e.x += e.vx
    // Flying enemies bob up and down
    if (e.type === 'fly') {
      e.flyPhase += 0.03
      e.y += Math.sin(e.flyPhase) * 0.8
    }

    if (player.invincible > 0) { if (e.x < cameraX - 200) e.alive = false; return }

    if (
      player.x + player.width > e.x + 6 &&
      player.x < e.x + e.width - 6 &&
      player.y + player.height > e.y + 4 &&
      player.y < e.y + e.height
    ) {
      if (player.vy > 0 && player.y + player.height < e.y + e.height * 0.5) {
        e.alive = false
        player.vy = -10
        const pts = e.type === 'fly' ? 200 : 100
        score += pts
        emit('score', score)
        addParticle(e.x + e.width / 2, e.y, '#fbd000')
        addParticle(e.x + e.width / 2, e.y, '#ff6b00')
        addFloatingText(e.x + e.width / 2, e.y - 10, `+${pts}`, '#fbd000')
      } else {
        onDeath()
      }
    }
    if (e.x < cameraX - 200) e.alive = false
  })
  enemies = enemies.filter(e => e.alive)
}

function updateFruits() {
  fruits = fruits.filter(f => {
    const dx = player.x + player.width / 2 - (f.x + f.width / 2)
    const dy = player.y + player.height / 2 - (f.y + f.height / 2)
    if (Math.abs(dx) < 28 && Math.abs(dy) < 32) {
      score += 50
      player.coins++
      emit('score', score)
      addParticle(f.x + f.width / 2, f.y, '#ff4444', 4)
      addParticle(f.x + f.width / 2, f.y, '#fbd000', 3)
      addFloatingText(f.x + f.width / 2, f.y - 10, '+50', '#fbd000')
      return false
    }
    return f.x > cameraX - 200
  })
}

function updateMovingPlatforms(time) {
  movingPlatforms.forEach(mp => {
    const t = time * 0.001 * mp.speed + mp.phase
    if (mp.horizontal) {
      mp.x = mp.startX + Math.sin(t) * mp.range / 2
    } else {
      mp.y = mp.startY + Math.sin(t) * mp.range / 2
    }
  })
  movingPlatforms = movingPlatforms.filter(mp => mp.startX > cameraX - TILE * 8)
}

function updateSprings() {
  springs.forEach(s => { if (s.compressed > 0) s.compressed -= 0.15 })
  springs = springs.filter(s => s.x > cameraX - TILE * 4)
}

function updateParticles() {
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life-- })
  particles = particles.filter(p => p.life > 0)
}

function updateFloatingTexts() {
  floatingTexts.forEach(ft => { ft.y += ft.vy; ft.life-- })
  floatingTexts = floatingTexts.filter(ft => ft.life > 0)
}

function updateBirds(time) {
  birds.forEach(b => {
    b.x += b.speed
    if (b.x - cameraX * 0.12 > W + 100) {
      b.x = cameraX * 0.12 - 100 - Math.random() * 200
      b.y = 40 + Math.random() * H * 0.25
    }
  })
}

function updateSpawning(dt) {
  spawnTimer += dt; fruitTimer += dt; platformTimer += dt; spikeTimer += dt; decorTimer += dt; springTimer += dt; movPlatTimer += dt

  const df = Math.max(0.4, 1 / difficulty)

  if (spawnTimer > (2200 + Math.random() * 1800) * df) { spawnEnemy(); spawnTimer = 0 }
  if (fruitTimer > 1000 + Math.random() * 1200) { spawnFruit(); fruitTimer = 0 }
  if (platformTimer > (1400 + Math.random() * 1800) * df) { spawnPlatformCluster(); platformTimer = 0 }
  if (spikeTimer > (4000 + Math.random() * 4000) * df) { spawnSpike(); spikeTimer = 0 }
  if (decorTimer > 1500 + Math.random() * 2000) { spawnDecoration(); decorTimer = 0 }
  if (springTimer > 6000 + Math.random() * 6000) { spawnSpring(); springTimer = 0 }
  if (movPlatTimer > 4000 + Math.random() * 4000) { spawnMovingPlatform(); movPlatTimer = 0 }

  // Extend ground
  const groundPlatforms = platforms.filter(p => p.type === 'groundTop')
  const maxGroundX = groundPlatforms.length > 0 ? Math.max(...groundPlatforms.map(p => p.x)) : 0
  if (maxGroundX < cameraX + W + 300) {
    const gap = Math.random() > 0.85
    const startX = maxGroundX + TILE
    const gapSize = gap ? TILE * 2 + Math.random() * TILE * 2 : 0
    for (let x = startX + gapSize; x < startX + gapSize + TILE * 10; x += TILE) {
      platforms.push({ x, y: groundY, width: TILE, height: TILE, type: 'groundTop' })
      platforms.push({ x, y: groundY + TILE, width: TILE, height: TILE, type: 'groundFill' })
    }
  }

  // Cleanup
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
  player = { x: 100, y: groundY - PLAYER_H, width: PLAYER_W, height: PLAYER_H, vy: 0, vx: 0, grounded: false, speed: 5.5, facing: 1, animFrame: 0, animTimer: 0, state: 'idle', invincible: 0, coins: 0 }
  enemies = []; fruits = []; spikes = []; particles = []; floatingTexts = []; decorations = []; springs = []; movingPlatforms = []
  cameraX = 0; score = 0; distance = 0; difficulty = 1
  spawnTimer = 0; fruitTimer = 0; platformTimer = 0; spikeTimer = 0; decorTimer = 0; springTimer = 0; movPlatTimer = 0
  gameOver = false
  initPlatforms()
  emit('score', 0); emit('restart')
}

// ---- Main loop ----
let lastTime = 0

function gameLoop(timestamp) {
  if (!canvas.value) return
  animationFrameId = requestAnimationFrame(gameLoop)
  const dt = lastTime ? Math.min(timestamp - lastTime, 50) : 16
  lastTime = timestamp

  // ---- Draw layers back to front ----
  drawSky()

  // Layer 1: Mountains (0.05x parallax)
  bgMountains.forEach(drawMountain)

  // Layer 2: Far clouds (0.08x)
  clouds.filter(c => c.layer === 0).forEach(drawCloud)

  // Layer 3: Trees (0.2x)
  bgTrees.forEach(drawBgTree)

  // Layer 4: Mid clouds (0.15x)
  clouds.filter(c => c.layer === 1).forEach(drawCloud)

  // Layer 5: Birds (0.12x)
  birds.forEach(b => drawBird(b, timestamp))

  // Layer 6: Bushes (0.35x)
  bgBushes.forEach(drawBgBush)

  // Layer 7: Near clouds (0.25x)
  clouds.filter(c => c.layer === 2).forEach(drawCloud)

  // ---- Update game ----
  if (gameStarted && !gameOver) {
    updatePlayer(dt)
    updateEnemies()
    updateFruits()
    updateMovingPlatforms(timestamp)
    updateSprings()
    updateParticles()
    updateFloatingTexts()
    updateBirds(timestamp)
    updateSpawning(dt)
  }

  // ---- Draw game world ----
  decorations.forEach(drawDecoration)
  platforms.forEach(drawBlock)
  movingPlatforms.forEach(drawMovingPlatform)
  springs.forEach(drawSpring)
  spikes.forEach(drawSpikeObj)
  fruits.forEach(f => drawFruit(f, timestamp))
  enemies.forEach(drawEnemy)

  if (gameStarted) {
    drawPlayer()
    drawParticles()
    drawFloatingTexts()
    drawHUD()
  }

  // Animate clouds
  clouds.forEach(c => {
    c.x += c.speed
    const px = [0.08, 0.15, 0.25][c.layer]
    if (c.x - cameraX * px > W + 300) {
      c.x = cameraX * px - 200 - Math.random() * 200
      c.y = 20 + Math.random() * (H * 0.3)
    }
  })
}

function startGame() {
  if (gameStarted && !gameOver) return
  if (gameOver) resetGame()
  activeCharacter = Math.random() > 0.5 ? 'redhat' : 'flatboy'
  gameStarted = true
  player.x = 100
  player.y = groundY - player.height
  emit('started')
}

function handleKeyDown(e) {
  keys[e.code] = true
  if (e.code === 'Enter') { e.preventDefault(); startGame() }
}

function handleKeyUp(e) { keys[e.code] = false }

// Touch controls
let touchStartX = 0
let touchActive = false

function handleTouchStart(e) {
  if (!gameStarted || gameOver) { startGame(); return }
  touchActive = true
  touchStartX = e.touches[0].clientX
  if (e.touches[0].clientY < H * 0.5) keys['Space'] = true
}

function handleTouchMove(e) {
  if (!touchActive) return
  const diff = e.touches[0].clientX - touchStartX
  keys['ArrowLeft'] = diff < -20
  keys['ArrowRight'] = diff > 20
  if (e.touches[0].clientY < H * 0.4) keys['Space'] = true
}

function handleTouchEnd() {
  touchActive = false
  keys['ArrowLeft'] = false; keys['ArrowRight'] = false; keys['Space'] = false
}

function resize() {
  if (!canvas.value) return
  W = canvas.value.offsetWidth; H = canvas.value.offsetHeight
  canvas.value.width = W; canvas.value.height = H
  groundY = H - TILE * 1.4
  player.y = Math.min(player.y, groundY - player.height)
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  ctx.imageSmoothingEnabled = true
  loadSprites(); loadCharacterSprites()
  resize()
  groundY = H - TILE * 1.4
  player.x = 100; player.y = groundY - player.height

  initBgMountains(); initBgTrees(); initBgBushes(); initClouds(); initBirds(); initPlatforms()

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
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
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
