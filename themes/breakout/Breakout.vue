<template>
  <canvas ref="canvas" class="breakout-canvas"></canvas>
  <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup>
import EscHold from '../base/EscHold.vue'
/**
 * Breakout, the arcade original: a paddle, a ball, rows of bricks.
 * Same contract as galaga/Galaga.vue — a full-viewport canvas behind
 * the landing overlay, Enter/tap to start, arrows/mouse/touch to move,
 * events up to Landing.vue for the HUD. Before the game starts the canvas
 * plays itself (attract mode) so the landing is alive behind the card.
 *
 * Look (2026-09-24): Neon Shrine's pixel stage (themes/base/pixel). A
 * shrine chamber seen from above — dungeon floor, braziers, a pit under the
 * paddle — with stone and crystal bricks, a glowing orb and a cyan shield
 * bar, drawn in logical pixels and lit by a light map (./pixel.ts). Rules
 * stay in CSS px; `L()` converts.
 */
const emit = defineEmits(['score', 'death', 'restart', 'started', 'lives', 'level'])

import { createPixelStage } from '../base/pixel/stage'
import { drawBigText, bigTextWidth } from '../base/pixel/sprites'
import { brickCanvas, capsuleCanvas, createChamber, crystalColor, orbCanvas, paddleCanvas, ring } from './pixel'
import { safeBottom } from '../base/safeBottom'
import { useSound } from '~/composables/useSound'

const sound = useSound()

const canvas = ref(null)
let animationFrameId = null
let gameRunning = false
let W = 0
let H = 0
let dpr = 1
let bandBottom = 0 // --app-safe-bottom in CSS px; the paddle sits above it
let stage = null // Neon Shrine's pixel stage (themes/base/pixel/stage.ts)
const chamber = createChamber() // the shrine chamber (./pixel.ts)
let flare = 0 // braziers flare on hits and level clears

// Game state
let paddle = { x: 0, y: 0, w: 110, h: 14, baseW: 110, visible: true }
let balls = []
let bricks = []
let gridCols = 10
let particles = []
let powerups = []
let shockwaves = []
let deathFlash = 0 // red vignette timer (s) after a lost life, ~0.4 s decay
let score = 0
let lives = 2
let level = 1
let combo = 0 // bricks broken since the last paddle hit
let gameOver = false
let gameStarted = false
// Esc tap pauses (EscHold owns Escape); a 3 s hold quits into game over.
const paused = ref(false)
let keys = {}
let lastTime = 0
let shake = 0
let paddleFlash = 0
let wideUntil = 0
let slowUntil = 0
let levelBanner = 0 // ms left to show "LEVEL n"
let deathAt = 0
let deathEmitted = false
let demoLaunchAt = 0

const BALL_RADIUS = 6
const BASE_SPEED = 380 // px/s at level 1
const MAX_SPEED = 720
const LIVES = 3
const MAX_BALLS = 100
// Crystal rows: pink, violet, teal (colours in ./pixel.ts).
const ROW_COLORS = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(crystalColor)
const PADDLE_COLOR = '#2ff3ff'
const GOLD = '#ffd23f'
const POWERUPS = {
  wide: { color: '#ffd23f', label: 'W' },
  multi: { color: '#ffd23f', label: 'M' },
  slow: { color: '#ffd23f', label: 'S' },
  life: { color: '#ffd23f', label: '+' },
}

// ---------------------------------------------------------------- setup

function setupCanvas() {
  const c = canvas.value
  if (!c) return
  dpr = window.devicePixelRatio || 1
  W = c.offsetWidth
  H = c.offsetHeight
  if (!stage) stage = createPixelStage(c)
  // About 3 CSS px per pixel on phones and laptops, 4 on big screens, so the
  // orb and the shield bar read at every size.
  stage.resize(W, H, dpr, W < 600 ? 128 : 360, 225)
  paddle.baseW = Math.min(120, Math.max(72, W * 0.24))
  bandBottom = safeBottom()
  paddle.y = H - 56 - bandBottom
  paddle.x = clamp(paddle.x || W / 2, paddle.w / 2, W - paddle.w / 2)
  const grid = computeGrid(gridCols)
  chamber.layout(stage.vw, stage.vh, stage.px(paddle.y + paddle.h + 16), stage.px(grid.top + (H - grid.top) * 0.55))
}

