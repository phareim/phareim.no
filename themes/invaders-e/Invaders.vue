<template>
  <canvas ref="canvas" class="invaders-e-canvas"></canvas>
</template>

<script setup>
/**
 * SYNTHWAVE HORIZON — a faithful 1978 Space Invaders formation game.
 *
 * Same shell contract as rtype/Shooter.vue and breakout/Breakout.vue: a
 * full-viewport canvas behind the landing overlay, attract-mode autopilot
 * until Enter/tap, events up to Landing.vue for the HUD.
 *
 * Rules: 5-row formation (squid 30 / crab 20 / octopus 10, two frames each),
 * sideways march + step down on edge, step timer quickens as invaders die
 * (the heartbeat), lowest-per-column bombs (zigzag / plunger / rolling),
 * 4 eroding bunkers (3 on narrow screens), mystery UFO 50-300 pts, one
 * player shot at a time, 3 lives +1 at 1500, next wave starts one row lower,
 * game over on invasion or 0 lives.
 *
 * Look: the playfield floats above a scrolling perspective grid floor
 * (magenta on violet-black) with a striped sun on the horizon and neon
 * mountain silhouettes. Invaders are the classic 1978 sprites as glowing
 * magenta pixel blocks with chromatic aberration that grows on each
 * heartbeat pulse. Twist: a KILL COMBO — kills within 1.5 s bump a
 * multiplier x1->x4 shown as a glowing tag near the cannon; a miss resets it.
 */
const emit = defineEmits(['score', 'wave', 'lives', 'death', 'restart', 'started'])

const canvas = ref(null)
let ctx = null
let animationFrameId = null
let gameRunning = false

// Viewport (CSS px).
let SW = 0
let SH = 0
let dpr = 1

const PINK = '#ff2fa0'
const CYAN = '#2ff3ff'
const GOLD = '#ffd23f'
const ORANGE = '#ff6a3d'
const BG = '#0b0616'
const BG_DEEP = '#060310'
const LIVES = 3
const EXTRA_AT = 1500
const MAX_PARTICLES = 300
const ROWS = 5

// ---------------------------------------------------------------- sprites
// 1978 bitmaps, encoded as bit rows. Two frames per species.

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
const UFO_SPRITE = [
  '.....XXXXXX.....',
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '.XX.XX.XX.XX.XX.',
  'XXXXXXXXXXXXXXXX',
  '..XXX..XX..XXX..',
  '...X........X...',
]

function speciesRows(r, frame) {
  if (r === 0) return frame ? SQUID_B : SQUID_A
  if (r <= 2) return frame ? CRAB_B : CRAB_A
  return frame ? OCTO_B : OCTO_A
}
function speciesScore(r) {
  if (r === 0) return 30
  if (r <= 2) return 20
  return 10
}

// ---------------------------------------------------------------- state

let gameStarted = false
let gameOver = false
let score = 0
let lastScoreSent = -1
let wave = 1
let lives = LIVES
let extraAwarded = false

// Formation.
let cols = 11
let alive = [] // alive[r][c]
let aliveCount = 0
let totalCount = 1
let fx = 0
let fy = 0
let marchDir = 1
let marchFrame = 0
let stepAcc = 0
let stepCount = 0
let px = 4
let cellW = 40
let cellH = 32
let formW = 400
let formH = 160
let margin = 24

// Cannon.
let cannonX = 0
let cannonVX = 0
let prevCannonX = 0
let cannonY = 0
let invulnUntil = 0
let dying = 0 // s left of the death freeze
let deathAt = 0
let deathEmitted = false
let cannonTrail = [] // { x, t } afterimages

// Shots.
let shot = null // one player bolt at a time
let bombs = []
let bombAcc = 1

// Bunkers: { x, y, w, h, cell, gw, gh, grid }.
let bunkers = []
const BUNKER_GW = 22
const BUNKER_GH = 16

// UFO.
let ufo = null
let ufoTimer = 4
let ufoPopups = [] // { x, y, text, t, color }

// Effects.
let particles = []
let shockwaves = []
let flashes = [] // 2-frame white sprite flashes { rows, x, y, px, t }
let stars = []
let ridge = [] // neon mountain silhouette points
let pulse = 0 // heartbeat pulse, 1 on each formation step, decays
let gridScroll = 0
let sunNotch = 0
let shake = 0

// Visual-effects package (draw-only; gameplay untouched). All motion uses
// dt, all coordinates survive resize (ripples live in normalized grid
// space), and every glow/gradient is pre-rendered on layout — no per-frame
// shadowBlur on sprites, no per-frame gradients.
let isMobile = false
let breathT = 0
let flashRow = -1
let flashRowT = 0
let ripples = [] // { su, sv, t, life, amp }, cap 12, recycled
let bounceSrc = [] // { su, sv, t } floor bounce, ~300 ms
let sunScroll = 0
let flareT = -1 // wave-clear horizon streak timer (<0 idle)
let sweepT = 0 // attract-mode scanline sweep cycle
let fogAX = 0
let fogBX = 0
let staticPx = -1
let glowInv = {} // key -> baked { c, ox, oy, w, h }
let glowWhite = {}
let glowCannon = null
let glowUFO = null
let glowShot = null
let glowEngine = null // cannon engine flare
let glowSkyGold = null // UFO sky glow
let bunkerCache = [] // per-bunker baked canvases
let skyC = null
let dimC = null
let haloC = null
let sunC = null
let fogAC = null
let fogBC = null
let streakC = null
let sweepC = null
let horizonC = null
let bunkerGlowC = null

// Combo twist.
let streak = 0
let mult = 1
let lastKillT = -10
let comboTimer = 0

let wavePause = 0 // countdown between waves
let lastTime = 0
let keys = {}
let touchActive = false
let touchX = 0
let tapStartX = 0
let tapStartY = 0
let tapStartTime = 0

// ---------------------------------------------------------------- helpers

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}
function rand(lo, hi) {
  return lo + Math.random() * (hi - lo)
}

function setScore(v) {
  if (!gameStarted) return
  score = v
  if (score >= EXTRA_AT && !extraAwarded && gameStarted) {
    extraAwarded = true
    lives++
    emit('lives', lives)
    ufoPopups.push({ x: cannonX, y: cannonY - 60, text: 'EXTRA ▲', t: 0, color: GOLD })
  }
  if (gameStarted && v !== lastScoreSent) {
    lastScoreSent = v
    emit('score', v)
  }
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  cannonX = clamp(cannonX || SW / 2, 30, SW - 30)
  prevCannonX = cannonX
  layout()
}

// Single layout entry: everything derives from SW/SH here, called on
// mount and resize. Portrait phones (< 600 px) get 7 columns / 3 bunkers
// via buildWave()/resetBunkers().
function layout() {
  margin = Math.max(12, SW * 0.04)
  cannonY = SH * 0.95
  layoutGeometry()
  buildStars()
  buildRidge()
  layoutBunkers()
  buildStatic()
}

// Cell size from the current column count; formation fits with margins.
function layoutGeometry() {
  px = clamp(Math.floor((SW * 0.7) / (cols * 14)), 2, 5)
  cellW = 14 * px
  cellH = 11 * px
  formW = cols * cellW
  formH = ROWS * cellH
  fx = clamp(fx || (SW - formW) / 2, margin, Math.max(margin, SW - margin - formW))
  fy = Math.max(0, Math.min(fy || SH * 0.085, bunkerTop() - formH - cellH))
}

function bunkerTop() {
  return SH * 0.865
}

function buildStars() {
  stars = []
  const n = Math.round(clamp((SW * SH) / 16000, 40, 90))
  for (let i = 0; i < n; i++) {
    stars.push({
      x: Math.random() * SW,
      y: Math.random() * horizonY() * 0.94,
      b: 0.25 + Math.random() * 0.6,
      sp: 1 + Math.random() * 3,
      ph: Math.random() * Math.PI * 2,
      ns: i % 9 === 0 ? Math.random() * 6 : -1, // sparkle subset cross timer
    })
  }
}

function horizonY() {
  return SW < 600 ? SH * 0.92 : SH * 0.7
}

