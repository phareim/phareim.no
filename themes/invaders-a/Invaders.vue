<template>
  <canvas ref="canvas" class="invaders-a-canvas"></canvas>
</template>

<script setup>
/**
 * PHOSPHOR CABINET — a faithful 1978 Space Invaders formation game.
 *
 * Same shell contract as rtype/Shooter.vue and breakout/Breakout.vue: a
 * full-viewport canvas behind the landing overlay, attract-mode autopilot
 * until Enter/tap, events up to Landing.vue for the HUD.
 *
 * The cabinet look: the game is simulated on a virtual 224x256 pixel buffer
 * (near-white phosphor #dfe8df on black #050605), then tinted by horizontal
 * bands like the gel overlays on the original glass — red UFO band on top,
 * white formation band, green bunker/cannon band at the bottom. The buffer
 * is scaled up with smoothing off (chunky pixels), with scanlines, a
 * vignette, a faint ghost of the previous frame (phosphor persistence), and
 * a heartbeat pulse on every formation step. Behind the playfield: the
 * cabinet's painted moon backdrop with a static starfield.
 *
 * Rules: 5xN formation (squid 30 / crab 20 / octopus 10, two frames each),
 * sideways march + step down on edge, step timer quickens as invaders die,
 * lowest-per-column bombs (zigzag / plunger / rolling), 4 eroding bunkers
 * (3 on narrow screens), mystery UFO 50-300 pts, one player shot at a time,
 * 3 lives +1 at 1500, next wave starts one row lower, CRT power-off collapse
 * between waves.
 */
const emit = defineEmits(['score', 'wave', 'lives', 'death', 'restart', 'started'])

const canvas = ref(null)
let ctx = null
let animationFrameId = null
let gameRunning = false

// Viewport (device px) and playfield rect inside it.
let SW = 0
let SH = 0
let dpr = 1
let scale = 1
let pfX = 0
let pfY = 0
let pfW = 0
let pfH = 0

// Virtual buffer: 224x256 aspect, chunky pixels.
const VW = 224
const VH = 256
const MARGIN = 8
const CANNON_Y = 232
const BUNKER_Y = 202
const UFO_Y = 20
const UFO_BAND = 34 // y < this: red gel
const GREEN_BAND = 190 // y >= this: green gel

const PHOSPHOR = '#dfe8df'
const PHOSPHOR_DIM = '#e8f5e8'
const RED = '#ff3b30'
const GREEN = '#39ff6a'
const BG = '#050605'
const LIVES = 3
const MAX_PARTICLES = 300

let game = null // offscreen 224x256 playfield
let g = null
let ghost = null // tiny copy of the last presented frame (persistence)
let ghostCtx = null
let moon = null // full-screen prerendered lunar backdrop
let stars = []

// Gel tint by band: the coloured cellophane strips on the glass.
function bandColor(y) {
  if (y < UFO_BAND) return RED
  if (y >= GREEN_BAND) return GREEN
  return PHOSPHOR
}

// ---------------------------------------------------------------- sprites
// Exact-ish 1978 bitmaps, encoded as bit rows. Two frames per species.

const SQUID_A = [
  '...XX...',
  '..XXXX..',
  '.XXXXXX.',
  'XX.XX.XX',
  'XXXXXXXX',
  '..X..X..',
  '.X.XX.X.',
  'X.X..X.X',
]
const SQUID_B = [
  '...XX...',
  '..XXXX..',
  '.XXXXXX.',
  'XX.XX.XX',
  'XXXXXXXX',
  '.X.XX.X.',
  'X......X',
  '.X....X.',
]
const CRAB_A = [
  '..X.....X..',
  '...X...X...',
  '..XXXXXXX..',
  '.XX.XXX.XX.',
  'XXXXXXXXXXX',
  'X.XXXXXXX.X',
  'X.X.....X.X',
  '...XX.XX...',
]
const CRAB_B = [
  '..X.....X..',
  '.X.X...X.X.',
  'X.XXXXXXX.X',
  'XXX.XXX.XXX',
  'XXXXXXXXXXX',
  '.XXXXXXXXX.',
  '..X.....X..',
  '.X.......X.',
]
const OCTO_A = [
  '....XXXX....',
  '.XXXXXXXXXX.',
  'XXXXXXXXXXXX',
  'XX.XX.XX.XX.',
  'XXXXXXXXXXXX',
  '...XX..XX...',
  '..XXXXXXXX..',
  '.XX......XX.',
]
const OCTO_B = [
  '....XXXX....',
  '.XXXXXXXXXX.',
  'XXXXXXXXXXXX',
  'XX.XX.XX.XX.',
  'XXXXXXXXXXXX',
  '..XXX..XXX..',
  '.XX..XX..XX.',
  '..XX....XX..',
]
const CANNON = [
  '......X......',
  '......X......',
  '.....XXX.....',
  '.....XXX.....',
  '.XXXXXXXXXXX.',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
]
const BOOM_A = [
  'X.X.X.X.X.X.X',
  '.X.X.X.X.X.X.',
  'X.X.X.X.X.X.X',
  '.X.X.X.X.X.X.',
  'X.X.X.X.X.X.X',
  '.X.X.X.X.X.X.',
  'X.X.X.X.X.X.X',
  '..X..X.X..X..',
]
const BOOM_B = [
  '.X..X...X..X.',
  'X.X.X.X.X.X.X',
  '.X.X.X.X.X.X.',
  'X.X.X.X.X.X.X',
  '.X.X.X.X.X.X.',
  'X.X.X.X.X.X.X',
  '.X.X.X.X.X.X.',
  'X..X..X..X..X',
]
const UFO_SPRITE = [
  '.....XXXXX......',
  '...XXXXXXXXX...',
  '..XXXXXXXXXXX..',
  '..XX.XXX.XXX.XX',
  'XXXXXXXXXXXXXXXX',
  '..XXX..XXX..XXX',
  '...X....X....X..',
]

