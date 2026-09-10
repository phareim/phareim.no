<template>
  <canvas ref="canvas" class="outrun-canvas"></canvas>
  <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup>
import EscHold from '../base/EscHold.vue'
/**
 * OUTRUN — an endless 1986-style checkpoint road racer in Neon Dreams paint.
 *
 * Same shell contract as the other arcade themes: a full-viewport canvas
 * behind the landing overlay, attract-mode autopilot until Enter/tap,
 * events up to Landing.vue for the HUD, Esc tap pauses and a 3 s hold quits
 * into game over, P pauses too.
 *
 * Rules: auto-accelerating rear-view car, steer with arrows/A-D or drag,
 * brake with down/S or a second finger. Dodge traffic (pink = shunt,
 * threading one = NEAR MISS bonus), keep it on the asphalt (dirt bogs the
 * car down), beat the 60 s clock to each checkpoint for +25 s. Score is
 * metres plus pass and checkpoint bonuses. No lives — the clock kills you.
 *
 * Look: a pseudo-3D segmented road (projected like the arcade originals)
 * under a striped synthwave sun, two parallax mountain ridges, neon pylons,
 * billboards and palms by the roadside, gantry arches at the start and every
 * checkpoint, and a stage palette per checkpoint (violet dusk, emerald,
 * ember, azure). All sprites are vector-drawn — no assets, no network.
 */
import {
  SEG_LEN, DRAW_DIST, ROAD_WIDTH, CAMERA_HEIGHT, FIELD_OF_VIEW,
  MAX_SPEED, totalScore, displaySpeed, createGame, stepGame,
  stageName, stagePalette, M_PER_SEG, CHECKPOINT_M,
} from './engine'

const emit = defineEmits(['score', 'distance', 'time', 'stage', 'speed', 'death', 'restart', 'started', 'over', 'quit'])

const canvas = ref(null)
let ctx = null
let animationFrameId = null
let gameRunning = false

// Viewport (CSS px).
let SW = 0
let SH = 0

const PINK = '#ff2fa0'
const CYAN = '#2ff3ff'
const GOLD = '#ffd23f'
const WHITE = '#eafcff'

const CAMERA_DEPTH = 1 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180)
const PLAYER_Z = CAMERA_HEIGHT * CAMERA_DEPTH
const HORIZON_FRAC = 0.46
const FOG_COLOR = '23, 10, 48'

const BILLBOARDS = ['NEON DREAMS', 'OUTRUN', 'TURBO', 'NIGHT DRIVE', 'PALM VEIL', 'CHECKPOINT']
const TRAFFIC_PAINTS = [
  { body: '#0e5a66', trim: CYAN, glass: '#9beeff' },
  { body: '#6b1040', trim: PINK, glass: '#ffc7e6' },
  { body: '#6b5110', trim: GOLD, glass: '#fff3c4' },
  { body: '#3a4066', trim: WHITE, glass: '#dfe6ff' },
]

let state = createGame((Math.random() * 1e9) | 0)
const gameStarted = ref(false)
const gameOver = ref(false)
const paused = ref(false)
let outroT = 0 // seconds since TIME UP, while the car coasts to a stop
let timeUpShown = false

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Transient canvas messages: { text, sub, color, t, life }.
let messages = []
let skyOffset = 0
let sunFlareT = 0
let shakeT = 0
let dust = []
let stars = []
// Sun framing, jittered once per load like the shared horizon.
const sunJitterX = (Math.random() - 0.5) * 0.16
const sunJitterY = (Math.random() - 0.5) * 0.1
let skyGrad = null
let skyGradH = 0
let vignette = null

const keys = {}
// Drag steering: one pointer steers relative to its touchdown, a second brakes.
let steerId = null
let steerStartX = 0
let brakeId = null

function horizonY() {
  return SH * HORIZON_FRAC
}

// ---------------------------------------------------------------- sizing

function setupCanvas() {
  const c = canvas.value
  if (!c) return
  SW = Math.max(320, c.clientWidth || window.innerWidth)
  SH = Math.max(320, c.clientHeight || window.innerHeight)
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  c.width = Math.round(SW * dpr)
  c.height = Math.round(SH * dpr)
  ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  skyGrad = null
  buildStars()
  buildVignette()
}