function computeGrid(cols) {
  const margin = Math.max(12, W * 0.04)
  const gap = 5
  const bw = (W - margin * 2 - gap * (cols - 1)) / cols
  const bh = Math.min(22, Math.max(14, bw * 0.38))
  const top = Math.max(64, H * 0.11)
  return { margin, gap, cols, bw, bh, top }
}

function layoutBricks() {
  const g = computeGrid(gridCols)
  for (const b of bricks) {
    b.x = g.margin + b.col * (g.bw + g.gap)
    b.y = g.top + b.row * (g.bh + g.gap)
    b.w = g.bw
    b.h = g.bh
  }
}

function buildLevel(n) {
  gridCols = Math.max(5, Math.min(14, Math.round(W / 72)))
  const rows = Math.min(6 + Math.floor((n - 1) / 2), 9)
  const pattern = (n - 1) % 4 // full, checker, pyramid, columns
  const hardRows = Math.min(n, 3)
  bricks = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < gridCols; c++) {
      let present = true
      if (pattern === 1) present = (r + c) % 2 === 0
      if (pattern === 2) {
        const width = gridCols * (1 - r / (rows + 1))
        present = Math.abs(c - (gridCols - 1) / 2) <= width / 2
      }
      if (pattern === 3) present = c % 4 !== 3 || r % 3 === 0
      if (!present) continue
      let hp = r < hardRows ? 2 : 1
      if (n >= 4 && r === 0) hp = 3
      bricks.push({
        row: r,
        col: c,
        x: 0, y: 0, w: 0, h: 0,
        hp,
        maxHp: hp,
        color: hp > 1 ? GOLD : ROW_COLORS[r % ROW_COLORS.length],
        points: (rows - r) * 10 * hp,
        flash: 0,
      })
    }
  }
  layoutBricks()
}

function ballSpeed() {
  return Math.min(BASE_SPEED + (level - 1) * 28, MAX_SPEED)
}

function newBall() {
  return {
    x: paddle.x,
    y: paddle.y - BALL_RADIUS - 1,
    vx: 0,
    vy: 0,
    speed: ballSpeed(),
    stuck: true,
    trail: [],
  }
}

function launch(ball) {
  if (!ball.stuck) return
  const angle = (Math.random() * 0.6 - 0.3) // radians from straight up
  ball.vx = Math.sin(angle) * ball.speed
  ball.vy = -Math.cos(angle) * ball.speed
  ball.stuck = false
}

function launchAll() {
  let any = false
  balls.forEach(b => { if (b.stuck) { launch(b); any = true } })
  if (any && gameStarted) sound.sfx.uiStart()
  return any
}

function resetGame() {
  if (!canvas.value) return
  const now = performance.now()
  score = 0
  lives = LIVES
  level = 1
  combo = 0
  gameOver = false
  gameStarted = true
  paused.value = false
  keys = {}
  particles = []
  powerups = []
  shockwaves = []
  shake = 0
  wideUntil = 0
  slowUntil = 0
  levelBanner = 0
  deathAt = 0
  deathEmitted = false
  paddle.visible = true
  paddle.w = paddle.baseW
  paddle.x = W / 2
  buildLevel(level)
  balls = [newBall()]
  demoLaunchAt = now
  sound.unlock()
  sound.sfx.uiStart()
  sound.music.start('breakout')
  emit('restart')
  emit('started')
  emit('score', 0)
  emit('lives', lives)
  emit('level', level)
}