function drawSprite(rows, x, y, color) {
  g.fillStyle = color
  const xi = Math.round(x)
  const yi = Math.round(y)
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'X') g.fillRect(xi + c, yi + r, 1, 1)
    }
  }
}

function spriteW(rows) {
  return rows[0].length
}

// ---------------------------------------------------------------- state

let invaders = [] // { col, row, x, y, species, pts, alive }
let cols = 11
let cellW = 18
let cellH = 16
let formX = 0 // virtual x of formation left edge
let formY = 52
let formDir = 1
let formFrame = 0
let stepT = 0 // ms until next march step
let totalInWave = 0
let wave = 1
let score = 0
let lastScoreSent = -1
let hiScore = 0
let lives = LIVES
let nextExtraAt = 1500
let cannonX = VW / 2
let shot = null // { x, y } — one player shot at a time
let fireCooldown = 0
let bombs = [] // { x, y, vy, type, phase }
let bombT = 1.2
let bunkers = [] // { x, grid:Uint8Array, cv, bctx, dirty }
let ufo = null // { x, dir }
let ufoT = 4
let popups = [] // { x, y, text, t }
let particles = []
let shockwaves = []
let pulse = 0 // heartbeat: 1 on each formation step, decays
let trickleT = 0
let gameStarted = false
let gameOver = false
let dying = false // cannon explosion freeze (~1 s, formation stops)
let deathT = 0
let deathAt = 0
let deathEmitted = false
let respawnAt = 0
let invulnUntil = 0
let fx = null // { mode:'collapse'|'fadein', t } — CRT power-off between waves
let elapsed = 0
let lastTime = 0
let keys = {}
let touchPlaying = false
let touchVX = VW / 2
let tapStartX = 0
let tapStartY = 0
let tapStartTime = 0

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

// ---------------------------------------------------------------- setup

function setupCanvas() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  SW = c.offsetWidth
  SH = c.offsetHeight
  c.width = Math.round(SW * dpr)
  c.height = Math.round(SH * dpr)
  ctx = c.getContext('2d')
  scale = Math.min(SW / VW, SH / VH)
  pfW = VW * scale
  pfH = VH * scale
  pfX = (SW - pfW) / 2
  pfY = (SH - pfH) / 2
  if (!game) {
    game = document.createElement('canvas')
    game.width = VW
    game.height = VH
    g = game.getContext('2d')
    ghost = document.createElement('canvas')
    ghost.width = 112
    ghost.height = 128
    ghostCtx = ghost.getContext('2d')
  }
  initStars()
  renderMoon()
}

function initStars() {
  stars = []
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random() * 0.92,
      r: Math.random() < 0.85 ? 1 : 2,
      ph: Math.random() * Math.PI * 2,
      sp: 0.5 + Math.random() * 2,
    })
  }
}

function renderMoon() {
  moon = document.createElement('canvas')
  moon.width = Math.max(1, Math.round(SW))
  moon.height = Math.max(1, Math.round(SH))
  const m = moon.getContext('2d')
  const grad = m.createLinearGradient(0, 0, 0, moon.height)
  grad.addColorStop(0, '#050605')
  grad.addColorStop(0.75, '#07090d')
  grad.addColorStop(1, '#0d1220')
  m.fillStyle = grad
  m.fillRect(0, 0, moon.width, moon.height)
  // Lunar horizon: two rolling grey-blue ridges near the bottom edge.
  const hz = moon.height * 0.94
  m.fillStyle = '#101623'
  m.beginPath()
  m.moveTo(0, moon.height)
  for (let x = 0; x <= moon.width; x += 8) {
    m.lineTo(x, hz - 14 + Math.sin(x * 0.008 + 1.2) * 10 + Math.sin(x * 0.027) * 4)
  }
  m.lineTo(moon.width, moon.height)
  m.closePath()
  m.fill()
  m.fillStyle = '#18202f'
  m.beginPath()
  m.moveTo(0, moon.height)
  for (let x = 0; x <= moon.width; x += 8) {
    m.lineTo(x, hz + 6 + Math.sin(x * 0.011 + 4.0) * 7 + Math.sin(x * 0.033 + 2) * 3)
  }
  m.lineTo(moon.width, moon.height)
  m.closePath()
  m.fill()
  // Craters: dark dimples with a faint lit rim on the near ridge.
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 9; i++) {
    const cx = rnd() * moon.width
    const cy = hz + 2 + rnd() * (moon.height - hz - 6)
    const rx = 6 + rnd() * 22
    const ry = rx * (0.3 + rnd() * 0.15)
    m.fillStyle = 'rgba(0,0,0,0.4)'
    m.beginPath()
    m.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    m.fill()
    m.strokeStyle = 'rgba(120,140,170,0.14)'
    m.lineWidth = 1
    m.beginPath()
    m.ellipse(cx, cy - 1, rx, ry, 0, Math.PI, Math.PI * 2)
    m.stroke()
  }
}