function buildStars() {
  stars = []
  const n = Math.round(Math.max(30, Math.min(90, (SW * horizonY()) / 14000)))
  for (let i = 0; i < n; i++) {
    stars.push({ x: Math.random() * SW, y: Math.random() * horizonY() * 0.94, b: 0.25 + Math.random() * 0.6, sp: 1 + Math.random() * 3, ph: Math.random() * Math.PI * 2 })
  }
}

function buildVignette() {
  vignette = ctx.createRadialGradient(SW / 2, SH * 0.55, Math.min(SW, SH) * 0.42, SW / 2, SH * 0.55, Math.max(SW, SH) * 0.75)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(3,1,10,0.5)')
}

// ------------------------------------------------------------- projection

function poly(x1, y1, x2, y2, x3, y3, x4, y4, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fill()
}

// ------------------------------------------------------------------ sky

function drawSky(now, pal) {
  const hy = horizonY()
  if (!skyGrad || skyGradH !== SH) {
    const g = ctx.createLinearGradient(0, 0, 0, hy)
    g.addColorStop(0, pal.skyTop)
    g.addColorStop(0.62, pal.skyMid)
    g.addColorStop(1, pal.skyGlow)
    skyGrad = g
    skyGradH = SH
    // Palette changes per checkpoint rebuild the cached gradient.
    skyGrad.pal = pal
  }
  if (skyGrad.pal !== pal) skyGrad = null
  if (!skyGrad) return drawSky(now, pal)
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, SW, hy + 1)

  // Stars, twinkling above the horizon.
  ctx.fillStyle = '#cfe9ff'
  for (const s of stars) {
    const tw = reducedMotion ? 0.7 : 0.5 + 0.5 * Math.sin(now * s.sp + s.ph)
    ctx.globalAlpha = Math.round(s.b * (0.35 + 0.65 * tw) * 4) / 4
    ctx.fillRect(s.x, s.y, 1.5, 1.5)
  }
  ctx.globalAlpha = 1

  // Striped sun, clipped at the horizon.
  const r = Math.min(SW * 0.2, SH * 0.13)
  if (r >= 18) {
    const cx = SW * (0.5 + sunJitterX)
    const cy = hy - r * (0.55 + sunJitterY)
    const flare = sunFlareT > 0 ? sunFlareT / 0.8 : 0
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, SW, hy)
    ctx.clip()
    const rr = r * (1 + 0.08 * flare)
    const g = ctx.createLinearGradient(0, cy - rr, 0, cy + rr)
    g.addColorStop(0, pal.sunTop)
    g.addColorStop(1, pal.sunBottom)
    ctx.globalAlpha = (SW < 600 ? 0.55 : 0.85) + flare * 0.15
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, rr, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = pal.skyMid
    let yy = cy - rr * 0.2
    while (yy < cy + rr) {
      const barH = 1 + ((yy - (cy - rr * 0.2)) / (2 * rr)) * 8
      ctx.fillRect(cx - rr, yy, rr * 2, barH)
      yy += barH + 8
    }
    ctx.restore()
  }

  // Two parallax mountain ridges, seamless over one period.
  drawRidge(hy, SH * 0.1, pal.mountainFar, skyOffset * 0.12, 3, 7)
  drawRidge(hy, SH * 0.055, pal.mountainNear, skyOffset * 0.3, 5, 13)
}

function drawRidge(hy, height, color, offset, cyclesA, cyclesB) {
  const P = SW * 2
  let off = ((offset % P) + P) % P
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(-4, hy + 2)
  for (let x = -4; x <= SW + 8; x += 8) {
    const t = ((x + off) / P) * Math.PI * 2
    const y = hy - height * (0.45 + 0.32 * Math.sin(t * cyclesA + 1.3) + 0.23 * Math.sin(t * cyclesB + 4.1))
    ctx.lineTo(x, y)
  }
  ctx.lineTo(SW + 4, hy + 2)
  ctx.closePath()
  ctx.fill()
}

// -------------------------------------------------------------- roadside