// Attract mode: the game plays itself behind the card until Enter.
function startDemo() {
  gameStarted = false
  sound.music.stop()
  gameOver = false
  paused.value = false
  keys = {}
  level = 1
  lives = LIVES
  paddle.visible = true
  paddle.w = paddle.baseW
  paddle.x = W / 2
  buildLevel(1)
  balls = [newBall()]
  particles = []
  powerups = []
  shockwaves = []
  demoLaunchAt = performance.now() + 1200
}

// ---------------------------------------------------------------- effects

function spawnParticles(x, y, color, count = 10, spread = 220) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const s = 40 + Math.random() * spread
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      decay: 1.6 + Math.random() * 1.8,
      size: 2 + Math.random() * 3,
      color,
    })
  }
}

function triggerShockwave(x, y, color = '#ff2fa0') {
  shockwaves.push({ x, y, radius: 6, life: 1, color })
}

function maybeDropPowerup(b) {
  const roll = Math.random()
  let type = null
  // Lives are rare; multiball is the common prize (retuned 2026-09-05).
  if (roll < 0.015) type = 'life'
  else if (roll < 0.115) type = 'multi'
  else if (roll < 0.165) type = 'wide'
  else if (roll < 0.205) type = 'slow'
  if (!type) return
  powerups.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vy: 110, w: 34, h: 16, type })
}

function applyPowerup(type, now) {
  const p = POWERUPS[type]
  spawnParticles(paddle.x, paddle.y, p.color, 14, 160)
  paddleFlash = 1
  if (gameStarted) {
    if (type === 'life') sound.sfx.extraLife()
    else sound.sfx.powerup()
  }
  if (type === 'wide') wideUntil = now + 12000
  if (type === 'slow') slowUntil = now + 8000
  if (type === 'life') {
    lives++
    emit('lives', lives)
  }
  if (type === 'multi') {
    const extra = []
    for (const b of balls) {
      if (b.stuck || balls.length + extra.length >= MAX_BALLS) continue
      const speed = Math.hypot(b.vx, b.vy) || b.speed
      const base = Math.atan2(b.vy, b.vx)
      for (const d of [-0.45, 0.45]) {
        if (balls.length + extra.length >= MAX_BALLS) break
        extra.push({
          x: b.x, y: b.y,
          vx: Math.cos(base + d) * speed,
          vy: Math.sin(base + d) * speed,
          speed: b.speed,
          stuck: false,
          trail: [],
        })
      }
    }
    balls.push(...extra)
  }
}

function loseLife(now) {
  combo = 0
  triggerShockwave(paddle.x, paddle.y, '#2ff3ff')
  shake = 1
  if (gameStarted) {
    deathFlash = 1
    spawnParticles(paddle.x, paddle.y, '#ffffff', 24, 280)
  }
  if (!gameStarted) {
    balls = [newBall()]
    demoLaunchAt = now + 900
    return
  }
  lives--
  emit('lives', lives)
  if (lives <= 0) {
    gameOver = true
    deathAt = now
    sound.sfx.lifeLost()
    sound.sfx.gameOver()
    sound.music.stop()
    paddle.visible = false
    spawnParticles(paddle.x, paddle.y, PADDLE_COLOR, 40, 320)
    spawnParticles(paddle.x, paddle.y, '#ffffff', 12, 120)
    powerups = []
    return
  }
  sound.sfx.lifeLost()
  balls = [newBall()]
  wideUntil = 0
  slowUntil = 0
}

function clearLevel(now) {
  level++
  emit('level', level)
  combo = 0
  buildLevel(level)
  balls = [newBall()]
  powerups = []
  levelBanner = 1500
  demoLaunchAt = now + 1200
  sound.sfx.levelClear()
  spawnParticles(W / 2, H / 2, '#2ff3ff', 30, 300)
  flare = 1.5
}

// ---------------------------------------------------------------- Esc pause / hold-quit

function escActive() {
  return gameStarted && !gameOver
}