// ---------------------------------------------------------------- waves

function layoutColumns() {
  // Fewer columns on narrow screens so the formation always fits with margins.
  cols = SW < 560 ? 7 : 11
  cellW = (VW - MARGIN * 2) / cols
  cellH = 16
}

function speciesForRow(row) {
  if (row === 0) return { rows: SQUID_A, rowsB: SQUID_B, pts: 30 }
  if (row <= 2) return { rows: CRAB_A, rowsB: CRAB_B, pts: 20 }
  return { rows: OCTO_A, rowsB: OCTO_B, pts: 10 }
}

function buildWave(startY) {
  layoutColumns()
  invaders = []
  for (let row = 0; row < 5; row++) {
    const sp = speciesForRow(row)
    for (let col = 0; col < cols; col++) {
      invaders.push({ col, row, species: sp, pts: sp.pts, alive: true })
    }
  }
  totalInWave = invaders.length
  formX = MARGIN
  formY = startY
  formDir = 1
  formFrame = 0
  stepT = stepInterval()
  buildBunkers()
}

function invaderXY(inv) {
  const sp = formFrame === 0 ? inv.species.rows : inv.species.rowsB
  const w = spriteW(sp)
  return {
    x: formX + inv.col * cellW + (cellW - w) / 2,
    y: formY + inv.row * cellH,
    w,
    h: 8,
  }
}

function aliveCount() {
  let n = 0
  for (let i = 0; i < invaders.length; i++) if (invaders[i].alive) n++
  return n
}

function stepInterval() {
  // The classic heartbeat: full formation plods, the last one is frantic.
  const alive = Math.max(1, aliveCount())
  const base = 45 + 560 * (alive / totalInWave)
  return Math.max(40, base / (1 + (wave - 1) * 0.12))
}

// ---------------------------------------------------------------- bunkers

const BW = 22
const BH = 16

function bunkerSolid(x, y) {
  if (x < 0 || y < 0 || x >= BW || y >= BH) return false
  if (x + y < 4 || (BW - 1 - x) + y < 4) return false // rounded shoulders
  if (y >= 9 && Math.abs(x - 10.5) < y - 8) return false // arch notch
  return true
}

function buildBunkers() {
  bunkers = []
  const narrow = SW < 560
  const n = narrow ? 3 : 4
  for (let i = 0; i < n; i++) {
    const cx = VW * ((i + 1) / (n + 1))
    const grid = new Uint8Array(BW * BH)
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        grid[y * BW + x] = bunkerSolid(x, y) ? 1 : 0
      }
    }
    const cv = document.createElement('canvas')
    cv.width = BW
    cv.height = BH
    const bctx = cv.getContext('2d')
    const b = { x: Math.round(cx - BW / 2), y: BUNKER_Y, grid, cv, bctx }
    renderBunker(b)
    bunkers.push(b)
  }
}

function renderBunker(b) {
  b.bctx.clearRect(0, 0, BW, BH)
  b.bctx.fillStyle = GREEN
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      if (b.grid[y * BW + x]) b.bctx.fillRect(x, y, 1, 1)
    }
  }
}

// Subtract a splat mask at virtual point (vx, vy). Returns true if changed.
function erodeAt(b, vx, vy, r) {
  let changed = false
  const x0 = Math.floor(vx - b.x - r)
  const x1 = Math.ceil(vx - b.x + r)
  const y0 = Math.floor(vy - b.y - r)
  const y1 = Math.ceil(vy - b.y + r)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= BW || y >= BH) continue
      const dx = x + 0.5 - (vx - b.x)
      const dy = (y + 0.5 - (vy - b.y)) * 1.3
      if (dx * dx + dy * dy < r * r && b.grid[y * BW + x]) {
        b.grid[y * BW + x] = 0
        changed = true
      }
    }
  }
  if (changed) renderBunker(b)
  return changed
}

function bunkerAt(vx, vy) {
  for (let i = 0; i < bunkers.length; i++) {
    const b = bunkers[i]
    if (vx >= b.x && vx < b.x + BW && vy >= b.y && vy < b.y + BH) return b
  }
  return null
}