function buildRidge() {
  ridge = []
  const n = Math.max(12, Math.round(SW / 64))
  for (let i = 0; i <= n; i++) {
    ridge.push({
      x: (i / n) * SW,
      h: (0.25 + Math.random() * 0.75) * SH * 0.055,
    })
  }
}

// ---------------------------------------------------------------- waves

function buildWave() {
  cols = SW >= 900 ? 11 : SW >= 600 ? 8 : 7
  alive = []
  for (let r = 0; r < ROWS; r++) {
    const row = []
    for (let c = 0; c < cols; c++) row.push(true)
    alive.push(row)
  }
  aliveCount = ROWS * cols
  totalCount = aliveCount
  marchDir = 1
  marchFrame = 0
  stepAcc = 0
  stepCount = 0
  layoutGeometry()
  // The next formation starts one row lower, up to a floor above the bunkers.
  const maxExtra = Math.max(0, Math.floor((bunkerTop() - cellH * 1.5 - formH - SH * 0.085) / cellH))
  const extra = Math.min(wave - 1, maxExtra, 4)
  fy = SH * 0.085 + extra * cellH
  fx = (SW - formW) / 2
}

function resetBunkers() {
  const n = SW < 600 ? 3 : 4
  const bp = clamp(Math.floor(Math.min(SW * 0.13, 80) / BUNKER_GW), 2, 3)
  const bw = BUNKER_GW * bp
  const bh = BUNKER_GH * bp
  const gap = bw * 0.9
  const totalW = n * bw + (n - 1) * gap
  let x = (SW - totalW) / 2
  const y = bunkerTop()
  bunkers = []
  bunkerCache = []
  for (let i = 0; i < n; i++) {
    const grid = new Uint8Array(BUNKER_GW * BUNKER_GH)
    for (let gy = 0; gy < BUNKER_GH; gy++) {
      for (let gx = 0; gx < BUNKER_GW; gx++) {
        let solid = true
        // Chamfered top corners.
        if (gx + gy < 2 || (BUNKER_GW - 1 - gx) + gy < 2) solid = false
        // Arched cutout at the bottom middle.
        const dx = gx - (BUNKER_GW - 1) / 2
        const archW = (BUNKER_GW * 0.22) * (0.4 + 0.6 * (gy / BUNKER_GH))
        if (gy > BUNKER_GH * 0.45 && Math.abs(dx) < archW) solid = false
        grid[gy * BUNKER_GW + gx] = solid ? 1 : 0
      }
    }
    bunkers.push({ x, y, w: bw, h: bh, cell: bp, gw: BUNKER_GW, gh: BUNKER_GH, grid })
    x += bw + gap
  }
}

function layoutBunkers() {
  // Keep damage across resizes: rebuild rects, carry over overlapping cells.
  const old = bunkers
  resetBunkers()
  for (let i = 0; i < Math.min(old.length, bunkers.length); i++) {
    const o = old[i]
    const nb = bunkers[i]
    if (o.gw !== nb.gw || o.gh !== nb.gh) continue
    for (let k = 0; k < o.grid.length; k++) {
      if (!o.grid[k]) nb.grid[k] = 0
    }
  }
}

function startDemo() {
  gameStarted = false
  gameOver = false
  score = 0
  lastScoreSent = -1
  wave = 1
  lives = LIVES
  extraAwarded = false
  streak = 0
  mult = 1
  comboTimer = 0
  lastKillT = -10
  stepCount = 0
  dying = 0
  deathEmitted = false
  shot = null
  bombs = []
  bombAcc = 1
  cannonTrail = []
  ufo = null
  ufoTimer = 4
  particles = []
  shockwaves = []
  flashes = []
  ufoPopups = []
  wavePause = 0
  buildWave()
  resetBunkers()
  cannonX = SW / 2
  prevCannonX = cannonX
}

function startGame() {
  score = 0
  lastScoreSent = -1
  wave = 1
  lives = LIVES
  extraAwarded = false
  streak = 0
  mult = 1
  comboTimer = 0
  lastKillT = -10
  stepCount = 0
  gameOver = false
  gameStarted = true
  dying = 0
  deathEmitted = false
  invulnUntil = 0
  touchActive = false
  touchX = 0
  keys = {}
  shot = null
  bombs = []
  bombAcc = 1
  cannonTrail = []
  ufo = null
  ufoTimer = rand(20, 30)
  particles = []
  shockwaves = []
  flashes = []
  ufoPopups = []
  wavePause = 0
  buildWave()
  resetBunkers()
  cannonX = SW / 2
  prevCannonX = cannonX
  emit('restart')
  emit('started')
  emit('score', 0)
  emit('wave', 1)
  emit('lives', lives)
}

// ---------------------------------------------------------------- formation

function stepIntervalMs() {
  const frac = aliveCount / totalCount
  const base = 45 + 520 * Math.pow(Math.max(0, frac), 1.2)
  // Attract mode drifts down slowly so the bottom row stays above ~45 %
  // for the first ~20 s and the name stays readable.
  return gameStarted ? base : base * 1.9
}

// The row holding the extreme live invader in the march direction.
function leadingRow() {
  let best = -1
  let bestX = marchDir > 0 ? -Infinity : Infinity
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      const edge = marchDir > 0 ? rc.x + rc.w : rc.x
      if ((marchDir > 0 && edge > bestX) || (marchDir < 0 && edge < bestX)) {
        bestX = edge
        best = r
      }
    }
  }
  return best
}

function doStep(now) {
  marchFrame ^= 1
  stepCount++
  pulse = 1
  sunNotch++
  // FX only: a ripple runs across the floor on every step, and the row
  // leading the march flashes brighter for a beat.
  addRipple(fx + formW / 2, bunkerTop() + 24, 0.22)
  flashRow = leadingRow()
  flashRowT = 0.3
  const dx = Math.max(2, Math.round(cellW * 0.16))
  const dy = Math.max(4, Math.round(cellH * 0.7))
  // Live extents: outer dead columns must not trigger early edge turns.
  let liveMin = Infinity
  let liveMax = -Infinity
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      if (rc.x < liveMin) liveMin = rc.x
      if (rc.x + rc.w > liveMax) liveMax = rc.x + rc.w
    }
  }
  const nx = fx + marchDir * dx
  if (!Number.isFinite(liveMin)) {
    fx = nx
  } else {
    const minOff = liveMin - fx
    const maxOff = liveMax - fx
    if (marchDir > 0 && nx + maxOff > SW - margin) {
      fy += dy
      marchDir = -1
      fx = SW - margin - maxOff
    } else if (marchDir < 0 && nx + minOff < margin) {
      fy += dy
      marchDir = 1
      fx = margin - minOff
    } else {
      fx = nx
    }
  }
  eatBunkers()
  checkInvasion(now)
}

function invaderRect(r, c) {
  const rows = speciesRows(r, 0)
  const w = rows[0].length * px
  const h = rows.length * px
  const x = fx + c * cellW + (cellW - w) / 2
  const y = fy + r * cellH + (cellH - h) / 2
  return { x, y, w, h }
}

function invaderBottom() {
  let bottom = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      if (rc.y + rc.h > bottom) bottom = rc.y + rc.h
    }
  }
  return bottom
}

function lowestInColumn(c) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (alive[r][c]) return r
  }
  return -1
}

function checkInvasion(now) {
  if (gameOver || dying > 0) return
  if (!gameStarted) {
    // Attract mode never ends in GAME OVER: loop the demo high instead.
    if (invaderBottom() >= cannonY - 4 * px) {
      buildWave()
      bombs = []
      shot = null
    }
    return
  }
  if (invaderBottom() >= cannonY - 4 * px) {
    gameOver = true
    deathAt = now
    explode(cannonX, cannonY, true)
  }
}

// Invaders that reach the bunkers eat through them.
function eatBunkers() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      for (let i = 0; i < bunkers.length; i++) {
        eraseRect(bunkers[i], rc.x, rc.y, rc.w, rc.h)
      }
    }
  }
}

// ---------------------------------------------------------------- bunkers