function togglePause() {
  if (!gameStarted || gameOver) return
  paused.value = !paused.value
  keys = {}
  if (paused.value) sound.music.stop(false)
  else sound.music.start('breakout')
}

// A 3 s Escape hold cancels the run: same death as losing the last life,
// so the landing shows GAME OVER with the run's score.
function quitToGameOver() {
  if (!gameStarted || gameOver) return
  paused.value = false
  keys = {}
  const now = performance.now()
  combo = 0
  triggerShockwave(paddle.x, paddle.y, '#2ff3ff')
  shake = 1
  deathFlash = 1
  spawnParticles(paddle.x, paddle.y, '#ffffff', 24, 280)
  lives = 0
  emit('lives', lives)
  gameOver = true
  deathAt = now
  sound.sfx.gameOver()
  sound.music.stop()
  paddle.visible = false
  spawnParticles(paddle.x, paddle.y, PADDLE_COLOR, 40, 320)
  spawnParticles(paddle.x, paddle.y, '#ffffff', 12, 120)
  powerups = []
}

// ---------------------------------------------------------------- update

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function update(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05) || 0
  lastTime = now
  const demo = !gameStarted
  flare = Math.max(0, flare - dt * 2.5)

  // Paddle width (powerup)
  const targetW = now < wideUntil ? paddle.baseW * 1.6 : paddle.baseW
  paddle.w += (targetW - paddle.w) * Math.min(1, dt * 8)

  // Paddle movement
  if (demo) {
    // Track the lowest descending ball, with a little lag so it looks played.
    let target = W / 2
    let best = -Infinity
    for (const b of balls) {
      if (b.stuck) { target = b.x; break }
      if (b.vy > 0 && b.y > best) { best = b.y; target = b.x + b.vx * 0.12 }
    }
    paddle.x += (target - paddle.x) * Math.min(1, dt * 6)
  } else if (!gameOver) {
    const dir = (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) - (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0)
    if (dir) paddle.x += dir * 640 * dt
  }
  paddle.x = clamp(paddle.x, paddle.w / 2, W - paddle.w / 2)

  // Demo auto-launch
  if (demo && now >= demoLaunchAt) launchAll()

  // Balls
  const slow = now < slowUntil ? 0.65 : 1
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i]
    if (ball.stuck) {
      ball.x = paddle.x
      ball.y = paddle.y - BALL_RADIUS - 1
      continue
    }
    if (gameOver) continue
    // Trail
    ball.trail.push({ x: ball.x, y: ball.y })
    if (ball.trail.length > 8) ball.trail.shift()

    const dist = Math.hypot(ball.vx, ball.vy) * slow * dt
    const steps = Math.min(8, Math.max(1, Math.ceil(dist / BALL_RADIUS)))
    const sdt = (dt * slow) / steps
    let lost = false
    for (let s = 0; s < steps; s++) {
      const px = ball.x
      const py = ball.y
      ball.x += ball.vx * sdt
      ball.y += ball.vy * sdt

      // Walls
      if (ball.x - BALL_RADIUS < 0) { ball.x = BALL_RADIUS; ball.vx = Math.abs(ball.vx); if (!demo) sound.sfx.wall() }
      if (ball.x + BALL_RADIUS > W) { ball.x = W - BALL_RADIUS; ball.vx = -Math.abs(ball.vx); if (!demo) sound.sfx.wall() }
      if (ball.y - BALL_RADIUS < 0) { ball.y = BALL_RADIUS; ball.vy = Math.abs(ball.vy); if (!demo) sound.sfx.wall() }
      if (ball.y - BALL_RADIUS > H) { lost = true; break }

      // Paddle
      if (
        paddle.visible && ball.vy > 0 &&
        ball.y + BALL_RADIUS >= paddle.y && ball.y - BALL_RADIUS <= paddle.y + paddle.h &&
        Math.abs(ball.x - paddle.x) <= paddle.w / 2 + BALL_RADIUS
      ) {
        const rel = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1)
        const angle = rel * (Math.PI / 3)
        ball.speed = Math.min(ball.speed * 1.02, MAX_SPEED)
        ball.vx = Math.sin(angle) * ball.speed
        ball.vy = -Math.cos(angle) * ball.speed
        ball.y = paddle.y - BALL_RADIUS
        paddleFlash = 1
        combo = 0
        if (!demo) sound.sfx.paddle()
        triggerShockwave(ball.x, paddle.y, '#2ff3ff')
        flare = Math.max(flare, 0.5)
        continue
      }

      // Bricks — first overlap wins for this sub-step
      for (let j = 0; j < bricks.length; j++) {
        const b = bricks[j]
        const nx = clamp(ball.x, b.x, b.x + b.w)
        const ny = clamp(ball.y, b.y, b.y + b.h)
        const dx = ball.x - nx
        const dy = ball.y - ny
        if (dx * dx + dy * dy > BALL_RADIUS * BALL_RADIUS) continue

        const fromSide = px < b.x || px > b.x + b.w
        if (fromSide) {
          ball.vx = -ball.vx
          ball.x = px
        } else {
          ball.vy = -ball.vy
          ball.y = py
        }
        // Keep the ball from going flat
        if (Math.abs(ball.vy) < ball.speed * 0.18) {
          ball.vy = (ball.vy < 0 ? -1 : 1) * ball.speed * 0.18
          ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, ball.speed ** 2 - ball.vy ** 2))
        }

        b.hp--
        b.flash = 1
        flare = Math.max(flare, 0.35)
        if (b.hp <= 0) {
          bricks.splice(j, 1)
          spawnParticles(nx, ny, b.color, 10)
          triggerShockwave(nx, ny, '#ff2fa0')
          if (!demo) {
            sound.sfx.brickBreak()
            combo++
            score += b.points * Math.min(combo, 4)
            emit('score', score)
            maybeDropPowerup(b)
          }
        } else {
          if (!demo) sound.sfx.brick()
          spawnParticles(nx, ny, b.color, 4, 120)
        }
        break
      }
    }
    if (lost) {
      balls.splice(i, 1)
    }
  }

  if (balls.length === 0 && !gameOver) loseLife(now)
  if (bricks.length === 0 && !gameOver) {
    if (demo) startDemo()
    else clearLevel(now)
  }

  // Powerups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i]
    p.y += p.vy * dt
    if (
      paddle.visible &&
      p.y + p.h / 2 >= paddle.y && p.y - p.h / 2 <= paddle.y + paddle.h &&
      Math.abs(p.x - paddle.x) <= paddle.w / 2 + p.w / 2
    ) {
      applyPowerup(p.type, now)
      powerups.splice(i, 1)
    } else if (p.y > H + 20) {
      powerups.splice(i, 1)
    }
  }

  // Particles, shockwaves
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 300 * dt
    p.vx *= 0.99
    p.life -= p.decay * dt
    if (p.life <= 0) particles.splice(i, 1)
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]
    sw.radius += 420 * dt
    sw.life -= 1.6 * dt
    if (sw.life <= 0) shockwaves.splice(i, 1)
  }
  for (const b of bricks) if (b.flash > 0) b.flash = Math.max(0, b.flash - 4 * dt)

  shake = Math.max(0, shake - 2.5 * dt)
  deathFlash = Math.max(0, deathFlash - dt / 0.4)
  paddleFlash = Math.max(0, paddleFlash - 4 * dt)
  levelBanner = Math.max(0, levelBanner - dt * 1000)

  if (gameOver && !deathEmitted && now - deathAt > 900) {
    deathEmitted = true
    emit('death')
  }
}

