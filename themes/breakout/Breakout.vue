<template>
  <canvas ref="canvas" class="breakout-canvas"></canvas>
</template>

<script setup>
/**
 * Breakout, the arcade original: a paddle, a ball, rows of bricks.
 * Same contract as hacker/SpaceInvaders.vue — a full-viewport canvas behind
 * the landing overlay, Enter/tap to start, arrows/mouse/touch to move,
 * events up to Landing.vue for the HUD. Before the game starts the canvas
 * plays itself (attract mode) so the landing is alive behind the card.
 */
const emit = defineEmits(['score', 'death', 'restart', 'started', 'lives', 'level'])

import { createHorizon } from '../base/neonHorizon.js'

const canvas = ref(null)
let ctx = null
let animationFrameId = null
let gameRunning = false
let W = 0
let H = 0
let dpr = 1
let horizon = null

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
let lives = 3
let level = 1
let combo = 0 // bricks broken since the last paddle hit
let gameOver = false
let gameStarted = false
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
const MAX_BALLS = 8
const ROW_COLORS = [
  '#ff2fa0', '#ff2fa0', '#ff2fa0',
  'rgba(255, 47, 160, 0.72)', 'rgba(255, 47, 160, 0.72)', 'rgba(255, 47, 160, 0.72)',
  'rgba(255, 47, 160, 0.5)', 'rgba(255, 47, 160, 0.5)', 'rgba(255, 47, 160, 0.5)',
]
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
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = c.offsetWidth
  H = c.offsetHeight
  c.width = Math.round(W * dpr)
  c.height = Math.round(H * dpr)
  ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  paddle.baseW = Math.min(120, Math.max(72, W * 0.24))
  paddle.y = H - 56
  paddle.x = clamp(paddle.x || W / 2, paddle.w / 2, W - paddle.w / 2)
  if (!horizon) horizon = createHorizon({ ctx })
  horizon.resize(W, H, ctx)
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
  emit('restart')
  emit('started')
  emit('score', 0)
  emit('lives', lives)
  emit('level', level)
}

// Attract mode: the game plays itself behind the card until Enter.
function startDemo() {
  gameStarted = false
  gameOver = false
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
    paddle.visible = false
    spawnParticles(paddle.x, paddle.y, PADDLE_COLOR, 40, 320)
    spawnParticles(paddle.x, paddle.y, '#ffffff', 12, 120)
    powerups = []
    return
  }
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
  spawnParticles(W / 2, H / 2, '#2ff3ff', 30, 300)
  if (horizon) {
    horizon.beat()
    setTimeout(() => horizon && horizon.beat(), 120)
    setTimeout(() => horizon && horizon.beat(), 240)
  }
}