function drawPylon(x, y, w) {
  const h = w * 1.5
  ctx.fillStyle = 'rgba(47,243,255,0.25)'
  ctx.fillRect(x - w * 0.09, y - h, w * 0.18, h)
  ctx.fillStyle = CYAN
  ctx.fillRect(x - w * 0.035, y - h, w * 0.07, h)
  ctx.fillStyle = PINK
  ctx.beginPath()
  ctx.arc(x, y - h, Math.max(1.5, w * 0.06), 0, Math.PI * 2)
  ctx.fill()
}

function drawBillboard(x, y, w, segIndex) {
  const h = w * 0.5
  const legH = w * 0.35
  ctx.fillStyle = '#0b0616'
  ctx.fillRect(x - w * 0.04, y - h - legH, w * 0.08, legH)
  ctx.fillRect(x + w * 0.42, y - h - legH, w * 0.08, legH)
  ctx.fillStyle = '#120826'
  ctx.fillRect(x - w * 0.5, y - h - legH, w, h)
  ctx.strokeStyle = PINK
  ctx.lineWidth = Math.max(1, w * 0.02)
  ctx.strokeRect(x - w * 0.5, y - h - legH, w, h)
  ctx.fillStyle = GOLD
  ctx.font = `${Math.max(6, w * 0.11)}px "Space Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(BILLBOARDS[Math.floor(segIndex / 47) % BILLBOARDS.length], x, y - h / 2 - legH)
}

function drawPalm(x, y, w) {
  const h = w * 1.7
  ctx.strokeStyle = '#241423'
  ctx.lineWidth = Math.max(1.5, w * 0.09)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + w * 0.12, y - h * 0.6, x - w * 0.05, y - h)
  ctx.stroke()
  ctx.strokeStyle = CYAN
  ctx.lineWidth = Math.max(1, w * 0.045)
  for (let i = 0; i < 5; i++) {
    const a = (-0.15 + i * 0.18) * Math.PI
    ctx.beginPath()
    ctx.moveTo(x - w * 0.05, y - h)
    ctx.quadraticCurveTo(
      x - w * 0.05 + Math.cos(a) * w * 0.4, y - h - Math.sin(a) * w * 0.22,
      x - w * 0.05 + Math.cos(a) * w * 0.62, y - h - Math.sin(a) * w * 0.1 + w * 0.12,
    )
    ctx.stroke()
  }
}

function drawGantry(x, y, w, label) {
  const h = w * 0.85
  ctx.fillStyle = '#1a0f33'
  ctx.fillRect(x - w * 0.62, y - h, w * 0.1, h)
  ctx.fillRect(x + w * 0.52, y - h, w * 0.1, h)
  ctx.fillStyle = '#120826'
  ctx.fillRect(x - w * 0.62, y - h, w * 1.24, h * 0.22)
  ctx.strokeStyle = CYAN
  ctx.lineWidth = Math.max(1, w * 0.015)
  ctx.strokeRect(x - w * 0.62, y - h, w * 1.24, h * 0.22)
  ctx.fillStyle = GOLD
  ctx.font = `${Math.max(7, w * 0.09)}px "Space Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x, y - h * 0.89)
}

// ------------------------------------------------------------------ cars