// ---------------------------------------------------------------- draw
// Everything below draws in the stage's logical pixels: L() takes a CSS
// coordinate to the pixel grid. The orb, flames, sparks and rings glow after
// the light map; the chamber and the bricks are lit by it.

function L(v) {
  return Math.round(v / stage.k)
}

let reducedMotion = false

function drawBricks(g) {
  for (const b of bricks) {
    const x0 = L(b.x)
    const y0 = L(b.y)
    const w = L(b.x + b.w) - x0
    const h = L(b.y + b.h) - y0
    const stone = b.maxHp > 1
    const img = brickCanvas(w, h, stone ? 'stone' : 'crystal', b.row, b.maxHp >= 3 ? '#ff3fae' : '#ffd23f', b.maxHp - b.hp)
    g.drawImage(img, x0, y0)
    // The stone's neon strip is emissive; crystals glow faintly.
    if (stone) stage.emit(x0 + 2, y0 + Math.max(2, Math.floor(h / 2)), w - 4, 1)
    stage.light(x0 + w / 2, y0 + h / 2, stone ? w * 0.7 : w * 0.6, stone ? (b.maxHp >= 3 ? '#ff3fae' : '#ffd23f') : b.color, stone ? 0.3 : 0.22)
  }
}

function drawBrickFlashes(g) {
  for (const b of bricks) {
    if (b.flash <= 0) continue
    const x0 = L(b.x)
    const y0 = L(b.y)
    g.globalAlpha = Math.min(1, b.flash)
    g.fillStyle = '#ffffff'
    g.fillRect(x0 + 1, y0 + 1, L(b.x + b.w) - x0 - 2, L(b.y + b.h) - y0 - 2)
  }
  g.globalAlpha = 1
}