// Invaders that reach the bunkers eat through them on every step.
function eatBunkers() {
  for (let bi = 0; bi < bunkers.length; bi++) {
    const b = bunkers[bi]
    let changed = false
    for (let i = 0; i < invaders.length; i++) {
      const inv = invaders[i]
      if (!inv.alive) continue
      const p = invaderXY(inv)
      const ox0 = Math.max(0, Math.floor(p.x - b.x))
      const ox1 = Math.min(BW - 1, Math.ceil(p.x + p.w - b.x))
      const oy0 = Math.max(0, Math.floor(p.y - b.y))
      const oy1 = Math.min(BH - 1, Math.ceil(p.y + p.h - b.y))
      for (let y = oy0; y <= oy1; y++) {
        for (let x = ox0; x <= ox1; x++) {
          if (b.grid[y * BW + x]) {
            b.grid[y * BW + x] = 0
            changed = true
          }
        }
      }
    }
    if (changed) renderBunker(b)
  }
}

// ---------------------------------------------------------------- flow

function resetGame() {
  wave = 1
  score = 0
  lastScoreSent = -1
  lives = LIVES
  nextExtraAt = 1500
  cannonX = VW / 2
  shot = null
  bombs = []
  bombT = 1.2
  ufo = null
  ufoT = 4
  popups = []
  particles = []
  shockwaves = []
  pulse = 0
  trickleT = 0
  elapsed = 0
  gameOver = false
  dying = false
  deathEmitted = false
  fx = null
  invulnUntil = 0
  fireCooldown = 0
  buildWave(52)
  gameStarted = true
  emit('restart')
  emit('started')
  emit('score', 0)
  emit('wave', wave)
  emit('lives', lives)
}

// Attract mode: the cabinet plays itself behind the card until Enter/tap.
function startDemo() {
  gameStarted = false
  gameOver = false
  dying = false
  wave = 1
  score = 0
  lives = LIVES
  cannonX = VW / 2
  shot = null
  bombs = []
  bombT = 1.4
  ufo = null
  ufoT = 4
  popups = []
  particles = []
  shockwaves = []
  fx = null
  elapsed = 0
  buildWave(52)
}

function addScore(n) {
  score += n
  if (score >= nextExtraAt && gameStarted && !gameOver) {
    // +1 life at 1500 (then every 1500 after).
    lives = Math.min(6, lives + 1)
    nextExtraAt += 1500
    emit('lives', lives)
  }
  if (score > hiScore) hiScore = score
  if (gameStarted && score !== lastScoreSent) {
    lastScoreSent = score
    emit('score', score)
  }
}

// ---------------------------------------------------------------- effects

function spawnParticles(x, y, color, count, spread) {
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) particles.shift()
    const a = Math.random() * Math.PI * 2
    const s = 8 + Math.random() * (spread || 40)
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      decay: 1.6 + Math.random() * 1.8,
      size: Math.random() < 0.5 ? 1 : 2,
      color,
    })
  }
}

function triggerShockwave(x, y, color) {
  shockwaves.push({ x, y, radius: 2, life: 1, color: color || PHOSPHOR })
}

function explodeAt(x, y, big) {
  const c = bandColor(y)
  spawnParticles(x, y, '#ffffff', big ? 8 : 5, 30)
  spawnParticles(x, y, c, big ? 18 : 10, 55)
  triggerShockwave(x, y, c)
}

function onCannonHit(now) {
  if (now < invulnUntil || dying || gameOver) return
  if (!gameStarted) {
    // Autopilot got clipped: blow up quietly, the show goes on.
    dying = true
    deathT = 1.0
    explodeAt(cannonX, CANNON_Y, true)
    return
  }
  dying = true
  deathT = 1.0 // ~1 s freeze: the formation stops while the cannon burns
  explodeAt(cannonX, CANNON_Y, true)
}

function settleDeath(now) {
  dying = false
  if (!gameStarted) {
    cannonX = VW / 2
    invulnUntil = now + 2
    return
  }
  lives--
  emit('lives', lives)
  if (lives <= 0) {
    gameOver = true
    deathAt = now
  } else {
    cannonX = VW / 2
    shot = null
    respawnAt = now
    invulnUntil = now + 2.5
  }
}

function onInvaded(now) {
  // An invader reached the player row: game over, like the original.
  if (gameOver) return
  explodeAt(cannonX, CANNON_Y, true)
  if (!gameStarted) {
    buildWave(52) // attract mode just resets the show
    return
  }
  gameOver = true
  deathAt = now
}

// ---------------------------------------------------------------- update

function autopilot(dt, now) {
  // Track the lowest invader in the nearest column; dodge falling bombs.
  let target = null
  let bestRow = -1
  let bestDist = Infinity
  for (let i = 0; i < invaders.length; i++) {
    const inv = invaders[i]
    if (!inv.alive) continue
    const p = invaderXY(inv)
    const cx = p.x + p.w / 2
    const d = Math.abs(cx - cannonX)
    if (inv.row > bestRow || (inv.row === bestRow && d < bestDist)) {
      bestRow = inv.row
      bestDist = d
      target = cx
    }
  }
  let tx = target === null ? VW / 2 + Math.sin(now * 0.6) * 40 : target
  for (let i = 0; i < bombs.length; i++) {
    const b = bombs[i]
    if (b.y < CANNON_Y && b.y > CANNON_Y - 70 && Math.abs(b.x - cannonX) < 12) {
      tx = cannonX < b.x ? cannonX - 30 : cannonX + 30
      break
    }
  }
  tx = clamp(tx, 10, VW - 10)
  const dx = tx - cannonX
  cannonX += clamp(dx, -1, 1) * 110 * Math.min(1, Math.abs(dx) / 8 + 0.3) * dt
  cannonX = clamp(cannonX, 10, VW - 10)
  fireCooldown -= dt
  if (!shot && fireCooldown <= 0) {
    shot = { x: cannonX, y: CANNON_Y - 9 }
    fireCooldown = 0.35
  }
}

