<template>
  <canvas ref="canvas" class="breakout-canvas"></canvas>
  <EscHold :is-active="escActive" :paused="paused" :show-paused="false" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup>
import EscHold from '../base/EscHold.vue'
/**
 * SPACE PADDLE — THE ODYSSEY. The rules are in ./engine.ts (pure, tested in
 * tests/breakout-engine.test.mjs); the look is in ./pixel.ts on Neon Shrine's
 * pixel stage. This file is the glue: the canvas, the loop, input, sound,
 * particles, and the events and numbers it reports up to Landing.vue.
 *
 * The same shell contract as before: a full-viewport canvas behind the
 * landing card. Before the run starts the canvas plays itself (attract mode)
 * so the landing is alive behind the card. `togglePause` and `quitToGameOver`
 * are exposed for the touch pause button and the pause card.
 */
const emit = defineEmits(['score', 'death', 'restart', 'started', 'lives', 'level', 'paused'])

import { createPixelStage } from '../base/pixel/stage'
import { drawBigText, bigTextWidth } from '../base/pixel/sprites'
import { boltCanvas, brickCanvas, capsuleCanvas, createOdyssey, orbCanvas, paddleCanvas, planetCanvas, ring } from './pixel'
import {
  POWER_INFO, createGame, startDemo, startRun, stepGame, resize, setPaddleX, launchBalls,
  quitRun, isOpen, mulberry32,
} from './engine'
import { safeBottom } from '../base/safeBottom'
import { useSound } from '~/composables/useSound'

const sound = useSound()

const canvas = ref(null)
let animationFrameId = null
let gameRunning = false
let W = 0
let H = 0
let dpr = 1
let stage = null // Neon Shrine's pixel stage (themes/base/pixel/stage.ts)
const odyssey = createOdyssey() // the sun and the grid (./pixel.ts)
let game = null // the rules (./engine.ts)
let flare = 0 // the sun and the neon brighten on hits and level clears
let particles = []
let shockwaves = []
let deathFlash = 0 // red edge flash after a lost life, ~0.4 s decay
let deathEmitted = false
let shake = 0
let paddleFlash = 0
let keys = {}
let lastTime = 0
let reportedScore = -1
let reportedLives = -1
let reportedLevel = -1
let reducedMotion = false
// Esc tap pauses (EscHold owns Escape); a 3 s hold quits into game over. P pauses too.
const paused = ref(false)

const CYAN = '#2ff3ff'
const PINK = '#ff2fa0'
const INK = '#0b0616'

// ---------------------------------------------------------------- run control

function playing() {
  return !!game && !game.demo && !game.over
}

function inRun() {
  return !!game && !game.demo
}

function startAttract() {
  game = game || createGame({ W, H, bandBottom: safeBottom(), rng: mulberry32((Math.random() * 2 ** 32) >>> 0) })
  startDemo(game)
  particles = []
  shockwaves = []
  deathEmitted = false
  deathFlash = 0
  paused.value = false
  keys = {}
}

function resetGame() {
  if (!canvas.value || !game) return
  startRun(game)
  game.events.length = 0
  particles = []
  shockwaves = []
  deathEmitted = false
  deathFlash = 0
  shake = 0
  paused.value = false
  keys = {}
  sound.unlock()
  sound.sfx.uiStart()
  sound.music.start('breakout')
  emit('restart')
  emit('started')
  reportedScore = -1
  reportedLives = -1
  reportedLevel = -1
  reportAll()
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
  const band = safeBottom()
  if (!game) {
    game = createGame({ W, H, bandBottom: band, rng: mulberry32((Math.random() * 2 ** 32) >>> 0) })
  } else {
    resize(game, W, H, band)
  }
  odyssey.layout(stage.vw, stage.vh, L(H * 0.62))
}