function eraseRect(b, x, y, w, h) {
  const gx0 = clamp(Math.floor((x - b.x) / b.cell), 0, b.gw - 1)
  const gx1 = clamp(Math.floor((x + w - b.x) / b.cell), 0, b.gw - 1)
  const gy0 = clamp(Math.floor((y - b.y) / b.cell), 0, b.gh - 1)
  const gy1 = clamp(Math.floor((y + h - b.y) / b.cell), 0, b.gh - 1)
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const k = gy * b.gw + gx
      if (b.grid[k]) {
        b.grid[k] = 0
        b.dirty = true // baked bunker sprite needs one re-render
      }
    }
  }
}

function splat(b, sx, sy, radius) {
  const ccx = (sx - b.x) / b.cell
  const ccy = (sy - b.y) / b.cell
  for (let gy = 0; gy < b.gh; gy++) {
    for (let gx = 0; gx < b.gw; gx++) {
      const d = Math.hypot(gx - ccx, gy - ccy)
      const k = gy * b.gw + gx
      if (d < radius * (0.7 + Math.random() * 0.6) && b.grid[k]) {
        b.grid[k] = 0
        b.dirty = true // baked bunker sprite needs one re-render
      }
    }
  }
}

// Returns true when a solid pixel was hit (and erodes it).
function hitBunker(sx, sy, radius) {
  for (let i = 0; i < bunkers.length; i++) {
    const b = bunkers[i]
    if (sx < b.x || sx > b.x + b.w || sy < b.y || sy > b.y + b.h) continue
    const gx = clamp(Math.floor((sx - b.x) / b.cell), 0, b.gw - 1)
    const gy = clamp(Math.floor((sy - b.y) / b.cell), 0, b.gh - 1)
    if (b.grid[gy * b.gw + gx]) {
      splat(b, sx, sy, radius)
      return true
    }
  }
  return false
}

// ------------------------------------------------- visual-effects package
// Draw-only. Gameplay, rules, layout, input and attract mode are untouched.

function frantic() {
  const frac = totalCount > 0 ? aliveCount / totalCount : 0
  return 1 - clamp(frac, 0, 1)
}

function screenToGrid(x, y) {
  const hy = horizonY()
  return { su: clamp(x / Math.max(1, SW), 0, 1), sv: clamp((y - hy) / Math.max(1, SH - hy), 0, 1) }
}

function addRipple(x, y, amp) {
  const g = screenToGrid(x, y)
  if (ripples.length >= 12) ripples.shift()
  ripples.push({ su: g.su, sv: Math.max(0.04, g.sv), t: 0, life: 1.6, amp })
}

function addBounce(x, y) {
  const g = screenToGrid(x, y)
  bounceSrc.push({ su: g.su, sv: Math.max(0.04, g.sv), t: 0 })
  if (bounceSrc.length > 4) bounceSrc.shift()
}

function rippleBright(su, sv) {
  let s = 0
  for (let i = 0; i < ripples.length; i++) {
    const rp = ripples[i]
    const age = rp.t / rp.life
    if (age >= 1) continue
    const d = Math.hypot((su - rp.su) * 1.6, sv - rp.sv)
    const dd = (d - rp.t * 0.9) / 0.09
    s += rp.amp * Math.exp(-dd * dd * 0.5) * (1 - age)
  }
  return s
}

function bounceDy(su, sv) {
  let dy = 0
  for (let i = 0; i < bounceSrc.length; i++) {
    const b = bounceSrc[i]
    if (b.t > 0.3) continue
    const k = 1 - b.t / 0.3
    const d2 = Math.pow((su - b.su) * 1.6, 2) + Math.pow((sv - b.sv) * 2.2, 2)
    dy += -6 * Math.exp(-d2 / 0.02) * Math.sin(b.t * 40) * k
  }
  return dy
}

// Bake one sprite with its glow into an offscreen canvas (glow via
// shadowBlur happens here, once per layout — never per frame).
function bakeSprite(rows, s, color, blur) {
  const w = rows[0].length * s
  const h = rows.length * s
  const pad = isMobile || blur <= 0 ? 2 : Math.ceil(blur / 2) + 2
  const c = document.createElement('canvas')
  c.width = Math.max(2, w + pad * 2)
  c.height = Math.max(2, h + pad * 2)
  const g = c.getContext('2d')
  g.fillStyle = color
  if (pad > 2) {
    g.shadowColor = color
    g.shadowBlur = blur
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r]
      for (let q = 0; q < line.length; q++) {
        if (line[q] === 'X') g.fillRect(pad + q * s, pad + r * s, s, s)
      }
    }
  }
  return { c, ox: pad, oy: pad, w, h }
}

function bakeRadial(size, stops) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2)
  for (let i = 0; i < stops.length; i++) grad.addColorStop(stops[i][0], stops[i][1])
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

function bakeBunker(b) {
  const pad = isMobile ? 2 : 8
  const c = document.createElement('canvas')
  c.width = Math.max(2, Math.ceil(b.w + pad * 2))
  c.height = Math.max(2, Math.ceil(b.h + pad * 2))
  const g = c.getContext('2d')
  g.fillStyle = CYAN
  if (pad > 2) {
    g.shadowColor = CYAN
    g.shadowBlur = 10
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let gy = 0; gy < b.gh; gy++) {
      for (let gx = 0; gx < b.gw; gx++) {
        if (b.grid[gy * b.gw + gx]) g.fillRect(pad + gx * b.cell, pad + gy * b.cell, b.cell, b.cell)
      }
    }
  }
  return { c, ox: pad, oy: pad, w: b.w, h: b.h }
}

function invKey(r, frame) {
  return (r === 0 ? 's' : r <= 2 ? 'c' : 'o') + frame
}