function lowestInColumn(col) {
  let best = null
  for (let i = 0; i < invaders.length; i++) {
    const inv = invaders[i]
    if (inv.alive && inv.col === col && (!best || inv.row > best.row)) best = inv
  }
  return best
}

function dropBomb() {
  const occupied = []
  for (let c = 0; c < cols; c++) {
    if (lowestInColumn(c)) occupied.push(c)
  }
  if (!occupied.length) return
  const col = occupied[Math.floor(Math.random() * occupied.length)]
  const inv = lowestInColumn(col)
  const p = invaderXY(inv)
  const type = Math.floor(Math.random() * 3) // 0 zigzag, 1 plunger, 2 rolling
  const speedMul = Math.min(1.5, 1 + (wave - 1) * 0.08)
  bombs.push({
    x: p.x + p.w / 2,
    y: p.y + 8,
    vy: (type === 1 ? 58 : type === 0 ? 44 : 50) * speedMul,
    type,
    phase: Math.random() * Math.PI * 2,
  })
}

function killInvader(inv, x, y) {
  inv.alive = false
  addScore(inv.pts)
  const p = invaderXY(inv)
  explodeAt(p.x + p.w / 2, p.y + 4, false)
  if (aliveCount() === 0) {
    // Whole screen does a CRT power-off collapse; next wave fades in lower.
    fx = { mode: 'collapse', t: 0 }
  }
}

function updateFormation(dt, now) {
  stepT -= dt * 1000
  if (stepT > 0) return
  stepT = stepInterval()
  formFrame ^= 1
  pulse = 1 // heartbeat: the background throbs on every step
  // Edge check across live invaders.
  let left = Infinity
  let right = -Infinity
  for (let i = 0; i < invaders.length; i++) {
    const inv = invaders[i]
    if (!inv.alive) continue
    const p = invaderXY(inv)
    if (p.x < left) left = p.x
    if (p.x + p.w > right) right = p.x + p.w
  }
  if (left === Infinity) return
  const step = 2
  if ((formDir > 0 && right + step > VW - MARGIN) || (formDir < 0 && left - step < MARGIN)) {
    formY += 8
    formDir *= -1
    eatBunkers()
    for (let i = 0; i < invaders.length; i++) {
      const inv = invaders[i]
      if (!inv.alive) continue
      const p = invaderXY(inv)
      if (p.y + p.h >= CANNON_Y - 2) {
        onInvaded(now)
        return
      }
    }
  } else {
    formX += formDir * step
  }
}