/** CSS px → logical px. */
function L(v) {
  return Math.round(v / stage.k)
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

function triggerShockwave(x, y, color = PINK) {
  shockwaves.push({ x, y, radius: 6, life: 1, color })
}

/** Turn the rules' events into sound, particles and the HUD's numbers. */
function handleEvents() {
  const ev = game.events.splice(0)
  for (const e of ev) {
    const live = inRun()
    switch (e.type) {
      case 'launch':
        if (live) sound.sfx.uiStart()
        break
      case 'wall':
        if (live) sound.sfx.wall()
        break
      case 'paddle':
        paddleFlash = 1
        flare = Math.max(flare, 0.5)
        if (live) sound.sfx.paddle()
        triggerShockwave(e.x, e.y, CYAN)
        break
      case 'shield':
        triggerShockwave(e.x, e.y, POWER_INFO.shield.color)
        spawnParticles(e.x, e.y, POWER_INFO.shield.color, 14, 200)
        if (live) sound.sfx.paddle()
        break
      case 'solid':
        triggerShockwave(e.x, e.y, CYAN)
        if (live) sound.sfx.wall()
        break
      case 'brick':
        flare = Math.max(flare, 0.35)
        spawnParticles(e.x, e.y, e.color, 4, 120)
        if (live) sound.sfx.brick()
        break
      case 'break':
        flare = Math.max(flare, 0.4)
        spawnParticles(e.x, e.y, e.color, 10)
        triggerShockwave(e.x, e.y, PINK)
        if (live) sound.sfx.brickBreak()
        break
      case 'powerup':
        spawnParticles(game.paddle.x, game.paddle.y, POWER_INFO[e.power].color, 14, 160)
        paddleFlash = 1
        if (live) {
          if (e.power === 'life') sound.sfx.extraLife()
          else sound.sfx.powerup()
        }
        break
      case 'laser':
        break // a quiet shot: no sound, the bolts show it
      case 'lost':
        if (live) {
          deathFlash = 1
          sound.sfx.lifeLost()
        }
        shake = 1
        triggerShockwave(e.x, e.y, CYAN)
        spawnParticles(e.x, e.y, '#ffffff', 24, 280)
        break
      case 'gameover':
        shake = 1
        deathFlash = 1
        triggerShockwave(e.x, e.y, CYAN)
        spawnParticles(e.x, e.y, CYAN, 40, 320)
        spawnParticles(e.x, e.y, '#ffffff', 12, 120)
        if (live) {
          sound.sfx.gameOver()
          sound.music.stop()
        }
        break
      case 'levelclear':
        flare = 1.5
        spawnParticles(W / 2, H / 2, CYAN, 30, 300)
        sound.sfx.levelClear()
        break
      case 'death':
        if (!deathEmitted) {
          deathEmitted = true
          emit('death')
        }
        break
    }
  }
}

/** The HUD's numbers, sent up only when they change. */
function reportAll() {
  if (game.score !== reportedScore) { reportedScore = game.score; emit('score', game.score) }
  if (game.lives !== reportedLives) { reportedLives = game.lives; emit('lives', game.lives) }
  if (game.level !== reportedLevel) { reportedLevel = game.level; emit('level', game.level) }
}

// ---------------------------------------------------------------- pause and quit

function escActive() {
  return playing()
}

function togglePause() {
  if (!playing()) return
  paused.value = !paused.value
  keys = {}
  if (paused.value) sound.music.stop(false)
  else sound.music.start('breakout')
  emit('paused', paused.value)
}

// A 3 s Escape hold cancels the run: the same game over as losing the last life.
function quitToGameOver() {
  if (!playing()) return
  paused.value = false
  keys = {}
  quitRun(game)
  handleEvents()
  reportAll()
}

// ---------------------------------------------------------------- update

function update(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05) || 0
  lastTime = now
  flare = Math.max(0, flare - dt * 2.5)
  const input = game.demo || game.over
    ? {}
    : { left: !!(keys.ArrowLeft || keys.KeyA), right: !!(keys.ArrowRight || keys.KeyD) }
  stepGame(game, dt, input)
  handleEvents()
  reportAll()

  shake = Math.max(0, shake - 2.5 * dt)
  deathFlash = Math.max(0, deathFlash - dt / 0.4)
  paddleFlash = Math.max(0, paddleFlash - 4 * dt)
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
}