// Rebuild every pre-rendered sprite/gradient. Called from layout() and
// lazily via ensureStatic() when px changes (column-count flips).
function buildStatic() {
  staticPx = px
  isMobile = SW < 600
  const blur = isMobile ? 0 : 14
  glowInv = {}
  glowWhite = {}
  const defs = [[0, 0], [0, 1], [1, 0], [1, 1], [3, 0], [3, 1]]
  for (let i = 0; i < defs.length; i++) {
    const rows = speciesRows(defs[i][0], defs[i][1])
    const key = invKey(defs[i][0], defs[i][1])
    glowInv[key] = bakeSprite(rows, px, PINK, blur)
    glowWhite[key] = bakeSprite(rows, px, '#ffffff', blur)
  }
  glowCannon = bakeSprite(CANNON, px, CYAN, blur)
  glowUFO = bakeSprite(UFO_SPRITE, px, GOLD, isMobile ? 0 : 16)
  // Player bolt: 4x12 cyan block, white core drawn per frame.
  const bolt = ['XX', 'XX', 'XX', 'XX', 'XX', 'XX']
  glowShot = bakeSprite(bolt, 2, CYAN, isMobile ? 0 : 12)
  glowEngine = bakeRadial(64, [[0, 'rgba(255, 210, 63, 0.9)'], [0.4, 'rgba(255, 106, 61, 0.45)'], [1, 'rgba(255, 106, 61, 0)']])
  glowSkyGold = bakeRadial(128, [[0, 'rgba(255, 210, 63, 0.55)'], [1, 'rgba(255, 210, 63, 0)']])
  // Sky gradient, full screen.
  skyC = document.createElement('canvas')
  skyC.width = Math.max(2, Math.round(SW))
  skyC.height = Math.max(2, Math.round(SH))
  const sg = skyC.getContext('2d')
  const g = sg.createLinearGradient(0, 0, 0, SH)
  g.addColorStop(0, BG_DEEP)
  g.addColorStop(0.55, BG)
  g.addColorStop(0.7, '#170a30')
  g.addColorStop(1, BG_DEEP)
  sg.fillStyle = g
  sg.fillRect(0, 0, skyC.width, skyC.height)
  // Idle dim behind the profile card.
  dimC = document.createElement('canvas')
  dimC.width = Math.max(2, Math.round(SW / 2))
  dimC.height = Math.max(2, Math.round(SH / 2))
  const dg = dimC.getContext('2d')
  const dw = dimC.width
  const dh = dimC.height
  const rg = dg.createRadialGradient(dw / 2, dh * 0.42, 20, dw / 2, dh * 0.42, Math.max(dw, dh) * 0.42)
  rg.addColorStop(0, 'rgba(6, 3, 16, 0.62)')
  rg.addColorStop(1, 'rgba(6, 3, 16, 0)')
  dg.fillStyle = rg
  dg.fillRect(0, 0, dw, dh)
  // Sun halo + sun body (stripes stay dynamic, drawn per frame as rects).
  haloC = bakeRadial(256, [[0, 'rgba(255, 47, 160, 0.5)'], [1, 'rgba(255, 47, 160, 0)']])
  sunC = document.createElement('canvas')
  sunC.width = 64
  sunC.height = 64
  const sc = sunC.getContext('2d')
  const sunGrad = sc.createLinearGradient(0, 0, 0, 64)
  sunGrad.addColorStop(0, '#ffd23f')
  sunGrad.addColorStop(0.55, '#ff6a3d')
  sunGrad.addColorStop(1, '#ff2fa0')
  sc.fillStyle = sunGrad
  sc.fillRect(0, 0, 64, 64)
  // Fog bands: wide, very dim.
  fogAC = bakeFog(Math.max(256, Math.round(SW)), 64, '255, 47, 160', 0.055)
  fogBC = bakeFog(Math.max(256, Math.round(SW)), 48, '120, 80, 255', 0.045)
  // Wave-clear streak: horizontal white-pink bar.
  streakC = document.createElement('canvas')
  streakC.width = 256
  streakC.height = 8
  const st = streakC.getContext('2d')
  const stg = st.createLinearGradient(0, 0, 256, 0)
  stg.addColorStop(0, 'rgba(255, 255, 255, 0)')
  stg.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)')
  stg.addColorStop(1, 'rgba(255, 47, 160, 0)')
  st.fillStyle = stg
  st.fillRect(0, 0, 256, 8)
  // Attract sweep band: vertical cyan whisper.
  sweepC = document.createElement('canvas')
  sweepC.width = 8
  sweepC.height = 64
  const sw2 = sweepC.getContext('2d')
  const swg = sw2.createLinearGradient(0, 0, 0, 64)
  swg.addColorStop(0, 'rgba(47, 243, 255, 0)')
  swg.addColorStop(0.5, 'rgba(47, 243, 255, 0.10)')
  swg.addColorStop(1, 'rgba(47, 243, 255, 0)')
  sw2.fillStyle = swg
  sw2.fillRect(0, 0, 8, 64)
  // Horizon glow bar + bunker reflection ellipse.
  horizonC = document.createElement('canvas')
  horizonC.width = 256
  horizonC.height = 16
  const hz = horizonC.getContext('2d')
  const hzg = hz.createLinearGradient(0, 0, 0, 16)
  hzg.addColorStop(0, 'rgba(255, 47, 160, 0)')
  hzg.addColorStop(0.5, 'rgba(255, 47, 160, 0.55)')
  hzg.addColorStop(1, 'rgba(255, 47, 160, 0)')
  hz.fillStyle = hzg
  hz.fillRect(0, 0, 256, 16)
  bunkerGlowC = bakeRadial(64, [[0, 'rgba(47, 243, 255, 0.5)'], [1, 'rgba(47, 243, 255, 0)']])
  bunkerCache = []
}