// ---------------------------------------------------------------- update

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function update(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05) || 0
  lastTime = now
  const demo = !gameStarted
  if (horizon) horizon.update(dt)

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
      if (ball.x - BALL_RADIUS < 0) { ball.x = BALL_RADIUS; ball.vx = Math.abs(ball.vx) }
      if (ball.x + BALL_RADIUS > W) { ball.x = W - BALL_RADIUS; ball.vx = -Math.abs(ball.vx) }
      if (ball.y - BALL_RADIUS < 0) { ball.y = BALL_RADIUS; ball.vy = Math.abs(ball.vy) }
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
        triggerShockwave(ball.x, paddle.y, '#2ff3ff')
        if (horizon) horizon.beat()
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
        if (horizon) horizon.beat()
        if (b.hp <= 0) {
          bricks.splice(j, 1)
          spawnParticles(nx, ny, b.color, 10)
          triggerShockwave(nx, ny, '#ff2fa0')
          if (!demo) {
            combo++
            score += b.points * Math.min(combo, 4)
            emit('score', score)
            maybeDropPowerup(b)
          }
        } else {
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

function roundRect(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function draw() {
  if (!ctx) return
  const demo = !gameStarted
  const PLAY_ALPHA = demo ? 0.6 : 1
  const nowSec = performance.now() / 1000

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (horizon) horizon.draw(ctx, nowSec, { dim: demo })
  else {
    ctx.fillStyle = '#0b0616'
    ctx.fillRect(0, 0, W, H)
  }

  if (shake > 0) {
    const m = shake * 6
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
  }

  ctx.globalAlpha = PLAY_ALPHA

  // Bricks: cheap glow (an expanded translucent rect), then the body
  for (const b of bricks) {
    const a = b.hp / b.maxHp
    ctx.fillStyle = b.color
    ctx.globalAlpha = PLAY_ALPHA * 0.18
    ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6)
    ctx.globalAlpha = PLAY_ALPHA * (0.55 + 0.45 * a)
    roundRect(b.x, b.y, b.w, b.h, 2)
    ctx.fill()
    if (b.maxHp > 1) {
      // A lighter inner bar for armored bricks, thinner as they take damage
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.fillRect(b.x + 3, b.y + 3, (b.w - 6) * a, 2)
    }
    if (b.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${b.flash * 0.8})`
      ctx.fillRect(b.x, b.y, b.w, b.h)
    }
  }
  ctx.globalAlpha = PLAY_ALPHA

  // Powerups
  for (const p of powerups) {
    const def = POWERUPS[p.type]
    ctx.shadowColor = def.color
    ctx.shadowBlur = 12
    ctx.fillStyle = def.color
    roundRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 4)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#0b0616'
    ctx.font = 'bold 12px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(def.label, p.x, p.y + 1)
  }

  // Shockwaves
  for (const sw of shockwaves) {
    ctx.strokeStyle = sw.color
    ctx.globalAlpha = PLAY_ALPHA * sw.life * 0.8
    ctx.lineWidth = 2 + sw.life * 6
    ctx.shadowColor = sw.color
    ctx.shadowBlur = 16 * sw.life
    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = PLAY_ALPHA

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = PLAY_ALPHA * Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = PLAY_ALPHA

  // Paddle
  if (paddle.visible) {
    const x = paddle.x - paddle.w / 2
    ctx.shadowColor = PADDLE_COLOR
    ctx.shadowBlur = 14 + paddleFlash * 16
    const grad = ctx.createLinearGradient(x, paddle.y, x + paddle.w, paddle.y)
    grad.addColorStop(0, '#1d9aa6')
    grad.addColorStop(0.5, paddleFlash > 0 ? '#ffffff' : '#c8fbff')
    grad.addColorStop(1, '#1d9aa6')
    ctx.fillStyle = grad
    roundRect(x, paddle.y, paddle.w, paddle.h, 7)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillRect(x + 8, paddle.y + 3, paddle.w - 16, 2)
  }

  // Balls
  for (const ball of balls) {
    ball.trail.forEach((t, i) => {
      const f = (i + 1) / ball.trail.length
      ctx.globalAlpha = PLAY_ALPHA * f * 0.35
      ctx.fillStyle = '#2ff3ff'
      ctx.beginPath()
      ctx.arc(t.x, t.y, BALL_RADIUS * f * 0.9, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = PLAY_ALPHA
    ctx.shadowColor = '#2ff3ff'
    ctx.shadowBlur = 18
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // Level banner
  if (levelBanner > 0 && !demo) {
    const t = Math.min(1, levelBanner / 400)
    ctx.globalAlpha = t
    ctx.fillStyle = '#ff2fa0'
    ctx.shadowColor = '#ff2fa0'
    ctx.shadowBlur = 24
    ctx.font = 'bold 32px "Courier New", monospace'
    try { ctx.letterSpacing = '0.1em' } catch (e) { /* canvas letterSpacing unsupported */ }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`LEVEL ${level}`, W / 2, H * 0.62)
    ctx.shadowBlur = 0
    try { ctx.letterSpacing = '0px' } catch (e) { /* canvas letterSpacing unsupported */ }
  }

  // Death: red vignette for ~400 ms after a lost life, on top of the shake.
  if (deathFlash > 0.01) {
    const a = deathFlash * 0.35
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7)
    g.addColorStop(0, 'rgba(255, 32, 64, 0)')
    g.addColorStop(1, `rgba(255, 32, 64, ${a.toFixed(3)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  ctx.globalAlpha = 1
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

function handleKeyDown(e) {
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
    // Start on tap, not on touchstart, so a horizontal swipe can still
    // switch theme without launching the game.
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
  height: 100dvh;
  display: block;
  z-index: 1;
}
</style>