function drawTrafficCar(x, y, w, paint) {
  const h = w * 0.42
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.ellipse(x, y - h * 0.04, w * 0.52, h * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
  // Body: wide rear trapezoid.
  poly(x - w * 0.5, y, x - w * 0.38, y - h * 0.62, x + w * 0.38, y - h * 0.62, x + w * 0.5, y, paint.body)
  // Cabin.
  poly(x - w * 0.26, y - h * 0.62, x - w * 0.18, y - h, x + w * 0.18, y - h, x + w * 0.26, y - h * 0.62, paint.glass)
  // Spoiler.
  ctx.fillStyle = paint.trim
  ctx.fillRect(x - w * 0.46, y - h * 0.78, w * 0.92, h * 0.09)
  ctx.fillRect(x - w * 0.46, y - h * 0.78, w * 0.06, h * 0.22)
  ctx.fillRect(x + w * 0.4, y - h * 0.78, w * 0.06, h * 0.22)
  // Taillight bar.
  ctx.fillStyle = PINK
  ctx.fillRect(x - w * 0.4, y - h * 0.34, w * 0.8, h * 0.1)
  // Wheels.
  ctx.fillStyle = '#05030c'
  ctx.fillRect(x - w * 0.55, y - h * 0.3, w * 0.12, h * 0.3)
  ctx.fillRect(x + w * 0.43, y - h * 0.3, w * 0.12, h * 0.3)
}

function drawPlayerCar(dt) {
  const w = Math.min(SW * 0.44, 360)
  const h = w * 0.4
  const bounce = reducedMotion ? 0 : Math.sin(performance.now() / 90) * Math.min(3, state.speed / MAX_SPEED * 3)
  let cx = SW / 2
  let tilt = 0
  if (keys.ArrowLeft || keys.KeyA) tilt -= 1
  if (keys.ArrowRight || keys.KeyD) tilt += 1
  if (steerId !== null) tilt += steerLean
  tilt = Math.max(-1.4, Math.min(1.4, tilt))
  cx += tilt * SW * 0.045
  if (!reducedMotion && state.crashT > 0) {
    cx += Math.sin(performance.now() / 40) * 9 * (state.crashT / 1.1)
    tilt += Math.sin(performance.now() / 55) * 0.5
  }
  const y = SH - Math.max(28, SH * 0.045) + bounce * 0.4

  ctx.save()
  ctx.translate(cx, y)
  ctx.rotate(tilt * 0.045)
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath()
  ctx.ellipse(0, -h * 0.02, w * 0.55, h * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
  // Rear tires.
  ctx.fillStyle = '#05030c'
  ctx.fillRect(-w * 0.58, -h * 0.34, w * 0.15, h * 0.32)
  ctx.fillRect(w * 0.43, -h * 0.34, w * 0.15, h * 0.32)
  // Body — low, wide, Testarossa-at-midnight-red turned neon cyan.
  poly(-w * 0.52, 0, -w * 0.42, -h * 0.6, w * 0.42, -h * 0.6, w * 0.52, 0, '#0b4a56')
  poly(-w * 0.42, -h * 0.6, -w * 0.36, -h * 0.78, w * 0.36, -h * 0.78, w * 0.42, -h * 0.6, '#0e5a66')
  // Cabin + rear glass.
  poly(-w * 0.24, -h * 0.78, -w * 0.16, -h * 1.18, w * 0.16, -h * 1.18, w * 0.24, -h * 0.78, '#0a2028')
  poly(-w * 0.2, -h * 0.82, -w * 0.14, -h * 1.1, w * 0.14, -h * 1.1, w * 0.2, -h * 0.82, '#9beeff')
  // Wing.
  ctx.fillStyle = CYAN
  ctx.fillRect(-w * 0.5, -h * 1.06, w, h * 0.09)
  ctx.fillRect(-w * 0.5, -h * 1.06, w * 0.06, h * 0.3)
  ctx.fillRect(w * 0.44, -h * 1.06, w * 0.06, h * 0.3)
  ctx.fillStyle = PINK
  ctx.fillRect(-w * 0.5, -h * 1.06, w, h * 0.025)
  // Full-width taillight bar (flares under brakes).
  const braking = keys.ArrowDown || keys.KeyS || brakeId !== null
  ctx.fillStyle = braking ? '#ffd7ec' : PINK
  ctx.fillRect(-w * 0.44, -h * 0.4, w * 0.88, h * 0.11)
  if (!reducedMotion) {
    ctx.fillStyle = 'rgba(255,47,160,0.35)'
    ctx.fillRect(-w * 0.48, -h * 0.44, w * 0.96, h * 0.19)
  }
  // Exhausts: cyan flicker at speed.
  ctx.fillStyle = CYAN
  const flame = reducedMotion ? 0 : (state.speed / MAX_SPEED) * h * 0.22 * (0.6 + 0.4 * Math.sin(performance.now() / 50))
  ctx.fillRect(-w * 0.12, -h * 0.06, w * 0.07, h * 0.06 + flame)
  ctx.fillRect(w * 0.05, -h * 0.06, w * 0.07, h * 0.06 + flame)
  ctx.restore()

  // Dust when ragged over the dirt.
  if (state.offroad && state.speed > MAX_SPEED * 0.2 && !reducedMotion && dust.length < 120) {
    for (let i = 0; i < 3; i++) {
      dust.push({ x: cx + (Math.random() - 0.5) * w, y: y - 4, vx: (Math.random() - 0.5) * 60 - tilt * 40, vy: -40 - Math.random() * 60, life: 0.7 })
    }
  }
  void dt
}

function drawDust(dt) {
  for (let i = dust.length - 1; i >= 0; i--) {
    const p = dust[i]
    p.life -= dt
    if (p.life <= 0) {
      dust.splice(i, 1)
      continue
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    ctx.globalAlpha = Math.min(0.6, p.life)
    ctx.fillStyle = '#b98a9a'
    const s = 3 + (0.7 - p.life) * 8
    ctx.fillRect(p.x, p.y, s, s)
  }
  ctx.globalAlpha = 1
}

function drawMessages(dt) {
  const cx = SW / 2
  let y = SH * 0.24
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    m.t += dt
    if (m.t > m.life) {
      messages.splice(i, 1)
      continue
    }
    const a = m.t < 0.15 ? m.t / 0.15 : m.t > m.life - 0.4 ? Math.max(0, (m.life - m.t) / 0.4) : 1
    ctx.globalAlpha = a
    ctx.textAlign = 'center'
    ctx.fillStyle = m.color
    ctx.font = `${Math.min(30, SW * 0.055)}px "Space Mono", monospace`
    ctx.fillText(m.text, cx, y)
    if (m.sub) {
      ctx.font = `${Math.min(15, SW * 0.032)}px "Space Mono", monospace`
      ctx.fillText(m.sub, cx, y + Math.min(24, SW * 0.045))
    }
    y += SH * 0.09
  }
  ctx.globalAlpha = 1
}

function pushMessage(text, sub, color, life = 2.2) {
  messages.push({ text, sub: sub || '', color, t: 0, life })
  if (messages.length > 3) messages.shift()
}

// ------------------------------------------------------------- main loop

const p1 = {}
const p2 = {}

function frame(nowMs) {
  if (!gameRunning) return
  const now = nowMs / 1000
  let dt = Math.min(0.05, now - (frame.last || now))
  frame.last = now
  if (paused.value) {
    animationFrameId = requestAnimationFrame(frame)
    return
  }

  const input = {
    left: !!(keys.ArrowLeft || keys.KeyA) || steerLean < -0.25,
    right: !!(keys.ArrowRight || keys.KeyD) || steerLean > 0.25,
    brake: !!(keys.ArrowDown || keys.KeyS) || brakeId !== null,
  }

  if (gameStarted.value && !gameOver.value) {
    const events = stepGame(state, dt, input, false)
    for (const e of events) {
      if (e.type === 'crash') {
        shakeT = 0.5
        pushMessage('CRASH!', '', PINK, 1.2)
      } else if (e.type === 'nearmiss') {
        pushMessage('NEAR MISS +150', '', GOLD, 1.4)
        sunFlareT = Math.max(sunFlareT, 0.35)
      } else if (e.type === 'checkpoint') {
        sunFlareT = 0.8
        pushMessage(`CHECKPOINT · ${stageName(e.stage)}`, '+25S · +1500', GOLD, 2.6)
      } else if (e.type === 'timeup') {
        timeUpShown = true
        outroT = 0
        pushMessage('TIME UP', '', PINK, 2.4)
        emit('over')
      }
    }
    if (timeUpShown) {
      // The clock has killed the run: coast down, then hand over.
      outroT += dt
      state.speed = Math.max(0, state.speed - MAX_SPEED * 0.7 * dt)
      state.position += state.speed * dt
      if (outroT > 2.2) {
        gameOver.value = true
        emit('death')
      }
    }
    emit('score', totalScore(state))
    emit('distance', Math.floor(state.meters))
    emit('time', Math.ceil(state.time))
    emit('stage', state.stage)
    emit('speed', displaySpeed(state))
  } else if (!gameStarted.value) {
    stepGame(state, dt, input, true)
  }

  // Camera shake decays; parallax follows the road's bend.
  shakeT = Math.max(0, shakeT - dt)
  sunFlareT = Math.max(0, sunFlareT - dt)
  const frameBase = state.segments[Math.floor(state.position / SEG_LEN)]
  if (frameBase) skyOffset += frameBase.curve * (state.speed / MAX_SPEED) * dt * SW * 0.25

  render(now, dt)
  animationFrameId = requestAnimationFrame(frame)
}

function render(now, dt) {
  const pal = stagePalette(state.stage)
  drawSky(now, pal)

  const baseSegIndex = Math.floor(state.position / SEG_LEN)
  const basePercent = (state.position % SEG_LEN) / SEG_LEN
  // Camera height follows the road under the car's nose, not under the
  // camera — that is what sells the hills.
  const noseZ = state.position + PLAYER_Z
  const noseIndex = Math.floor(noseZ / SEG_LEN)
  const nosePercent = (noseZ % SEG_LEN) / SEG_LEN
  const noseA = state.segments[noseIndex]
  const noseB = state.segments[noseIndex + 1]
  const playerY = noseA && noseB ? noseA.y + (noseB.y - noseA.y) * nosePercent : 0
  renderPlayerY = playerY
  const baseSeg = state.segments[baseSegIndex]

  let x = 0
  let dx = -(baseSeg ? baseSeg.curve * basePercent : 0)
  let maxy = SH

  const shakeX = !reducedMotion && shakeT > 0 ? (Math.random() - 0.5) * 14 * shakeT : 0
  const shakeY = !reducedMotion && shakeT > 0 ? (Math.random() - 0.5) * 10 * shakeT : 0
  ctx.save()
  ctx.translate(shakeX, shakeY)

  // One near-to-far pass: project each slice with the accumulated bend and
  // paint it. Nearer slices paint first; farther ones only touch pixels
  // above `maxy`, so hillsides occlude the road behind them and the nearest
  // slice's own ground band covers the bottom of the screen.
  const gantryEvery = Math.round(CHECKPOINT_M / M_PER_SEG)
  for (let n = 0; n < DRAW_DIST; n++) {
    const seg = state.segments[baseSegIndex + n]
    if (!seg) break
    const camX = state.playerX * ROAD_WIDTH - x
    // Two-point projection: near edge follows the accumulated bend, far
    // edge bends one curve further — that is the pseudo-3D road.
    projectRoadPoint(seg.index, camX, p1)
    projectRoadPoint(seg.index + 1, camX - dx, p2)
    x += dx
    dx += seg.curve
    if (p1.cameraZ <= CAMERA_DEPTH || p2.screenY >= p1.screenY || p2.screenY >= maxy) continue
    renderSegment(p1.screenX, p1.screenY, p1.screenW, p2.screenX, p2.screenY, p2.screenW, seg.band, pal, n)
    // Checkpoint gantry every CHECKPOINT_M metres of road.
    if (seg.index > 40 && seg.index % gantryEvery < 1) {
      drawPropClipped(3, seg.index, 0, p1, maxy, `STAGE ${Math.floor(seg.index / gantryEvery) + 1}`)
    } else {
      for (const prop of seg.props) drawPropClipped(prop.kind, seg.index, prop.offset, p1, maxy)
    }
    for (const car of carsInSegment(seg.index)) drawCarClipped(car, p1, maxy)
    maxy = p1.screenY
  }

  // (The nearest slice's own ground band reaches past the bottom edge, so
  // nothing needs painting below the road.)
  // Fog wash over the distance, then the vignette.
  const fogH = SH - horizonY()
  if (fogH > 0) {
    const g = ctx.createLinearGradient(0, horizonY(), 0, SH)
    g.addColorStop(0, `rgba(${FOG_COLOR},0.55)`)
    g.addColorStop(1, `rgba(${FOG_COLOR},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, horizonY(), SW, fogH)
  }
  if (vignette) {
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, SW, SH)
  }

  drawDust(dt)
  if (gameStarted.value) drawPlayerCar(dt)
  else drawPlayerCarIdle(now)
  ctx.restore()

  drawMessages(dt)
}

/** Camera height interpolated under the car's nose; set once per render. */
let renderPlayerY = 0

function projectRoadPoint(segIndex, camX, out) {
  const seg = state.segments[segIndex]
  if (!seg) {
    out.cameraZ = 1
    out.scale = CAMERA_DEPTH
    out.screenX = SW / 2
    out.screenY = SH
    out.screenW = 0
    return
  }
  const camY = CAMERA_HEIGHT + renderPlayerY
  const worldZ = segIndex * SEG_LEN
  const cz = worldZ - state.position
  out.cameraZ = cz
  out.scale = CAMERA_DEPTH / Math.max(1, cz)
  out.screenX = Math.round(SW / 2 + out.scale * (0 - camX) * SW / 2)
  out.screenY = Math.round(SH / 2 - out.scale * (seg.y - camY) * SH / 2)
  out.screenW = Math.round(out.scale * ROAD_WIDTH * SW / 2)
}

function renderSegment(x1, y1, w1, x2, y2, w2, band, pal, n) {
  // Ground band across the full width.
  ctx.fillStyle = band === 0 ? pal.groundA : pal.groundB
  ctx.fillRect(0, y2, SW, y1 - y2)
  // Rumble strips.
  const r1 = w1 * 1.18
  const r2 = w2 * 1.18
  poly(x1 - r1, y1, x1 + r1, y1, x2 + r2, y2, x2 - r2, y2, band === 0 ? PINK : CYAN)
  // Asphalt.
  poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, '#131022')
  // Gold lane markers on the light band: three lanes, two dividers.
  if (band === 0) {
    const lw1 = Math.max(1, w1 * 0.025)
    const lw2 = Math.max(1, w2 * 0.025)
    for (const lane of [-1 / 3, 1 / 3]) {
      const lx1 = x1 + w1 * lane
      const lx2 = x2 + w2 * lane
      poly(lx1 - lw1, y1, lx1 + lw1, y1, lx2 + lw2, y2, lx2 - lw2, y2, GOLD)
    }
  }
  // Distance fog over the slice.
  const f = Math.pow(n / DRAW_DIST, 2.2) * 0.75
  if (f > 0.02) {
    ctx.fillStyle = `rgba(${FOG_COLOR},${f.toFixed(3)})`
    ctx.fillRect(0, y2, SW, y1 - y2)
  }
}

function carsInSegment(segIndex) {
  const out = []
  const z0 = segIndex * SEG_LEN
  const z1 = z0 + SEG_LEN
  for (const car of state.cars) {
    if (car.z >= z0 && car.z < z1) out.push(car)
  }
  return out
}

function spriteScaleClipped(p, maxy, hWorld, minH) {
  const h = Math.max(minH, p.screenW * hWorld)
  if (p.screenY - h > maxy || p.screenW < 4) return 0
  return h
}

function drawPropClipped(kind, segIndex, offset, p, maxy, label) {
  const scale = p.scale
  const x = p.screenX + scale * offset * ROAD_WIDTH * SW / 2
  const y = p.screenY
  if (x < -SW * 0.3 || x > SW * 1.3) return
  if (kind === 0) {
    const h = spriteScaleClipped(p, maxy, 0.5, 8)
    if (!h) return
    drawPylon(x, y, h * 0.28)
  } else if (kind === 1) {
    const h = spriteScaleClipped(p, maxy, 0.62, 14)
    if (!h) return
    drawBillboard(x, y, h * 1.15, segIndex)
  } else if (kind === 2) {
    const h = spriteScaleClipped(p, maxy, 0.6, 12)
    if (!h) return
    drawPalm(x, y, h * 0.5)
  } else {
    const h = spriteScaleClipped(p, maxy, 0.5, 20)
    if (!h) return
    drawGantry(p.screenX, y, p.screenW * 2, label || (segIndex < 60 ? 'START' : 'CHECKPOINT'))
  }
}

function drawCarClipped(car, p, maxy) {
  const w = p.screenW * 0.44
  if (w < 6 || p.screenY - w * 0.5 > maxy) return
  const x = p.screenX + p.scale * car.offset * ROAD_WIDTH * SW / 2
  drawTrafficCar(x, p.screenY, w, TRAFFIC_PAINTS[car.color % TRAFFIC_PAINTS.length])
}

function drawPlayerCarIdle(now) {
  // The attract loop parks the camera behind a cruising ghost: draw the car
  // centred and still, over the demo's own road.
  const keepCrash = state.crashT
  state.crashT = 0
  drawPlayerCar(0)
  state.crashT = keepCrash
  void now
}

// ------------------------------------------------------------ game flow

let steerLean = 0

function startGame() {
  state = createGame((Math.random() * 1e9) | 0)
  messages = []
  dust = []
  skyOffset = 0
  outroT = 0
  timeUpShown = false
  shakeT = 0
  sunFlareT = 0
  paused.value = false
  gameOver.value = false
  gameStarted.value = true
  pushMessage('GO!', stageName(0), GOLD, 1.6)
  emit('started')
  emit('restart')
}

function endToGameOver() {
  if (!gameStarted.value || gameOver.value) return
  gameOver.value = true
  paused.value = false
  clearInput()
  emit('over')
  // A manual quit is GAME OVER, not TIME UP — the landing tells them apart.
  emit('quit')
  emit('death')
}

function quitToGameOver() {
  endToGameOver()
}

function escActive() {
  return gameStarted.value && !gameOver.value
}

function togglePause() {
  if (!gameStarted.value || gameOver.value) return
  paused.value = !paused.value
  clearInput()
}

function clearInput() {
  for (const k of Object.keys(keys)) keys[k] = false
  steerId = null
  brakeId = null
  steerLean = 0
}

function isInteractiveElement(el) {
  if (!el || !el.closest) return false
  if (el.closest('a, button, .social-links, .flip-container, .theme-pager')) return true
  return false
}

function handleKeyDown(e) {
  if (isInteractiveElement(e.target)) return
  // Escape belongs to EscHold (tap = pause, 3 s hold = quit); P pauses too.
  if (e.code === 'Escape') return
  if (e.code === 'KeyP' && !e.repeat) {
    if (gameStarted.value && !gameOver.value) {
      e.preventDefault()
      togglePause()
    }
    return
  }
  keys[e.code] = true
  if (e.code === 'Enter' && !e.repeat) {
    if (!gameStarted.value || gameOver.value) startGame()
    return
  }
  if (!gameStarted.value || gameOver.value) return
  if (e.code.startsWith('Arrow')) e.preventDefault()
  if (e.code === 'Space') e.preventDefault()
}

function handleKeyUp(e) {
  keys[e.code] = false
}

function handlePointerDown(e) {
  if (isInteractiveElement(e.target)) return
  if (!gameStarted.value || gameOver.value) {
    // Idle: remember the touch so a tap can start; swipes still change theme.
    if (e.pointerType !== 'mouse' && steerId === null) {
      steerId = e.pointerId
      steerStartX = e.clientX
      steerStartY = e.clientY
      steerStartT = performance.now()
    }
    return
  }
  if (steerId === null) {
    steerId = e.pointerId
    steerStartX = e.clientX
    steerLean = 0
  } else if (brakeId === null && e.pointerId !== steerId) {
    brakeId = e.pointerId
  }
}

let steerStartY = 0
let steerStartT = 0

function handlePointerMove(e) {
  if (e.pointerId !== steerId) return
  if (!gameStarted.value || gameOver.value) return
  steerLean = Math.max(-1, Math.min(1, (e.clientX - steerStartX) / (SW * 0.18)))
}

function handlePointerUp(e) {
  if (e.pointerId === brakeId) {
    brakeId = null
    return
  }
  if (e.pointerId !== steerId) return
  const wasIdle = !gameStarted.value || gameOver.value
  const moved = Math.hypot(e.clientX - steerStartX, (e.clientY || 0) - (steerStartY || 0))
  const quick = performance.now() - (steerStartT || 0) < 400
  steerId = null
  steerLean = 0
  if (wasIdle && (e.pointerType === 'mouse' || (moved < 15 && quick))) startGame()
}

function handlePointerCancel(e) {
  if (e.pointerId === brakeId) brakeId = null
  if (e.pointerId === steerId) {
    steerId = null
    steerLean = 0
  }
}

let resizeT = null
function debouncedResize() {
  if (resizeT) clearTimeout(resizeT)
  resizeT = setTimeout(() => {
    resizeT = null
    setupCanvas()
  }, 150)
}

onMounted(() => {
  setupCanvas()
  gameRunning = true
  frame.last = 0
  animationFrameId = requestAnimationFrame(frame)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', debouncedResize)
  window.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerCancel)
  window.addEventListener('blur', clearInput)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInput()
  })
})

onBeforeUnmount(() => {
  gameRunning = false
  clearInput()
  if (resizeT) clearTimeout(resizeT)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', debouncedResize)
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerCancel)
  window.removeEventListener('blur', clearInput)
})
</script>

<style>
.outrun-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