function update(nowMs) {
  const now = nowMs / 1000
  let dt = (nowMs - lastTime) / 1000
  if (!(dt > 0)) dt = 0.016
  dt = Math.min(dt, 0.05) // clamp to 50 ms: frame-rate independent
  lastTime = nowMs
  const demo = !gameStarted
  elapsed += dt
  pulse = Math.max(0, pulse - dt * 3)

  // Particles / shockwaves / popups always tick (explosions play out).
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.98
    p.vy *= 0.98
    p.life -= p.decay * dt
    if (p.life <= 0) particles.splice(i, 1)
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]
    sw.radius += 60 * dt
    sw.life -= 2.2 * dt
    if (sw.life <= 0) shockwaves.splice(i, 1)
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    popups[i].t += dt
    if (popups[i].t > 1.4) popups.splice(i, 1)
  }

  // CRT power-off collapse, then the next wave fades in one row lower.
  if (fx) {
    fx.t += dt
    if (fx.mode === 'collapse' && fx.t > 0.7) {
      wave++
      if (!demo) emit('wave', wave)
      buildWave(Math.min(52 + (wave - 1) * 8, 110))
      fx = { mode: 'fadein', t: 0 }
    } else if (fx.mode === 'fadein' && fx.t > 0.6) {
      fx = null
    }
    return
  }

  // Cannon explosion freeze: the formation stops, like the original.
  if (dying) {
    deathT -= dt
    if (deathT <= 0) settleDeath(now)
    return
  }

  // Delayed death emit so the explosion plays out.
  if (gameOver && !deathEmitted && now - deathAt > 0.9) {
    deathEmitted = true
    emit('death')
    return
  }
  if (gameOver) return

  // Cannon movement.
  if (demo) {
    autopilot(dt, now)
  } else {
    const lf = keys['ArrowLeft'] || keys['KeyA']
    const rt = keys['ArrowRight'] || keys['KeyD']
    const dir = (rt ? 1 : 0) - (lf ? 1 : 0)
    if (touchPlaying) {
      const dx = touchVX - cannonX
      cannonX += clamp(dx, -1, 1) * 200 * Math.min(1, Math.abs(dx) / 6 + 0.25) * dt
    } else if (dir) {
      cannonX += dir * 100 * dt
    }
    cannonX = clamp(cannonX, 10, VW - 10)
    fireCooldown -= dt
    if (!shot && fireCooldown <= 0 && (keys['__fireheld'] || touchPlaying)) {
      shot = { x: cannonX, y: CANNON_Y - 9 }
      fireCooldown = 0.25
    }
  }

  updateFormation(dt, now)
  if (gameOver) return

  // Score trickles up the whole time.
  if (!demo) {
    trickleT += dt
    if (trickleT > 2) {
      trickleT = 0
      addScore(1)
    }
  }

  // Mystery UFO crosses the top every ~20-30 s.
  if (!ufo) {
    ufoT -= dt
    if (ufoT <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1
      ufo = { x: dir > 0 ? -16 : VW + 16, dir }
    }
  } else {
    ufo.x += ufo.dir * 42 * dt
    if ((ufo.dir > 0 && ufo.x > VW + 16) || (ufo.dir < 0 && ufo.x < -16)) {
      ufo = null
      ufoT = 20 + Math.random() * 10
    }
  }

  // Bombs: lowest invader per random occupied column drops one.
  bombT -= dt
  const maxBombs = Math.min(4, 2 + (wave > 2 ? 1 : 0) + (aliveCount() < 10 ? 1 : 0))
  if (bombT <= 0) {
    bombT = Math.max(0.35, 1.1 - wave * 0.08) * (0.7 + Math.random() * 0.6)
    if (bombs.length < maxBombs) dropBomb()
  }
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i]
    b.y += b.vy * dt
    b.phase += dt * 6
    let bx = b.x
    if (b.type === 0) bx = b.x + Math.sin(b.phase) * 4 // zigzag
    if (b.type === 2) bx = b.x + Math.sin(b.phase * 0.6) * 6 // rolling
    if (b.y > VH - 4) {
      bombs.splice(i, 1)
      continue
    }
    // Bunkers eat bombs (and erode).
    const bb = bunkerAt(bx, b.y)
    if (bb) {
      erodeAt(bb, bx, b.y, 3)
      spawnParticles(bx, b.y, GREEN, 3, 18)
      bombs.splice(i, 1)
      continue
    }
    // Cannon hit.
    if (b.y > CANNON_Y - 8 && b.y < CANNON_Y + 4 && Math.abs(bx - cannonX) < 7) {
      bombs.splice(i, 1)
      onCannonHit(now)
      continue
    }
    // Player shot cancels the bomb.
    if (shot && Math.abs(shot.x - bx) < 3 && Math.abs(shot.y - b.y) < 5) {
      spawnParticles(bx, b.y, bandColor(b.y), 6, 25)
      bombs.splice(i, 1)
      shot = null
    }
  }

  // Player shot: one on screen at a time, fire again only after it is gone.
  if (shot) {
    shot.y -= 175 * dt
    if (shot.y < UFO_BAND - 6) {
      shot = null
    } else {
      // UFO first (it flies above everything).
      if (ufo && shot.y < UFO_Y + 8 && shot.y > UFO_Y - 4 && shot.x > ufo.x && shot.x < ufo.x + 16) {
        const val = [50, 100, 150, 300][Math.floor(Math.random() * 4)]
        addScore(val)
        popups.push({ x: ufo.x + 8, y: UFO_Y, text: String(val), t: 0 })
        explodeAt(ufo.x + 8, UFO_Y + 3, true)
        ufo = null
        ufoT = 20 + Math.random() * 10
        shot = null
      } else {
        // Invaders.
        let hit = false
        for (let i = 0; i < invaders.length; i++) {
          const inv = invaders[i]
          if (!inv.alive) continue
          const p = invaderXY(inv)
          if (shot.x >= p.x && shot.x <= p.x + p.w && shot.y >= p.y && shot.y <= p.y + p.h) {
            killInvader(inv, shot.x, shot.y)
            hit = true
            break
          }
        }
        if (hit) {
          shot = null
        } else {
          // Bunkers block the shot from below (and erode).
          const sb = bunkerAt(shot.x, shot.y)
          if (sb) {
            erodeAt(sb, shot.x, shot.y, 3)
            spawnParticles(shot.x, shot.y, GREEN, 3, 18)
            shot = null
          }
        }
      }
    }
  }

  // Attract mode resets the show instead of ending it.
  if (demo) {
    if (aliveCount() === 0 && !fx) buildWave(52)
    let invaded = false
    for (let i = 0; i < invaders.length; i++) {
      const inv = invaders[i]
      if (!inv.alive) continue
      const p = invaderXY(inv)
      if (p.y + p.h >= CANNON_Y - 2) {
        invaded = true
        break
      }
    }
    if (invaded) buildWave(52)
  }
}

// ---------------------------------------------------------------- draw