function bakeFog(w, h, rgb, peak) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, `rgba(${rgb}, 0)`)
  grad.addColorStop(0.25, `rgba(${rgb}, ${peak})`)
  grad.addColorStop(0.55, `rgba(${rgb}, 0.012)`)
  grad.addColorStop(0.8, `rgba(${rgb}, ${peak})`)
  grad.addColorStop(1, `rgba(${rgb}, 0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  return c
}

function ensureStatic() {
  if (staticPx !== px || !skyC) buildStatic()
}

function drawBaked(b, x, y) {
  ctx.drawImage(b.c, Math.round(x - b.ox), Math.round(y - b.oy))
}

// ---------------------------------------------------------------- effects

function spawnParticles(x, y, color, count, spread) {
  if (isMobile) count = Math.max(2, Math.ceil(count / 2))
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) particles.shift()
    const a = Math.random() * Math.PI * 2
    const s = 40 + Math.random() * (spread || 220)
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      decay: 1.4 + Math.random() * 1.6,
      size: 2 + Math.random() * 3,
      color,
    })
  }
}

// Kill debris: the sprite's own pixels blowing outward in its colour.
function spawnSpriteChunks(rows, ox, oy, s, color) {
  const pts = []
  for (let r = 0; r < rows.length; r++) {
    const line = rows[r]
    for (let q = 0; q < line.length; q++) {
      if (line[q] === 'X') pts.push([ox + q * s, oy + r * s])
    }
  }
  const n = isMobile ? 8 : 16
  for (let i = 0; i < n && pts.length; i++) {
    const p = pts.splice(Math.floor(Math.random() * pts.length), 1)[0]
    if (particles.length >= MAX_PARTICLES) particles.shift()
    const a = Math.random() * Math.PI * 2
    const sp = 90 + Math.random() * 260
    particles.push({
      x: p[0], y: p[1],
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      life: 1,
      decay: 1.8 + Math.random() * 1.4,
      size: s,
      color,
    })
  }
}

function explode(x, y, big) {
  spawnParticles(x, y, '#ffffff', big ? 10 : 6, 160)
  spawnParticles(x, y, PINK, big ? 26 : 14, 320)
  spawnParticles(x, y, CYAN, big ? 14 : 8, 240)
  shockwaves.push({ x, y, radius: 6, life: 1, color: PINK })
  shake = Math.min(1, shake + (big ? 0.7 : 0.3))
}

function fire() {
  if (!gameStarted || gameOver || dying > 0 || shot) return
  shot = { x: cannonX, y: cannonY - 4 * px - 6 }
}

function killInvader(r, c, now) {
  alive[r][c] = false
  aliveCount--
  const rc = invaderRect(r, c)
  const cx = rc.x + rc.w / 2
  const cy = rc.y + rc.h / 2
  // Combo twist: a kill within 1.5 s of the previous one bumps x1->x4.
  const gap = now - lastKillT
  streak = gap < 1.5 ? streak + 1 : 0
  mult = Math.min(4, streak + 1)
  lastKillT = now
  comboTimer = 1.5
  setScore(score + speciesScore(r))
  flashes.push({ key: invKey(r, marchFrame), x: rc.x, y: rc.y, t: 0.12 })
  explode(cx, cy, false)
  // Chromatic kill ring: red / white / cyan at slightly different radii.
  shockwaves.push({ x: cx, y: cy, radius: 3, life: 0.9, color: '#ffffff' })
  shockwaves.push({ x: cx, y: cy, radius: 9, life: 1.1, color: '#ff2244' })
  spawnSpriteChunks(speciesRows(r, marchFrame), rc.x, rc.y, px, PINK)
  addRipple(cx, Math.max(cy, horizonY() + 12), 0.5)
  addBounce(cx, Math.max(cy, horizonY() + 12))
  if (aliveCount <= 0 && !gameOver) {
    wavePause = 1.6
    flareT = 0 // wave-clear streak across the horizon
  }
}

function onCannonHit(now) {
  if (now < invulnUntil || dying > 0) return
  explode(cannonX, cannonY, true)
  shake = 1 // ~7 px decaying screen shake on death
  addRipple(cannonX, cannonY, 0.6)
  addBounce(cannonX, cannonY)
  spawnParticles(cannonX, cannonY, '#ffffff', 8, 200)
  shot = null
  bombs = []
  streak = 0
  mult = 1
  comboTimer = 0
  if (!gameStarted) {
    // Autopilot got clipped: respawn quietly, the show goes on.
    dying = 1.0
    invulnUntil = now + 3.0
    return
  }
  lives--
  emit('lives', lives)
  if (lives <= 0) {
    gameOver = true
    deathAt = now
  } else {
    dying = 1.0 // ~1 s freeze where the formation stops, like the original
    invulnUntil = now + 1.0 + 2.5
  }
}

// ---------------------------------------------------------------- bombs & UFO

function maxBombs() {
  if (!gameStarted) return 2
  return wave >= 3 ? 4 : wave === 2 ? 3 : 2
}

function bombSpeed() {
  const frac = aliveCount / totalCount
  if (!gameStarted) return 150
  return Math.min(400, 170 + wave * 22 + (1 - frac) * 60)
}

function spawnBomb() {
  const liveCols = []
  for (let c = 0; c < cols; c++) {
    if (lowestInColumn(c) >= 0) liveCols.push(c)
  }
  if (!liveCols.length) return
  const c = liveCols[Math.floor(Math.random() * liveCols.length)]
  const r = lowestInColumn(c)
  const rc = invaderRect(r, c)
  const style = ['zigzag', 'plunger', 'rolling'][Math.floor(Math.random() * 3)]
  bombs.push({
    style,
    x: rc.x + rc.w / 2,
    baseX: rc.x + rc.w / 2,
    y: rc.y + rc.h + 2,
    v: bombSpeed() * (style === 'plunger' ? 1.25 : style === 'rolling' ? 0.9 : 1),
    t: Math.random() * 10,
    frame: 0,
  })
}

function spawnUFO(now) {
  const dir = Math.random() < 0.5 ? 1 : -1
  ufo = {
    x: dir > 0 ? -60 : SW + 60,
    dir,
    y: Math.max(26, SH * 0.055),
    v: Math.max(120, SW / 6.5),
  }
}

function ufoPoints() {
  const table = [50, 100, 150, 300]
  return table[Math.floor(Math.random() * table.length)]
}

// ---------------------------------------------------------------- autopilot

function autopilot(dt) {
  // Nearest column with a live invader; track its lowest invader.
  let targetX = SW / 2
  let bestD = Infinity
  for (let c = 0; c < cols; c++) {
    const r = lowestInColumn(c)
    if (r < 0) continue
    const rc = invaderRect(r, c)
    const cx = rc.x + rc.w / 2
    const d = Math.abs(cx - cannonX)
    if (d < bestD) {
      bestD = d
      targetX = cx
    }
  }
  // Dodge falling bombs.
  for (let i = 0; i < bombs.length; i++) {
    const b = bombs[i]
    if (b.y > cannonY - 260 && b.y < cannonY && Math.abs(b.x - cannonX) < 46) {
      targetX = cannonX < b.x ? cannonX - 120 : cannonX + 120
      break
    }
  }
  moveCannonToward(targetX, dt)
  // Deliberately imperfect: a wide aim window plus a ~35 % chance of a
  // large aim error and a coin-flip on the trigger, so the demo misses
  // sometimes and the formation stays full for ~20 s.
  if (!shot && Math.abs(targetX - cannonX) < 40 && Math.random() < 0.5) {
    if (Math.random() < 0.35) {
      cannonX = clamp(cannonX + (Math.random() < 0.5 ? -1 : 1) * rand(50, 110), 24, SW - 24)
    }
    fireDemoShot()
  }
}

function moveCannonToward(tx, dt) {
  const dx = clamp(tx, 24, SW - 24) - cannonX
  cannonX += clamp(dx, -1, 1) * cannonSpeed() * dt
  if (Math.abs(dx) < cannonSpeed() * dt) cannonX = clamp(tx, 24, SW - 24)
}

function cannonSpeed() {
  return Math.max(340, SW * 0.45)
}

function fireDemoShot() {
  if (gameOver || dying > 0 || shot) return
  shot = { x: cannonX, y: cannonY - 4 * px - 6 }
}

// ---------------------------------------------------------------- update

function update(nowMs) {
  const now = nowMs / 1000
  let dt = (nowMs - lastTime) / 1000
  if (!(dt > 0)) dt = 0.016
  dt = Math.min(dt, 0.05) // clamp to 50 ms for frame-rate independence
  lastTime = nowMs

  pulse = Math.max(0, pulse - dt * 2.2)
  gridScroll = (gridScroll + dt * 0.35) % 1
  shake = Math.max(0, shake - 2.6 * dt)
  // FX timers only — all frame-rate independent.
  breathT += dt
  flashRowT = Math.max(0, flashRowT - dt)
  sunScroll += dt * (1.5 + frantic() * 9)
  if (flareT >= 0) {
    flareT += dt
    if (flareT > 1.2) flareT = -1
  }
  sweepT = (sweepT + dt) % 6
  fogAX = (fogAX + dt * 10) % (2 * Math.max(1, SW))
  fogBX = (fogBX + dt * 23) % (2 * Math.max(1, SW))
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].t += dt
    if (ripples[i].t >= ripples[i].life) ripples.splice(i, 1)
  }
  for (let i = bounceSrc.length - 1; i >= 0; i--) {
    bounceSrc[i].t += dt
    if (bounceSrc[i].t > 0.35) bounceSrc.splice(i, 1)
  }

  cannonVX = dt > 0 ? (cannonX - prevCannonX) / dt : 0
  prevCannonX = cannonX
  // Afterimage trail when moving fast.
  if (Math.abs(cannonVX) > 260 && dying <= 0 && !gameOver) {
    cannonTrail.push({ x: cannonX, t: 0.25 })
    if (cannonTrail.length > 6) cannonTrail.shift()
  }
  for (let i = cannonTrail.length - 1; i >= 0; i--) {
    cannonTrail[i].t -= dt
    if (cannonTrail[i].t <= 0) cannonTrail.splice(i, 1)
  }

  updateFx(dt, now)

  // Delayed death emit so the explosion plays out.
  if (gameOver && !deathEmitted && now - deathAt > 0.9) {
    deathEmitted = true
    emit('death')
  }
}

function updateFx(dt, now) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.985
    p.vy *= 0.985
    p.life -= p.decay * dt
    if (p.life <= 0) particles.splice(i, 1)
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]
    sw.radius += 420 * dt
    sw.life -= 1.7 * dt
    if (sw.life <= 0) shockwaves.splice(i, 1)
  }
  for (let i = flashes.length - 1; i >= 0; i--) {
    flashes[i].t -= dt
    if (flashes[i].t <= 0) flashes.splice(i, 1)
  }
  for (let i = ufoPopups.length - 1; i >= 0; i--) {
    ufoPopups[i].t += dt
    if (ufoPopups[i].t > 1.4) ufoPopups.splice(i, 1)
  }
  if (comboTimer > 0) {
    comboTimer -= dt
    if (comboTimer <= 0) {
      streak = 0
      mult = 1
    }
  }
}

function updateGame(dt, now) {
  // Death freeze: the formation stops while the cannon burns.
  if (dying > 0) {
    dying -= dt
    if (dying <= 0 && !gameOver) {
      cannonX = SW / 2
      prevCannonX = cannonX
    }
    return
  }
  if (gameOver) return

  // Wave transition: the next formation starts one row lower.
  if (wavePause > 0) {
    wavePause -= dt
    if (wavePause <= 0) {
      // In attract mode loop wave 1 forever so the formation stays high
      // behind the card; a real game climbs one row lower per wave.
      wave = gameStarted ? wave + 1 : 1
      if (gameStarted) emit('wave', wave)
      buildWave()
      bombs = []
      shot = null
    }
    return
  }

  // Formation march: a timer, not a per-frame move — the jerky original.
  stepAcc += dt * 1000
  let guard = 0
  while (stepAcc >= stepIntervalMs() && guard++ < 8) {
    stepAcc -= stepIntervalMs()
    doStep(now)
    if (gameOver) return
  }

  // Bombs away.
  bombAcc -= dt
  if (bombAcc <= 0) {
    if (bombs.length < maxBombs() && aliveCount > 0) spawnBomb()
    const frac = aliveCount / totalCount
    bombAcc = rand(0.5, 1.2) * (gameStarted ? 1 : 1.6) * (0.5 + frac * 0.8)
  }

  // UFO crossing.
  ufoTimer -= dt
  if (ufoTimer <= 0 && !ufo) {
    spawnUFO(now)
    ufoTimer = rand(20, 30)
  }
  if (ufo) {
    ufo.x += ufo.dir * ufo.v * dt
    if ((ufo.dir > 0 && ufo.x > SW + 70) || (ufo.dir < 0 && ufo.x < -70)) ufo = null
  }

  // Cannon movement: autopilot or player.
  if (!gameStarted) {
    autopilot(dt)
  } else {
    const lf = keys['ArrowLeft'] || keys['KeyA']
    const rt = keys['ArrowRight'] || keys['KeyD']
    const m = (rt ? 1 : 0) - (lf ? 1 : 0)
    if (touchActive) {
      moveCannonToward(touchX, dt)
    } else if (m) {
      cannonX = clamp(cannonX + m * cannonSpeed() * dt, 24, SW - 24)
    }
  }
  cannonX = clamp(cannonX, 24, SW - 24)

  updateShot(dt, now)
  updateBombs(dt, now)
}

function shotSpeed() {
  return Math.max(520, SH * 0.9)
}

function updateShot(dt, now) {
  if (!shot) return
  shot.y -= shotSpeed() * dt
  if (shot.y < -20) {
    // A miss resets the combo.
    shot = null
    streak = 0
    mult = 1
    comboTimer = 0
    return
  }
  // UFO first (it flies above everything).
  if (ufo) {
    const uw = UFO_SPRITE[0].length * px
    const uh = UFO_SPRITE.length * px
    if (shot.x > ufo.x - uw / 2 && shot.x < ufo.x + uw / 2 && shot.y > ufo.y && shot.y < ufo.y + uh) {
      const pts = ufoPoints()
      if (gameStarted) setScore(score + pts)
      ufoPopups.push({ x: ufo.x, y: ufo.y + uh, text: String(pts), t: 0, color: GOLD })
      explode(ufo.x, ufo.y + uh / 2, false)
      ufo = null
      shot = null
      return
    }
  }
  // Bunkers erode pixel by pixel — before invaders, so a bolt cannot
  // kill through a bunker without chewing it.
  if (hitBunker(shot.x, shot.y, 2)) {
    spawnParticles(shot.x, shot.y, CYAN, 5, 140)
    addRipple(shot.x, Math.max(shot.y, horizonY() + 8), 0.2)
    shot = null
    return
  }
  // Invaders.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      if (shot.x > rc.x && shot.x < rc.x + rc.w && shot.y > rc.y && shot.y < rc.y + rc.h) {
        shot = null
        killInvader(r, c, now)
        return
      }
    }
  }
  // Shooting a bomb out of the sky.
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i]
    if (Math.abs(shot.x - b.x) < 8 && Math.abs(shot.y - b.y) < 12) {
      spawnParticles(b.x, b.y, '#ffffff', 6, 160)
      bombs.splice(i, 1)
      shot = null
      return
    }
  }
}

function cannonRect() {
  const w = CANNON[0].length * px
  const h = CANNON.length * px
  return { x: cannonX - w / 2, y: cannonY - h / 2, w, h }
}

function updateBombs(dt, now) {
  const cr = cannonRect()
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i]
    b.t += dt
    b.y += b.v * dt
    if (b.style === 'zigzag') b.x = b.baseX + Math.sin(b.t * 9) * cellW * 0.22
    else if (b.style === 'rolling') {
      b.x = b.baseX + Math.sin(b.t * 5) * cellW * 0.1
      b.frame = Math.floor(b.t * 8) % 2
    }
    if (b.y > SH + 12) {
      bombs.splice(i, 1)
      continue
    }
    // Bunkers erode.
    if (hitBunker(b.x, b.y + 6, 2.5)) {
      spawnParticles(b.x, b.y, PINK, 5, 140)
      addRipple(b.x, Math.max(b.y + 6, horizonY() + 8), 0.25)
      bombs.splice(i, 1)
      continue
    }
    // The cannon.
    if (now >= invulnUntil && dying <= 0 &&
      b.x > cr.x && b.x < cr.x + cr.w && b.y > cr.y && b.y < cr.y + cr.h) {
      bombs.splice(i, 1)
      onCannonHit(now)
      return
    }
  }
}

// ---------------------------------------------------------------- draw

function plotRows(rows, ox, oy, s) {
  for (let r = 0; r < rows.length; r++) {
    const line = rows[r]
    for (let c = 0; c < line.length; c++) {
      if (line[c] === 'X') ctx.fillRect(ox + c * s, oy + r * s, s, s)
    }
  }
}

function drawBackground(now) {
  // Sky: pre-rendered gradient, drawn as one image (no per-frame gradient).
  ctx.drawImage(skyC, 0, 0, SW, SH)

  // Stars: sparse, twinkling, above the horizon, with occasional brief
  // cross-shaped sparkles on a small subset.
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i]
    const tw = 0.5 + 0.5 * Math.sin(now * s.sp + s.ph)
    ctx.globalAlpha = s.b * (0.35 + 0.65 * tw)
    ctx.fillStyle = '#cfe9ff'
    ctx.fillRect(s.x, s.y, 1.5, 1.5)
    if (s.ns >= 0 && now > s.ns) {
      s.ns = now + 2 + Math.random() * 5
      ctx.globalAlpha = 0.85
      ctx.strokeStyle = '#eaf6ff'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(s.x - 4, s.y)
      ctx.lineTo(s.x + 5, s.y)
      ctx.moveTo(s.x, s.y - 4)
      ctx.lineTo(s.x, s.y + 5)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  drawSun()
  drawMountains()
  drawGrid()
  drawFog()
  drawFlare()

  // Keep the backdrop dim behind the profile card while idle (pre-rendered).
  if (!gameStarted) {
    ctx.drawImage(dimC, 0, 0, SW, SH)
  }

  // Heartbeat: the whole background pulses subtly on each formation step.
  if (pulse > 0.01) {
    ctx.fillStyle = `rgba(255, 47, 160, ${0.05 * pulse})`
    ctx.fillRect(0, 0, SW, SH)
  }
}

function drawSun() {
  const hy = horizonY()
  // Low and compact: the disc stays mostly below the horizon line, partly
  // behind the bunker band, so it never competes with the profile text.
  const r = Math.min(SW * 0.22, SH * 0.15)
  if (r < 20) return
  const cx = SW / 2
  const cy = hy + r * 0.55
  const demo = !gameStarted
  const portrait = SW < 600
  // Pre-rendered halo, pulsing with each step.
  const hr = r * 2.1
  ctx.save()
  ctx.globalAlpha = Math.min(1, (demo ? 0.55 : 0.85) + pulse * 0.35)
  ctx.drawImage(haloC, cx - hr, cy - hr, hr * 2, hr * 2)
  ctx.restore()
  // Disc from the baked gradient, clipped.
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.globalAlpha = portrait ? 0.32 : demo ? 0.5 : 0.8
  ctx.drawImage(sunC, cx - r, cy - r, r * 2, r * 2)
  ctx.globalAlpha = 1
  // Stripes scroll continuously (slowly), faster at the frantic end.
  const phase = (sunNotch % 4) * 2 + (sunScroll % 11) - 22
  let yy = cy - r * 0.25 + phase
  while (yy < cy + r) {
    const t = clamp((yy - (cy - r * 0.25)) / (2 * r), 0, 1)
    const barH = 1 + t * 9
    ctx.fillStyle = BG
    ctx.fillRect(cx - r, yy, r * 2, barH)
    yy += barH + 9
  }
  ctx.restore()
}

function drawMountains() {
  const hy = horizonY()
  ctx.beginPath()
  ctx.moveTo(0, hy)
  for (let i = 0; i < ridge.length; i++) {
    ctx.lineTo(ridge[i].x, hy - ridge[i].h)
    if (i < ridge.length - 1) {
      const nx = (ridge[i].x + ridge[i + 1].x) / 2
      ctx.lineTo(nx, hy - Math.min(ridge[i].h, ridge[i + 1].h) * 0.3)
    }
  }
  ctx.lineTo(SW, hy)
  ctx.closePath()
  ctx.fillStyle = '#120826'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 47, 160, 0.65)'
  ctx.lineWidth = 1.5
  ctx.shadowColor = PINK
  ctx.shadowBlur = isMobile ? 0 : 8
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawGrid() {
  const hy = horizonY()
  const brightness = 0.5 + pulse * 0.5
  ctx.save()
  // Horizon glow bar (pre-rendered).
  ctx.globalAlpha = 0.55 + pulse * 0.3
  ctx.drawImage(horizonC, 0, hy - 8, SW, 16)
  // Grid lines as short segments; per-segment brightness from the ripple
  // sum, no shadowBlur (alpha does the glow work). ~36x10 desktop.
  ctx.strokeStyle = PINK
  ctx.lineWidth = 1
  const HROWS = isMobile ? 8 : 10
  const HSEGS = isMobile ? 20 : 36
  for (let i = 0; i < HROWS; i++) {
    const p = ((i / HROWS) + gridScroll) % 1
    const yBase = hy + (SH - hy) * p * p
    for (let sgi = 0; sgi < HSEGS; sgi++) {
      const um = (sgi + 0.5) / HSEGS
      const a = (0.10 + 0.45 * p) * brightness + rippleBright(um, p)
      if (a < 0.025) continue
      ctx.globalAlpha = a > 1 ? 1 : a
      const dy = bounceDy(um, p)
      ctx.beginPath()
      ctx.moveTo((sgi / HSEGS) * SW, yBase + dy)
      ctx.lineTo(((sgi + 1) / HSEGS) * SW, yBase + dy)
      ctx.stroke()
    }
  }
  // Rails converge on the vanishing point, segmented the same way.
  const RAILS = isMobile ? 11 : 17
  const RSEGS = isMobile ? 6 : 10
  const half = (RAILS - 1) / 2
  for (let k = -half; k <= half; k++) {
    for (let sgi = 0; sgi < RSEGS; sgi++) {
      const pm = (sgi + 0.5) / RSEGS
      const t0 = sgi / RSEGS
      const t1 = (sgi + 1) / RSEGS
      const xAt = t => SW / 2 + k * (9 + (SW / 7 - 9) * t)
      const yAt = t => hy + (SH - hy) * t * t
      const a = 0.32 * brightness + rippleBright(xAt(pm) / SW, pm)
      if (a < 0.025) continue
      ctx.globalAlpha = a > 1 ? 1 : a
      const dy = bounceDy(xAt(pm) / SW, pm)
      ctx.beginPath()
      ctx.moveTo(xAt(t0), yAt(t0) + dy)
      ctx.lineTo(xAt(t1), yAt(t1) + dy)
      ctx.stroke()
    }
  }
  // Horizon line, brightest.
  ctx.globalAlpha = 0.8
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, hy)
  ctx.lineTo(SW, hy)
  ctx.stroke()
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawFog() {
  const hy = horizonY()
  const w = Math.max(256, Math.round(SW))
  // Two very dim bands above the horizon, drifting at different speeds.
  ctx.save()
  ctx.globalAlpha = isMobile ? 0.5 : 0.8
  const x = -(fogAX % w)
  ctx.drawImage(fogAC, Math.round(x), Math.round(hy - 78), w, 64)
  ctx.drawImage(fogAC, Math.round(x + w), Math.round(hy - 78), w, 64)
  if (!isMobile) {
    ctx.globalAlpha = 0.6
    const x2 = -(fogBX % w)
    ctx.drawImage(fogBC, Math.round(x2), Math.round(hy - 52), w, 48)
    ctx.drawImage(fogBC, Math.round(x2 + w), Math.round(hy - 52), w, 48)
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawFlare() {
  // Wave-clear lens-flare-ish streak sweeping across the horizon.
  if (flareT < 0) return
  const hy = horizonY()
  const k = flareT / 1.2
  const w = SW * 0.6
  ctx.save()
  ctx.globalAlpha = 0.5 * (1 - k)
  ctx.drawImage(streakC, Math.round(-w + k * (SW + w)), Math.round(hy - 5), Math.round(w), 8)
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawReflections() {
  // The floor is a dark glossy plane: flipped, squashed, low-alpha copies
  // of the baked glow sprites.
  const hy = horizonY()
  const base = !gameStarted ? 0.6 : 1
  ctx.save()
  if (glowCannon && dying <= 0 && !gameOver) {
    const iw = glowCannon.c.width
    const ih = glowCannon.c.height
    const DH = Math.max(2, ih * 0.32)
    ctx.globalAlpha = base * 0.16
    ctx.drawImage(glowCannon.c, Math.round(cannonX - iw / 2), Math.round(cannonY + 10 + DH), iw, -DH)
  }
  for (let i = 0; i < bunkers.length; i++) {
    const b = bunkers[i]
    ctx.globalAlpha = base * 0.20
    ctx.drawImage(bunkerGlowC, Math.round(b.x - 10), Math.round(b.y + b.h + 4), Math.round(b.w + 20), 16)
  }
  if (shot) {
    ctx.globalAlpha = base * 0.12
    ctx.drawImage(glowShot.c, Math.round(shot.x - 4), Math.round(hy + 6 + 34), 8, -34)
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawBunkers() {
  // Baked per-bunker glow sprites; re-rendered once on erosion, then blitted.
  const demo = !gameStarted
  ctx.save()
  for (let i = 0; i < bunkers.length; i++) {
    const b = bunkers[i]
    let bc = bunkerCache[i]
    if (!bc || bc.w !== b.w || bc.h !== b.h || b.dirty) {
      bc = bakeBunker(b)
      bunkerCache[i] = bc
      b.dirty = false
    }
    ctx.globalAlpha = demo ? 0.6 : 1
    ctx.drawImage(bc.c, Math.round(b.x - bc.ox), Math.round(b.y - bc.oy))
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawFormation() {
  const demo = !gameStarted
  const base = demo ? 0.6 : 1
  const fr = frantic()
  // Chromatic aberration follows the heartbeat, max ~3 px.
  const ab = Math.min(3, (1 + fr * 2) * (0.6 + pulse * 0.9))
  ctx.save()
  for (let r = 0; r < ROWS; r++) {
    const rows = speciesRows(r, marchFrame)
    const baked = glowInv[invKey(r, marchFrame)]
    // Slow row-wise breathing wave; the leading row flashes 20 % brighter.
    let a = base * (0.72 + 0.28 * Math.sin(breathT * 1.4 - r * 0.7))
    if (r === flashRow && flashRowT > 0) a *= 1.2
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      if (ab >= 0.75) {
        ctx.globalAlpha = a * 0.30
        ctx.fillStyle = '#ff2244'
        plotRows(rows, rc.x - ab, rc.y, px)
        ctx.fillStyle = CYAN
        plotRows(rows, rc.x + ab, rc.y, px)
      }
      ctx.globalAlpha = a > 1 ? 1 : a
      drawBaked(baked, rc.x, rc.y)
      // White-hot core eye.
      ctx.fillStyle = '#ffffff'
      const ex = rc.x + rc.w / 2
      const ey = rc.y + rc.h * 0.38
      ctx.fillRect(ex - px / 2, ey - px / 2, px, px)
    }
  }
  // 2-frame white kill flashes from the white sprite cache.
  for (let i = 0; i < flashes.length; i++) {
    const f = flashes[i]
    ctx.globalAlpha = base * Math.min(1, f.t / 0.06)
    const wb = glowWhite[f.key]
    if (wb) drawBaked(wb, f.x, f.y)
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawUFO() {
  if (!ufo) return
  const base = !gameStarted ? 0.6 : 1
  ctx.save()
  // Moving gold glow on the sky band + a faint pool on the horizon.
  const gs = Math.max(48, px * 22)
  ctx.globalAlpha = base * 0.5
  ctx.drawImage(glowSkyGold, Math.round(ufo.x - gs / 2), Math.round(ufo.y - gs * 0.28), Math.round(gs), Math.round(gs * 0.6))
  ctx.globalAlpha = base * 0.16
  const hw = SW * 0.2
  ctx.drawImage(glowSkyGold, Math.round(ufo.x - hw / 2), Math.round(horizonY() - 26), Math.round(hw), 30)
  const w = UFO_SPRITE[0].length * px
  ctx.globalAlpha = base
  drawBaked(glowUFO, ufo.x - w / 2, ufo.y)
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawBomb(b) {
  ctx.save()
  ctx.shadowColor = '#ffffff'
  ctx.shadowBlur = isMobile ? 0 : 10
  ctx.fillStyle = '#ffffff'
  const s = Math.max(2, Math.round(px * 0.8))
  if (b.style === 'zigzag') {
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(b.x + (i % 2 ? s : -s), b.y + i * s * 1.4, s, s)
    }
  } else if (b.style === 'plunger') {
    ctx.fillRect(b.x - s / 2, b.y, s, s * 2)
    ctx.fillRect(b.x - s * 1.5, b.y + s * 2, s * 3, s)
    ctx.fillRect(b.x - s / 2, b.y + s * 3, s, s * 3)
    ctx.fillRect(b.x - s * 1.5, b.y + s * 6, s * 3, s)
  } else {
    // Rolling: alternating horizontal bars.
    const off = b.frame ? s : -s
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(b.x - s * 2 + (i === 1 ? off : 0), b.y + i * s * 1.4, s * 4, s)
    }
  }
  ctx.restore()
}

function drawCannon(now) {
  const w = CANNON[0].length * px
  const h = CANNON.length * px
  const demo = !gameStarted
  ctx.save()
  // Afterimage trail with a cyan->white gradient feel: baked cyan ghost
  // plus a hot white core on the middle rows.
  for (let i = 0; i < cannonTrail.length; i++) {
    const t = cannonTrail[i]
    const k = t.t / 0.25
    ctx.globalAlpha = (demo ? 0.6 : 1) * 0.14 * k
    drawBaked(glowCannon, t.x - w / 2, cannonY - h / 2)
    ctx.globalAlpha = (demo ? 0.6 : 1) * 0.10 * k
    ctx.fillStyle = '#ffffff'
    const my0 = Math.floor(CANNON.length * 0.3)
    const my1 = Math.ceil(CANNON.length * 0.7)
    for (let r = my0; r < my1; r++) {
      const line = CANNON[r]
      for (let q = 0; q < line.length; q++) {
        if (line[q] === 'X') ctx.fillRect(t.x - w / 2 + q * px, cannonY - h / 2 + r * px, px, px)
      }
    }
  }
  ctx.restore()
  ctx.globalAlpha = 1
  if (dying > 0) {
    // Cannon explosion: scattering cyan/white blocks.
    const keepAlpha = ctx.globalAlpha
    const k = 1 - dying
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + k * 3
      const d = k * 46
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : CYAN
      ctx.globalAlpha = keepAlpha * (1 - k)
      ctx.fillRect(cannonX + Math.cos(a) * d, cannonY + Math.sin(a) * d * 0.7, px, px)
    }
    ctx.globalAlpha = keepAlpha
    return
  }
  const blink = now < invulnUntil && Math.floor(now * 12) % 2 === 0
  if (blink || gameOver) return
  // Engine glow under the cannon, flaring with speed.
  const spd = Math.min(1, Math.abs(cannonVX) / 600)
  const es = px * (5 + spd * 7)
  ctx.save()
  ctx.globalAlpha = (demo ? 0.6 : 1) * (0.16 + spd * 0.45)
  ctx.drawImage(glowEngine, Math.round(cannonX - es / 2), Math.round(cannonY + h / 2 - es * 0.45), Math.round(es), Math.round(es * 0.6))
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = demo ? 0.6 : 1
  drawBaked(glowCannon, cannonX - w / 2, cannonY - h / 2)
  ctx.restore()
  ctx.globalAlpha = 1
  // Combo tag near the cannon.
  if (mult > 1 && gameStarted) {
    ctx.save()
    ctx.font = `bold ${Math.max(11, px * 3)}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.fillStyle = mult >= 4 ? GOLD : CYAN
    ctx.shadowColor = mult >= 4 ? GOLD : CYAN
    ctx.shadowBlur = isMobile ? 0 : 12
    ctx.fillText(`x${mult} COMBO`, cannonX, cannonY - h / 2 - 12)
    ctx.restore()
  }
}