// ---------------------------------------------------------------- draw
// Everything below draws in the stage's logical pixels; L() takes a CSS
// coordinate to the pixel grid. Lights, the orb, sparks and rings glow after
// the light map; the sky, the grid, bricks and planet are lit by it.

function drawBricks(g) {
  for (const b of game.bricks) {
    const x0 = L(b.x)
    const y0 = L(b.y)
    const w = L(b.x + b.w) - x0
    const h = L(b.y + b.h) - y0
    const pulse = b.kind === 'pulse'
    const open = !pulse || isOpen(b, game.t)
    const img = brickCanvas(w, h, b.kind, b.color, b.maxHp - b.hp, open)
    g.drawImage(img, x0, y0)
    if (b.flash > 0.05) {
      g.globalAlpha = Math.min(1, b.flash)
      g.fillStyle = '#ffffff'
      g.fillRect(x0 + 1, y0 + 1, w - 2, h - 2)
      g.globalAlpha = 1
    }
    if (open) {
      if (b.kind !== 'stone') stage.emit(x0 + 2, y0 + Math.max(2, Math.floor(h / 2)), w - 4, 1)
      stage.light(x0 + w / 2, y0 + h / 2, w * 0.6, b.color, pulse ? 0.45 : 0.25)
    }
  }
}

function drawPlanet(g) {
  const pl = game.planet
  if (!pl) return
  const img = planetCanvas(L(pl.r))
  g.drawImage(img, L(pl.x) - (img.width >> 1), L(pl.y) - (img.height >> 1))
  stage.light(L(pl.x), L(pl.y), L(pl.r) * 2.2, '#9a4ff0', 0.4)
}

function drawDrops(g) {
  for (const d of game.drops) {
    const info = POWER_INFO[d.power]
    const img = capsuleCanvas(info.label, info.color)
    g.drawImage(img, L(d.x) - (img.width >> 1), L(d.y) - (img.height >> 1))
    stage.light(L(d.x), L(d.y), 16, info.color, 0.85)
  }
}

function drawPaddle(g) {
  const p = game.paddle
  if (!p.visible) return
  const w = Math.max(6, L(p.x + p.w / 2) - L(p.x - p.w / 2))
  const h = Math.max(3, L(p.h) + 1)
  const img = paddleCanvas(w, h, paddleFlash > 0.5)
  const x = L(p.x) - (w >> 1)
  const y = L(p.y)
  g.drawImage(img, x, y)
  stage.light(L(p.x), y + 1, w * 0.8 + paddleFlash * 8, CYAN, 0.55 + paddleFlash * 0.4)
  if (game.shield) {
    // The shield line under the paddle, where a fallen ball bounces once.
    const sy = L(p.y + p.h + 10)
    stage.emit(0, sy, stage.vw, 1)
    g.fillStyle = POWER_INFO.shield.color
    g.fillRect(0, sy, stage.vw, 1)
  }
}

function drawBolts(g) {
  const img = boltCanvas()
  for (const bolt of game.bolts) {
    g.drawImage(img, L(bolt.x), L(bolt.y))
    stage.light(L(bolt.x), L(bolt.y), 8, POWER_INFO.laser.color, 0.6)
  }
}