function drawBombShape(bx, y, type, phase) {
  const x = Math.round(bx)
  const yy = Math.round(y)
  if (type === 0) {
    // Zigzag: alternating pixels.
    g.fillStyle = bandColor(y)
    const f = Math.floor(phase) % 2
    for (let r = 0; r < 7; r++) {
      g.fillRect(x + ((r + f) % 2 ? 1 : -1), yy + r, 2, 1)
    }
  } else if (type === 1) {
    // Plunger: bar, stem, claws.
    g.fillStyle = bandColor(y)
    const f = Math.floor(phase) % 2
    g.fillRect(x - 1, yy, 3, 1)
    g.fillRect(x, yy + 1, 1, 4)
    if (f === 0) {
      g.fillRect(x - 1, yy + 5, 1, 2)
      g.fillRect(x + 1, yy + 5, 1, 2)
    } else {
      g.fillRect(x - 1, yy + 5, 3, 1)
    }
  } else {
    // Rolling: tumbling block.
    g.fillStyle = bandColor(y)
    const f = Math.floor(phase) % 2
    if (f === 0) {
      g.fillRect(x - 2, yy, 4, 1)
      g.fillRect(x - 1, yy + 1, 2, 4)
      g.fillRect(x - 2, yy + 5, 4, 1)
    } else {
      g.fillRect(x - 1, yy, 3, 1)
      g.fillRect(x - 2, yy + 1, 4, 4)
      g.fillRect(x - 1, yy + 5, 3, 1)
    }
  }
}

function drawGame(now) {
  g.fillStyle = BG
  g.fillRect(0, 0, VW, VH)
  g.textBaseline = 'top'

  // HUD in chunky monospace (the 5x7 pixel-font look, canvas fallback).
  g.font = 'bold 7px "Courier New", monospace'
  g.textAlign = 'left'
  g.fillStyle = RED
  g.fillText('SCORE ' + String(score).padStart(4, '0'), 8, 4)
  g.textAlign = 'center'
  g.fillText('HI ' + String(Math.max(hiScore, score)).padStart(4, '0'), VW / 2, 4)
  g.textAlign = 'right'
  g.fillText('W' + wave, VW - 8, 4)
  g.textAlign = 'left'
  // Ground line above the moon paint.
  g.fillStyle = GREEN
  g.fillRect(MARGIN, VH - 8, VW - MARGIN * 2, 1)

  // Bunkers.
  for (let i = 0; i < bunkers.length; i++) {
    const b = bunkers[i]
    g.drawImage(b.cv, b.x, b.y)
  }

  // Formation.
  for (let i = 0; i < invaders.length; i++) {
    const inv = invaders[i]
    if (!inv.alive) continue
    const sp = formFrame === 0 ? inv.species.rows : inv.species.rowsB
    const p = invaderXY(inv)
    drawSprite(sp, p.x, p.y, bandColor(p.y + 4))
  }

  // UFO.
  if (ufo) drawSprite(UFO_SPRITE, ufo.x, UFO_Y, RED)

  // Bombs.
  for (let i = 0; i < bombs.length; i++) {
    const b = bombs[i]
    let bx = b.x
    if (b.type === 0) bx = b.x + Math.sin(b.phase) * 4
    if (b.type === 2) bx = b.x + Math.sin(b.phase * 0.6) * 6
    drawBombShape(bx, b.y, b.type, b.phase)
  }

  // Player shot: a single white-green bolt.
  if (shot) {
    g.fillStyle = bandColor(shot.y)
    g.fillRect(Math.round(shot.x), Math.round(shot.y - 4), 1, 7)
  }

  // Cannon (blinks while invulnerable) or its explosion frames.
  if (dying) {
    const rows = Math.floor(now * 12) % 2 === 0 ? BOOM_A : BOOM_B
    drawSprite(rows, cannonX - 6, CANNON_Y - 8, bandColor(CANNON_Y))
  } else if (!gameOver) {
    const blink = now < invulnUntil && Math.floor(now * 10) % 2 === 0
    if (!blink) drawSprite(CANNON, cannonX - 6, CANNON_Y - 8, GREEN)
  }

  // Shockwaves: expanding phosphor rings.
  for (let i = 0; i < shockwaves.length; i++) {
    const sw = shockwaves[i]
    g.globalAlpha = Math.max(0, sw.life) * 0.8
    g.strokeStyle = sw.color
    g.lineWidth = 1
    g.beginPath()
    g.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
    g.stroke()
  }
  g.globalAlpha = 1

  // Particles.
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    g.globalAlpha = Math.max(0, p.life)
    g.fillStyle = p.color
    g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
  }
  g.globalAlpha = 1

  // Mystery score popups where the UFO died.
  g.font = 'bold 7px "Courier New", monospace'
  g.textAlign = 'center'
  for (let i = 0; i < popups.length; i++) {
    const pp = popups[i]
    g.globalAlpha = Math.max(0, 1 - pp.t / 1.4)
    g.fillStyle = RED
    g.fillText(pp.text, pp.x, pp.y - pp.t * 10)
  }
  g.globalAlpha = 1
  g.textAlign = 'left'
}