function draw() {
  if (!ctx) return
  ensureStatic()
  const now = performance.now() / 1000
  const demo = !gameStarted

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  ctx.save()
  if (shake > 0) {
    const m = shake * 7
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
  }

  drawBackground(now)

  // Gameplay dims behind the profile card in attract mode.
  ctx.globalAlpha = demo ? 0.6 : 1

  drawBunkers()
  drawFormation()
  drawUFO()

  // Player shot: baked cyan bolt with a white-hot core.
  if (shot) {
    ctx.save()
    ctx.globalAlpha = demo ? 0.6 : 1
    drawBaked(glowShot, shot.x - 2, shot.y - 12)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(shot.x - 1, shot.y - 10, 2, 8)
    ctx.restore()
  }
  for (let i = 0; i < bombs.length; i++) drawBomb(bombs[i])

  drawCannon(now)
  drawReflections()

  // Attract mode only: a faint scanline sweep travelling top->bottom.
  if (!gameStarted && sweepT > 4.8) {
    const k = (sweepT - 4.8) / 1.2
    ctx.save()
    ctx.drawImage(sweepC, 0, Math.round(k * (SH + 140) - 70 - 45), Math.round(SW), 90)
    ctx.restore()
  }

  // Shockwaves (rtype style rings).
  for (let i = 0; i < shockwaves.length; i++) {
    const sw = shockwaves[i]
    ctx.globalAlpha = (demo ? 0.6 : 1) * sw.life * 0.8
    ctx.strokeStyle = sw.color
    ctx.lineWidth = 2 + sw.life * 5
    ctx.shadowColor = sw.color
    ctx.shadowBlur = isMobile ? 0 : 16 * sw.life
    ctx.beginPath()
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
  ctx.globalAlpha = demo ? 0.6 : 1

  // Particles.
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    ctx.globalAlpha = (demo ? 0.6 : 1) * Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1

  // Score popups (UFO value, extra life).
  ctx.save()
  ctx.font = `bold ${Math.max(12, px * 3)}px "Courier New", monospace`
  ctx.textAlign = 'center'
  for (let i = 0; i < ufoPopups.length; i++) {
    const p = ufoPopups[i]
    ctx.globalAlpha = Math.max(0, 1 - p.t / 1.4)
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = isMobile ? 0 : 12
    ctx.fillText(p.text, p.x, p.y - p.t * 34)
  }
  ctx.restore()
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  ctx.restore()
}

function frame(now) {
  if (!gameRunning) return
  const dtMs = Math.min(50, Math.max(0, now - lastFrameT))
  lastFrameT = now
  update(now)
  updateGame(dtMs / 1000 || 0.016, now / 1000)
  draw()
  animationFrameId = requestAnimationFrame(frame)
}

let lastFrameT = 0

// ---------------------------------------------------------------- input

function isInteractiveElement(el) {
  if (!el || !el.closest) return false
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return true
  if (el.closest('a, button, .social-links, .flip-container, .theme-pager')) return true
  return false
}

function handleKeyDown(e) {
  if (isInteractiveElement(e.target)) return
  keys[e.code] = true
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault()
    if (!e.repeat && gameStarted && !gameOver) fire()
  }
  if (!gameStarted || gameOver) {
    if (e.code === 'Enter' && !e.repeat) startGame()
  }
}