function drawPaddle(g) {
  if (!paddle.visible) return
  const w = Math.max(6, L(paddle.x + paddle.w / 2) - L(paddle.x - paddle.w / 2))
  const h = Math.max(3, L(paddle.h) + 1)
  const img = paddleCanvas(w, h, paddleFlash > 0.5)
  const x = L(paddle.x) - (w >> 1)
  const y = L(paddle.y)
  g.drawImage(img, x, y)
  stage.light(L(paddle.x), y + 1, w * 0.8 + paddleFlash * 8, '#2ff3ff', 0.55 + paddleFlash * 0.4)
}

function drawPowerups(g) {
  for (const p of powerups) {
    const img = capsuleCanvas(POWERUPS[p.type].label)
    const x = L(p.x) - (img.width >> 1)
    const y = L(p.y) - (img.height >> 1)
    g.drawImage(img, x, y)
    stage.light(L(p.x), L(p.y), 16, '#ffd23f', 0.85)
  }
}

function drawGlowing(g, nowSec) {
  chamber.drawGlow(g, nowSec, flare, reducedMotion)
  drawBrickFlashes(g)
  // Orbs and their trails.
  const big = stage.k < 3.5
  const orb = orbCanvas(big)
  const half = orb.width >> 1
  for (const ball of balls) {
    g.fillStyle = '#2ff3ff'
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i]
      const f = (i + 1) / ball.trail.length
      g.globalAlpha = f * 0.45
      const n = f > 0.6 ? 2 : 1
      g.fillRect(L(t.x) - (n >> 1), L(t.y) - (n >> 1), n, n)
    }
    g.globalAlpha = 1
    g.drawImage(orb, L(ball.x) - half, L(ball.y) - half)
  }
  for (const sw of shockwaves) {
    g.globalAlpha = Math.max(0, sw.life)
    ring(g, L(sw.x), L(sw.y), L(sw.radius), sw.color)
  }
  g.globalAlpha = 1
  for (const p of particles) {
    g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4))
    g.fillStyle = p.color
    const n = Math.max(1, Math.round(p.size / stage.k))
    g.fillRect(L(p.x) - (n >> 1), L(p.y) - (n >> 1), n, n)
  }
  g.globalAlpha = 1
  if (deathFlash > 0.01) {
    g.globalAlpha = deathFlash * 0.35
    g.fillStyle = '#ff3b5c'
    const e = Math.max(3, L(Math.max(18, W * 0.03)))
    g.fillRect(0, 0, stage.vw, e)
    g.fillRect(0, stage.vh - e, stage.vw, e)
    g.fillRect(0, 0, e, stage.vh)
    g.fillRect(stage.vw - e, 0, e, stage.vh)
    g.globalAlpha = 1
  }
}