function draw(nowMs) {
  if (!ctx) return
  const now = nowMs / 1000
  drawGame(now)

  // Backdrop: moon paint + twinkling starfield, full viewport.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, SW, SH)
  if (moon) ctx.drawImage(moon, 0, 0, SW, SH)
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i]
    const a = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(now * s.sp + s.ph)) + pulse * 0.15
    ctx.fillStyle = 'rgba(200,215,230,' + clamp(a, 0, 0.7).toFixed(3) + ')'
    ctx.fillRect(s.x * SW, s.y * SH, s.r, s.r)
  }

  // Phosphor persistence: ghost of the previous frame at ~8 % alpha.
  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(ghost, pfX, pfY, pfW, pfH)
  ctx.restore()

  // The playfield: buffer scaled up, smoothing off for chunky pixels.
  ctx.imageSmoothingEnabled = false
  if (fx && fx.mode === 'collapse') {
    // CRT power-off: white line collapse.
    const p = clamp(fx.t / 0.7, 0, 1)
    const dh = Math.max(1, pfH * (1 - p))
    const dy = pfY + (pfH - dh) / 2
    ctx.save()
    ctx.globalAlpha = 1 - p * 0.5
    ctx.drawImage(game, pfX, dy, pfW, dh)
    ctx.restore()
    ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + p * 0.6).toFixed(3) + ')'
    ctx.fillRect(pfX, pfY + pfH / 2 - 1, pfW, 2)
  } else if (fx && fx.mode === 'fadein') {
    ctx.save()
    ctx.globalAlpha = clamp(fx.t / 0.6, 0, 1)
    ctx.drawImage(game, pfX, pfY, pfW, pfH)
    ctx.restore()
  } else {
    ctx.drawImage(game, pfX, pfY, pfW, pfH)
  }
  // Remember this frame for the next ghost.
  try {
    ghostCtx.drawImage(
      canvas.value,
      Math.round(pfX * dpr), Math.round(pfY * dpr),
      Math.round(pfW * dpr), Math.round(pfH * dpr),
      0, 0, 112, 128,
    )
  } catch (e) { /* canvas not ready yet */ }

  // Heartbeat: the background throbs on every formation step.
  if (pulse > 0) {
    ctx.fillStyle = 'rgba(223,232,223,' + (pulse * 0.045).toFixed(3) + ')'
    ctx.fillRect(pfX, pfY, pfW, pfH)
  }

  // Scanlines: every 2nd device row ~25 % darker.
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  for (let y = 0; y < SH; y += 2) {
    ctx.fillRect(0, y, SW, 1)
  }

  // Soft vignette.
  const vg = ctx.createRadialGradient(
    SW / 2, SH / 2, Math.min(SW, SH) * 0.42,
    SW / 2, SH / 2, Math.max(SW, SH) * 0.75,
  )
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, SW, SH)
}

function gameLoop(now) {
  if (!gameRunning) return
  update(now)
  draw(now)
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

function tryFire() {
  if (!gameStarted || gameOver || dying) return
  if (!shot) {
    shot = { x: cannonX, y: CANNON_Y - 9 }
    fireCooldown = 0.25
  }
}

function handleKeyDown(e) {
  keys[e.code] = true
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault()
    if (!e.repeat) {
      if (!gameStarted || gameOver) resetGame()
      else {
        keys['__fireheld'] = true
        tryFire()
      }
    }
  }
  if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && gameStarted && !gameOver) {
    e.preventDefault()
  }
  if (!gameStarted || gameOver) {
    if (e.code === 'Enter') resetGame()
  }
}

function handleKeyUp(e) {
  keys[e.code] = false
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    keys['__fireheld'] = false
  }
}

function handleResize() {
  setupCanvas()
  layoutColumns()
  buildBunkers()
  cannonX = clamp(cannonX, 10, VW - 10)
}

function clientToVirtual(cx) {
  const rect = canvas.value.getBoundingClientRect()
  return (cx - rect.left - pfX) / scale
}

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
  touchPlaying = true
  touchVX = clamp(clientToVirtual(t.clientX), 10, VW - 10)
}

function handleTouchMove(e) {
  if (!touchPlaying) return
  if (isInteractiveElement(e.target)) return
  e.preventDefault()
  const t = e.touches[0]
  touchVX = clamp(clientToVirtual(t.clientX), 10, VW - 10)
}

function handleTouchEnd(e) {
  if (isInteractiveElement(e.target)) {
    touchPlaying = false
    return
  }
  const t = e.changedTouches[0]
  const isTap = t && Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 15 && performance.now() - tapStartTime < 400
  if (!gameStarted || gameOver) {
    if (isTap) resetGame()
  }
  touchPlaying = false
}

onMounted(() => {
  setupCanvas()
  try {
    hiScore = parseInt(localStorage.getItem('invaders-aHighScore') || '0', 10) || 0
  } catch (e) { hiScore = 0 }
  startDemo()
  gameRunning = true
  lastTime = performance.now()
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
.invaders-a-canvas {
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