function handleKeyUp(e) {
  keys[e.code] = false
}

function handleResize() {
  // setupCanvas() refreshes SW/SH via layout(), then we rebuild the wave if
  // the width class changed so the 11/8/7 column count adapts while bunkers
  // flip 3<->4.
  setupCanvas()
  const nowCols = SW >= 900 ? 11 : SW >= 600 ? 8 : 7
  if (nowCols !== cols) {
    buildWave()
    resetBunkers()
  }
  // Keep everything on screen after a resize.
  fx = clamp(fx, margin, Math.max(margin, SW - margin - formW))
  fy = Math.max(0, Math.min(fy, bunkerTop() - formH - cellH))
  cannonX = clamp(cannonX, 24, SW - 24)
  if (ufo) ufo.y = Math.max(26, SH * 0.055)
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
  touchActive = true
  touchX = t.clientX
}

function handleTouchMove(e) {
  if (!touchActive) return
  if (isInteractiveElement(e.target)) return
  e.preventDefault()
  const t = e.touches[0]
  touchX = t.clientX
  // Auto-fire while touching.
  if (!shot) fire()
}

function handleTouchEnd(e) {
  if (isInteractiveElement(e.target)) {
    touchActive = false
    return
  }
  const t = e.changedTouches[0]
  const isTap = t && Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 15 && performance.now() - tapStartTime < 400
  if (!gameStarted || gameOver) {
    if (isTap) startGame()
  }
  touchActive = false
}

onMounted(() => {
  setupCanvas()
  startDemo()
  gameRunning = true
  lastTime = performance.now()
  lastFrameT = lastTime
  animationFrameId = requestAnimationFrame(frame)

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', handleResize)
  window.addEventListener('touchstart', handleTouchStart, { passive: true })
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
.invaders-e-canvas {
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