function drawGlowing(g, nowSec) {
  // Orbs and their trails.
  const big = stage.k < 3.5
  const orb = orbCanvas(big)
  const half = orb.width >> 1
  for (const ball of game.balls) {
    g.fillStyle = CYAN
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
  if (!stage || !game) return
  const demo = game.demo
  const nowSec = performance.now() / 1000
  const g = stage.begin()
  odyssey.drawBack(g, stage, nowSec, reducedMotion)
  drawPlanet(g)
  drawBricks(g)
  drawDrops(g)
  drawBolts(g)
  drawPaddle(g)
  for (const ball of game.balls) stage.light(L(ball.x), L(ball.y), 20, CYAN, 0.95)
  for (const sw of shockwaves) stage.light(L(sw.x), L(sw.y), Math.max(4, L(sw.radius)), sw.color, sw.life * 0.5)

  // The "LEVEL n" banner in big pixel letters, blinking out over its last 0.4 s.
  const blinkOff = !reducedMotion && game.banner < 0.4 && Math.floor(nowSec * 8) % 2 === 1
  if (game.banner > 0 && !demo && !blinkOff) {
    const text = `LEVEL ${game.level}`
    const n = stage.vw > 200 ? 3 : 2
    const tw = bigTextWidth(text, n)
    drawBigText(stage.hud, text, Math.round((stage.vw - tw) / 2), Math.round(L(H * 0.62) - 3.5 * n), n, PINK, INK)
  }

  const m = shake * 6 / stage.k
  stage.present({
    // Attract mode sits darker behind the start card.
    ambient: demo ? '#6a5e9c' : '#8e80c4',
    shakeX: shake > 0 ? (Math.random() - 0.5) * m : 0,
    shakeY: shake > 0 ? (Math.random() - 0.5) * m : 0,
    afterLight: g2 => drawGlowing(g2, nowSec),
  })
}

function gameLoop(now) {
  if (!gameRunning) return
  if (paused.value) {
    // A frozen frame behind the pause card; keep the clock fresh so resume
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
    if (playing()) {
      e.preventDefault()
      togglePause()
    }
    return
  }
  keys[e.code] = true
  if (e.code === 'Space') e.preventDefault()
  if (paused.value) return
  if (!playing()) {
    if (e.code === 'Enter') resetGame()
    return
  }
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') launchBalls(game)
}

function handleKeyUp(e) {
  keys[e.code] = false
}

function handleResize() {
  setupCanvas()
}

function handleMouseMove(e) {
  if (!playing() || paused.value) return
  setPaddleX(game, e.clientX)
}

function handleMouseDown(e) {
  // A tap also sends a mousedown after touchend: it must not serve the ball the tap just started.
  if (performance.now() - lastTouchEnd < 700) return
  if (e.button !== 0 || isInteractiveElement(e.target)) return
  if (!playing() || paused.value) return // a stray click should not start a run
  launchBalls(game)
}

let touchActive = false
let tapStartX = 0
let tapStartY = 0
let tapStartTime = 0
let lastTouchEnd = -Infinity

function handleTouchStart(e) {
  if (isInteractiveElement(e.target)) return
  const t = e.touches[0]
  tapStartX = t.clientX
  tapStartY = t.clientY
  tapStartTime = performance.now()
  // Start on tap, not on touchstart, so a stray swipe does not launch the game.
  if (!playing() || paused.value) return
  touchActive = true
  setPaddleX(game, t.clientX)
}

function handleTouchMove(e) {
  if (!touchActive || paused.value) return
  if (isInteractiveElement(e.target)) return
  e.preventDefault()
  setPaddleX(game, e.touches[0].clientX)
}

function handleTouchEnd(e) {
  if (isInteractiveElement(e.target)) { touchActive = false; return }
  const t = e.changedTouches[0]
  const isTap = t && Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 15 && performance.now() - tapStartTime < 400
  if (isTap && !playing()) resetGame()
  else if (isTap && !paused.value) launchBalls(game)
  touchActive = false
  lastTouchEnd = performance.now()
}

defineExpose({ togglePause, quitToGameOver, playing: () => playing() })

onMounted(() => {
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  setupCanvas()
  startAttract()
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