function draw() {
  if (!stage) return
  const demo = !gameStarted
  const nowSec = performance.now() / 1000
  const g = stage.begin()
  chamber.drawBack(g, stage, nowSec, flare, reducedMotion)
  drawBricks(g)
  drawPowerups(g)
  drawPaddle(g)
  for (const ball of balls) stage.light(L(ball.x), L(ball.y), 20, '#2ff3ff', 0.95)
  for (const sw of shockwaves) stage.light(L(sw.x), L(sw.y), Math.max(4, L(sw.radius)), sw.color, sw.life * 0.5)

  // Level banner in big pixel letters on the HUD layer.
  // It blinks out over its last 0.4 s.
  const blinkOff = !reducedMotion && levelBanner < 400 && Math.floor(nowSec * 8) % 2 === 1
  if (levelBanner > 0 && !demo && !blinkOff) {
    const text = `LEVEL ${level}`
    const n = stage.vw > 200 ? 3 : 2
    const tw = bigTextWidth(text, n)
    drawBigText(stage.hud, text, Math.round((stage.vw - tw) / 2), Math.round(L(H * 0.62) - 3.5 * n), n, '#ff2fa0', '#0b0616')
  }

  const m = shake * 6 / stage.k
  stage.present({
    // Attract mode sits darker behind the start text.
    ambient: demo ? '#6a5e9c' : '#8e80c4',
    shakeX: shake > 0 ? (Math.random() - 0.5) * m : 0,
    shakeY: shake > 0 ? (Math.random() - 0.5) * m : 0,
    afterLight: g2 => drawGlowing(g2, nowSec),
  })
}

function gameLoop(now) {
  if (!gameRunning) return
  if (paused.value) {
    // Frozen frame behind the PAUSED pill; keep the clock fresh so resume
    // never sees a huge dt (update clamps it anyway).
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
  if (!gameStarted || gameOver) {
    if (e.code === 'Enter') resetGame()
    return
  }
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') launchAll()
}

function handleKeyUp(e) {
  keys[e.code] = false
}

function handleResize() {
  setupCanvas()
  layoutBricks()
}

function handleMouseMove(e) {
  if (!gameStarted || gameOver) return
  paddle.x = clamp(e.clientX, paddle.w / 2, W - paddle.w / 2)
}

function handleMouseDown(e) {
  if (e.button !== 0 || isInteractiveElement(e.target)) return
  if (!gameStarted || gameOver) return // keyboard/tap starts; a stray click should not
  launchAll()
}

let touchActive = false
let tapStartX = 0
let tapStartY = 0
let tapStartTime = 0

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
  paddle.x = clamp(t.clientX, paddle.w / 2, W - paddle.w / 2)
}

function handleTouchMove(e) {
  if (!touchActive) return
  if (isInteractiveElement(e.target)) return
  e.preventDefault()
  const t = e.touches[0]
  paddle.x = clamp(t.clientX, paddle.w / 2, W - paddle.w / 2)
}

function handleTouchEnd(e) {
  if (isInteractiveElement(e.target)) { touchActive = false; return }
  const t = e.changedTouches[0]
  const isTap = t && Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 15 && performance.now() - tapStartTime < 400
  if (!gameStarted || gameOver) {
    if (isTap) resetGame()
  } else if (isTap) {
    launchAll()
  }
  touchActive = false
}

onMounted(() => {
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  setupCanvas()
  startDemo()
  gameRunning = true
  lastTime = performance.now()
  animationFrameId = requestAnimationFrame(gameLoop)

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', handleResize)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mousedown', handleMouseDown)
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
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mousedown', handleMouseDown)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
})
</script>

<style scoped>
/* Full-viewport playfield behind the landing overlay. */
.breakout-canvas {
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
